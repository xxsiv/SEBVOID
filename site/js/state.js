// js/state.js
const urlParams = new URLSearchParams(window.location.search);

export const state = {
    currentSector: urlParams.get('sector') || 'home',
    mouse: new THREE.Vector2(),
    targetVelocity: { x: 0, y: 0 },
    currentVelocity: { x: 0, y: 0 },
    lastClientX: null,
    lastClientY: null,
    targetCameraZ: 10,
    collectedCubes: 0,
    globalCubeIdCounter: 0,
    panelSpacing: 80,
    panelWrapDistance: 80 // Will be recalculated in panels.js
};
