// exhibition-adult.js — Dedicated Adult (18+) Exhibition Intake (Alfaaz Collective)

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('alfaaz_token');

  // Anonymous visitor: redirect to login with return path
  if (!token) {
    const currentParams = window.location.search;
    window.location.href = `login.html?redirect=${encodeURIComponent('exhibition-adult.html' + currentParams)}`;
    return;
  }

  // DOM Elements
  const cycleTitle = document.getElementById('cycleTitle');
  const cycleMeta = document.getElementById('cycleMeta');
  const adultForm = document.getElementById('adultForm');
  const successScreen = document.getElementById('successScreen');
  const formMsg = document.getElementById('formMsg');
  const submitBtn = document.getElementById('submitBtn');

  // Input Fields
  const fnameInput = document.getElementById('fname');
  const ageInput = document.getElementById('age');
  const ageWarning = document.getElementById('ageWarning');
  const linkToYouth = document.getElementById('linkToYouth');
  const addressInput = document.getElementById('address');
  const whatsappInput = document.getElementById('whatsapp');
  const over18Checkbox = document.getElementById('over18Confirm');

  const genreInput = document.getElementById('genre');
  const mediumInput = document.getElementById('medium');
  const noteInput = document.getElementById('note');
  const agreedToScreeningCheckbox = document.getElementById('agreedToScreening');

  const portfolioFile = document.getElementById('portfolioFile');
  const portfolioProgressWrap = document.getElementById('portfolioProgressWrap');
  const portfolioProgressFill = document.getElementById('portfolioProgressFill');
  const uploadStatus = document.getElementById('uploadStatus');

  // State
  let selectedCycle = null;
  let uploadedPdfUrl = null;
  let uploadedPdfName = null;
  let turnstileWidgetId = null;

  // 1. Fetch Cycle Configuration
  const urlParams = new URLSearchParams(window.location.search);
  const cycleIdParam = urlParams.get('id') || urlParams.get('cycle');

  try {
    const endpoint = cycleIdParam
      ? `/exhibitions/config?id=${encodeURIComponent(cycleIdParam)}`
      : '/exhibitions/config';

    const res = await window.globalApiFetch(endpoint);
    if (!res || !res.ok) {
      if (cycleTitle) cycleTitle.textContent = 'Exhibition Cycle Not Found';
      if (cycleMeta) cycleMeta.textContent = 'Please return to the exhibition hub to select an active show.';
      if (adultForm) adultForm.style.display = 'none';
      return;
    }

    const data = await res.json();
    const activeCycles = Array.isArray(data.active_cycles) ? data.active_cycles : [];
    // Prioritize adult cycle if multiple active and no specific id requested
    const adultCycle = (!cycleIdParam && activeCycles.length > 0)
      ? (activeCycles.find(c => c.require_over_18 !== false && c.require_over_18 !== 0) || data)
      : data;
    selectedCycle = adultCycle;

    if (cycleTitle) cycleTitle.textContent = selectedCycle.title || 'Curatorial Exhibition';
    if (cycleMeta) {
      cycleMeta.textContent = `${selectedCycle.date_text || 'Dates Announced Soon'} — ${selectedCycle.venue || 'Alfaaz Gallery, Srinagar'}`;
    }

    // Link to youth portal with same cycle id
    if (linkToYouth && selectedCycle.id) {
      linkToYouth.href = `exhibition-youth.html?id=${encodeURIComponent(selectedCycle.id)}`;
    }

  } catch (err) {
    console.error('[Adult Exhibition Load Error]:', err);
    if (cycleTitle) cycleTitle.textContent = 'Unable to Load Exhibition';
    if (adultForm) adultForm.style.display = 'none';
    return;
  }

  // 2. Dynamic Age Validation
  ageInput?.addEventListener('input', () => {
    const val = parseInt(ageInput.value, 10);
    if (!isNaN(val) && val < 18) {
      if (ageWarning) ageWarning.style.display = 'block';
    } else {
      if (ageWarning) ageWarning.style.display = 'none';
    }
  });

  // 3. File Signature Helpers
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

  function isImageOrPdfBytes(bytes) {
    if (bytes.length >= 5 &&
      bytes[0] === 0x25 && bytes[1] === 0x50 &&
      bytes[2] === 0x44 && bytes[3] === 0x46 &&
      bytes[4] === 0x2D) return true; // PDF
    if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return true; // JPEG
    if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return true; // PNG
    if (bytes.length >= 12) {
      const isRiff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
      const isWebp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
      if (isRiff && isWebp) return true; // WebP
    }
    return false;
  }

  // 4. Primary Recent Works Upload Handler (PDF or Image, max 15MB)
  portfolioFile?.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!uploadStatus) return;

    if (!file) {
      uploadedPdfUrl = null;
      uploadedPdfName = null;
      uploadStatus.textContent = '';
      if (portfolioProgressWrap) portfolioProgressWrap.style.display = 'none';
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      uploadStatus.style.color = 'var(--accent-red-text)';
      uploadStatus.textContent = '✗ File exceeds the 15MB limit. Please choose a smaller document.';
      e.target.value = '';
      uploadedPdfUrl = null;
      return;
    }

    try {
      const bytes = await readMagicBytes(file, 12);
      if (!isImageOrPdfBytes(bytes)) {
        uploadStatus.style.color = 'var(--accent-red-text)';
        uploadStatus.textContent = '✗ Invalid format. Only genuine PDF or Image documents (JPEG, PNG, WebP) are accepted.';
        e.target.value = '';
        uploadedPdfUrl = null;
        return;
      }
    } catch {
      uploadStatus.style.color = 'var(--accent-red-text)';
      uploadStatus.textContent = '✗ Unable to read file header. Please select a valid document or image.';
      e.target.value = '';
      return;
    }

    uploadStatus.style.color = 'var(--accent-gold-text)';
    uploadStatus.textContent = `Uploading "${file.name}" to Private R2 Storage...`;
    if (portfolioProgressWrap) portfolioProgressWrap.style.display = 'block';
    if (portfolioProgressFill) portfolioProgressFill.style.width = '60%';

    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadEndpoint = file.type === 'application/pdf'
        ? '/exhibitions/upload-portfolio'
        : '/exhibitions/upload-recent-works';

      const res = await window.globalApiFetch(uploadEndpoint, {
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
      uploadStatus.style.color = 'var(--accent-green-text)';
      uploadStatus.textContent = `✓ Recent works uploaded successfully: "${file.name}"`;
    } catch (err) {
      uploadStatus.style.color = 'var(--accent-red-text)';
      uploadStatus.textContent = `✗ Upload failed: ${err.message}`;
      if (portfolioProgressWrap) portfolioProgressWrap.style.display = 'none';
      uploadedPdfUrl = null;
    }
  });

  // 5. Turnstile Bot Challenge Setup
  function initTurnstile() {
    const container = document.getElementById('adultTurnstile');
    if (!container || turnstileWidgetId !== null) return;

    if (window.turnstile && typeof window.turnstile.render === 'function') {
      try {
        const isLocal = window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1' ||
          window.location.hostname === '[::1]';
        const defaultSitekey = isLocal ? '1x00000000000000000000AA' : '0x4AAAAAAFsRHzhKR6YGsXSy';

        turnstileWidgetId = window.turnstile.render('#adultTurnstile', {
          sitekey: window.ALFAAZ_TURNSTILE_SITEKEY || defaultSitekey,
          theme: 'light'
        });
      } catch (err) {
        console.warn('[Adult Turnstile Warning]:', err);
      }
    }
  }

  if (!window.turnstile) {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (window.turnstile) {
        clearInterval(interval);
        initTurnstile();
      } else if (attempts > 20) {
        clearInterval(interval);
      }
    }, 250);
  } else {
    initTurnstile();
  }

  // 6. Form Submission Handler
  adultForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!formMsg || !submitBtn) return;

    formMsg.textContent = '';
    formMsg.style.color = 'var(--accent-red-text)';

    const fname = fnameInput?.value.trim();
    const ageVal = parseInt(ageInput?.value, 10);
    const address = addressInput?.value.trim();
    const whatsapp = whatsappInput?.value.trim();
    const isOver18Confirmed = over18Checkbox?.checked;

    const genre = genreInput?.value.trim();
    const medium = mediumInput?.value.trim();
    const note = noteInput?.value.trim();
    const agreedScreening = agreedToScreeningCheckbox?.checked;

    // Client-side Validations
    if (!fname) {
      formMsg.textContent = 'Please enter your full name or artist pseudonym.';
      fnameInput?.focus();
      return;
    }

    if (isNaN(ageVal) || ageVal < 18) {
      formMsg.textContent = 'Must be 18 years of age or older for the Adult Exhibition Portal.';
      ageInput?.focus();
      return;
    }

    if (!address) {
      formMsg.textContent = 'Please specify where you are based in Kashmir.';
      addressInput?.focus();
      return;
    }

    if (!whatsapp) {
      formMsg.textContent = 'WhatsApp or contact phone number is required.';
      whatsappInput?.focus();
      return;
    }

    if (!isOver18Confirmed) {
      formMsg.textContent = 'You must confirm that you are 18 years of age or older.';
      over18Checkbox?.focus();
      return;
    }

    if (!genre) {
      formMsg.textContent = 'Artistic discipline is required (e.g. Painting, Sculpture).';
      genreInput?.focus();
      return;
    }

    if (!medium) {
      formMsg.textContent = 'Artwork medium and dimensions are required.';
      mediumInput?.focus();
      return;
    }

    if (!uploadedPdfUrl) {
      formMsg.textContent = 'Please upload your recent works file (PDF or Image) before submitting.';
      portfolioFile?.focus();
      return;
    }

    if (!agreedScreening) {
      formMsg.textContent = 'You must agree to the curatorial screening terms.';
      agreedToScreeningCheckbox?.focus();
      return;
    }

    let turnstileToken = '';
    if (window.turnstile && turnstileWidgetId !== null) {
      turnstileToken = window.turnstile.getResponse(turnstileWidgetId);
      if (!turnstileToken) {
        formMsg.textContent = 'Please complete the security verification challenge.';
        return;
      }
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Recording Application...';
    formMsg.style.color = 'var(--accent-gold-text)';
    formMsg.textContent = 'Submitting application to Alfaaz curatorial registry...';

    const payload = {
      exhibition_id: selectedCycle?.id,
      full_name: fname,
      age: ageVal,
      address: address,
      whatsapp: whatsapp,
      genre: genre,
      medium: medium,
      portfolio_url: uploadedPdfUrl,
      recent_works_url: uploadedPdfUrl,
      applicant_note: note || null,
      over_18: true,
      agreed_to_screening: true,
      'cf-turnstile-response': turnstileToken
    };

    try {
      const res = await window.globalApiFetch('/exhibitions/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || data.error || 'Submission failed. Please check your information and try again.');
      }

      // Success
      adultForm.style.display = 'none';
      const cycleBanner = document.getElementById('cycleBanner');
      if (cycleBanner) cycleBanner.style.display = 'none';
      if (successScreen) successScreen.style.display = 'block';

      window.scrollTo({ top: 100, behavior: 'smooth' });

    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Adult Application →';
      formMsg.style.display = 'block';
      formMsg.style.color = 'var(--accent-red-text)';
      formMsg.textContent = `✗ ${err.message || 'Submission failed. Please check your inputs and try again.'}`;

      if (window.turnstile && turnstileWidgetId !== null) {
        window.turnstile.reset(turnstileWidgetId);
      }
    }
  });
});
