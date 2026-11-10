// Main Initialization File
import { fetchPosts } from './api.js';
import { renderPosts, renderFallback, postContainer } from './ui.js';
// import { initScene, updateMaskScales, initRaycaster, animate } from './scene.js';

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const currentSector = urlParams.get('sector') || 'home';
    document.body.dataset.node = currentSector;

    // 1. Fetch and Render Data
    try {
        const data = await fetchPosts(currentSector);
        await renderPosts(data.items);
    } catch (error) {
        console.error("PocketBase Error:", error);
        renderFallback();
    }

    // 2. Initialize 3D Scene
    // initScene(currentSector);
    
    // 3. Bind UI interactions (Bookmarks, Search, Map)
    // initUIInteractions();
    
    // 4. Start Animation Loop
    // animate();
});
