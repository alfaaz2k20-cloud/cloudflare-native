/* ========================================
   ALFAAZ COLLECTIVE — WEB COMPONENTS
======================================== */

class AlfaazNav extends HTMLElement {
  constructor() {
    super();
    this.isLoggedIn = !!localStorage.getItem('alfaaz_token');
  }

  connectedCallback() {
    this.render();
    this.setupEvents();
    this.updateActiveLinks();
  }

  render() {
    const loginLabel = this.isLoggedIn ? 'Dashboard' : 'Login / Register';
    const loginHref = this.isLoggedIn ? 'dashboard.html' : 'login.html';
    
    // Determine if we are on the index page to use hash links or full URLs
    const isIndex = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';
    const linkPrefix = isIndex ? '' : 'index.html';

    this.innerHTML = `
      <nav id="navbar">
        <a href="index.html" class="logo ur-hover" data-ur="الفاظ">
          <span class="en-text">ALFAAZ</span>
        </a>
        
        <div class="nav-links" id="navLinks">
          <a href="${linkPrefix}#home" class="ur-hover" data-ur="ابتداء"><span class="en-text">Home</span></a>
          <a href="${linkPrefix}#updates" class="ur-hover" data-ur="اطلاع"><span class="en-text">Updates</span></a>
          <a href="${linkPrefix}#about" class="ur-hover" data-ur="تعارف"><span class="en-text">About</span></a>
          <a href="${linkPrefix}#journey" class="ur-hover" data-ur="حاشِیہ"><span class="en-text">Margins</span></a>
          <a href="${linkPrefix}#clubs" class="ur-hover" data-ur="حلقہ"><span class="en-text">Clubs</span></a>
          <a href="blogs.html" class="ur-hover" data-ur="رسالہ"><span class="en-text">Journal</span></a>
          <a href="${loginHref}" class="mobile-only-link ur-hover" data-ur="داخلہ"><span class="en-text">${loginLabel}</span></a>
        </div>

        <div class="nav-actions">
          <a href="${loginHref}" id="navLoginBtn" class="nav-login">${loginLabel}</a>
          <a href="https://tchandervar.neocities.org" target="_blank" class="cta-btn" style="padding: 0.6rem 1.2rem; font-size: 10px;">Tchandervar</a>
          
          <button id="menuToggle" aria-label="Toggle menu" aria-expanded="false">
            <i data-lucide="menu" class="w-6 h-6 hamburger-open"></i>
            <i data-lucide="x" class="w-6 h-6 hamburger-close"></i>
          </button>
        </div>
      </nav>
    `;
  }

  setupEvents() {
    const toggle = this.querySelector('#menuToggle');
    const links = this.querySelector('#navLinks');
    
    toggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', !isExpanded);
      toggle.classList.toggle('active');
      links.classList.toggle('active');
    });

    // Close menu when clicking a link
    links?.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            toggle.setAttribute('aria-expanded', 'false');
            toggle.classList.remove('active');
            links.classList.remove('active');
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!this.contains(e.target) && links.classList.contains('active')) {
            toggle.setAttribute('aria-expanded', 'false');
            toggle.classList.remove('active');
            links.classList.remove('active');
        }
    });

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  updateActiveLinks() {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const links = this.querySelectorAll('.nav-links a');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href === currentPath || (currentPath === 'index.html' && href.startsWith('#'))) {
        link.classList.add('active');
      }
    });
  }
}

customElements.define('alfaaz-nav', AlfaazNav);
