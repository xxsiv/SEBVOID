// PocketBase API interactions
import { escapeHtml } from './utils.js';

export const pbUrlBase = 'https://api.sebco.win/api/collections';

export async function fetchPosts(sector) {
    const url = `${pbUrlBase}/posts/records?filter=${encodeURIComponent(`sector='${sector}'`)}&sort=-created`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`PocketBase denied access. Status: ${response.status}`);
    return await response.json();
}

export async function fetchComments(postId) {
    const url = `${pbUrlBase}/comments/records?filter=${encodeURIComponent(`post='${postId}'`)}&sort=created`;
    const response = await fetch(url);
    if (!response.ok) return { items: [] };
    return await response.json();
}

export async function postComment(postId, author, text) {
    const response = await fetch(`${pbUrlBase}/comments/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post: postId, author, text })
    });
    
    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to post comment');
    }
    return await response.json();
}
