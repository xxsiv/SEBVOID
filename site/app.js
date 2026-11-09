document.addEventListener('DOMContentLoaded', async () => {

    const urlParams = new URLSearchParams(window.location.search);
    const currentSector = urlParams.get('sector') || 'home';
    document.body.dataset.node = currentSector;

    const postContainer = document.getElementById('post-container');
    let fetchedPostCount = 2;

    // =========================================
    // POCKETBASE FETCH (Posts + Comments)
    // =========================================
    try {
        const pbUrl = `https://api.sebco.win/api/collections/posts/records?filter=(sector='${currentSector}')&sort=-created`;
        const response = await fetch(pbUrl);

        if (!response.ok) throw new Error(`PocketBase denied access. Status: ${response.status}`);
        const data = await response.json();
        fetchedPostCount = Math.max(data.items.length, 1);

        for (const post of data.items) {
            const postId = `post-${post.id}`;
            const rawTags = post.hashtags ? post.hashtags : '';
            const tagsHtml = rawTags.split(',')
            .map(tag => tag.trim() ? `<span class="hashtag">#${tag.trim()}</span>` : '')
            .join('');

            let commentsHtml = '';
            try {
                const commUrl = `https://api.sebco.win/api/collections/comments/records?filter=(post='${post.id}')&sort=created`;
                const commRes = await fetch(commUrl);
                if (commRes.ok) {
                    const commData = await commRes.json();
                    commentsHtml = commData.items.map(c => `
                    <div class="comment-item">
                    <strong>${escapeHtml(c.author)}:</strong> ${escapeHtml(c.text)}
                    </div>
                    `).join('');
                }
            } catch(err) { console.error("Comments fetch error:", err); }

            const div = document.createElement('div');
            div.className = 'disconnected-shape';
            div.id = postId;
            div.innerHTML = `
            <div class="post-header">
            <button class="bookmark-btn" data-id="${postId}">[ BOOKMARK ]</button>
            </div>
            <h2>${post.title}</h2>
            <div>${post.content}</div>
            <div class="hashtags">${tagsHtml}</div>

            <div class="comment-section">
            <div class="comment-list" id="comment-list-${post.id}">
            ${commentsHtml || '<div style="font-family:monospace; font-size:0.85rem; color:#666;">No transmissions yet.</div>'}
            </div>
            <form class="comment-form" data-post-id="${post.id}">
            <input type="text" class="comment-input" placeholder="Your Name / Alias" required autocomplete="off">
            <textarea class="comment-textarea" rows="2" placeholder="Leave a transmission..." required></textarea>
            <button type="submit" class="comment-submit">[ TRANSMIT ]</button>
            </form>
            </div>
            `;
            postContainer.appendChild(div);
        }

        document.querySelectorAll('.comment-form').forEach(form => {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const postId = form.dataset.postId;
                const authorInput = form.querySelector('.comment-input');
                const textInput = form.querySelector('.comment-textarea');

                const payload = {
                    post: postId,
                    author: authorInput.value.trim(),
                                  text: textInput.value.trim()
                };

                try {
                    const postRes = await fetch('https://api.sebco.win/api/collections/comments/records', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (postRes.ok) {
                        const newComment = await postRes.json();
                        const listEl = document.getElementById(`comment-list-${postId}`);

                        if (listEl.querySelector('div[style]')) listEl.innerHTML = '';

                                  const commentDiv = document.createElement('div');
                        commentDiv.className = 'comment-item';
                        commentDiv.innerHTML = `<strong>${escapeHtml(newComment.author)}:</strong> ${escapeHtml(newComment.text)}`;
                        listEl.appendChild(commentDiv);

                        authorInput.value = '';
                        textInput.value = '';
                        listEl.scrollTop = listEl.scrollHeight;
                    } else {
                        alert('Transmission failed. Check PocketBase permissions for comments collection.');
                    }
                } catch (err) {
                    console.error("Failed to post comment:", err);
                }
            });
        });

    } catch (error) {
        console.error("PocketBase Error:", error);
        const div = document.createElement('div');
        div.className = 'disconnected-shape';
        div.id = 'post-fallback';
        div.innerHTML = `
        <h2>DATABASE OFFLINE</h2>
        <p>Ensure PocketBase server is running at api.sebco.win.</p>
        <div class="hashtags"><span class="hashtag">#error</span></div>
        `;
        postContainer.appendChild(div);
    }

    function escapeHtml(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
            setTimeout(() => loadingScreen.remove(), 800);
        }, 200);
    }

    // =========================================
    // SCENE 1: BACKGROUND (Pillars & Masks)
    // =========================================
    const bgContainer = document.getElementById('bg-canvas-container');
    const sceneBg = new THREE.Scene();
    const rendererBg = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    rendererBg.setSize(window.innerWidth, window.innerHeight);
    rendererBg.setPixelRatio(window.devicePixelRatio);
    rendererBg.shadowMap.enabled = true;
    rendererBg.shadowMap.type = THREE.PCFSoftShadowMap;
    if (bgContainer) bgContainer.appendChild(rendererBg.domElement);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 10;
    sceneBg.add(camera);

    sceneBg.fog = new THREE.Fog(0xe0e0e0, 20, 90);
    sceneBg.add(new THREE.AmbientLight(0x050505));

    const mouseLightBg = new THREE.PointLight(0x66ffff, 50, 40, 2);
    mouseLightBg.castShadow = true;
    mouseLightBg.shadow.mapSize.width = 1024;
    mouseLightBg.shadow.mapSize.height = 1024;
    mouseLightBg.shadow.bias = -0.001;
    camera.add(mouseLightBg);

    const redFillLightBg = new THREE.DirectionalLight(0xff0000, 0.2);
    redFillLightBg.position.set(5, 5, -5);
    sceneBg.add(redFillLightBg);

    // =========================================
    // SCENE 2: FOREGROUND (Cursor Overlay)
    // =========================================
    const fgContainer = document.getElementById('fg-canvas-container');
    const sceneFg = new THREE.Scene();
    const rendererFg = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    rendererFg.setSize(window.innerWidth, window.innerHeight);
    rendererFg.setPixelRatio(window.devicePixelRatio);
    if (fgContainer) fgContainer.appendChild(rendererFg.domElement);

    const cameraFg = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    cameraFg.position.z = 10;
    sceneFg.add(cameraFg);

    sceneFg.add(new THREE.AmbientLight(0x050505));
    const mouseLightFg = new THREE.PointLight(0x66ffff, 50, 40, 2);
    cameraFg.add(mouseLightFg);
    const redFillLightFg = new THREE.DirectionalLight(0xff0000, 0.2);
    redFillLightFg.position.set(5, 5, -5);
    sceneFg.add(redFillLightFg);

    // =========================================
    // MATERIALS & SECTOR-SPECIFIC PERSISTENCE
    // =========================================
    const solidMaterial = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.15, metalness: 0.85 });
    const wireframeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.15, wireframe: true, emissive: 0xff0000, emissiveIntensity: 0.8 });
    const maskMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true });
    const maskGeo = new THREE.PlaneGeometry(1, 1);

    const vSize = 0.35;
    const voxelGeo = new THREE.BoxGeometry(vSize, vSize, vSize);
    const cubes = [];
    const pillarGroups = [];
    const debrisClusters = [];
    const masks = [];

    const cubeCountDisplayEl = document.getElementById('cube-count-display');

    const storageHarvestKey = `megastructure_harvested_${currentSector}`;
    const storageWireKey = `megastructure_wireframes_${currentSector}`;
    const storageSeedKey = `megastructure_seed_${currentSector}`;

    let harvestedCubeIds = [];
    let wireframeCubeIds = [];

    try { harvestedCubeIds = JSON.parse(localStorage.getItem(storageHarvestKey)) || []; } catch(e) {}
    try { wireframeCubeIds = JSON.parse(localStorage.getItem(storageWireKey)) || []; } catch(e) {}

    let collectedCubes = harvestedCubeIds.length;
    const harvestingCubes = [];

    let mapSeed = localStorage.getItem(storageSeedKey);
    let parsedSeed = parseInt(mapSeed);
    if (!mapSeed || isNaN(parsedSeed)) {
        parsedSeed = Math.floor(Math.random() * 1000000);
        localStorage.setItem(storageSeedKey, parsedSeed.toString());
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

    const cursorSpinGroup = new THREE.Group();
    cursorSpinGroup.add(frontCore); cursorSpinGroup.add(frontGlow); cursorSpinGroup.add(occludedCore); cursorSpinGroup.add(occludedOutline);

    const cursorTiltContainer = new THREE.Group();
    cursorTiltContainer.rotation.z = Math.PI / 4;
    const idleTiltX = Math.PI / 8;
    const clickTiltX = Math.PI / 3;
    let targetTiltX = idleTiltX;
    cursorTiltContainer.rotation.x = idleTiltX;
    cursorTiltContainer.add(cursorSpinGroup);

    mouseLightFg.add(cursorTiltContainer);

    let cursorPlaneWidth, cursorPlaneHeight;
    const cursorZ = -8.5;

    function updateCursorBounds() {
        const vFov = (camera.fov * Math.PI) / 180;
        cursorPlaneHeight = 2 * Math.tan(vFov / 2) * Math.abs(cursorZ);
        cursorPlaneWidth = cursorPlaneHeight * camera.aspect;
    }

    let globalCubeIdCounter = 0;

    function buildVoxelPillar(state) {
        const group = new THREE.Group();
        let maxHeight = 45;
        if (state === 'shattered-top') maxHeight = 28;

        for (let y = 0; y < maxHeight; y++) {
            let isCapOrBase = false;
            if (y < 2) isCapOrBase = true;
            if (state !== 'shattered-top' && y > maxHeight - 3) isCapOrBase = true;

            let limit = isCapOrBase ? 2 : 1;
            for (let x = -limit; x <= limit; x++) {
                for (let z = -limit; z <= limit; z++) {
                    if (isCapOrBase && Math.abs(x) === 2 && Math.abs(z) === 2) continue;
                    if (!isCapOrBase && Math.abs(x) === 1 && Math.abs(z) === 1) continue;

                    if (state === 'broken-left' && y >= 15 && y <= 25) {
                        if (x < 0 && seededRandom() > 0.1) continue;
                        if (x === 0 && seededRandom() > 0.5) continue;
                    }
                    if (state === 'broken-right' && y >= 15 && y <= 25) {
                        if (x > 0 && seededRandom() > 0.1) continue;
                        if (x === 0 && seededRandom() > 0.5) continue;
                    }
                    if (state === 'shattered-top' && y >= 20) {
                        let destructChance = (y - 20) / (maxHeight - 20);
                        if (seededRandom() < destructChance) continue;
                    }

                    const thisId = globalCubeIdCounter++;
                    if (harvestedCubeIds.includes(thisId)) continue;

                    const isWire = wireframeCubeIds.includes(thisId);
                    const voxel = new THREE.Mesh(voxelGeo, isWire ? wireframeMaterial : solidMaterial);

                    voxel.position.set(x * vSize, y * vSize, z * vSize);
                    voxel.castShadow = true;
                    voxel.receiveShadow = true;
                    voxel.userData = { id: thisId, isWireframe: isWire, isStatic: true };

                    group.add(voxel);
                    cubes.push(voxel);
                }
            }
        }
        return group;
    }

    const panelSpacing = 80;
    const corridorDepthCount = Math.max(fetchedPostCount * 2, 6);
    const spacingZ = 20;
    const corridorWidth = 14;
    const pillarYOffset = -10;
    const states = ['intact', 'broken-left', 'broken-right', 'shattered-top'];

    for (let i = 0; i < corridorDepthCount; i++) {
        const zPos = -(i * spacingZ);

        [-1, 1].forEach(sideMultiplier => {
            const xPos = (corridorWidth / 2) * sideMultiplier;
            const stateIndex = Math.min(Math.floor(seededRandom() * states.length), states.length - 1);
            const state = states[stateIndex] || 'intact';

            const pGroup = buildVoxelPillar(state);
            pGroup.position.set(xPos, pillarYOffset, zPos);
            sceneBg.add(pGroup);
            pillarGroups.push(pGroup);

            if (state !== 'intact') {
                const debrisGroup = new THREE.Group();
                sceneBg.add(debrisGroup);
                debrisClusters.push(debrisGroup);

                const cubeCount = Math.floor(seededRandom() * 5) + 2;
                const epicenterY = state === 'shattered-top' ? 10 : 5;

                for (let j = 0; j < cubeCount; j++) {
                    const thisId = globalCubeIdCounter++;
                    if (harvestedCubeIds.includes(thisId)) continue;

                    const isWire = wireframeCubeIds.includes(thisId);
                    const cube = new THREE.Mesh(voxelGeo, isWire ? wireframeMaterial : solidMaterial);

                    cube.castShadow = true;
                    cube.receiveShadow = true;
                    const randomScale = seededRandom() * 1.0 + 0.5;
                    cube.scale.setScalar(randomScale);

                    const scatterX = (seededRandom() - 0.5) * 4;
                    const scatterY = (seededRandom() - 0.5) * 4;
                    const scatterZ = (seededRandom() - 0.5) * 4;
                    const inwardForce = sideMultiplier * -2;

                    cube.position.set(scatterX + inwardForce, scatterY + epicenterY, scatterZ);
                    cube.rotation.set(seededRandom() * Math.PI, seededRandom() * Math.PI, 0);

                    cube.userData = { id: thisId, rotX: (seededRandom() - 0.5) * 0.04, rotY: (seededRandom() - 0.5) * 0.04, isWireframe: isWire, isStatic: false };
                    debrisGroup.add(cube);
                    cubes.push(cube);
                }
                debrisGroup.position.set(xPos, pillarYOffset, zPos);
            }
        });
    }

    if (cubeCountDisplayEl) cubeCountDisplayEl.textContent = `CUBE COUNT: ${collectedCubes}/${globalCubeIdCounter}`;

    const htmlPanels = document.querySelectorAll('.disconnected-shape:not(.ui-box)');
    const panelWrapDistance = Math.max(htmlPanels.length * panelSpacing, 80);

    let savedBookmarks = [];
    try { savedBookmarks = JSON.parse(localStorage.getItem('megastructure_bookmarks')) || []; } catch(e) {}

    let targetCameraZ = 10;
    const teleportFlash = document.getElementById('teleport-flash');

    const panelData = Array.from(htmlPanels).map((el, i) => {
        const zDepth = -(i * panelSpacing) - (panelSpacing / 2);
        const xOffset = i % 2 === 0 ? -1.5 : 1.5;

        const maskMesh = new THREE.Mesh(maskGeo, maskMaterial);
        maskMesh.renderOrder = -999;
        sceneBg.add(maskMesh);
        masks.push(maskMesh);

        const isArchived = savedBookmarks.some(b => b.id === el.id);
        if (isArchived) {
            el.style.display = 'none';
            maskMesh.visible = false;
        }

        return { el: el, pos: new THREE.Vector3(xOffset, 2, zDepth), maskMesh: maskMesh, isBookmarked: isArchived };
    });

    function updateMaskScales() {
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

    const searchInput = document.getElementById('spyglass-search');
    const searchResults = document.getElementById('search-results');

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
                        targetCameraZ = panel.pos.z + 12;

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
                        }
                    }

                    renderBookmarksList();
                });
            });
        }
    }

    const scrollSensitivity = 0.05;
    window.addEventListener('wheel', (event) => { targetCameraZ -= event.deltaY * scrollSensitivity; }, { passive: false });

    let touchStartY = 0;
    window.addEventListener('touchstart', (event) => { touchStartY = event.touches[0].clientY; }, { passive: false });
    window.addEventListener('touchmove', (event) => {
        const touchY = event.touches[0].clientY;
        targetCameraZ -= (touchStartY - touchY) * (scrollSensitivity * 0.5);
        touchStartY = touchY;
    }, { passive: false });

    function snapToPanel(direction) {
        const idealDist = 12;
        const offsetZ = -(panelSpacing / 2) + idealDist;
        let currentIndex = Math.round((targetCameraZ - offsetZ) / -panelSpacing);
        currentIndex += direction;
        targetCameraZ = offsetZ - (currentIndex * panelSpacing);
    }

    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    if (btnPrev) btnPrev.addEventListener('click', () => snapToPanel(-1));
    if (btnNext) btnNext.addEventListener('click', () => snapToPanel(1));

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); rendererBg.setSize(window.innerWidth, window.innerHeight);
        cameraFg.aspect = window.innerWidth / window.innerHeight; cameraFg.updateProjectionMatrix(); rendererFg.setSize(window.innerWidth, window.innerHeight);
        updateMaskScales(); updateCursorBounds();
    });

    window.addEventListener('keydown', (event) => {
        if (document.activeElement === searchInput) return;
        if (event.altKey && event.key.toLowerCase() === 'r') {
            localStorage.removeItem(storageHarvestKey);
            localStorage.removeItem(storageWireKey);
            localStorage.removeItem(storageSeedKey);
            localStorage.removeItem('megastructure_bookmarks');
            triggerPixelDissolve(window.location.href);
        }
    });

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    window.addEventListener('contextmenu', (event) => { event.preventDefault(); });
    window.addEventListener('mousedown', (event) => { if (event.button === 0 || event.button === 2) targetTiltX = clickTiltX; });
    window.addEventListener('mouseup', (event) => {
        if (event.button === 0 || event.button === 2) targetTiltX = idleTiltX;
        if (event.target.closest('.hud-button') || event.target.closest('.ui-left') || event.target.closest('.disconnected-shape') || event.target.closest('.modal-overlay')) return;
        if (event.button !== 0 && event.button !== 2) return;

        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects([...cubes, ...masks]);

        if (intersects.length > 0) {
            const hitObject = intersects[0].object;
            if (masks.includes(hitObject)) return;

            if (event.button === 2) {
                hitObject.userData.isWireframe = !hitObject.userData.isWireframe;
                hitObject.material = hitObject.userData.isWireframe ? wireframeMaterial : solidMaterial;
                const id = hitObject.userData.id;
                if (hitObject.userData.isWireframe) { if (!wireframeCubeIds.includes(id)) wireframeCubeIds.push(id); } else { wireframeCubeIds = wireframeCubeIds.filter(item => item !== id); }
                localStorage.setItem(storageWireKey, JSON.stringify(wireframeCubeIds));
            }
            else if (event.button === 0) {
                const index = cubes.indexOf(hitObject);
                if (index > -1) cubes.splice(index, 1);
                const id = hitObject.userData.id;
                if (!harvestedCubeIds.includes(id)) { harvestedCubeIds.push(id); localStorage.setItem(storageHarvestKey, JSON.stringify(harvestedCubeIds)); }

                let targetLocalPos = new THREE.Vector3(0, 0, -4.0);
                if (cubeCountDisplayEl) {
                    const rect = cubeCountDisplayEl.getBoundingClientRect();
                    const targetScreenX = rect.left + rect.width / 2;
                    const targetScreenY = rect.top + rect.height / 2;
                    const ndcX = (targetScreenX / window.innerWidth) * 2 - 1;
                    const ndcY = -(targetScreenY / window.innerHeight) * 2 + 1;
                    const targetZ = -4.0;
                    const vFov = (camera.fov * Math.PI) / 180;
                    const heightAtZ = 2 * Math.tan(vFov / 2) * Math.abs(targetZ);
                    const widthAtZ = heightAtZ * camera.aspect;
                    targetLocalPos.set(ndcX * (widthAtZ / 2), ndcY * (heightAtZ / 2), targetZ);
                }

                const worldPos = new THREE.Vector3();
                hitObject.getWorldPosition(worldPos);
                hitObject.parent.remove(hitObject);
                camera.add(hitObject);
                camera.worldToLocal(worldPos);
                hitObject.position.copy(worldPos);
                hitObject.userData.targetPos = targetLocalPos;
                harvestingCubes.push(hitObject);
            }
        }
    });

    const inventoryToggle = document.getElementById('inventory-toggle');
    const inventoryBody = document.getElementById('inventory-body');

    if (inventoryToggle && inventoryBody) {
        const inventoryText = inventoryToggle.querySelector('.ascii-plant');
        inventoryToggle.addEventListener('click', (event) => {
            event.stopPropagation();
            inventoryBody.classList.toggle('collapsed');
            inventoryToggle.classList.toggle('collapsed');
            if (inventoryText) inventoryText.textContent = inventoryBody.classList.contains('collapsed') ? 'INVENTORY >' : 'INVENTORY \\/';
        });
    }

    function renderMap() {
        const mapContainer = document.getElementById('ascii-map');
        if (!mapContainer) return;

        const current = currentSector;
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

        const allowed = connections[current] || [];
        const visibleSectors = allSectors.filter(s => s.id === current || allowed.includes(s.id));

        let html = `<span class="ascii-deco">+- SECTOR MAP ---------+</span>\n`;
        visibleSectors.forEach(s => {
            const isCurrent = s.id === current;
            const mark = isCurrent ? '<span class="mention">[*]</span>' : '[ ]';
            html += `<span class="ascii-deco">|</span> ${mark} <span class="map-link map-text" data-target="${s.url}">${s.label.padEnd(12, ' ')}</span> <span class="ascii-deco">|</span>\n`;
        });
        html += `<span class="ascii-deco">+----------------------+</span>`;

        mapContainer.innerHTML = html;

        document.querySelectorAll('.map-link').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetSector = e.target.dataset.target;
                if (targetSector !== currentSector) {
                    triggerPixelDissolve(`index.html?sector=${targetSector}`);
                }
            });
        });
    }

    let transitionOverlay = document.getElementById('transition-overlay');
    if (!transitionOverlay) {
        transitionOverlay = document.createElement('div');
        transitionOverlay.id = 'transition-overlay';
        transitionOverlay.className = 'transition-overlay';
        document.body.appendChild(transitionOverlay);
    }

    const cols = 20; const rows = 15;
    for(let i = 0; i < cols * rows; i++) {
        const block = document.createElement('div');
        block.className = 'pixel-block active';
        transitionOverlay.appendChild(block);
    }

    function triggerPixelDissolve(targetUrl) {
        const blocks = document.querySelectorAll('.pixel-block');
        if (transitionOverlay) transitionOverlay.classList.add('blocking');

        blocks.forEach((block, i) => {
            const x = i % cols;
            const delay = (x * 0.05) + (Math.random() * 0.1);
            block.style.transitionDelay = `${delay}s`;
            block.classList.add('active');
        });

        setTimeout(() => { window.location.href = targetUrl; }, 1500);
    }

    updateMaskScales();
    updateCursorBounds();
    renderMap();

    const blocks = document.querySelectorAll('.pixel-block');
    setTimeout(() => {
        if (transitionOverlay) transitionOverlay.classList.add('blocking');
        blocks.forEach((block, i) => {
            const x = i % cols;
            const delay = ((cols - x) * 0.05) + (Math.random() * 0.1);
            block.style.transitionDelay = `${delay}s`;
            block.classList.remove('active');
        });
        setTimeout(() => { if (transitionOverlay) transitionOverlay.classList.remove('blocking'); }, 1500);
    }, 50);

    let targetVelocity = { x: 0, y: 0 };
    let currentVelocity = { x: 0, y: 0 };
    let lastClientX = null;
    let lastClientY = null;

    document.addEventListener('mousemove', (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        if (lastClientX !== null) { targetVelocity.x = event.clientX - lastClientX; targetVelocity.y = event.clientY - lastClientY; }
        lastClientX = event.clientX; lastClientY = event.clientY;
    });

    function animate() {
        requestAnimationFrame(animate);

        camera.position.z += (targetCameraZ - camera.position.z) * 0.035;

        if (cursorPlaneWidth) {
            const pX = mouse.x * (cursorPlaneWidth / 2);
            const pY = mouse.y * (cursorPlaneHeight / 2);
            mouseLightBg.position.set(pX, pY, cursorZ);
            mouseLightFg.position.set(pX, pY, cursorZ);
        }

        targetVelocity.x *= 0.90; targetVelocity.y *= 0.90;
        currentVelocity.x += (targetVelocity.x - currentVelocity.x) * 0.1; currentVelocity.y += (targetVelocity.y - currentVelocity.y) * 0.1;
        cursorTiltContainer.rotation.x += (targetTiltX - cursorTiltContainer.rotation.x) * 0.3;
        cursorSpinGroup.rotation.y -= 0.02;

        for (let i = harvestingCubes.length - 1; i >= 0; i--) {
            const cube = harvestingCubes[i];
            cube.position.lerp(cube.userData.targetPos, 0.15);
            cube.scale.multiplyScalar(0.85); cube.rotation.x += 0.3; cube.rotation.y += 0.3;
            if (cube.scale.x < 0.02) {
                camera.remove(cube); harvestingCubes.splice(i, 1);
                collectedCubes = harvestedCubeIds.length;
                if (cubeCountDisplayEl) {
                    cubeCountDisplayEl.textContent = `CUBE COUNT: ${collectedCubes}/${globalCubeIdCounter}`;
                    cubeCountDisplayEl.style.transform = 'scale(1.2)'; cubeCountDisplayEl.style.color = 'var(--color-cyan)';
                    setTimeout(() => { if (cubeCountDisplayEl) { cubeCountDisplayEl.style.transform = 'scale(1)'; cubeCountDisplayEl.style.color = 'var(--color-dark-grey)'; } }, 150);
                }
            }
        }

        pillarGroups.forEach(group => {
            const wrapDistance = corridorDepthCount * spacingZ;
            if (group.position.z > camera.position.z + 25) group.position.z -= wrapDistance;
            else if (group.position.z < camera.position.z - wrapDistance + 25) group.position.z += wrapDistance;
        });

            debrisClusters.forEach(group => {
                const wrapDistance = corridorDepthCount * spacingZ;
                if (group.position.z > camera.position.z + 25) group.position.z -= wrapDistance;
                else if (group.position.z < camera.position.z - wrapDistance + 25) group.position.z += wrapDistance;
            });

                panelData.forEach(panel => {
                    if (panel.isBookmarked) return;

                    if (panel.pos.z > camera.position.z + 25) panel.pos.z -= panelWrapDistance;
                    else if (panel.pos.z < camera.position.z - panelWrapDistance + 25) panel.pos.z += panelWrapDistance;

                    if (panel.el.dataset.filtered === 'true') {
                        panel.el.style.opacity = 0; panel.el.style.pointerEvents = 'none'; panel.maskMesh.visible = false;
                        return;
                    }

                    const vec = panel.pos.clone();
                    const dist = camera.position.z - vec.z;

                    if (dist < 2) {
                        panel.el.style.opacity = 0; panel.el.style.pointerEvents = 'none'; panel.maskMesh.visible = false;
                        return;
                    }

                    vec.project(camera);
                    const x = (vec.x * 0.5 + 0.5) * window.innerWidth;
                    const y = -(vec.y * 0.5 - 0.5) * window.innerHeight;
                    const scale = 10 / dist;

                    let opacity = 1;
                    if (dist > 90) opacity = 0;
                    else if (dist > 60) opacity = (90 - dist) / 30;
                    else if (dist < 10) opacity = Math.max(0, (dist - 2) / 8);

                    panel.maskMesh.position.copy(panel.pos);
                    panel.maskMesh.position.z += 0.5;
                    panel.maskMesh.visible = (opacity > 0.01);

                    panel.el.style.zIndex = Math.floor(1000 - dist);
                    panel.el.style.transform = `translate3d(calc(-50% + ${x}px), calc(-50% + ${y}px), 0) scale(${scale})`;
                    panel.el.style.opacity = opacity;
                    panel.el.style.pointerEvents = (opacity > 0.5 && scale < 1.5) ? 'auto' : 'none';
                });

                cubes.forEach((cube) => {
                    if (!cube.userData.isStatic) {
                        cube.rotation.x += cube.userData.rotX + (currentVelocity.y * 0.003);
                        cube.rotation.y += cube.userData.rotY + (currentVelocity.x * 0.003);
                    }
                });

                rendererBg.render(sceneBg, camera);
                rendererFg.render(sceneFg, cameraFg);
    }

    animate();
});
