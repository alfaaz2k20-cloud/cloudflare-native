// exhibition-youth.js — Dedicated Youth (<18) Exhibition Intake & Safeguarding (Alfaaz Collective)

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('alfaaz_token');

  // Anonymous visitor: redirect to login with return path
  if (!token) {
    const currentParams = window.location.search;
    window.location.href = `login.html?redirect=${encodeURIComponent('exhibition-youth.html' + currentParams)}`;
    return;
  }

  // DOM Elements
  const cycleTitle = document.getElementById('cycleTitle');
  const cycleMeta = document.getElementById('cycleMeta');
  const youthForm = document.getElementById('youthForm');
  const successScreen = document.getElementById('successScreen');
  const formMsg = document.getElementById('formMsg');
  const submitBtn = document.getElementById('submitBtn');

  // Input Fields
  const fnameInput = document.getElementById('fname');
  const ageInput = document.getElementById('age');
  const ageWarning = document.getElementById('ageWarning');
  const linkToAdult = document.getElementById('linkToAdult');
  const addressInput = document.getElementById('address');
  const phoneInput = document.getElementById('phone');

  const guardianNameInput = document.getElementById('guardianName');
  const guardianRelationshipInput = document.getElementById('guardianRelationship');
  const guardianContactInput = document.getElementById('guardianContact');
  const guardianConsentCheckbox = document.getElementById('guardianConsent');
  const participantAssentCheckbox = document.getElementById('participantAssent');

  const genreInput = document.getElementById('genre');
  const mediumInput = document.getElementById('medium');
  const noteInput = document.getElementById('note');
  const agreedToScreeningCheckbox = document.getElementById('agreedToScreening');

  const recentWorksFile = document.getElementById('recentWorksFile');
  const recentWorksProgressWrap = document.getElementById('recentWorksProgressWrap');
  const recentWorksProgressFill = document.getElementById('recentWorksProgressFill');
  const uploadStatus = document.getElementById('uploadStatus');

  // State
  let selectedCycle = null;
  let uploadedRecentWorksUrl = null;
  let uploadedRecentWorksName = null;
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
      if (youthForm) youthForm.style.display = 'none';
      return;
    }

    const data = await res.json();
    selectedCycle = data;

    if (cycleTitle) cycleTitle.textContent = selectedCycle.title || 'Curatorial Exhibition';
    if (cycleMeta) {
      cycleMeta.textContent = `${selectedCycle.date_text || 'Dates Announced Soon'} — ${selectedCycle.venue || 'Alfaaz Gallery, Srinagar'}`;
    }

    // Link to adult portal with same cycle id
    if (linkToAdult && selectedCycle.id) {
      linkToAdult.href = `exhibition-adult.html?id=${encodeURIComponent(selectedCycle.id)}`;
    }

  } catch (err) {
    console.error('[Youth Exhibition Load Error]:', err);
    if (cycleTitle) cycleTitle.textContent = 'Unable to Load Exhibition';
    if (youthForm) youthForm.style.display = 'none';
    return;
  }

  // 2. Dynamic Age Validation
  ageInput?.addEventListener('input', () => {
    const val = parseInt(ageInput.value, 10);
    if (!isNaN(val) && val >= 18) {
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

  function isPdfBytes(bytes) {
    return bytes.length >= 5 &&
      bytes[0] === 0x25 && bytes[1] === 0x50 &&
      bytes[2] === 0x44 && bytes[3] === 0x46 &&
      bytes[4] === 0x2D;
  }

  function isImageOrPdfBytes(bytes) {
    if (isPdfBytes(bytes)) return true;
    if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return true;
    if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return true;
    if (bytes.length >= 12) {
      const isRiff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
      const isWebp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
      if (isRiff && isWebp) return true;
    }
    return false;
  }

  // 4. Earlier Sketches or Recent Works Upload Handler (PDF or Image, max 15MB)
  recentWorksFile?.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!uploadStatus) return;

    if (!file) {
      uploadedRecentWorksUrl = null;
      uploadedRecentWorksName = null;
      uploadStatus.textContent = '';
      if (recentWorksProgressWrap) recentWorksProgressWrap.style.display = 'none';
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      uploadStatus.style.color = 'var(--accent-red-text)';
      uploadStatus.textContent = '✗ File exceeds the 15MB limit. Please choose a smaller file.';
      e.target.value = '';
      uploadedRecentWorksUrl = null;
      return;
    }

    try {
      const bytes = await readMagicBytes(file, 12);
      if (!isImageOrPdfBytes(bytes)) {
        uploadStatus.style.color = 'var(--accent-red-text)';
        uploadStatus.textContent = '✗ Invalid format. Only PDF or image files (JPEG, PNG, WebP) are permitted.';
        e.target.value = '';
        uploadedRecentWorksUrl = null;
        return;
      }
    } catch {
      uploadStatus.style.color = 'var(--accent-red-text)';
      uploadStatus.textContent = '✗ Unable to read file header. Please select a valid file.';
      e.target.value = '';
      return;
    }

    uploadStatus.style.color = 'var(--accent-gold-text)';
    uploadStatus.textContent = `Uploading "${file.name}" to Private R2 Storage...`;
    if (recentWorksProgressWrap) recentWorksProgressWrap.style.display = 'block';
    if (recentWorksProgressFill) recentWorksProgressFill.style.width = '60%';

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await window.globalApiFetch('/exhibitions/upload-recent-works', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || errJson.error || 'Private storage upload failed.');
      }

      const data = await res.json();
      uploadedRecentWorksUrl = data.url;
      uploadedRecentWorksName = file.name;

      if (recentWorksProgressFill) recentWorksProgressFill.style.width = '100%';
      uploadStatus.style.color = 'var(--accent-green-text)';
      uploadStatus.textContent = `✓ Artwork uploaded successfully: "${file.name}"`;
    } catch (err) {
      uploadStatus.style.color = 'var(--accent-red-text)';
      uploadStatus.textContent = `✗ Upload failed: ${err.message}`;
      if (recentWorksProgressWrap) recentWorksProgressWrap.style.display = 'none';
      uploadedRecentWorksUrl = null;
    }
  });

  // 6. Turnstile Bot Challenge Setup
  function initTurnstile() {
    const container = document.getElementById('youthTurnstile');
    if (!container || turnstileWidgetId !== null) return;

    if (window.turnstile && typeof window.turnstile.render === 'function') {
      try {
        const isLocal = window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1' ||
          window.location.hostname === '[::1]';
        const defaultSitekey = isLocal ? '1x00000000000000000000AA' : '0x4AAAAAAFsRHzhKR6YGsXSy';

        turnstileWidgetId = window.turnstile.render('#youthTurnstile', {
          sitekey: window.ALFAAZ_TURNSTILE_SITEKEY || defaultSitekey,
          theme: 'light'
        });
      } catch (err) {
        console.warn('[Youth Turnstile Warning]:', err);
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

  // 7. Form Submission Handler
  youthForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!formMsg || !submitBtn) return;

    formMsg.textContent = '';
    formMsg.style.color = 'var(--accent-red-text)';

    const fname = fnameInput?.value.trim();
    const ageVal = parseInt(ageInput?.value, 10);
    const address = addressInput?.value.trim();
    const phone = phoneInput?.value.trim();

    const guardianName = guardianNameInput?.value.trim();
    const guardianRel = guardianRelationshipInput?.value.trim();
    const guardianContact = guardianContactInput?.value.trim();
    const guardianConsent = guardianConsentCheckbox?.checked;
    const participantAssent = participantAssentCheckbox?.checked;

    const genre = genreInput?.value.trim();
    const medium = mediumInput?.value.trim();
    const note = noteInput?.value.trim();
    const agreedScreening = agreedToScreeningCheckbox?.checked;

    // Client-side Validations
    if (!fname) {
      formMsg.textContent = 'Please enter the young artist\'s full name.';
      fnameInput?.focus();
      return;
    }

    if (isNaN(ageVal) || ageVal < 1 || ageVal > 17) {
      formMsg.textContent = 'A valid age under 18 years is required for the Youth Portal.';
      ageInput?.focus();
      return;
    }

    if (!address) {
      formMsg.textContent = 'Please specify where you are from in Kashmir.';
      addressInput?.focus();
      return;
    }

    if (!phone || phone.length < 7 || phone.length > 25) {
      formMsg.textContent = 'A valid WhatsApp or contact phone number is required.';
      phoneInput?.focus();
      return;
    }

    if (!guardianName) {
      formMsg.textContent = 'Parent or legal guardian name is required.';
      guardianNameInput?.focus();
      return;
    }

    if (!guardianRel) {
      formMsg.textContent = 'Please state the relationship to the applicant (e.g. Mother, Father, Guardian).';
      guardianRelationshipInput?.focus();
      return;
    }

    if (!guardianContact) {
      formMsg.textContent = 'Parent or legal guardian phone or email is required.';
      guardianContactInput?.focus();
      return;
    }

    if (!guardianConsent) {
      formMsg.textContent = 'Parent or guardian consent must be checked to proceed.';
      guardianConsentCheckbox?.focus();
      return;
    }

    if (!participantAssent) {
      formMsg.textContent = 'Participant assent must be confirmed to proceed.';
      participantAssentCheckbox?.focus();
      return;
    }

    if (!genre) {
      formMsg.textContent = 'Artistic discipline is required (e.g. Painting, Calligraphy).';
      genreInput?.focus();
      return;
    }

    if (!medium) {
      formMsg.textContent = 'Artwork medium and dimensions are required.';
      mediumInput?.focus();
      return;
    }

    if (!uploadedRecentWorksUrl) {
      formMsg.textContent = 'Please upload your sketches or recent artwork file (PDF or Image) before submitting.';
      recentWorksFile?.focus();
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
    submitBtn.textContent = 'Recording Youth Application...';
    formMsg.style.color = 'var(--accent-gold-text)';
    formMsg.textContent = 'Submitting application to Alfaaz curatorial registry...';

    const payload = {
      exhibition_id: selectedCycle?.id,
      full_name: fname,
      age: ageVal,
      address: address,
      whatsapp: phone,
      genre: genre,
      medium: medium,
      portfolio_url: uploadedRecentWorksUrl,
      recent_works_url: uploadedRecentWorksUrl,
      applicant_note: note || null,
      guardian_name: guardianName,
      guardian_relationship: guardianRel,
      guardian_contact: guardianContact,
      guardian_consent_granted: 1,
      participant_assent_granted: 1,
      agreed_to_screening: true,
      over_18: false,
      over_19: 0,
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
      youthForm.style.display = 'none';
      const cycleBanner = document.getElementById('cycleBanner');
      if (cycleBanner) cycleBanner.style.display = 'none';
      if (successScreen) successScreen.style.display = 'block';

      window.scrollTo({ top: 100, behavior: 'smooth' });

    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Youth Application →';
      formMsg.style.color = 'var(--accent-red-text)';
      formMsg.textContent = `✗ ${err.message}`;

      if (window.turnstile && turnstileWidgetId !== null) {
        window.turnstile.reset(turnstileWidgetId);
      }
    }
  });
});
