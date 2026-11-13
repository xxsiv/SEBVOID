// js/voxels.js
import { state } from './state.js';
import { sceneBg, solidMaterial, wireframeMaterial } from './scene.js';
import { sectorStructures } from './structures.js';

export const pillarGroups = [];
export const debrisClusters = [];
export const harvestingCubes = [];
export let harvestedCubeIds = [];
export let wireframeCubeIds = [];

// Master InstancedMeshes & Registry
export let solidInstancedMesh = null;
export let wireInstancedMesh = null;
export const instanceRegistry = [];

const vSize = 0.35;
const voxelGeo = new THREE.BoxGeometry(vSize, vSize, vSize);

export const storageKeys = {
    harvest: `megastructure_harvested_${state.currentSector}`,
    wire: `megastructure_wireframes_${state.currentSector}`,
    seed: `megastructure_seed_${state.currentSector}`
};

export function initVoxels(corridorDepthCount, spacingZ, panelWrapDistance) {
    const cubeCountDisplayEl = document.getElementById('cube-count-display');

    try { harvestedCubeIds = JSON.parse(localStorage.getItem(storageKeys.harvest)) || []; } catch(e) {}
    try { wireframeCubeIds = JSON.parse(localStorage.getItem(storageKeys.wire)) || []; } catch(e) {}
    state.collectedCubes = harvestedCubeIds.length;

    let mapSeed = localStorage.getItem(storageKeys.seed);
    let parsedSeed = parseInt(mapSeed);
    if (!mapSeed || isNaN(parsedSeed)) {
        parsedSeed = Math.floor(Math.random() * 1000000);
        localStorage.setItem(storageKeys.seed, parsedSeed.toString());
    }

    function createPRNG(seed) {
        let s = seed;
        return function() {
            let t = s += 0x6D2B79F5;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        }
    }
    const seededRandom = createPRNG(parsedSeed);

    let currentTargetGroup = null;
    const createVoxel = (vx, vy, vz, matS, matW, isDynamic = false) => {
        const thisId = state.globalCubeIdCounter++;
        const isHarvested = harvestedCubeIds.includes(thisId);
        const isWire = wireframeCubeIds.includes(thisId) || (matS === wireframeMaterial);

        const entry = {
            instanceId: instanceRegistry.length,
            id: thisId,
            group: currentTargetGroup,
            localPos: new THREE.Vector3(vx * vSize, vy * vSize, vz * vSize),
            scale: 1,
            rot: new THREE.Euler(0, 0, 0),
            isWireframe: isWire,
            defaultWireframe: (matS === wireframeMaterial),
                isHarvested: isHarvested,
                isDynamic: isDynamic,
                rotX: 0,
                rotY: 0
        };

        instanceRegistry.push(entry);
        if (currentTargetGroup) {
            currentTargetGroup.userData.entries.push(entry);
        }

        return {
            userData: entry,
            position: entry.localPos,
            rotation: entry.rot,
            scale: { setScalar: (s) => { entry.scale = s; } }
        };
    };

    function buildProceduralPillar(stateType, sMat, wMat) {
        const group = new THREE.Group();
        group.userData.entries = [];
        currentTargetGroup = group;

        let maxHeight = 45;
        if (stateType === 'shattered-top') maxHeight = 28;

        for (let y = 0; y < maxHeight; y++) {
            let isCapOrBase = (y < 2) || (stateType !== 'shattered-top' && y > maxHeight - 3);
            let limit = isCapOrBase ? 2 : 1;

            for (let x = -limit; x <= limit; x++) {
                for (let z = -limit; z <= limit; z++) {
                    if (isCapOrBase && Math.abs(x) === 2 && Math.abs(z) === 2) continue;
                    if (!isCapOrBase && Math.abs(x) === 1 && Math.abs(z) === 1) continue;
                    if (stateType === 'broken-left' && y >= 15 && y <= 25 && ((x < 0 && seededRandom() > 0.1) || (x === 0 && seededRandom() > 0.5))) continue;
                    if (stateType === 'broken-right' && y >= 15 && y <= 25 && ((x > 0 && seededRandom() > 0.1) || (x === 0 && seededRandom() > 0.5))) continue;
                    if (stateType === 'shattered-top' && y >= 20 && seededRandom() < ((y - 20) / (maxHeight - 20))) continue;

                    createVoxel(x, y, z, sMat, wMat, false);
                }
            }
        }
        return group;
    }

    const corridorWidth = 14;
    const pillarYOffset = -10;
    const states = ['intact', 'broken-left', 'broken-right', 'shattered-top'];
    const activeStructures = sectorStructures[state.currentSector] || [];

    const sectorColors = {
        'home': 0xffffff,
        'development': 0xf0faf3,
        'news': 0xfaf0f0,
        'hedonism': 0xf8f0fa,
    };

    const activeColor = sectorColors[state.currentSector] || 0xffffff;

    const fogNear = 25;
    const fogFar = Math.max(160, panelWrapDistance * 0.85);

    sceneBg.background = new THREE.Color(activeColor);
    sceneBg.fog = new THREE.Fog(activeColor, fogNear, fogFar);

    const maxStructZ = activeStructures.length > 0 ? Math.max(...activeStructures.map(s => s.zIndex + 1)) : 0;
    const loopCount = Math.max(corridorDepthCount, maxStructZ);

    for (let i = 0; i < loopCount; i++) {
        const zPos = -(i * spacingZ);
        const customStruct = activeStructures.find(s => s.zIndex === i);

        // 1. Custom Structures
        if (customStruct) {
            const wrapperGroup = new THREE.Group();
            wrapperGroup.userData.entries = [];
            currentTargetGroup = wrapperGroup;

            customStruct.builder(createVoxel, solidMaterial, wireframeMaterial);

            const structScale = customStruct.scale || 1;
            const structY = customStruct.yOffset !== undefined ? customStruct.yOffset : pillarYOffset;

            wrapperGroup.scale.setScalar(structScale);
            wrapperGroup.position.set(0, structY, zPos);
            sceneBg.add(wrapperGroup);
            pillarGroups.push(wrapperGroup);
            continue;
        }

        // 2. Procedural Pillars
        [-1, 1].forEach(sideMultiplier => {
            const xPos = (corridorWidth / 2) * sideMultiplier;
            const stateIndex = Math.min(Math.floor(seededRandom() * states.length), states.length - 1);
            const stateType = states[stateIndex] || 'intact';

            const pGroup = buildProceduralPillar(stateType, solidMaterial, wireframeMaterial);
            pGroup.position.set(xPos, pillarYOffset, zPos);
            sceneBg.add(pGroup);
            pillarGroups.push(pGroup);

            if (stateType !== 'intact') {
                const debrisGroup = new THREE.Group();
                debrisGroup.userData.entries = [];
                currentTargetGroup = debrisGroup;

                sceneBg.add(debrisGroup);
                debrisClusters.push(debrisGroup);

                const cubeCount = Math.floor(seededRandom() * 5) + 2;
                const epicenterY = stateType === 'shattered-top' ? 10 : 5;

                for (let j = 0; j < cubeCount; j++) {
                    const proxy = createVoxel(0, 0, 0, solidMaterial, wireframeMaterial, true);
                    proxy.scale.setScalar(seededRandom() * 1.0 + 0.5);

                    const scatterX = (seededRandom() - 0.5) * 4;
                    const scatterY = (seededRandom() - 0.5) * 4;
                    const scatterZ = (seededRandom() - 0.5) * 4;

                    proxy.position.set(scatterX + (sideMultiplier * -2), scatterY + epicenterY, scatterZ);
                    proxy.rotation.set(seededRandom() * Math.PI, seededRandom() * Math.PI, 0);
                    proxy.userData.rotX = (seededRandom() - 0.5) * 0.04;
                    proxy.userData.rotY = (seededRandom() - 0.5) * 0.04;
                }
                debrisGroup.position.set(xPos, pillarYOffset, zPos);
            }
        });
    }

    const totalCount = instanceRegistry.length;
    solidInstancedMesh = new THREE.InstancedMesh(voxelGeo, solidMaterial, totalCount);
    wireInstancedMesh = new THREE.InstancedMesh(voxelGeo, wireframeMaterial, totalCount);

    solidInstancedMesh.castShadow = true;
    solidInstancedMesh.receiveShadow = true;
    solidInstancedMesh.frustumCulled = false;
    wireInstancedMesh.frustumCulled = false;

    sceneBg.add(solidInstancedMesh);
    sceneBg.add(wireInstancedMesh);

    syncAllInstanceMatrices();

    if (cubeCountDisplayEl) cubeCountDisplayEl.textContent = `CUBE COUNT: ${state.collectedCubes}/${state.globalCubeIdCounter}`;
}

