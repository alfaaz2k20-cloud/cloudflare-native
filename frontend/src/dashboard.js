// dashboard.js — Alfaaz Unified Dashboard Logic
// Clean, honest data hydration across Home, Explore, My Activity, and Profile

document.addEventListener('DOMContentLoaded', () => {
  const getCloudinaryConfig = () => ({
    cloudName: (window.ALFAAZ_CLOUDINARY && window.ALFAAZ_CLOUDINARY.cloudName) || 'dmqwjpmjk',
    uploadPreset: (window.ALFAAZ_CLOUDINARY && window.ALFAAZ_CLOUDINARY.uploadPreset) || 'alfaaz_vault'
  });

  // 1. Toast Notification System
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

  // 2. Authentication Pre-Flight
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

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.clear();
      window.location.href = 'login.html';
    });
  }

  // Set formatted current date on Home
  const dateDisplay = document.getElementById('homeDateDisplay');
  if (dateDisplay) {
    try {
      const now = new Date();
      dateDisplay.textContent = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (_) {}
  }

  // 3. User State Tracking for Singular Home Highlight
  let userActivePass = null;
  let userActiveClub = null;
  let userActiveExhibition = null;

  function updateHomeActivityState() {
    const highlightContainer = document.getElementById('homeActivityHighlight');
    const emptyContainer = document.getElementById('homeEmptyState');
    const catEl = document.getElementById('homeHighlightCategory');
    const titleEl = document.getElementById('homeHighlightTitle');
    const subEl = document.getElementById('homeHighlightSubtitle');
    const actionEl = document.getElementById('homeHighlightAction');

    if (!highlightContainer || !emptyContainer) return;

    // Priority 1: Next confirmed event pass
    if (userActivePass) {
      highlightContainer.style.display = 'block';
      emptyContainer.style.display = 'none';
      if (catEl) catEl.textContent = 'Upcoming Pass';
      if (titleEl) titleEl.textContent = userActivePass.event_name;
      if (subEl) subEl.textContent = userActivePass.event_date ? `Date: ${userActivePass.event_date}` : 'Confirmed Admission Pass';
      if (actionEl) {
        actionEl.textContent = 'View in Activity →';
        actionEl.setAttribute('href', '#sectionActivity');
      }
      return;
    }

    // Priority 2: Creative circle status (if applied or approved)
    if (userActiveClub && userActiveClub.status !== 'NONE') {
      highlightContainer.style.display = 'block';
      emptyContainer.style.display = 'none';
      if (catEl) catEl.textContent = 'Creative Circle';
      if (titleEl) titleEl.textContent = userActiveClub.club || userActiveClub.club_name || 'Creative Circle';
      if (subEl) subEl.textContent = userActiveClub.status === 'APPROVED' ? 'Active Circle Member' : 'Application Under Curatorial Review';
      if (actionEl) {
        actionEl.textContent = 'View Circle Status →';
        actionEl.setAttribute('href', '#sectionActivity');
      }
      return;
    }

    // Priority 3: Exhibition submission status (if applied)
    if (userActiveExhibition && userActiveExhibition.status && userActiveExhibition.status !== 'NONE') {
      highlightContainer.style.display = 'block';
      emptyContainer.style.display = 'none';
      if (catEl) catEl.textContent = 'Exhibition Submission';
      if (titleEl) titleEl.textContent = userActiveExhibition.exhibition_cycle || 'Gallery Showcase';
      if (subEl) {
        if (userActiveExhibition.status === 'APPROVED' && (userActiveExhibition.registration_status === 'CONFIRMED' || userActiveExhibition.registration_status === 'SUBMITTED')) {
          subEl.textContent = 'Registration Confirmed';
        } else if (userActiveExhibition.status === 'APPROVED') {
          subEl.textContent = 'Selected for Show! — Registration Pending';
        } else if (userActiveExhibition.status === 'PENDING') {
          subEl.textContent = 'We are Reviewing Your Art';
        } else if (userActiveExhibition.status === 'REJECTED') {
          subEl.textContent = 'Not Selected for this Show';
        } else {
          subEl.textContent = 'Submission Completed';
        }
      }
      if (actionEl) {
        actionEl.textContent = 'View Submission Status →';
        actionEl.setAttribute('href', '#sectionActivity');
      }
      return;
    }

    // Priority 4: True Empty State (No active bookings, circle applications, or exhibition submissions)
    highlightContainer.style.display = 'none';
    emptyContainer.style.display = 'block';
  }

  // 4. Load Profile (GET /auth/me)
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
      
      const fullName = (data.full_name || '').trim();
      const firstName = fullName ? fullName.split(/\s+/)[0] : '';
      const initial = (fullName || data.email || 'A')[0].toUpperCase();

      const welcomeHeading = document.getElementById('welcomeHeading');
      if (welcomeHeading) {
        welcomeHeading.textContent = firstName ? `Welcome back, ${firstName}` : 'Welcome back';
      }

      const profileMonogram = document.getElementById('profileMonogram');
      if (profileMonogram) profileMonogram.textContent = initial;

      const profileHeaderName = document.getElementById('profileHeaderName');
      if (profileHeaderName) profileHeaderName.textContent = fullName || data.email || user.email || '—';

      const dashName = document.getElementById('dashName');
      if (dashName) dashName.textContent = fullName || '—';

      const nameEditInput = document.getElementById('nameEditInput');
      if (nameEditInput) nameEditInput.value = fullName;

      const dashPhone = document.getElementById('dashPhone');
      const phoneEditInput = document.getElementById('phoneEditInput');
      const btnEditPhone = document.getElementById('btnEditPhone');

      if (dashPhone) {
        if (data.phone) {
          dashPhone.textContent = data.phone;
          dashPhone.style.color = 'var(--text-primary)';
          if (btnEditPhone) btnEditPhone.textContent = 'Edit';
        } else {
          dashPhone.textContent = 'Not provided';
          dashPhone.style.color = 'var(--text-secondary)';
          if (btnEditPhone) btnEditPhone.textContent = 'Add WhatsApp';
        }
      }
      if (phoneEditInput) phoneEditInput.value = data.phone || '';

      const dashEmail = document.getElementById('dashEmail');
      if (dashEmail) dashEmail.textContent = data.email || user.email || '—';

      const dashVerifiedBadge = document.getElementById('dashVerifiedBadge');
      if (dashVerifiedBadge) {
        const isVerified = data.email_verified === 1 || data.email_verified === true;
        dashVerifiedBadge.style.display = isVerified ? 'inline-block' : 'none';
      }

      const dashProviderBadge = document.getElementById('dashProviderBadge');
      if (dashProviderBadge) {
        dashProviderBadge.textContent = data.auth_provider === 'google.com' ? 'Google Account' : 'Email Account';
      }

      const adminLink = document.getElementById('adminLink');
      if (adminLink) {
        const isAdmin = data.status === 'ADMIN';
        adminLink.style.display = isAdmin ? 'inline-block' : 'none';
      }
    } catch (e) {
      console.error('Profile load error:', e);
    }
  }

  // Inline Profile Editing: Full Name
  window.startEditName = function() {
    const dRow = document.getElementById('nameDisplayRow');
    const eRow = document.getElementById('nameEditRow');
    if (dRow) dRow.style.display = 'none';
    if (eRow) {
      eRow.style.display = 'flex';
      const input = document.getElementById('nameEditInput');
      const currentName = document.getElementById('dashName')?.textContent || '';
      if (input && currentName && currentName !== '—') {
        input.value = currentName;
      }
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
      const headerName = document.getElementById('profileHeaderName');
      const welcome = document.getElementById('welcomeHeading');
      const monogram = document.getElementById('profileMonogram');

      if (dashName) dashName.textContent = val;
      if (headerName) headerName.textContent = val;
      if (welcome) {
        const first = val.split(/\s+/)[0];
        welcome.textContent = `Welcome back, ${first}`;
      }
      if (monogram) monogram.textContent = val[0].toUpperCase();

      window.cancelEditName();
      showToast('Name updated successfully.', 'success');
    } else {
      showToast('Failed to update name.', 'error');
    }
  };

  // Inline Profile Editing: WhatsApp Contact (reconciles GET phone -> PATCH whatsapp)
  window.startEditPhone = function() {
    const dRow = document.getElementById('phoneDisplayRow');
    const eRow = document.getElementById('phoneEditRow');
    if (dRow) dRow.style.display = 'none';
    if (eRow) {
      eRow.style.display = 'flex';
      const input = document.getElementById('phoneEditInput');
      const currentPhone = document.getElementById('dashPhone')?.textContent || '';
      if (input && currentPhone && currentPhone !== 'Not provided') {
        input.value = currentPhone;
      }
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
        if (btnEditPhone) btnEditPhone.textContent = 'Edit';
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

  // 5. Load Active Events (GET /events/active)
  async function loadActiveEvents() {
    const container = document.getElementById('activeEventsContainer');
    if (!container) return;
    try {
      const res = await window.globalApiFetch('/events/active');
      if (!res || !res.ok) return;
      const events = await res.json().catch(() => []);
      if (!events.length) {
        container.innerHTML = '<div style="font-size:13px; color:var(--text-secondary); font-style:italic; padding: 0.75rem 0;">No upcoming events currently scheduled. New events will be published here.</div>';
        return;
      }
      container.innerHTML = events.map((e) => `
        <div class="event-entry">
          <div style="flex:1;">
            <div class="event-name">${window.escapeHtml(e.name)}</div>
            <div class="event-date">${window.escapeHtml(e.event_date || 'Schedule Announced Shortly')}</div>
            <div class="event-detail">${window.escapeHtml(e.description || '')}</div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.5rem;">
            <button class="action-btn-primary" style="padding:0.5rem 1.2rem; font-size:11.5px; min-height:38px;" ${e.full ? 'disabled' : ''} onclick="openRsvpModal(${parseInt(e.id, 10)})">${e.full ? 'Event Full' : 'Reserve Pass'}</button>
            ${e.spots_left != null && !e.full ? `<span style="font-size:11px; color:var(--text-secondary);">${e.spots_left} spots remaining</span>` : ''}
          </div>
        </div>`).join('');
    } catch (e) {
      container.innerHTML = '<p style="color:var(--accent-red-text); font-size:13px;">Unable to reach the events directory.</p>';
    }
  }

  // Helper: parse event_date safely in user's local timezone without unintended UTC offsets
  // Validates year, month, and day to prevent JavaScript date rollover on impossible dates (e.g. Feb 30 or April 31)
  function parseEventTimestamp(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const trimmed = dateStr.trim();
    if (!trimmed) return null;

    function buildValidatedLocalDate(year, month, day) {
      const localDate = new Date(year, month, day, 0, 0, 0, 0);
      if (isNaN(localDate.getTime())) return null;
      if (localDate.getFullYear() !== year || localDate.getMonth() !== month || localDate.getDate() !== day) {
        return null; // Rolled over due to impossible date
      }
      return localDate.getTime();
    }

    // Direct ISO / numeric date-only (YYYY-MM-DD or YYYY/MM/DD) parsed strictly in local timezone
    const isoMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(trimmed);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10) - 1;
      const day = parseInt(isoMatch[3], 10);
      return buildValidatedLocalDate(year, month, day);
    }

    // Clean out middle dots and en-dashes
    const cleaned = trimmed.replace(/[·•]/g, ' ').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
    const cleanedIsoMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(cleaned);
    if (cleanedIsoMatch) {
      const year = parseInt(cleanedIsoMatch[1], 10);
      const month = parseInt(cleanedIsoMatch[2], 10) - 1;
      const day = parseInt(cleanedIsoMatch[3], 10);
      return buildValidatedLocalDate(year, month, day);
    }

    // First part before delimiter (e.g., 'YYYY-MM-DD · 4:00 PM')
    const firstPart = trimmed.split(/[·•–—]/)[0].trim();
    const firstPartIso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(firstPart);
    if (firstPartIso) {
      const year = parseInt(firstPartIso[1], 10);
      const month = parseInt(firstPartIso[2], 10) - 1;
      const day = parseInt(firstPartIso[3], 10);
      return buildValidatedLocalDate(year, month, day);
    }

    // If an ISO date substring (YYYY-MM-DD) is embedded, verify it is calendar-valid before Date.parse
    const isoEmbeddedMatch = /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(cleaned);
    if (isoEmbeddedMatch) {
      const y = parseInt(isoEmbeddedMatch[1], 10);
      const m = parseInt(isoEmbeddedMatch[2], 10) - 1;
      const d = parseInt(isoEmbeddedMatch[3], 10);
      if (buildValidatedLocalDate(y, m, d) === null) {
        return null;
      }
    }

    // Textual dates (e.g. Month Day, Year or Day Month Year)
    const textMonthMatch = /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})/i.exec(cleaned) ||
                          /(\d{1,2})\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?),?\s+(\d{4})/i.exec(cleaned);

    const ts = Date.parse(cleaned);
    if (!isNaN(ts)) {
      if (textMonthMatch) {
        const expectedDay = parseInt(textMonthMatch[1], 10);
        const parsedD = new Date(ts);
        if (parsedD.getDate() !== expectedDay) {
          return null; // Rolled over
        }
      }
      return ts;
    }

    const firstPartTs = Date.parse(firstPart);
    if (!isNaN(firstPartTs)) {
      if (textMonthMatch) {
        const expectedDay = parseInt(textMonthMatch[1], 10);
        const parsedD = new Date(firstPartTs);
        if (parsedD.getDate() !== expectedDay) {
          return null; // Rolled over
        }
      }
      return firstPartTs;
    }

    return null;
  }

  // 6. Load Confirmed Passes (GET /events/my-registrations)
  // Strictly verified fields only: event_name & event_date. No fabricated venues or serial numbers.
  // Home selects the nearest upcoming event by chronological event date, not registration creation order.
  async function loadMyTickets() {
    const container = document.getElementById('myTicketsContainer');
    if (!container) return;
    try {
      const res = await window.globalApiFetch('/events/my-registrations');
      if (!res || !res.ok) return;
      const tickets = await res.json().catch(() => []);
      
      // Determine nearest upcoming event (including events occurring today in user's local timezone)
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const todayMs = startOfToday.getTime();

      const upcomingPasses = [];
      for (const ticket of tickets) {
        const ts = parseEventTimestamp(ticket.event_date);
        if (ts !== null && ts >= todayMs) {
          upcomingPasses.push({ ticket, ts });
        }
      }

      upcomingPasses.sort((a, b) => a.ts - b.ts);
      userActivePass = upcomingPasses.length > 0 ? upcomingPasses[0].ticket : null;
      updateHomeActivityState();

      if (!tickets.length) {
        container.innerHTML = '<div style="font-size:13px; color:var(--text-secondary); font-style:italic; padding: 0.75rem 0;">You have no active event passes. Explore upcoming events above to reserve your spot.</div>';
        return;
      }

      container.innerHTML = tickets.map((t) => {
        const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(t.event_name || 'Alfaaz Event')}&details=${encodeURIComponent('Confirmed Admission Pass - Alfaaz Collective')}`;
        return `
        <div class="pass-stub">
          <div>
            <div class="pass-title">${window.escapeHtml(t.event_name)}</div>
            <div class="pass-date">${t.event_date ? window.escapeHtml(t.event_date) : 'Date announced shortly'}</div>
          </div>
          <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
            <span class="badge badge-green">Confirmed Pass</span>
            <a href="${calUrl}" target="_blank" rel="noopener noreferrer" class="action-btn-secondary" style="font-size:11px; padding:0.4rem 0.85rem; min-height:36px;">+ Add to Calendar</a>
          </div>
        </div>`;
      }).join('');
    } catch (e) {
      container.innerHTML = '<p style="color:var(--accent-red-text); font-size:13px;">Unable to load your passes at this time.</p>';
    }
  }

  // 7. Event RSVP Modal Logic
  let currentRsvpEventId = null;
  window.openRsvpModal = function(eventId) {
    currentRsvpEventId = eventId;
    const input = document.getElementById('rsvpWhatsapp');
    const existingPhone = document.getElementById('dashPhone')?.textContent || '';
    if (input) {
      input.value = (existingPhone && existingPhone !== 'Not provided') ? existingPhone : '';
    }
    const check = document.getElementById('rsvpAgreeCheck');
    if (check) check.checked = false;
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
    const agreed = Boolean(document.getElementById('rsvpAgreeCheck')?.checked);

    if (!agreed) {
      showToast('Please acknowledge the Salon Participation Protocol to proceed.', 'error');
      return;
    }
    if (!wa) {
      showToast('WhatsApp contact number is required.', 'error');
      return;
    }
    const btn = document.getElementById('confirmRsvpBtn');
    if (btn) {
      btn.textContent = 'Securing Pass...';
      btn.disabled = true;
    }
    try {
      const res = await window.globalApiFetch('/events/register', {
        method: 'POST',
        body: JSON.stringify({ event_id: currentRsvpEventId, whatsapp_number: wa })
      });
      if (res && res.ok) {
        window.closeRsvpModal();
        showToast('Pass confirmed successfully.', 'success');
        loadActiveEvents();
        loadMyTickets();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.detail || data.error || 'Registration could not be completed.', 'error');
      }
    } catch (e) {
      showToast('Network error while reserving pass.', 'error');
    }
    if (btn) {
      btn.textContent = 'Confirm Pass';
      btn.disabled = false;
    }
  };

  // 8. Creative Circles (GET /clubs/my-status & POST /clubs/apply)
  // Confined to 5 fixed choices: Literature, Art & Craft, Film Club, Photography, Philosophy
  async function loadClubStatus() {
    try {
      const res = await window.globalApiFetch('/clubs/my-status');
      if (!res || !res.ok) return;
      const data = await res.json().catch(() => ({}));
      userActiveClub = data;
      updateHomeActivityState();

      const viewStatus = document.getElementById('clubStatusView');
      const emptyNote = document.getElementById('clubEmptyActivityNote');
      const applyView = document.getElementById('clubApplyView');
      const exploreNote = document.getElementById('clubExploreStatusNote');

      if (data.status === 'NONE') {
        if (viewStatus) viewStatus.style.display = 'none';
        if (emptyNote) emptyNote.style.display = 'block';
        if (applyView) applyView.style.display = 'block';
        if (exploreNote) exploreNote.style.display = 'none';
      } else {
        if (emptyNote) emptyNote.style.display = 'none';
        if (viewStatus) viewStatus.style.display = 'block';
        if (applyView) applyView.style.display = 'none';
        if (exploreNote) exploreNote.style.display = 'block';

        const myClubName = document.getElementById('myClubName');
        const myClubBadge = document.getElementById('myClubBadge');
        const myClubNote = document.getElementById('myClubNote');

        if (myClubName) myClubName.textContent = data.club || data.club_name || '—';
        const bc = data.status === 'PENDING' ? 'badge-gold' : data.status === 'APPROVED' ? 'badge-green' : 'badge-red';
        const label = data.status === 'PENDING' ? 'Application Under Review' : data.status === 'APPROVED' ? 'Circle Member' : 'Not Selected';
        if (myClubBadge) myClubBadge.innerHTML = `<span class="badge ${bc}">${window.escapeHtml(label)}</span>`;
        if (data.admin_note && myClubNote) {
          myClubNote.textContent = `Curator's Note: "${data.admin_note}"`;
          myClubNote.style.display = 'block';
        } else if (myClubNote) {
          myClubNote.textContent = data.status === 'APPROVED' ? 'You are an active member of this circle.' : 'Your circle application is currently under curatorial review.';
          myClubNote.style.display = 'block';
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
          msg.textContent = 'Application submitted for curatorial review.';
        }
        showToast('Circle application submitted.', 'success');
        setTimeout(() => loadClubStatus(), 1200);
      } else {
        const data = await res.json().catch(() => ({}));
        if (msg) {
          msg.style.color = 'var(--accent-red-text)';
          msg.textContent = data.detail || 'Application failed.';
        }
        if (btn) {
          btn.textContent = 'Join Circle';
          btn.disabled = false;
        }
      }
    } catch (e) {
      if (msg) {
        msg.style.color = 'var(--accent-red-text)';
        msg.textContent = 'Network error.';
      }
      if (btn) {
        btn.textContent = 'Join Circle';
        btn.disabled = false;
      }
    }
  };

  // 9. Current Exhibition Open Call & Submission Status (GET /exhibitions/config & GET /exhibitions/my-status)
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

      userActiveExhibition = data;
      updateHomeActivityState();

      // Explore view: Singular current exhibition open call representation
      const openView = document.getElementById('exhibOpenView');
      const closedView = document.getElementById('exhibClosedView');
      const titleEl = document.getElementById('exhibTitleDisplay');
      const datesEl = document.getElementById('exhibDatesDisplay');
      const aboutEl = document.getElementById('exhibAboutDisplay');

      if (cfg.is_open) {
        if (openView) openView.style.display = 'block';
        if (closedView) closedView.style.display = 'none';
        if (titleEl) titleEl.textContent = cfg.title || 'Curatorial Open Call';
        if (datesEl) datesEl.textContent = cfg.date_text ? `Dates: ${cfg.date_text}` : 'Open Call Active';
        if (aboutEl) aboutEl.textContent = cfg.about_text || 'Submit your artwork and portfolio for our upcoming exhibition showcase.';
      } else {
        if (openView) openView.style.display = 'none';
        if (closedView) closedView.style.display = 'block';
      }

      // Activity view: Stepper and Application status
      const masterPanel = document.getElementById('exhibitionPanel');
      if (!masterPanel) return;

      masterPanel.style.display = 'block';

      ['exhibApplyView', 'exhibPendingView', 'exhibRejectedView', 'exhibApprovedView', 'exhibFinalizedView'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });

      updateExhibitionStepper(data.status, data.registration_status);

      if (data.status === 'NONE') {
        const applyEl = document.getElementById('exhibApplyView');
        if (applyEl) applyEl.style.display = 'block';
      } else if (data.status === 'PENDING') {
        const pendEl = document.getElementById('exhibPendingView');
        if (pendEl) pendEl.style.display = 'block';
      } else if (data.status === 'REJECTED') {
        const rejEl = document.getElementById('exhibRejectedView');
        if (rejEl) {
          rejEl.style.display = 'block';
          const rejNote = document.getElementById('exhibRejectedNote');
          if (rejNote && data.curator_note) {
            rejNote.textContent = `Note from our team: "${data.curator_note}"`;
          }
        }
      } else if (data.status === 'APPROVED' && (data.registration_status === 'SUBMITTED' || data.registration_status === 'CONFIRMED')) {
        const finEl = document.getElementById('exhibFinalizedView');
        if (finEl) finEl.style.display = 'block';
      } else if (data.status === 'APPROVED') {
        const appEl = document.getElementById('exhibApprovedView');
        if (appEl) {
          appEl.style.display = 'block';
          const appNote = document.getElementById('exhibApprovedNote');
          if (appNote && data.curator_note) {
            appNote.textContent = `"${data.curator_note}"`;
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
              paymentLink.style.opacity = '0.55';
              paymentLink.style.pointerEvents = 'none';
            }
          }

          if (paymentDetails) {
            const paymentLines = [];
            if (cfg.registration_fee) paymentLines.push(`Registration Fee: ${window.escapeHtml(cfg.registration_fee)}`);
            if (cfg.payment_instructions) paymentLines.push(window.escapeHtml(cfg.payment_instructions));
            paymentDetails.innerHTML = paymentLines.join(' &nbsp;|&nbsp; ');
            paymentDetails.style.display = paymentLines.length ? 'block' : 'none';
          }
        }
      }
    } catch (e) {
      console.error('Exhibition load error:', e);
    }
  }

  // Handle exhibition payment proof upload
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
      btn.textContent = 'Uploading Proof...';
      btn.disabled = true;
    }
    if (msg) {
      msg.style.color = 'var(--text-secondary)';
      msg.textContent = 'Uploading transaction screenshot...';
    }

    try {
      const { cloudName, uploadPreset } = getCloudinaryConfig();
      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      formData.append('upload_preset', uploadPreset);

      const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
        method: 'POST',
        body: formData
      });
      const cloudData = await cloudRes.json();
      if (!cloudData.secure_url) throw new Error('Proof upload failed.');

      if (msg) msg.textContent = 'Confirming registration...';
      const res = await window.globalApiFetch('/exhibitions/finalize', {
        method: 'POST',
        body: JSON.stringify({ agreed_to_tnc: true, payment_proof_url: cloudData.secure_url })
      });

      if (res && res.ok) {
        if (msg) {
          msg.style.color = 'var(--accent-green-text)';
          msg.textContent = 'Registration Confirmed!';
        }
        showToast('Payment submitted successfully.', 'success');
        setTimeout(() => loadExhibitionStatus(), 1500);
      } else {
        throw new Error('Server rejected the confirmation request.');
      }
    } catch (err) {
      if (msg) {
        msg.style.color = 'var(--accent-red-text)';
        msg.textContent = err.message || 'Failed to submit payment receipt.';
      }
      if (btn) {
        btn.textContent = 'Submit Payment Receipt';
        btn.disabled = false;
      }
    }
  });

  // 10. Secondary Curator AI Utility Desk (POST /curator/ask)
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

  window.setInquiry = function(text) {
    const input = document.getElementById('curatorInput');
    if (input) {
      input.value = text;
      window.askCurator();
    }
  };

  window.askCurator = async function() {
    const input = document.getElementById('curatorInput');
    const output = document.getElementById('curatorOutput');
    if (!input || !output) return;
    const query = input.value.trim();
    if (!query) return;
    input.value = '';

    appendCuratorMessage(output, 'You', query, 'margin-top:1rem; color: var(--accent-gold-text); font-weight: 500;');
    const loadMsg = appendCuratorMessage(output, '', 'Curator AI is reflecting...', 'color:var(--text-secondary); font-style:italic; margin-top:0.4rem;');

    const history = window.alfaazCuratorMemory?.history?.() || [];

    try {
      const res = await window.globalApiFetch('/curator/ask', {
        method: 'POST',
        body: JSON.stringify({ question: query, history })
      });

      if (loadMsg.isConnected) loadMsg.remove();

      if (res && res.ok) {
        const data = await res.json().catch(() => ({}));
        const answer = data.answer || 'Curator reflection complete.';
        appendCuratorMessage(output, 'Curator AI', answer, 'color:var(--text-primary); margin-top:0.4rem; border-left: 2px solid var(--accent-gold); padding-left: 8px; line-height: 1.5;');
        window.alfaazCuratorMemory?.add?.('user', query);
        window.alfaazCuratorMemory?.add?.('assistant', answer);
      } else {
        appendCuratorMessage(output, '', 'Curator AI is momentarily quiet. Please ask again shortly.', 'color:var(--accent-red-text); margin-top:0.4rem;');
      }
    } catch (err) {
      if (loadMsg.isConnected) loadMsg.remove();
      appendCuratorMessage(output, '', 'Inquiry interrupted by network issue.', 'color:var(--accent-red-text); margin-top:0.4rem;');
    }
    output.scrollTop = output.scrollHeight;
  };

  document.getElementById('curatorInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      window.askCurator();
    }
  });

  // 11. Navigation Scroll-Spy & Active Destination Synchronization
  function initNavigationScrollSpy() {
    const desktopLinks = [
      { id: 'sectionHome', link: document.getElementById('navLinkHome') },
      { id: 'sectionExplore', link: document.getElementById('navLinkExplore') },
      { id: 'sectionActivity', link: document.getElementById('navLinkActivity') },
      { id: 'sectionProfile', link: document.getElementById('navLinkProfile') }
    ];

    const mobileLinks = [
      { id: 'sectionHome', link: document.getElementById('mTabHome') },
      { id: 'sectionExplore', link: document.getElementById('mTabExplore') },
      { id: 'sectionActivity', link: document.getElementById('mTabActivity') },
      { id: 'sectionProfile', link: document.getElementById('mTabProfile') }
    ];

    const sections = desktopLinks.map(d => document.getElementById(d.id)).filter(Boolean);
    if (!('IntersectionObserver' in window) || !sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sid = entry.target.id;
            desktopLinks.forEach(d => {
              if (d.link) {
                if (d.id === sid) d.link.classList.add('active');
                else d.link.classList.remove('active');
              }
            });
            mobileLinks.forEach(m => {
              if (m.link) {
                if (m.id === sid) m.link.classList.add('active');
                else m.link.classList.remove('active');
              }
            });
          }
        });
      },
      { rootMargin: '-15% 0px -65% 0px', threshold: 0 }
    );

    sections.forEach(s => observer.observe(s));
  }

  // Keyboard shortcut handlers
  document.getElementById('nameEditInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      window.saveEditName();
    }
  });

  document.getElementById('phoneEditInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      window.saveEditPhone();
    }
  });

  document.getElementById('rsvpWhatsapp')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      window.submitRsvp();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.closeRsvpModal();
    }
  });

  document.getElementById('rsvpModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'rsvpModal') window.closeRsvpModal();
  });

  // 12. Run Initialization
  loadProfile();
  loadActiveEvents();
  loadMyTickets();
  loadClubStatus();
  loadExhibitionStatus();
  initNavigationScrollSpy();
});
