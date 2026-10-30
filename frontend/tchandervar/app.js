/* jshint esversion: 6 */

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
    link.addEventListener('click', closeMenu);
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

function initSlider() {
  if (!slides) return;
  totalSlides = document.querySelectorAll('.slides img').length;
  if (totalSlides > 0) updateSlider();
}

// Make these available globally for your HTML inline onclick attributes
window.plusSlides = function(n) {
  if (!slides || totalSlides === 0) return;
  slideIndex += n;
  if (slideIndex >= totalSlides) slideIndex = 0;
  if (slideIndex < 0) slideIndex = totalSlides - 1;
  updateSlider();
};

function updateSlider() {
  if (!slides) return;
  slides.style.transform = `translateX(-${slideIndex * 100}%)`;
}

initSlider();

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
      section.style.display = section.id === groupId ? 'block' : 'none';
      
      if (section.id === groupId) {
         const newArtworks = section.querySelectorAll('.artwork');
         newArtworks.forEach(el => {
             el.classList.remove('is-visible');
             // Small delay to allow display:block to register before observing
             setTimeout(() => observer.observe(el), 50); 
         });
      }
    });

    document.getElementById('collection').scrollIntoView({ behavior: 'smooth' });
  });
});

// ===== AUTO-HIDE NAVIGATION =====
let lastY = window.scrollY;
let ticking = false;

window.addEventListener('scroll', () => {
  if (ticking) return;
  window.requestAnimationFrame(() => {
    const currentY = window.scrollY;
    if (currentY > lastY && currentY > 120) {
      navbar.classList.add('hidden');
    } else {
      navbar.classList.remove('hidden');
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

// ===== INTERSECTION OBSERVER (GENTLE FADE IN) =====
const observerOptions = {
  root: null,
  rootMargin: '0px',
  threshold: 0.1
};

const observer = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

document.querySelectorAll('.artwork, .fade-in-up').forEach(el => {
  observer.observe(el);
});

// ===== DYNAMIC GALLERY RENDERING =====
function renderGallery() {
  if (typeof artworkData === 'undefined') return;
  
  artworkData.forEach(art => {
    const container = document.getElementById(`gallery-${art.group}`);
    
    if (container) {
      const artHTML = `
        <div class="artwork fade-in-up">
          <div class="artwork-image">
            <img src="${art.image}" alt="${art.title}" loading="lazy">
          </div>
          <div class="artwork-info">
            <h4>${art.title}</h4>
            <p>${art.medium}<br>${art.availability}</p>
            <a href="https://wa.me/917006613891?text=${encodeURIComponent(art.whatsappText)}" class="inquire-button">Inquire</a>
          </div>
        </div>
      `;
      container.innerHTML += artHTML;
    }
  });

  document.querySelectorAll('.artwork').forEach(el => {
    observer.observe(el);
  });
}

renderGallery();

// ===== ASSET PROTECTION =====
document.addEventListener('contextmenu', (e) => {
  if (e.target.tagName === 'IMG') {
    e.preventDefault();
  }
});

document.addEventListener('dragstart', (e) => {
  if (e.target.tagName === 'IMG') {
    e.preventDefault();
  }
});