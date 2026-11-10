// js/chunks.js
import * as THREE from 'three';
import { state } from './state.js';
import { sceneBg, solidMaterial, wireframeMaterial } from './scene.js';
import { sectorStructures } from './structures.js';
import { storageKeys, harvestedCubeIds, wireframeCubeIds } from './voxels.js';

const CHUNK_SIZE = 32; // Size of each world chunk along Z axis
export const activeChunks = new Map(); // key: chunkIndex, value: { mesh, data: [...] }
export const chunkHarvestedMap = new Map(); // tracks local instance visibility

const vSize = 0.35;
const voxelGeo = new THREE.BoxGeometry(vSize, vSize, vSize);

export function updateChunks(cameraZ) {
    // Determine current chunk index based on camera Z position
    const currentChunkIdx = Math.floor(-cameraZ / CHUNK_SIZE);

    // Render chunks within a 3-chunk radius (load ahead and behind)
    const renderRadius = 3;
    const activeIndices = new Set();

    for (let i = currentChunkIdx - 1; i <= currentChunkIdx + renderRadius; i++) {
        activeIndices.add(i);
        if (!activeChunks.has(i)) {
            generateChunk(i);
        }
    }

    // Unload chunks outside radius to free memory
    for (const [idx, chunk] of activeChunks.entries()) {
        if (!activeIndices.has(idx)) {
            sceneBg.remove(chunk.mesh);
            chunk.mesh.geometry.dispose();
            activeChunks.delete(idx);
        }
    }
}

function generateChunk(chunkIndex) {
    const startZ = -chunkIndex * CHUNK_SIZE;
    const endZ = startZ - CHUNK_SIZE;

    // Collect all voxel matrices for this chunk range
    const matricesData = [];

    // Build procedural or custom structures falling into this chunk range
    const chunkZStartPos = startZ;
    const chunkZEndPos = endZ;

    // We can evaluate structures or procedural pillars falling into this Z range
    // For simplicity, let's process custom structures registered in sectorStructures
    const activeStructures = sectorStructures[state.currentSector] || [];

    // Example voxel collector loop for the chunk volume
    for (let x = -20; x <= 20; x += vSize * 3) {
        // ... evaluate structural generation per chunk ...
    }

    // If we have instances, create a single THREE.InstancedMesh for the chunk
    if (matricesData.length === 0) return;

    const count = matricesData.length;
    const instancedMesh = new THREE.InstancedMesh(voxelGeo, solidMaterial, count);
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    matricesData.forEach((item, index) => {
        dummy.position.copy(item.position);
        dummy.scale.setScalar(item.scale || 1);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(index, dummy.matrix);

        // Save mapping for raycasting and harvesting
        item.instanceId = index;
    });

    instancedMesh.instanceMatrix.needsUpdate = true;
    sceneBg.add(instancedMesh);
    activeChunks.set(chunkIndex, { mesh: instancedMesh, data: matricesData });
}

// Adapted Harvest Mechanic for InstancedMesh
export function handleChunkRaycast(raycaster, camera, cubesArray, harvestingCubesArray) {
    const chunkMeshes = Array.from(activeChunks.values()).map(c => c.mesh);
    const intersects = raycaster.intersectObjects(chunkMeshes);

    if (intersects.length > 0) {
        const hit = intersects[0];
        const instancedMesh = hit.object;
        const instanceId = hit.instanceId;

        // Find which chunk this mesh belongs to
        let targetChunk = null;
        for (const chunk of activeChunks.values()) {
            if (chunk.mesh === instancedMesh) {
                targetChunk = chunk;
                break;
            }
        }

        if (!targetChunk) return;
        const cubeData = targetChunk.data[instanceId];
        if (!cubeData || cubeData.harvested) return;

        // Mark harvested
        cubeData.harvested = true;
        harvestedCubeIds.push(cubeData.id);
        localStorage.setItem(storageKeys.harvest, JSON.stringify(harvestedCubeIds));

        // Hide instance by scaling it to zero in the InstancedMesh matrix
        const dummy = new THREE.Object3D();
        instancedMesh.getMatrixAt(instanceId, dummy.matrix);
        dummy.matrix.scale(new THREE.Vector3(0, 0, 0));
        instancedMesh.setMatrixAt(instanceId, dummy.matrix);
        instancedMesh.instanceMatrix.needsUpdate = true;

        // Spawn a standalone animated mesh for the fly-to-HUD harvest animation
        const flyMesh = new THREE.Mesh(voxelGeo, solidMaterial);
        flyMesh.position.copy(hit.point);

        // Compute target HUD position
        let targetLocalPos = new THREE.Vector3(0, 0, -4.0);
        const cubeCountDisplayEl = document.getElementById('cube-count-display');
        if (cubeCountDisplayEl) {
            const rect = cubeCountDisplayEl.getBoundingClientRect();
            const ndcX = ((rect.left + rect.width / 2) / window.innerWidth) * 2 - 1;
            const ndcY = -(((rect.top + rect.height / 2) / window.innerHeight) * 2 - 1);
            const vFov = (camera.fov * Math.PI) / 180;
            const heightAtZ = 2 * Math.tan(vFov / 2) * Math.abs(-4.0);
            targetLocalPos.set(ndcX * (heightAtZ * camera.aspect / 2), ndcY * (heightAtZ / 2), -4.0);
        }

        sceneBg.add(flyMesh);
        camera.worldToLocal(flyMesh.position);
        flyMesh.userData = { targetPos: targetLocalPos };
        harvestingCubesArray.push(flyMesh);
    }
}
