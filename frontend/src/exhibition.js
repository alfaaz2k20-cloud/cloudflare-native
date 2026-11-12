// exhibition.js — Central Exhibition Discovery & Gateway Portal (Alfaaz Collective)

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('alfaaz_token');

  // DOM Elements
  const closedMessage = document.getElementById('closedMessage');
  const activePortalContainer = document.getElementById('activePortalContainer');
  const currentShowTitle = document.getElementById('currentShowTitle');
  const currentShowMeta = document.getElementById('currentShowMeta');
  const currentShowAbout = document.getElementById('currentShowAbout');
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

    // Display primary active cycle info in hero banner
    const primaryCycle = activeCycles[0];
    if (primaryCycle) {
      if (currentShowTitle) currentShowTitle.textContent = primaryCycle.title;
      if (currentShowMeta) {
        const venueText = primaryCycle.venue || 'Alfaaz Gallery, Srinagar';
        const dateText = primaryCycle.date_text || 'Dates Announced Soon';
        const feeText = primaryCycle.registration_fee ? `Fee: ${primaryCycle.registration_fee}` : 'Curatorial Open Call';
        currentShowMeta.textContent = `${dateText} — ${venueText} (${feeText})`;
      }
      if (currentShowAbout && primaryCycle.about_text) {
        currentShowAbout.textContent = primaryCycle.about_text;
      }
    }

    // Direct gateway buttons to appropriate active cycles
    const adultCycle = activeCycles.find(c => c.require_over_18 !== false && c.require_over_18 !== 0) || primaryCycle;
    const youthCycle = activeCycles.find(c => c.require_over_18 === false || c.require_over_18 === 0) || primaryCycle;

    if (btnAdultStream && adultCycle) {
      btnAdultStream.href = `exhibition-adult.html?id=${encodeURIComponent(adultCycle.id)}`;
      // Check if user submitted to this adult cycle
      const adultStatus = userStatusData?.statuses_by_cycle && userStatusData.statuses_by_cycle[adultCycle.title];
      if (adultStatus?.status) {
        btnAdultStream.textContent = `View Application (${adultStatus.status}) →`;
        btnAdultStream.href = 'dashboard.html';
      }
    }

    if (btnYouthStream && youthCycle) {
      btnYouthStream.href = `exhibition-youth.html?id=${encodeURIComponent(youthCycle.id)}`;
      // Check if user submitted to this youth cycle
      const youthStatus = userStatusData?.statuses_by_cycle && userStatusData.statuses_by_cycle[youthCycle.title];
      if (youthStatus?.status) {
        btnYouthStream.textContent = `View Application (${youthStatus.status}) →`;
        btnYouthStream.href = 'dashboard.html';
      }
    }

  } catch (err) {
    console.error('[Exhibition Portal Init Error]:', err);
    showClosedState();
  }

  function showClosedState() {
    if (closedMessage) closedMessage.style.display = 'block';
    if (activePortalContainer) activePortalContainer.style.display = 'none';
  }
});
