// js/ui.js
import { state } from './state.js';
import { resetAllStructures } from './voxels.js';

const cols = 20;
const rows = 15;

export function initUI() {
    document.body.dataset.node = state.currentSector;

    let transitionOverlay = document.getElementById('transition-overlay');
    if (!transitionOverlay) {
        transitionOverlay = document.createElement('div');
        transitionOverlay.id = 'transition-overlay';
        transitionOverlay.className = 'transition-overlay blocking';
        document.body.appendChild(transitionOverlay);
    } else {
        transitionOverlay.classList.add('blocking');
    }

    if (transitionOverlay.children.length === 0) {
        for (let i = 0; i < cols * rows; i++) {
            const block = document.createElement('div');
            block.className = 'pixel-block active';
            transitionOverlay.appendChild(block);
        }
    }

    const inventoryToggle = document.getElementById('inventory-toggle');
    const inventoryBody = document.getElementById('inventory-body');

    if (inventoryToggle && inventoryBody) {
        const inventoryText = inventoryToggle.querySelector('.ascii-plant');
        inventoryToggle.addEventListener('click', (event) => {
            event.stopPropagation();
            inventoryBody.classList.toggle('collapsed');
            inventoryToggle.classList.toggle('collapsed');
            if (inventoryText) {
                inventoryText.textContent = inventoryBody.classList.contains('collapsed') ? 'INVENTORY >' : 'INVENTORY v';
            }
        });
    }

    renderMap();

    window.addEventListener('keydown', (event) => {
        if (document.activeElement && document.activeElement.id === 'spyglass-search') return;
        if (event.altKey && (event.code === 'KeyR' || event.key.toLowerCase() === 'r')) {
            event.preventDefault();
            Object.keys(localStorage)
            .filter(key => key.startsWith('megastructure_'))
            .forEach(key => localStorage.removeItem(key));
            resetAllStructures();
            triggerPixelDissolve(window.location.href);
        }
    });
}

export function revealPage() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
        setTimeout(() => loadingScreen.remove(), 800);
    }

    const transitionOverlay = document.getElementById('transition-overlay');
    if (transitionOverlay) {
        const blocks = transitionOverlay.querySelectorAll('.pixel-block');
        blocks.forEach((block, i) => {
            const x = i % cols;
            const delay = ((cols - x) * 0.05) + (Math.random() * 0.1);
            block.style.transitionDelay = `${delay}s`;
            block.classList.remove('active');
        });

        setTimeout(() => {
            transitionOverlay.classList.remove('blocking');
        }, 1500);
    }
}

function renderMap() {
    const mapContainer = document.getElementById('ascii-map');
    if (!mapContainer) return;

    const allSectors = [
        { id: 'home', label: 'HOME_PAGE', url: 'home' },
        { id: 'development', label: 'DEVELOPMENT', url: 'development' },
        { id: 'news', label: 'NEWS_LOG', url: 'news' },
        { id: 'hedonism', label: 'HEDONISM', url: 'hedonism' }
    ];

    let html = '<span class="ascii-deco">+- SECTORS ------------+</span>\n';
    allSectors.forEach(s => {
        const isCurrent = s.id === state.currentSector;
        const mark = isCurrent ? '<span class="mention">[*]</span>' : '[ ]';
        html += '<span class="ascii-deco">|</span> ' + mark + ' <span class="map-link map-text" data-target="' + s.url + '">' + s.label.padEnd(12, ' ') + '</span> <span class="ascii-deco">|</span>\n';
    });
    html += '<span class="ascii-deco">+----------------------+</span>';
    mapContainer.innerHTML = html;

    document.querySelectorAll('.map-link').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetSector = e.target.dataset.target;
            if (targetSector !== state.currentSector) {
                triggerPixelDissolve('index.html?sector=' + targetSector);
            }
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
