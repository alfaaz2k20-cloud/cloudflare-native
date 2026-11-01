// dashboard.js — Centralized Dashboard & Atelier Ledger Logic
document.addEventListener('DOMContentLoaded', () => {
  const cloudinaryConfig = window.ALFAAZ_CLOUDINARY || {
    cloudName: 'dmqwjpmjk',
    uploadPreset: 'alfaaz_vault'
  };

  // TOAST NOTIFICATION SYSTEM
  function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = message;
    container.appendChild(t);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => t.classList.add('show'));
    });
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 400);
    }, duration);
  }

  // AUTH PRE-FLIGHT
  const userData = localStorage.getItem('alfaaz_user');
  const token = localStorage.getItem('alfaaz_token');
  if (!userData || !token) {
    window.location.href = 'login.html?redirect=dashboard.html';
    return;
  }

  let user;
  try {
    user = JSON.parse(userData);
  } catch (error) {
    localStorage.removeItem('alfaaz_user');
    localStorage.removeItem('alfaaz_token');
    window.location.href = 'login.html';
    return;
  }

  const dashEmail = document.getElementById('dashEmail');
  const dashStatus = document.getElementById('dashStatus');
  const adminLink = document.getElementById('adminLink');
  const logoutBtn = document.getElementById('logoutBtn');

  if (dashEmail) dashEmail.textContent = user.email || '—';
  if (dashStatus) dashStatus.textContent = user.status ? `[ ${user.status} ]` : '[ MEMBER ]';
  if (user.status === 'ADMIN' && adminLink) adminLink.style.display = 'inline-block';

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.clear();
      window.location.href = 'login.html';
    });
  }

  // PROFILE LOGIC
  async function loadProfile() {
    try {
      const res = await window.globalApiFetch('/auth/me');
      if (res && res.status === 401) {
        localStorage.removeItem('alfaaz_user');
        localStorage.removeItem('alfaaz_token');
        window.location.href = 'login.html?redirect=dashboard.html';
        return;
      }
      if (!res || !res.ok) return;
      const data = await res.json().catch(() => ({}));
      const dashName = document.getElementById('dashName');
      const nameEditInput = document.getElementById('nameEditInput');
      const dashPhone = document.getElementById('dashPhone');
      const phoneEditInput = document.getElementById('phoneEditInput');
      const btnEditPhone = document.getElementById('btnEditPhone');
      const dashVerifiedBadge = document.getElementById('dashVerifiedBadge');
      const dashProviderBadge = document.getElementById('dashProviderBadge');

      if (dashName) dashName.textContent = data.full_name || user.email || '—';
      if (nameEditInput) nameEditInput.value = data.full_name || '';

      if (dashPhone) {
        if (data.phone) {
          dashPhone.textContent = data.phone;
          dashPhone.style.color = 'var(--text-primary)';
          if (btnEditPhone) btnEditPhone.textContent = '[Edit Phone]';
        } else {
          dashPhone.textContent = 'Not provided';
          dashPhone.style.color = 'var(--text-secondary)';
          if (btnEditPhone) btnEditPhone.textContent = '[Add WhatsApp]';
        }
      }
      if (phoneEditInput) phoneEditInput.value = data.phone || '';

      if (dashVerifiedBadge) {
        const isVerified = data.email_verified === 1 || data.email_verified === true;
        dashVerifiedBadge.style.display = isVerified ? 'inline-block' : 'none';
      }

      if (dashProviderBadge) {
        if (data.auth_provider === 'google.com') {
          dashProviderBadge.textContent = 'Google Account';
        } else {
          dashProviderBadge.textContent = 'Email Account';
        }
      }

      if (data.status && dashStatus) {
        dashStatus.textContent = `[ ${data.status} ]`;
        if (data.status === 'ADMIN' && adminLink) adminLink.style.display = 'inline-block';
      }
    } catch (e) {
      console.error('Profile load error:', e);
    }
  }

  window.startEditName = function() {
    const dRow = document.getElementById('nameDisplayRow');
    const eRow = document.getElementById('nameEditRow');
    if (dRow) dRow.style.display = 'none';
    if (eRow) {
      eRow.style.display = 'flex';
      const input = document.getElementById('nameEditInput');
      input?.focus();
    }
  };

  window.cancelEditName = function() {
    const dRow = document.getElementById('nameDisplayRow');
    const eRow = document.getElementById('nameEditRow');
    if (dRow) dRow.style.display = 'flex';
    if (eRow) eRow.style.display = 'none';
  };

  window.saveEditName = async function() {
    const val = (document.getElementById('nameEditInput')?.value || '').trim();
    if (!val) {
      showToast('Name cannot be empty.', 'error');
      return;
    }
    const res = await window.globalApiFetch('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify({ full_name: val })
    });
    if (res && res.ok) {
      const dashName = document.getElementById('dashName');
      if (dashName) dashName.textContent = val;
      window.cancelEditName();
      showToast('Name updated successfully.', 'success');
    } else {
      showToast('Failed to update name.', 'error');
    }
  };

  window.startEditPhone = function() {
    const dRow = document.getElementById('phoneDisplayRow');
    const eRow = document.getElementById('phoneEditRow');
    if (dRow) dRow.style.display = 'none';
    if (eRow) {
      eRow.style.display = 'flex';
      const input = document.getElementById('phoneEditInput');
      input?.focus();
    }
  };

  window.cancelEditPhone = function() {
    const dRow = document.getElementById('phoneDisplayRow');
    const eRow = document.getElementById('phoneEditRow');
    if (dRow) dRow.style.display = 'flex';
    if (eRow) eRow.style.display = 'none';
  };

  window.saveEditPhone = async function() {
    const val = (document.getElementById('phoneEditInput')?.value || '').trim();
    if (!val) {
      showToast('Please enter your WhatsApp contact number.', 'error');
      return;
    }
    if (!/^\+[1-9]\d{6,14}$/.test(val)) {
      showToast('Enter a valid mobile number starting with + and country code (e.g. +919876543210).', 'error');
      return;
    }

    try {
      const res = await window.globalApiFetch('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ whatsapp: val })
      });
      if (res && res.ok) {
        const dashPhone = document.getElementById('dashPhone');
        const btnEditPhone = document.getElementById('btnEditPhone');
        if (dashPhone) {
          dashPhone.textContent = val;
          dashPhone.style.color = 'var(--text-primary)';
        }
        if (btnEditPhone) btnEditPhone.textContent = '[Edit Phone]';
        window.cancelEditPhone();
        showToast('WhatsApp number saved successfully.', 'success');
      } else if (res && res.status === 409) {
        showToast('This WhatsApp number is already registered to another account.', 'error');
      } else {
        const err = await res?.json().catch(() => ({}));
        showToast(err?.detail || 'Failed to update WhatsApp number.', 'error');
      }
    } catch (e) {
      showToast('Network error while updating WhatsApp number.', 'error');
    }
  };

  // CURATOR AI INQUIRY DESK
  function appendCuratorMessage(output, label, text, style = '') {
    const row = document.createElement('div');
    row.style.cssText = style;
    if (label) {
      const strong = document.createElement('strong');
      strong.textContent = `${label}:`;
      row.appendChild(strong);
      row.appendChild(document.createTextNode(' '));
    }
    row.appendChild(document.createTextNode(text));
    output.appendChild(row);
    output.scrollTop = output.scrollHeight;
    return row;
  }
  const appendPhantomMessage = appendCuratorMessage;

  window.setInquiry = function(text) {
    const input = document.getElementById('curatorInput') || document.getElementById('phantomInput');
    if (input) {
      input.value = text;
      window.askCurator();
    }
  };

  window.askCurator = async function() {
    const input = document.getElementById('curatorInput') || document.getElementById('phantomInput');
    const output = document.getElementById('curatorOutput') || document.getElementById('phantomOutput');
    if (!input || !output) return;
    const query = input.value.trim();
    if (!query) return;
    input.value = '';

    appendCuratorMessage(output, 'You', query, 'margin-top:1.5rem; color: var(--accent-gold-text); font-weight: 500;');
    const loadMsg = appendCuratorMessage(output, '', 'Curator AI is reflecting on the archives...', 'color:var(--text-secondary); font-style:italic; margin-top:0.5rem;');

    const coldTimer = setTimeout(() => {
      if (loadMsg.isConnected) {
        loadMsg.textContent = 'Gathering vernacular texts and curatorial notes...';
      }
    }, 4000);

    const history = window.alfaazCuratorMemory?.history?.() || [];

    async function executeQuery() {
      return await window.globalApiFetch('/curator/ask', {
        method: 'POST',
        body: JSON.stringify({ question: query, history })
      });
    }

    try {
      let res = await executeQuery();
      if (res && (res.status === 502 || res.status === 503)) {
        if (loadMsg.isConnected) loadMsg.textContent = 'Connecting to archives...';
        await new Promise((r) => setTimeout(r, 2500));
        res = await executeQuery();
      }

      clearTimeout(coldTimer);
      if (loadMsg.isConnected) loadMsg.remove();

      if (res && res.ok) {
        const data = await res.json().catch(() => ({}));
        const answer = data.answer || 'The reflection was quiet.';
        appendCuratorMessage(output, 'Curator AI', answer, 'color:var(--text-primary); margin-top:0.5rem; border-left: 2px solid var(--accent-gold); padding-left: 10px; line-height: 1.6;');
        window.alfaazCuratorMemory?.add?.('user', query);
        window.alfaazCuratorMemory?.add?.('assistant', answer);
      } else if (res && res.status === 429) {
        appendCuratorMessage(output, '', 'Curator AI is currently occupied with multiple inquiries. Please pause a moment.', 'color:var(--accent-red-text); margin-top:0.5rem;');
      } else {
        appendCuratorMessage(output, '', 'The archives are momentarily quiet. Please inquire again shortly.', 'color:var(--accent-red-text); margin-top:0.5rem;');
      }
    } catch (err) {
      clearTimeout(coldTimer);
      if (loadMsg.isConnected) loadMsg.remove();
      appendCuratorMessage(output, '', 'Inquiry interrupted by network failure. Please retry.', 'color:var(--accent-red-text); margin-top:0.5rem;');
    }
    output.scrollTop = output.scrollHeight;
  };
  window.askPhantom = window.askCurator;

  const activeInput = document.getElementById('curatorInput') || document.getElementById('phantomInput');
  activeInput?.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      window.askCurator();
    }
  });

  // GATHERINGS & EVENTS
  async function loadActiveEvents() {
    const container = document.getElementById('activeEventsContainer');
    if (!container) return;
    try {
      const res = await window.globalApiFetch('/events/active');
      if (!res || !res.ok) return;
      const events = await res.json().catch(() => []);
      if (!events.length) {
        container.innerHTML = '<div style="font-size:12px; color:var(--text-secondary); font-style:italic; padding: 1rem 0;">No gatherings currently scheduled under the Chinars. Upcoming circles and readings will appear here.</div>';
        return;
      }
      container.innerHTML = events.map((e) => `
        <div class="list-item">
          <div style="flex:1;">
            <div style="font-family:var(--font-heading); font-size:1.5rem; color:var(--text-primary); margin-bottom:4px;">${window.escapeHtml(e.name)}</div>
            <div style="font-size:10px; color:var(--accent-gold-text); text-transform:uppercase; letter-spacing:1.5px; margin-bottom:6px; font-weight:600;">${window.escapeHtml(e.event_date || 'TBD')}</div>
            <div style="font-size:12px; color:var(--text-secondary); line-height: 1.5;">${window.escapeHtml(e.description || '')}</div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.5rem;">
            <button class="action-btn gold" style="padding:0.6rem 1.4rem; font-size:10px;" ${e.full ? 'disabled' : ''} onclick="openRsvpModal(${parseInt(e.id, 10)})">${e.full ? 'GATHERING FULL' : 'SECURE SPOT'}</button>
            ${e.spots_left != null && !e.full ? `<span style="font-size:9px; letter-spacing:1px; text-transform:uppercase; color:var(--text-secondary);">${e.spots_left} spots left</span>` : ''}
          </div>
        </div>`).join('');
      if (window.refreshGlobalEffects) window.refreshGlobalEffects();
    } catch (e) {
      container.innerHTML = '<p style="color:var(--accent-red); font-size:12px;">Unable to reach the events archive.</p>';
    }
  }

  async function loadMyTickets() {
    const container = document.getElementById('myTicketsContainer');
    if (!container) return;
    try {
      const res = await window.globalApiFetch('/events/my-registrations');
      if (!res || !res.ok) return;
      const tickets = await res.json().catch(() => []);
      if (!tickets.length) {
        container.innerHTML = '<div style="font-size:12px; color:var(--text-secondary); font-style:italic; padding: 1rem 0;">No active registrations found. RSVP to an upcoming gathering to receive your pass.</div>';
        return;
      }
      container.innerHTML = tickets.map((t) => `
        <div class="ticket-item">
          <div>
            <div style="font-family:var(--font-heading); font-size:1.4rem; color:var(--text-primary);">${window.escapeHtml(t.event_name)}</div>
            <div style="font-size:10px; color:var(--text-secondary); margin-top:4px; letter-spacing: 1.5px; text-transform: uppercase;">Date: ${window.escapeHtml(t.event_date || 'TBD')}</div>
          </div>
          <div>
            <span class="badge badge-green">[ ACCREDITED ]</span>
          </div>
        </div>`).join('');
    } catch (e) {}
  }

  // RSVP LOGIC
  let currentRsvpEventId = null;
  window.openRsvpModal = function(eventId) {
    currentRsvpEventId = eventId;
    const input = document.getElementById('rsvpWhatsapp');
    if (input) input.value = '';
    const modal = document.getElementById('rsvpModal');
    if (modal) {
      modal.style.display = 'flex';
      input?.focus();
    }
  };

  window.closeRsvpModal = function() {
    const modal = document.getElementById('rsvpModal');
    if (modal) modal.style.display = 'none';
    currentRsvpEventId = null;
  };

  window.submitRsvp = async function() {
    const wa = (document.getElementById('rsvpWhatsapp')?.value || '').trim();
    if (!wa) {
      showToast('WhatsApp contact number is required.', 'error');
      return;
    }
    const btn = document.getElementById('confirmRsvpBtn');
    if (btn) {
      btn.textContent = 'Securing Spot...';
      btn.disabled = true;
    }
    try {
      const res = await window.globalApiFetch('/events/register', {
        method: 'POST',
        body: JSON.stringify({ event_id: currentRsvpEventId, whatsapp_number: wa })
      });
      if (res && res.ok) {
        window.closeRsvpModal();
        showToast('Accreditation confirmed. Spot secured.', 'success');
        loadActiveEvents();
        loadMyTickets();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.detail || data.error || 'Registration failed. Gathering may be full.', 'error');
      }
    } catch (e) {
      showToast('Network error while securing spot.', 'error');
    }
    if (btn) {
      btn.textContent = 'Secure Spot';
      btn.disabled = false;
    }
  };

  // COLLECTIVE AFFILIATION
  async function loadClubStatus() {
    try {
      const res = await window.globalApiFetch('/clubs/my-status');
      if (!res || !res.ok) return;
      const data = await res.json().catch(() => ({}));
      const viewStatus = document.getElementById('clubStatusView');
      const viewApply = document.getElementById('clubApplyView');

      if (data.status === 'NONE') {
        if (viewStatus) viewStatus.style.display = 'none';
        if (viewApply) viewApply.style.display = 'block';
      } else {
        if (viewApply) viewApply.style.display = 'none';
        if (viewStatus) viewStatus.style.display = 'block';

        const myClubName = document.getElementById('myClubName');
        const myClubBadge = document.getElementById('myClubBadge');
        const myClubNote = document.getElementById('myClubNote');

        if (myClubName) myClubName.textContent = data.club || '—';
        const bc = data.status === 'PENDING' ? 'badge-gold' : data.status === 'APPROVED' ? 'badge-green' : 'badge-red';
        if (myClubBadge) myClubBadge.innerHTML = `<span class="badge ${bc}">[ ${window.escapeHtml(data.status)} ]</span>`;
        if (data.admin_note && myClubNote) {
          myClubNote.textContent = `Curator's Note: "${data.admin_note}"`;
        } else if (myClubNote) {
          myClubNote.textContent = data.status === 'APPROVED' ? 'Full guild privileges granted.' : 'Awaiting curatorial cycle evaluation.';
        }
      }
    } catch (e) {}
  }

  window.submitClubApplication = async function() {
    const club = document.getElementById('clubSelect')?.value;
    const note = (document.getElementById('clubNote')?.value || '').trim();
    const btn = document.getElementById('clubSubmitBtn');
    const msg = document.getElementById('clubMsg');

    if (btn) {
      btn.textContent = 'Submitting Request...';
      btn.disabled = true;
    }
    try {
      const res = await window.globalApiFetch('/clubs/apply', {
        method: 'POST',
        body: JSON.stringify({ club_name: club, note: note })
      });
      if (res && res.ok) {
        if (msg) {
          msg.style.color = 'var(--accent-green-text)';
          msg.textContent = 'Circle request submitted to the Curatorial Guild.';
        }
        showToast('Application submitted to circle.', 'success');
        setTimeout(() => loadClubStatus(), 1500);
      } else {
        const data = await res.json().catch(() => ({}));
        if (msg) {
          msg.style.color = 'var(--accent-red-text)';
          msg.textContent = data.detail || 'Application failed.';
        }
        if (btn) {
          btn.textContent = 'Submit Circle Request';
          btn.disabled = false;
        }
      }
    } catch (e) {
      if (msg) {
        msg.style.color = 'var(--accent-red-text)';
        msg.textContent = 'Network error.';
      }
      if (btn) {
        btn.textContent = 'Submit Circle Request';
        btn.disabled = false;
      }
    }
  };

  // EXHIBITION ACCESSION & STEPPER
  function updateExhibitionStepper(status, registrationStatus) {
    const s1 = document.getElementById('step1');
    const s2 = document.getElementById('step2');
    const s3 = document.getElementById('step3');
    const s4 = document.getElementById('step4');

    [s1, s2, s3, s4].forEach((el) => {
      if (el) el.className = 'step-node';
    });

    if (status === 'NONE') {
      if (s1) s1.className = 'step-node active';
    } else if (status === 'PENDING') {
      if (s1) s1.className = 'step-node done';
      if (s2) s2.className = 'step-node active';
    } else if (status === 'REJECTED') {
      if (s1) s1.className = 'step-node done';
      if (s2) s2.className = 'step-node active';
    } else if (status === 'APPROVED') {
      if (s1) s1.className = 'step-node done';
      if (s2) s2.className = 'step-node done';
      if (registrationStatus === 'SUBMITTED' || registrationStatus === 'CONFIRMED') {
        if (s3) s3.className = 'step-node done';
        if (s4) s4.className = 'step-node done';
      } else {
        if (s3) s3.className = 'step-node active';
      }
    }
  }

  async function loadExhibitionStatus() {
    try {
      const [cfgRes, statusRes] = await Promise.all([
        window.globalApiFetch('/exhibitions/config'),
        window.globalApiFetch('/exhibitions/my-status')
      ]);

      if (!cfgRes || !statusRes) return;

      const cfg = await cfgRes.json().catch(() => ({}));
      const data = await statusRes.json().catch(() => ({}));

      const masterPanel = document.getElementById('exhibitionPanel');
      if (!masterPanel) return;

      if (!cfg.is_open && data.status === 'NONE') {
        masterPanel.style.display = 'none';
        return;
      }
      masterPanel.style.display = 'block';

      ['exhibApplyView', 'exhibPendingView', 'exhibRejectedView', 'exhibApprovedView', 'exhibFinalizedView'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });

      updateExhibitionStepper(data.status, data.registration_status);

      if (data.status === 'NONE') {
        document.getElementById('exhibApplyView').style.display = 'block';
      } else if (data.status === 'PENDING') {
        document.getElementById('exhibPendingView').style.display = 'block';
      } else if (data.status === 'REJECTED') {
        document.getElementById('exhibRejectedView').style.display = 'block';
        if (data.curator_note) {
          document.getElementById('exhibRejectedNote').textContent = `"Curator Note: ${data.curator_note}"`;
        }
      } else if (data.status === 'APPROVED' && (data.registration_status === 'SUBMITTED' || data.registration_status === 'CONFIRMED')) {
        document.getElementById('exhibFinalizedView').style.display = 'block';
      } else if (data.status === 'APPROVED') {
        document.getElementById('exhibApprovedView').style.display = 'block';
        if (data.curator_note) {
          document.getElementById('exhibApprovedNote').textContent = `"${data.curator_note}"`;
        }

        const tcLink = document.getElementById('btnTcLink');
        const paymentLink = document.getElementById('btnPaymentLink');
        const paymentDetails = document.getElementById('paymentDetails');

        if (tcLink) {
          const safeTnc = window.safeHttpUrl ? window.safeHttpUrl(cfg.tnc_pdf_url) : (cfg.tnc_pdf_url && (cfg.tnc_pdf_url.startsWith('http://') || cfg.tnc_pdf_url.startsWith('https://')) ? cfg.tnc_pdf_url : null);
          if (safeTnc) {
            tcLink.href = safeTnc;
            tcLink.target = '_blank';
            tcLink.rel = 'noopener noreferrer';
            tcLink.style.opacity = '1';
            tcLink.style.pointerEvents = 'auto';
          } else {
            tcLink.removeAttribute('href');
            tcLink.removeAttribute('target');
            tcLink.removeAttribute('rel');
            tcLink.style.opacity = '0.55';
            tcLink.style.pointerEvents = 'none';
          }
        }

        if (paymentLink) {
          const safeQr = window.safeHttpUrl ? window.safeHttpUrl(cfg.payment_qr_url) : (cfg.payment_qr_url && (cfg.payment_qr_url.startsWith('http://') || cfg.payment_qr_url.startsWith('https://')) ? cfg.payment_qr_url : null);
          if (safeQr) {
            paymentLink.href = safeQr;
            paymentLink.target = '_blank';
            paymentLink.rel = 'noopener noreferrer';
            paymentLink.style.opacity = '1';
            paymentLink.style.pointerEvents = 'auto';
          } else {
            paymentLink.removeAttribute('href');
            paymentLink.removeAttribute('target');
            paymentLink.removeAttribute('rel');
            paymentLink.style.opacity = '0.55';
            paymentLink.style.pointerEvents = 'none';
          }
        }

        if (paymentDetails) {
          const paymentLines = [];
          if (cfg.registration_fee) paymentLines.push(`Accession Fee: ${window.escapeHtml(cfg.registration_fee)}`);
          if (cfg.payment_instructions) paymentLines.push(window.escapeHtml(cfg.payment_instructions));
          paymentDetails.innerHTML = paymentLines.join(' &nbsp;|&nbsp; ');
          paymentDetails.style.display = paymentLines.length ? 'block' : 'none';
        }
      }

      if (window.refreshGlobalEffects) window.refreshGlobalEffects();
    } catch (e) {
      console.error('Exhibition load error:', e);
    }
  }

  document.getElementById('paymentProofForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tcChecked = document.getElementById('tcCheckbox')?.checked;
    if (!tcChecked) return;

    const fileInput = document.getElementById('paymentScreenshot');
    const btn = document.getElementById('finalizeExhibBtn');
    const msg = document.getElementById('finalizeMsg');

    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
      if (msg) {
        msg.style.color = 'var(--accent-red-text)';
        msg.textContent = 'Please select a screenshot of the payment receipt.';
      }
      return;
    }

    if (btn) {
      btn.textContent = 'Uploading to Vault...';
      btn.disabled = true;
    }
    if (msg) {
      msg.style.color = 'var(--text-secondary)';
      msg.textContent = 'Securing transaction proof in vault...';
    }

    try {
      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      formData.append('upload_preset', cloudinaryConfig.uploadPreset);

      const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/upload`, {
        method: 'POST',
        body: formData
      });
      const cloudData = await cloudRes.json();
      if (!cloudData.secure_url) throw new Error('Vault upload failed.');

      if (msg) msg.textContent = 'Updating accession status...';
      const res = await window.globalApiFetch('/exhibitions/finalize', {
        method: 'POST',
        body: JSON.stringify({ agreed_to_tnc: true, payment_proof_url: cloudData.secure_url })
      });

      if (res && res.ok) {
        if (msg) {
          msg.style.color = 'var(--accent-green-text)';
          msg.textContent = 'Accession Finalized!';
        }
        showToast('Registration complete.', 'success');
        setTimeout(() => loadExhibitionStatus(), 1500);
      } else {
        throw new Error('Server rejected the finalize request.');
      }
    } catch (err) {
      if (msg) {
        msg.style.color = 'var(--accent-red-text)';
        msg.textContent = err.message || 'Failed to finalize accession.';
      }
      if (btn) {
        btn.textContent = 'Finalize Accession';
        btn.disabled = false;
      }
    }
  });

  // CARD DROPDOWN ACCORDION
  window.toggleCard = function(cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;
    card.classList.toggle('collapsed');
  };

  // GUIDE TUTORIAL MODAL
  window.openGuideModal = function() {
    const m = document.getElementById('guideModal');
    if (m) m.style.display = 'flex';
  };

  window.closeGuideModal = function() {
    const m = document.getElementById('guideModal');
    if (m) m.style.display = 'none';
  };

  // ESCAPE KEY & BACKDROP CLICK HANDLERS
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.closeGuideModal();
      window.closeRsvpModal();
    }
  });

  document.getElementById('guideModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'guideModal') window.closeGuideModal();
  });

  document.getElementById('rsvpModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'rsvpModal') window.closeRsvpModal();
  });

  // INITIALIZATION PIPELINE
  loadProfile();
  loadActiveEvents();
  loadMyTickets();
  loadClubStatus();
  loadExhibitionStatus();
});
