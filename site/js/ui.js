// js/ui.js
import { state } from './state.js';
import { storageKeys } from './voxels.js';

export function initUI() {
    document.body.dataset.node = state.currentSector;

    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
            setTimeout(() => loadingScreen.remove(), 800);
        }, 200);
    }

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

    renderMap();

    window.addEventListener('keydown', (event) => {
        if (document.activeElement.id === 'spyglass-search') return;
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
    const connections = { 'home': ['development', 'news'], 'development': ['home'], 'news': ['home', 'hedonism'], 'hedonism': ['news'] };
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
            if (targetSector !== state.currentSector) triggerPixelDissolve(`index.html?sector=${targetSector}`);
        });
    });
}

export function triggerPixelDissolve(targetUrl) {
    let overlay = document.getElementById('transition-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'transition-overlay';
        overlay.className = 'transition-overlay';
        document.body.appendChild(overlay);
        for(let i = 0; i < 300; i++) {
            const block = document.createElement('div');
            block.className = 'pixel-block active';
            overlay.appendChild(block);
        }
    }
    const blocks = document.querySelectorAll('.pixel-block');
    overlay.classList.add('blocking');
    blocks.forEach((block, i) => {
        const delay = ((i % 20) * 0.05) + (Math.random() * 0.1);
        block.style.transitionDelay = `${delay}s`;
        block.classList.add('active');
    });
    setTimeout(() => { window.location.href = targetUrl; }, 1500);
}
