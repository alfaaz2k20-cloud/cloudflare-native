// exhibition.js — Curatorial Exhibition Guidelines & Intelligent Portal Router (Alfaaz Collective)

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const targetParam = (urlParams.get('target') || urlParams.get('stream') || '').toLowerCase();
  const cycleParam = urlParams.get('id') || urlParams.get('cycle');

  // DOM Elements
  const closedMessage = document.getElementById('closedMessage');
  const activePortalContainer = document.getElementById('activePortalContainer');
  const currentShowTitle = document.getElementById('currentShowTitle');
  const currentShowMeta = document.getElementById('currentShowMeta');
  const cycleCohortBadge = document.getElementById('cycleCohortBadge');

  const actionPrompt = document.getElementById('actionPrompt');
  const actionTitle = document.getElementById('actionTitle');
  const actionDesc = document.getElementById('actionDesc');
  const singleActionWrap = document.getElementById('singleActionWrap');
  const btnContinueTarget = document.getElementById('btnContinueTarget');
  const dualChoiceWrap = document.getElementById('dualChoiceWrap');
  const btnDualYouth = document.getElementById('btnDualYouth');
  const btnDualAdult = document.getElementById('btnDualAdult');

  function showClosedState() {
    if (activePortalContainer) activePortalContainer.style.display = 'none';
    if (closedMessage) closedMessage.style.display = 'block';
  }

  let activeCycles = [];
  let resolvedCycle = null;

  // 1. Fetch Exhibition Configuration
  try {
    const configUrl = cycleParam
      ? `/exhibitions/config?id=${encodeURIComponent(cycleParam)}`
      : '/exhibitions/config';

    const res = await window.globalApiFetch(configUrl);
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
      : (data.title ? [data] : []);

    if (activeCycles.length === 0) {
      showClosedState();
      return;
    }

    // 2. Resolve Specific Cycle
    if (cycleParam) {
      resolvedCycle = activeCycles.find(c => String(c.id) === String(cycleParam)) || data;
    } else if (activeCycles.length === 1) {
      resolvedCycle = activeCycles[0];
    }

    // 3. Update Banner Metadata
    if (resolvedCycle) {
      if (currentShowTitle) currentShowTitle.textContent = resolvedCycle.title || 'Curatorial Exhibition';
      if (currentShowMeta) {
        currentShowMeta.textContent = `${resolvedCycle.venue || 'Alfaaz Gallery, Srinagar'} — ${resolvedCycle.date_text || 'Dates Announced Soon'}`;
      }
      if (cycleCohortBadge) {
        const isYouthCycle = resolvedCycle.require_over_18 === 0 || resolvedCycle.require_over_18 === false;
        cycleCohortBadge.textContent = isYouthCycle ? 'Youth Exhibition (Below 18)' : 'Exhibition (General / 18+)';
      }
    } else if (activeCycles.length > 1) {
      if (currentShowTitle) currentShowTitle.textContent = 'Active Curatorial Cycles';
      if (currentShowMeta) currentShowMeta.textContent = `${activeCycles.length} concurrent open calls accepting submissions in Srinagar`;
      if (cycleCohortBadge) cycleCohortBadge.textContent = 'Multiple Cycles Active';
    }

    // 4. Resolve Intended Target (Youth vs Adult/General)
    let determinedTarget = null;
    if (targetParam === 'youth' || targetParam === 'minor') {
      determinedTarget = 'youth';
    } else if (targetParam === 'adult' || targetParam === 'general') {
      determinedTarget = 'adult';
    } else if (resolvedCycle) {
      const isYouthCycle = resolvedCycle.require_over_18 === 0 || resolvedCycle.require_over_18 === false;
      determinedTarget = isYouthCycle ? 'youth' : 'adult';
    }

    // 5. Configure Single Destination or Dual Fallback
    if (determinedTarget) {
      if (singleActionWrap) singleActionWrap.style.display = 'block';
      if (dualChoiceWrap) dualChoiceWrap.style.display = 'none';

      const cycleQuery = resolvedCycle?.id ? `?id=${encodeURIComponent(resolvedCycle.id)}` : (cycleParam ? `?id=${encodeURIComponent(cycleParam)}` : '');

      if (determinedTarget === 'youth') {
        if (actionPrompt) actionPrompt.textContent = 'Youth Exhibition (Under 18 Years)';
        if (actionTitle) actionTitle.textContent = 'I Understand & Agree — Continue to Youth Exhibition';
        if (actionDesc) {
          actionDesc.textContent = 'You will be taken directly to our youth exhibition intake portal for young artists and students below 18 years.';
        }
        if (btnContinueTarget) {
          btnContinueTarget.textContent = 'I Agree & Continue to Youth Exhibition →';
          btnContinueTarget.href = `exhibition-youth.html${cycleQuery}`;
        }
      } else {
        if (actionPrompt) actionPrompt.textContent = 'Exhibition Application (General / 18+)';
        if (actionTitle) actionTitle.textContent = 'I Understand & Agree — Continue to Exhibition';
        if (actionDesc) {
          actionDesc.textContent = 'You will be taken directly to our exhibition application portal for artists and cultural practitioners aged 18 and older.';
        }
        if (btnContinueTarget) {
          btnContinueTarget.textContent = 'I Agree & Continue to Exhibition →';
          btnContinueTarget.href = `exhibition-adult.html${cycleQuery}`;
        }
      }
    } else {
      // Unspecified target with multiple active shows: offer clear choices below guidelines
      if (singleActionWrap) singleActionWrap.style.display = 'none';
      if (dualChoiceWrap) dualChoiceWrap.style.display = 'flex';

      const adultCycle = activeCycles.find(c => c.require_over_18 !== 0 && c.require_over_18 !== false) || activeCycles[0];
      const youthCycle = activeCycles.find(c => c.require_over_18 === 0 || c.require_over_18 === false) || activeCycles[0];

      if (actionPrompt) actionPrompt.textContent = 'Select Application Portal';
      if (actionTitle) actionTitle.textContent = 'Choose Your Exhibition Portal';
      if (actionDesc) {
        actionDesc.textContent = 'Please choose the portal matching your age category to enter the application form:';
      }

      if (btnDualYouth && youthCycle) {
        btnDualYouth.href = `exhibition-youth.html?id=${encodeURIComponent(youthCycle.id)}`;
      }
      if (btnDualAdult && adultCycle) {
        btnDualAdult.href = `exhibition-adult.html?id=${encodeURIComponent(adultCycle.id)}`;
      }
    }

  } catch (err) {
    console.error('[Exhibition Guidelines Load Error]:', err);
    showClosedState();
  }
});
