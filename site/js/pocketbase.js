// js/pocketbase.js
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

export async function fetchPostsAndComments(currentSector) {
    const postContainer = document.getElementById('post-container');

    try {
        const pbUrl = `https://api.sebco.win/api/collections/posts/records?filter=${encodeURIComponent(`sector='${currentSector}'`)}&sort=-created`;
        const response = await fetch(pbUrl);

        if (!response.ok) throw new Error(`PocketBase denied access. Status: ${response.status}`);
        const data = await response.json();

        data.items.sort((a, b) => {
            const aIsEntry = (a.hashtags || '').toLowerCase().includes('entry');
            const bIsEntry = (b.hashtags || '').toLowerCase().includes('entry');
            if (aIsEntry && !bIsEntry) return -1;
            if (!aIsEntry && bIsEntry) return 1;
            return 0;
        });

        for (const post of data.items) {
            const rawTags = post.hashtags ? post.hashtags : '';
            const tagsHtml = rawTags.split(',').map(tag => tag.trim() ? `<span class="hashtag">#${tag.trim()}</span>` : '').join('');

            let commentsHtml = '';
            try {
                const commUrl = `https://api.sebco.win/api/collections/comments/records?filter=${encodeURIComponent(`post='${post.id}'`)}&sort=created`;
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
            div.id = `post-${post.id}`;
            div.innerHTML = `
            <div class="post-header">
            <button class="bookmark-btn" data-id="post-${post.id}">[ BOOKMARK ]</button>
            </div>
            <h2>${escapeHtml(post.title)}</h2>
            <div>${post.content}</div>
            <div class="hashtags">${tagsHtml}</div>

            <div class="comment-section">
            <div class="comment-list" id="comment-list-${post.id}">
            ${commentsHtml || '<div style="font-family:monospace; font-size:0.85rem; color:#666;">No transmissions yet.</div>'}
            </div>
            <form class="comment-form">
            <input type="text" class="comment-input" placeholder="Your Name / Alias" required autocomplete="off">
            <textarea class="comment-textarea" rows="2" placeholder="Leave a transmission..." required></textarea>
            <button type="submit" class="comment-submit">[ TRANSMIT ]</button>
            </form>
            </div>
            `;
            postContainer.appendChild(div);

            const form = div.querySelector('.comment-form');
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const authorInput = form.querySelector('.comment-input');
                const textInput = form.querySelector('.comment-textarea');

                const payload = {
                    post: post.id,
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
                        const listEl = document.getElementById(`comment-list-${post.id}`);

                        if (listEl.querySelector('div[style]')) listEl.innerHTML = '';

                                  const commentDiv = document.createElement('div');
                        commentDiv.className = 'comment-item';
                        commentDiv.innerHTML = `<strong>${escapeHtml(newComment.author)}:</strong> ${escapeHtml(newComment.text)}`;
                        listEl.appendChild(commentDiv);

                        authorInput.value = '';
                        textInput.value = '';
                        listEl.scrollTop = listEl.scrollHeight;
                    } else {
                        const errData = await postRes.json();
                        alert(`Transmission failed: ${errData.message || 'Check console'}`);
                    }
                } catch (err) {
                    alert("Network error: Could not reach API.");
                }
            });
        }
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
}