const dummy = new THREE.Object3D();
const zeroScale = new THREE.Vector3(0, 0, 0);

export function syncGroupMatrices(group) {
    if (!solidInstancedMesh || !wireInstancedMesh || !group.userData.entries) return;

    const entries = group.userData.entries;
    const isVisible = group.visible;
    const gScale = group.scale.x;
    const fade = group.userData.fade !== undefined ? group.userData.fade : 1;

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const idx = entry.instanceId;

        if (!isVisible || entry.isHarvested || fade <= 0.005) {
            dummy.scale.copy(zeroScale);
            dummy.updateMatrix();
            solidInstancedMesh.setMatrixAt(idx, dummy.matrix);
            wireInstancedMesh.setMatrixAt(idx, dummy.matrix);
            continue;
        }

        dummy.position.set(
            group.position.x + (entry.localPos.x * gScale),
                           group.position.y + (entry.localPos.y * gScale),
                           group.position.z + (entry.localPos.z * gScale)
        );
        dummy.rotation.copy(entry.rot);
        dummy.scale.setScalar(entry.scale * gScale * fade);
        dummy.updateMatrix();

        if (entry.isWireframe) {
            wireInstancedMesh.setMatrixAt(idx, dummy.matrix);
            dummy.scale.copy(zeroScale);
            dummy.updateMatrix();
            solidInstancedMesh.setMatrixAt(idx, dummy.matrix);
        } else {
            solidInstancedMesh.setMatrixAt(idx, dummy.matrix);
            dummy.scale.copy(zeroScale);
            dummy.updateMatrix();
            wireInstancedMesh.setMatrixAt(idx, dummy.matrix);
        }
    }

    solidInstancedMesh.instanceMatrix.needsUpdate = true;
    wireInstancedMesh.instanceMatrix.needsUpdate = true;
}

