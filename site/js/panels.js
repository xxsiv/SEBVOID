// js/panels.js
import { state } from './state.js';
import { sceneBg, camera, maskGeo, maskMaterial } from './scene.js';

export let panelData = [];
export const masks = [];
export let savedBookmarks = [];

export function initPanels() {
    const htmlPanels = document.querySelectorAll('.disconnected-shape:not(.ui-box)');
    state.panelWrapDistance = Math.max(htmlPanels.length * state.panelSpacing, 80);

    try { savedBookmarks = JSON.parse(localStorage.getItem('megastructure_bookmarks')) || []; } catch(e) {}

    panelData = Array.from(htmlPanels).map((el, i) => {
        const zDepth = -(i * state.panelSpacing) - (state.panelSpacing / 2);
        const maskMesh = new THREE.Mesh(maskGeo, maskMaterial);
        maskMesh.renderOrder = -999;
        sceneBg.add(maskMesh);
        masks.push(maskMesh);

        const isArchived = savedBookmarks.some(b => b.id === el.id);
        if (isArchived) {
            el.style.display = 'none';
            maskMesh.visible = false;
        }
        return { el: el, pos: new THREE.Vector3(0, 2, zDepth), maskMesh: maskMesh, isBookmarked: isArchived };
    });

    if (panelData.length > 0) {
        state.targetCameraZ = panelData[0].pos.z + 12;
        camera.position.z = state.targetCameraZ;
    }

    const resizeObserver = new ResizeObserver(() => updateMaskScales());
    panelData.forEach(panel => resizeObserver.observe(panel.el));

    setupInteractions();
    updateMaskScales();
}

export function updateMaskScales() {
    const vFov = (camera.fov * Math.PI) / 180;
    const visibleHeightAt10 = 2 * Math.tan(vFov / 2) * 10;
    const visibleWidthAt10 = visibleHeightAt10 * camera.aspect;

    panelData.forEach(panel => {
        if (panel.isBookmarked) return;
        const pWidth = panel.el.offsetWidth || 450;
        const pHeight = panel.el.offsetHeight || 300;
        const mWidth = ((pWidth + 40) / window.innerWidth) * visibleWidthAt10;
        const mHeight = ((pHeight + 40) / window.innerHeight) * visibleHeightAt10;
        panel.maskMesh.scale.set(mWidth, mHeight, 1);
    });
}

