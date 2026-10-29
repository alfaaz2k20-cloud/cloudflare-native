// post.js — Centralized Article Fetching Logic
document.addEventListener('DOMContentLoaded', () => {
  function sanitizeHTML(html) {
    if (!html) return '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const dangerousTags = ['script', 'iframe', 'object', 'embed', 'form', 'svg', 'math', 'base', 'link', 'meta'];
    doc.querySelectorAll(dangerousTags.join(',')).forEach(el => el.remove());
    doc.querySelectorAll('*').forEach(el => {
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        const value = attr.value.trim().toLowerCase();
        if (name.startsWith('on') || name === 'srcdoc') {
          el.removeAttribute(attr.name);
        } else if ((name === 'href' || name === 'src') && (value.startsWith('javascript:') || value.startsWith('vbscript:') || value.startsWith('data:text/html'))) {
          el.removeAttribute(attr.name);
        }
      }
    });
    return doc.body.innerHTML;
  }

 async function loadArticle() {
 const target = document.getElementById('articleTarget');
 const articleId = new URLSearchParams(window.location.search).get('id');
 
 if (!target) return;

 if (!articleId) { 
 target.innerHTML = '<div class="loading-state" style="color:var(--accent-red);">[Error] Document ID missing.</div>'; 
 return; 
 }
 
 try {
 // Using globalApiFetch for consistency
 let res = await window.globalApiFetch(`/api/blogs/${articleId}`);
  if (!res || !res.ok) {
    res = await window.globalApiFetch(`/api/blog?id=${articleId}`);
  }
  if (!res || !res.ok) {
    res = await window.globalApiFetch(`/blogs/${articleId}`);
  }
 if (!res || !res.ok) throw new Error("Article not found or server error.");
 
 const article = await res.json();
 const dateStr = new Date(article.created_at).toLocaleDateString('en-US', { 
 year: 'numeric', 
 month: 'long', 
 day: 'numeric' 
 });
 
 target.innerHTML = `
 <div class="post-header">
 <span class="post-meta">${dateStr} // Curator's Notes</span>
 <h1 class="post-title">${window.escapeHtml(article.title)}</h1>
 </div>
 <div class="post-content">${sanitizeHTML(article.content)}</div>
 `;
 document.title = `${article.title} | Alfaaz Archives`;
 
 if (window.refreshGlobalEffects) window.refreshGlobalEffects();
 } catch (error) { 
 target.innerHTML = '<div class="loading-state" style="color:var(--accent-red);">[Error] Connection failed or article not found.</div>'; 
 }
 }
 
 loadArticle();
});
