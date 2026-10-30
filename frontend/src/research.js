/* ==========================================================================
   ALFAAZ RECRUIT — RECRUITER RESEARCH VIEW CLIENT
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('alfaaz_token');
    const userData = localStorage.getItem('alfaaz_user');
    
    if (!token || !userData) {
        window.location.href = 'login.html';
        return;
    }
    
    try {
        const user = JSON.parse(userData);
        if (user.status !== 'ADMIN') {
            window.location.href = 'dashboard.html';
            return;
        }
    } catch (e) {
        localStorage.removeItem('alfaaz_token');
        localStorage.removeItem('alfaaz_user');
        window.location.href = 'login.html';
        return;
    }

  setupLogout();
  await loadSessionsList();
});

function setupLogout() {
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('alfaaz_token');
    window.location.href = 'login.html';
  });
}

async function loadSessionsList(selectedStatus = '') {
  const container = document.getElementById('researchContent');
  const apiBase = (window.ALFAAZ_API_URL !== undefined && window.ALFAAZ_API_URL !== null) ? window.ALFAAZ_API_URL : '';

  try {
    const token = localStorage.getItem('alfaaz_token');
    const endpoint = `/recruit/research/sessions${selectedStatus ? `?status=${encodeURIComponent(selectedStatus)}` : ''}`;
    const resp = await window.globalApiFetch(endpoint);

    if (resp.status === 401 || resp.status === 403) {
      container.innerHTML = '<div class="p-8 text-center text-sm font-mono text-[var(--accent-red-text)]">Admin clearance required. Redirecting to login...</div>';
      setTimeout(() => { window.location.href = 'login.html'; }, 1200);
      return;
    }

    const sessions = await resp.json();

    const filterToolbar = `
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white border border-[var(--grid-border)] p-4">
      <div>
        <h2 class="text-base sm:text-lg text-[var(--text-primary)] font-serif">Applicant Assessment Records</h2>
        <span class="text-xs text-black">Ordered strictly by submission time</span>
      </div>
      <div class="flex items-center gap-3 flex-wrap">
        <button id="manageInterviewHoursBtn" class="px-2.5 py-1 text-xs border border-[var(--grid-border)] bg-[#faf8f5] text-[var(--text-primary)] hover:bg-[#eae6dc] transition-colors flex items-center gap-1.5" title="Configure interview time windows and working days">
          <span>⏱️</span>
          <span>Interview Hours</span>
        </button>
        <div class="flex items-center gap-1.5">
          <label for="statusFilter" class="text-xs uppercase tracking-wider text-black">Session Status:</label>
          <select id="statusFilter" class="px-2 py-1 text-xs border border-[var(--grid-border)] bg-[#faf8f5] text-[var(--text-primary)] focus:outline-none">
            <option value="" ${selectedStatus === '' ? 'selected' : ''}>All Operational Statuses</option>
            <option value="CONSENTED" ${selectedStatus === 'CONSENTED' ? 'selected' : ''}>Consented</option>
            <option value="SJT" ${selectedStatus === 'SJT' ? 'selected' : ''}>SJT</option>
            <option value="ACTIVE" ${selectedStatus === 'ACTIVE' ? 'selected' : ''}>Active (Games)</option>
            <option value="COMPLETE" ${selectedStatus === 'COMPLETE' ? 'selected' : ''}>Complete</option>
          </select>
        </div>
      </div>
    </div>
    `;

    if (!sessions || sessions.length === 0) {
      container.innerHTML = `
      ${filterToolbar}
      <div class="p-12 text-center bg-white border border-[var(--grid-border)] mt-4 space-y-2">
        <div class="text-[var(--text-primary)] font-medium">No assessment sessions found for this status.</div>
        <div class="text-xs text-stone-500 max-w-md mx-auto">
          Candidate records will appear here as applicants consent and begin their assessment journeys. You can also select &ldquo;All Operational Statuses&rdquo; to review in-progress candidate sessions.
        </div>
      </div>
      `;
      document.getElementById('statusFilter')?.addEventListener('change', (e) => {
        loadSessionsList(e.target.value);
      });
      document.getElementById('manageInterviewHoursBtn')?.addEventListener('click', () => {
        openInterviewSettingsModal();
      });
      return;
    }

    const rowsHtml = sessions.map(s => {
      const booking = s.interview_booking;
      const bookingBadge = booking
        ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-[#eaf5ea] border border-[#bce0bc] text-[#1e6624] text-[10px] font-medium" title="Booked slot">
            <span>📅</span>
            <span>${window.escapeHtml(booking.slot_display || `${booking.slot_date} ${booking.slot_time}`)}</span>
          </span>`
        : `<span class="text-stone-400 text-[10px] italic">Not scheduled</span>`;

      return `
      <tr class="border-b border-[var(--grid-border)] hover:bg-[#faf8f5] transition-colors">
        <td class="p-4 text-sm font-medium text-[var(--text-primary)]">${window.escapeHtml(s.full_name || 'Anonymous Applicant')}</td>
        <td class="p-4 text-xs text-black">${window.escapeHtml(s.email || '—')}</td>
        <td class="p-4 text-xs text-black">${s.linkedin_url ? `<a href="${window.escapeHtml(s.linkedin_url.startsWith('http') ? s.linkedin_url : 'https://' + s.linkedin_url)}" target="_blank" rel="noopener noreferrer" class="text-[var(--accent-gold)] hover:underline inline-flex items-center gap-1" title="${window.escapeHtml(s.linkedin_url)}">Link &nearr;</a>` : '—'}</td>
        <td class="p-4 text-xs">${bookingBadge}</td>
        <td class="p-4 text-xs text-black">${s.created_at ? new Date(s.created_at).toLocaleString() : '—'}</td>
        <td class="p-4 text-xs">
          <span class="px-2 py-0.5 bg-[#f4f1ea] border border-[var(--grid-border)] text-[10px] uppercase tracking-wider">${s.status}</span>
        </td>
        <td class="p-4 text-right">
          <button class="view-session-btn px-3 py-1 bg-[var(--text-primary)] text-white text-[10px] uppercase tracking-widest hover:bg-[var(--accent-gold)] transition-colors" data-id="${s.session_id}">
            View Evidence &rarr;
          </button>
        </td>
      </tr>
      `;
    }).join('');

    container.innerHTML = `
    <div class="space-y-4">
      ${filterToolbar}
      <div class="bg-white border border-[var(--grid-border)] p-6 space-y-4">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-[#faf8f5] border-b border-[var(--grid-border)] text-[10px] uppercase tracking-wider text-black">
                <th class="p-4">Applicant Name</th>
                <th class="p-4">Email</th>
                <th class="p-4">LinkedIn / CV</th>
                <th class="p-4">Interview Timing</th>
                <th class="p-4">Submission Date</th>
                <th class="p-4">Status</th>
                <th class="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    `;

    document.getElementById('statusFilter')?.addEventListener('change', (e) => {
      loadSessionsList(e.target.value);
    });

    document.getElementById('manageInterviewHoursBtn')?.addEventListener('click', () => {
      openInterviewSettingsModal();
    });

    container.querySelectorAll('.view-session-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sId = btn.getAttribute('data-id');
        loadSessionDetail(sId);
      });
    });

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error('Failed to load applicant assessment sessions:', err);
    container.innerHTML = `
      <div class="p-8 text-center bg-white border border-[var(--grid-border)] space-y-3">
        <div class="text-red-700 font-medium">Unable to load applicant assessment sessions.</div>
        <div class="text-xs text-stone-500">Please check your network connection or verify that the service is running.</div>
        <button id="retrySessionsBtn" class="px-4 py-2 bg-[var(--text-primary)] text-white text-xs uppercase tracking-widest hover:bg-[var(--accent-gold)] transition-colors">
          Retry
        </button>
      </div>
    `;
    document.getElementById('retrySessionsBtn')?.addEventListener('click', () => loadSessionsList(selectedStatus));
  }
}

async function loadSessionDetail(sessionId, forceRecompute = false) {
  const container = document.getElementById('researchContent');
  const apiBase = (window.ALFAAZ_API_URL !== undefined && window.ALFAAZ_API_URL !== null) ? window.ALFAAZ_API_URL : '';

  container.innerHTML = `
  <div class="mb-4">
    <button id="backToRegistryLoadingBtn" class="text-xs uppercase tracking-widest text-black hover:text-[var(--accent-gold)]">&larr; Back to Registry</button>
  </div>
  <div class="p-12 text-center text-[var(--text-secondary)] font-serif text-lg bg-white border border-[var(--grid-border)]">
    Loading applicant dossier${forceRecompute ? ' (re-analyzing telemetry)...' : '...'}
  </div>
  `;
  document.getElementById('backToRegistryLoadingBtn')?.addEventListener('click', () => loadSessionsList());

  try {
    const token = localStorage.getItem('alfaaz_token');
    const endpoint = `/recruit/research/sessions/${sessionId}${forceRecompute ? '?recompute=true' : ''}`;
    const resp = await window.globalApiFetch(endpoint);

    if (!resp.ok) {
        let errDetail = resp.statusText;
        try {
            const errJson = await resp.json();
            if (errJson && errJson.detail) errDetail = errJson.detail;
        } catch (_) {}
        throw new Error(`HTTP ${resp.status}: ${errDetail}`);
    }
    const data = await resp.json();

    const meta = data.metadata || {};
    const applicant = meta.applicant || {};
    const comparisons = data.measurement_comparisons || {};
    
    const candidateName = window.escapeHtml(applicant.full_name || 'Candidate');
    const candidateEmail = window.escapeHtml(applicant.email || '—');
    const candidatePhone = window.escapeHtml(applicant.phone_or_contact || '—');
    const candidateLinkedin = applicant.linkedin_url ? window.escapeHtml(applicant.linkedin_url) : null;
    const durationMin = meta.duration_minutes !== null ? `${meta.duration_minutes} min` : 'In progress';
    const booking = applicant.interview_booking || null;

    const rawPhone = applicant.phone_or_contact || '';
    const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
    const whatsappDirectLink = cleanPhone ? `
      <a href="https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hello ${applicant.full_name || ''}, this is the Alfaaz Collective recruitment team regarding your interview.`)}" target="_blank" rel="noopener noreferrer" class="text-[11px] text-[#1e6624] hover:underline inline-flex items-center gap-1 font-medium mt-1">
        <span>💬</span> Chat on WhatsApp &nearr;
      </a>` : '';

    const dims = data.dimensions || [];
    const summary = data.profile_summary || {};
    const completeness = summary.completeness || 'INSUFFICIENT';

    const levelBadge = (lvl) => {
      if (lvl === 'RELATIVELY_STRONG') return '<span class="px-2 py-0.5 bg-[#f5efe6] text-[#8c651e] border border-[#d4be98] text-[10px] font-semibold uppercase tracking-wider">Relatively Strong</span>';
      if (lvl === 'RELATIVELY_LOWER') return '<span class="px-2 py-0.5 bg-gray-100 text-black border border-gray-200 text-[10px] uppercase tracking-wider">Relatively Lower</span>';
      if (lvl === 'ABOUT_EQUAL') return '<span class="px-2 py-0.5 bg-gray-100 text-gray-600 border border-gray-300 text-[10px] uppercase tracking-wider">About Equal</span>';
      if (lvl === 'RELATIVELY_MIDDLE') return '<span class="px-2 py-0.5 bg-gray-50 text-gray-700 border border-gray-300 text-[10px] uppercase tracking-wider">Relatively Middle</span>';
      return '<span class="px-2 py-0.5 bg-gray-50 text-black border border-gray-200 text-[10px] uppercase tracking-wider">Insufficient</span>';
    };

    const relBadge = (rel) => {
      if (rel === 'ALIGNED') return '<span class="text-green-700 font-semibold uppercase text-[10px] tracking-wider">Aligned</span>';
      if (rel === 'PARTLY_ALIGNED') return '<span class="text-[var(--text-primary)] font-semibold uppercase text-[10px] tracking-wider">Partly Aligned</span>';
      if (rel === 'DIFFERENT') return '<span class="text-purple-700 font-semibold uppercase text-[10px] tracking-wider">Different</span>';
      if (rel === 'NOT_ENOUGH_EVIDENCE') return '<span class="text-stone-500 text-[10px]">Not Enough Evidence</span>';
      return '<span class="text-black text-[10px]">Not Available</span>';
    };

    const getDossierInterpretation = (d) => {
      const sjtVal = (d.sjt && d.sjt.relative !== null && d.sjt.relative !== undefined) ? Number(d.sjt.relative) : null;
      const gameVal = (d.game_relative !== null && d.game_relative !== undefined)
        ? Number(d.game_relative)
        : ((d.games && d.games.relative !== null && d.games.relative !== undefined) ? Number(d.games.relative) : null);
      const deltaVal = (d.cross_method_delta !== null && d.cross_method_delta !== undefined) ? Number(d.cross_method_delta) : null;
      const rel = d.relationship || 'NOT_AVAILABLE';
      const conf = d.confidence || 'LIMITED';
      const name = window.escapeHtml(d.display_name || d.parameter || 'Dimension');

      // Case 1: Neither method available
      if (sjtVal === null && gameVal === null) {
        return '<span class="text-stone-500 italic">Insufficient observations across methods.</span>';
      }

      // Case 2: Only SJT available (Game data pending or insufficient)
      if (sjtVal !== null && gameVal === null) {
        if (sjtVal >= 0.60) {
          return `High situational intent (${sjtVal.toFixed(2)}); deliberate scenario priority pending behavioral activity verification.`;
        } else if (sjtVal >= 0.40) {
          return `Balanced situational baseline (${sjtVal.toFixed(2)}); steady trade-off priority pending behavioral activity verification.`;
        } else {
          return `Lower situational priority (${sjtVal.toFixed(2)}); selective trade-off allocation pending behavioral activity verification.`;
        }
      }

      // Case 3: Only Games available (SJT missing)
      if (sjtVal === null && gameVal !== null) {
        if (gameVal >= 0.60) {
          return `Elevated behavioral activity (${gameVal.toFixed(2)}); strong task engagement pending situational trade-off confirmation.`;
        } else if (gameVal >= 0.40) {
          return `Moderate behavioral activity (${gameVal.toFixed(2)}); standard task engagement pending situational trade-off confirmation.`;
        } else {
          return `Lower behavioral activity (${gameVal.toFixed(2)}); minimal task engagement pending situational trade-off confirmation.`;
        }
      }

      // Case 4: Both methods available - Cross-method triangulation
      const deltaStr = deltaVal !== null ? deltaVal.toFixed(2) : (Math.abs(sjtVal - gameVal)).toFixed(2);
      const confTag = conf === 'SUBSTANTIAL' 
        ? '<span class="text-emerald-700 font-medium"> [High Confidence]</span>' 
        : (conf === 'MODERATE' ? '<span class="text-stone-600"> [Moderate Confidence]</span>' : '<span class="text-amber-700"> [Limited Confidence]</span>');

      // 4A: ALIGNED (Delta <= 0.15)
      if (rel === 'ALIGNED' || (deltaVal !== null && deltaVal <= 0.15)) {
        if (sjtVal >= 0.55 && gameVal >= 0.55) {
          return `<strong>Strong convergent strength</strong> (&Delta; ${deltaStr}). High deliberate priority matches active simulation execution.${confTag}`;
        } else if (sjtVal < 0.38 && gameVal < 0.38) {
          return `<strong>Consistently lower emphasis</strong> (&Delta; ${deltaStr}). Selectively allocated away across both judgment trade-offs and simulation.${confTag}`;
        } else {
          return `<strong>Harmonious baseline</strong> (&Delta; ${deltaStr}). Stated trade-offs closely mirror practical simulation actions.${confTag}`;
        }
      }

      // 4B: PARTLY_ALIGNED (0.15 < Delta <= 0.30)
      if (rel === 'PARTLY_ALIGNED' || (deltaVal !== null && deltaVal <= 0.30)) {
        if (sjtVal > gameVal) {
          return `<strong>Moderate judgment emphasis</strong> (&Delta; ${deltaStr}). Higher conceptual importance in trade-offs than manifested in simulation.${confTag}`;
        } else {
          return `<strong>Moderate behavioral emphasis</strong> (&Delta; ${deltaStr}). Higher hands-on task engagement than expressed in judgment trade-offs.${confTag}`;
        }
      }

      // 4C: DIFFERENT (Delta > 0.30)
      if (rel === 'DIFFERENT' || (deltaVal !== null && deltaVal > 0.30)) {
        if (sjtVal > gameVal) {
          return `<strong>Marked divergence</strong> (&Delta; ${deltaStr}). High stated situational intent contrasts with lower task execution; explore aspirational values in interview.${confTag}`;
        } else {
          return `<strong>Marked divergence</strong> (&Delta; ${deltaStr}). Hands-on execution exceeds stated situational priority; suggests tacit, unstated capability. Explore in interview.${confTag}`;
        }
      }

      // Fallback for edge cases
      if (rel === 'NOT_ENOUGH_EVIDENCE') {
        return `<span class="text-stone-500 italic">Inconclusive evidence (&Delta; ${deltaStr}); observations below verification threshold.${confTag}</span>`;
      }

      return `Provisional data (&Delta; ${deltaStr}): SJT ${sjtVal.toFixed(2)}, Games ${gameVal.toFixed(2)}.${confTag}`;
    };

    let activeSortMode = 'sjt';
    const hasSjt = dims.some(d => d.sjt && d.sjt.relative !== null && d.sjt.relative !== undefined);
    const hasGame = dims.some(d => (d.game_relative !== null && d.game_relative !== undefined) || (d.games && d.games.relative !== null && d.games.relative !== undefined));
    const hasDelta = dims.some(d => d.cross_method_delta !== null && d.cross_method_delta !== undefined);

    if (!hasSjt && hasGame) {
      activeSortMode = 'game';
    }

    const sortDimensions = (mode) => {
      return [...dims].sort((a, b) => {
        let valA, valB, tieA, tieB;
        if (mode === 'game') {
          valA = a.game_relative !== null && a.game_relative !== undefined 
            ? Number(a.game_relative) 
            : ((a.games && a.games.relative !== null && a.games.relative !== undefined) ? Number(a.games.relative) : -Infinity);
          valB = b.game_relative !== null && b.game_relative !== undefined 
            ? Number(b.game_relative) 
            : ((b.games && b.games.relative !== null && b.games.relative !== undefined) ? Number(b.games.relative) : -Infinity);
          tieA = a.sjt?.relative !== null && a.sjt?.relative !== undefined ? Number(a.sjt.relative) : -Infinity;
          tieB = b.sjt?.relative !== null && b.sjt?.relative !== undefined ? Number(b.sjt.relative) : -Infinity;
        } else if (mode === 'delta') {
          valA = a.cross_method_delta !== null && a.cross_method_delta !== undefined ? Number(a.cross_method_delta) : -Infinity;
          valB = b.cross_method_delta !== null && b.cross_method_delta !== undefined ? Number(b.cross_method_delta) : -Infinity;
          tieA = a.sjt?.relative !== null && a.sjt?.relative !== undefined ? Number(a.sjt.relative) : -Infinity;
          tieB = b.sjt?.relative !== null && b.sjt?.relative !== undefined ? Number(b.sjt.relative) : -Infinity;
        } else {
          // default: 'sjt'
          valA = a.sjt?.relative !== null && a.sjt?.relative !== undefined ? Number(a.sjt.relative) : -Infinity;
          valB = b.sjt?.relative !== null && b.sjt?.relative !== undefined ? Number(b.sjt.relative) : -Infinity;
          tieA = a.game_relative !== null && a.game_relative !== undefined 
            ? Number(a.game_relative) 
            : ((a.games && a.games.relative !== null && a.games.relative !== undefined) ? Number(a.games.relative) : -Infinity);
          tieB = b.game_relative !== null && b.game_relative !== undefined 
            ? Number(b.game_relative) 
            : ((b.games && b.games.relative !== null && b.games.relative !== undefined) ? Number(b.games.relative) : -Infinity);
        }

        if (valB !== valA) return valB - valA;
        if (tieB !== tieA) return tieB - tieA;
        return (a.display_name || a.parameter || '').localeCompare(b.display_name || b.parameter || '');
      });
    };

    const renderDimensionRowsHtml = (sortedList, mode) => {
      return sortedList.map((d, index) => {
        const relDisp = relBadge(d.relationship);
        const confDisp = d.confidence || 'LIMITED';
        const safeName = window.escapeHtml(d.display_name || d.parameter);
        const sjtRel = (d.sjt && d.sjt.relative !== null && d.sjt.relative !== undefined) ? d.sjt.relative.toFixed(2) : '—';
        const gameRel = (d.game_relative !== null && d.game_relative !== undefined) ? d.game_relative.toFixed(2) : ((d.games && d.games.relative !== null && d.games.relative !== undefined) ? d.games.relative.toFixed(2) : '—');
        const deltaDisp = (d.cross_method_delta !== null && d.cross_method_delta !== undefined) ? d.cross_method_delta.toFixed(2) : '—';
        const obs = window.escapeHtml(d.observed_behavior || '—');
        const interp = getDossierInterpretation(d);
        const rankNum = index + 1;

        const sjtColStyle = mode === 'sjt' ? 'font-bold bg-[#faf8f5]' : '';
        const gameColStyle = mode === 'game' ? 'font-bold bg-[#faf8f5]' : '';
        const deltaColStyle = mode === 'delta' ? 'font-bold bg-[#faf8f5]' : '';

        return `
        <tr class="group border-b border-[var(--grid-border)] hover:bg-[#faf9f6] transition-colors">
          <td scope="row" class="p-3 text-center font-mono text-xs font-semibold text-stone-500 w-12 min-w-[48px] max-w-[48px] sticky-col-rank bg-white group-hover:bg-[#faf9f6] transition-colors">${rankNum}</td>
          <td class="p-3 font-medium text-[var(--text-primary)] min-w-[200px] sticky-col-dim bg-white group-hover:bg-[#faf9f6] transition-colors">
            <div>${safeName}</div>
            <div class="text-[10px] text-stone-600 mt-0.5 line-clamp-2" title="${obs}">${obs}</div>
          </td>
          <td class="p-3 text-center font-mono text-xs ${sjtColStyle}">${sjtRel}</td>
          <td class="p-3 text-center font-mono text-xs ${gameColStyle}">${gameRel}</td>
          <td class="p-3 text-center font-mono text-xs ${deltaColStyle}">${deltaDisp}</td>
          <td class="p-3 text-center text-xs whitespace-nowrap">${relDisp}</td>
          <td class="p-3 text-center text-[10px] uppercase text-black font-semibold whitespace-nowrap">${confDisp}</td>
          <td class="p-3 text-xs text-[var(--text-primary)] leading-relaxed min-w-[280px]">${interp}</td>
        </tr>
        `;
      }).join('');
    };

    const batteryVer = meta.battery_version === '2.0' ? 'V2 (14-Game Candidate Core)' : (meta.battery_version === '1.0' ? 'V1 (21-Game Historical Battery)' : (meta.battery_version || '2.0 (Candidate Core)'));
    const taskRecords = data.task_records || [];
    const coreTasks = taskRecords.filter(t => t.battery_role === 'candidate_core' || (!t.battery_role && !['F3','A3','C3','E3','Q3','CR2','M3'].includes(t.game_id)));
    const bankTasks = taskRecords.filter(t => t.battery_role === 'research_bank' || (t.battery_role !== 'candidate_core' && ['F3','A3','C3','E3','Q3','CR2','M3'].includes(t.game_id)));

    // Key Takeaways & Divergence summary metrics
    const validDeltas = dims
      .filter(d => d.cross_method_delta !== null && d.cross_method_delta !== undefined)
      .map(d => ({
        name: d.display_name || d.parameter || 'Dimension',
        delta: Number(d.cross_method_delta),
        sjt: (d.sjt && d.sjt.relative !== null && d.sjt.relative !== undefined) ? Number(d.sjt.relative) : null,
        game: (d.game_relative !== null && d.game_relative !== undefined) 
          ? Number(d.game_relative) 
          : ((d.games && d.games.relative !== null && d.games.relative !== undefined) ? Number(d.games.relative) : null),
        rel: d.relationship || 'NOT_AVAILABLE'
      }))
      .sort((a, b) => b.delta - a.delta);

    const topDivergence = validDeltas.length > 0 ? validDeltas[0] : null;

    const substantialConfCount = dims.filter(d => d.confidence === 'SUBSTANTIAL').length;
    const moderateConfCount = dims.filter(d => d.confidence === 'MODERATE').length;
    const limitedConfCount = dims.filter(d => d.confidence === 'LIMITED' || !d.confidence).length;

    let topDivergenceHtml = '';
    if (topDivergence && topDivergence.delta > 0.15) {
      const dirText = (topDivergence.sjt !== null && topDivergence.game !== null)
        ? (topDivergence.sjt > topDivergence.game 
            ? 'Higher situational trade-off than simulation execution' 
            : 'Higher simulation execution than situational trade-off')
        : 'Cross-method variance detected';
      topDivergenceHtml = `
        <div class="text-[var(--text-primary)] font-medium font-serif">${window.escapeHtml(topDivergence.name)} (&Delta; ${topDivergence.delta.toFixed(2)})</div>
        <div class="text-[11px] text-stone-600 mt-0.5">${dirText}. Explore balance during structured interview.</div>
      `;
    } else if (topDivergence) {
      topDivergenceHtml = `
        <div class="text-emerald-700 font-medium">Harmonious alignment across methods</div>
        <div class="text-[11px] text-stone-600 mt-0.5">Max divergence is minimal (&Delta; ${topDivergence.delta.toFixed(2)}). Stated trade-offs mirror task execution.</div>
      `;
    } else {
      topDivergenceHtml = `
        <div class="text-stone-500 italic">Method triangulation pending</div>
        <div class="text-[11px] text-stone-500 mt-0.5">Divergence metrics will populate once both situational and game observations are recorded.</div>
      `;
    }

    const confidenceDistHtml = `
      <div class="flex items-center gap-2 text-xs">
        <span class="text-emerald-700 font-mono font-medium">${substantialConfCount} High</span>
        <span class="text-stone-400">&bull;</span>
        <span class="text-stone-700 font-mono">${moderateConfCount} Moderate</span>
        <span class="text-stone-400">&bull;</span>
        <span class="text-amber-800 font-mono">${limitedConfCount} Limited</span>
      </div>
      <div class="text-[11px] text-stone-600 mt-0.5">Evidence confidence reflects observation volume and stability.</div>
    `;

    const completenessBadge = completeness === 'COMPLETE'
      ? '<span class="text-emerald-700 font-medium font-mono">COMPLETE</span>'
      : (completeness === 'PARTIAL' 
          ? '<span class="text-stone-700 font-medium font-mono">PARTIAL</span>' 
          : '<span class="text-amber-800 font-medium font-mono">INSUFFICIENT</span>');

    const completenessCardHtml = `
      <div class="text-xs">${completenessBadge} &mdash; <span class="font-mono">${batteryVer}</span></div>
      <div class="text-[11px] text-stone-600 mt-0.5">Duration: ${durationMin}. All observations remain provisional.</div>
    `;

    const renderTaskTable = (tasks, roleLabel, badgeStyle) => {
      if (!tasks || tasks.length === 0) return '';
      return `
      <div class="mb-4">
        <div class="flex justify-between items-baseline mb-2">
          <h4 class="text-xs font-semibold tracking-wider uppercase text-[var(--text-primary)] flex items-center gap-2">
            <span class="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider" style="${badgeStyle}">${roleLabel}</span>
            <span>Activities (${tasks.length})</span>
          </h4>
        </div>
        <div class="overflow-x-auto border border-[var(--grid-border)] bg-white">
          <table class="w-full text-left text-xs">
            <thead class="bg-[#f0eeea] text-[10px] uppercase tracking-wider text-black">
              <tr>
                <th class="p-3">Activity</th>
                <th class="p-3">World</th>
                <th class="p-3">Status</th>
                <th class="p-3">Descriptive Behavioral Observation</th>
              </tr>
            </thead>
            <tbody>
              ${tasks.map(t => {
                const statusBg = (t.status === 'RECORDED' || t.status === 'USABLE') ? 'background:#eaf5ea; color:#1e6624; border:1px solid #bce0bc;' : (t.status === 'NOT_DERIVED' ? 'background:#f0eeea; color:var(--text-secondary); border:1px solid var(--grid-border);' : 'background:#fdf2e9; color:#9c4221; border:1px solid #f0cdb8;');
                const dispText = t.status === 'NOT_DERIVED' ? '<span class="text-black italic">Unattempted &middot; Reserved in Research Bank</span>' : window.escapeHtml(t.display_text || '—');
                return `
                <tr class="border-b border-[var(--grid-border)]">
                  <td class="p-3 font-semibold text-[var(--text-primary)]">${t.game_id}: ${window.escapeHtml(t.game_name || t.game_id)}</td>
                  <td class="p-3 text-black">${t.world_id}: ${window.escapeHtml(t.world_name || '')}</td>
                  <td class="p-3"><span class="badge" style="font-size:10px; ${statusBg}">${t.status}</span></td>
                  <td class="p-3 text-black leading-relaxed">${dispText}</td>
                </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
      `;
    };

    container.innerHTML = `
    <div class="mb-4 flex justify-between items-center">
      <button id="backToRegistryBtn" class="text-xs uppercase tracking-widest text-black hover:text-[var(--accent-gold)]">&larr; Back to Registry</button>
      <button id="recomputeTelemetryBtn" class="px-3 py-1 bg-[#f4f1ea] border border-[var(--grid-border)] text-[10px] uppercase tracking-wider hover:bg-[#eae6dc] transition-colors" title="Re-extracts and re-scores behavioral game telemetry from scratch (opt-in recalculation)">
        Re-analyze Telemetry
      </button>
    </div>
    
    <div class="bg-[#faf8f5] border border-[var(--grid-border)] p-6 mb-4">
      <h3 class="text-xs font-semibold tracking-widest uppercase text-[var(--accent-gold)] mb-4">1. Candidate & Session Overview</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 text-sm">
        <div><strong class="block text-black text-xs uppercase tracking-wider mb-1">Name</strong>${candidateName}</div>
        <div><strong class="block text-black text-xs uppercase tracking-wider mb-1">Email</strong>${candidateEmail}</div>
        <div>
          <strong class="block text-black text-xs uppercase tracking-wider mb-1">WhatsApp / Contact</strong>
          <div>${candidatePhone}</div>
          ${whatsappDirectLink}
        </div>
        <div>
          <strong class="block text-black text-xs uppercase tracking-wider mb-1">Interview Slot</strong>
          ${booking ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-[#eaf5ea] border border-[#bce0bc] text-[#1e6624] text-xs font-semibold">📅 ${window.escapeHtml(booking.slot_display || `${booking.slot_date} ${booking.slot_time}`)}</span>` : '<span class="text-stone-400 text-xs italic">Not scheduled</span>'}
        </div>
        <div><strong class="block text-black text-xs uppercase tracking-wider mb-1">LinkedIn / CV</strong>${candidateLinkedin ? `<a href="${candidateLinkedin.startsWith('http') ? candidateLinkedin : 'https://' + candidateLinkedin}" target="_blank" rel="noopener noreferrer" class="text-[var(--accent-gold)] hover:underline block truncate" title="${candidateLinkedin}">Open Link &nearr;</a>` : '<span class="text-stone-400">—</span>'}</div>
        <div><strong class="block text-black text-xs uppercase tracking-wider mb-1">Session Duration</strong>${durationMin}</div>
        <div><strong class="block text-black text-xs uppercase tracking-wider mb-1">Battery Version</strong><span class="badge" style="font-size:10px; background:#f0eeea; color:var(--text-primary); border:1px solid var(--grid-border);">${batteryVer}</span></div>
      </div>
      ${booking ? `
      <div class="mt-4 pt-3 border-t border-[var(--grid-border)] flex flex-wrap items-center justify-between gap-3 text-xs bg-white p-3 border border-[#bce0bc]">
        <div class="flex items-center gap-2 text-[#1e6624]">
          <span class="text-base">📅</span>
          <div>
            <span class="font-semibold uppercase tracking-wider text-[10px]">Confirmed Interview Slot:</span>
            <span class="font-serif text-sm ml-1 text-black">${window.escapeHtml(booking.slot_display || `${booking.slot_date} at ${booking.slot_time}`)}</span>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <button id="rescheduleBtn" class="px-2.5 py-1 bg-[var(--text-primary)] text-white text-[11px] font-medium hover:bg-[var(--accent-gold)] transition-colors inline-flex items-center gap-1">Change / Reschedule Slot</button>
          ${cleanPhone ? `<a href="https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hello ${applicant.full_name || ''}, this is the Alfaaz Collective recruitment team confirming your interview slot: ${booking.slot_display || `${booking.slot_date} ${booking.slot_time}`}.`)}" target="_blank" rel="noopener noreferrer" class="px-2.5 py-1 bg-[#25D366] text-white rounded text-[11px] font-medium hover:opacity-90 inline-flex items-center gap-1">Open WhatsApp Chat &nearr;</a>` : ''}
          <a href="mailto:${window.escapeHtml(applicant.email || '')}?subject=${encodeURIComponent(`Alfaaz Collective — Interview Confirmation: ${booking.slot_display || booking.slot_date}`)}" class="px-2.5 py-1 border border-[var(--grid-border)] bg-[#faf8f5] text-black text-[11px] font-medium hover:bg-stone-100">Send Email</a>
        </div>
      </div>
      ` : `
      <div class="mt-4 pt-3 border-t border-[var(--grid-border)] flex flex-wrap items-center justify-between gap-3 text-xs bg-white p-3 border border-[var(--grid-border)]">
        <div class="text-stone-500 italic">Interview timing is currently unassigned for this candidate.</div>
        <div>
          <button id="rescheduleBtn" class="px-2.5 py-1 bg-[var(--text-primary)] text-white text-[11px] font-medium hover:bg-[var(--accent-gold)] transition-colors inline-flex items-center gap-1">Assign / Schedule Slot</button>
        </div>
      </div>
      `}
    </div>

    <div class="bg-white border-l-4 border-[var(--accent-gold)] border-t border-r border-b border-[var(--grid-border)] p-4 mb-4 text-xs text-black leading-relaxed">
      <strong class="text-[var(--text-primary)] uppercase tracking-wider">Psychometric Safeguard Notice:</strong>
      This dossier provides a <em>provisional within-person relative profile</em> for exploratory human review only. It reflects the relative emphasis among dimensions for this candidate, NOT normative trait scores, clinical evaluation, or automated hiring decisions. Cross-method convergence is exploratory; empirical normative calibration is pending.
      <div class="mt-2 text-[11px] text-[var(--text-secondary)] italic">${meta.safeguards?.sjt_emphasis_note || "Relative emphasis in this SJT's trade-offs: higher / middle / lower."}</div>
    </div>

    <!-- Key Observations & Method Triangulation Card -->
    <details class="bg-white border border-[var(--grid-border)] p-4 mb-6 text-xs group" open>
      <summary class="font-semibold text-xs uppercase tracking-widest text-[var(--accent-gold)] cursor-pointer flex justify-between items-center select-none">
        <span>Key Observations & Method Triangulation</span>
        <span class="text-[10px] text-stone-500 font-normal lowercase tracking-normal group-open:hidden">(click to expand)</span>
        <span class="text-[10px] text-stone-500 font-normal lowercase tracking-normal hidden group-open:inline">(click to collapse)</span>
      </summary>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 pt-3 border-t border-[var(--grid-border)]">
        <div>
          <span class="block text-[10px] uppercase tracking-wider text-black font-semibold mb-1">Top Method Divergence</span>
          ${topDivergenceHtml}
        </div>
        <div>
          <span class="block text-[10px] uppercase tracking-wider text-black font-semibold mb-1">Confidence Distribution</span>
          ${confidenceDistHtml}
        </div>
        <div>
          <span class="block text-[10px] uppercase tracking-wider text-black font-semibold mb-1">Profile Completeness</span>
          ${completenessCardHtml}
        </div>
      </div>
    </details>

    <div class="mb-6">
      <div class="flex flex-wrap justify-between items-center gap-3 mb-3">
        <div class="flex items-center gap-3 flex-wrap">
          <h3 class="text-xs font-semibold tracking-widest uppercase text-[var(--accent-gold)]">2. Evidence by parameter</h3>
          <div class="inline-flex items-center gap-1.5 p-1 bg-[#f0eeea] border border-[var(--grid-border)]" role="group" aria-label="Sort dimensions">
            <span class="text-[10px] uppercase font-mono tracking-wider text-black px-1.5 font-semibold">Rank By:</span>
            <button id="sortBySjtBtn" class="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors ${activeSortMode === 'sjt' ? 'bg-[var(--text-primary)] text-white' : 'text-stone-700 hover:bg-[#e4e1dc]'} ${!hasSjt ? 'opacity-40 cursor-not-allowed' : ''}" ${!hasSjt ? 'disabled title="No SJT data"' : 'title="Rank by Written Situational Trade-offs"'}>
              Written (SJT) ${activeSortMode === 'sjt' ? '&darr;' : ''}
            </button>
            <button id="sortByGameBtn" class="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors ${activeSortMode === 'game' ? 'bg-[var(--text-primary)] text-white' : 'text-stone-700 hover:bg-[#e4e1dc]'} ${!hasGame ? 'opacity-40 cursor-not-allowed' : ''}" ${!hasGame ? 'disabled title="Game data pending"' : 'title="Rank by Practical Hands-On Game Performance"'}>
              Hands-On (Games) ${activeSortMode === 'game' ? '&darr;' : ''}
            </button>
            <button id="sortByDeltaBtn" class="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors ${activeSortMode === 'delta' ? 'bg-[var(--text-primary)] text-white' : 'text-stone-700 hover:bg-[#e4e1dc]'} ${!hasDelta ? 'opacity-40 cursor-not-allowed' : ''}" ${!hasDelta ? 'disabled title="Requires both SJT and Game data"' : 'title="Rank by Largest Difference Between Words and Actions"'}>
              Difference (&Delta;) ${activeSortMode === 'delta' ? '&darr;' : ''}
            </button>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="inline-flex items-center gap-1 p-0.5 bg-[#f0eeea] border border-[var(--grid-border)]" role="group" aria-label="Table density">
            <button id="densityComfortableBtn" class="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors bg-[var(--text-primary)] text-white" title="Comfortable row padding">Comfortable</button>
            <button id="densityCompactBtn" class="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors text-stone-700 hover:bg-[#e4e1dc]" title="Compact row padding">Compact</button>
          </div>
          <span class="text-xs uppercase tracking-wider text-black">Profile Completeness: <strong class="text-[var(--text-primary)]">${completeness}</strong></span>
        </div>
      </div>
      <div class="overflow-x-auto border border-[var(--grid-border)] bg-white max-h-[600px]">
        <table id="dimensionTable" class="w-full text-left text-sm border-collapse">
          <thead class="bg-[#f0eeea] text-xs uppercase tracking-wider text-black select-none">
            <tr>
              <th scope="col" class="p-3 text-center w-12 min-w-[48px] max-w-[48px] sticky-th bg-[#f0eeea] sticky-col-rank sticky-th-corner">#</th>
              <th scope="col" class="p-3 sticky-th bg-[#f0eeea] sticky-col-dim">Dimension & Observed Context</th>
              <th scope="col" id="thSjt" class="p-3 text-center cursor-pointer hover:bg-[#e4e1dc] transition-colors sticky-th bg-[#f0eeea]" title="Click to rank by SJT" aria-sort="${activeSortMode === 'sjt' ? 'descending' : 'none'}" aria-label="Rank by Written Situational Trade-offs">SJT Rel <span id="thSjtArrow">${activeSortMode === 'sjt' ? '&darr;' : ''}</span></th>
              <th scope="col" id="thGame" class="p-3 text-center cursor-pointer hover:bg-[#e4e1dc] transition-colors sticky-th bg-[#f0eeea]" title="Click to rank by Game" aria-sort="${activeSortMode === 'game' ? 'descending' : 'none'}" aria-label="Rank by Practical Hands-On Game Performance">Game Rel <span id="thGameArrow">${activeSortMode === 'game' ? '&darr;' : ''}</span></th>
              <th scope="col" id="thDelta" class="p-3 text-center cursor-pointer hover:bg-[#e4e1dc] transition-colors sticky-th bg-[#f0eeea]" title="Click to rank by Delta" aria-sort="${activeSortMode === 'delta' ? 'descending' : 'none'}" aria-label="Rank by Largest Difference Between Words and Actions">Delta <span id="thDeltaArrow">${activeSortMode === 'delta' ? '&darr;' : ''}</span></th>
              <th scope="col" class="p-3 text-center sticky-th bg-[#f0eeea]">Relationship</th>
              <th scope="col" class="p-3 text-center sticky-th bg-[#f0eeea]">Confidence</th>
              <th scope="col" class="p-3 sticky-th bg-[#f0eeea]">Interpretation</th>
            </tr>
          </thead>
          <tbody id="dimensionTableBody">
            ${renderDimensionRowsHtml(sortDimensions(activeSortMode), activeSortMode)}
          </tbody>
        </table>
      </div>
      <div class="bg-[#fcfbf9] border border-[var(--grid-border)] border-t-0 p-3 text-xs text-black leading-relaxed">
        <strong class="text-[var(--text-primary)]">Delta is the absolute difference between the candidate's SJT-relative evidence and Game-SJT-relative evidence for this dimension.</strong> Larger Delta indicates greater divergence and reduces evidence confidence. Delta is not a measure of honesty, reliability, or validity.
      </div>
    </div>

    <div class="mb-6">
      <div class="flex justify-between items-baseline mb-3">
        <h3 class="text-xs font-semibold tracking-widest uppercase text-[var(--accent-gold)]">3. Interactive Activity Behavioral Records</h3>
        <span class="text-xs text-black">${data.task_records_statement || 'Descriptive task counts; not a score.'}</span>
      </div>
      ${renderTaskTable(coreTasks, 'Core Battery', 'background:#eaf5ea; color:#1e6624; border:1px solid #bce0bc;')}
      ${renderTaskTable(bankTasks, 'Research Bank', 'background:#f0eeea; color:var(--text-secondary); border:1px solid var(--grid-border);')}
    </div>
    `;
    document.getElementById('backToRegistryBtn')?.addEventListener('click', () => loadSessionsList());
    document.getElementById('recomputeTelemetryBtn')?.addEventListener('click', () => loadSessionDetail(sessionId, true));
    document.getElementById('rescheduleBtn')?.addEventListener('click', () => openRescheduleModal(sessionId, applicant, booking));

    const updateTableSort = (newMode) => {
      activeSortMode = newMode;
      const tbody = document.getElementById('dimensionTableBody');
      if (tbody) {
        tbody.innerHTML = renderDimensionRowsHtml(sortDimensions(activeSortMode), activeSortMode);
      }
      const btnSjt = document.getElementById('sortBySjtBtn');
      const btnGame = document.getElementById('sortByGameBtn');
      const btnDelta = document.getElementById('sortByDeltaBtn');
      if (btnSjt && hasSjt) {
        btnSjt.className = `px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors ${activeSortMode === 'sjt' ? 'bg-[var(--text-primary)] text-white' : 'text-stone-700 hover:bg-[#e4e1dc]'}`;
        btnSjt.innerHTML = `Written (SJT) ${activeSortMode === 'sjt' ? '&darr;' : ''}`;
      }
      if (btnGame && hasGame) {
        btnGame.className = `px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors ${activeSortMode === 'game' ? 'bg-[var(--text-primary)] text-white' : 'text-stone-700 hover:bg-[#e4e1dc]'}`;
        btnGame.innerHTML = `Hands-On (Games) ${activeSortMode === 'game' ? '&darr;' : ''}`;
      }
      if (btnDelta && hasDelta) {
        btnDelta.className = `px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors ${activeSortMode === 'delta' ? 'bg-[var(--text-primary)] text-white' : 'text-stone-700 hover:bg-[#e4e1dc]'}`;
        btnDelta.innerHTML = `Difference (&Delta;) ${activeSortMode === 'delta' ? '&darr;' : ''}`;
      }
      const thSjtArrow = document.getElementById('thSjtArrow');
      const thGameArrow = document.getElementById('thGameArrow');
      const thDeltaArrow = document.getElementById('thDeltaArrow');
      if (thSjtArrow) thSjtArrow.innerHTML = activeSortMode === 'sjt' ? '&darr;' : '';
      if (thGameArrow) thGameArrow.innerHTML = activeSortMode === 'game' ? '&darr;' : '';
      if (thDeltaArrow) thDeltaArrow.innerHTML = activeSortMode === 'delta' ? '&darr;' : '';

      const thSjt = document.getElementById('thSjt');
      const thGame = document.getElementById('thGame');
      const thDelta = document.getElementById('thDelta');
      if (thSjt) thSjt.setAttribute('aria-sort', activeSortMode === 'sjt' ? 'descending' : 'none');
      if (thGame) thGame.setAttribute('aria-sort', activeSortMode === 'game' ? 'descending' : 'none');
      if (thDelta) thDelta.setAttribute('aria-sort', activeSortMode === 'delta' ? 'descending' : 'none');
    };

    if (hasSjt) {
      document.getElementById('sortBySjtBtn')?.addEventListener('click', () => updateTableSort('sjt'));
      document.getElementById('thSjt')?.addEventListener('click', () => updateTableSort('sjt'));
    }
    if (hasGame) {
      document.getElementById('sortByGameBtn')?.addEventListener('click', () => updateTableSort('game'));
      document.getElementById('thGame')?.addEventListener('click', () => updateTableSort('game'));
    }
    if (hasDelta) {
      document.getElementById('sortByDeltaBtn')?.addEventListener('click', () => updateTableSort('delta'));
      document.getElementById('thDelta')?.addEventListener('click', () => updateTableSort('delta'));
    }

    const dimTable = document.getElementById('dimensionTable');
    const btnComfortable = document.getElementById('densityComfortableBtn');
    const btnCompact = document.getElementById('densityCompactBtn');

    btnComfortable?.addEventListener('click', () => {
      dimTable?.classList.remove('compact-table');
      btnComfortable.className = 'px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors bg-[var(--text-primary)] text-white';
      btnCompact.className = 'px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors text-stone-700 hover:bg-[#e4e1dc]';
    });

    btnCompact?.addEventListener('click', () => {
      dimTable?.classList.add('compact-table');
      btnCompact.className = 'px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors bg-[var(--text-primary)] text-white';
      btnComfortable.className = 'px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors text-stone-700 hover:bg-[#e4e1dc]';
    });

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error('Failed to load applicant dossier:', err);
    container.innerHTML = `
    <div class="mb-4">
      <button id="backToRegistryErrBtn" class="text-xs uppercase tracking-widest text-black hover:text-[var(--accent-gold)]">&larr; Back to Registry</button>
    </div>
    <div class="p-8 text-center bg-white border border-[var(--grid-border)] space-y-4">
      <div class="text-red-700 font-semibold">Unable to load applicant dossier</div>
      <div class="text-xs text-stone-600 max-w-md mx-auto">An error occurred while compiling the evidence record. You can attempt to reload or trigger an opt-in telemetry recalculation.</div>
      <div class="flex justify-center gap-3 pt-2">
        <button id="retryDossierBtn" class="px-4 py-2 bg-[var(--text-primary)] text-white text-xs uppercase tracking-widest hover:bg-[var(--accent-gold)] transition-colors">Retry</button>
        <button id="recomputeDossierBtn" class="px-4 py-2 bg-[#f4f1ea] border border-[var(--grid-border)] text-xs uppercase tracking-widest hover:bg-[#eae6dc] transition-colors" title="Re-extracts and re-scores behavioral game telemetry from scratch (opt-in recalculation)">Re-analyze Telemetry</button>
      </div>
    </div>
    `;
    document.getElementById('backToRegistryErrBtn')?.addEventListener('click', () => loadSessionsList());
    document.getElementById('retryDossierBtn')?.addEventListener('click', () => loadSessionDetail(sessionId, false));
    document.getElementById('recomputeDossierBtn')?.addEventListener('click', () => loadSessionDetail(sessionId, true));
  }
}

window.loadSessionsList = loadSessionsList;
window.loadSessionDetail = loadSessionDetail;

async function openInterviewSettingsModal() {
  const apiBase = (window.ALFAAZ_API_URL !== undefined && window.ALFAAZ_API_URL !== null) ? window.ALFAAZ_API_URL : '';
  const token = localStorage.getItem('alfaaz_token');
  
  let modal = document.getElementById('interviewSettingsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'interviewSettingsModal';
    document.body.appendChild(modal);
  }
  
  modal.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white border border-[var(--grid-border)] max-w-lg w-full p-6 space-y-4 shadow-xl">
      <div class="flex justify-between items-center border-b border-[var(--grid-border)] pb-3">
        <h3 class="font-serif text-lg text-[var(--text-primary)]">Interview Schedule & Working Hours</h3>
        <button id="closeSettingsModalBtn" class="text-stone-400 hover:text-black text-lg">&times;</button>
      </div>
      <div id="settingsModalBody" class="space-y-4 text-xs">
        <div class="text-stone-500">Loading current configuration...</div>
      </div>
    </div>
  `;

  document.getElementById('closeSettingsModalBtn')?.addEventListener('click', () => modal.remove());

  try {
    const resp = await window.globalApiFetch('/recruit/research/interview-settings');
    const data = await resp.json();
    const currentSlots = (data.slots || []).join(', ');
    const skipDays = data.skip_days || ['Sunday'];
    const daysList = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    const bodyEl = document.getElementById('settingsModalBody');
    bodyEl.innerHTML = `
      <div>
        <label class="block font-semibold uppercase tracking-wider text-[11px] text-[var(--text-primary)] mb-1">
          Available Time Slots (Comma-separated)
        </label>
        <p class="text-[11px] text-stone-500 mb-2">Candidates will be offered these time windows on active interview days (e.g. 11:00 AM, 03:00 PM, 05:30 PM, 07:00 PM).</p>
        <input type="text" id="settingsSlotsInput" value="${window.escapeHtml(currentSlots)}" class="w-full p-2 border border-[var(--grid-border)] text-xs font-mono focus:outline-none focus:border-[var(--accent-gold)]" placeholder="11:00 AM, 03:00 PM, 05:30 PM, 07:00 PM" />
      </div>

      <div>
        <label class="block font-semibold uppercase tracking-wider text-[11px] text-[var(--text-primary)] mb-1">
          Days Off / Excluded Days
        </label>
        <p class="text-[11px] text-stone-500 mb-2">Slots will not be generated for designated off-days.</p>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          ${daysList.map(d => `
            <label class="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" name="skipDayCheck" value="${d}" ${skipDays.includes(d) ? 'checked' : ''} class="accent-[var(--accent-gold)]" />
              <span>${d}</span>
            </label>
          `).join('')}
        </div>
      </div>

      <div class="pt-3 border-t border-[var(--grid-border)] space-y-1.5">
        <label class="block font-semibold uppercase tracking-wider text-[11px] text-[var(--text-primary)]">
          Make.com Webhook Test & Data Detection
        </label>
        <p class="text-[11px] text-stone-500">
          Click &ldquo;Detect new values&rdquo; in Make.com, then click below to transmit the standard <code>to</code>, <code>subject</code>, and <code>text</code> payload.
        </p>
        <div class="flex items-center gap-2">
          <input type="text" id="customWebhookUrlInput" placeholder="Optional: Paste Webhook URL if not configured in Render" class="flex-grow p-1.5 border border-[var(--grid-border)] text-xs font-mono focus:outline-none" />
          <button type="button" id="sendTestWebhookBtn" class="px-3 py-1.5 bg-[#f4f1ea] border border-[var(--grid-border)] text-xs text-[var(--text-primary)] hover:bg-[#eae6dc] transition-colors whitespace-nowrap">
            📡 Send Test Payload
          </button>
        </div>
        <div id="testWebhookFeedback" class="text-[11px] hidden"></div>
      </div>

      <div id="settingsFeedback" class="text-[11px] hidden"></div>

      <div class="pt-3 border-t border-[var(--grid-border)] flex justify-end gap-2">
        <button id="cancelSettingsBtn" class="px-3 py-1.5 border border-[var(--grid-border)] text-xs text-stone-600 hover:bg-stone-50">Cancel</button>
        <button id="saveSettingsBtn" class="px-4 py-1.5 bg-[var(--text-primary)] text-white text-xs uppercase tracking-wider hover:bg-[var(--accent-gold)] transition-colors">
          Save Schedule
        </button>
      </div>
    `;

    document.getElementById('sendTestWebhookBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('sendTestWebhookBtn');
      const feedback = document.getElementById('testWebhookFeedback');
      const customUrl = document.getElementById('customWebhookUrlInput')?.value.trim();

      btn.disabled = true;
      btn.innerText = 'Sending...';
      feedback.className = 'text-[11px] text-stone-500 block';
      feedback.innerText = 'Transmitting sample payload to Make.com...';

      try {
        const testResp = await window.globalApiFetch('/recruit/research/webhook-test', {
          method: 'POST',
          body: JSON.stringify({ webhook_url: customUrl || undefined })
        });

        const testData = await testResp.json();
        if (!testResp.ok) {
          throw new Error(testData.detail || 'Webhook test failed');
        }

        feedback.className = 'text-[11px] text-emerald-700 block font-medium';
        feedback.innerText = `✓ Test payload sent successfully (HTTP ${testData.response_status})! Make.com should now display 'Successfully determined'.`;
        btn.disabled = false;
        btn.innerText = '📡 Send Test Payload';
      } catch (err) {
        feedback.className = 'text-[11px] text-red-600 block';
        feedback.innerText = `Error: ${err.message}`;
        btn.disabled = false;
        btn.innerText = '📡 Send Test Payload';
      }
    });

    document.getElementById('cancelSettingsBtn')?.addEventListener('click', () => modal.remove());
    document.getElementById('saveSettingsBtn')?.addEventListener('click', async () => {
      const rawSlots = document.getElementById('settingsSlotsInput').value;
      const slots = rawSlots.split(',').map(s => s.trim()).filter(Boolean);
      if (slots.length === 0) {
        feedback.className = 'text-[11px] text-red-600 block';
        feedback.innerText = 'Please enter at least one time slot.';
        return;
      }
      const checkedDays = Array.from(document.querySelectorAll('input[name="skipDayCheck"]:checked')).map(cb => cb.value);

      const saveBtn = document.getElementById('saveSettingsBtn');
      const feedback = document.getElementById('settingsFeedback');
      saveBtn.disabled = true;
      saveBtn.innerText = 'Saving...';

      try {
        const updateResp = await window.globalApiFetch('/recruit/research/interview-settings', {
          method: 'POST',
          body: JSON.stringify({ slots, skip_days: checkedDays })
        });
        if (!updateResp.ok) throw new Error('Failed to save settings');
        feedback.className = 'text-[11px] text-emerald-700 block font-medium';
        feedback.innerText = 'Interview schedule updated successfully!';
        setTimeout(() => modal.remove(), 1200);
      } catch (e) {
        feedback.className = 'text-[11px] text-red-600 block';
        feedback.innerText = `Error: ${e.message}`;
        saveBtn.disabled = false;
        saveBtn.innerText = 'Save Schedule';
      }
    });

  } catch (err) {
    document.getElementById('settingsModalBody').innerHTML = `<div class="text-red-600">Failed to load interview settings: ${err.message}</div>`;
  }
}

async function openRescheduleModal(sessionId, applicant, currentBooking) {
  const apiBase = (window.ALFAAZ_API_URL !== undefined && window.ALFAAZ_API_URL !== null) ? window.ALFAAZ_API_URL : '';
  const token = localStorage.getItem('alfaaz_token');
  
  let modal = document.getElementById('rescheduleModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'rescheduleModal';
    document.body.appendChild(modal);
  }
  
  modal.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white border border-[var(--grid-border)] max-w-lg w-full p-6 space-y-4 shadow-xl">
      <div class="flex justify-between items-center border-b border-[var(--grid-border)] pb-3">
        <div>
          <h3 class="font-serif text-lg text-[var(--text-primary)]">Change / Reschedule Interview</h3>
          <div class="text-xs text-stone-500">${window.escapeHtml(applicant.full_name || 'Candidate')} &middot; ${window.escapeHtml(applicant.email || '')}</div>
        </div>
        <button id="closeRescheduleModalBtn" class="text-stone-400 hover:text-black text-lg">&times;</button>
      </div>

      <div id="rescheduleModalBody" class="space-y-4 text-xs">
        <div class="text-stone-500">Loading open slots...</div>
      </div>
    </div>
  `;

  document.getElementById('closeRescheduleModalBtn')?.addEventListener('click', () => modal.remove());

  try {
    const resp = await window.globalApiFetch('/recruit/interview-slots');
    const slotsData = await resp.json();
    const days = slotsData.days || [];

    const availableOptions = [];
    days.forEach(d => {
      (d.times || []).forEach(t => {
        availableOptions.push({
          date: d.date,
          time: t,
          display: `${d.date_label} at ${t} IST`,
          fullDisplay: `${d.full_date_label} at ${t} IST`
        });
      });
    });

    const currentDisplay = currentBooking ? (currentBooking.slot_display || `${currentBooking.slot_date} at ${currentBooking.slot_time}`) : 'None assigned';

    const bodyEl = document.getElementById('rescheduleModalBody');
    bodyEl.innerHTML = `
      <div class="p-3 bg-[#faf8f5] border border-[var(--grid-border)]">
        <span class="text-[10px] uppercase font-semibold text-stone-500 block">Current Interview Slot:</span>
        <span class="text-sm font-serif text-black">${window.escapeHtml(currentDisplay)}</span>
      </div>

      <div class="space-y-2">
        <label class="block font-semibold uppercase tracking-wider text-[11px] text-[var(--text-primary)]">
          Option 1: Choose from Open System Slots
        </label>
        <select id="openSlotSelect" class="w-full p-2 border border-[var(--grid-border)] bg-white text-xs focus:outline-none focus:border-[var(--accent-gold)]">
          <option value="">-- Choose an available slot --</option>
          ${availableOptions.map(o => `
            <option value="${o.date}|${o.time}|${o.display}">${o.fullDisplay}</option>
          `).join('')}
        </select>
      </div>

      <div class="relative flex py-1 items-center">
        <div class="flex-grow border-t border-[var(--grid-border)]"></div>
        <span class="flex-shrink mx-2 text-[10px] uppercase tracking-wider text-stone-400">or specify custom timing</span>
        <div class="flex-grow border-t border-[var(--grid-border)]"></div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block font-semibold uppercase tracking-wider text-[10px] text-stone-600 mb-1">Custom Date</label>
          <input type="date" id="customDateInput" class="w-full p-2 border border-[var(--grid-border)] text-xs focus:outline-none" />
        </div>
        <div>
          <label class="block font-semibold uppercase tracking-wider text-[10px] text-stone-600 mb-1">Custom Time (e.g. 04:00 PM IST)</label>
          <input type="text" id="customTimeInput" placeholder="04:00 PM IST" class="w-full p-2 border border-[var(--grid-border)] text-xs focus:outline-none" />
        </div>
      </div>

      <div>
        <label class="block font-semibold uppercase tracking-wider text-[10px] text-stone-600 mb-1">Recruiter Notes (Optional)</label>
        <input type="text" id="rescheduleNotesInput" placeholder="e.g. Candidate requested evening call" class="w-full p-2 border border-[var(--grid-border)] text-xs focus:outline-none" />
      </div>

      <div id="rescheduleFeedback" class="text-[11px] hidden"></div>

      <div class="pt-3 border-t border-[var(--grid-border)] flex justify-end gap-2">
        <button id="cancelRescheduleBtn" class="px-3 py-1.5 border border-[var(--grid-border)] text-xs text-stone-600 hover:bg-stone-50">Cancel</button>
        <button id="confirmRescheduleBtn" class="px-4 py-1.5 bg-[var(--text-primary)] text-white text-xs uppercase tracking-wider hover:bg-[var(--accent-gold)] transition-colors">
          Confirm Reschedule
        </button>
      </div>
    `;

    document.getElementById('cancelRescheduleBtn')?.addEventListener('click', () => modal.remove());
    document.getElementById('confirmRescheduleBtn')?.addEventListener('click', async () => {
      const selectedVal = document.getElementById('openSlotSelect').value;
      const customDate = document.getElementById('customDateInput').value;
      const customTime = document.getElementById('customTimeInput').value;
      const notes = document.getElementById('rescheduleNotesInput').value;

      let slotDate, slotTime, slotDisplay;

      if (selectedVal) {
        const parts = selectedVal.split('|');
        slotDate = parts[0];
        slotTime = parts[1];
        slotDisplay = parts[2];
      } else if (customDate && customTime) {
        slotDate = customDate;
        slotTime = customTime.trim();
        slotDisplay = `${customDate} at ${customTime}`;
      } else {
        feedback.className = 'text-[11px] text-red-600 block';
        feedback.innerText = 'Please choose an available slot or enter a custom date and time.';
        return;
      }

      const confirmBtn = document.getElementById('confirmRescheduleBtn');
      const feedback = document.getElementById('rescheduleFeedback');
      confirmBtn.disabled = true;
      confirmBtn.innerText = 'Updating...';

      try {
        const resp = await window.globalApiFetch(`/recruit/research/sessions/${sessionId}/reschedule`, {
          method: 'POST',
          body: JSON.stringify({
            slot_date: slotDate,
            slot_time: slotTime,
            slot_display: slotDisplay,
            notes: notes || undefined
          })
        });

        if (!resp.ok) {
          const errData = await resp.json();
          throw new Error(errData.detail || 'Failed to reschedule');
        }

        const resJson = await resp.json();
        feedback.className = 'text-[11px] text-emerald-700 block font-medium';
        feedback.innerText = 'Interview rescheduled successfully! Updating dossier...';

        setTimeout(async () => {
          modal.remove();
          await loadSessionDetail(sessionId);
          if (resJson.whatsapp_notify_url) {
            const rawPhone = applicant.phone_or_contact || '';
            const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
            if (cleanPhone) {
              const openWa = confirm(`Interview updated to: ${slotDisplay}\n\nWould you like to open WhatsApp now to send the candidate the updated timing?`);
              if (openWa) {
                window.open(resJson.whatsapp_notify_url, '_blank');
              }
            }
          }
        }, 800);

      } catch (err) {
        feedback.className = 'text-[11px] text-red-600 block';
        feedback.innerText = `Error: ${err.message}`;
        confirmBtn.disabled = false;
        confirmBtn.innerText = 'Confirm Reschedule';
      }
    });

  } catch (err) {
    document.getElementById('rescheduleModalBody').innerHTML = `<div class="text-red-600">Failed to load open interview slots: ${err.message}</div>`;
  }
}