export function syncAllInstanceMatrices() {
    pillarGroups.forEach(g => syncGroupMatrices(g));
    debrisClusters.forEach(g => syncGroupMatrices(g));
}

export function resetAllStructures() {
    harvestedCubeIds.length = 0;
    wireframeCubeIds.length = 0;
    state.collectedCubes = 0;

    instanceRegistry.forEach(entry => {
        entry.isHarvested = false;
        entry.isWireframe = entry.defaultWireframe;
    });

    const cubeCountDisplayEl = document.getElementById('cube-count-display');
    if (cubeCountDisplayEl) {
        cubeCountDisplayEl.textContent = `CUBE COUNT: 0/${state.globalCubeIdCounter}`;
    }

    syncAllInstanceMatrices();
}

export function spawnHarvestFlyMesh(entry, camera) {
    const gScale = entry.group.scale.x;
    const flyMesh = new THREE.Mesh(voxelGeo, entry.isWireframe ? wireframeMaterial : solidMaterial);
    flyMesh.scale.setScalar(entry.scale * gScale);

    const worldPos = new THREE.Vector3(
        entry.group.position.x + (entry.localPos.x * gScale),
                                       entry.group.position.y + (entry.localPos.y * gScale),
                                       entry.group.position.z + (entry.localPos.z * gScale)
    );

    camera.add(flyMesh);
    camera.worldToLocal(worldPos);
    flyMesh.position.copy(worldPos);

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

    flyMesh.userData.targetPos = targetLocalPos;
    harvestingCubes.push(flyMesh);
}
