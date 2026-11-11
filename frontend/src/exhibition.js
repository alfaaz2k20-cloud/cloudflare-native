// exhibition.js — Centralized Exhibition Portal Logic with Curatorial Protocols & Multi-Cycle Support
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('alfaaz_token');
  if (!token) {
    window.location.href = `login.html?redirect=exhibition.html`;
    return;
  }

  // ── DOM Elements ──────────────────────────────────────────────────
  const headerTitle = document.getElementById('headerTitle');
  const closedMessage = document.getElementById('closedMessage');
  const onboardingView = document.getElementById('onboardingView');
  const protocolAgreeCheck = document.getElementById('protocolAgreeCheck');
  const btnProceedToCycles = document.getElementById('btnProceedToCycles');

  const cycleSelectionView = document.getElementById('cycleSelectionView');
  const cycleCardsContainer = document.getElementById('cycleCardsContainer');
  const btnRevisitProtocol = document.getElementById('btnRevisitProtocol');

  const detailsBox = document.getElementById('detailsBox');
  const btnBackToCycles = document.getElementById('btnBackToCycles');
  const selectedCycleBadge = document.getElementById('selectedCycleBadge');
  const btnViewProtocolFromDetails = document.getElementById('btnViewProtocolFromDetails');
  const exDates = document.getElementById('exDates');
  const exVenue = document.getElementById('exVenue');
  const exDesc = document.getElementById('exDesc');

  const applicationFormContainer = document.getElementById('applicationFormContainer');
  const exhibForm = document.getElementById('exhibForm');

  // ── State ─────────────────────────────────────────────────────────
  let turnstileWidgetId = null;
  let uploadedPdfUrl = null;
  let activeExhibitionConfig = null;
  let activeCycles = [];
  let selectedCycle = null;
  let userStatusData = null;

  // ── Protocol Agreement Helper ─────────────────────────────────────
  const PROTOCOL_STORAGE_KEY = 'alfaaz_exhibition_protocol_agreed';
  const hasAgreedToProtocol = () => Boolean(sessionStorage.getItem(PROTOCOL_STORAGE_KEY));

  function showOnboardingView(returnMode = false) {
    if (cycleSelectionView) cycleSelectionView.style.display = 'none';
    if (detailsBox) detailsBox.style.display = 'none';
    if (applicationFormContainer) applicationFormContainer.style.display = 'none';
    if (closedMessage) closedMessage.style.display = 'none';

    if (onboardingView) {
      onboardingView.style.display = 'block';
      if (returnMode && btnProceedToCycles) {
        btnProceedToCycles.textContent = 'Back to Shows // واپسی';
        btnProceedToCycles.disabled = false;
        btnProceedToCycles.style.opacity = '1';
        btnProceedToCycles.style.cursor = 'pointer';
        if (protocolAgreeCheck) protocolAgreeCheck.checked = true;
      }
    }
  }

  function showCycleSelectionView() {
    if (onboardingView) onboardingView.style.display = 'none';
    if (detailsBox) detailsBox.style.display = 'none';
    if (applicationFormContainer) applicationFormContainer.style.display = 'none';
    if (closedMessage) closedMessage.style.display = 'none';

    if (cycleSelectionView) {
      cycleSelectionView.style.display = 'block';
      renderCycleCards();
    }
  }

  // ── Turnstile Widget State ────────────────────────────────────────
  function initTurnstileWidget() {
    const container = document.getElementById('exhibitionTurnstile');
    if (!container || turnstileWidgetId !== null) return;

    if (window.turnstile && typeof window.turnstile.render === 'function') {
      try {
        const isLocal = window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1' ||
          window.location.hostname === '[::1]';
        const defaultSitekey = isLocal ? '1x00000000000000000000AA' : '0x4AAAAAAFsRHzhKR6YGsXSy';

        turnstileWidgetId = window.turnstile.render('#exhibitionTurnstile', {
          sitekey: window.ALFAAZ_TURNSTILE_SITEKEY || defaultSitekey,
          theme: 'light'
        });
      } catch (err) {
        console.warn('[Exhibition Turnstile warning]:', err);
      }
    }
  }

  function resetTurnstileWidget() {
    if (window.turnstile && turnstileWidgetId !== null) {
      try {
        window.turnstile.reset(turnstileWidgetId);
      } catch (err) {
        console.warn('[Exhibition Turnstile reset warning]:', err);
      }
    }
  }

  // Poll briefly in case turnstile script finishes after DOMContentLoaded
  if (!window.turnstile) {
    let attempts = 0;
    const turnstileCheckInterval = setInterval(() => {
      attempts++;
      if (window.turnstile) {
        clearInterval(turnstileCheckInterval);
        initTurnstileWidget();
      } else if (attempts > 20) {
        clearInterval(turnstileCheckInterval);
      }
    }, 250);
  }

  // ── Protocol Agreement Event Listeners ────────────────────────────
  protocolAgreeCheck?.addEventListener('change', () => {
    if (btnProceedToCycles) {
      const isChecked = Boolean(protocolAgreeCheck.checked);
      btnProceedToCycles.disabled = !isChecked;
      btnProceedToCycles.style.opacity = isChecked ? '1' : '0.5';
      btnProceedToCycles.style.cursor = isChecked ? 'pointer' : 'not-allowed';
    }
  });

  btnProceedToCycles?.addEventListener('click', () => {
    sessionStorage.setItem(PROTOCOL_STORAGE_KEY, 'true');
    if (activeCycles.length > 1) {
      showCycleSelectionView();
    } else if (activeCycles.length === 1) {
      selectCycle(activeCycles[0]);
    } else {
      if (closedMessage) closedMessage.style.display = 'block';
    }
  });

  btnRevisitProtocol?.addEventListener('click', () => showOnboardingView(true));
  btnViewProtocolFromDetails?.addEventListener('click', () => showOnboardingView(true));
  btnBackToCycles?.addEventListener('click', () => showCycleSelectionView());

  // ── Portfolio PDF Upload (Cloudinary with Edge R2 Fallback) ───────
  const getCloudinaryConfig = () => ({
    cloudName: (window.ALFAAZ_CLOUDINARY && window.ALFAAZ_CLOUDINARY.cloudName) || 'dmqwjpmjk',
    uploadPreset: (window.ALFAAZ_CLOUDINARY && window.ALFAAZ_CLOUDINARY.uploadPreset) || 'alfaaz_vault'
  });

  document.getElementById('portfolioFile')?.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    const status = document.getElementById('uploadStatus');
    const submitBtn = document.getElementById('submitBtn');
    if (!status) return;

    if (!file) {
      uploadedPdfUrl = null;
      status.textContent = '';
      return;
    }

    const fileNameLower = file.name ? file.name.toLowerCase() : '';
    const isPdf = file.type === 'application/pdf' || fileNameLower.endsWith('.pdf');
    if (!isPdf) {
      status.style.color = 'var(--accent-red-text)';
      status.textContent = '✗ Only PDF documents (.pdf) are accepted.';
      e.target.value = '';
      uploadedPdfUrl = null;
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      status.style.color = 'var(--accent-red-text)';
      status.textContent = '✗ File exceeds the 15MB limit.';
      e.target.value = '';
      uploadedPdfUrl = null;
      return;
    }

    const sizeFormatted = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${(file.size / 1024).toFixed(0)} KB`;

    status.style.color = 'var(--accent-gold-text)';
    status.textContent = `Uploading "${file.name}" (${sizeFormatted}) to Storage...`;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Uploading Portfolio PDF...';
    }

    const { cloudName, uploadPreset } = getCloudinaryConfig();
    let finalUrl = null;

    try {
      // 1. Primary: Cloudinary raw upload (stores PDF document without GhostScript rasterization)
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', uploadPreset);

        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json().catch(() => ({}));
        if (data && data.secure_url) {
          finalUrl = data.secure_url;
        }
      } catch (rawErr) {
        console.warn('[Exhibition Cloudinary raw upload warning]:', rawErr);
      }

      // 2. Secondary fallback: Cloudinary auto upload
      if (!finalUrl) {
        try {
          const autoFormData = new FormData();
          autoFormData.append('file', file);
          autoFormData.append('upload_preset', uploadPreset);

          const autoRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
            method: 'POST',
            body: autoFormData
          });
          const autoData = await autoRes.json().catch(() => ({}));
          if (autoData && autoData.secure_url) {
            finalUrl = autoData.secure_url;
          }
        } catch (autoErr) {
          console.warn('[Exhibition Cloudinary auto upload warning]:', autoErr);
        }
      }

      // 3. Sovereign Edge Fallback: Cloudflare Edge R2 (/exhibitions/upload-portfolio)
      if (!finalUrl) {
        try {
          const edgeFormData = new FormData();
          edgeFormData.append('file', file);
          const edgeRes = await window.globalApiFetch('/exhibitions/upload-portfolio', {
            method: 'POST',
            body: edgeFormData
          });
          if (edgeRes && edgeRes.ok) {
            const edgeData = await edgeRes.json().catch(() => ({}));
            if (edgeData && (edgeData.secure_url || edgeData.url)) {
              finalUrl = edgeData.secure_url || edgeData.url;
            }
          }
        } catch (edgeErr) {
          console.warn('[Exhibition Edge R2 upload warning]:', edgeErr);
        }
      }

      if (finalUrl) {
        uploadedPdfUrl = finalUrl;
        status.style.color = 'var(--accent-green-text)';
        status.innerHTML = `✓ Upload complete: <strong>${window.escapeHtml(file.name)}</strong> (${sizeFormatted})`;
      } else {
        throw new Error('Upload could not be completed. Please check your connection and retry.');
      }
    } catch (uploadErr) {
      status.style.color = 'var(--accent-red-text)';
      status.textContent = `✗ ${uploadErr.message || 'Upload failed — please check your connection and retry.'}`;
      uploadedPdfUrl = null;
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send My Application // بھیجیں';
      }
    }
  });

  // ── Cycle Cards Rendering ─────────────────────────────────────────
  function renderCycleCards() {
    if (!cycleCardsContainer) return;
    cycleCardsContainer.innerHTML = '';

    if (!activeCycles.length) {
      cycleCardsContainer.innerHTML = '<div style="font-size: 13px; color: var(--text-secondary);">No active exhibition cycles currently open.</div>';
      return;
    }

    activeCycles.forEach(cycle => {
      const card = document.createElement('div');
      card.style.cssText = 'border: 1px solid var(--grid-border); padding: 1.75rem; background: #ffffff; display: flex; flex-direction: column; justify-content: space-between; gap: 1.25rem; transition: border-color 0.2s ease;';

      const cycleStatusInfo = (userStatusData?.statuses_by_cycle && userStatusData.statuses_by_cycle[cycle.title])
        ? userStatusData.statuses_by_cycle[cycle.title]
        : (userStatusData?.exhibition_cycle === cycle.title ? userStatusData : null);

      const cycleStatus = cycleStatusInfo?.status || 'NONE';

      let statusBadgeHtml = '';
      let btnHtml = '';

      if (cycleStatus === 'APPROVED') {
        statusBadgeHtml = '<span class="badge badge-approved" style="font-size: 9px;">✓ Selected for Show</span>';
        btnHtml = `<button class="action-btn select-cycle-btn" data-cycle-id="${cycle.id}" style="width: 100%; font-size: 11px; padding: 0.6rem 1rem; border: 1px solid var(--accent-green); color: var(--accent-green-text);">View Details &rarr;</button>`;
      } else if (cycleStatus === 'PENDING') {
        statusBadgeHtml = '<span class="badge badge-pending" style="font-size: 9px;">⏳ Being Reviewed</span>';
        btnHtml = `<button class="action-btn select-cycle-btn" data-cycle-id="${cycle.id}" style="width: 100%; font-size: 11px; padding: 0.6rem 1rem; border: 1px solid var(--grid-border);">Check Status &rarr;</button>`;
      } else if (cycleStatus === 'REJECTED') {
        statusBadgeHtml = '<span class="badge badge-gold" style="font-size: 9px; border: 1px solid var(--accent-gold);">Not Selected for this Show</span>';
        btnHtml = `<button class="action-btn select-cycle-btn" data-cycle-id="${cycle.id}" style="width: 100%; font-size: 11px; padding: 0.6rem 1rem; border: 1px solid var(--grid-border);">See Status &rarr;</button>`;
      } else {
        statusBadgeHtml = '<span class="badge" style="font-size: 9px; border: 1px solid var(--grid-border); color: var(--text-secondary);">Open for Entries</span>';
        btnHtml = `<button class="action-btn gold select-cycle-btn" data-cycle-id="${cycle.id}" style="width: 100%; font-size: 11px; padding: 0.6rem 1rem;">Apply for this Show &rarr;</button>`;
      }

      const streamBadge = cycle.require_over_18 === false
        ? '<span class="badge badge-pending" style="font-size: 9px;">Below 18 (Children & Youth) // 18 سال سے کم</span>'
        : '<span class="badge badge-approved" style="font-size: 9px;">18 and Above (Adults) // 18 سال اور زائد</span>';

      const safeTitle = window.escapeHtml(cycle.title);
      const safeDates = window.escapeHtml(cycle.date_text || 'Dates TBA');
      const safeVenue = window.escapeHtml(cycle.venue || 'Alfaaz Gallery & Cultural Centre');
      const safeAbout = window.escapeHtml(cycle.about_text || 'Open call for artistic portfolios.');

      card.innerHTML = `
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.75rem; flex-wrap: wrap;">
            ${streamBadge}
            ${statusBadgeHtml}
          </div>
          <h3 style="font-family: var(--font-heading); font-size: 1.45rem; color: var(--text-primary); margin: 0 0 0.4rem; font-weight: 400;">${safeTitle}</h3>
          <div style="font-size: 11px; color: var(--accent-gold-text); margin-bottom: 0.75rem;">${safeDates} · ${safeVenue}</div>
          <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.6; margin: 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${safeAbout}</p>
        </div>
        <div style="border-top: 1px dashed var(--grid-border); padding-top: 0.8rem;">
          ${btnHtml}
        </div>
      `;

      card.querySelector('.select-cycle-btn')?.addEventListener('click', () => {
        selectCycle(cycle);
      });

      cycleCardsContainer.appendChild(card);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // ── Select and Display Specific Cycle ─────────────────────────────
  function selectCycle(cycle) {
    selectedCycle = cycle;

    if (cycleSelectionView) cycleSelectionView.style.display = 'none';
    if (onboardingView) onboardingView.style.display = 'none';
    if (closedMessage) closedMessage.style.display = 'none';

    if (headerTitle) headerTitle.textContent = cycle.title;
    if (exDates) exDates.textContent = cycle.date_text || 'Dates TBA';
    if (exVenue) exVenue.textContent = cycle.venue || 'Alfaaz Gallery & Cultural Centre';
    if (exDesc) exDesc.textContent = cycle.about_text || 'Applications are currently open for curatorial screening.';

    if (selectedCycleBadge) {
      selectedCycleBadge.textContent = cycle.title;
    }

    if (btnBackToCycles) {
      btnBackToCycles.style.display = activeCycles.length > 1 ? 'inline-block' : 'none';
      btnBackToCycles.textContent = '← See Other Shows';
    }

    if (detailsBox) detailsBox.style.display = 'block';

    // Check user's status for this specific cycle
    const cycleStatusInfo = (userStatusData?.statuses_by_cycle && userStatusData.statuses_by_cycle[cycle.title])
      ? userStatusData.statuses_by_cycle[cycle.title]
      : (userStatusData?.exhibition_cycle === cycle.title ? userStatusData : null);

    const hasOtherCycles = activeCycles.length > 1;

    if (cycleStatusInfo && cycleStatusInfo.status && cycleStatusInfo.status !== 'NONE') {
      renderExistingApplicationView(cycleStatusInfo, cycle, hasOtherCycles);
      return;
    }

    // Otherwise show the submission form
    const existingStatusPanel = document.getElementById('exhibitionExistingStatusPanel');
    if (existingStatusPanel) existingStatusPanel.remove();

    if (applicationFormContainer) {
      applicationFormContainer.style.display = 'block';
      const form = document.getElementById('exhibForm');
      if (form) form.style.display = 'block';
      const submitSectionTitle = applicationFormContainer.querySelector('.section-title');
      if (submitSectionTitle) {
        submitSectionTitle.textContent = `Submit Your Art — ${cycle.title}`;
      }
    }

    // Configure age requirements based on cycle policy
    const checkAgeContainer = document.getElementById('checkAgeContainer');
    const checkAge = document.getElementById('checkAge');
    const checkAgeLabel = document.getElementById('checkAgeLabel');
    const ageHint = document.getElementById('ageFieldHint');
    const portfolioLabel = document.getElementById('portfolioLabel');
    const portfolioHint = document.getElementById('portfolioHint');

    if (cycle.require_over_18 === false) {
      if (portfolioLabel) portfolioLabel.textContent = 'Your Artwork (PDF) *';
      if (portfolioHint) portfolioHint.textContent = 'Upload a PDF with pictures of your drawings, paintings, or crafts (max 15MB, PDF only)';
      if (ageHint) ageHint.textContent = 'Must be under 18 years old (ages 1 to 17)';
      if (checkAgeContainer) {
        checkAgeContainer.style.background = 'rgba(184, 134, 11, 0.05)';
        checkAgeContainer.style.padding = '0.75rem 1rem';
        checkAgeContainer.style.border = '1px dashed var(--grid-border)';
      }
      if (checkAgeLabel) {
        checkAgeLabel.innerHTML = '<strong style="color:var(--accent-gold-text);">Below 18 Exhibition:</strong> For children and youth under 18 years old.';
      }
      if (checkAge) {
        checkAge.checked = true;
        checkAge.required = false;
        checkAge.style.display = 'none';
      }
    } else {
      if (portfolioLabel) portfolioLabel.textContent = 'Recent Works Portfolio (PDF) *';
      if (portfolioHint) portfolioHint.textContent = 'Mandatory: Upload a PDF of your recent works / portfolio (max 15MB, PDF only)';
      if (ageHint) ageHint.textContent = 'Must be 18 or older to apply';
      if (checkAgeContainer) {
        checkAgeContainer.style.background = '';
        checkAgeContainer.style.padding = '';
        checkAgeContainer.style.border = '';
      }
      if (checkAgeLabel) {
        checkAgeLabel.textContent = 'I confirm that I am 18 years of age or older.';
      }
      if (checkAge) {
        checkAge.required = true;
        checkAge.style.display = 'block';
      }
    }

    initTurnstileWidget();
  }

  // ── Warm, Encouraging Application Status View ──────────────────────
  function renderExistingApplicationView(statusData, cycle, hasOtherCycles) {
    if (!applicationFormContainer) return;

    let iconName = 'clock';
    let iconColor = 'var(--accent-gold)';
    let statusHeading = 'We are Reviewing Your Art // زیرِ جائزہ';
    let statusBadge = '<span class="badge badge-pending" style="font-size:11px;">Being Reviewed // زیرِ جائزہ</span>';
    let statusDesc = `Thank you for sending your artwork for <strong>${window.escapeHtml(cycle?.title || 'the exhibition')}</strong>! Our team is looking at every entry with care and love.`;
    let actionBtnHtml = '<a href="dashboard.html" class="action-btn gold" style="display: inline-block;">Check Status in Dashboard</a>';

    if (statusData.status === 'APPROVED') {
      iconName = 'check-circle';
      iconColor = 'var(--accent-green)';
      statusBadge = '<span class="badge badge-approved" style="font-size:11px;">Selected for Show! // منتخب شدہ</span>';
      statusHeading = 'Great News! Your Art is Selected!';
      statusDesc = `Congratulations! Your artwork has been chosen for <strong>${window.escapeHtml(cycle?.title || 'the exhibition')}</strong>. Please open your dashboard to view the details.`;
      actionBtnHtml = '<a href="dashboard.html" class="action-btn gold" style="display: inline-block;">Go to My Dashboard &rarr;</a>';
    } else if (statusData.status === 'REJECTED') {
      iconName = 'info';
      iconColor = 'var(--accent-gold)';
      statusBadge = '<span class="badge" style="border: 1px solid var(--accent-gold); color: var(--accent-gold-text); font-size:11px;">Not Selected for this Show // اس نمائش کے لیے انتخاب نہیں ہوا</span>';
      statusHeading = 'Not Selected for this Show';
      statusDesc = `Thank you so much for sharing your art with us for <strong>${window.escapeHtml(cycle?.title || 'this show')}</strong>! Your artwork was not selected for this show, but we have kept your work safely in our collection. You are always welcome to apply for another show anytime — keep creating!`;

      const otherCyclesBtn = hasOtherCycles
        ? `<button id="btnOtherCyclesFromStatus" class="action-btn gold" style="display: inline-block; font-size:11px; padding:0.6rem 1.25rem; margin-right: 0.5rem; cursor: pointer;">See Other Shows &rarr;</button>`
        : '';
      const safePortfolio = statusData.portfolio_url ? (window.safeHttpUrl ? window.safeHttpUrl(statusData.portfolio_url) : statusData.portfolio_url) : null;
      const portfolioBtn = safePortfolio
        ? `<a href="${window.escapeHtml(safePortfolio)}" target="_blank" rel="noopener noreferrer" class="action-btn" style="display: inline-block; font-size:11px; padding:0.6rem 1rem; border: 1px solid var(--grid-border); margin-right: 0.5rem;">View Uploaded File ↗</a>`
        : '';

      actionBtnHtml = `
        <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; align-items: center;">
          ${otherCyclesBtn}
          ${portfolioBtn}
          <a href="dashboard.html" class="action-btn" style="display: inline-block; font-size:11px; padding:0.6rem 1rem; border: 1px solid var(--grid-border);">My Dashboard</a>
        </div>
      `;
    }

    applicationFormContainer.style.display = 'block';
    const form = document.getElementById('exhibForm');
    if (form) form.style.display = 'none';

    let existingStatusPanel = document.getElementById('exhibitionExistingStatusPanel');
    if (!existingStatusPanel) {
      existingStatusPanel = document.createElement('div');
      existingStatusPanel.id = 'exhibitionExistingStatusPanel';
      applicationFormContainer.appendChild(existingStatusPanel);
    }

    existingStatusPanel.innerHTML = `
      <div class="panel fade-in text-center" style="padding: 3.5rem 2rem; margin-top: 1rem; background: #ffffff; border: 1px solid var(--grid-border);">
        <div style="display: flex; justify-content: center; margin-bottom: 1rem;">
          ${statusBadge}
        </div>
        <i data-lucide="${iconName}" class="portal-icon" style="color: ${iconColor};"></i>
        <h3 style="font-family: var(--font-heading); font-size: 1.8rem; margin-bottom: 1rem; color: var(--text-primary); font-weight: 400;">${statusHeading}</h3>
        <p style="font-size: 13px; color: var(--text-secondary); max-width: 620px; margin: 0 auto 2.5rem; line-height: 1.7;">${statusDesc}</p>
        ${actionBtnHtml}
      </div>
    `;

    document.getElementById('btnOtherCyclesFromStatus')?.addEventListener('click', () => {
      showCycleSelectionView();
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // ── Page Initialization ───────────────────────────────────────────
  async function initExhibition() {
    try {
      const [cfgRes, statusRes] = await Promise.all([
        window.globalApiFetch('/exhibitions/config'),
        window.globalApiFetch('/exhibitions/my-status')
      ]);

      if (!cfgRes || !cfgRes.ok) throw new Error('Failed to load exhibition configuration.');
      const config = await cfgRes.json();
      activeExhibitionConfig = config;

      if (statusRes && statusRes.ok) {
        userStatusData = await statusRes.json().catch(() => null);
      }

      activeCycles = (config.active_cycles && Array.isArray(config.active_cycles) && config.active_cycles.length > 0)
        ? config.active_cycles
        : (config.is_open ? [config] : []);

      if (headerTitle) {
        headerTitle.textContent = config.title || 'Exhibition Portal';
      }

      if (!config.is_open || activeCycles.length === 0) {
        if (closedMessage) closedMessage.style.display = 'block';
        if (detailsBox) detailsBox.style.display = 'none';
        if (applicationFormContainer) applicationFormContainer.style.display = 'none';
        if (onboardingView) onboardingView.style.display = 'none';
        if (cycleSelectionView) cycleSelectionView.style.display = 'none';
        return;
      }

      // Check curatorial screening protocol agreement gate
      if (!hasAgreedToProtocol()) {
        showOnboardingView(false);
      } else {
        if (activeCycles.length > 1) {
          showCycleSelectionView();
        } else {
          selectCycle(activeCycles[0]);
        }
      }
    } catch (err) {
      console.error('[Exhibition Init Error]:', err);
      if (headerTitle) headerTitle.textContent = 'Exhibition Unavailable';
      if (closedMessage) {
        closedMessage.style.display = 'block';
        const p = closedMessage.querySelector('p');
        if (p) p.textContent = 'The exhibition portal is temporarily unavailable. Please try again later.';
      }
    } finally {
      const fadeElements = document.querySelectorAll('.fade-in');
      setTimeout(() => { fadeElements.forEach(el => el.classList.add('visible')); }, 50);
      if (window.lucide) window.lucide.createIcons();
    }
  }

  // ── Form Submission ───────────────────────────────────────────────
  exhibForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    const msg = document.getElementById('formMsg');

    const currentCycle = selectedCycle || activeExhibitionConfig;
    const ageVal = parseInt(document.getElementById('age').value, 10);
    const isAdultCycle = !currentCycle || currentCycle.require_over_18 !== false;

    if (isAdultCycle) {
      if (isNaN(ageVal) || ageVal < 18) {
        if (msg) {
          msg.style.color = 'var(--accent-red-text)';
          msg.textContent = 'This exhibition is for participants 18 years of age or older.';
        }
        return;
      }
      if (!uploadedPdfUrl) {
        if (msg) {
          msg.style.color = 'var(--accent-red-text)';
          msg.textContent = 'Please upload your recent works PDF before submitting.';
        }
        return;
      }
    } else {
      if (isNaN(ageVal) || ageVal >= 18) {
        if (msg) {
          msg.style.color = 'var(--accent-red-text)';
          msg.textContent = 'This exhibition is specifically for children and youth under 18 years of age.';
        }
        return;
      }
      if (!uploadedPdfUrl) {
        if (msg) {
          msg.style.color = 'var(--accent-red-text)';
          msg.textContent = 'Please upload your artwork PDF before submitting.';
        }
        return;
      }
    }

    const isOver18Checked = isAdultCycle ? Boolean(document.getElementById('checkAge')?.checked) : true;
    const turnstileToken = window.turnstile && turnstileWidgetId !== null
      ? (window.turnstile.getResponse(turnstileWidgetId) || '')
      : (document.querySelector('[name="cf-turnstile-response"]')?.value || '');

    const payload = {
      exhibition_cycle: currentCycle?.title || 'HARUD 2026',
      exhibition_id: currentCycle?.id || null,
      full_name: document.getElementById('fname').value.trim(),
      age: ageVal,
      address: document.getElementById('address').value.trim(),
      whatsapp: document.getElementById('whatsapp').value.trim(),
      genre: document.getElementById('genre').value.trim(),
      medium: document.getElementById('medium').value.trim(),
      portfolio_url: uploadedPdfUrl,
      over_18: isOver18Checked,
      over_19: isOver18Checked,
      agreed_to_screening: document.getElementById('checkScreen').checked,
      applicant_note: document.getElementById('note').value.trim() || null,
      turnstile_token: turnstileToken
    };

    if (btn) {
      btn.textContent = 'Sending Your Art...';
      btn.disabled = true;
    }
    if (msg) {
      msg.textContent = '';
      msg.style.color = '';
    }

    const restoreBtn = () => {
      if (btn) {
        btn.textContent = 'Send My Application // بھیجیں';
        btn.disabled = false;
      }
    };

    try {
      const res = await window.globalApiFetch('/exhibitions/apply', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res && res.ok) {
        if (msg) {
          msg.style.color = 'var(--accent-green-text)';
          msg.textContent = '✓ Your artwork has been received! Opening your dashboard...';
        }
        if (btn) {
          btn.textContent = 'Sent Successfully! // مبارک ہو';
          btn.style.background = 'var(--accent-gold)';
          btn.style.borderColor = 'var(--accent-gold)';
        }
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 2000);
        return;
      }

      const errorData = await res?.json().catch(() => ({}));
      const errorMessage = errorData.detail || errorData.error || 'Submission could not be completed. Please try again.';

      if (msg) {
        msg.style.color = 'var(--accent-red-text)';
        msg.textContent = errorMessage;
      }

      resetTurnstileWidget();
      restoreBtn();
    } catch (err) {
      console.error('[Exhibition Submit Error]:', err);
      if (msg) {
        msg.style.color = 'var(--accent-red-text)';
        msg.textContent = 'Network or server connection failed. Please check your connection and retry.';
      }
      resetTurnstileWidget();
      restoreBtn();
    }
  });

  initExhibition();
});
