// js/scene.js
export const sceneBg = new THREE.Scene();
export const sceneFg = new THREE.Scene();

export const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 10;

export const cameraFg = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
cameraFg.position.z = 10;

export let rendererBg, rendererFg;
export let mouseLightBg, mouseLightFg;

export const solidMaterial = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.15, metalness: 0.85 });
export const wireframeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.15, wireframe: true, emissive: 0xff0000, emissiveIntensity: 0.8 });
export const maskMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true });
export const maskGeo = new THREE.PlaneGeometry(1, 1);

export function initScene() {
    const bgContainer = document.getElementById('bg-canvas-container');
    rendererBg = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    rendererBg.setSize(window.innerWidth, window.innerHeight);
    rendererBg.setPixelRatio(window.devicePixelRatio);
    rendererBg.shadowMap.enabled = true;
    rendererBg.shadowMap.type = THREE.PCFSoftShadowMap;
    if (bgContainer) bgContainer.appendChild(rendererBg.domElement);

    sceneBg.add(camera);
    sceneBg.add(new THREE.AmbientLight(0x050505));

    mouseLightBg = new THREE.PointLight(0x66ffff, 50, 40, 2);
    mouseLightBg.castShadow = true;
    mouseLightBg.shadow.mapSize.width = 1024;
    mouseLightBg.shadow.mapSize.height = 1024;
    mouseLightBg.shadow.bias = -0.001;
    camera.add(mouseLightBg);

    const redFillLightBg = new THREE.DirectionalLight(0xff0000, 0.2);
    redFillLightBg.position.set(5, 5, -5);
    sceneBg.add(redFillLightBg);

    const fgContainer = document.getElementById('fg-canvas-container');
    rendererFg = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    rendererFg.setSize(window.innerWidth, window.innerHeight);
    rendererFg.setPixelRatio(window.devicePixelRatio);
    if (fgContainer) fgContainer.appendChild(rendererFg.domElement);

    sceneFg.add(cameraFg);
    sceneFg.add(new THREE.AmbientLight(0x050505));

    mouseLightFg = new THREE.PointLight(0x66ffff, 50, 40, 2);
    cameraFg.add(mouseLightFg);

    const redFillLightFg = new THREE.DirectionalLight(0xff0000, 0.2);
    redFillLightFg.position.set(5, 5, -5);
    sceneFg.add(redFillLightFg);
}
