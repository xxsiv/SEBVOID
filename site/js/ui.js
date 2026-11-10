// UI Rendering and Event Listeners
import { escapeHtml } from './utils.js';
import { fetchComments, postComment } from './api.js';
import { panelData, snapToPanel, targetCameraZ, camera } from './scene.js'; // Need to link these

export const postContainer = document.getElementById('post-container');

export async function renderPosts(dataItems, handleBookmarkClick) {
    for (const post of dataItems) {
        const rawTags = post.hashtags ? post.hashtags : '';
        const tagsHtml = rawTags.split(',')
            .map(tag => tag.trim() ? `<span class="hashtag">#${tag.trim()}</span>` : '')
            .join('');

        let commentsHtml = '';
        try {
            const commData = await fetchComments(post.id);
            commentsHtml = commData.items.map(c => `
                <div class="comment-item">
                <strong>${escapeHtml(c.author)}:</strong> ${escapeHtml(c.text)}
                </div>
            `).join('');
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

        // Comment Submission
        const form = div.querySelector('.comment-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const authorInput = form.querySelector('.comment-input');
            const textInput = form.querySelector('.comment-textarea');

            try {
                const newComment = await postComment(post.id, authorInput.value.trim(), textInput.value.trim());
                const listEl = document.getElementById(`comment-list-${post.id}`);
                
                if (listEl.querySelector('div[style]')) listEl.innerHTML = '';
                
                const commentDiv = document.createElement('div');
                commentDiv.className = 'comment-item';
                commentDiv.innerHTML = `<strong>${escapeHtml(newComment.author)}:</strong> ${escapeHtml(newComment.text)}`;
                listEl.appendChild(commentDiv);
                
                authorInput.value = '';
                textInput.value = '';
                listEl.scrollTop = listEl.scrollHeight;
            } catch (err) {
                console.error("Failed to post comment:", err);
                alert(`Transmission failed: ${err.message}`);
            }
        });
        
        // Bookmark Binding
        const btn = div.querySelector('.bookmark-btn');
        if (btn && handleBookmarkClick) {
            btn.addEventListener('click', (e) => handleBookmarkClick(e, div));
        }
    }
}

export function renderFallback() {
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

// Map, Bookmarks, and Search logic can also be encapsulated here
