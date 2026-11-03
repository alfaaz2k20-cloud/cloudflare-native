// app.js — tchandervar Gallery & Curatorial Interactivity
document.addEventListener('DOMContentLoaded', () => {

  // ===== MASTER STATE =====
  let currentGroup = 'groupA';
  let activeFilter = 'all'; // 'all' | 'available' | 'prints'
  let searchQuery = '';
  let activeModalArtworkId = null;

  // ===== DOM REFERENCES =====
  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');
  const closeMenuBtn = document.getElementById('closeMenuBtn');
  const navbar = document.getElementById('navbar');
  const scrollBtn = document.getElementById('scrollToTopBtn');

  // Slider Elements
  const slides = document.getElementById('sliderTrack');
  const sliderDots = document.querySelectorAll('.slider-dot');
  let slideIndex = 0;
  let totalSlides = 0;

  // Collection & Filter Elements
  const collectionNavItems = document.querySelectorAll('.collection-nav-item');
  const collectionSections = document.querySelectorAll('.artwork-section section[id]');
  const searchInput = document.getElementById('artworkSearchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const filterPills = document.querySelectorAll('.filter-pill');
  const noResultsNotice = document.getElementById('noResultsNotice');
  const resetFilterBtn = document.getElementById('resetFilterBtn');

  // Modal Elements
  const modal = document.getElementById('artworkModal');
  const modalBackdrop = document.getElementById('modalBackdrop');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalArtworkImg = document.getElementById('modalArtworkImg');
  const modalArtworkTitle = document.getElementById('modalArtworkTitle');
  const modalArtworkMedium = document.getElementById('modalArtworkMedium');
  const modalAvailabilityBadge = document.getElementById('modalAvailabilityBadge');
  const modalGroupTag = document.getElementById('modalGroupTag');
  const modalIndexCounter = document.getElementById('modalIndexCounter');
  const modalInquireBtn = document.getElementById('modalInquireBtn');
  const modalCopyLinkBtn = document.getElementById('modalCopyLinkBtn');
  const modalPrevBtn = document.getElementById('modalPrevBtn');
  const modalNextBtn = document.getElementById('modalNextBtn');
  const shareToast = document.getElementById('shareToast');

  // ===== HTML ESCAPER =====
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ===== MOBILE MENU DRAWER =====
  function openMenu() {
    if (!menuToggle || !navLinks) return;
    menuToggle.classList.add('active');
    navLinks.classList.add('active');
    menuToggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    if (!menuToggle || !navLinks) return;
    menuToggle.classList.remove('active');
    navLinks.classList.remove('active');
    menuToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
      if (isExpanded) closeMenu();
      else openMenu();
    });
  }

  if (closeMenuBtn) {
    closeMenuBtn.addEventListener('click', closeMenu);
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

  document.addEventListener('click', (e) => {
    if (navLinks && menuToggle && navLinks.classList.contains('active')) {
      if (!navLinks.contains(e.target) && !menuToggle.contains(e.target)) {
        closeMenu();
      }
    }
  });

  // ===== HERO IMAGE SLIDER =====
  function updateSlider() {
    if (!slides) return;
    slides.style.transform = `translateX(-${slideIndex * 100}%)`;
    sliderDots.forEach((dot, idx) => {
      const isActive = idx === slideIndex;
      dot.classList.toggle('active', isActive);
      dot.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
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
    const slideImgs = slides.querySelectorAll('img');
    totalSlides = slideImgs.length;
    if (totalSlides > 0) updateSlider();

    document.getElementById('sliderPrevBtn')?.addEventListener('click', () => plusSlides(-1));
    document.getElementById('sliderNextBtn')?.addEventListener('click', () => plusSlides(1));

    sliderDots.forEach(dot => {
      dot.addEventListener('click', () => {
        const idx = parseInt(dot.getAttribute('data-slide') || '0', 10);
        slideIndex = idx;
        updateSlider();
      });
    });
  }

  initSlider();

  // ===== INTERSECTION OBSERVER (GENTLE FADE IN) =====
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });

  document.querySelectorAll('.fade-in-up').forEach(el => observer.observe(el));

  // ===== AUTO-HIDE NAVBAR ON SCROLL =====
  let lastY = window.scrollY;
  let ticking = false;

  window.addEventListener('scroll', () => {
    if (ticking) return;
    window.requestAnimationFrame(() => {
      const currentY = window.scrollY;
      if (navbar) {
        if (currentY > lastY && currentY > 120 && (!navLinks || !navLinks.classList.contains('active'))) {
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
  if (scrollBtn) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 300) scrollBtn.classList.add('visible');
      else scrollBtn.classList.remove('visible');
    }, { passive: true });

    scrollBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ===== BATCH GALLERY RENDERING & FILTERING =====
  function getAvailabilityBadgeInfo(availability) {
    const avail = availability || '';
    if (avail.startsWith('Available')) {
      if (avail.includes('limited')) {
        return { text: avail, class: 'tag-prints' };
      }
      if (avail.includes('prints too')) {
        return { text: 'Original & Prints Available', class: 'tag-avail' };
      }
      return { text: 'Original Only', class: 'tag-avail' };
    }
    return { text: 'Private Collection', class: 'tag-sold' };
  }

  function getGroupDisplayName(groupKey) {
    switch (groupKey) {
      case 'groupA': return 'Group A — Landscapes & Motifs';
      case 'groupB': return 'Group B — Portraits & Human Form';
      case 'groupC': return 'Group C — Still Life & Interiors';
      case 'groupD': return 'Group D — Expressionist & Abstract';
      case 'groupE': return 'Group E — Architectural Watercolors';
      default: return groupKey;
    }
  }

  function filterArtworkList(items) {
    const q = searchQuery.trim().toLowerCase();

    return items.filter(art => {
      // 1. Text filter
      if (q) {
        const matchTitle = (art.title || '').toLowerCase().includes(q);
        const matchMedium = (art.medium || '').toLowerCase().includes(q);
        const matchId = (art.id || '').toLowerCase().includes(q);
        if (!matchTitle && !matchMedium && !matchId) return false;
      }

      // 2. Availability filter
      const avail = (art.availability || '').toLowerCase();
      if (activeFilter === 'available') {
        return avail.startsWith('available');
      }
      if (activeFilter === 'prints') {
        return avail.includes('print');
      }

      return true;
    });
  }

  function renderGallery() {
    if (typeof window.artworkData === 'undefined' || !Array.isArray(window.artworkData)) return;

    // Group artworks in memory
    const groups = {};
    window.artworkData.forEach(art => {
      if (!groups[art.group]) groups[art.group] = [];
      groups[art.group].push(art);
    });

    let currentGroupVisibleCount = 0;

    Object.entries(groups).forEach(([groupId, items]) => {
      const container = document.getElementById(`gallery-${groupId}`);
      if (!container) return;

      const filteredItems = filterArtworkList(items);

      if (groupId === currentGroup) {
        currentGroupVisibleCount = filteredItems.length;
      }

      const html = filteredItems.map(art => {
        const safeTitle = escapeHtml(art.title);
        const safeMedium = escapeHtml(art.medium);
        const safeImg = encodeURI(art.image);
        const badgeInfo = getAvailabilityBadgeInfo(art.availability);
        const waText = encodeURIComponent(art.whatsappText || `I am interested in acquiring "${art.title}" from tchandervar.`);

        return `
          <div class="artwork fade-in-up" data-id="${escapeHtml(art.id)}" tabindex="0" role="button" aria-label="View details for ${safeTitle}">
            <div class="artwork-image">
              <img src="${safeImg}" alt="${safeTitle}" loading="lazy" decoding="async">
              <div class="artwork-inspect-overlay">
                <span class="artwork-inspect-badge">Inspect Artwork</span>
              </div>
            </div>
            <div class="artwork-info">
              <h4>${safeTitle}</h4>
              <p>${safeMedium}</p>
              <div><span class="avail-badge-tag ${badgeInfo.class}">${escapeHtml(badgeInfo.text)}</span></div>
              <a href="https://wa.me/917006613891?text=${waText}" target="_blank" rel="noopener noreferrer" class="inquire-button" onclick="event.stopPropagation()">Inquire</a>
            </div>
          </div>
        `;
      }).join('');

      container.innerHTML = html;
    });

    // Handle no results notice
    if (noResultsNotice) {
      noResultsNotice.style.display = currentGroupVisibleCount === 0 ? 'block' : 'none';
    }

    // Attach click events on rendered cards for modal lightbox
    document.querySelectorAll('.artwork').forEach(el => {
      observer.observe(el);
      el.addEventListener('click', () => {
        const artId = el.getAttribute('data-id');
        if (artId) openArtworkModal(artId);
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const artId = el.getAttribute('data-id');
          if (artId) openArtworkModal(artId);
        }
      });
    });
  }

  // ===== COLLECTION NAVIGATION TABS =====
  collectionNavItems.forEach(item => {
    item.addEventListener('click', () => {
      const groupId = item.getAttribute('data-group');
      if (!groupId || groupId === currentGroup) return;

      currentGroup = groupId;

      collectionNavItems.forEach(tab => {
        const isActive = tab.getAttribute('data-group') === currentGroup;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      collectionSections.forEach(section => {
        const isMatch = section.id === currentGroup;
        section.style.display = isMatch ? 'block' : 'none';
        if (isMatch) {
          const cards = section.querySelectorAll('.artwork');
          cards.forEach(el => {
            el.classList.remove('is-visible');
            setTimeout(() => observer.observe(el), 40);
          });
        }
      });

      renderGallery();

      const colTarget = document.getElementById('collection');
      if (colTarget) {
        colTarget.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // ===== SEARCH & AVAILABILITY FILTERS =====
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      if (clearSearchBtn) {
        clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
      }
      renderGallery();
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      searchQuery = '';
      if (searchInput) searchInput.value = '';
      clearSearchBtn.style.display = 'none';
      renderGallery();
      searchInput?.focus();
    });
  }

  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const filter = pill.getAttribute('data-filter') || 'all';
      activeFilter = filter;
      filterPills.forEach(p => p.classList.toggle('active', p === pill));
      renderGallery();
    });
  });

  if (resetFilterBtn) {
    resetFilterBtn.addEventListener('click', () => {
      searchQuery = '';
      activeFilter = 'all';
      if (searchInput) searchInput.value = '';
      if (clearSearchBtn) clearSearchBtn.style.display = 'none';
      filterPills.forEach(p => p.classList.toggle('active', p.getAttribute('data-filter') === 'all'));
      renderGallery();
    });
  }

  // ===== CURATORIAL LIGHTBOX MODAL SYSTEM =====
  function getGroupArtworks(groupId) {
    if (typeof window.artworkData === 'undefined' || !Array.isArray(window.artworkData)) return [];
    return window.artworkData.filter(a => a.group === groupId);
  }

  function openArtworkModal(artId) {
    if (!modal || typeof window.artworkData === 'undefined') return;
    const art = window.artworkData.find(a => a.id === artId);
    if (!art) return;

    activeModalArtworkId = artId;
    currentGroup = art.group;

    // Synchronize active collection tab
    collectionNavItems.forEach(tab => {
      const isActive = tab.getAttribute('data-group') === currentGroup;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    collectionSections.forEach(section => {
      section.style.display = section.id === currentGroup ? 'block' : 'none';
    });

    const groupItems = getGroupArtworks(currentGroup);
    const currentIndex = groupItems.findIndex(a => a.id === artId);
    const totalInGroup = groupItems.length;

    // Populate modal content
    if (modalArtworkImg) {
      modalArtworkImg.src = encodeURI(art.image);
      modalArtworkImg.alt = escapeHtml(art.title);
    }
    if (modalArtworkTitle) {
      modalArtworkTitle.textContent = art.title;
    }
    if (modalArtworkMedium) {
      modalArtworkMedium.textContent = art.medium;
    }
    if (modalGroupTag) {
      modalGroupTag.textContent = getGroupDisplayName(art.group);
    }
    if (modalIndexCounter) {
      modalIndexCounter.textContent = `${currentIndex + 1} / ${totalInGroup}`;
    }

    if (modalAvailabilityBadge) {
      const badgeInfo = getAvailabilityBadgeInfo(art.availability);
      modalAvailabilityBadge.textContent = badgeInfo.text;
      modalAvailabilityBadge.className = 'modal-badge ' + (
        badgeInfo.class === 'tag-avail' ? 'badge-avail' :
        badgeInfo.class === 'tag-prints' ? 'badge-prints' : 'badge-sold'
      );
    }

    if (modalInquireBtn) {
      const waText = encodeURIComponent(art.whatsappText || `I am interested in acquiring "${art.title}" (ID: ${art.id}) from tchandervar.`);
      modalInquireBtn.href = `https://wa.me/917006613891?text=${waText}`;
      modalInquireBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M10 10a14.5 14.5 0 0 0 4 4l1.5-1.5a1 1 0 0 1 1.1-.2 8 8 0 0 0 2.2.4 1 1 0 0 1 .9 1v2a1 1 0 0 1-1 1A16 16 0 0 1 3 4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 .9 8 8 0 0 0 .4 2.2 1 1 0 0 1-.2 1.1Z"/></svg>
        ${art.availability === 'Not available' ? 'Inquire for Commission' : 'Inquire via WhatsApp'}
      `;
    }

    // Show modal
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Update URL hash smoothly without jump
    history.replaceState(null, '', `#art-${art.id}`);

    modalCloseBtn?.focus();
  }

  function closeArtworkModal() {
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    activeModalArtworkId = null;

    // Clean hash
    if (window.location.hash.startsWith('#art-')) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  function stepModalArtwork(direction) {
    if (!activeModalArtworkId) return;
    const groupItems = getGroupArtworks(currentGroup);
    if (groupItems.length === 0) return;

    let index = groupItems.findIndex(a => a.id === activeModalArtworkId);
    if (index === -1) return;

    index += direction;
    if (index >= groupItems.length) index = 0;
    if (index < 0) index = groupItems.length - 1;

    openArtworkModal(groupItems[index].id);
  }

  modalCloseBtn?.addEventListener('click', closeArtworkModal);
  modalBackdrop?.addEventListener('click', closeArtworkModal);
  modalPrevBtn?.addEventListener('click', () => stepModalArtwork(-1));
  modalNextBtn?.addEventListener('click', () => stepModalArtwork(1));

  // Copy shareable link
  if (modalCopyLinkBtn) {
    modalCopyLinkBtn.addEventListener('click', async () => {
      if (!activeModalArtworkId) return;
      const shareUrl = `${window.location.origin}${window.location.pathname}#art-${activeModalArtworkId}`;
      try {
        await navigator.clipboard.writeText(shareUrl);
        if (shareToast) {
          shareToast.textContent = 'Artwork link copied to clipboard';
          shareToast.classList.add('show');
          setTimeout(() => shareToast.classList.remove('show'), 2500);
        }
      } catch (err) {
        prompt('Copy artwork link:', shareUrl);
      }
    });
  }

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    const isModalOpen = modal && modal.style.display === 'flex';

    if (e.key === 'Escape') {
      if (isModalOpen) closeArtworkModal();
      else if (navLinks && navLinks.classList.contains('active')) closeMenu();
    } else if (isModalOpen) {
      if (e.key === 'ArrowLeft') stepModalArtwork(-1);
      if (e.key === 'ArrowRight') stepModalArtwork(1);
    } else {
      if (e.key === 'ArrowLeft') plusSlides(-1);
      if (e.key === 'ArrowRight') plusSlides(1);
    }
  });

  // ===== INITIAL RENDERING & DEEP LINK CHECK =====
  renderGallery();

  // Check URL hash for direct artwork link on load
  const hash = window.location.hash;
  if (hash && hash.startsWith('#art-')) {
    const targetArtId = hash.replace('#art-', '');
    setTimeout(() => {
      openArtworkModal(targetArtId);
    }, 150);
  }

  // ===== BILINGUAL CASCADING TRANSLATION CYCLE =====
  function startLanguageCycle() {
    const bilingualElements = document.querySelectorAll('.ur-hover');
    if (bilingualElements.length === 0) return;

    setInterval(() => {
      bilingualElements.forEach((el, index) => {
        setTimeout(() => {
          el.classList.toggle('lang-swapped');
        }, index * 90);
      });
    }, 7500);
  }

  startLanguageCycle();

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
