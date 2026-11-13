// js/main.js
import { state } from './state.js';
import { initScene, sceneBg, sceneFg, rendererBg, rendererFg, camera, cameraFg, mouseLightBg, mouseLightFg } from './scene.js';
import { fetchPostsAndComments } from './pocketbase.js';
import { initCursor, updateCursorBounds, cursorData, cursorTiltContainer, cursorSpinGroup } from './cursor.js';
import { initPanels, updateMaskScales, panelData, masks } from './panels.js';
import {
    initVoxels, pillarGroups, debrisClusters, harvestingCubes,
    harvestedCubeIds, wireframeCubeIds, storageKeys,
    solidInstancedMesh, wireInstancedMesh, instanceRegistry,
    syncGroupMatrices, spawnHarvestFlyMesh
} from './voxels.js';
import { initUI, revealPage } from './ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    initScene();
    initCursor();
    initUI();

    await fetchPostsAndComments(state.currentSector);

    initPanels();
    const corridorDepthCount = state.panelWrapDistance / 20;
    initVoxels(corridorDepthCount, 20, state.panelWrapDistance);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); rendererBg.setSize(window.innerWidth, window.innerHeight);
        cameraFg.aspect = window.innerWidth / window.innerHeight; cameraFg.updateProjectionMatrix(); rendererFg.setSize(window.innerWidth, window.innerHeight);
        updateMaskScales(); updateCursorBounds();
    });

    document.addEventListener('mousemove', (event) => {
        state.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        state.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        if (state.lastClientX !== null) { state.targetVelocity.x = event.clientX - state.lastClientX; state.targetVelocity.y = event.clientY - state.lastClientY; }
        state.lastClientX = event.clientX; state.lastClientY = event.clientY;
    });

    const raycaster = new THREE.Raycaster();
    window.addEventListener('contextmenu', (event) => { event.preventDefault(); });
    window.addEventListener('mousedown', (event) => { if (event.button === 0 || event.button === 2) cursorData.targetTiltX = cursorData.clickTiltX; });

    window.addEventListener('mouseup', (event) => {
        if (event.button === 0 || event.button === 2) cursorData.targetTiltX = cursorData.idleTiltX;
        if (event.target.closest('.hud-button') || event.target.closest('.ui-left') || event.target.closest('.disconnected-shape') || event.target.closest('.modal-overlay')) return;
        if (event.button !== 0 && event.button !== 2) return;

        raycaster.setFromCamera(state.mouse, camera);

        const targets = [...masks];
        if (solidInstancedMesh) targets.push(solidInstancedMesh);
        if (wireInstancedMesh) targets.push(wireInstancedMesh);

        const intersects = raycaster.intersectObjects(targets, false);

        if (intersects.length > 0) {
            const hit = intersects[0];
            if (masks.includes(hit.object)) return;

            const instanceId = hit.instanceId;
            if (instanceId === undefined) return;

            const entry = instanceRegistry[instanceId];
            if (!entry || entry.isHarvested || !entry.group.visible) return;

            // Right-Click: Toggle Wireframe
            if (event.button === 2) {
                entry.isWireframe = !entry.isWireframe;
                if (entry.isWireframe) {
                    if (!wireframeCubeIds.includes(entry.id)) wireframeCubeIds.push(entry.id);
                } else {
                    const idx = wireframeCubeIds.indexOf(entry.id);
                    if (idx > -1) wireframeCubeIds.splice(idx, 1);
                }
                localStorage.setItem(storageKeys.wire, JSON.stringify(wireframeCubeIds));
                syncGroupMatrices(entry.group);
            }
            // Left-Click: Harvest Instance
            else if (event.button === 0) {
                entry.isHarvested = true;
                if (!harvestedCubeIds.includes(entry.id)) {
                    harvestedCubeIds.push(entry.id);
                    localStorage.setItem(storageKeys.harvest, JSON.stringify(harvestedCubeIds));
                }
                syncGroupMatrices(entry.group);
                spawnHarvestFlyMesh(entry, camera);
            }
        }
    });

    function animate() {
        requestAnimationFrame(animate);

        camera.position.z += (state.targetCameraZ - camera.position.z) * 0.08;

        if (cursorData.cursorPlaneWidth) {
            const pX = state.mouse.x * (cursorData.cursorPlaneWidth / 2);
            const pY = state.mouse.y * (cursorData.cursorPlaneHeight / 2);
            mouseLightBg.position.set(pX, pY, cursorData.cursorZ);
            mouseLightFg.position.set(pX, pY, cursorData.cursorZ);
        }

        state.targetVelocity.x *= 0.85; state.targetVelocity.y *= 0.85;
        state.currentVelocity.x += (state.targetVelocity.x - state.currentVelocity.x) * 0.15;
        state.currentVelocity.y += (state.targetVelocity.y - state.currentVelocity.y) * 0.15;

        cursorTiltContainer.rotation.x += (cursorData.targetTiltX - cursorTiltContainer.rotation.x) * 0.3;
        cursorSpinGroup.rotation.y -= 0.02;

        for (let i = harvestingCubes.length - 1; i >= 0; i--) {
            const cube = harvestingCubes[i];
            cube.position.lerp(cube.userData.targetPos, 0.15);
            cube.scale.multiplyScalar(0.85); cube.rotation.x += 0.3; cube.rotation.y += 0.3;
            if (cube.scale.x < 0.02) {
                camera.remove(cube); harvestingCubes.splice(i, 1);
                state.collectedCubes = harvestedCubeIds.length;
                const cubeCountDisplayEl = document.getElementById('cube-count-display');
                if (cubeCountDisplayEl) {
                    cubeCountDisplayEl.textContent = `CUBE COUNT: ${state.collectedCubes}/${state.globalCubeIdCounter}`;
                    cubeCountDisplayEl.style.transform = 'scale(1.2)'; cubeCountDisplayEl.style.color = 'var(--color-cyan)';
                    setTimeout(() => { cubeCountDisplayEl.style.transform = 'scale(1)'; cubeCountDisplayEl.style.color = 'var(--color-dark-grey)'; }, 150);
                }
            }
        }

        const maxVisibleDist = Math.min(140, state.panelWrapDistance - 25);

        // Wrap pillar/structure groups & update instance matrices ONLY if position or visibility changed
        pillarGroups.forEach(group => {
            let dirty = false;
            if (group.position.z > camera.position.z + 25) {
                group.position.z -= state.panelWrapDistance;
                dirty = true;
            } else if (group.position.z < camera.position.z - state.panelWrapDistance + 25) {
                group.position.z += state.panelWrapDistance;
                dirty = true;
            }

            const dist = camera.position.z - group.position.z;
            const shouldBeVisible = (dist >= -15 && dist <= maxVisibleDist + 15);
            if (group.visible !== shouldBeVisible) {
                group.visible = shouldBeVisible;
                dirty = true;
            }

            if (dirty) syncGroupMatrices(group);
        });

            // Wrap debris clusters & animate spinning debris only for visible clusters
            debrisClusters.forEach(group => {
                if (group.position.z > camera.position.z + 25) group.position.z -= state.panelWrapDistance;
                else if (group.position.z < camera.position.z - state.panelWrapDistance + 25) group.position.z += state.panelWrapDistance;

                const dist = camera.position.z - group.position.z;
                const shouldBeVisible = (dist >= -15 && dist <= maxVisibleDist + 15);

                if (shouldBeVisible) {
                    group.visible = true;
                    group.userData.entries.forEach(entry => {
                        if (!entry.isHarvested) {
                            entry.rot.x += entry.rotX + (state.currentVelocity.y * 0.003);
                            entry.rot.y += entry.rotY + (state.currentVelocity.x * 0.003);
                        }
                    });
                    syncGroupMatrices(group);
                } else if (group.visible) {
                    group.visible = false;
                    syncGroupMatrices(group);
                }
            });

            panelData.forEach(panel => {
                if (panel.isBookmarked) return;

                if (panel.pos.z > camera.position.z + 25) panel.pos.z -= state.panelWrapDistance;
                else if (panel.pos.z < camera.position.z - state.panelWrapDistance + 25) panel.pos.z += state.panelWrapDistance;

                if (panel.el.dataset.filtered === 'true') {
                    panel.el.style.opacity = 0; panel.el.style.pointerEvents = 'none'; panel.maskMesh.visible = false;
                    return;
                }

                const vec = panel.pos.clone();
                const dist = camera.position.z - vec.z;

                if (dist < -15 || dist > maxVisibleDist) {
                    panel.el.style.opacity = 0; panel.el.style.pointerEvents = 'none'; panel.maskMesh.visible = false;
                    return;
                }

                vec.project(camera);
                const x = (vec.x * 0.5 + 0.5) * window.innerWidth;
                const y = -(vec.y * 0.5 - 0.5) * window.innerHeight;
                const scale = 10 / Math.max(dist, 0.1);

                let opacity = 1;
                if (dist < 8) opacity = Math.max(0, (dist - 2) / 6);
                else if (dist > maxVisibleDist - 50) opacity = Math.max(0, (maxVisibleDist - dist) / 50);

                panel.maskMesh.position.copy(panel.pos);
                panel.maskMesh.position.z += 0.5;
                panel.maskMesh.visible = (opacity > 0.05);

                panel.el.style.zIndex = Math.floor(1000 - dist);
                panel.el.style.transform = `translate3d(calc(-50% + ${x}px), calc(-50% + ${y}px), 0) scale(${scale})`;
                panel.el.style.opacity = opacity;
                panel.el.style.pointerEvents = (opacity >= 0.5) ? 'auto' : 'none';
            });

            rendererBg.render(sceneBg, camera);
            rendererFg.render(sceneFg, cameraFg);
    }

    animate();

    requestAnimationFrame(() => {
        revealPage();
    });
});
