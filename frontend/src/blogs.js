// blogs.js — Centralized Blog Listing Logic
document.addEventListener('DOMContentLoaded', () => {
 async function loadBlogs() {
 const container = document.getElementById('blogContainer');
 if (!container) return;
 
 try {
 // Using the globalApiFetch consolidated in global.js
 let res = await window.globalApiFetch('/api/blogs');
  if (!res || !res.ok) {
    res = await window.globalApiFetch('/blogs');
  }
 if (!res || !res.ok) throw new Error(`Failed to fetch: ${res?.status}`);
 
 const blogs = await res.json();
 
 if (!blogs.length) { 
 container.innerHTML = '<div class="loading-state">The archives are currently empty.</div>'; 
 return; 
 }
 
 container.innerHTML = blogs.map(blog => `
 <a href="post.html?id=${blog.id}" class="archive-card">
 <span class="archive-meta">${new Date(blog.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} // Curator's Notes</span>
 <h2 class="archive-title">${window.escapeHtml(blog.title)}</h2>
 <p class="archive-excerpt">${window.escapeHtml(blog.excerpt || '')}</p>
 </a>`).join('');
 
 if (window.refreshGlobalEffects) window.refreshGlobalEffects();
 } catch (error) { 
 container.innerHTML = '<div class="loading-state" style="color: var(--accent-red);">[Error] Archives unavailable.</div>'; 
 console.error("Blog Fetch Error:", error);
 }
 }
 
 loadBlogs();
});
