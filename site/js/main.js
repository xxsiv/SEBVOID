// js/main.js
import { state } from './state.js';
import { initScene, sceneBg, sceneFg, rendererBg, rendererFg, camera, cameraFg, mouseLightBg, mouseLightFg, solidMaterial, wireframeMaterial } from './scene.js';
import { fetchPostsAndComments } from './pocketbase.js';
import { initCursor, updateCursorBounds, cursorData, cursorTiltContainer, cursorSpinGroup } from './cursor.js';
import { initPanels, updateMaskScales, panelData, masks } from './panels.js';
import { initVoxels, cubes, pillarGroups, debrisClusters, harvestingCubes, harvestedCubeIds, wireframeCubeIds, storageKeys } from './voxels.js';
import { initUI, revealPage } from './ui.js';
import { updateChunks, handleChunkRaycast } from './chunks.js';

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

        // Check chunked instanced mesh raycasting first
        if (event.button === 0) {
            handleChunkRaycast(raycaster, camera, cubes, harvestingCubes);
        }

        const intersects = raycaster.intersectObjects([...cubes, ...masks]);

        if (intersects.length > 0) {
            const hitObject = intersects[0].object;
            if (masks.includes(hitObject)) return;

            if (event.button === 2) {
                hitObject.userData.isWireframe = !hitObject.userData.isWireframe;
                hitObject.material = hitObject.userData.isWireframe ? (hitObject.userData.wMat || wireframeMaterial) : (hitObject.userData.sMat || solidMaterial);
                const id = hitObject.userData.id;
                if (hitObject.userData.isWireframe) { if (!wireframeCubeIds.includes(id)) wireframeCubeIds.push(id); } else { wireframeCubeIds.splice(wireframeCubeIds.indexOf(id), 1); }
                localStorage.setItem(storageKeys.wire, JSON.stringify(wireframeCubeIds));
            }
            else if (event.button === 0) {
                const index = cubes.indexOf(hitObject);
                if (index > -1) cubes.splice(index, 1);
                const id = hitObject.userData.id;
                if (!harvestedCubeIds.includes(id)) { harvestedCubeIds.push(id); localStorage.setItem(storageKeys.harvest, JSON.stringify(harvestedCubeIds)); }

                hitObject.material = hitObject.userData.isWireframe ? wireframeMaterial : solidMaterial;

                let targetLocalPos = new THREE.Vector3(0, 0, -4.0);
                const cubeCountDisplayEl = document.getElementById('cube-count-display');
                if (cubeCountDisplayEl) {
                    const rect = cubeCountDisplayEl.getBoundingClientRect();
                    const targetScreenX = rect.left + rect.width / 2;
                    const targetScreenY = rect.top + rect.height / 2;
                    const ndcX = (targetScreenX / window.innerWidth) * 2 - 1;
                    const ndcY = -(targetScreenY / window.innerHeight) * 2 + 1;
                    const targetZ = -4.0;
                    const vFov = (camera.fov * Math.PI) / 180;
                    const heightAtZ = 2 * Math.tan(vFov / 2) * Math.abs(targetZ);
                    targetLocalPos.set(ndcX * (heightAtZ * camera.aspect / 2), ndcY * (heightAtZ / 2), targetZ);
                }

                const worldPos = new THREE.Vector3();
                hitObject.getWorldPosition(worldPos);
                hitObject.parent.remove(hitObject);
                camera.add(hitObject);
                camera.worldToLocal(worldPos);
                hitObject.position.copy(worldPos);
                hitObject.userData.targetPos = targetLocalPos;
                harvestingCubes.push(hitObject);
            }
        }
    });

    function animate() {
        requestAnimationFrame(animate);

        camera.position.z += (state.targetCameraZ - camera.position.z) * 0.08;

        // Update spatial chunks based on camera position
        updateChunks(camera.position.z);

        if (cursorData.cursorPlaneWidth) {
            const pX = state.mouse.x * (cursorData.cursorPlaneWidth / 2);
            const pY = state.mouse.y * (cursorData.cursorPlaneHeight / 2);
            mouseLightBg.position.set(pX, pY, cursorData.cursorZ);
            mouseLightFg.position.set(pX, pY, cursorData.cursorZ);
        }

        state.targetVelocity.x *= 0.85; state.targetVelocity.y *= 0.85;
        state.currentVelocity.x += (state.targetVelocity.x - state.currentVelocity.x) * 0.15;
        state.currentVelocity.y += (state.targetVelocity.y - state.currentVelocity.y) * 0.15;

        cursorTiltContainer.rotation.x += (cursorData.targetTiltX - cursorData.rotation.x) * 0.3;
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

        pillarGroups.forEach(group => {
            if (group.position.z > camera.position.z + 25) group.position.z -= state.panelWrapDistance;
            else if (group.position.z < camera.position.z - state.panelWrapDistance + 25) group.position.z += state.panelWrapDistance;
        });

            debrisClusters.forEach(group => {
                if (group.position.z > camera.position.z + 25) group.position.z -= state.panelWrapDistance;
                else if (group.position.z < camera.position.z - state.panelWrapDistance + 25) group.position.z += state.panelWrapDistance;
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

                cubes.forEach((cube) => {
                    if (!cube.userData.isStatic) {
                        cube.rotation.x += cube.userData.rotX + (state.currentVelocity.y * 0.003);
                        cube.rotation.y += cube.userData.rotY + (state.currentVelocity.x * 0.003);
                    }
                });

                rendererBg.render(sceneBg, camera);
                rendererFg.render(sceneFg, cameraFg);
    }

    animate();

    requestAnimationFrame(() => {
        revealPage();
    });
});
