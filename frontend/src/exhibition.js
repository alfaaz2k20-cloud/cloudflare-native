// exhibition.js — Centralized Exhibition Portal Logic
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('alfaaz_token');
  if (!token) {
    window.location.href = `login.html?redirect=exhibition.html`;
    return;
  }

  const headerTitle = document.getElementById('headerTitle');
  const closedMessage = document.getElementById('closedMessage');
  const detailsBox = document.getElementById('detailsBox');
  const applicationFormContainer = document.getElementById('applicationFormContainer');
  const exDates = document.getElementById('exDates');
  const exVenue = document.getElementById('exVenue');
  const exDesc = document.getElementById('exDesc');

  // ── Turnstile Widget State ──────────────────────────────────────────
  let turnstileWidgetId = null;

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

  // ── Cloudinary PDF Upload ──────────────────────────────────────────
  const cloudinaryConfig = window.ALFAAZ_CLOUDINARY || {
    cloudName: 'dmqwjpmjk',
    uploadPreset: 'alfaaz_vault'
  };
  const { cloudName: CLOUD_NAME, uploadPreset: UPLOAD_PRESET } = cloudinaryConfig;
  let uploadedPdfUrl = null;

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

    status.style.color = 'var(--accent-gold-text)';
    status.textContent = `Uploading "${file.name}" to Storage...`;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Uploading Portfolio PDF...';
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', UPLOAD_PRESET);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json().catch(() => ({}));

      if (data.secure_url) {
        uploadedPdfUrl = data.secure_url;
        status.style.color = 'var(--accent-green-text)';
        status.innerHTML = `✓ Upload complete: <strong>${window.escapeHtml(file.name)}</strong>`;
      } else {
        const detail = data.error?.message ? `: ${data.error.message}` : '';
        throw new Error(`Upload failed${detail}`);
      }
    } catch (uploadErr) {
      status.style.color = 'var(--accent-red-text)';
      status.textContent = `✗ ${uploadErr.message || 'Upload failed — please check your connection and retry.'}`;
      uploadedPdfUrl = null;
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit to Curator';
      }
    }
  });

  // ── Page Initialization ───────────────────────────────────────────
  let activeExhibitionConfig = null;

  async function initExhibition() {
    try {
      const res = await window.globalApiFetch('/exhibitions/config');
      if (!res || !res.ok) throw new Error('Failed to load exhibition configuration.');
      const config = await res.json();
      activeExhibitionConfig = config;

      if (headerTitle) {
        headerTitle.textContent = config.title || 'Exhibition Portal';
      }

      if (!config.is_open) {
        if (closedMessage) closedMessage.style.display = 'block';
        if (detailsBox) detailsBox.style.display = 'none';
        if (applicationFormContainer) applicationFormContainer.style.display = 'none';
        return;
      }

      if (detailsBox) detailsBox.style.display = 'flex';
      if (applicationFormContainer) applicationFormContainer.style.display = 'block';
      if (exDates) exDates.textContent = config.date_text || 'Dates TBA';
      if (exVenue) exVenue.textContent = config.venue || 'Alfaaz Gallery & Cultural Centre';
      if (exDesc) exDesc.textContent = config.about_text || 'Applications are currently open for curatorial screening.';

      const checkAgeContainer = document.getElementById('checkAgeContainer');
      const checkAge = document.getElementById('checkAge');
      const checkAgeLabel = document.getElementById('checkAgeLabel');
      const ageHint = document.getElementById('ageFieldHint');

      if (config.require_over_18 === false) {
        if (ageHint) ageHint.textContent = 'All ages welcome for youth / open cycle';
        if (checkAgeContainer) {
          checkAgeContainer.style.background = 'rgba(184, 134, 11, 0.05)';
          checkAgeContainer.style.padding = '0.75rem 1rem';
          checkAgeContainer.style.border = '1px dashed var(--grid-border)';
        }
        if (checkAgeLabel) {
          checkAgeLabel.innerHTML = '<strong style="color:var(--accent-gold-text);">Youth & Open Cycle:</strong> Under 18 submissions permitted for this cycle.';
        }
        if (checkAge) {
          checkAge.checked = true;
          checkAge.required = false;
          checkAge.style.display = 'none';
        }
      } else {
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

      // Check if candidate already submitted an application
      const statusRes = await window.globalApiFetch('/exhibitions/my-status');
      if (statusRes && statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.status && statusData.status !== 'NONE') {
          renderExistingApplicationView(statusData);
          return;
        }
      }

      initTurnstileWidget();
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

  function renderExistingApplicationView(statusData) {
    if (!applicationFormContainer) return;

    let iconName = 'clock';
    let iconColor = 'var(--accent-gold)';
    let statusHeading = 'Application Under Curatorial Review';
    let statusDesc = 'You have already submitted a portfolio for this exhibition cycle. Our curatorial team is currently reviewing submissions.';
    let actionBtnText = 'Track in Dashboard';

    if (statusData.status === 'APPROVED') {
      iconName = 'check-circle';
      iconColor = 'var(--accent-green)';
      statusHeading = 'Portfolio Approved by Curator';
      statusDesc = 'Congratulations! Your portfolio has been approved for this exhibition cycle. Please proceed to the dashboard to finalize your registration and secure your exhibition credentials.';
      actionBtnText = 'Finalize Registration in Dashboard';
    } else if (statusData.status === 'REJECTED') {
      iconName = 'x-circle';
      iconColor = 'var(--accent-red)';
      statusHeading = 'Screening Decision Recorded';
      statusDesc = 'Curatorial screening has concluded for your application. You can review feedback or prepare for upcoming cycles in your dashboard.';
      actionBtnText = 'Go to Dashboard';
    }

    applicationFormContainer.innerHTML = `
      <div class="panel fade-in text-center" style="padding: 4.5rem 2rem; margin-top: 2rem;">
        <i data-lucide="${iconName}" class="portal-icon" style="color: ${iconColor};"></i>
        <h3 style="font-family: var(--font-heading); font-size: 1.8rem; margin-bottom: 1rem; color: var(--text-primary);">${statusHeading}</h3>
        <p style="font-size: 13px; color: var(--text-secondary); max-width: 580px; margin: 0 auto 2.5rem; line-height: 1.7;">${statusDesc}</p>
        <a href="dashboard.html" class="action-btn gold" style="display: inline-block;">${actionBtnText}</a>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  }

  // ── Form Submission ───────────────────────────────────────────────
  document.getElementById('exhibForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    const msg = document.getElementById('formMsg');

    if (!uploadedPdfUrl) {
      if (msg) {
        msg.style.color = 'var(--accent-red-text)';
        msg.textContent = 'Please upload your portfolio PDF before submitting.';
      }
      return;
    }

    const ageVal = parseInt(document.getElementById('age').value, 10);
    const isAdultCycle = !activeExhibitionConfig || activeExhibitionConfig.require_over_18 !== false;
    if (isAdultCycle && (isNaN(ageVal) || ageVal < 18)) {
      if (msg) {
        msg.style.color = 'var(--accent-red-text)';
        msg.textContent = 'This exhibition cycle requires participants to be 18 years of age or older.';
      }
      return;
    }

    const isOver18Checked = isAdultCycle ? Boolean(document.getElementById('checkAge')?.checked) : true;
    const turnstileToken = window.turnstile && turnstileWidgetId !== null
      ? (window.turnstile.getResponse(turnstileWidgetId) || '')
      : (document.querySelector('[name="cf-turnstile-response"]')?.value || '');

    const payload = {
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
      btn.textContent = 'Submitting to Curator...';
      btn.disabled = true;
    }
    if (msg) {
      msg.textContent = '';
      msg.style.color = '';
    }

    const restoreBtn = () => {
      if (btn) {
        btn.textContent = 'Submit to Curator';
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
          msg.textContent = '✓ Portfolio submitted successfully. Redirecting to your dashboard...';
        }
        if (btn) {
          btn.textContent = 'Portfolio Secured';
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

      // Reset Turnstile token on rejection so the candidate can retry without 403
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