function setupInteractions() {
    // 1. Bookmarks Logic
    panelData.forEach(panel => {
        const btn = panel.el.querySelector('.bookmark-btn');
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = panel.el.id;

                const cloneHTML = panel.el.cloneNode(true);
                const rmBtn = cloneHTML.querySelector('.bookmark-btn');
                if (rmBtn) rmBtn.remove();

                savedBookmarks.push({ id: id, html: cloneHTML.innerHTML });
                localStorage.setItem('megastructure_bookmarks', JSON.stringify(savedBookmarks));

                const rect = panel.el.getBoundingClientRect();
                const targetEl = document.getElementById('btn-bookmarks');
                const targetRect = targetEl.getBoundingClientRect();

                const flier = panel.el.cloneNode(true);
                flier.style.position = 'fixed';
                flier.style.top = rect.top + 'px';
                flier.style.left = rect.left + 'px';
                flier.style.width = rect.width + 'px';
                flier.style.height = rect.height + 'px';
                flier.style.margin = '0';
                flier.style.zIndex = '9999';
                flier.style.transition = 'all 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
                document.body.appendChild(flier);

                panel.isBookmarked = true;
                panel.el.style.display = 'none';
                panel.maskMesh.visible = false;

                requestAnimationFrame(() => {
                    flier.style.top = targetRect.top + 'px';
                    flier.style.left = targetRect.left + 'px';
                    flier.style.transform = 'scale(0.1)';
                    flier.style.opacity = '0';
                });

                setTimeout(() => { flier.remove(); }, 600);
            });
        }
    });

    // 2. Spyglass Search Logic
    const searchInput = document.getElementById('spyglass-search');
    const searchResults = document.getElementById('search-results');
    const teleportFlash = document.getElementById('teleport-flash');

    if (searchInput && searchResults) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            searchResults.innerHTML = '';

            if (query.trim() === '') {
                searchResults.classList.remove('active');
                panelData.forEach(panel => { if (!panel.isBookmarked) panel.el.dataset.filtered = 'false'; });
                return;
            }

            searchResults.classList.add('active');
            let matches = 0;

            panelData.forEach(panel => {
                if (panel.isBookmarked) return;
                const textContent = panel.el.innerText.toLowerCase();
                const isMatch = textContent.includes(query);
                panel.el.dataset.filtered = isMatch ? 'false' : 'true';

                if (isMatch) {
                    matches++;
                    const titleEl = panel.el.querySelector('h1, h2, h3');
                    const titleText = titleEl ? titleEl.innerText : 'UNTITLED_RECORD';

                    const item = document.createElement('div');
                    item.className = 'search-result-item';
                    item.innerText = `> ${titleText}`;

                    item.addEventListener('click', () => {
                        if (teleportFlash) {
                            teleportFlash.classList.add('active');
                            setTimeout(() => { teleportFlash.classList.remove('active'); }, 50);
                        }
                        camera.position.z = panel.pos.z + 30;
                        state.targetCameraZ = panel.pos.z + 12;

                        searchInput.value = '';
                        searchResults.classList.remove('active');
                        panelData.forEach(p => { if (!p.isBookmarked) p.el.dataset.filtered = 'false'; });
                    });

                    searchResults.appendChild(item);
                }
            });

            if (matches === 0) {
                searchResults.innerHTML = '<div class="search-result-item" style="color:var(--color-dark-grey);">[ NO_DATA ]</div>';
            }
        });
    }

    // 3. Bookmark Modal Rendering
    const btnBookmarks = document.getElementById('btn-bookmarks');
    const bookmarksModal = document.getElementById('bookmarks-modal');
    const closeBookmarks = document.getElementById('close-bookmarks');
    const bookmarksList = document.getElementById('bookmarks-list');

    if (btnBookmarks && bookmarksModal && closeBookmarks) {
        btnBookmarks.addEventListener('click', (e) => {
            e.stopPropagation();
            renderBookmarksList();
            bookmarksModal.style.display = 'flex';
        });
        closeBookmarks.addEventListener('click', () => { bookmarksModal.style.display = 'none'; });
    }

    function renderBookmarksList() {
        bookmarksList.innerHTML = '';
        if (savedBookmarks.length === 0) {
            bookmarksList.innerHTML = '<p style="color:var(--color-dark-grey); text-align:center; font-family:monospace;">NO ARCHIVES FOUND.</p>';
        } else {
            savedBookmarks.forEach((b, index) => {
                const div = document.createElement('div');
                div.className = 'bookmarked-post';
                div.innerHTML = `
                <div style="display:flex; justify-content:flex-end; margin-bottom:0.5rem;">
                <button class="unbookmark-btn hud-button" data-index="${index}" style="width:auto; padding:0.1rem 0.5rem; font-size:0.9rem;">[ UNBOOKMARK ]</button>
                </div>
                ${b.html}
                `;
                bookmarksList.appendChild(div);
            });

            bookmarksList.querySelectorAll('.unbookmark-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = parseInt(e.target.dataset.index);
                    const removedBookmark = savedBookmarks[index];

                    savedBookmarks.splice(index, 1);
                    localStorage.setItem('megastructure_bookmarks', JSON.stringify(savedBookmarks));

                    const originalPanel = document.getElementById(removedBookmark.id);
                    if (originalPanel) {
                        originalPanel.style.display = 'block';
                        const matchedPanelData = panelData.find(p => p.el.id === removedBookmark.id);
                        if (matchedPanelData) {
                            matchedPanelData.isBookmarked = false;
                            matchedPanelData.maskMesh.visible = true;
                            updateMaskScales();
                        }
                    }

                    renderBookmarksList();
                });
            });
        }
    }

    // 4. Scroll Control
    const scrollSensitivity = 0.05;
    window.addEventListener('wheel', (event) => {
        const shape = event.target.closest('.disconnected-shape');
        if (shape && parseFloat(shape.style.opacity || '1') >= 0.5) return;
        if (event.target.closest('.ui-body, .modal-content')) return;
        state.targetCameraZ -= event.deltaY * scrollSensitivity;
    }, { passive: false });

    let touchStartY = 0;
    window.addEventListener('touchstart', (event) => {
        if (event.target.closest('.ui-body, .modal-content')) return;
        touchStartY = event.touches[0].clientY;
    }, { passive: false });

    window.addEventListener('touchmove', (event) => {
        const shape = event.target.closest('.disconnected-shape');
        const touchY = event.touches[0].clientY;
        const deltaY = touchStartY - touchY;
        if (shape && parseFloat(shape.style.opacity || '1') >= 0.5) { touchStartY = touchY; return; }
        if (event.target.closest('.ui-body, .modal-content')) return;
        state.targetCameraZ -= deltaY * (scrollSensitivity * 0.5);
        touchStartY = touchY;
    }, { passive: false });

    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    function snapToPanel(direction) {
        const offsetZ = -(state.panelSpacing / 2) + 12;
        let currentIndex = Math.round((state.targetCameraZ - offsetZ) / -state.panelSpacing);
        state.targetCameraZ = offsetZ - ((currentIndex + direction) * state.panelSpacing);
    }
    if (btnPrev) btnPrev.addEventListener('click', () => snapToPanel(-1));
    if (btnNext) btnNext.addEventListener('click', () => snapToPanel(1));
}
