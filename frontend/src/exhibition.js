// exhibition.js — Editorial Multi-Cycle Exhibition Open Call Portal with Sovereign R2 & Youth Safeguarding
import { initLanguageSelector, t, getLanguage, applyTranslations } from './i18n.js';

document.addEventListener('DOMContentLoaded', () => {
  // ── Initialize Localization ──────────────────────────────────────────
  initLanguageSelector('langSelectorContainer');

  const token = localStorage.getItem('alfaaz_token');

  // ── DOM Elements ────────────────────────────────────────────────────
  const headerTitle = document.getElementById('headerTitle');
  const closedMessage = document.getElementById('closedMessage');
  const notFoundMessage = document.getElementById('notFoundMessage');
  const resetCycleBtn = document.getElementById('resetCycleBtn');
  const activePortalContainer = document.getElementById('activePortalContainer');
  const showcaseGrid = document.getElementById('showcaseGrid');
  const totalCyclesCount = document.getElementById('totalCyclesCount');

  const applicationSection = document.getElementById('applicationSection');
  const selectedCycleBar = document.getElementById('selectedCycleBar');
  const currentShowTitle = document.getElementById('currentShowTitle');
  const currentShowMeta = document.getElementById('currentShowMeta');
  const currentShowBadge = document.getElementById('currentShowBadge');

  const statusNoticeBanner = document.getElementById('statusNoticeBanner');
  const statusNoticeBadge = document.getElementById('statusNoticeBadge');
  const statusNoticeHeading = document.getElementById('statusNoticeHeading');
  const statusNoticeText = document.getElementById('statusNoticeText');

  const exhibForm = document.getElementById('exhibForm');
  const pillStep1 = document.getElementById('pillStep1');
  const pillStep2 = document.getElementById('pillStep2');
  const pillStep3 = document.getElementById('pillStep3');
  const step1Section = document.getElementById('step1Section');
  const step2Section = document.getElementById('step2Section');
  const step3Section = document.getElementById('step3Section');

  const btnToStep2 = document.getElementById('btnToStep2');
  const btnBackToStep1 = document.getElementById('btnBackToStep1');
  const btnToStep3 = document.getElementById('btnToStep3');
  const btnBackToStep2 = document.getElementById('btnBackToStep2');
  const submitBtn = document.getElementById('submitBtn');
  const formMsg = document.getElementById('formMsg');
  const submissionSuccessScreen = document.getElementById('submissionSuccessScreen');

  // Step 1 Fields
  const fnameInput = document.getElementById('fname');
  const ageInput = document.getElementById('age');
  const ageFieldHint = document.getElementById('ageFieldHint');
  const addressInput = document.getElementById('address');
  const whatsappInput = document.getElementById('whatsapp');

  // Guardian Section Fields
  const guardianSection = document.getElementById('guardianSection');
  const guardianName = document.getElementById('guardianName');
  const guardianRelationship = document.getElementById('guardianRelationship');
  const guardianContact = document.getElementById('guardianContact');
  const guardianConsent = document.getElementById('guardianConsent');
  const participantAssent = document.getElementById('participantAssent');

  // Step 2 Fields
  const genreInput = document.getElementById('genre');
  const mediumInput = document.getElementById('medium');
  const portfolioFile = document.getElementById('portfolioFile');
  const portfolioProgressWrap = document.getElementById('portfolioProgressWrap');
  const portfolioProgressFill = document.getElementById('portfolioProgressFill');
  const uploadStatus = document.getElementById('uploadStatus');

  const recentWorksGroup = document.getElementById('recentWorksGroup');
  const recentWorksFile = document.getElementById('recentWorksFile');
  const recentWorksStatus = document.getElementById('recentWorksStatus');
  const noteInput = document.getElementById('note');

  // Step 3 Fields
  const reviewSummaryCard = document.getElementById('reviewSummaryCard');
  const revShow = document.getElementById('revShow');
  const revName = document.getElementById('revName');
  const revAge = document.getElementById('revAge');
  const revAddress = document.getElementById('revAddress');
  const revGenre = document.getElementById('revGenre');
  const revMedium = document.getElementById('revMedium');
  const revPortfolio = document.getElementById('revPortfolio');
  const revRecentWorksRow = document.getElementById('revRecentWorksRow');
  const revRecentWorks = document.getElementById('revRecentWorks');
  const revGuardianRow = document.getElementById('revGuardianRow');
  const revGuardian = document.getElementById('revGuardian');

  const checkScreen = document.getElementById('checkScreen');
  const checkAgeContainer = document.getElementById('checkAgeContainer');
  const checkAge = document.getElementById('checkAge');

  // ── State ───────────────────────────────────────────────────────────
  let activeCycles = [];
  let selectedCycle = null;
  let userStatusData = null;
  let uploadedPdfUrl = null;
  let uploadedPdfName = null;
  let uploadedRecentWorksUrl = null;
  let uploadedRecentWorksName = null;
  let turnstileWidgetId = null;
  let currentStep = 1;

  // ── Helper: Read Magic Bytes ────────────────────────────────────────
  function readMagicBytes(file, bytesToRead = 5) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const slice = file.slice(0, bytesToRead);
      reader.onloadend = () => {
        if (reader.result) {
          resolve(new Uint8Array(reader.result));
        } else {
          reject(new Error('Failed to read file header.'));
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(slice);
    });
  }

  function isPdfBytes(bytes) {
    // '%PDF-' => 0x25, 0x50, 0x44, 0x46, 0x2D
    return bytes.length >= 5 &&
      bytes[0] === 0x25 && bytes[1] === 0x50 &&
      bytes[2] === 0x44 && bytes[3] === 0x46 &&
      bytes[4] === 0x2D;
  }

  function isImageOrPdfBytes(bytes) {
    if (isPdfBytes(bytes)) return true;
    // JPEG: FF D8 FF
    if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return true;
    // PNG: 89 50 4E 47
    if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return true;
    // WebP: RIFF ... WEBP
    if (bytes.length >= 12) {
      const isRiff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
      const isWebp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
      if (isRiff && isWebp) return true;
    }
    return false;
  }

  // ── Turnstile Widget State ──────────────────────────────────────────
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

  if (!window.turnstile) {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (window.turnstile) {
        clearInterval(interval);
        initTurnstileWidget();
      } else if (attempts > 20) {
        clearInterval(interval);
      }
    }, 250);
  }

  // ── Portfolio Upload via Sovereign R2 (/exhibitions/upload-portfolio)
  portfolioFile?.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!uploadStatus) return;

    if (!file) {
      uploadedPdfUrl = null;
      uploadedPdfName = null;
      uploadStatus.textContent = '';
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      uploadStatus.style.color = 'var(--accent-red-text)';
      uploadStatus.textContent = '✗ File exceeds the 15MB limit. Please choose a smaller document.';
      e.target.value = '';
      uploadedPdfUrl = null;
      uploadedPdfName = null;
      return;
    }

    try {
      const bytes = await readMagicBytes(file, 5);
      if (!isPdfBytes(bytes)) {
        uploadStatus.style.color = 'var(--accent-red-text)';
        uploadStatus.textContent = '✗ Invalid format. Only genuine PDF documents (%PDF-) are accepted.';
        e.target.value = '';
        uploadedPdfUrl = null;
        uploadedPdfName = null;
        return;
      }
    } catch (readErr) {
      uploadStatus.style.color = 'var(--accent-red-text)';
      uploadStatus.textContent = '✗ Unable to read file header. Please select a valid PDF file.';
      e.target.value = '';
      return;
    }

    const sizeFormatted = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${(file.size / 1024).toFixed(0)} KB`;

    uploadStatus.style.color = 'var(--accent-gold-text)';
    uploadStatus.textContent = `Uploading "${file.name}" (${sizeFormatted}) to Private Storage...`;
    if (portfolioProgressWrap) portfolioProgressWrap.style.display = 'block';
    if (portfolioProgressFill) portfolioProgressFill.style.width = '60%';

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await window.globalApiFetch('/exhibitions/upload-portfolio', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || errJson.error || 'Private storage upload failed.');
      }

      const data = await res.json();
      uploadedPdfUrl = data.url;
      uploadedPdfName = file.name;

      if (portfolioProgressFill) portfolioProgressFill.style.width = '100%';
      setTimeout(() => {
        if (portfolioProgressWrap) portfolioProgressWrap.style.display = 'none';
      }, 500);

      uploadStatus.style.color = 'var(--accent-green-text)';
      uploadStatus.innerHTML = `✓ Upload complete: <strong>${window.escapeHtml(file.name)}</strong> (${sizeFormatted})`;
    } catch (uploadErr) {
      if (portfolioProgressWrap) portfolioProgressWrap.style.display = 'none';
      uploadStatus.style.color = 'var(--accent-red-text)';
      uploadStatus.textContent = `✗ ${uploadErr.message || 'Upload failed. Please check your connection and retry.'}`;
      uploadedPdfUrl = null;
      uploadedPdfName = null;
    }
  });

  // ── Optional Youth Recent Works Upload (/exhibitions/upload-recent-works)
  recentWorksFile?.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!recentWorksStatus) return;

    if (!file) {
      uploadedRecentWorksUrl = null;
      uploadedRecentWorksName = null;
      recentWorksStatus.textContent = '';
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      recentWorksStatus.style.color = 'var(--accent-red-text)';
      recentWorksStatus.textContent = '✗ File exceeds the 15MB limit.';
      e.target.value = '';
      uploadedRecentWorksUrl = null;
      uploadedRecentWorksName = null;
      return;
    }

    try {
      const bytes = await readMagicBytes(file, 12);
      if (!isImageOrPdfBytes(bytes)) {
        recentWorksStatus.style.color = 'var(--accent-red-text)';
        recentWorksStatus.textContent = '✗ Invalid format. Only PDF, JPEG, PNG, or WebP files are accepted.';
        e.target.value = '';
        uploadedRecentWorksUrl = null;
        uploadedRecentWorksName = null;
        return;
      }
    } catch (readErr) {
      recentWorksStatus.style.color = 'var(--accent-red-text)';
      recentWorksStatus.textContent = '✗ Could not read file header.';
      e.target.value = '';
      return;
    }

    const sizeFormatted = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${(file.size / 1024).toFixed(0)} KB`;

    recentWorksStatus.style.color = 'var(--accent-gold-text)';
    recentWorksStatus.textContent = `Uploading "${file.name}" (${sizeFormatted})...`;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await window.globalApiFetch('/exhibitions/upload-recent-works', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || errJson.error || 'Recent works upload failed.');
      }

      const data = await res.json();
      uploadedRecentWorksUrl = data.url;
      uploadedRecentWorksName = file.name;

      recentWorksStatus.style.color = 'var(--accent-green-text)';
      recentWorksStatus.innerHTML = `✓ Upload complete: <strong>${window.escapeHtml(file.name)}</strong> (${sizeFormatted})`;
    } catch (uploadErr) {
      recentWorksStatus.style.color = 'var(--accent-red-text)';
      recentWorksStatus.textContent = `✗ ${uploadErr.message || 'Upload failed.'}`;
      uploadedRecentWorksUrl = null;
      uploadedRecentWorksName = null;
    }
  });

  // ── Step Navigation & Form Control ──────────────────────────────────
  function goToStep(stepNumber) {
    currentStep = stepNumber;

    [step1Section, step2Section, step3Section].forEach((sec, idx) => {
      if (sec) {
        if (idx + 1 === stepNumber) {
          sec.classList.add('active');
        } else {
          sec.classList.remove('active');
        }
      }
    });

    [pillStep1, pillStep2, pillStep3].forEach((pill, idx) => {
      if (pill) {
        if (idx + 1 === stepNumber) {
          pill.classList.add('active');
          pill.setAttribute('aria-selected', 'true');
        } else {
          pill.classList.remove('active');
          pill.setAttribute('aria-selected', 'false');
        }
      }
    });

    // Clear form messages on step switch
    if (formMsg) {
      formMsg.textContent = '';
      formMsg.style.color = '';
    }

    if (stepNumber === 3) {
      initTurnstileWidget();
    }
  }

  // ── Step 1 Validation & Next ────────────────────────────────────────
  btnToStep2?.addEventListener('click', () => {
    const fullName = fnameInput?.value.trim();
    const ageVal = parseInt(ageInput?.value, 10);
    const address = addressInput?.value.trim();
    const phone = whatsappInput?.value.trim();

    if (!fullName) {
      alert('Please enter your full name or artist pseudonym.');
      fnameInput?.focus();
      return;
    }

    if (isNaN(ageVal) || ageVal < 1 || ageVal > 120) {
      alert('Please enter a valid age in years.');
      ageInput?.focus();
      return;
    }

    const isYouthCycle = selectedCycle && selectedCycle.require_over_18 === false;
    if (isYouthCycle && ageVal >= 18) {
      alert('This specific exhibition cycle is designated for youth and children under 18 years of age.');
      ageInput?.focus();
      return;
    }
    if (!isYouthCycle && selectedCycle && selectedCycle.require_over_18 === true && ageVal < 18) {
      alert('This specific exhibition cycle requires participants to be 18 years of age or older.');
      ageInput?.focus();
      return;
    }

    if (!address) {
      alert('Please share your town, district, or city in Kashmir.');
      addressInput?.focus();
      return;
    }

    if (!phone) {
      alert('Please provide a WhatsApp or phone number so our team can reach you.');
      whatsappInput?.focus();
      return;
    }

    // If participant is under 18, validate guardian safeguarding
    if (ageVal < 18) {
      const gName = guardianName?.value.trim();
      const gRel = guardianRelationship?.value.trim();
      const gContact = guardianContact?.value.trim();
      const gConsent = guardianConsent?.checked;
      const pAssent = participantAssent?.checked;

      if (!gName) {
        alert('Please enter your parent or legal guardian\'s full name.');
        guardianName?.focus();
        return;
      }
      if (!gRel) {
        alert('Please indicate your relationship to your guardian (e.g. Mother, Father).');
        guardianRelationship?.focus();
        return;
      }
      if (!gContact) {
        alert('Please enter your guardian\'s phone number or email.');
        guardianContact?.focus();
        return;
      }
      if (!gConsent) {
        alert('Parent/Guardian consent must be checked before proceeding.');
        guardianConsent?.focus();
        return;
      }
      if (!pAssent) {
        alert('Participant assent must be confirmed before proceeding.');
        participantAssent?.focus();
        return;
      }
    }

    goToStep(2);
  });

  btnBackToStep1?.addEventListener('click', () => {
    goToStep(1);
  });

  // ── Step 2 Validation & Next ────────────────────────────────────────
  btnToStep3?.addEventListener('click', () => {
    const genre = genreInput?.value.trim();
    const medium = mediumInput?.value.trim();

    if (!genre) {
      alert('Please enter your artistic discipline (e.g. Painting, Calligraphy).');
      genreInput?.focus();
      return;
    }

    if (!medium) {
      alert('Please specify your medium and dimensions (e.g. Oil on Canvas).');
      mediumInput?.focus();
      return;
    }

    if (!uploadedPdfUrl) {
      alert('Please upload your artwork portfolio PDF before proceeding.');
      portfolioFile?.focus();
      return;
    }

    // Populate Step 3 Review Card
    if (revShow) revShow.textContent = selectedCycle?.title || 'Selected Exhibition Show';
    if (revName) revName.textContent = fnameInput?.value.trim() || '—';
    
    const ageVal = parseInt(ageInput?.value, 10);
    const ageCohort = ageVal < 18 ? 'Youth Stream (< 18)' : 'Adult Stream (18+)';
    if (revAge) revAge.textContent = `${ageVal} years (${ageCohort})`;
    
    if (revAddress) revAddress.textContent = addressInput?.value.trim() || '—';
    if (revGenre) revGenre.textContent = genre;
    if (revMedium) revMedium.textContent = medium;
    if (revPortfolio) revPortfolio.textContent = uploadedPdfName || 'PDF Document Uploaded';

    if (ageVal < 18 && selectedCycle?.allow_recent_works_youth && uploadedRecentWorksUrl) {
      if (revRecentWorksRow) revRecentWorksRow.style.display = 'flex';
      if (revRecentWorks) revRecentWorks.textContent = uploadedRecentWorksName || 'Recent Works Attached';
    } else {
      if (revRecentWorksRow) revRecentWorksRow.style.display = 'none';
    }

    if (ageVal < 18) {
      if (revGuardianRow) revGuardianRow.style.display = 'flex';
      if (revGuardian) {
        revGuardian.textContent = `${guardianName?.value.trim()} (${guardianRelationship?.value.trim()}) — ${guardianContact?.value.trim()}`;
      }
    } else {
      if (revGuardianRow) revGuardianRow.style.display = 'none';
    }

    goToStep(3);
  });

  btnBackToStep2?.addEventListener('click', () => {
    goToStep(2);
  });

  // ── Dynamic Age Input Listener ──────────────────────────────────────
  ageInput?.addEventListener('input', () => {
    const val = parseInt(ageInput.value, 10);
    if (!isNaN(val) && val < 18) {
      if (guardianSection) guardianSection.style.display = 'block';
      if (checkAgeContainer) checkAgeContainer.style.display = 'none';
      if (checkAge) checkAge.required = false;

      // Check if current cycle allows optional recent works for youth
      if (selectedCycle && selectedCycle.allow_recent_works_youth) {
        if (recentWorksGroup) recentWorksGroup.style.display = 'block';
      } else {
        if (recentWorksGroup) recentWorksGroup.style.display = 'none';
      }
    } else {
      if (guardianSection) guardianSection.style.display = 'none';
      if (checkAgeContainer) checkAgeContainer.style.display = 'block';
      if (checkAge) checkAge.required = true;
      if (recentWorksGroup) recentWorksGroup.style.display = 'none';
    }
  });

  // ── Render Showcase Cards ───────────────────────────────────────────
  function renderShowcaseGrid(cycles) {
    if (!showcaseGrid) return;
    showcaseGrid.innerHTML = '';

    if (totalCyclesCount) {
      totalCyclesCount.textContent = `${cycles.length} ${cycles.length === 1 ? 'Open Show' : 'Open Shows'}`;
    }

    cycles.forEach(cycle => {
      const card = document.createElement('article');
      card.className = 'show-card';
      if (selectedCycle && selectedCycle.id === cycle.id) {
        card.classList.add('selected');
      }

      const isYouth = cycle.require_over_18 === false;
      const streamBadge = isYouth
        ? `<span class="badge badge-pending" style="font-size: 10px; width: fit-content;">${t('badge.youth', 'Below 18 (Youth)')}</span>`
        : `<span class="badge badge-approved" style="font-size: 10px; width: fit-content;">${t('badge.adult', '18 & Above (Adults)')}</span>`;

      // Check if current user has an application for this cycle
      const cycleStatusInfo = userStatusData?.statuses_by_cycle && userStatusData.statuses_by_cycle[cycle.title];
      const userCycleStatus = cycleStatusInfo?.status;

      let actionButtonHtml = '';
      if (userCycleStatus) {
        actionButtonHtml = `
          <button type="button" class="action-btn select-show-btn" data-cycle-id="${cycle.id}" style="font-size: 11px; padding: 0.6rem 1rem;">
            View Application Status (${userCycleStatus})
          </button>
        `;
      } else {
        actionButtonHtml = `
          <button type="button" class="action-btn gold select-show-btn" data-cycle-id="${cycle.id}" style="font-size: 11px; padding: 0.6rem 1rem;">
            ${t('exhib.apply_btn', 'Apply to this Show')} &rarr;
          </button>
        `;
      }

      card.innerHTML = `
        <div>
          ${streamBadge}
          <h3 class="show-card-title">${window.escapeHtml(cycle.title)}</h3>
          <div class="show-card-meta">
            <span>📅 ${window.escapeHtml(cycle.date_text || 'Dates TBA')}</span>
            <span>📍 ${window.escapeHtml(cycle.venue || 'Alfaaz Gallery, Srinagar')}</span>
          </div>
          <p class="show-card-desc">
            ${window.escapeHtml(cycle.about_text || 'Open call for artistic portfolios and original works.')}
          </p>
        </div>
        <div style="margin-top: 1rem;">
          ${actionButtonHtml}
        </div>
      `;

      showcaseGrid.appendChild(card);
    });

    // Attach Click Handlers to "Apply to this Show" Buttons
    showcaseGrid.querySelectorAll('.select-show-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const cycleId = btn.getAttribute('data-cycle-id');
        const chosen = activeCycles.find(c => String(c.id) === String(cycleId));
        if (!chosen) return;

        if (!token) {
          // Anonymous visitor clicked Apply: redirect to login with return path
          window.location.href = `login.html?redirect=exhibition.html%3Fid%3D${encodeURIComponent(chosen.id)}`;
          return;
        }

        selectCycleAndOpenForm(chosen);
      });
    });
  }

  // ── Select a Cycle and Configure Form ───────────────────────────────
  function selectCycleAndOpenForm(cycle) {
    selectedCycle = cycle;

    // Update URL query parameter cleanly without reloading
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('id', cycle.id);
    window.history.replaceState({}, '', newUrl.toString());

    // Highlight selected card in showcase
    showcaseGrid?.querySelectorAll('.show-card').forEach(c => c.classList.remove('selected'));
    const matchingBtn = showcaseGrid?.querySelector(`[data-cycle-id="${cycle.id}"]`);
    if (matchingBtn) {
      matchingBtn.closest('.show-card')?.classList.add('selected');
    }

    // Configure Selected Cycle Bar
    if (currentShowTitle) currentShowTitle.textContent = cycle.title;
    if (currentShowMeta) {
      currentShowMeta.textContent = `${cycle.date_text || 'Dates TBA'} — ${cycle.venue || 'Alfaaz Gallery'}`;
    }
    const isYouth = cycle.require_over_18 === false;
    if (currentShowBadge) {
      currentShowBadge.innerHTML = isYouth
        ? '<span class="badge badge-pending" style="font-size: 10px;">Youth Stream (Below 18)</span>'
        : '<span class="badge badge-approved" style="font-size: 10px;">Adult Stream (18 &amp; Above)</span>';
    }

    // Configure Age Input Rules
    if (isYouth) {
      if (ageFieldHint) ageFieldHint.textContent = 'For children & youth under 18 years old (ages 1 to 17)';
      if (ageInput) {
        ageInput.min = '1';
        ageInput.max = '17';
        ageInput.placeholder = 'e.g. 14';
      }
      if (guardianSection) guardianSection.style.display = 'block';
      if (checkAgeContainer) checkAgeContainer.style.display = 'none';
      if (checkAge) checkAge.required = false;

      if (cycle.allow_recent_works_youth) {
        if (recentWorksGroup) recentWorksGroup.style.display = 'block';
      } else {
        if (recentWorksGroup) recentWorksGroup.style.display = 'none';
      }
    } else {
      if (ageFieldHint) ageFieldHint.textContent = 'Must be 18 years of age or older to apply';
      if (ageInput) {
        ageInput.min = '18';
        ageInput.max = '99';
        ageInput.placeholder = 'e.g. 24';
      }
      if (guardianSection) guardianSection.style.display = 'none';
      if (checkAgeContainer) checkAgeContainer.style.display = 'block';
      if (checkAge) checkAge.required = true;
      if (recentWorksGroup) recentWorksGroup.style.display = 'none';
    }

    // Check user's status for this cycle
    const cycleStatusInfo = userStatusData?.statuses_by_cycle && userStatusData.statuses_by_cycle[cycle.title];
    const status = cycleStatusInfo?.status;

    if (status === 'APPROVED') {
      if (statusNoticeBanner) statusNoticeBanner.style.display = 'block';
      if (statusNoticeBadge) statusNoticeBadge.innerHTML = '<span class="badge badge-approved" style="font-size: 10px;">✓ Selected for Exhibition</span>';
      if (statusNoticeHeading) statusNoticeHeading.textContent = 'Great News! Your Artwork Was Selected!';
      if (statusNoticeText) {
        statusNoticeText.innerHTML = `Your artwork has been chosen for <strong>${window.escapeHtml(cycle.title)}</strong>! Please open your member dashboard to confirm your gallery spot.`;
      }
      if (exhibForm) exhibForm.style.display = 'none';
    } else if (status === 'PENDING') {
      if (statusNoticeBanner) statusNoticeBanner.style.display = 'block';
      if (statusNoticeBadge) statusNoticeBadge.innerHTML = '<span class="badge badge-pending" style="font-size: 10px;">⏳ Under Curatorial Review</span>';
      if (statusNoticeHeading) statusNoticeHeading.textContent = 'Application Under Review';
      if (statusNoticeText) {
        statusNoticeText.innerHTML = `Thank you for submitting to <strong>${window.escapeHtml(cycle.title)}</strong>! Our curators are reviewing each piece with care and respect. You can track updates on your dashboard.`;
      }
      if (exhibForm) exhibForm.style.display = 'none';
    } else if (status === 'REJECTED') {
      if (statusNoticeBanner) statusNoticeBanner.style.display = 'block';
      if (statusNoticeBadge) statusNoticeBadge.innerHTML = '<span class="badge" style="border: 1px solid var(--accent-gold); color: var(--accent-gold-text); font-size: 10px;">Not Selected</span>';
      if (statusNoticeHeading) statusNoticeHeading.textContent = 'Application Not Selected';
      if (statusNoticeText) {
        statusNoticeText.innerHTML = `Thank you for sharing your artwork for <strong>${window.escapeHtml(cycle.title)}</strong>. Your work was not chosen for this specific cycle, but we encourage you to apply to our other active shows!`;
      }
      if (exhibForm) exhibForm.style.display = 'none';
    } else {
      if (statusNoticeBanner) statusNoticeBanner.style.display = 'none';
      if (exhibForm) exhibForm.style.display = 'block';
      goToStep(1);
    }

    if (applicationSection) {
      applicationSection.style.display = 'block';
      applicationSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // ── Reset Cycle Handler ─────────────────────────────────────────────
  resetCycleBtn?.addEventListener('click', () => {
    if (notFoundMessage) notFoundMessage.style.display = 'none';
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('id');
    cleanUrl.searchParams.delete('cycle');
    window.history.replaceState({}, '', cleanUrl.toString());

    if (activeCycles.length > 0) {
      renderShowcaseGrid(activeCycles);
      if (showcaseGrid) showcaseGrid.closest('section').style.display = 'block';
    }
  });

  // ── Form Submission (/exhibitions/apply) ─────────────────────────────
  exhibForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!checkScreen?.checked) {
      alert('Please agree to the curatorial screening terms before submitting.');
      checkScreen?.focus();
      return;
    }

    const ageVal = parseInt(ageInput?.value, 10);
    if (ageVal >= 18 && checkAge && !checkAge.checked) {
      alert('Please confirm that you are 18 years of age or older.');
      checkAge?.focus();
      return;
    }

    const turnstileToken = window.turnstile && turnstileWidgetId !== null
      ? (window.turnstile.getResponse(turnstileWidgetId) || '')
      : (document.querySelector('[name="cf-turnstile-response"]')?.value || '');

    const isOver18 = ageVal >= 18;

    const payload = {
      exhibition_cycle: selectedCycle?.title || 'HARUD 2026',
      exhibition_id: selectedCycle?.id || null,
      full_name: fnameInput?.value.trim(),
      age: ageVal,
      address: addressInput?.value.trim(),
      whatsapp: whatsappInput?.value.trim(),
      genre: genreInput?.value.trim(),
      medium: mediumInput?.value.trim(),
      portfolio_url: uploadedPdfUrl,
      recent_works_url: uploadedRecentWorksUrl || null,
      is_over_18: isOver18,
      over_18: isOver18,
      agreed_to_screening: true,
      applicant_note: noteInput?.value.trim() || null,
      turnstile_token: turnstileToken,
      // Youth safeguarding fields
      guardian_name: !isOver18 ? guardianName?.value.trim() || null : null,
      guardian_relationship: !isOver18 ? guardianRelationship?.value.trim() || null : null,
      guardian_contact: !isOver18 ? guardianContact?.value.trim() || null : null,
      guardian_consent: !isOver18 ? Boolean(guardianConsent?.checked) : false,
      participant_assent: !isOver18 ? Boolean(participantAssent?.checked) : false
    };

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = t('step.submitting', 'Submitting Application...');
    }
    if (formMsg) {
      formMsg.textContent = '';
      formMsg.style.color = '';
    }

    try {
      const res = await window.globalApiFetch('/exhibitions/apply', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || errJson.error || 'Submission could not be completed. Please check your inputs.');
      }

      // Update local state to pending
      if (!userStatusData) userStatusData = { statuses_by_cycle: {} };
      if (!userStatusData.statuses_by_cycle) userStatusData.statuses_by_cycle = {};
      userStatusData.statuses_by_cycle[selectedCycle.title] = {
        status: 'PENDING',
        application_id: 'pending'
      };

      // Show Success Screen
      if (exhibForm) exhibForm.style.display = 'none';
      if (selectedCycleBar) selectedCycleBar.style.display = 'none';
      if (submissionSuccessScreen) {
        submissionSuccessScreen.style.display = 'block';
        submissionSuccessScreen.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      // Re-render showcase grid with updated status
      renderShowcaseGrid(activeCycles);

    } catch (err) {
      console.error('[Exhibition Submit Error]:', err);
      if (formMsg) {
        formMsg.style.color = 'var(--accent-red-text)';
        formMsg.textContent = `✗ ${err.message || 'Submission failed. Please check your connection and retry.'}`;
      }
      resetTurnstileWidget();
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = t('step.btn_submit', 'Submit Application');
      }
    }
  });

  // ── Page Initialization ─────────────────────────────────────────────
  async function initExhibition() {
    try {
      const fetchPromises = [window.globalApiFetch('/exhibitions/config')];
      if (token) {
        fetchPromises.push(window.globalApiFetch('/exhibitions/my-status'));
      }

      const results = await Promise.all(fetchPromises);
      const cfgRes = results[0];
      const statusRes = results[1];

      if (!cfgRes || !cfgRes.ok) {
        throw new Error('Failed to load exhibition configuration.');
      }

      const config = await cfgRes.json();
      activeCycles = (config.active_cycles && Array.isArray(config.active_cycles) && config.active_cycles.length > 0)
        ? config.active_cycles
        : (config.is_open ? [config] : []);

      if (statusRes && statusRes.ok) {
        userStatusData = await statusRes.json().catch(() => null);
      }

      if (!config.is_open || activeCycles.length === 0) {
        if (closedMessage) closedMessage.style.display = 'block';
        if (activePortalContainer) activePortalContainer.style.display = 'none';
        if (headerTitle) headerTitle.textContent = t('exhib.closed_heading', 'Exhibition Portal Closed');
        return;
      }

      // Portal is active
      if (closedMessage) closedMessage.style.display = 'none';
      if (activePortalContainer) activePortalContainer.style.display = 'block';

      renderShowcaseGrid(activeCycles);

      // Check URL parameters: ?id=...
      const urlParams = new URLSearchParams(window.location.search);
      const targetId = urlParams.get('id');

      if (targetId) {
        const found = activeCycles.find(c => String(c.id) === String(targetId));
        if (found) {
          if (token) {
            selectCycleAndOpenForm(found);
          } else {
            // Keep showcase grid open and highlight
            const matchingBtn = showcaseGrid?.querySelector(`[data-cycle-id="${found.id}"]`);
            matchingBtn?.closest('.show-card')?.classList.add('selected');
          }
        } else {
          // Explicit ?id= was provided but does not match any active cycle
          if (notFoundMessage) notFoundMessage.style.display = 'block';
          if (applicationSection) applicationSection.style.display = 'none';
        }
      }

    } catch (err) {
      console.error('[Exhibition Portal Init Error]:', err);
      if (headerTitle) headerTitle.textContent = 'Exhibition Unavailable';
      if (closedMessage) {
        closedMessage.style.display = 'block';
        const p = closedMessage.querySelector('p');
        if (p) p.textContent = 'The exhibition portal is temporarily unavailable. Please try again later.';
      }
      if (activePortalContainer) activePortalContainer.style.display = 'none';
    } finally {
      if (window.lucide) window.lucide.createIcons();
    }
  }

  initExhibition();
});
