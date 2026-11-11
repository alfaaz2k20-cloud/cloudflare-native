// exhibition.js — Centralized Exhibition Portal Logic with Direct Stream Selection & Accessible Form
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('alfaaz_token');
  if (!token) {
    window.location.href = `login.html?redirect=exhibition.html`;
    return;
  }

  // ── DOM Elements ──────────────────────────────────────────────────
  const headerTitle = document.getElementById('headerTitle');
  const closedMessage = document.getElementById('closedMessage');
  const activePortalContainer = document.getElementById('activePortalContainer');
  const applicationFormContainer = document.getElementById('applicationFormContainer');
  const exhibForm = document.getElementById('exhibForm');

  const statusNoticeBanner = document.getElementById('statusNoticeBanner');
  const statusNoticeBadge = document.getElementById('statusNoticeBadge');
  const statusNoticeHeading = document.getElementById('statusNoticeHeading');
  const statusNoticeText = document.getElementById('statusNoticeText');

  const cycleSelect = document.getElementById('cycleSelect');
  const cycleSelectorGroup = document.getElementById('cycleSelectorGroup');
  const summaryBadge = document.getElementById('summaryBadge');
  const summaryDates = document.getElementById('summaryDates');
  const summaryTitle = document.getElementById('summaryTitle');
  const summaryVenue = document.getElementById('summaryVenue');
  const summaryAbout = document.getElementById('summaryAbout');

  const fnameInput = document.getElementById('fname');
  const ageInput = document.getElementById('age');
  const ageFieldHint = document.getElementById('ageFieldHint');
  const addressInput = document.getElementById('address');
  const whatsappInput = document.getElementById('whatsapp');
  const genreInput = document.getElementById('genre');
  const mediumInput = document.getElementById('medium');
  const portfolioFile = document.getElementById('portfolioFile');
  const portfolioLabel = document.getElementById('portfolioLabel');
  const portfolioHint = document.getElementById('portfolioHint');
  const uploadStatus = document.getElementById('uploadStatus');
  const noteInput = document.getElementById('note');

  const checkAgeContainer = document.getElementById('checkAgeContainer');
  const checkAge = document.getElementById('checkAge');
  const checkAgeLabel = document.getElementById('checkAgeLabel');
  const checkScreen = document.getElementById('checkScreen');

  const submitBtn = document.getElementById('submitBtn');
  const formMsg = document.getElementById('formMsg');

  // ── State ─────────────────────────────────────────────────────────
  let turnstileWidgetId = null;
  let uploadedPdfUrl = null;
  let activeExhibitionConfig = null;
  let activeCycles = [];
  let selectedCycle = null;
  let userStatusData = null;

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

  // ── Portfolio PDF Upload (Cloudinary with Edge R2 Fallback) ───────
  const getCloudinaryConfig = () => ({
    cloudName: (window.ALFAAZ_CLOUDINARY && window.ALFAAZ_CLOUDINARY.cloudName) || 'dmqwjpmjk',
    uploadPreset: (window.ALFAAZ_CLOUDINARY && window.ALFAAZ_CLOUDINARY.uploadPreset) || 'alfaaz_vault'
  });

  portfolioFile?.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!uploadStatus) return;

    if (!file) {
      uploadedPdfUrl = null;
      uploadStatus.textContent = '';
      return;
    }

    const fileNameLower = file.name ? file.name.toLowerCase() : '';
    const isPdf = file.type === 'application/pdf' || fileNameLower.endsWith('.pdf');
    if (!isPdf) {
      uploadStatus.style.color = 'var(--accent-red-text)';
      uploadStatus.textContent = '✗ Only PDF documents (.pdf) are accepted.';
      e.target.value = '';
      uploadedPdfUrl = null;
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      uploadStatus.style.color = 'var(--accent-red-text)';
      uploadStatus.textContent = '✗ File exceeds the 15MB limit.';
      e.target.value = '';
      uploadedPdfUrl = null;
      return;
    }

    const sizeFormatted = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${(file.size / 1024).toFixed(0)} KB`;

    uploadStatus.style.color = 'var(--accent-gold-text)';
    uploadStatus.textContent = `Uploading "${file.name}" (${sizeFormatted}) to Storage...`;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Uploading Portfolio PDF...';
    }

    const { cloudName, uploadPreset } = getCloudinaryConfig();
    let finalUrl = null;

    try {
      // 1. Primary: Cloudinary raw upload
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

      // 3. Sovereign Edge Fallback: Cloudflare Edge R2
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
        uploadStatus.style.color = 'var(--accent-green-text)';
        uploadStatus.innerHTML = `✓ Upload complete: <strong>${window.escapeHtml(file.name)}</strong> (${sizeFormatted})`;
      } else {
        throw new Error('Upload could not be completed. Please check your connection and retry.');
      }
    } catch (uploadErr) {
      uploadStatus.style.color = 'var(--accent-red-text)';
      uploadStatus.textContent = `✗ ${uploadErr.message || 'Upload failed — please check your connection and retry.'}`;
      uploadedPdfUrl = null;
    } finally {
      if (submitBtn) {
        // Only re-enable if current cycle status permits
        updateFormInputsForStatus(selectedCycle);
      }
    }
  });

  // ── Helper: Form Inputs Enable/Disable based on Application Status ─
  function setFormInputsDisabled(disabled) {
    const inputs = [fnameInput, ageInput, addressInput, whatsappInput, genreInput, mediumInput, portfolioFile, noteInput, checkAge, checkScreen];
    inputs.forEach(inp => {
      if (inp) inp.disabled = disabled;
    });
  }

  function updateFormInputsForStatus(cycle) {
    if (!cycle) return;

    const cycleStatusInfo = (userStatusData?.statuses_by_cycle && userStatusData.statuses_by_cycle[cycle.title])
      ? userStatusData.statuses_by_cycle[cycle.title]
      : (userStatusData?.exhibition_cycle === cycle.title ? userStatusData : null);

    const status = cycleStatusInfo?.status || 'NONE';

    if (status === 'APPROVED') {
      if (statusNoticeBanner) statusNoticeBanner.style.display = 'block';
      if (statusNoticeBadge) statusNoticeBadge.innerHTML = '<span class="badge badge-approved" style="font-size: 10px;">✓ Selected for Show</span>';
      if (statusNoticeHeading) statusNoticeHeading.textContent = 'Great News! Your Art Was Selected!';
      if (statusNoticeText) {
        statusNoticeText.innerHTML = `Congratulations! Your artwork has been chosen for <strong>${window.escapeHtml(cycle.title)}</strong>. Please open your dashboard to view the details and confirm your spot.`;
      }
      setFormInputsDisabled(true);
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Already Selected for This Show';
      }
    } else if (status === 'PENDING') {
      if (statusNoticeBanner) statusNoticeBanner.style.display = 'block';
      if (statusNoticeBadge) statusNoticeBadge.innerHTML = '<span class="badge badge-pending" style="font-size: 10px;">⏳ Under Curatorial Review</span>';
      if (statusNoticeHeading) statusNoticeHeading.textContent = 'Application Under Review';
      if (statusNoticeText) {
        statusNoticeText.innerHTML = `Thank you for sharing your artwork for <strong>${window.escapeHtml(cycle.title)}</strong>! Our curators are reviewing each piece with care, fairness, and respect. You can track your status anytime on your dashboard.`;
      }
      setFormInputsDisabled(true);
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Already Submitted (Under Review)';
      }
    } else if (status === 'REJECTED') {
      if (statusNoticeBanner) statusNoticeBanner.style.display = 'block';
      if (statusNoticeBadge) statusNoticeBadge.innerHTML = '<span class="badge" style="border: 1px solid var(--accent-gold); color: var(--accent-gold-text); font-size: 10px;">Not Selected for This Show</span>';
      if (statusNoticeHeading) statusNoticeHeading.textContent = 'Not Selected for This Show';
      if (statusNoticeText) {
        statusNoticeText.innerHTML = `Thank you so much for sharing your artwork with us for <strong>${window.escapeHtml(cycle.title)}</strong>! Your artwork was not selected for this show, but we have kept your work safely in our collection. You cannot re-apply for this specific show, but you are welcome to choose another active show from the selector above if you are eligible! Keep creating!`;
      }
      setFormInputsDisabled(true);
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Not Eligible to Resubmit for This Show';
      }
    } else {
      // Clean, un-submitted state
      if (statusNoticeBanner) statusNoticeBanner.style.display = 'none';
      setFormInputsDisabled(false);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send My Application';
      }
    }
  }

  // ── Update View for a Specific Cycle ──────────────────────────────
  function updateCycleView(cycle) {
    if (!cycle) return;
    selectedCycle = cycle;

    if (headerTitle) {
      headerTitle.textContent = cycle.title || 'Exhibition Open Call';
    }

    // Update Summary Card
    const isYouth = cycle.require_over_18 === false;
    if (summaryBadge) {
      summaryBadge.innerHTML = isYouth
        ? '<span class="badge badge-pending" style="font-size: 10px;">Below 18 (Children &amp; Youth)</span>'
        : '<span class="badge badge-approved" style="font-size: 10px;">18 and Above (Adults)</span>';
    }
    if (summaryDates) summaryDates.textContent = cycle.date_text || 'Dates TBA';
    if (summaryTitle) summaryTitle.textContent = cycle.title;
    if (summaryVenue) summaryVenue.textContent = cycle.venue || 'Alfaaz Gallery & Cultural Centre, Srinagar';
    if (summaryAbout) summaryAbout.textContent = cycle.about_text || 'Open call for artistic portfolios and original works.';

    // Configure Age & Portfolio Requirements
    if (isYouth) {
      if (ageFieldHint) ageFieldHint.textContent = 'For children & youth under 18 years old (ages 1 to 17)';
      if (ageInput) {
        ageInput.min = '1';
        ageInput.max = '17';
        ageInput.placeholder = 'e.g. 14';
      }
      if (portfolioLabel) portfolioLabel.textContent = 'Your Artwork (PDF) *';
      if (portfolioHint) portfolioHint.textContent = 'Upload a PDF with pictures of your drawings, paintings, or crafts (max 15MB, PDF only)';
      if (checkAgeContainer) checkAgeContainer.style.display = 'none';
      if (checkAge) {
        checkAge.required = false;
        checkAge.checked = true;
      }
    } else {
      if (ageFieldHint) ageFieldHint.textContent = 'Must be 18 years of age or older to apply';
      if (ageInput) {
        ageInput.min = '18';
        ageInput.max = '99';
        ageInput.placeholder = 'e.g. 24';
      }
      if (portfolioLabel) portfolioLabel.textContent = 'Recent Works Portfolio (PDF) *';
      if (portfolioHint) portfolioHint.textContent = 'Mandatory: Upload a PDF showing your recent works (max 15MB, PDF only)';
      if (checkAgeContainer) checkAgeContainer.style.display = 'flex';
      if (checkAge) {
        checkAge.required = true;
        checkAge.checked = false;
      }
      if (checkAgeLabel) checkAgeLabel.textContent = 'I confirm that I am 18 years of age or older.';
    }

    // Update status banner and enable/disable inputs
    updateFormInputsForStatus(cycle);

    // Clear any previous error/success message
    if (formMsg) {
      formMsg.textContent = '';
      formMsg.style.color = '';
    }

    initTurnstileWidget();
  }

  // ── Cycle Dropdown Listener ───────────────────────────────────────
  cycleSelect?.addEventListener('change', (e) => {
    const cycleId = e.target.value;
    const found = activeCycles.find(c => String(c.id) === String(cycleId)) || activeCycles[0];
    if (found) {
      updateCycleView(found);
    }
  });

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

      if (!config.is_open || activeCycles.length === 0) {
        if (closedMessage) closedMessage.style.display = 'block';
        if (activePortalContainer) activePortalContainer.style.display = 'none';
        if (headerTitle) headerTitle.textContent = 'Exhibitions Closed';
        return;
      }

      // Shows are open: display active portal container
      if (closedMessage) closedMessage.style.display = 'none';
      if (activePortalContainer) activePortalContainer.style.display = 'block';

      // Populate cycle select dropdown
      if (cycleSelect) {
        cycleSelect.innerHTML = '';
        activeCycles.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          const streamLabel = c.require_over_18 === false ? 'Below 18 (Youth)' : '18 & Above (Adults)';
          opt.textContent = `${c.title} — ${streamLabel}`;
          cycleSelect.appendChild(opt);
        });

        if (activeCycles.length <= 1) {
          // If only one show, hide the dropdown label, just show the show's title cleanly
          const hint = document.getElementById('cycleSelectorHint');
          if (hint) hint.textContent = 'Current Open Exhibition';
        }
      }

      // Check URL query params for target exhibition
      const params = new URLSearchParams(window.location.search);
      const paramCycleId = params.get('id');
      const paramCycleTitle = params.get('cycle');

      let initialCycle = activeCycles[0];
      if (paramCycleId) {
        const found = activeCycles.find(c => String(c.id) === String(paramCycleId));
        if (found) initialCycle = found;
      } else if (paramCycleTitle) {
        const found = activeCycles.find(c => c.title.toLowerCase() === paramCycleTitle.toLowerCase());
        if (found) initialCycle = found;
      }

      if (cycleSelect && initialCycle) {
        cycleSelect.value = initialCycle.id;
      }

      updateCycleView(initialCycle);

    } catch (err) {
      console.error('[Exhibition Init Error]:', err);
      if (headerTitle) headerTitle.textContent = 'Exhibition Unavailable';
      if (closedMessage) {
        closedMessage.style.display = 'block';
        const p = closedMessage.querySelector('p');
        if (p) p.textContent = 'The exhibition portal is temporarily unavailable. Please try again later.';
      }
      if (activePortalContainer) activePortalContainer.style.display = 'none';
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

    const currentCycle = selectedCycle || activeCycles[0] || activeExhibitionConfig;
    const ageVal = parseInt(ageInput.value, 10);
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

    const isOver18Checked = isAdultCycle ? Boolean(checkAge?.checked) : true;
    const turnstileToken = window.turnstile && turnstileWidgetId !== null
      ? (window.turnstile.getResponse(turnstileWidgetId) || '')
      : (document.querySelector('[name="cf-turnstile-response"]')?.value || '');

    const payload = {
      exhibition_cycle: currentCycle?.title || 'HARUD 2026',
      exhibition_id: currentCycle?.id || null,
      full_name: fnameInput.value.trim(),
      age: ageVal,
      address: addressInput.value.trim(),
      whatsapp: whatsappInput.value.trim(),
      genre: genreInput.value.trim(),
      medium: mediumInput.value.trim(),
      portfolio_url: uploadedPdfUrl,
      is_over_18: isOver18Checked,
      over_18: isOver18Checked,
      agreed_to_screening: checkScreen ? Boolean(checkScreen.checked) : true,
      applicant_note: noteInput?.value.trim() || null,
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
        btn.textContent = 'Send My Application';
        btn.disabled = false;
      }
    };

    try {
      const res = await window.globalApiFetch('/exhibitions/apply', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res && res.ok) {
        // Record submission locally
        if (!userStatusData) userStatusData = { statuses_by_cycle: {} };
        if (!userStatusData.statuses_by_cycle) userStatusData.statuses_by_cycle = {};
        userStatusData.statuses_by_cycle[currentCycle.title] = {
          status: 'PENDING',
          application_id: 'pending'
        };

        if (msg) {
          msg.style.color = 'var(--accent-green-text)';
          msg.textContent = '✓ Your artwork has been received! Opening your dashboard...';
        }
        if (btn) {
          btn.textContent = 'Sent Successfully!';
          btn.style.background = 'var(--accent-gold)';
          btn.style.borderColor = 'var(--accent-gold)';
        }

        // Update view to reflect PENDING status
        updateFormInputsForStatus(currentCycle);

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
