// js/voxels.js
import { state } from './state.js';
import { sceneBg, solidMaterial, wireframeMaterial } from './scene.js';
import { sectorStructures } from './structures.js';

export const cubes = [];
export const pillarGroups = [];
export const debrisClusters = [];
export const harvestingCubes = [];
export let harvestedCubeIds = [];
export let wireframeCubeIds = [];

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

    // Factory passed to builders so custom structures perfectly track global ID states
    const createVoxel = (vx, vy, vz, matS, matW) => {
        const thisId = state.globalCubeIdCounter++;
        if (harvestedCubeIds.includes(thisId)) return null;

        const isWire = wireframeCubeIds.includes(thisId);
        const voxel = new THREE.Mesh(voxelGeo, isWire ? matW : matS);
        voxel.position.set(vx * vSize, vy * vSize, vz * vSize);
        voxel.castShadow = true;
        voxel.receiveShadow = true;
        voxel.userData = { id: thisId, isWireframe: isWire, isStatic: true, sMat: matS, wMat: matW };
        cubes.push(voxel);
        return voxel;
    };

    function buildProceduralPillar(stateType, sMat, wMat) {
        const group = new THREE.Group();
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

                    const v = createVoxel(x, y, z, sMat, wMat);
                    if (v) group.add(v);
                }
            }
        }
        return group;
    }

    const corridorWidth = 14;
    const pillarYOffset = -10;
    const states = ['intact', 'broken-left', 'broken-right', 'shattered-top'];
    const activeStructures = sectorStructures[state.currentSector] || [];

    sceneBg.fog = new THREE.Fog(0xe0e0e0, Math.min(20, panelWrapDistance * 0.12), Math.max(90, panelWrapDistance * 0.75));

    for (let i = 0; i < corridorDepthCount; i++) {
        const zPos = -(i * spacingZ);
        const customStruct = activeStructures.find(s => s.zIndex === i);

        // 1. INJECT CUSTOM STRUCTURES
        if (customStruct) {
            const localSMat = solidMaterial.clone(); localSMat.transparent = false;
            const localWMat = wireframeMaterial.clone(); localWMat.transparent = true;

            const pGroup = customStruct.builder(createVoxel, localSMat, localWMat);
            pGroup.position.set(0, pillarYOffset, zPos);
            pGroup.userData = { sMat: localSMat, wMat: localWMat };

            sceneBg.add(pGroup);
            pillarGroups.push(pGroup);
            continue; // Skip procedural generation for this index
        }

        // 2. PROCEDURAL GENERATION BACKUP
        [-1, 1].forEach(sideMultiplier => {
            const xPos = (corridorWidth / 2) * sideMultiplier;
            const stateIndex = Math.min(Math.floor(seededRandom() * states.length), states.length - 1);
            const stateType = states[stateIndex] || 'intact';

            const localSMat = solidMaterial.clone(); localSMat.transparent = false;
            const localWMat = wireframeMaterial.clone(); localWMat.transparent = true;

            const pGroup = buildProceduralPillar(stateType, localSMat, localWMat);
            pGroup.position.set(xPos, pillarYOffset, zPos);
            pGroup.userData = { sMat: localSMat, wMat: localWMat };
            sceneBg.add(pGroup);
            pillarGroups.push(pGroup);

            if (stateType !== 'intact') {
                const debrisGroup = new THREE.Group();
                sceneBg.add(debrisGroup);
                debrisClusters.push(debrisGroup);

                const debrisSMat = solidMaterial.clone(); debrisSMat.transparent = false;
                const debrisWMat = wireframeMaterial.clone(); debrisWMat.transparent = true;
                debrisGroup.userData = { sMat: debrisSMat, wMat: debrisWMat };

                const cubeCount = Math.floor(seededRandom() * 5) + 2;
                const epicenterY = stateType === 'shattered-top' ? 10 : 5;

                for (let j = 0; j < cubeCount; j++) {
                    const v = createVoxel(0, 0, 0, debrisSMat, debrisWMat);
                    if (v) {
                        v.scale.setScalar(seededRandom() * 1.0 + 0.5);
                        const scatterX = (seededRandom() - 0.5) * 4;
                        const scatterY = (seededRandom() - 0.5) * 4;
                        const scatterZ = (seededRandom() - 0.5) * 4;

                        v.position.set(scatterX + (sideMultiplier * -2), scatterY + epicenterY, scatterZ);
                        v.rotation.set(seededRandom() * Math.PI, seededRandom() * Math.PI, 0);
                        v.userData.isStatic = false;
                        v.userData.rotX = (seededRandom() - 0.5) * 0.04;
                        v.userData.rotY = (seededRandom() - 0.5) * 0.04;

                        debrisGroup.add(v);
                    }
                }
                debrisGroup.position.set(xPos, pillarYOffset, zPos);
            }
        });
    }

    if (cubeCountDisplayEl) cubeCountDisplayEl.textContent = `CUBE COUNT: ${state.collectedCubes}/${state.globalCubeIdCounter}`;
}
