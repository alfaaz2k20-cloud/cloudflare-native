// exhibition.js — Central Exhibition Discovery & Gateway Portal (Alfaaz Collective)

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('alfaaz_token');

  // DOM Elements
  const closedMessage = document.getElementById('closedMessage');
  const activePortalContainer = document.getElementById('activePortalContainer');
  const showcaseGrid = document.getElementById('showcaseGrid');
  const totalCyclesCount = document.getElementById('totalCyclesCount');
  const btnAdultStream = document.getElementById('btnAdultStream');
  const btnYouthStream = document.getElementById('btnYouthStream');

  let activeCycles = [];
  let userStatusData = null;

  // 1. Fetch User Status (if logged in)
  if (token) {
    try {
      const res = await window.globalApiFetch('/exhibitions/user-status');
      if (res && res.ok) {
        userStatusData = await res.json();
      }
    } catch (err) {
      console.warn('[Exhibition User Status Fetch Warning]:', err);
    }
  }

  // 2. Fetch Exhibition Configuration & Active Cycles
  try {
    const res = await window.globalApiFetch('/exhibitions/config');
    if (!res || !res.ok) {
      showClosedState();
      return;
    }

    const data = await res.json();
    if (!data.is_open && (!data.active_cycles || data.active_cycles.length === 0)) {
      showClosedState();
      return;
    }

    activeCycles = Array.isArray(data.active_cycles) && data.active_cycles.length > 0
      ? data.active_cycles
      : [{
          id: data.id || 1,
          title: data.title || 'Curatorial Open Call',
          date_text: data.date_text || 'Dates TBA',
          about_text: data.about_text || '',
          venue: data.venue || 'Alfaaz Gallery, Srinagar',
          require_over_18: data.require_over_18 !== false,
          allow_recent_works_youth: Boolean(data.allow_recent_works_youth)
        }];

    renderShowcaseGrid(activeCycles);

    // Update gateway button targets with default active cycle
    const defaultCycle = activeCycles[0];
    if (defaultCycle) {
      if (btnAdultStream) btnAdultStream.href = `exhibition-adult.html?id=${encodeURIComponent(defaultCycle.id)}`;
      if (btnYouthStream) btnYouthStream.href = `exhibition-youth.html?id=${encodeURIComponent(defaultCycle.id)}`;
    }

  } catch (err) {
    console.error('[Exhibition Portal Init Error]:', err);
    showClosedState();
  }

  function showClosedState() {
    if (closedMessage) closedMessage.style.display = 'block';
    if (activePortalContainer) activePortalContainer.style.display = 'none';
  }

  // 3. Render Cycle Cards
  function renderShowcaseGrid(cycles) {
    if (!showcaseGrid) return;
    showcaseGrid.innerHTML = '';

    if (totalCyclesCount) {
      totalCyclesCount.textContent = `${cycles.length} ${cycles.length === 1 ? 'Open Call' : 'Open Calls'}`;
    }

    cycles.forEach(cycle => {
      const card = document.createElement('article');
      card.className = 'show-card';

      const isYouth = cycle.require_over_18 === false || cycle.require_over_18 === 0;
      const streamBadge = isYouth
        ? `<span class="badge badge-pending" style="font-size: 10px; width: fit-content;">Below 18 (Youth Stream)</span>`
        : `<span class="badge badge-approved" style="font-size: 10px; width: fit-content;">18 &amp; Above (Adult Stream)</span>`;

      // Check if user already submitted to this cycle
      const cycleStatusInfo = userStatusData?.statuses_by_cycle && userStatusData.statuses_by_cycle[cycle.title];
      const userCycleStatus = cycleStatusInfo?.status;

      let actionButtonHtml = '';
      if (userCycleStatus) {
        actionButtonHtml = `
          <a href="dashboard.html" class="action-btn" style="display: block; text-align: center; font-size: 11px; padding: 0.75rem 1rem; text-decoration: none;">
            Application Dossier (${window.escapeHtml(userCycleStatus)}) &rarr;
          </a>
        `;
      } else {
        const targetUrl = isYouth
          ? `exhibition-youth.html?id=${encodeURIComponent(cycle.id)}`
          : `exhibition-adult.html?id=${encodeURIComponent(cycle.id)}`;

        const applyLabel = isYouth
          ? 'Apply to Youth Stream (Under 18) &rarr;'
          : 'Apply to Adult Stream (18+) &rarr;';

        actionButtonHtml = `
          <a href="${targetUrl}" class="action-btn gold" style="display: block; text-align: center; font-size: 11px; padding: 0.75rem 1rem; text-decoration: none;">
            ${applyLabel}
          </a>
        `;
      }

      const venueText = cycle.venue || 'Alfaaz Gallery, Srinagar';
      const dateText = cycle.date_text || 'Dates Announced Soon';
      const feeText = cycle.registration_fee ? `Fee: ${cycle.registration_fee}` : 'Curatorial Open Call';

      card.innerHTML = `
        <div>
          ${streamBadge}
          <h3 class="show-card-title">${window.escapeHtml(cycle.title)}</h3>
          <div class="show-card-meta">
            <span>📅 ${window.escapeHtml(dateText)}</span>
            <span>📍 ${window.escapeHtml(venueText)}</span>
            <span>🪙 ${window.escapeHtml(feeText)}</span>
          </div>
          <p class="show-card-desc">
            ${window.escapeHtml(cycle.about_text || 'Open call for artistic portfolios, visual expressions, and curatorial participation in Srinagar.')}
          </p>
        </div>
        <div style="margin-top: 1.25rem;">
          ${actionButtonHtml}
        </div>
      `;

      showcaseGrid.appendChild(card);
    });
  }
});
