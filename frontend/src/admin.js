// admin.js — Centralized Administration Logic & Operational Suite
document.addEventListener('DOMContentLoaded', () => {
  const userData = localStorage.getItem('alfaaz_user');
  const token = localStorage.getItem('alfaaz_token');

  if (!userData || !token) {
    window.location.href = 'login.html?redirect=admin.html';
    return;
  }

  let user;
  try {
    user = JSON.parse(userData);
  } catch (error) {
    localStorage.removeItem('alfaaz_user');
    window.location.href = 'login.html?redirect=admin.html';
    return;
  }

  if (!user || user.status !== 'ADMIN') {
    window.location.href = 'dashboard.html';
    return;
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.clear();
      window.location.href = 'login.html';
    });
  }

  // ==========================================
  // CURATOR DIALOG MODAL (Brutalist Replacements for confirm() & prompt())
  // ==========================================
  let activeDialogResolver = null;

  window.curatorDialogClose = function(result) {
    const modal = document.getElementById('curatorDialogModal');
    if (modal) modal.classList.remove('open');
    if (activeDialogResolver) {
      activeDialogResolver(result);
      activeDialogResolver = null;
    }
  };

  window.showCuratorConfirm = function(title, message, isDestructive = false) {
    return new Promise((resolve) => {
      activeDialogResolver = resolve;
      const modal = document.getElementById('curatorDialogModal');
      const titleEl = document.getElementById('dialogModalTitle');
      const msgEl = document.getElementById('dialogModalMessage');
      const inputGroup = document.getElementById('dialogModalInputGroup');
      const confirmBtn = document.getElementById('dialogModalConfirmBtn');

      if (!modal) {
        resolve(window.confirm(message));
        return;
      }

      titleEl.textContent = title;
      msgEl.textContent = message;
      inputGroup.style.display = 'none';

      confirmBtn.textContent = isDestructive ? 'Proceed / Delete' : 'Confirm';
      if (isDestructive) {
        confirmBtn.style.borderColor = 'var(--accent-red)';
        confirmBtn.style.color = 'var(--accent-red-text)';
        confirmBtn.classList.remove('gold');
      } else {
        confirmBtn.style.borderColor = '';
        confirmBtn.style.color = '';
        confirmBtn.classList.add('gold');
      }

      confirmBtn.onclick = () => window.curatorDialogClose(true);
      modal.classList.add('open');
    });
  };

  window.showCuratorPrompt = function(title, message, inputLabel = 'Curator Note', defaultValue = '') {
    return new Promise((resolve) => {
      activeDialogResolver = resolve;
      const modal = document.getElementById('curatorDialogModal');
      const titleEl = document.getElementById('dialogModalTitle');
      const msgEl = document.getElementById('dialogModalMessage');
      const inputGroup = document.getElementById('dialogModalInputGroup');
      const labelEl = document.getElementById('dialogModalInputLabel');
      const inputEl = document.getElementById('dialogModalInput');
      const confirmBtn = document.getElementById('dialogModalConfirmBtn');

      if (!modal) {
        resolve(window.prompt(message, defaultValue));
        return;
      }

      titleEl.textContent = title;
      msgEl.textContent = message;
      labelEl.textContent = inputLabel;
      inputEl.value = defaultValue;
      inputGroup.style.display = 'block';

      confirmBtn.textContent = 'Submit';
      confirmBtn.style.borderColor = '';
      confirmBtn.style.color = '';
      confirmBtn.classList.add('gold');

      confirmBtn.onclick = () => {
        window.curatorDialogClose(inputEl.value.trim());
      };

      inputEl.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          window.curatorDialogClose(inputEl.value.trim());
        }
      };

      modal.classList.add('open');
      setTimeout(() => inputEl.focus(), 50);
    });
  };

  // Esc key closes modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const curatorModal = document.getElementById('curatorDialogModal');
      if (curatorModal && curatorModal.classList.contains('open')) {
        window.curatorDialogClose(null);
      }
      const regModal = document.getElementById('regModal');
      if (regModal && regModal.classList.contains('open')) {
        window.closeModal();
      }
    }
  });

  // Safe Admin API Fetch Wrapper with 403 handling
  async function adminFetch(endpoint, options = {}) {
    try {
      const res = await window.globalApiFetch(endpoint, options);
      if (res && res.status === 403) {
        alert('Access denied: Administrative privileges required.');
        window.location.href = 'dashboard.html';
        return null;
      }
      return res;
    } catch (err) {
      console.error('[Admin API error]', err);
      throw err;
    }
  }

  // ==========================================
  // TAB NAVIGATION & CURATORIAL PULSE
  // ==========================================
  const tabLoaded = {};
  window.switchTab = function(name) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    
    const targetBtn = document.querySelector(`.tab-btn[data-tab="${name}"]`) || document.querySelector(`[onclick="switchTab('${name}')"]`);
    if (targetBtn) {
      targetBtn.classList.add('active');
      try {
        targetBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } catch (_) {}
    }
    
    const targetPanel = document.getElementById(`tab-${name}`);
    if (targetPanel) targetPanel.classList.add('active');

    const mobileSelect = document.getElementById('mobileTabSelect');
    if (mobileSelect && mobileSelect.value !== name) {
      mobileSelect.value = name;
    }
    
    if (!tabLoaded[name]) {
      tabLoaded[name] = true;
      loadTab(name);
    }
  };

  window.refreshCuratorialPulse = async function() {
    try {
      const res = await adminFetch('/admin/diagnostics/system');
      if (!res || !res.ok) {
        const cycleTitleEl = document.getElementById('pulseCycleTitle');
        if (cycleTitleEl) cycleTitleEl.textContent = 'Portal Offline';
        const healthEl = document.getElementById('pulseSystemHealth');
        if (healthEl) {
          healthEl.textContent = res ? `Error (${res.status})` : 'Offline';
          healthEl.style.color = 'var(--accent-red-text)';
        }
        return;
      }
      const data = await res.json();
      const m = data.entity_metrics || {};
      const b = data.bindings || {};

      // Pulse chips
      const cycleTitleEl = document.getElementById('pulseCycleTitle');
      if (cycleTitleEl) {
        if (m.active_cycle) {
          const ageLabel = m.active_cycle_over_18 === 0 ? 'All Ages' : '18+';
          cycleTitleEl.textContent = `${m.active_cycle} (${ageLabel})`;
        } else {
          cycleTitleEl.textContent = 'None (Portal Closed)';
        }
      }

      const pendingExhibsEl = document.getElementById('pulsePendingExhibs');
      if (pendingExhibsEl) {
        pendingExhibsEl.textContent = m.exhibition_apps_pending !== undefined ? m.exhibition_apps_pending : '0';
      }

      const pendingClubsEl = document.getElementById('pulsePendingClubs');
      if (pendingClubsEl) {
        pendingClubsEl.textContent = m.club_apps_pending !== undefined ? m.club_apps_pending : '0';
      }

      const healthEl = document.getElementById('pulseSystemHealth');
      if (healthEl) {
        if (b.d1_connected) {
          healthEl.textContent = `Operational (${b.d1_latency_ms || 0}ms)`;
          healthEl.style.color = 'var(--accent-green-text)';
        } else {
          healthEl.textContent = 'D1 Degraded';
          healthEl.style.color = 'var(--accent-red-text)';
        }
      }

      // Tab badges
      const setBadge = (id, count, hasPending = false) => {
        const el = document.getElementById(id);
        if (el) {
          el.textContent = count;
          if (hasPending) el.classList.add('pending');
          else el.classList.remove('pending');
        }
      };

      setBadge('count-events', m.events_total ?? 0);
      setBadge('count-exhibitions', m.exhibition_apps_total ?? 0, (m.exhibition_apps_pending || 0) > 0);
      setBadge('count-clubs', m.club_apps_total ?? 0, (m.club_apps_pending || 0) > 0);
      setBadge('count-roster', m.users_total ?? 0);
      setBadge('count-submissions', m.submissions_total ?? 0);
      setBadge('count-blogs', m.blogs_total ?? 0);
      setBadge('count-audit', m.audit_logs_total ?? 0);
      setBadge('count-diagnostics', b.d1_connected ? 'OK' : '!');
    } catch (e) {
      console.warn('Could not refresh curatorial pulse:', e);
      const cycleTitleEl = document.getElementById('pulseCycleTitle');
      if (cycleTitleEl && cycleTitleEl.textContent === 'Loading...') cycleTitleEl.textContent = 'Portal Offline';
      const healthEl = document.getElementById('pulseSystemHealth');
      if (healthEl && healthEl.textContent === 'Checking...') {
        healthEl.textContent = 'Network Disconnected';
        healthEl.style.color = 'var(--accent-red-text)';
      }
    }
  };

  function loadTab(name) {
    if (name === 'events') window.loadEvents();
    if (name === 'exhibitions') { window.loadExhibitionManager(); window.loadExhibitionsData('ALL'); }
    if (name === 'clubs') window.loadClubs('ALL');
    if (name === 'roster') window.loadRoster();
    if (name === 'submissions') window.loadSubmissions();
    if (name === 'blogs') window.loadAdminBlogs();
    if (name === 'audit') window.loadAuditLogs();
    if (name === 'diagnostics') window.checkSystemDiagnostics();
    if (name === 'recruitment') {
      if (typeof window.loadRecruitment === 'function') window.loadRecruitment();
      else window.location.href = 'research.html';
    }
  }

  // ==========================================
  // 1. EVENTS LOGIC
  // ==========================================
  let allEvents = [];
  window.loadEvents = async function() {
    const container = document.getElementById('eventsContainer');
    if (!container) return;
    try {
      const res = await adminFetch('/admin/events');
      if (!res || !res.ok) {
        container.innerHTML = '<div class="empty-state">Unable to load events archive.</div>';
        return;
      }
      allEvents = await res.json();
      if (!allEvents.length) {
        container.innerHTML = '<div class="empty-state">No events found.</div>';
        return;
      }
      container.innerHTML = '';
      allEvents.forEach(e => {
        const card = document.createElement('div');
        card.className = 'data-card event-card';
        const isOpen = Boolean(e.registration_open);
        const capLabel = e.capacity === 0 ? '∞' : `${e.registered}/${e.capacity}`;
        const safeName = window.escapeHtml(e.name);
        const safeDesc = window.escapeHtml(e.description || '—');
        const safeDate = window.escapeHtml(e.event_date || '—');

        card.innerHTML = `
          <div>
            <div class="data-label">Event</div>
            <div class="data-display">${safeName}</div>
            <div style="font-size:11px; color:var(--text-secondary); margin-top: 4px;">${safeDesc}</div>
          </div>
          <div>
            <div class="data-label">Date</div>
            <div class="data-display" style="font-size:12px;">${safeDate}</div>
          </div>
          <div>
            <div class="data-label">Registered</div>
            <div class="data-display">${capLabel}</div>
          </div>
          <div>
            <div class="data-label">Status</div>
            <span class="badge ${isOpen ? 'badge-open' : 'badge-closed'}">${isOpen ? 'Open' : 'Closed'}</span>
          </div>
          <div class="card-actions-row">
            <button class="action-btn ${isOpen ? '' : 'gold'}" style="padding: 0.6rem 0.9rem; font-size:10px; min-height:38px;" data-action="toggle-event" data-id="${e.id}">${isOpen ? 'Close RSVP' : 'Open RSVP'}</button>
            <button class="action-btn gold" style="padding: 0.6rem 0.9rem; font-size:10px; min-height:38px;" data-action="view-registrations" data-id="${e.id}">Registrations</button>
            <button class="action-btn" style="padding: 0.6rem 0.9rem; font-size:10px; min-height:38px; border-color:var(--accent-red); color:var(--accent-red-text);" data-action="delete-event" data-id="${e.id}" data-name="${safeName}">Delete</button>
          </div>
        `;
        container.appendChild(card);
      });

      if (!container.dataset.actionsBound) {
        container.dataset.actionsBound = '1';
        container.addEventListener('click', (ev) => {
          const btn = ev.target.closest('button[data-action]');
          if (!btn || !container.contains(btn)) return;
          const id = Number(btn.dataset.id);
          if (!Number.isFinite(id)) return;
          const action = btn.dataset.action;
          if (action === 'toggle-event') window.toggleEvent(id, btn);
          else if (action === 'view-registrations') window.viewRegistrations(id);
          else if (action === 'delete-event') window.deleteEvent(id, btn.dataset.name || 'this event', btn);
        });
      }

      if (window.refreshGlobalEffects) window.refreshGlobalEffects();
    } catch (e) {
      container.innerHTML = '<div class="empty-state">Error loading events.</div>';
    }
  };

  window.handleCreateEvent = async function() {
    const nameEl = document.getElementById('ev-name');
    const dateEl = document.getElementById('ev-date');
    const capEl = document.getElementById('ev-capacity');
    const descEl = document.getElementById('ev-desc');
    const msg = document.getElementById('ev-create-msg');
    const btn = document.getElementById('ev-create-btn');

    const name = nameEl?.value.trim() || '';
    const date = dateEl?.value.trim() || '';
    const capacity = parseInt(capEl?.value || '0', 10) || 0;
    const desc = descEl?.value.trim() || '';

    if (!name) {
      if (msg) {
        msg.textContent = 'Event name is required.';
        msg.style.color = 'var(--accent-red-text)';
      }
      return;
    }

    if (btn) btn.disabled = true;
    if (msg) {
      msg.textContent = 'Creating...';
      msg.style.color = 'var(--text-secondary)';
    }

    try {
      const res = await adminFetch('/admin/events/create', {
        method: 'POST',
        body: JSON.stringify({ name, description: desc, event_date: date, capacity })
      });
      if (res && res.ok) {
        if (msg) {
          msg.textContent = '✓ Event created.';
          msg.style.color = 'var(--accent-green-text)';
        }
        nameEl.value = '';
        dateEl.value = '';
        descEl.value = '';
        capEl.value = '0';
        window.loadEvents();
        if (typeof window.refreshCuratorialPulse === 'function') window.refreshCuratorialPulse();
      } else {
        const err = await res?.json().catch(() => ({}));
        if (msg) {
          msg.textContent = err.error || err.detail || 'Could not create the event.';
          msg.style.color = 'var(--accent-red-text)';
        }
      }
    } catch (err) {
      console.error('[Create event error]', err);
      if (msg) {
        msg.textContent = 'Could not reach the server. Please try again.';
        msg.style.color = 'var(--accent-red-text)';
      }
    } finally {
      if (btn) btn.disabled = false;
      setTimeout(() => { if (msg) msg.textContent = ''; }, 4000);
    }
  };

  window.toggleEvent = async function(id, btn) {
    const original = btn ? btn.textContent : '';
    if (btn) { btn.textContent = '...'; btn.disabled = true; }
    try {
      const res = await adminFetch(`/admin/events/${id}/toggle`, { method: 'PATCH' });
      if (res && res.ok) {
        window.loadEvents();
        if (typeof window.refreshCuratorialPulse === 'function') window.refreshCuratorialPulse();
        return;
      }
      const err = await res?.json().catch(() => ({}));
      alert(err.error || err.detail || 'Could not update registration status.');
    } catch (err) {
      console.error('[Toggle event error]', err);
      alert('Could not reach the server. Please try again.');
    } finally {
      if (btn) { btn.textContent = original; btn.disabled = false; }
    }
  };

  window.deleteEvent = async function(id, name, btn) {
    const confirmed = await window.showCuratorConfirm(
      'Delete Event',
      `Are you sure you want to permanently delete event "${name}"? Existing registrations will be removed.`,
      true
    );
    if (!confirmed) return;

    const original = btn ? btn.textContent : '';
    if (btn) { btn.textContent = '...'; btn.disabled = true; }
    try {
      const res = await adminFetch(`/admin/events/${id}`, { method: 'DELETE' });
      if (res && res.ok) {
        window.loadEvents();
        if (typeof window.refreshCuratorialPulse === 'function') window.refreshCuratorialPulse();
        return;
      }
      const err = await res?.json().catch(() => ({}));
      alert(err.error || err.detail || 'Could not delete the event.');
    } catch (err) {
      console.error('[Delete event error]', err);
      alert('Could not reach the server. Please try again.');
    } finally {
      if (btn) { btn.textContent = original; btn.disabled = false; }
    }
  };

  window.viewRegistrations = async function(id) {
    const event = allEvents.find(e => e.id === id) || { name: `Event #${id}` };
    document.getElementById('modalTitle').textContent = event.name;
    document.getElementById('modalBody').innerHTML = '<div class="empty-state">Loading registrations...</div>';
    document.getElementById('regModal').classList.add('open');

    try {
      const res = await adminFetch(`/admin/events/${id}/registrations`);
      if (!res || !res.ok) {
        document.getElementById('modalBody').innerHTML = '<div class="empty-state">Could not retrieve registrations.</div>';
        return;
      }
      const data = await res.json();
      const list = data.registrations || [];
      if (!list.length) {
        document.getElementById('modalBody').innerHTML = '<div class="empty-state">No RSVPs recorded for this event yet.</div>';
        return;
      }

      let html = `<div style="font-size:12px; margin-bottom:1.5rem; color:var(--accent-gold-text); font-weight:600; letter-spacing: 1px; text-transform: uppercase;">Total Registrations: ${list.length}</div>`;
      list.forEach((r, i) => {
        const safeEmail = window.escapeHtml(r.email);
        const emailLink = r.email ? `<a href="mailto:${safeEmail}" style="color:var(--text-primary); text-decoration:underline;">${safeEmail}</a>` : safeEmail;
        const cleanWa = (r.whatsapp && r.whatsapp !== '—') ? r.whatsapp.replace(/[^0-9+]/g, '') : '';
        const waLink = cleanWa
          ? `<a href="https://wa.me/${cleanWa.replace('+', '')}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-green-text); text-decoration:underline; font-weight:600;">WA: ${window.escapeHtml(r.whatsapp)} ↗</a>`
          : `<span style="color:var(--text-secondary);">${window.escapeHtml(r.whatsapp || 'No WA')}</span>`;
        const safeTime = r.registered_at ? new Date(r.registered_at).toLocaleString() : 'Date TBD';
        html += `
          <div style="padding:1rem 0; border-bottom:1px solid var(--grid-border); font-size:13px; display:flex; justify-content:space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
            <div>
              <span style="font-weight: 500;"><strong style="color: var(--accent-gold-text); margin-right: 8px;">${i+1}.</strong> ${emailLink}</span>
              <div style="font-size:10px; color:var(--text-secondary); margin-top:2px;">RSVP Timestamp: ${window.escapeHtml(safeTime)}</div>
            </div>
            <span style="color:var(--text-primary); font-size: 11px; background: var(--bg-primary); padding: 4px 10px; border-radius: 2px;">${waLink}</span>
          </div>`;
      });
      document.getElementById('modalBody').innerHTML = html;
    } catch (err) {
      document.getElementById('modalBody').innerHTML = '<div class="empty-state">Failed to load registration data.</div>';
    }
  };

  window.closeModal = function() {
    document.getElementById('regModal').classList.remove('open');
  };

  // ==========================================
  // 2. EXHIBITIONS LOGIC (FULL PIPELINE DOSSIER & AGE REQUIREMENT TOGGLE)
  // ==========================================
  let allExhibs = [];
  let activeCycleFilter = 'ALL';
  let currentCycleView = 'ALL';

  window.loadExhibitionManager = async function() {
    const res = await adminFetch('/admin/exhibitions/list');
    if (!res || !res.ok) return;

    const exhibitions = await res.json();
    const container = document.getElementById('exhibitionListContainer');
    const statusText = document.getElementById('portalLiveStatus');
    if (!container) return;
    container.innerHTML = '';

    if (!container.dataset.actionsBound) {
      container.dataset.actionsBound = '1';
      container.addEventListener('click', (ev) => {
        const btn = ev.target.closest('button[data-action]');
        if (!btn || !container.contains(btn)) return;
        const id = Number(btn.dataset.id);
        if (!Number.isFinite(id)) return;

        if (btn.dataset.action === 'activate-exhibition') {
          window.activateExhibition(id, btn.dataset.title || 'this exhibition');
        } else if (btn.dataset.action === 'toggle-age-req') {
          window.toggleExhibitionAge(id, btn);
        }
      });
    }

    const liveEx = exhibitions.find(e => e.is_active);
    if (liveEx) {
      const ageLabel = liveEx.require_over_18 ? '18+ Adult Cycle' : 'Youth / Open Cycle';
      if (statusText) statusText.innerHTML = `Currently Live: <strong style="color: var(--accent-green-text);">${window.escapeHtml(liveEx.title)}</strong> <span class="badge ${liveEx.require_over_18 ? 'badge-approved' : 'badge-pending'}" style="margin-left:8px; font-size:9px;">${ageLabel}</span>`;
    } else {
      if (statusText) statusText.innerHTML = `<strong style="color: var(--accent-red-text);">CLOSED</strong> (No active exhibition)`;
    }

    if (exhibitions.length === 0) {
      container.innerHTML = '<div style="font-size: 12px; color: var(--text-secondary);">No exhibitions created yet.</div>';
      return;
    }

    exhibitions.forEach(ex => {
      const card = document.createElement('div');
      card.style.cssText = `border: 1px solid ${ex.is_active ? 'var(--accent-gold)' : 'var(--grid-border)'}; padding: 1.5rem; background: ${ex.is_active ? 'var(--bg-primary)' : 'transparent'}; transition: all 0.3s;`;

      const statusBadge = ex.is_active
        ? `<span style="font-size: 9px; padding: 3px 8px; background: var(--accent-gold); color: #fff; letter-spacing: 1px; text-transform: uppercase;">Live Now</span>`
        : `<span style="font-size: 9px; padding: 3px 8px; border: 1px solid var(--grid-border); color: var(--text-secondary); letter-spacing: 1px; text-transform: uppercase;">Inactive</span>`;

      const ageBadge = ex.require_over_18
        ? `<span class="badge badge-approved" style="font-size:9px;">18+ Required</span>`
        : `<span class="badge badge-pending" style="font-size:9px;">Youth / Open Cycle</span>`;

      const safeTitle = window.escapeHtml(ex.title);
      const safeDateText = window.escapeHtml(ex.date_text);
      const actionBtn = ex.is_active
        ? `<button disabled style="font-family: var(--font-body); font-size: 10px; text-transform: uppercase; letter-spacing: 1px; padding: 0.5rem 1rem; background: transparent; border: 1px solid var(--grid-border); color: var(--text-secondary); cursor: not-allowed;">Currently Active</button>`
        : `<button data-action="activate-exhibition" data-id="${ex.id}" data-title="${safeTitle}" class="action-btn gold" style="padding: 0.5rem 1rem; font-size: 10px;">Set as Live</button>`;

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <div style="font-family: var(--font-heading); font-size: 1.3rem; color: var(--text-primary); margin-bottom: 0.2rem;">${safeTitle}</div>
            <div style="font-size: 11px; color: var(--text-secondary);">${safeDateText}</div>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            ${ageBadge}
            ${statusBadge}
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.8rem; margin-top: 1rem; border-top: 1px dashed var(--grid-border); padding-top: 0.8rem;">
          ${actionBtn}
          <button data-action="toggle-age-req" data-id="${ex.id}" class="action-btn" style="padding: 0.5rem 0.8rem; font-size: 9px;">${ex.require_over_18 ? 'Switch to Youth (Under 18)' : 'Switch to 18+ Only'}</button>
        </div>
      `;
      container.appendChild(card);
    });
  };

  window.toggleExhibitionAge = async function(id, btn) {
    const original = btn.textContent;
    btn.textContent = '...';
    btn.disabled = true;
    try {
      const res = await adminFetch(`/admin/exhibitions/${id}/toggle-age`, { method: 'PATCH' });
      if (res && res.ok) {
        await window.loadExhibitionManager();
      } else {
        alert('Could not toggle age requirement.');
      }
    } catch (err) {
      alert('Error updating exhibition.');
    } finally {
      btn.textContent = original;
      btn.disabled = false;
    }
  };

  window.createNewExhibition = async function() {
    const btn = document.getElementById('createExBtn');
    const msg = document.getElementById('createExMsg');

    const payload = {
      title: document.getElementById('newExTitle').value.trim(),
      date_text: document.getElementById('newExDate').value.trim(),
      venue: document.getElementById('newExVenue').value.trim(),
      about_text: document.getElementById('newExDesc').value.trim(),
      require_over_18: Number(document.getElementById('newExAgeReq').value) === 1,
      tnc_pdf_url: document.getElementById('newExTnc').value.trim(),
      registration_fee: document.getElementById('newExFee').value.trim(),
      payment_qr_url: document.getElementById('newExQr').value.trim(),
      payment_instructions: document.getElementById('newExPayInst').value.trim()
    };

    if (!payload.title || !payload.date_text || !payload.venue) {
      if (msg) {
        msg.textContent = "Title, Dates, and Venue are required.";
        msg.style.color = "var(--accent-red-text)";
      }
      return;
    }

    if (btn) { btn.textContent = "Creating..."; btn.disabled = true; }
    try {
      const res = await adminFetch('/admin/exhibitions/create', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res && res.ok) {
        if (msg) {
          msg.textContent = "✓ Exhibition Created!";
          msg.style.color = "var(--accent-green-text)";
        }
        document.querySelectorAll('#newExTitle, #newExDate, #newExVenue, #newExDesc, #newExTnc, #newExFee, #newExQr, #newExPayInst').forEach(el => el.value = '');
        await window.loadExhibitionManager();
        if (typeof window.refreshCuratorialPulse === 'function') window.refreshCuratorialPulse();
      } else {
        const err = await res?.json().catch(() => ({}));
        if (msg) {
          msg.textContent = err.error || err.detail || "Failed to create exhibition. Title may already exist.";
          msg.style.color = "var(--accent-red-text)";
        }
      }
    } catch (err) {
      if (msg) {
        msg.textContent = "Could not reach server. Please check your connection.";
        msg.style.color = "var(--accent-red-text)";
      }
    } finally {
      if (btn) { btn.textContent = "Create Exhibition"; btn.disabled = false; }
      setTimeout(() => { if (msg) msg.textContent = ''; }, 4500);
    }
  };

  window.activateExhibition = async function(id, title) {
    const confirmed = await window.showCuratorConfirm(
      'Activate Exhibition Cycle',
      `Set "${title}" as the active exhibition on the public submission portal? Any currently live cycle will be moved to archive.`
    );
    if (!confirmed) return;

    const res = await adminFetch(`/admin/exhibitions/${id}/activate`, { method: 'PATCH' });
    if (res && res.ok) {
      await window.loadExhibitionManager();
      await window.loadExhibitionsData('ALL');
      if (typeof window.refreshCuratorialPulse === 'function') window.refreshCuratorialPulse();
    } else {
      alert("Failed to activate exhibition.");
    }
  };

  window.deactivateAllExhibitions = async function() {
    const confirmed = await window.showCuratorConfirm(
      'Close Exhibition Portal',
      'Take the public exhibition portal offline? Artists will not be able to submit new portfolios until a cycle is set live.',
      true
    );
    if (!confirmed) return;

    const res = await adminFetch('/admin/exhibitions/deactivate-all', { method: 'PATCH' });
    if (res && res.ok) {
      await window.loadExhibitionManager();
      if (typeof window.refreshCuratorialPulse === 'function') window.refreshCuratorialPulse();
    } else {
      alert("Failed to close portal.");
    }
  };

  async function buildCycleSelector() {
    const res = await adminFetch('/admin/exhibitions/cycles');
    if (!res || !res.ok) return;
    const { cycles, current } = await res.json();
    const wrap = document.getElementById('cycleSelectWrap');
    if (!wrap) return;

    let opts = `<option value="">Active Now: ${window.escapeHtml(current || 'None')}</option>`;
    cycles.forEach(c => {
      if (c !== current) opts += `<option value="${window.escapeHtml(c)}">${window.escapeHtml(c)}</option>`;
    });
    opts += `<option value="ALL">— All Archive —</option>`;

    wrap.innerHTML = `
      <label style="font-size:10px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;margin-right:0.8rem;">Viewing Cycle:</label>
      <select id="cycleSelect" style="background:transparent;border:none;border-bottom:1px solid var(--grid-border);color:var(--text-primary);font-family:var(--font-body);font-size:12px;padding:0.4rem 0;outline:none;">
        ${opts}
      </select>`;

    const sel = document.getElementById('cycleSelect');
    if (sel) {
      sel.value = currentCycleView;
      sel.addEventListener('change', async (e) => {
        currentCycleView = e.target.value;
        const query = currentCycleView ? `?cycle=${encodeURIComponent(currentCycleView)}` : '';
        const r = await adminFetch(`/admin/exhibitions${query}`);
        if (r && r.ok) {
          allExhibs = await r.json();
          window.filterExhibitions('ALL');
        }
      });
    }
  }

  window.loadExhibitionsData = async function(f) {
    currentCycleView = 'ALL';
    const res = await adminFetch('/admin/exhibitions?cycle=ALL');
    if (!res || !res.ok) return;
    allExhibs = await res.json();
    await buildCycleSelector();
    window.renderExhibitions(f);
  };

  const hasPaymentSubmission = (a) => a.registration_status === 'SUBMITTED' || a.registration_status === 'CONFIRMED' || Boolean(a.payment_proof_url);
  const getExhibitionLabel = (a) => a.registration_status === 'CONFIRMED' ? 'CONFIRMED' : hasPaymentSubmission(a) ? 'PAYMENT SUBMITTED' : a.status;

  window.filterExhibitions = function(f) {
    activeCycleFilter = f;
    document.querySelectorAll('[id^="filt-"]').forEach(b => b.classList.remove('gold'));
    const target = document.getElementById(`filt-${f}`);
    if (target) target.classList.add('gold');
    window.renderExhibitions(f);
  };

  window.renderExhibitions = function(f) {
    const container = document.getElementById('exhibitionsContainer');
    if (!container) return;
    const apps = f === 'ALL'
      ? allExhibs
      : allExhibs.filter(a => f === 'FINALIZED' ? hasPaymentSubmission(a) : f === 'APPROVED' ? a.status === 'APPROVED' && !hasPaymentSubmission(a) : a.status === f);

    container.innerHTML = '';
    if (!apps.length) {
      container.innerHTML = '<div class="empty-state">No portfolios found.</div>';
      return;
    }

    apps.forEach(a => {
      const card = document.createElement('div');
      card.className = 'data-card exhib-card';
      const displayStatus = getExhibitionLabel(a);
      const badge = a.status === 'PENDING' ? 'badge-pending' : a.status === 'APPROVED' ? 'badge-approved' : 'badge-rejected';

      const safePortfolio = window.safeHttpUrl ? window.safeHttpUrl(a.portfolio_url) : null;
      let actionBtns = safePortfolio
        ? `<a href="${window.escapeHtml(safePortfolio)}" target="_blank" rel="noopener noreferrer" class="action-btn gold" style="padding:0.6rem 1rem; font-size:10px; min-height:40px; text-align:center;">View Portfolio Document ↗</a>`
        : `<span class="action-btn" style="padding:0.6rem 1rem; font-size:10px; min-height:40px; text-align:center; opacity:0.4; cursor:not-allowed;">No Portfolio Link</span>`;

      if (a.status === 'PENDING') {
        actionBtns += `
          <button class="action-btn" style="padding:0.6rem 1rem; font-size:10px; min-height:40px;" data-action="review-exhib" data-id="${Number(a.id)}" data-decision="APPROVED">Approve</button>
          <button class="action-btn" style="padding:0.6rem 1rem; font-size:10px; min-height:40px; border-color:var(--accent-red); color:var(--accent-red-text);" data-action="review-exhib" data-id="${Number(a.id)}" data-decision="REJECTED">Reject</button>`;
      } else if (a.status === 'REJECTED') {
        actionBtns += `<button class="action-btn" style="padding:0.6rem 1rem; font-size:10px; min-height:40px;" data-action="revert-exhib" data-id="${Number(a.id)}">Undo Rejection</button>`;
      }
      
      if (a.payment_proof_url) {
        const safePayment = window.safeHttpUrl ? window.safeHttpUrl(a.payment_proof_url) : null;
        if (safePayment) {
          actionBtns += `<a href="${window.escapeHtml(safePayment)}" target="_blank" rel="noopener noreferrer" class="action-btn" style="padding:0.6rem 1rem; font-size:10px; min-height:40px; border-color:var(--accent-green); color:var(--accent-green-text); text-align:center;">View Payment Receipt ↗</a>`;
        }
      }
      if (a.registration_status === 'SUBMITTED') {
        actionBtns += `<button class="action-btn gold" style="padding:0.6rem 1rem; font-size:10px; min-height:40px;" data-action="confirm-payment" data-id="${Number(a.id)}">Confirm Payment</button>`;
      }

      const cycleName = window.escapeHtml(a.exhibition_cycle ? a.exhibition_cycle : 'LEGACY ARCHIVE');
      const safeFullName = window.escapeHtml(a.full_name || 'Anonymous');
      const safeUserEmail = window.escapeHtml(a.user_email || '—');
      const emailHtml = a.user_email ? `<a href="mailto:${safeUserEmail}" style="color:var(--text-primary); text-decoration:underline;">${safeUserEmail}</a>` : '—';
      const safePhone = window.escapeHtml(a.whatsapp || 'No WhatsApp provided');
      const cleanPhone = a.whatsapp ? a.whatsapp.replace(/[^0-9+]/g, '') : '';
      const phoneHtml = cleanPhone
        ? `<a href="https://wa.me/${cleanPhone.replace('+', '')}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-green-text); text-decoration:underline;">${safePhone} ↗</a>`
        : safePhone;
      const safeAddress = window.escapeHtml(a.address || 'No address provided');
      const safeGenre = window.escapeHtml(a.genre || 'General Art');
      const safeMedium = window.escapeHtml(a.medium || 'Mixed Medium');
      const safeApplicantNote = window.escapeHtml(a.applicant_note || 'No statement provided by artist.');
      const safeCuratorNote = window.escapeHtml(a.curator_note || '—');
      const safeRegNote = window.escapeHtml(a.participant_note_reg || '—');
      const safeDate = a.created_at ? new Date(a.created_at).toLocaleString() : 'Date TBD';
      const ageCategory = a.over_19 ? '18+ Verified' : 'Youth / Under 18 Entry';

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem; border-bottom:1px solid var(--grid-border); padding-bottom:1rem;">
          <div>
            <div class="data-label">Exhibition Cycle: ${cycleName}</div>
            <div style="font-family:var(--font-heading); font-size:1.5rem; color:var(--text-primary); font-weight:400;">${safeFullName}</div>
            <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">Email: <strong>${emailHtml}</strong> · WhatsApp: <strong>${phoneHtml}</strong></div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.4rem;">
            <span class="badge ${badge}">${displayStatus}</span>
            <span style="font-size:10px; color:var(--text-secondary);">Applied: ${safeDate}</span>
          </div>
        </div>

        <div class="dossier-box">
          <div class="dossier-grid">
            <div>
              <div class="data-label">Physical Address</div>
              <div class="data-display" style="font-size:12px;">${safeAddress}</div>
            </div>
            <div>
              <div class="data-label">Age & Verification</div>
              <div class="data-display" style="font-size:12px;">Age: ${a.age || '—'} · <span class="badge ${a.over_19 ? 'badge-verified' : 'badge-pending'}">${ageCategory}</span></div>
            </div>
            <div>
              <div class="data-label">Art Form & Genre</div>
              <div class="data-display" style="font-size:12px;">${safeGenre}</div>
            </div>
            <div>
              <div class="data-label">Medium & Materials</div>
              <div class="data-display" style="font-size:12px;">${safeMedium}</div>
            </div>
          </div>

          <div class="dossier-notes-grid" style="margin-top: 1rem; border-top: 1px dashed var(--grid-border); padding-top: 0.8rem;">
            <div>
              <div class="data-label">Artist's Submission Note</div>
              <div style="font-size:12px; color:var(--text-secondary); line-height:1.5; font-style:italic;">"${safeApplicantNote}"</div>
            </div>
            <div>
              <div class="data-label">Curator Review / Registration Notes</div>
              <div style="font-size:12px; color:var(--accent-gold-text); line-height:1.5;">Review Note: "${safeCuratorNote}"</div>
              ${a.participant_note_reg ? `<div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">Payment Note: "${safeRegNote}"</div>` : ''}
            </div>
          </div>
        </div>

        <div class="card-actions-row">
          ${actionBtns}
        </div>
      `;
      container.appendChild(card);
    });

    if (!container.dataset.actionsBound) {
      container.dataset.actionsBound = '1';
      container.addEventListener('click', async (ev) => {
        const btn = ev.target.closest('button[data-action]');
        if (!btn || !container.contains(btn)) return;
        const id = Number(btn.dataset.id);
        const action = btn.dataset.action;
        if (!Number.isFinite(id)) return;

        if (action === 'review-exhib') {
          const decision = btn.dataset.decision || 'APPROVED';
          window.reviewExhibition(id, decision, btn);
        } else if (action === 'revert-exhib') {
          window.revertExhibition(id, btn);
        } else if (action === 'confirm-payment') {
          window.confirmExhibitionPayment(id, btn);
        }
      });
    }

    if (window.refreshGlobalEffects) window.refreshGlobalEffects();
  };

  window.reviewExhibition = async function(id, status, btn) {
    const isApproved = status === 'APPROVED';
    const note = await window.showCuratorPrompt(
      `${isApproved ? 'Approve' : 'Reject'} Portfolio`,
      `Add an optional curator note to the artist for this ${status} decision:`,
      'Curator Note to Artist'
    );
    if (note === null) return;

    if (btn) { btn.textContent = '...'; btn.disabled = true; }
    try {
      const res = await adminFetch('/admin/exhibitions/review', {
        method: 'POST',
        body: JSON.stringify({ application_id: id, status, curator_note: note || null })
      });
      if (res && res.ok) {
        await window.loadExhibitionsData('ALL');
        window.filterExhibitions(activeCycleFilter);
        if (typeof window.refreshCuratorialPulse === 'function') window.refreshCuratorialPulse();
      } else {
        const err = await res?.json().catch(() => ({}));
        alert(err.error || err.detail || 'Could not update portfolio status.');
      }
    } catch (err) {
      alert('Could not reach the server.');
    } finally {
      if (btn) { btn.textContent = status === 'APPROVED' ? 'Approve' : 'Reject'; btn.disabled = false; }
    }
  };

  window.revertExhibition = async function(id, btn) {
    const confirmed = await window.showCuratorConfirm(
      'Revert Portfolio Review',
      'Undo the previous rejection and return this portfolio to Pending review?'
    );
    if (!confirmed) return;

    if (btn) { btn.textContent = '...'; btn.disabled = true; }
    try {
      const res = await adminFetch(`/admin/exhibitions/${id}/revert`, { method: 'PATCH' });
      if (res && res.ok) {
        await window.loadExhibitionsData('ALL');
        window.filterExhibitions(activeCycleFilter);
        if (typeof window.refreshCuratorialPulse === 'function') window.refreshCuratorialPulse();
      } else {
        alert('Could not revert portfolio status.');
      }
    } catch (err) {
      alert('Could not reach server.');
    } finally {
      if (btn) { btn.textContent = 'Undo Rejection'; btn.disabled = false; }
    }
  };

  window.confirmExhibitionPayment = async function(id, btn) {
    const confirmed = await window.showCuratorConfirm(
      'Confirm Exhibition Payment',
      'Confirm registration fee payment? The artist will be marked as CONFIRMED.'
    );
    if (!confirmed) return;

    if (btn) { btn.textContent = '...'; btn.disabled = true; }
    try {
      const res = await adminFetch(`/admin/exhibitions/${id}/confirm-payment`, { method: 'PATCH' });
      if (res && res.ok) {
        await window.loadExhibitionsData('ALL');
        window.filterExhibitions('FINALIZED');
        if (typeof window.refreshCuratorialPulse === 'function') window.refreshCuratorialPulse();
      } else {
        alert('Could not confirm payment.');
      }
    } catch (err) {
      alert('Could not reach server.');
    } finally {
      if (btn) { btn.textContent = 'Confirm Payment'; btn.disabled = false; }
    }
  };

  // ==========================================
  // 3. CLUBS LOGIC (FULL INTENT STATEMENTS & CURATOR NOTES)
  // ==========================================
  let allClubApps = [];

  window.loadClubs = async function(f) {
    const res = await adminFetch('/admin/club-applications');
    if (!res || !res.ok) return;
    allClubApps = await res.json();
    window.renderClubs(f);
  };

  window.filterClubs = function(f) {
    document.querySelectorAll('[id^="filter-"]').forEach(b => {
      b.classList.remove('gold');
      b.style.color = '';
      b.style.borderColor = '';
    });
    const target = document.getElementById(`filter-${f}`);
    if (target) target.classList.add('gold');
    window.renderClubs(f);
  };

  window.renderClubs = function(f) {
    const container = document.getElementById('clubsContainer');
    if (!container) return;
    const apps = f === 'ALL' ? allClubApps : allClubApps.filter(a => a.status === f);
    container.innerHTML = '';
    if (!apps.length) {
      container.innerHTML = '<div class="empty-state">No applications found.</div>';
      return;
    }

    apps.forEach(a => {
      const card = document.createElement('div');
      card.className = 'data-card club-card';
      const badge = a.status === 'PENDING' ? 'badge-pending' : a.status === 'APPROVED' ? 'badge-approved' : 'badge-rejected';
      const safeEmail = window.escapeHtml(a.user_email || '—');
      const emailHtml = a.user_email ? `<a href="mailto:${safeEmail}" style="color:var(--text-primary); text-decoration:underline;">${safeEmail}</a>` : '—';
      const safeClub = window.escapeHtml(a.club_name);
      const safeNote = window.escapeHtml(a.note || 'No statement provided by applicant.');
      const safeAdminNote = window.escapeHtml(a.admin_note || '');
      const safeDate = a.created_at ? new Date(a.created_at).toLocaleString() : 'Date TBD';

      card.innerHTML = `
        <div>
          <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:0.5rem; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <div class="data-label">Circle / Club: ${safeClub}</div>
              <div class="data-display" style="font-weight:600;">${emailHtml}</div>
            </div>
            <div style="font-size:10px; color:var(--text-secondary);">Applied: ${safeDate}</div>
          </div>
          <div style="background:var(--bg-primary); border:1px solid var(--grid-border); padding:0.8rem 1rem; margin-top:0.6rem; font-size:12px; line-height:1.5;">
            <div class="data-label" style="margin-bottom:0.2rem;">Applicant Statement of Interest:</div>
            <div style="color:var(--text-secondary); font-style:italic;">"${safeNote}"</div>
            ${safeAdminNote ? `<div style="margin-top:0.5rem; color:var(--accent-gold-text); font-size:11px;">Curator Note: "${safeAdminNote}"</div>` : ''}
          </div>
        </div>
        <div>
          <div class="data-label">Review Status</div>
          <span class="badge ${badge}">${a.status}</span>
        </div>
        <div class="card-actions-row">
          ${a.status === 'PENDING' ? `
            <button class="action-btn" style="padding:0.6rem 1rem; font-size:10px; min-height:40px;" data-action="review-club" data-id="${a.id}" data-decision="APPROVED">Approve</button>
            <button class="action-btn" style="padding:0.6rem 1rem; font-size:10px; min-height:40px; border-color:var(--accent-red); color:var(--accent-red-text);" data-action="review-club" data-id="${a.id}" data-decision="REJECTED">Reject</button>
          ` : ''}
          ${a.status === 'REJECTED' ? `<button class="action-btn" style="padding:0.6rem 1rem; font-size:10px; min-height:40px;" data-action="revert-club" data-id="${a.id}">Undo Rejection</button>` : ''}
        </div>
      `;
      container.appendChild(card);
    });

    if (!container.dataset.actionsBound) {
      container.dataset.actionsBound = '1';
      container.addEventListener('click', (ev) => {
        const btn = ev.target.closest('button[data-action]');
        if (!btn || !container.contains(btn)) return;
        const id = Number(btn.dataset.id);
        const action = btn.dataset.action;
        if (!Number.isFinite(id)) return;

        if (action === 'review-club') {
          const decision = btn.dataset.decision || 'APPROVED';
          window.reviewClub(id, decision, btn);
        } else if (action === 'revert-club') {
          window.revertClub(id, btn);
        }
      });
    }

    if (window.refreshGlobalEffects) window.refreshGlobalEffects();
  };

  window.reviewClub = async function(id, status, btn) {
    let note = null;
    if (status === 'REJECTED') {
      note = await window.showCuratorPrompt('Reject Application', 'Provide an optional reason or curator note:', 'Curator Note');
      if (note === null) return;
    }

    if (btn) { btn.textContent = '...'; btn.disabled = true; }
    try {
      const res = await adminFetch('/admin/club-applications/review', {
        method: 'POST',
        body: JSON.stringify({ application_id: id, status, admin_note: note })
      });
      if (res && res.ok) {
        window.loadClubs('ALL');
        if (typeof window.refreshCuratorialPulse === 'function') window.refreshCuratorialPulse();
      } else {
        alert('Failed to update club application.');
      }
    } catch (err) {
      alert('Could not reach server.');
    } finally {
      if (btn) { btn.textContent = status === 'APPROVED' ? 'Approve' : 'Reject'; btn.disabled = false; }
    }
  };

  window.revertClub = async function(id, btn) {
    const confirmed = await window.showCuratorConfirm(
      'Undo Rejection',
      'Revert this club application back to Pending status?'
    );
    if (!confirmed) return;

    if (btn) { btn.textContent = '...'; btn.disabled = true; }
    try {
      const res = await adminFetch(`/admin/club-applications/${id}/revert`, { method: 'PATCH' });
      if (res && res.ok) {
        window.loadClubs('ALL');
        window.filterClubs('ALL');
        if (typeof window.refreshCuratorialPulse === 'function') window.refreshCuratorialPulse();
      } else {
        alert('Could not undo rejection.');
      }
    } catch (err) {
      alert('Could not reach server.');
    } finally {
      if (btn) { btn.textContent = 'Undo'; btn.disabled = false; }
    }
  };

  // ==========================================
  // 4. ROSTER LOGIC & PARTICIPANT TRACKER
  // ==========================================
  let allRosterUsers = [];
  let rosterFilterTimeout = null;

  window.toggleActivityDrawer = function(index) {
    const drawer = document.getElementById('drawer-' + index);
    const btn = document.getElementById('drawer-btn-' + index);
    if (!drawer) return;
    const isOpen = drawer.classList.contains('open');
    if (isOpen) {
      drawer.classList.remove('open');
      if (btn) btn.textContent = btn.getAttribute('data-closed-text') || 'Participant Journey ▾';
    } else {
      drawer.classList.add('open');
      if (btn) btn.textContent = btn.getAttribute('data-open-text') || 'Participant Journey ▴';
    }
  };

  window.loadRoster = async function() {
    const container = document.getElementById('rosterContainer');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">Loading participant roster...</div>';
    try {
      const res = await adminFetch('/admin/users');
      if (!res || !res.ok) {
        container.innerHTML = '<div class="empty-state">Unable to load roster records.</div>';
        return;
      }
      allRosterUsers = await res.json();
      window.filterRoster();
    } catch (e) {
      container.innerHTML = `<div class="empty-state">Error loading roster: ${window.escapeHtml(e.message)}</div>`;
    }
  };

  window.filterRoster = function() {
    clearTimeout(rosterFilterTimeout);
    rosterFilterTimeout = setTimeout(() => {
      const searchInput = document.getElementById('rosterSearchInput');
      const actFilter = document.getElementById('rosterActivityFilter');
      const roleFilter = document.getElementById('rosterRoleFilter');
      const countBadge = document.getElementById('rosterCountBadge');

      const query = (searchInput?.value || '').toLowerCase().trim();
      const act = actFilter?.value || 'ALL';
      const role = roleFilter?.value || 'ALL';

      const filtered = allRosterUsers.filter(u => {
        if (role !== 'ALL' && u.status !== role) return false;
        if (act === 'WITH_EXHIBITIONS' && (!u.exhibitions || u.exhibitions.length === 0)) return false;
        if (act === 'WITH_CLUBS' && (!u.clubs || u.clubs.length === 0)) return false;
        if (act === 'WITH_EVENTS' && (!u.events || u.events.length === 0)) return false;
        if (act === 'WITH_SUBMISSIONS' && (!u.submissions || u.submissions.length === 0)) return false;
        if (act === 'VERIFIED_ONLY' && !(u.email_verified || u.phone_verified)) return false;

        if (query) {
          const nameMatch = (u.full_name || '').toLowerCase().includes(query);
          const emailMatch = (u.email || '').toLowerCase().includes(query);
          const phoneMatch = (u.phone || '').toLowerCase().includes(query);
          const provMatch = (u.auth_provider || '').toLowerCase().includes(query);
          return nameMatch || emailMatch || phoneMatch || provMatch;
        }
        return true;
      });

      if (countBadge) {
        countBadge.textContent = `Showing ${filtered.length} of ${allRosterUsers.length} Participants`;
      }
      window.renderRoster(filtered);
    }, 150);
  };

  window.renderRoster = function(users) {
    const container = document.getElementById('rosterContainer');
    if (!container) return;
    container.innerHTML = '';

    if (!users.length) {
      container.innerHTML = '<div class="empty-state">No matching participants found in collective roster.</div>';
      return;
    }

    users.forEach((u, i) => {
      const card = document.createElement('div');
      card.className = 'roster-card';
      const safeEmail = window.escapeHtml(u.email || '-');
      const emailHtml = u.email ? `<a href="mailto:${safeEmail}" style="color:var(--text-primary); text-decoration:underline;">${safeEmail}</a>` : '-';
      const safePhone = window.escapeHtml(u.phone || 'No Phone');
      const cleanRosterPhone = u.phone ? u.phone.replace(/[^0-9+]/g, '') : '';
      const phoneHtml = cleanRosterPhone
        ? `<a href="tel:${cleanRosterPhone}" style="color:var(--text-secondary); text-decoration:underline;">${safePhone}</a>`
        : safePhone;
      const safeName = window.escapeHtml(u.full_name || 'Member');
      const safeProvider = window.escapeHtml(u.auth_provider || 'email');
      const isSelf = user && u.email === user.email;

      const emailBadge = u.email_verified
        ? '<span class="badge badge-verified">✓ Email</span>'
        : '<span class="badge badge-unverified">Email Pending</span>';

      const phoneBadge = u.phone_verified
        ? '<span class="badge badge-verified">✓ WhatsApp</span>'
        : (u.phone ? '<span class="badge badge-unverified">WhatsApp Pending</span>' : '<span class="badge badge-closed">No Phone</span>');

      const deleteBtn = (isSelf || u.status === 'ADMIN') ? '' : `
        <button class="action-btn" style="border-color: var(--accent-red); color: var(--accent-red-text); padding:0.6rem 0.8rem; font-size:10px; min-height:38px;" data-action="delete-user" data-email="${safeEmail}">Purge</button>
      `;

      let timelineHtml = '<div class="activity-empty">No participant steps recorded yet.</div>';
      if (u.timeline && u.timeline.length) {
        timelineHtml = u.timeline.map((step) => {
          const safeTitle = window.escapeHtml(step.title);
          const safeDetails = window.escapeHtml(step.details || '');
          const safeTime = step.timestamp ? new Date(step.timestamp).toLocaleString(undefined, {
            month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
          }) : 'Date TBD';
          const safeStepLink = window.safeHttpUrl ? window.safeHttpUrl(step.link) : null;
          const linkBtn = safeStepLink
            ? `<a href="${window.escapeHtml(safeStepLink)}" target="_blank" rel="noopener noreferrer" class="action-btn gold" style="padding:2px 8px; font-size:9px; text-decoration:none;">View ↗</a>`
            : '';
          const badgeClass = step.status === 'CONFIRMED' || step.status === 'VERIFIED' || step.status === 'APPROVED' || step.status === 'ACCEPTED'
            ? 'badge-approved'
            : (step.status === 'REJECTED' ? 'badge-rejected' : 'badge-pending');
          return `
            <div class="timeline-step cat-${window.escapeHtml(step.category || 'AUTH')}">
              <div class="timeline-time">${safeTime}</div>
              <div class="timeline-content">
                <div class="timeline-heading">${safeTitle}</div>
                <div class="timeline-desc">${safeDetails}</div>
              </div>
              <div style="display:flex; gap:0.4rem; align-items:center;">
                <span class="badge ${badgeClass}">${window.escapeHtml(step.status)}</span>
                ${linkBtn}
              </div>
            </div>
          `;
        }).join('');
      }

      let clubsHtml = '<div class="activity-empty">No club applications on record.</div>';
      if (u.clubs && u.clubs.length) {
        clubsHtml = u.clubs.map(c => `
          <div class="activity-item">
            <div style="font-weight: 500;">${window.escapeHtml(c.club_name)}</div>
            ${c.note ? `<div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">"${window.escapeHtml(c.note)}"</div>` : ''}
            ${c.admin_note ? `<div style="font-size:10px; color:var(--accent-gold-text); margin-top:2px;">Curator: "${window.escapeHtml(c.admin_note)}"</div>` : ''}
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
              <span class="badge badge-${(c.status || '').toLowerCase()}">${window.escapeHtml(c.status)}</span>
              <span style="font-size:10px; color:var(--text-secondary);">${window.escapeHtml(c.created_at ? c.created_at.slice(0, 10) : '')}</span>
            </div>
          </div>
        `).join('');
      }

      let eventsHtml = '<div class="activity-empty">No event registrations on record.</div>';
      if (u.events && u.events.length) {
        eventsHtml = u.events.map(e => `
          <div class="activity-item">
            <div style="font-weight: 500;">${window.escapeHtml(e.event_name)}</div>
            <div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">Date: ${window.escapeHtml(e.event_date || 'TBD')}</div>
            ${e.whatsapp_number ? `<div style="font-size:10px; color:var(--text-secondary);">WA: ${window.escapeHtml(e.whatsapp_number)}</div>` : ''}
            <div style="font-size:10px; color:var(--text-secondary); margin-top:2px;">RSVP: ${window.escapeHtml(e.created_at ? e.created_at.slice(0, 10) : '')}</div>
          </div>
        `).join('');
      }

      let exhibitionsHtml = '<div class="activity-empty">No exhibition cycles on record.</div>';
      if (u.exhibitions && u.exhibitions.length) {
        exhibitionsHtml = u.exhibitions.map(x => {
          const safePort = window.safeHttpUrl ? window.safeHttpUrl(x.portfolio_url) : null;
          const portfolioBtn = safePort ? `<a href="${window.escapeHtml(safePort)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-gold); font-size:10px; text-decoration:underline;">Portfolio ↗</a>` : '';
          return `
            <div class="activity-item">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="font-weight: 500;">${window.escapeHtml(x.exhibition_cycle || 'Cycle')}</div>
                ${portfolioBtn}
              </div>
              <div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">Genre: ${window.escapeHtml(x.genre || '—')} · ${window.escapeHtml(x.medium || '—')}</div>
              ${x.curator_note ? `<div style="font-size:10px; color:var(--accent-gold-text); margin-top:2px;">Review: "${window.escapeHtml(x.curator_note)}"</div>` : ''}
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                <span class="badge badge-${(x.status || '').toLowerCase()}">Review: ${window.escapeHtml(x.status)}</span>
                <span style="font-size:10px; color:var(--text-secondary);">Reg: ${window.escapeHtml(x.registration_status || 'NONE')}</span>
              </div>
            </div>
          `;
        }).join('');
      }

      let feesHtml = '<div class="activity-empty">No exhibition fee records.</div>';
      if (u.fees && u.fees.length) {
        feesHtml = u.fees.map(f => {
          const safeProof = window.safeHttpUrl ? window.safeHttpUrl(f.payment_proof_url) : null;
          const proofLink = safeProof ? `<a href="${window.escapeHtml(safeProof)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-gold); text-decoration:underline; font-size:11px;">Proof ↗</a>` : '<span style="color:var(--text-secondary); font-size:11px;">No Proof</span>';
          return `
            <div class="activity-item">
              <div style="display:flex; justify-content:space-between;">
                <span style="font-weight:500;">${window.escapeHtml(f.exhibition_cycle)}</span>
                <span style="font-size:11px;">${window.escapeHtml(f.registration_fee)}</span>
              </div>
              ${f.participant_note_reg ? `<div style="font-size:10px; color:var(--text-secondary); margin-top:2px;">Note: "${window.escapeHtml(f.participant_note_reg)}"</div>` : ''}
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                <span class="badge ${f.registration_status === 'CONFIRMED' ? 'badge-approved' : 'badge-pending'}">${window.escapeHtml(f.registration_status)}</span>
                ${proofLink}
              </div>
            </div>
          `;
        }).join('');
      }

      let submissionsHtml = '<div class="activity-empty">No submissions uploaded.</div>';
      if (u.submissions && u.submissions.length) {
        submissionsHtml = u.submissions.map(s => {
          const safeSubUrl = window.safeHttpUrl ? window.safeHttpUrl(s.file_url) : null;
          const fileLink = safeSubUrl ? `<a href="${window.escapeHtml(safeSubUrl)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-gold); text-decoration:underline; font-size:11px;">File ↗</a>` : '';
          return `
            <div class="activity-item">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="font-weight: 500;">${window.escapeHtml(s.title || 'Untitled')}</div>
                ${fileLink}
              </div>
              <div style="font-size:10px; color:var(--text-secondary); margin-top:2px;">Type: <span class="badge badge-closed">${window.escapeHtml(s.submission_type || 'work')}</span></div>
              ${s.note ? `<div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">"${window.escapeHtml(s.note)}"</div>` : ''}
              <div style="font-size:10px; color:var(--text-secondary); margin-top:4px;">Uploaded: ${window.escapeHtml(s.created_at ? s.created_at.slice(0, 10) : '')}</div>
            </div>
          `;
        }).join('');
      }

      const totalSteps = u.stats?.total_steps || (u.timeline ? u.timeline.length : 0);
      const closedBtnText = `Participant Journey (${totalSteps} Steps) ▾`;
      const openBtnText = `Participant Journey (${totalSteps} Steps) ▴`;

      card.innerHTML = `
        <div class="roster-header">
          <div>
            <div class="data-label">${safeName}</div>
            <div class="data-display" style="font-size: 13px;">${emailHtml}</div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Phone: ${phoneHtml}</div>
            <div style="display: flex; gap: 0.4rem; margin-top: 0.5rem; flex-wrap: wrap;">
              ${emailBadge}
              ${phoneBadge}
              <span class="badge badge-closed">${safeProvider}</span>
            </div>
            <div style="display: flex; gap: 0.4rem; margin-top: 0.6rem; flex-wrap: wrap;">
              <span class="stat-pill"><strong>${totalSteps}</strong> Steps</span>
              <span class="stat-pill"><strong>${u.events?.length || 0}</strong> Events</span>
              <span class="stat-pill"><strong>${u.clubs?.length || 0}</strong> Circles</span>
              <span class="stat-pill"><strong>${u.exhibitions?.length || 0}</strong> Exhibitions</span>
              <span class="stat-pill"><strong>${u.submissions?.length || 0}</strong> Submissions</span>
            </div>
          </div>
          <div>
            <div class="data-label">Role</div>
            <select id="st-${i}" style="margin:0; font-size:12px;">
              <option value="PARTICIPANT" ${u.status === 'PARTICIPANT' ? 'selected' : ''}>Participant</option>
              <option value="ADMIN" ${u.status === 'ADMIN' ? 'selected' : ''}>Admin</option>
            </select>
          </div>
          <div style="display:flex; flex-direction:column; gap:0.5rem; align-items:stretch;">
            <div style="display:flex; gap:0.5rem; align-items:center;">
              <button class="action-btn gold" style="padding:0.6rem 0.8rem; font-size:10px; min-height:38px; flex:1;" data-action="save-role" data-email="${safeEmail}" data-index="${i}">Save Role</button>
              ${deleteBtn}
            </div>
            <button class="activity-toggle-btn" id="drawer-btn-${i}" data-closed-text="${closedBtnText}" data-open-text="${openBtnText}" onclick="toggleActivityDrawer(${i})">${closedBtnText}</button>
          </div>
        </div>
        <div class="activity-drawer" id="drawer-${i}">
          <div class="timeline-wrap">
            <div class="timeline-title">
              <span>Participant Lifecycle & Provenance Timeline</span>
              <span style="font-size: 10px; color: var(--text-secondary);">${totalSteps} Chronological Steps Recorded</span>
            </div>
            <div class="timeline-list">
              ${timelineHtml}
            </div>
          </div>

          <div class="activity-grid">
            <div>
              <div class="activity-col-title">Circles & Clubs (${u.clubs?.length || 0})</div>
              ${clubsHtml}
            </div>
            <div>
              <div class="activity-col-title">Event RSVPs (${u.events?.length || 0})</div>
              ${eventsHtml}
            </div>
            <div>
              <div class="activity-col-title">Exhibitions (${u.exhibitions?.length || 0})</div>
              ${exhibitionsHtml}
            </div>
            <div>
              <div class="activity-col-title">Fee Ledger (${u.fees?.length || 0})</div>
              ${feesHtml}
            </div>
            <div>
              <div class="activity-col-title">Submissions (${u.submissions?.length || 0})</div>
              ${submissionsHtml}
            </div>
          </div>
        </div>
      `;
      container.appendChild(card);
    });

    if (!container.dataset.actionsBound) {
      container.dataset.actionsBound = '1';
      container.addEventListener('click', (ev) => {
        const btn = ev.target.closest('button[data-action]');
        if (!btn || !container.contains(btn)) return;
        const action = btn.dataset.action;
        const email = btn.dataset.email;
        if (!email) return;

        if (action === 'save-role') {
          const idx = Number(btn.dataset.index);
          window.updateStatus(email, idx, btn);
        } else if (action === 'delete-user') {
          window.deleteUser(email, btn);
        }
      });
    }

    if (window.refreshGlobalEffects) window.refreshGlobalEffects();
  };

  window.deleteUser = async function(email, btn) {
    const confirmed = await window.showCuratorConfirm(
      'Purge Participant Account',
      `Permanently delete user "${email}"? This will cascade-purge all their registrations, submissions, and club applications. This cannot be undone.`,
      true
    );
    if (!confirmed) return;

    if (btn) { btn.textContent = '...'; btn.disabled = true; }
    try {
      const res = await adminFetch(`/admin/users/${encodeURIComponent(email)}`, { method: 'DELETE' });
      if (res && res.ok) {
        window.loadRoster();
        if (typeof window.refreshCuratorialPulse === 'function') window.refreshCuratorialPulse();
      } else {
        const err = await res?.json().catch(() => ({}));
        alert(err.error || err.detail || 'Failed to delete user.');
      }
    } catch (e) {
      alert('Error purging user: ' + e.message);
    } finally {
      if (btn) { btn.textContent = 'Purge'; btn.disabled = false; }
    }
  };

  window.updateStatus = async function(email, i, btn) {
    const statusSelect = document.getElementById(`st-${i}`);
    const status = statusSelect?.value || 'PARTICIPANT';

    if (btn) { btn.textContent = '...'; btn.disabled = true; }
    try {
      const res = await adminFetch('/admin/update_status', {
        method: 'POST',
        body: JSON.stringify({ email, status })
      });
      if (res && res.ok) {
        if (email === user.email && status === 'PARTICIPANT') {
          localStorage.clear();
          window.location.href = 'login.html';
          return;
        }
        if (btn) btn.textContent = '✓ Saved';
        setTimeout(() => { if (btn) btn.textContent = 'Save Role'; }, 2000);
      } else {
        const err = await res?.json().catch(() => ({}));
        alert(err.error || err.detail || 'Could not update user role.');
        if (btn) btn.textContent = 'Save Role';
      }
    } catch (err) {
      alert('Could not reach server.');
      if (btn) btn.textContent = 'Save Role';
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  // ==========================================
  // 5. STORAGE VAULT SUBMISSIONS
  // ==========================================
  window.loadSubmissions = async function() {
    const container = document.getElementById('submissionsContainer');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">Loading submissions...</div>';
    try {
      const res = await adminFetch('/admin/submissions');
      if (!res || !res.ok) {
        container.innerHTML = '<div class="empty-state">Unable to load submissions.</div>';
        return;
      }
      const subs = await res.json();
      if (!subs || !subs.length) {
        container.innerHTML = '<div class="empty-state">No submissions found.</div>';
        return;
      }
      container.innerHTML = '';
      subs.forEach(s => {
        const card = document.createElement('div');
        card.className = 'data-card exhib-card';
        const safeTitle = window.escapeHtml(s.title || 'Untitled');
        const safeType = window.escapeHtml(s.submission_type || 'Work');
        const safeAuthor = window.escapeHtml(s.author_email || 'Anonymous');
        const authorHtml = s.author_email ? `<a href="mailto:${safeAuthor}" style="color:var(--text-primary); text-decoration:underline;">${safeAuthor}</a>` : safeAuthor;
        const safeNote = window.escapeHtml(s.note || '');
        const safeDate = s.created_at ? new Date(s.created_at).toLocaleDateString() : '';
        const safeUrl = window.safeHttpUrl ? window.safeHttpUrl(s.file_url) : null;
        const linkHtml = safeUrl
          ? `<a href="${window.escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" class="action-btn gold" style="padding:0.6rem 1.2rem; font-size:10px; min-height:40px; text-decoration:none; display:inline-flex; align-items:center; justify-content:center;">View / Download File ↗</a>`
          : `<span style="font-size:11px; color:var(--text-secondary);">(No valid URL)</span>`;

        card.innerHTML = `
          <div>
            <div class="data-label">${safeType} · ${safeDate}</div>
            <div class="data-display" style="font-weight:600; font-size:15px; margin-bottom:0.3rem;">${safeTitle}</div>
            <div style="font-size:11px; color:var(--text-secondary);">Author: ${authorHtml}</div>
          </div>
          <div>
            <div class="data-label">Author Note</div>
            <div style="font-size:12px; color:var(--text-secondary); max-height:80px; overflow-y:auto;">${safeNote || '—'}</div>
          </div>
          <div class="card-actions-row">
            ${linkHtml}
          </div>
        `;
        container.appendChild(card);
      });
      if (window.refreshGlobalEffects) window.refreshGlobalEffects();
    } catch (e) {
      container.innerHTML = `<div class="empty-state">Error loading submissions: ${window.escapeHtml(e.message)}</div>`;
    }
  };

  // ==========================================
  // 6. BLOGS / CURATED JOURNAL PIPELINE
  // ==========================================
  let allBlogs = [];
  window.loadAdminBlogs = async function() {
    const container = document.getElementById('blogsContainer');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">Loading articles...</div>';
    try {
      const res = await adminFetch('/admin/blogs');
      if (!res || !res.ok) {
        container.innerHTML = '<div class="empty-state">Unable to load articles archive.</div>';
        return;
      }
      allBlogs = await res.json();
      if (!allBlogs.length) {
        container.innerHTML = '<div class="empty-state">No journal articles recorded. Write your first reflection above.</div>';
        return;
      }
      container.innerHTML = '';
      allBlogs.forEach(b => {
        const card = document.createElement('div');
        card.className = 'data-card blog-card';
        const isPublished = Boolean(b.is_published);
        const safeTitle = window.escapeHtml(b.title);
        const safeExcerpt = window.escapeHtml(b.excerpt || '—');
        const safeDate = b.created_at ? new Date(b.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

        card.innerHTML = `
          <div>
            <div class="data-label">${safeDate} · Journal Archive</div>
            <div class="data-display" style="font-weight:600; font-size:15px;">${safeTitle}</div>
            <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">${safeExcerpt}</div>
          </div>
          <div>
            <div class="data-label">Status</div>
            <span class="badge ${isPublished ? 'badge-approved' : 'badge-closed'}">${isPublished ? 'Published' : 'Draft'}</span>
          </div>
          <div class="card-actions-row">
            <a href="post.html?id=${b.id}" target="_blank" rel="noopener noreferrer" class="action-btn" style="padding:0.6rem 1rem; font-size:10px; min-height:40px; text-decoration:none;">View ↗</a>
            <button data-action="toggle-blog" data-id="${b.id}" class="action-btn ${isPublished ? '' : 'gold'}" style="padding:0.6rem 1rem; font-size:10px; min-height:40px;">${isPublished ? 'Unpublish' : 'Publish'}</button>
            <button data-action="delete-blog" data-id="${b.id}" data-title="${safeTitle}" class="action-btn" style="padding:0.6rem 1rem; font-size:10px; min-height:40px; border-color:var(--accent-red); color:var(--accent-red-text);">Delete</button>
          </div>
        `;
        container.appendChild(card);
      });

      if (!container.dataset.actionsBound) {
        container.dataset.actionsBound = '1';
        container.addEventListener('click', (ev) => {
          const btn = ev.target.closest('button[data-action]');
          if (!btn || !container.contains(btn)) return;
          const id = Number(btn.dataset.id);
          if (!Number.isFinite(id)) return;

          if (btn.dataset.action === 'toggle-blog') {
            window.toggleBlogStatus(id, btn);
          } else if (btn.dataset.action === 'delete-blog') {
            window.deleteBlog(id, btn.dataset.title || 'this article', btn);
          }
        });
      }

      if (window.refreshGlobalEffects) window.refreshGlobalEffects();
    } catch (e) {
      container.innerHTML = `<div class="empty-state">Error loading articles: ${window.escapeHtml(e.message)}</div>`;
    }
  };

  window.handleCreateBlog = async function() {
    const titleEl = document.getElementById('blogTitle');
    const excerptEl = document.getElementById('blogExcerpt');
    const contentEl = document.getElementById('blogContent');
    const coverEl = document.getElementById('blogCoverImage');
    const isPubEl = document.getElementById('blogIsPublished');
    const msg = document.getElementById('blogCreateMsg');
    const btn = document.getElementById('btnCreateBlog');

    const title = titleEl?.value.trim() || '';
    const excerpt = excerptEl?.value.trim() || '';
    const content = contentEl?.value.trim() || '';
    const cover_image = coverEl?.value.trim() || '';
    const is_published = Boolean(isPubEl?.checked);

    if (!title || !content) {
      if (msg) {
        msg.textContent = 'Article Title and Content are required.';
        msg.style.color = 'var(--accent-red-text)';
      }
      return;
    }

    if (btn) btn.disabled = true;
    if (msg) {
      msg.textContent = 'Publishing essay...';
      msg.style.color = 'var(--text-secondary)';
    }

    try {
      const res = await adminFetch('/admin/blogs/create', {
        method: 'POST',
        body: JSON.stringify({ title, excerpt, content, cover_image, is_published })
      });

      if (res && res.ok) {
        if (msg) {
          msg.textContent = `✓ Essay successfully ${is_published ? 'published' : 'saved as draft'}.`;
          msg.style.color = 'var(--accent-green-text)';
        }
        titleEl.value = '';
        excerptEl.value = '';
        contentEl.value = '';
        coverEl.value = '';
        window.loadAdminBlogs();
        if (typeof window.refreshCuratorialPulse === 'function') window.refreshCuratorialPulse();
      } else {
        const err = await res?.json().catch(() => ({}));
        if (msg) {
          msg.textContent = err.error || err.detail || 'Could not publish article.';
          msg.style.color = 'var(--accent-red-text)';
        }
      }
    } catch (err) {
      if (msg) {
        msg.textContent = 'Could not reach server.';
        msg.style.color = 'var(--accent-red-text)';
      }
    } finally {
      if (btn) btn.disabled = false;
      setTimeout(() => { if (msg) msg.textContent = ''; }, 4500);
    }
  };

  window.toggleBlogStatus = async function(id, btn) {
    const orig = btn.textContent;
    btn.textContent = '...';
    btn.disabled = true;
    try {
      const res = await adminFetch(`/admin/blogs/${id}/toggle`, { method: 'PATCH' });
      if (res && res.ok) {
        window.loadAdminBlogs();
        if (typeof window.refreshCuratorialPulse === 'function') window.refreshCuratorialPulse();
      } else {
        alert('Could not update publication status.');
      }
    } catch (err) {
      alert('Error updating article.');
    } finally {
      btn.textContent = orig;
      btn.disabled = false;
    }
  };

  window.deleteBlog = async function(id, title, btn) {
    const confirmed = await window.showCuratorConfirm(
      'Delete Article',
      `Permanently delete essay "${title}" from the curatorial archives?`,
      true
    );
    if (!confirmed) return;

    if (btn) { btn.textContent = '...'; btn.disabled = true; }
    try {
      const res = await adminFetch(`/admin/blogs/${id}`, { method: 'DELETE' });
      if (res && res.ok) {
        window.loadAdminBlogs();
        if (typeof window.refreshCuratorialPulse === 'function') window.refreshCuratorialPulse();
      } else {
        alert('Could not delete article.');
      }
    } catch (err) {
      alert('Error deleting article.');
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  // ==========================================
  // 7. AUDIT LEDGER
  // ==========================================
  let allAuditLogs = [];
  let auditFilterTimeout = null;

  window.loadAuditLogs = async function() {
    const container = document.getElementById('auditLogsContainer');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">Loading audit trail...</div>';
    try {
      const res = await adminFetch('/admin/audit-logs');
      if (!res || !res.ok) {
        container.innerHTML = '<div class="empty-state">Unable to load audit logs.</div>';
        return;
      }
      allAuditLogs = await res.json();
      window.renderAuditLogs(allAuditLogs);
    } catch (err) {
      container.innerHTML = `<div class="empty-state">Error loading audit logs: ${window.escapeHtml(err.message)}</div>`;
    }
  };

  window.filterAuditLogs = function() {
    clearTimeout(auditFilterTimeout);
    auditFilterTimeout = setTimeout(() => {
      const input = document.getElementById('auditSearchInput');
      const query = (input?.value || '').toLowerCase().trim();
      if (!query) {
        window.renderAuditLogs(allAuditLogs);
        return;
      }
      const filtered = allAuditLogs.filter(log => {
        const actionMatch = (log.action || '').toLowerCase().includes(query);
        const adminMatch = (log.admin_email || '').toLowerCase().includes(query);
        const detailsMatch = (log.details || '').toLowerCase().includes(query);
        const targetMatch = (log.target_type || '').toLowerCase().includes(query) || (log.target_id || '').toLowerCase().includes(query);
        return actionMatch || adminMatch || detailsMatch || targetMatch;
      });
      window.renderAuditLogs(filtered);
    }, 150);
  };

  window.renderAuditLogs = function(logs) {
    const container = document.getElementById('auditLogsContainer');
    if (!container) return;
    container.innerHTML = '';

    if (!logs.length) {
      container.innerHTML = '<div class="empty-state">No audit ledger records recorded.</div>';
      return;
    }

    logs.forEach(log => {
      const card = document.createElement('div');
      card.className = 'data-card audit-card';

      const safeAdmin = window.escapeHtml(log.admin_email || 'System');
      const safeAction = window.escapeHtml(log.action || 'ACTION');
      const safeTarget = window.escapeHtml(`${log.target_type || 'system'} ${log.target_id ? '#' + log.target_id : ''}`);
      const safeDetails = window.escapeHtml(log.details || '—');
      const timeStr = log.created_at ? new Date(log.created_at).toLocaleString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
      }) : '—';

      let actionBadgeClass = 'badge-closed';
      if (safeAction.includes('CREATE')) actionBadgeClass = 'badge-approved';
      else if (safeAction.includes('DELETE') || safeAction.includes('PURGE') || safeAction.includes('REJECT')) actionBadgeClass = 'badge-rejected';
      else if (safeAction.includes('ACTIVATE') || safeAction.includes('CONFIRM')) actionBadgeClass = 'badge-pending';

      card.innerHTML = `
        <div>
          <div class="data-label">Timestamp</div>
          <div style="font-size: 11px; color: var(--text-secondary);">${timeStr}</div>
        </div>
        <div>
          <div class="data-label">Administrator</div>
          <div class="data-display" style="font-size: 13px;">${safeAdmin}</div>
        </div>
        <div>
          <div class="data-label">Action & Target</div>
          <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
            <span class="badge ${actionBadgeClass}">${safeAction}</span>
            <span style="font-size: 10px; color: var(--text-secondary);">${safeTarget}</span>
          </div>
        </div>
        <div>
          <div class="data-label">Details</div>
          <div class="data-display" style="font-size: 12px; color: var(--text-secondary);">${safeDetails}</div>
        </div>
      `;
      container.appendChild(card);
    });

    if (window.refreshGlobalEffects) window.refreshGlobalEffects();
  };

  // ==========================================
  // 8. SYSTEM DIAGNOSTICS & TELEMETRY DASHBOARD
  // ==========================================
  window.checkSystemDiagnostics = async function() {
    try {
      const res = await adminFetch('/admin/diagnostics/system');
      if (!res || !res.ok) return;
      const diag = await res.json();

      // Overall Latency & Status
      const latencyBadge = document.getElementById('diagLatencyBadge');
      if (latencyBadge) {
        latencyBadge.textContent = `D1 Latency: ${diag.bindings.d1_latency_ms} ms`;
        latencyBadge.className = diag.bindings.d1_latency_ms < 150 ? 'diag-pill diag-pill-pass' : 'diag-pill diag-pill-warn';
      }

      // Entity Metrics
      const m = diag.entity_metrics || {};
      const setEl = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
      setEl('m-users', `${m.users_total}`);
      setEl('m-events', `${m.events_open} Open / ${m.events_total} Total`);
      setEl('m-cycle', m.active_cycle ? `${m.active_cycle} (${m.active_cycle_over_18 ? '18+' : 'Youth'})` : 'None (Closed)');
      setEl('m-exhibs', `${m.exhibition_apps_pending} Pending / ${m.exhibition_apps_total} Total`);
      setEl('m-clubs', `${m.club_apps_pending} Pending / ${m.club_apps_total} Total`);
      setEl('m-vault', `${m.submissions_total} Submissions / ${m.blogs_total} Essays`);

      // Bindings
      const kvEl = document.getElementById('m-kv');
      if (kvEl) kvEl.innerHTML = diag.bindings.kv_bound ? '<span class="badge badge-approved" style="font-size:9px;">Bound</span>' : '<span class="badge badge-closed" style="font-size:9px;">Unbound</span>';
      const r2El = document.getElementById('m-r2');
      if (r2El) r2El.innerHTML = diag.bindings.r2_vault_bound ? '<span class="badge badge-approved" style="font-size:9px;">Bound</span>' : '<span class="badge badge-closed" style="font-size:9px;">Unbound</span>';

      // Security
      const turnEl = document.getElementById('m-turnstile');
      if (turnEl) {
        const mode = diag.security_gates.turnstile_mode;
        turnEl.innerHTML = mode === 'PRODUCTION_LIVE_KEY'
          ? '<span class="badge badge-approved" style="font-size:9px;">Live Key</span>'
          : (mode === 'DEV_DUMMY_KEY' ? '<span class="badge badge-pending" style="font-size:9px;">Dev Dummy Pass</span>' : '<span class="badge badge-rejected" style="font-size:9px;">Missing</span>');
      }
      const jwtEl = document.getElementById('m-jwt');
      if (jwtEl) jwtEl.innerHTML = diag.security_gates.jwt_configured ? `<span class="badge badge-approved" style="font-size:9px;">${diag.security_gates.jwt_length >= 32 ? 'Strong (32+)' : 'Active'}</span>` : '<span class="badge badge-rejected" style="font-size:9px;">Missing</span>';
      const googleEl = document.getElementById('m-google-auth');
      if (googleEl) googleEl.innerHTML = diag.security_gates.google_auth_configured ? '<span class="badge badge-approved" style="font-size:9px;">Configured</span>' : '<span class="badge badge-closed" style="font-size:9px;">Unbound</span>';
      const curEl = document.getElementById('m-curator');
      if (curEl) curEl.innerHTML = diag.security_gates.curator_token_configured ? '<span class="badge badge-approved" style="font-size:9px;">Secured</span>' : '<span class="badge badge-closed" style="font-size:9px;">Unset</span>';

      // Notifications
      const notif = diag.notifications || {};
      setEl('m-driver', notif.driver === 'make' ? 'Make.com Webhook' : (notif.driver === 'cloudflare_email' ? 'Cloudflare Email Routing' : 'Dev Stub'));
      const makeEl = document.getElementById('m-make');
      if (makeEl) makeEl.innerHTML = notif.make_configured ? '<span class="badge badge-approved" style="font-size:9px;">Configured</span>' : '<span class="badge badge-closed" style="font-size:9px;">Unconfigured</span>';
      const cfEl = document.getElementById('m-cf');
      if (cfEl) cfEl.innerHTML = notif.cf_email_configured ? '<span class="badge badge-approved" style="font-size:9px;">Configured</span>' : '<span class="badge badge-closed" style="font-size:9px;">Unconfigured</span>';
      const badgeEmail = document.getElementById('badgeEmailStatus');
      if (badgeEmail) {
        badgeEmail.textContent = notif.driver.toUpperCase();
        badgeEmail.className = notif.driver === 'dev' ? 'diag-pill diag-pill-warn' : 'diag-pill diag-pill-pass';
      }
    } catch (err) {
      console.error('[Diagnostics telemetry error]', err);
    }
  };

  window.runDiagnosticProbe = async function() {
    const btn = document.getElementById('btnRunProbe');
    const consoleBox = document.getElementById('diagProbeConsole');
    const logBox = document.getElementById('diagProbeLog');
    const overallStatusEl = document.getElementById('diagOverallStatus');
    const overallDetailEl = document.getElementById('diagOverallDetail');

    if (btn) { btn.textContent = 'Probing Subsystems...'; btn.disabled = true; }
    if (consoleBox) consoleBox.style.display = 'block';
    if (logBox) logBox.innerHTML = '<div style="color:var(--text-secondary);">Dispatched synthetic probes to D1, Cache KV, R2 Storage, and Security Gates...</div>';

    try {
      const res = await adminFetch('/admin/diagnostics/probe', { method: 'POST' });
      if (!res || !res.ok) throw new Error('Diagnostic probe dispatch rejected');
      const data = await res.json();

      if (overallStatusEl) {
        overallStatusEl.textContent = data.overall_status === 'HEALTHY' ? 'All Subsystems Operational' : 'Degraded System State';
        overallStatusEl.style.color = data.overall_status === 'HEALTHY' ? 'var(--accent-green-text)' : 'var(--accent-red-text)';
      }
      if (overallDetailEl) {
        overallDetailEl.textContent = `Completed synthetic probe sweep at ${new Date(data.timestamp).toLocaleTimeString()}. See investigation log below.`;
      }

      let logHtml = '';
      for (const [key, check] of Object.entries(data.checks || {})) {
        const badgeClass = check.status === 'PASS' ? 'diag-pill-pass' : (check.status === 'WARN' ? 'diag-pill-warn' : 'diag-pill-fail');
        const latencyStr = check.latency_ms !== undefined ? ` [${check.latency_ms}ms]` : '';
        logHtml += `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 0.5rem 0; border-bottom: 1px dashed var(--grid-border); flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <strong style="color:var(--text-primary); text-transform:uppercase;">${window.escapeHtml(key)}</strong>${latencyStr}:
              <span style="color:var(--text-secondary); margin-left: 6px;">${window.escapeHtml(check.detail)}</span>
            </div>
            <span class="diag-pill ${badgeClass}">${check.status}</span>
          </div>
        `;
      }
      if (logBox) logBox.innerHTML = logHtml;

      // Refresh telemetry metrics after probe
      await window.checkSystemDiagnostics();
    } catch (e) {
      if (logBox) logBox.innerHTML = `<div style="color:var(--accent-red-text);">Probe sweep failed: ${window.escapeHtml(e.message)}</div>`;
    } finally {
      if (btn) { btn.textContent = 'Run Synthetic Health Probe'; btn.disabled = false; }
    }
  };

  window.sendTestEmail = async function() {
    const btn = document.getElementById('btnTestEmail');
    const msg = document.getElementById('emailTestMsg');
    if (!btn || !msg) return;

    btn.textContent = 'Dispatching...';
    btn.disabled = true;
    msg.textContent = '';

    try {
      const res = await adminFetch('/admin/email/test', { method: 'POST' });
      if (res && res.ok) {
        msg.style.color = 'var(--accent-green-text)';
        msg.textContent = '✓ Test payload accepted (200 OK). Delivered to notification pipeline.';
      } else {
        const errData = await res?.json().catch(() => ({}));
        msg.style.color = 'var(--accent-red-text)';
        msg.textContent = `Dispatch failed: ${errData?.detail || errData?.error || 'Service error'}`;
      }
    } catch (e) {
      msg.style.color = 'var(--accent-red-text)';
      msg.textContent = `Error: ${e.message}`;
    } finally {
      btn.textContent = 'Dispatch Test Email';
      btn.disabled = false;
    }
  };

  // Start with default tab & refresh operational pulse
  window.switchTab('events');
  if (typeof window.refreshCuratorialPulse === 'function') {
    window.refreshCuratorialPulse();
  }
});
