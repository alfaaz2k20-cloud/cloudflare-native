// app.js — tchandervar Gallery & Curatorial Interactivity
document.addEventListener('DOMContentLoaded', () => {

  // ===== MOBILE MENU TOGGLE =====
  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');
  const navbar = document.getElementById('navbar');

  function toggleMenu() {
    if (!menuToggle || !navLinks) return;
    menuToggle.classList.toggle('active');
    navLinks.classList.toggle('active');
    const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', !isExpanded);
    document.body.style.overflow = isExpanded ? '' : 'hidden';
  }

  function closeMenu() {
    if (!menuToggle || !navLinks) return;
    menuToggle.classList.remove('active');
    navLinks.classList.remove('active');
    menuToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  if (menuToggle) {
    menuToggle.addEventListener('click', toggleMenu);
  }

  if (navLinks) {
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) {
          e.preventDefault();
          const target = document.querySelector(href);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
          }
        }
        closeMenu();
      });
    });
  }

  const closeMenuBtn = document.querySelector('.close-menu-btn');
  if (closeMenuBtn) {
    closeMenuBtn.addEventListener('click', closeMenu);
  }

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (navLinks && menuToggle && navLinks.classList.contains('active')) {
      if (!navLinks.contains(e.target) && !menuToggle.contains(e.target)) {
        closeMenu();
      }
    }
  });

  // ===== IMAGE SLIDER =====
  let slideIndex = 0;
  const slides = document.querySelector('.slides');
  let totalSlides = 0;

  function updateSlider() {
    if (!slides) return;
    slides.style.transform = `translateX(-${slideIndex * 100}%)`;
  }

  function plusSlides(n) {
    if (!slides || totalSlides === 0) return;
    slideIndex += n;
    if (slideIndex >= totalSlides) slideIndex = 0;
    if (slideIndex < 0) slideIndex = totalSlides - 1;
    updateSlider();
  }

  function initSlider() {
    if (!slides) return;
    totalSlides = document.querySelectorAll('.slides img').length;
    if (totalSlides > 0) updateSlider();

    document.getElementById('sliderPrevBtn')?.addEventListener('click', () => plusSlides(-1));
    document.getElementById('sliderNextBtn')?.addEventListener('click', () => plusSlides(1));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') plusSlides(-1);
      if (e.key === 'ArrowRight') plusSlides(1);
    });
  }

  initSlider();

  // ===== INTERSECTION OBSERVER (GENTLE FADE IN) =====
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.08
  };

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.fade-in-up').forEach(el => {
    observer.observe(el);
  });

  // ===== COLLECTION NAVIGATION =====
  const collectionNavLinks = document.querySelectorAll('.collection-nav a');
  const collectionSections = document.querySelectorAll('.artwork-section section[id]');

  collectionNavLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const groupId = link.getAttribute('href').substring(1);

      collectionNavLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      collectionSections.forEach(section => {
        const isMatch = section.id === groupId;
        section.style.display = isMatch ? 'block' : 'none';

        if (isMatch) {
          const newArtworks = section.querySelectorAll('.artwork');
          newArtworks.forEach(el => {
            el.classList.remove('is-visible');
            setTimeout(() => observer.observe(el), 40);
          });
        }
      });

      const colTarget = document.getElementById('collection');
      if (colTarget) colTarget.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // ===== AUTO-HIDE NAVIGATION =====
  let lastY = window.scrollY;
  let ticking = false;

  window.addEventListener('scroll', () => {
    if (ticking) return;
    window.requestAnimationFrame(() => {
      const currentY = window.scrollY;
      if (navbar) {
        if (currentY > lastY && currentY > 120) {
          navbar.classList.add('hidden');
        } else {
          navbar.classList.remove('hidden');
        }
      }
      lastY = currentY;
      ticking = false;
    });
    ticking = true;
  }, { passive: true });

  // ===== SCROLL TO TOP =====
  const scrollBtn = document.getElementById('scrollToTopBtn');
  if (scrollBtn) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 300) {
        scrollBtn.classList.add('visible');
      } else {
        scrollBtn.classList.remove('visible');
      }
    }, { passive: true });

    scrollBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ===== BATCH GALLERY RENDERING =====
  function renderGallery() {
    if (typeof window.artworkData === 'undefined' || !Array.isArray(window.artworkData)) return;

    function escapeHtml(str) {
      if (str == null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // Group artworks by collection in memory
    const groups = {};
    window.artworkData.forEach(art => {
      if (!groups[art.group]) groups[art.group] = [];
      groups[art.group].push(art);
    });

    // Single DOM update per collection section
    Object.entries(groups).forEach(([groupId, items]) => {
      const container = document.getElementById(`gallery-${groupId}`);
      if (container) {
        const html = items.map(art => {
          const safeTitle = escapeHtml(art.title);
          const safeMedium = escapeHtml(art.medium);
          const safeAvail = escapeHtml(art.availability);
          const safeImg = encodeURI(art.image);
          const waText = encodeURIComponent(art.whatsappText || `I am interested in ${art.title}`);

          return `
            <div class="artwork fade-in-up">
              <div class="artwork-image">
                <img src="${safeImg}" alt="${safeTitle}" loading="lazy" decoding="async">
              </div>
              <div class="artwork-info">
                <h4>${safeTitle}</h4>
                <p>${safeMedium}<br><span class="avail-text">${safeAvail}</span></p>
                <a href="https://wa.me/917006613891?text=${waText}" target="_blank" rel="noopener noreferrer" class="inquire-button">Inquire</a>
              </div>
            </div>
          `;
        }).join('');

        container.innerHTML = html;
      }
    });

    document.querySelectorAll('.artwork').forEach(el => {
      observer.observe(el);
    });
  }

  renderGallery();

  // ===== ASSET PROTECTION =====
  document.addEventListener('contextmenu', (e) => {
    if (e.target && e.target.tagName === 'IMG') {
      e.preventDefault();
    }
  });

  document.addEventListener('dragstart', (e) => {
    if (e.target && e.target.tagName === 'IMG') {
      e.preventDefault();
    }
  });

});
