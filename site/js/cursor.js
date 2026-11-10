// js/cursor.js
import { solidMaterial, mouseLightFg, camera } from './scene.js';

export const cursorSpinGroup = new THREE.Group();
export const cursorTiltContainer = new THREE.Group();
export const cursorData = {
    idleTiltX: Math.PI / 8,
    clickTiltX: Math.PI / 3,
    targetTiltX: Math.PI / 8,
    cursorPlaneWidth: 0,
    cursorPlaneHeight: 0,
    cursorZ: -8.5
};

function createEtherealGlow() {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(102, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(102, 255, 255, 0.6)');
    gradient.addColorStop(1, 'rgba(102, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
}

export function initCursor() {
    const cursorRadius = 0.12;
    const cursorHeight = 0.45;
    const pyramidGeo = new THREE.ConeGeometry(cursorRadius, cursorHeight, 4);
    pyramidGeo.translate(0, -cursorHeight / 2, 0);
    const outlineGeo = new THREE.ConeGeometry(cursorRadius + 0.04, cursorHeight + 0.08, 4);
    outlineGeo.translate(0, -(cursorHeight + 0.08) / 2, 0);

    const frontCore = new THREE.Mesh(pyramidGeo, solidMaterial);
    const glowMat = new THREE.SpriteMaterial({ map: createEtherealGlow(), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const frontGlow = new THREE.Sprite(glowMat);
    frontGlow.scale.set(1.5, 1.5, 1.5);
    frontGlow.position.y = -cursorHeight / 2;

    const occludedCoreMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.85 });
    const occludedCore = new THREE.Mesh(pyramidGeo, occludedCoreMat);
    const occludedOutlineMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
    const occludedOutline = new THREE.Mesh(outlineGeo, occludedOutlineMat);

    cursorSpinGroup.add(frontCore); cursorSpinGroup.add(frontGlow); cursorSpinGroup.add(occludedCore); cursorSpinGroup.add(occludedOutline);

    cursorTiltContainer.rotation.z = Math.PI / 4;
    cursorTiltContainer.rotation.x = cursorData.idleTiltX;
    cursorTiltContainer.add(cursorSpinGroup);

    mouseLightFg.add(cursorTiltContainer);
    updateCursorBounds();
}

export function updateCursorBounds() {
    const vFov = (camera.fov * Math.PI) / 180;
    cursorData.cursorPlaneHeight = 2 * Math.tan(vFov / 2) * Math.abs(cursorData.cursorZ);
    cursorData.cursorPlaneWidth = cursorData.cursorPlaneHeight * camera.aspect;
}
