// js/ui.js
import { state } from './state.js';
import { storageKeys } from './voxels.js';

const cols = 20;
const rows = 15;

export function initUI() {
    document.body.dataset.node = state.currentSector;

    // 1. Initial Loading Screen Removal
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
            setTimeout(() => loadingScreen.remove(), 800);
        }, 200);
    }

    // 2. Setup Pixel Dissolve Overlay & Run Load Animation (Reveal Page)
    let transitionOverlay = document.getElementById('transition-overlay');
    if (!transitionOverlay) {
        transitionOverlay = document.createElement('div');
        transitionOverlay.id = 'transition-overlay';
        transitionOverlay.className = 'transition-overlay';
        document.body.appendChild(transitionOverlay);
    }

    // Build grid of pixel blocks if empty
    if (transitionOverlay.children.length === 0) {
        for (let i = 0; i < cols * rows; i++) {
            const block = document.createElement('div');
            block.className = 'pixel-block active';
            transitionOverlay.appendChild(block);
        }
    }

    // Animate pixels OUT on page entry
    const blocks = transitionOverlay.querySelectorAll('.pixel-block');
    setTimeout(() => {
        if (transitionOverlay) transitionOverlay.classList.add('blocking');
        blocks.forEach((block, i) => {
            const x = i % cols;
            const delay = ((cols - x) * 0.05) + (Math.random() * 0.1);
            block.style.transitionDelay = `${delay}s`;
            block.classList.remove('active');
        });
        setTimeout(() => {
            if (transitionOverlay) transitionOverlay.classList.remove('blocking');
        }, 1500);
    }, 50);

    // 3. Inventory Drawer Toggle
    const inventoryToggle = document.getElementById('inventory-toggle');
    const inventoryBody = document.getElementById('inventory-body');

    if (inventoryToggle && inventoryBody) {
        const inventoryText = inventoryToggle.querySelector('.ascii-plant');
        inventoryToggle.addEventListener('click', (event) => {
            event.stopPropagation();
            inventoryBody.classList.toggle('collapsed');
            inventoryToggle.classList.toggle('collapsed');
            if (inventoryText) inventoryText.textContent = inventoryBody.classList.contains('collapsed') ? 'INVENTORY >' : 'INVENTORY \/';
        });
    }

    // 4. Sector Map Navigation
    renderMap();

    // 5. Alt + R Reset Shortcut
    window.addEventListener('keydown', (event) => {
        if (document.activeElement && document.activeElement.id === 'spyglass-search') return;
        if (event.altKey && event.key.toLowerCase() === 'r') {
            localStorage.removeItem(storageKeys.harvest);
            localStorage.removeItem(storageKeys.wire);
            localStorage.removeItem(storageKeys.seed);
            localStorage.removeItem('megastructure_bookmarks');
            triggerPixelDissolve(window.location.href);
        }
    });
}

function renderMap() {
    const mapContainer = document.getElementById('ascii-map');
    if (!mapContainer) return;

    const connections = {
        'home': ['development', 'news'],
        'development': ['home'],
        'news': ['home', 'hedonism'],
        'hedonism': ['news']
    };

    const allSectors = [
        { id: 'development', label: 'DEVELOPMENT', url: 'development' },
        { id: 'home', label: 'HOME_PAGE', url: 'home' },
        { id: 'news', label: 'NEWS_LOG', url: 'news' },
        { id: 'hedonism', label: 'HEDONISM', url: 'hedonism' }
    ];

    const allowed = connections[state.currentSector] || [];
    const visibleSectors = allSectors.filter(s => s.id === state.currentSector || allowed.includes(s.id));

    let html = `<span class="ascii-deco">+- SECTOR MAP ---------+</span>\n`;
    visibleSectors.forEach(s => {
        const isCurrent = s.id === state.currentSector;
        const mark = isCurrent ? '<span class="mention">[*]</span>' : '[ ]';
        html += `<span class="ascii-deco">|</span> ${mark} <span class="map-link map-text" data-target="${s.url}">${s.label.padEnd(12, ' ')}</span> <span class="ascii-deco">|</span>\n`;
    });
    html += `<span class="ascii-deco">+----------------------+</span>`;
    mapContainer.innerHTML = html;

    document.querySelectorAll('.map-link').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetSector = e.target.dataset.target;
            if (targetSector !== state.currentSector) {
                triggerPixelDissolve(`index.html?sector=${targetSector}`);
            }
        });
    });
}

// Triggered when switching sectors or resetting via Alt+R (Page Unload Animation)
export function triggerPixelDissolve(targetUrl) {
    let overlay = document.getElementById('transition-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'transition-overlay';
        overlay.className = 'transition-overlay';
        document.body.appendChild(overlay);
        for (let i = 0; i < cols * rows; i++) {
            const block = document.createElement('div');
            block.className = 'pixel-block';
            overlay.appendChild(block);
        }
    }

    const blocks = overlay.querySelectorAll('.pixel-block');
    overlay.classList.add('blocking');

    blocks.forEach((block, i) => {
        const x = i % cols;
        const delay = (x * 0.05) + (Math.random() * 0.1);
        block.style.transitionDelay = `${delay}s`;
        block.classList.add('active');
    });

    setTimeout(() => {
        window.location.href = targetUrl;
    }, 1500);
}
