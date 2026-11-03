// blogs.js — Centralized Blog & Essay Archive Logic
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('blogContainer');
  const searchInput = document.getElementById('archiveSearch');
  const countEl = document.getElementById('archiveCount');
  const dashboardLink = document.getElementById('navDashboardLink');

  // Toggle dashboard nav link based on session
  const token = localStorage.getItem('alfaaz_token');
  if (dashboardLink) {
    dashboardLink.style.display = token ? 'inline-block' : 'none';
  }

  let allBlogs = [];

  function estimateReadTime(text) {
    if (!text) return '3 min read';
    const words = text.trim().split(/\s+/).length;
    // Estimate based on standard 200 WPM, minimum 2 min
    const mins = Math.max(2, Math.ceil(words / 40) + 1);
    return `${mins} min read`;
  }

  function renderBlogs(blogsToRender) {
    if (!container) return;

    if (countEl) {
      countEl.textContent = `${blogsToRender.length} ${blogsToRender.length === 1 ? 'Essay' : 'Essays'} Archived`;
    }

    if (!blogsToRender.length) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No essays match your query in the current archives.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = blogsToRender.map(blog => {
      const dateFormatted = new Date(blog.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const readTime = estimateReadTime(blog.excerpt);

      return `
        <a href="post.html?id=${blog.id}" class="archive-card fade-in">
          <div class="archive-meta">
            <span>${dateFormatted}</span>
            <span>//</span>
            <span>${readTime}</span>
            <span>//</span>
            <span>Curator's Journal</span>
          </div>
          <h2 class="archive-title">${window.escapeHtml(blog.title)}</h2>
          <p class="archive-excerpt">${window.escapeHtml(blog.excerpt || 'Read the complete reflection and curatorial perspective...')}</p>
          <div class="archive-footer-action">
            <span>Read Essay</span>
            <i data-lucide="arrow-right" style="width: 13px; height: 13px;"></i>
          </div>
        </a>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
    if (window.refreshGlobalEffects) window.refreshGlobalEffects();
  }

  async function loadBlogs() {
    if (!container) return;

    try {
      let res = await window.globalApiFetch('/api/blogs');
      if (!res || !res.ok) {
        res = await window.globalApiFetch('/blogs');
      }
      if (!res || !res.ok) throw new Error(`HTTP ${res?.status || 500}`);

      allBlogs = await res.json();
      renderBlogs(allBlogs);

    } catch (error) {
      console.error('[Blog Fetch Error]:', error);
      if (countEl) countEl.textContent = 'Archive Unavailable';
      container.innerHTML = `
        <div class="empty-state" style="color: var(--accent-red-text);">
          <p style="margin-bottom: 1.5rem;">The Curated Archives could not be reached at this time.</p>
          <button id="retryBlogsBtn" class="action-btn" style="display: inline-block;">Retry Access</button>
        </div>
      `;
      document.getElementById('retryBlogsBtn')?.addEventListener('click', () => {
        container.innerHTML = `
          <div class="skeleton-card">
            <div class="skeleton-line skeleton-badge"></div>
            <div class="skeleton-line skeleton-title"></div>
            <div class="skeleton-line skeleton-para-1"></div>
          </div>
        `;
        loadBlogs();
      });
    }
  }

  // Live client-side search filtering
  searchInput?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (!query) {
      renderBlogs(allBlogs);
      return;
    }

    const filtered = allBlogs.filter(blog => {
      const titleMatch = (blog.title || '').toLowerCase().includes(query);
      const excerptMatch = (blog.excerpt || '').toLowerCase().includes(query);
      return titleMatch || excerptMatch;
    });

    renderBlogs(filtered);
  });

  loadBlogs();
});
