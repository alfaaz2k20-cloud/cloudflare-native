
/* ==========================================================================
   ALFAAZ CANDIDATE EXPERIENCE V2.1 — PLAIN ENGLISH SJT PRESENTATION
   100% preserve scenario IDs, option IDs, weights, and telemetry.
   ========================================================================== */
const SJT_V2_1_COPY = {
  S1: {
    act_title_en: "The Exhibition",
    act_title_ur: "نمائش",
    setup: "The art exhibition opens in 2 hours. One artist's paintings have not arrived yet. The exhibition lead is very stressed while fixing the hall lights.",
    options: {
      S1A: "Quietly take over setup tasks and work quickly to give the lead space.",
      S1B: "Suggest rearranging the room layout right now to hide the empty wall.",
      S1C: "Go to the lead and ask directly how you can help them right now.",
      S1D: "Start calling contacts yourself to find the artist or get backup art."
    }
  },
  S2: {
    act_title_en: "The Exhibition",
    act_title_ur: "نمائش",
    setup: "An artist, Faizan, is upset because his artwork was placed near the noisy entrance. He wants a quiet corner. Another artist, Meher, is already in the quiet corner and is happy there.",
    options: {
      S2A: "Bring Faizan and Meher together to talk and find an agreement.",
      S2B: "Politely but firmly keep the original floor plan so things stay fair.",
      S2C: "Walk through the building to find an empty, unused corner for Faizan.",
      S2D: "Offer to stand near Faizan's artwork yourself to keep the crowd quiet."
    }
  },
  S3: {
    act_title_en: "The Exhibition",
    act_title_ur: "نمائش",
    setup: "A school teacher arrives without notice with 15 students. The room is still messy, with loose cables on the floor.",
    options: {
      S3A: "Gather the students in the entrance hall for a quick question-and-answer talk.",
      S3B: "Politely remind the teacher of the opening time, but take their details to book a tour later.",
      S3C: "Rope off a safe corner of the room and watch the students yourself.",
      S3D: "Show them one piece of art safely without disturbing the setup work."
    }
  },
  S4: {
    act_title_en: "The Circle",
    act_title_ur: "حلقہ",
    setup: "During a group discussion, Zara, a new member, leans forward to speak but pulls back nervously.",
    options: {
      S4A: "Wait for a quiet moment and gently invite her to speak.",
      S4B: "Notice what she is interested in and bring those topics up for the whole group.",
      S4C: "Talk to her privately after the gathering to chat one-on-one.",
      S4D: "Suggest a simple rule where everyone takes turns speaking in future meetings."
    }
  },
  S5: {
    act_title_en: "The Circle",
    act_title_ur: "حلقہ",
    setup: "A listener angrily interrupts a poet who is reading a sensitive, personal poem. The poet freezes.",
    options: {
      S5A: "Point to the community guidelines on respect and introduce the next reader.",
      S5B: "Walk up to stand beside the poet right away so they feel safe.",
      S5C: "Pause the event and let the angry person briefly explain what upset them.",
      S5D: "Ask everyone in the room to sit in quiet reflection for one minute."
    }
  },
  S6: {
    act_title_en: "The Outreach",
    act_title_ur: "رابطہ",
    setup: "An 8-year-old boy refuses to paint. An experienced team volunteer whispers, 'Just leave him alone.'",
    options: {
      S6A: "Listen to your teammate's advice, but keep a watchful eye on the boy from where you stand.",
      S6B: "Sit near him and draw quietly on your own paper so he feels no pressure.",
      S6C: "Build a small tower out of paint jars to catch his interest.",
      S6D: "Ask the full-time center staff what the boy usually enjoys doing."
    }
  },
  S7: {
    act_title_en: "The Outreach",
    act_title_ur: "رابطہ",
    setup: "You feel very tired from a long week. A close friend is visiting your town for only one day, but you promised earlier to help set up today's event.",
    options: {
      S7A: "Keep your full promise to work. Meet your friend only if work finishes early.",
      S7B: "Call the team leader honestly and offer to take a harder shift next week instead.",
      S7C: "Invite your friend to come with you and help out as a guest volunteer.",
      S7D: "Work the two hardest hours, hand over your jobs clearly to the team, and then leave."
    }
  }
};

const FALLBACK_V2_1_SCENARIOS = Object.keys(SJT_V2_1_COPY).map((k, idx) => ({
  id: k,
  act: idx < 3 ? 1 : (idx < 5 ? 2 : 3),
  act_title_en: SJT_V2_1_COPY[k].act_title_en,
  act_title_ur: SJT_V2_1_COPY[k].act_title_ur,
  setup: SJT_V2_1_COPY[k].setup,
  options: Object.keys(SJT_V2_1_COPY[k].options).map(optId => ({
    id: optId,
    text: SJT_V2_1_COPY[k].options[optId]
  }))
}));

/* ==========================================================================
 ALFAAZ RECRUIT — CANDIDATE EXPERIENCE & TELEMETRY CLIENT
 ========================================================================== */

import './recruit-utilities.css';
import { runMiniGame, CANDIDATE_CORE_GAMES, scrollToTop } from './recruit_games/index.js';

// KEEP-ALIVE PING FOR RENDER FREE TIER
function startKeepAlivePing() {
 const apiBase = window.ALFAAZ_API_URL || '';
 if (!apiBase) return;
 fetch(apiBase + '/ping').catch(() => {});
 setInterval(() => fetch(apiBase + '/ping').catch(() => {}), 4 * 60 * 1000);
}

let state = {
 sessionId: null,
 configHash: null,
 worldSequence: [],
 seeds: {},
 screen: 'consent', // consent, identity, accessibility, warmup, sjt_briefing, sjt, gba_briefing, games, complete, paused
 candidateName: '',
 candidateEmail: '',
 candidatePhone: '',
 pausedPreviousScreen: null,
 sjtScenarios: [],
 currentSjtIndex: 0,
 sjtResponses: {},
 currentWorldIndex: 0,
 currentMiniGameIndex: 0,
 accessibilityModes: [],
 segmentId: 1,
 seq: 1,
 telemetryQueue: [],
 isPaused: false,
 activeMiniGameInProgress: false,
 telemetryTerminal: false
};


const STATE_STORAGE_KEY = 'alfaaz_recruit_state';
const UNSENT_STORAGE_KEY = 'alfaaz_recruit_unsent'; // deprecated

const TelemetryOutbox = {
  dbPromise: null,
  init() {
    this.dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('AlfaazRecruitDB', 3);
      req.onupgradeneeded = e => {
        if (!e.target.result.objectStoreNames.contains('outbox')) {
           e.target.result.createObjectStore('outbox', { keyPath: '_idbKey' });
        } else if (e.oldVersion < 3) {
           e.target.result.deleteObjectStore('outbox');
           e.target.result.createObjectStore('outbox', { keyPath: '_idbKey' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.dbPromise;
  },
  async append(eventPayload) {
    if (!eventPayload._idbKey) {
        eventPayload._idbKey = crypto.randomUUID();
    }
    try {
      const db = await this.dbPromise;
      return new Promise((resolve, reject) => {
        const tx = db.transaction('outbox', 'readwrite');
        const store = tx.objectStore('outbox');
        const payloadCopy = { ...eventPayload };
        const req = store.add(payloadCopy);
        req.onsuccess = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
      });
    } catch(e) {
      console.warn('IDB append failed. State will only be persistent for the session.', e);
      eventPayload._idbFailed = true;
    }
  },
  async deleteMany(keys) {
    if (!keys || keys.length === 0) return;
    try {
      const db = await this.dbPromise;
      return new Promise((resolve, reject) => {
        const tx = db.transaction('outbox', 'readwrite');
        const store = tx.objectStore('outbox');
        keys.forEach(k => store.delete(k));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch(e) {
      console.warn('IDB delete failed', e);
    }
  },
  async getAll() {
    try {
      const db = await this.dbPromise;
      return new Promise((resolve, reject) => {
        const tx = db.transaction('outbox', 'readonly');
        const req = tx.objectStore('outbox').getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(tx.error);
      });
    } catch(e) {
      console.warn('IDB getAll failed', e);
      return [];
    }
  },
  async clear() {
    try {
      const db = await this.dbPromise;
      return new Promise((resolve, reject) => {
        const tx = db.transaction('outbox', 'readwrite');
        tx.objectStore('outbox').clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {}
  }
};
TelemetryOutbox.init().catch(e => console.warn('IDB init failed', e));

let localStateSaveScheduled = false;


function persistLocalState() {
 localStateSaveScheduled = false;
 try {
 const toSave = {
 sessionId: state.sessionId,
 configHash: state.configHash,
 worldSequence: state.worldSequence,
 seeds: state.seeds,
 screen: state.screen,
 candidateName: state.candidateName || '',
 candidateEmail: state.candidateEmail || '',
 candidatePhone: state.candidatePhone || '',
 sjtScenarios: state.sjtScenarios,
 currentSjtIndex: state.currentSjtIndex,
 sjtResponses: state.sjtResponses,
 currentWorldIndex: state.currentWorldIndex,
 currentMiniGameIndex: state.currentMiniGameIndex,
 accessibilityModes: state.accessibilityModes,
 segmentId: state.segmentId,
 seq: state.seq,
 isPaused: state.isPaused,
 activeMiniGameInProgress: state.activeMiniGameInProgress || false,
 telemetryTerminal: state.telemetryTerminal
 };
 const jsonStr = JSON.stringify(toSave);
 sessionStorage.setItem(STATE_STORAGE_KEY, jsonStr);
 if (state.sessionId) {
   sessionStorage.setItem(`${STATE_STORAGE_KEY}_${state.sessionId}`, jsonStr);
   sessionStorage.setItem('alfaaz_active_session_id', state.sessionId);
 }
 // UNSENT_STORAGE_KEY persistence removed in favor of explicit IDB append
 } catch (e) {
 console.warn('[Persistence] Error saving sessionStorage:', e);
 }
}

function saveLocalState({ immediate = false } = {}) {
 if (immediate) {
 persistLocalState();
 return;
 }

 if (localStateSaveScheduled) return;
 localStateSaveScheduled = true;
 const persistWhenIdle = () => persistLocalState();

 if ('requestIdleCallback' in window) {
 window.requestIdleCallback(persistWhenIdle, { timeout: 500 });
 } else {
 window.setTimeout(persistWhenIdle, 100);
 }
}

async function restoreLocalState() {
 try {
 const activeSessionId = sessionStorage.getItem('alfaaz_active_session_id');
 const scopedKey = activeSessionId ? `${STATE_STORAGE_KEY}_${activeSessionId}` : STATE_STORAGE_KEY;
 const savedStateStr = sessionStorage.getItem(scopedKey) || sessionStorage.getItem(STATE_STORAGE_KEY);

 const idbEvents = await TelemetryOutbox.getAll();
 if (idbEvents && idbEvents.length > 0) {
     state.telemetryQueue = idbEvents;
 } else {
     const savedUnsentStr = sessionStorage.getItem(UNSENT_STORAGE_KEY);
     if (savedUnsentStr) {
         const parsedUnsent = JSON.parse(savedUnsentStr);
         if (Array.isArray(parsedUnsent)) {
             state.telemetryQueue = parsedUnsent;
         }
     }
 }

 if (savedStateStr) {
 const saved = JSON.parse(savedStateStr);

 if (saved.sessionId) {
 state.sessionId = saved.sessionId;
 state.configHash = saved.configHash || null;
 state.worldSequence = saved.worldSequence || [];
 state.seeds = saved.seeds || {};
 state.screen = saved.screen || 'consent';
 state.candidateName = saved.candidateName || '';
 state.candidateEmail = saved.candidateEmail || '';
 state.candidatePhone = saved.candidatePhone || '';
 const rawSavedScenarios = (saved.sjtScenarios && saved.sjtScenarios.length > 0) ? saved.sjtScenarios : FALLBACK_V2_1_SCENARIOS;
 state.sjtScenarios = rawSavedScenarios.map(sc => {
   const v21 = SJT_V2_1_COPY[sc.id];
   if (!v21) return sc;
   return {
     ...sc,
     act_title_en: v21.act_title_en || sc.act_title_en,
     act_title_ur: v21.act_title_ur || sc.act_title_ur,
     setup: v21.setup || sc.setup,
     options: (sc.options || []).map(opt => ({
       ...opt,
       text: (v21.options && v21.options[opt.id]) || opt.text
     }))
   };
 });
 state.currentSjtIndex = saved.currentSjtIndex || 0;
 state.sjtResponses = saved.sjtResponses || {};
 state.currentWorldIndex = saved.currentWorldIndex || 0;
 state.currentMiniGameIndex = saved.currentMiniGameIndex || 0;
 state.accessibilityModes = saved.accessibilityModes || [];
 applyAccessibility(state.accessibilityModes);
 state.seq = saved.seq || 1;
 state.isPaused = saved.isPaused || false;
 state.telemetryTerminal = saved.telemetryTerminal || false;

 // Reload handling per Section 5.4:
 // - recover last server sequence; continue at last acknowledged sequence + 1
 // - increment segment
 // - emit segment_start
 state.segmentId = (saved.segmentId || 1) + 1;
 logEvent(state.screen, 'segment_start', { segment_id: state.segmentId });

 // If reload occurred inside an active mini-game:
 // - mark that mini-game INSUFFICIENT
 // - flag interrupted
 // - resume only at a completed mini-game boundary
 if (saved.activeMiniGameInProgress && saved.screen === 'games') {
 const currentWorldCode = state.worldSequence[state.currentWorldIndex];
 const mgId = getMiniGameId(currentWorldCode, state.currentMiniGameIndex);
 logEvent('game', 'interrupted', { mini_game: mgId, reason: 'page_reload' });
 if (state.currentMiniGameIndex < 1) {
 state.currentMiniGameIndex++;
 } else {
 state.currentMiniGameIndex = 0;
 state.currentWorldIndex++;
 }
 state.activeMiniGameInProgress = false;
 }

 saveLocalState({ immediate: true });
 return true;
 }
 }
 } catch (e) {
 console.warn('[Persistence] Error restoring sessionStorage:', e);
 }
 return false;
}

async function apiFetch(endpoint, options = {}) {
 const apiBase = (window.ALFAAZ_API_URL !== undefined && window.ALFAAZ_API_URL !== null) ? window.ALFAAZ_API_URL : '';
 const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
 return fetch(`${apiBase}${endpoint}`, {
 ...options,
 headers
 });
}

// Telemetry Client
function logEvent(screen, action, data = {}, stateSnapshot = {}, inputType = 'mouse', miniGame = null, trial = null) {
 const t_ms = performance.now();

 let finalData = data;
 let finalState = stateSnapshot;

 try {
 const dataStr = JSON.stringify(data);
 const stateStr = JSON.stringify(stateSnapshot);
 const combinedBytes = (new TextEncoder().encode(dataStr)).length + (new TextEncoder().encode(stateStr)).length;
 if (combinedBytes > 4096) {
 finalData = { event_oversize: true, original_size_bytes: combinedBytes };
 finalState = { oversized: true };
 }
 } catch (e) {
 // Serialization error fallback
 }

 const eventPayload = {
 seq: state.seq++,
 segment_id: state.segmentId,
 t_ms: t_ms,
 screen: screen,
 game_world: state.worldSequence[state.currentWorldIndex] || null,
 mini_game: miniGame,
 trial: trial,
 action: action,
 input_type: inputType,
 task_def_version: (data && data.task_def_version) || '1.0',
 state: finalState,
 data: finalData
 };

 eventPayload._idbKey = crypto.randomUUID();
 state.telemetryQueue.push(eventPayload);
 saveLocalState();
 TelemetryOutbox.append(eventPayload).catch(e => console.warn(e));

 // Flush when reaching 50 buffered events, or at critical task boundaries
 if (state.telemetryQueue.length >= 50 || action === 'minigame_end' || action === 'sjt_complete') {
 flushTelemetry();
 }
}

let currentFlushPromise = null;
let telemetryBatchSize = 50;

async function flushTelemetry() {
 if (!state.sessionId || state.telemetryQueue.length === 0) return true;
 if (state.telemetryTerminal) return true;
 if (currentFlushPromise) {
 return currentFlushPromise;
 }
 currentFlushPromise = _executeFlushTelemetry();
 try {
 return await currentFlushPromise;
 } finally {
 currentFlushPromise = null;
 }
}

async function _executeFlushTelemetry() {
 if (!state.sessionId || state.telemetryQueue.length === 0) return true;
 if (state.telemetryTerminal) return true;
 const sending = state.telemetryQueue.slice(0, telemetryBatchSize);
 const sendingIdbKeys = sending.map(ev => ev._idbKey).filter(k => k !== undefined);
 const payloadEvents = sending.map(ev => {
     const copy = { ...ev };
     delete copy._idbKey;
     delete copy._idbFailed;
     return copy;
 });

 try {
 const resp = await apiFetch('/recruit/telemetry', {
 method: 'POST',
 body: JSON.stringify({
 session_id: state.sessionId,
 events: payloadEvents
 })
 });

 if (resp && resp.status === 422) {
 const errJson = await resp.json().catch(() => ({}));
 if (errJson.detail && (errJson.detail.detail === 'events_cap_reached' || errJson.detail.status === 'DATA_LIMITED')) {
 console.warn('[Telemetry] Terminal event cap reached (50,000). Halting future telemetry flushes.');
 state.telemetryTerminal = true;
 saveLocalState({ immediate: true });
 return true;
 }
 }

 if (resp && resp.status === 413) {
 console.warn('[Telemetry] Batch rejected with HTTP 413 (oversize).');
 if (sending.length > 1) {
 telemetryBatchSize = Math.max(1, Math.floor(sending.length / 2));
 } else {
 console.error('[Telemetry] A single telemetry event exceeds the body limit. It remains queued for recovery.');
 }
 saveLocalState({ immediate: true });
 return false;
 }

 if (resp && resp.status === 403) {
 const errJson = await resp.json().catch(() => ({}));
 const detailStr = (typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail || '')).toLowerCase();
 if (detailStr.includes('already complete')) {
 console.info('[Telemetry] Session is already complete on server; draining local queue.');
 state.telemetryQueue = [];
 TelemetryOutbox.clear().catch(e => console.warn(e));
 state.telemetryTerminal = true;
 saveLocalState({ immediate: true });
 return true;
 }
 }

 if (!resp || !resp.ok) {
 throw new Error(resp ? `HTTP ${resp.status}` : 'No response');
 }

 const data = await resp.json().catch(() => ({}));
 if (data.result && data.result.session_status === 'COMPLETE') {
 state.telemetryQueue.splice(0, sending.length);
 if (sendingIdbKeys.length > 0) TelemetryOutbox.deleteMany(sendingIdbKeys);
 if (data.result.new_rejected_count > 0) {
 state.telemetryQueue = [];
 TelemetryOutbox.clear().catch(e => console.warn(e));
 state.telemetryTerminal = true;
 }
 saveLocalState({ immediate: true });
 return true;
 }

 state.telemetryQueue.splice(0, sending.length);
 if (sendingIdbKeys.length > 0) TelemetryOutbox.deleteMany(sendingIdbKeys);
 saveLocalState();
 return true;
 } catch (err) {
 console.warn('[Telemetry] Flush failed; telemetry remains queued:', err);
 saveLocalState({ immediate: true });
 return false;
 }
}

async function flushAllTelemetry(maxRetries = 3) {
 let attempts = 0;
 while (!state.telemetryTerminal && state.telemetryQueue.length > 0) {
 const queuedBeforeFlush = state.telemetryQueue.length;
 const sent = await flushTelemetry();
 if (!sent || state.telemetryQueue.length >= queuedBeforeFlush) {
 attempts++;
 if (attempts >= maxRetries) {
 return false;
 }
 await new Promise(r => setTimeout(r, 600 * attempts));
 } else {
 attempts = 0;
 }
 }
 return true;
}

// Flush approximately every 2.5 seconds (configured interval: 2500ms)
setInterval(() => {
 if (state.sessionId && state.telemetryQueue.length > 0 && !state.telemetryTerminal) {
 flushTelemetry();
 }
}, 2500);

// pagehide covers normal navigation and mobile backgrounding without duplicate beacons.
window.addEventListener('pagehide', () => {
 saveLocalState({ immediate: true });
 if (state.sessionId && state.telemetryQueue.length > 0) {
 const apiBase = window.ALFAAZ_API_URL || '';
 const payload = JSON.stringify({
 session_id: state.sessionId,
 events: state.telemetryQueue.slice(0, telemetryBatchSize)
 });
 navigator.sendBeacon(
 `${apiBase}/recruit/telemetry`,
 new Blob([payload], { type: 'application/json' })
 );
 }
});

// Tab Visibility Tracking
document.addEventListener('visibilitychange', () => {
 if (document.hidden) {
 logEvent(state.screen, 'visibility_hidden', { timestamp: Date.now() });
 logEvent(state.screen, 'tab_hidden', { timestamp: Date.now() });
 flushTelemetry();
 } else {
 logEvent(state.screen, 'visibility_visible', { timestamp: Date.now() });
 logEvent(state.screen, 'tab_visible', { timestamp: Date.now() });
 }
});

// Window Blur and Focus Tracking
window.addEventListener('blur', () => {
 logEvent(state.screen, 'blur', { timestamp: Date.now() });
});
window.addEventListener('focus', () => {
 logEvent(state.screen, 'focus', { timestamp: Date.now() });
});

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
 startKeepAlivePing();
 await restoreLocalState();
 renderScreen();
 setupGlobalControls();
});

function setupGlobalControls() {
 const pauseBtn = document.getElementById('pauseBtn');
 pauseBtn?.addEventListener('click', togglePause);

 const exitBtn = document.getElementById('exitBtn');
 exitBtn?.addEventListener('click', () => {
 if (confirm('Exit assessment for now? All completed responses are saved, and you can resume this session later on this device.')) {
 logEvent(state.screen, 'candidate_exited');
 flushTelemetry();
 window.location.href = 'index.html';
 }
 });
}

function togglePause() {
 if (state.isPaused) {
 state.isPaused = false;
 logEvent(state.screen, 'resume');
 state.screen = state.pausedPreviousScreen || 'sjt';
 renderScreen();
 } else {
 state.isPaused = true;
 state.pausedPreviousScreen = state.screen;
 logEvent(state.screen, 'pause');
 state.screen = 'paused';
 renderScreen();
 }
}

// Main Render Dispatcher
function announceToScreenReader(message) {
  const announcer = document.getElementById('a11yAnnouncer');
  if (announcer && message) {
    announcer.textContent = message;
  }
}

function focusMainHeading() {
  requestAnimationFrame(() => {
    const app = document.getElementById('recruitApp');
    if (!app) return;
    const heading = app.querySelector('h1, h2, [role="heading"]');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  });
}

function renderErrorPanel({ title = 'Connection Notice', message = 'A temporary connection issue occurred. Your progress is kept safe.', onRetry = null }) {
  const panel = document.createElement('div');
  panel.className = 'mt-5 p-4 sm:p-5 bg-[#fff8f5] border border-[#e8c8be] rounded-xs text-left shadow-xs space-y-3';
  panel.setAttribute('role', 'alert');
  panel.innerHTML = `
    <div class="flex items-start gap-3">
      <div class="w-7 h-7 rounded-full bg-[#fceae5] border border-[#e8c8be] text-[#bd6f5d] flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">!</div>
      <div class="space-y-1">
        <div class="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">${window.escapeHtml ? window.escapeHtml(title) : title}</div>
        <p class="text-xs text-stone-600 leading-relaxed">${window.escapeHtml ? window.escapeHtml(message) : message}</p>
      </div>
    </div>
    <div class="flex flex-wrap gap-2.5 pt-2 border-t border-[#f2ded7]">
      ${onRetry ? '<button type="button" class="error-retry-btn min-h-[44px] px-4 py-2 bg-[var(--text-primary)] text-white text-xs uppercase tracking-wider hover:bg-[var(--accent-gold)] transition-colors rounded-xs cursor-pointer">Try Again</button>' : ''}
      <button type="button" class="error-refresh-btn min-h-[44px] px-4 py-2 bg-white border border-[var(--grid-border)] text-stone-700 text-xs uppercase tracking-wider hover:bg-[#faf8f5] transition-colors rounded-xs cursor-pointer">Refresh Page</button>
    </div>
  `;
  if (onRetry) {
    panel.querySelector('.error-retry-btn')?.addEventListener('click', onRetry);
  }
  panel.querySelector('.error-refresh-btn')?.addEventListener('click', () => window.location.reload());
  return panel;
}

export function renderScreen() {
  scrollToTop();
  const app = document.getElementById('recruitApp');
 const headerControls = document.getElementById('sessionHeaderControls');
 const topProgressBar = document.getElementById('topProgressBar');
 const progressBarFill = document.getElementById('progressBarFill');

 if (state.screen !== 'consent' && state.screen !== 'complete' && state.screen !== 'paused') {
 headerControls?.classList.remove('hidden');
 topProgressBar?.classList.remove('hidden');
 } else {
 headerControls?.classList.add('hidden');
 topProgressBar?.classList.add('hidden');
 }

 if (window.lucide) window.lucide.createIcons();

 switch (state.screen) {
 case 'consent':
 renderConsent(app);
 break;
 case 'identity':
 renderIdentity(app);
 break;
 case 'accessibility':
 renderAccessibility(app);
 break;
 case 'warmup':
 renderWarmup(app);
 break;
 case 'sjt_briefing':
 renderSjtBriefing(app);
 break;
 case 'sjt':
 renderSJT(app, progressBarFill);
 break;
 case 'gba_briefing':
 renderGbaBriefing(app);
 break;
 case 'games':
 renderGames(app, progressBarFill);
 break;
 case 'paused':
 renderPaused(app);
 break;
 case 'complete':
 renderComplete(app);
 break;
 }
  const screenTitles = {
    consent: 'Prologue: Consent and Compliance',
    identity: 'Step 1 of 4: Candidate Information',
    accessibility: 'Step 2 of 4: Accessibility Preferences',
    warmup: 'Step 3 of 4: Interface Warmup',
    sjt_briefing: 'Part 1 Briefing: Situational Judgment Assessment',
    sjt: 'Part 1 in progress: Situational Judgment Assessment',
    gba_briefing: 'Part 2 Briefing: Interactive Behavioral Tasks',
    games: 'Part 2 in progress: Interactive Behavioral Tasks',
    paused: 'Assessment Paused',
    complete: 'Assessment Complete'
  };
  announceToScreenReader(screenTitles[state.screen] || 'Assessment section loaded');
  focusMainHeading();
}

// 1. Consent Screen
function renderConsent(app) {
 app.innerHTML = `
 <div class="max-w-2xl mx-auto py-8 px-4">
 <div class="mb-12 text-center space-y-4">
 <span class="text-[10px] uppercase tracking-widest text-[var(--accent-gold)] font-medium">Prologue &middot; Consent & Compliance</span>
 <h1 class="text-3xl text-[var(--text-primary)]">The Studio Assessment</h1>
 <p class="text-sm text-black italic max-w-lg mx-auto leading-relaxed">
 Before we begin our creative exchange, we require your explicit consent to ensure a safe and transparent environment.
 </p>
 </div>

 <div class="space-y-10">
 <!-- Section 1: The Experience -->
 <div class="relative pl-6 border-l border-[var(--grid-border)]">
 <div class="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-[var(--bg-primary)] border border-[var(--accent-gold)]"></div>
 <h2 class="text-lg text-[var(--text-primary)] mb-2">The Experience</h2>
 <p class="text-sm text-black leading-relaxed">
 This is a 20-25 minute exploratory journey. You will encounter situational judgments and creative micro-tasks.
 There are no right or wrong answers—only different perspectives. You may pause, skip, or withdraw at any time without penalty.
 </p>
 </div>

 <!-- Section 2: Why We Collect Data -->
 <div class="relative pl-6 border-l border-[var(--grid-border)]">
 <div class="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-[var(--bg-primary)] border border-[var(--accent-green)]"></div>
 <h2 class="text-lg text-[var(--text-primary)] mb-2">Why We Observe</h2>
 <p class="text-sm text-black leading-relaxed">
 As you interact with the tasks, we collect behavioral telemetry.
 <strong>Why do we do this?</strong> To understand your intuitive working style. It helps us match you to the right
 creative roles within the collective.
 Your raw data is pseudonymous and will never be used for automated rejection or sold to third parties.
 </p>
 <p class="text-sm text-black leading-relaxed">
 Contact Us: <a href="mailto:alfaaz2k20@gmail.com" class="text-[var(--accent-gold)] hover:underline">alfaaz2k20@gmail.com</a>
 </p>
 </div>
 </div>

 <form id="consentForm" class="mt-16 pt-8 border-t border-[var(--grid-border)] space-y-6">
 <div class="flex items-start gap-3">
 <input type="checkbox" id="ageConfirm" required class="mt-1 w-4 h-4 accent-[#bd6f5d] cursor-pointer">
 <label for="ageConfirm" class="text-sm text-[var(--text-primary)] cursor-pointer">
 I confirm that I am 18 years of age or older, and I am participating voluntarily.
 </label>
 </div>

 <div class="flex items-start gap-3">
 <input type="checkbox" id="consentAgree" required class="mt-1 w-4 h-4 accent-[#bd6f5d] cursor-pointer">
 <label for="consentAgree" class="text-sm text-[var(--text-primary)] cursor-pointer">
 I explicitly consent to the collection of my behavioral telemetry during this session to help the collective understand my creative profile.
 </label>
 </div>

 <div id="recruitTurnstile" class="pt-2"></div>

 <div class="pt-8 flex justify-center sm:justify-end">
 <button type="submit" aria-disabled="true" class="interactive-option px-8 py-3 bg-[var(--text-primary)] text-white text-xs uppercase tracking-widest hover:bg-[var(--accent-gold)] opacity-40">
 Enter the Studio &rarr;
 </button>
 </div>
 </form>
 </div>
 `;

 const ageConfirm = document.getElementById('ageConfirm');
 const consentAgree = document.getElementById('consentAgree');
 const consentSubmit = document.querySelector('#consentForm button[type="submit"]');

 const updateConsentSubmitState = () => {
 const ready = Boolean(ageConfirm?.checked && consentAgree?.checked);
 consentSubmit?.setAttribute('aria-disabled', String(!ready));
 consentSubmit?.classList.toggle('opacity-40', !ready);
 };

 ageConfirm?.addEventListener('change', updateConsentSubmitState);
 consentAgree?.addEventListener('change', updateConsentSubmitState);
 updateConsentSubmitState();
 if (window.turnstile && document.getElementById('recruitTurnstile')) {
   try {
     window.turnstile.render('#recruitTurnstile', {
       sitekey: window.ALFAAZ_TURNSTILE_SITEKEY || '1x00000000000000000000AA',
       theme: 'light'
     });
   } catch (_) {}
 }

 document.getElementById('consentForm')?.addEventListener('submit', async (e) => {
 e.preventDefault();
 const btn = e.target.querySelector('button[type="submit"]');
 if (btn?.getAttribute('aria-disabled') === 'true') return;

 const origText = btn ? btn.innerHTML : 'Enter the Studio &rarr;';
 if (btn) {
 btn.setAttribute('aria-disabled', 'true');
 btn.innerHTML = 'Preparing Workspace...';
 }

 try {
 const researchParticipationConsent = consentAgree.checked;
 const turnstileToken = window.turnstile ? (window.turnstile.getResponse() || '') : (document.querySelector('[name="cf-turnstile-response"]')?.value || '');
 const res = await apiFetch('/recruit/consent', {
 method: 'POST',
 body: JSON.stringify({
 confirmed_18_plus: ageConfirm.checked,
 choices: { research_telemetry: researchParticipationConsent },
 turnstile_token: turnstileToken
 })
 });
 if (!res.ok) throw new Error(`Network error: ${res.status}`);
 const data = await res.json();
 state.sessionId = data.session_id;
 state.configHash = data.config_hash || null;
 state.worldSequence = data.world_sequence || [];
 state.seeds = data.seeds || {};
 saveLocalState({ immediate: true });

 flushTelemetry();

 state.screen = 'identity';
 renderScreen();
 } catch (err) {
 console.error('[Consent error]', err);
 if (btn) {
   btn.innerHTML = origText;
   btn.setAttribute('aria-disabled', 'false');
 }
 const form = document.getElementById('consentForm');
 form?.querySelectorAll('.error-banner').forEach(el => el.remove());
 const errPanel = renderErrorPanel({
   title: 'Unable to start session',
   message: 'Could not connect to the studio server. Please check your connection and try again.',
   onRetry: () => form?.dispatchEvent(new Event('submit', { cancelable: true }))
 });
 errPanel.classList.add('error-banner');
 form?.appendChild(errPanel);
 }
 });
}

function renderIdentity(app) {
  app.innerHTML = `
  <div class="space-y-6 max-w-lg mx-auto">
    <div class="border-b border-[var(--grid-border)] pb-4 text-center">
      <span class="act-badge">Participant Details</span>
      <h1 class="text-2xl sm:text-3xl text-[var(--text-primary)] font-serif">About You</h1>
    </div>

    <!-- Brief Assessment Process Overview in Simple English -->
    <div class="p-4 sm:p-5 bg-[#faf8f5] border border-[var(--grid-border)] text-xs text-stone-700 space-y-3 leading-relaxed">
      <div class="flex items-center gap-2">
        <span class="w-1.5 h-1.5 rounded-full bg-[var(--accent-gold)]"></span>
        <span class="font-semibold text-stone-900 uppercase tracking-widest text-[11px]">How the Assessment Works</span>
      </div>
      <p class="text-stone-600">
        This session takes about <strong>11–14 minutes</strong>. It consists of <strong>two simple parts</strong>, followed by a friendly interview:
      </p>
      <div class="space-y-2 pt-1 border-t border-[var(--grid-border)]/60">
        <div class="flex items-start gap-2.5">
          <span class="font-mono font-bold text-[var(--accent-gold)] shrink-0 text-xs">Part 1</span>
          <div>
            <strong class="text-stone-900">Situational Scenarios:</strong>
            <span class="text-stone-600 block mt-0.5">Read short everyday situations from art and community teamwork, then choose what you would do.</span>
          </div>
        </div>
        <div class="flex items-start gap-2.5">
          <span class="font-mono font-bold text-[var(--accent-gold)] shrink-0 text-xs">Part 2</span>
          <div>
            <strong class="text-stone-900">Interactive Activities:</strong>
            <span class="text-stone-600 block mt-0.5">Quick, hands-on visual activities that observe how you focus, pace decisions, and collaborate.</span>
          </div>
        </div>
      </div>
      <div class="pt-2 border-t border-[var(--grid-border)]/60 text-stone-600 flex items-start gap-2">
        <span class="font-mono font-bold text-stone-900 shrink-0 text-xs">&rarr;</span>
        <span>
          <strong class="text-stone-900">Next Step &mdash; Interview Call:</strong>
          After you finish both parts, we will invite you to an interview conversation to speak with our team directly.
        </span>
      </div>
    </div>

    <form id="identityForm" class="space-y-4 pt-1">
      <div>
        <label for="fullName" class="block text-xs uppercase tracking-wider text-black mb-1">Full Name *</label>
        <input type="text" id="fullName" required class="w-full p-2.5 bg-white border border-[var(--grid-border)] focus:border-[var(--accent-gold)] focus:outline-none" placeholder="Your full name">
      </div>
      <div>
        <label for="email" class="block text-xs uppercase tracking-wider text-black mb-1">Email Address *</label>
        <input type="email" id="email" required class="w-full p-2.5 bg-white border border-[var(--grid-border)] focus:border-[var(--accent-gold)] focus:outline-none" placeholder="you@example.com">
      </div>
      <div>
        <label for="whatsappNo" class="block text-xs uppercase tracking-wider text-black mb-1">WhatsApp Number *</label>
        <input type="tel" id="whatsappNo" required class="w-full p-2.5 bg-white border border-[var(--grid-border)] focus:border-[var(--accent-gold)] focus:outline-none" placeholder="+91 ... or WhatsApp number with country code">
      </div>
      <div>
        <label for="linkedinUrl" class="block text-xs uppercase tracking-wider text-stone-600 mb-1">LinkedIn / CV / Portfolio Link <span class="normal-case text-stone-400 font-normal">(Optional)</span></label>
        <input type="url" id="linkedinUrl" class="w-full p-2.5 bg-white border border-[var(--grid-border)] focus:border-[var(--accent-gold)] focus:outline-none" placeholder="https://linkedin.com/in/... or portfolio / CV link">
      </div>
      <div class="pt-4 flex justify-end">
        <button type="submit" class="w-full sm:w-auto px-6 py-2.5 bg-[var(--text-primary)] text-white text-xs uppercase tracking-widest hover:bg-[var(--accent-gold)] transition-colors">
          Begin Assessment &rarr;
        </button>
      </div>
    </form>
  </div>
  `;

  document.getElementById('identityForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const origText = btn ? btn.innerHTML : 'Begin Assessment &rarr;';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = 'Connecting...';
    }

    try {
      const fullNameVal = document.getElementById('fullName')?.value.trim();
      const emailVal = document.getElementById('email')?.value.trim();
      const whatsappVal = document.getElementById('whatsappNo')?.value.trim();
      const linkedinVal = document.getElementById('linkedinUrl')?.value.trim() || null;

      if (!fullNameVal || !emailVal || !whatsappVal) {
        throw new Error('Please fill in all required fields (Name, Email, WhatsApp number).');
      }

      const resp = await apiFetch('/recruit/identity', {
        method: 'POST',
        body: JSON.stringify({
          session_id: state.sessionId,
          full_name: fullNameVal,
          email: emailVal,
          phone_or_contact: whatsappVal,
          whatsapp_no: whatsappVal,
          linkedin_url: linkedinVal
        })
      });
      if (!resp || !resp.ok) {
        const errData = resp ? await resp.json().catch(() => ({})) : {};
        throw new Error(errData.detail || (resp ? `Server returned ${resp.status}` : 'No response from server'));
      }

      state.candidateName = fullNameVal;
      state.candidateEmail = emailVal;
      state.candidatePhone = whatsappVal;

      state.screen = 'accessibility';
      logEvent('identity', 'identity_submitted', { has_whatsapp: Boolean(whatsappVal), has_linkedin: Boolean(linkedinVal) });
      saveLocalState({ immediate: true });
      renderScreen();
    } catch (err) {
      console.error('[Identity error]', err);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origText;
      }
      const form = document.getElementById('identityForm');
      form?.querySelectorAll('.error-banner').forEach(el => el.remove());
      const errPanel = renderErrorPanel({
        title: 'Unable to register participant',
        message: err.message || 'Could not submit your details due to a connection delay. Please try again.',
        onRetry: () => form?.dispatchEvent(new Event('submit', { cancelable: true }))
      });
      errPanel.classList.add('error-banner');
      form?.appendChild(errPanel);
    }
  });
}

// 2. Accessibility Options Screen
function applyAccessibility(modes = []) {
 if (typeof document === 'undefined' || !document.documentElement) return;
 const doc = document.documentElement;
 doc.classList.toggle('a11y-high-contrast', modes.includes('high_contrast'));
 doc.classList.toggle('a11y-dyslexia-font', modes.includes('dyslexia_font'));
 doc.classList.toggle('a11y-reduced-motion', modes.includes('reduced_motion'));
}

function renderAccessibility(app) {
 const modes = state.accessibilityModes || [];
 const hasAccommodations = modes.length > 0;
 app.innerHTML = `
 <div class="space-y-6">
 <div class="border-b border-[var(--grid-border)] pb-3 text-center">
 <span class="act-badge">Preferences · ترجیحات</span>
 <h2 class="text-2xl text-[var(--text-primary)]">Display & Comfort Preferences</h2>
 <p class="text-xs text-black mt-2 max-w-lg mx-auto leading-relaxed">
 Make your screen comfortable before beginning. You can adjust the visual display, reading style, or motion settings to best match your eyes and device. These options only adjust how items appear on your screen—they never affect your assessment or evaluation. Choose any adjustments you'd like, or select &ldquo;No adjustments needed&rdquo; to continue with standard settings.
 </p>
 </div>

 <div class="space-y-3 pt-2">
 <label class="flex items-start gap-3 p-3 bg-[#faf8f5] border border-[var(--grid-border)] cursor-pointer hover:bg-white transition-colors">
 <input type="checkbox" id="a11y_none" class="mt-1 accent-[#bd6f5d]" ${!hasAccommodations ? 'checked' : ''}>
 <div>
 <div class="text-sm font-medium text-[var(--text-primary)]">No adjustments needed (Standard Display)</div>
 <div class="text-xs text-black mt-0.5">I do not require visual, reading, or motion adjustments. Continue with standard studio settings.</div>
 </div>
 </label>
 <label class="flex items-start gap-3 p-3 bg-[#faf8f5] border border-[var(--grid-border)] cursor-pointer hover:bg-white transition-colors">
 <input type="checkbox" id="a11y_contrast" class="mt-1 accent-[#bd6f5d]" ${modes.includes('high_contrast') ? 'checked' : ''}>
 <div>
 <div class="text-sm font-medium text-[var(--text-primary)]">High Contrast Display</div>
 <div class="text-xs text-black mt-0.5">Increases text contrast, element borders, and background separation for clearer visibility.</div>
 </div>
 </label>
 <label class="flex items-start gap-3 p-3 bg-[#faf8f5] border border-[var(--grid-border)] cursor-pointer hover:bg-white transition-colors">
 <input type="checkbox" id="a11y_dyslexia" class="mt-1 accent-[#bd6f5d]" ${modes.includes('dyslexia_font') ? 'checked' : ''}>
 <div>
 <div class="text-sm font-medium text-[var(--text-primary)]">Dyslexia-Friendly Typography</div>
 <div class="text-xs text-black mt-0.5">Applies a high-legibility sans-serif typeface with enhanced letter and line spacing.</div>
 </div>
 </label>
 <label class="flex items-start gap-3 p-3 bg-[#faf8f5] border border-[var(--grid-border)] cursor-pointer hover:bg-white transition-colors">
 <input type="checkbox" id="a11y_motion" class="mt-1 accent-[#bd6f5d]" ${modes.includes('reduced_motion') ? 'checked' : ''}>
 <div>
 <div class="text-sm font-medium text-[var(--text-primary)]">Reduced Motion</div>
 <div class="text-xs text-black mt-0.5">Removes non-essential animations, pulsing transitions, and rapid movement.</div>
 </div>
 </label>
 </div>

 <div class="pt-4 flex flex-col sm:flex-row justify-between items-center gap-3">
 <span class="text-xs text-black italic">Preferences are strictly for your comfort and never lower your result or count against you in any way.</span>
 <button id="saveA11yBtn" class="min-h-[44px] px-8 py-2.5 bg-[var(--text-primary)] text-white text-xs uppercase tracking-widest hover:bg-[var(--accent-gold)] shadow-sm rounded-xs">
 Continue &rarr;
 </button>
 </div>
 </div>
 `;

 const noneCb = document.getElementById('a11y_none');
 const contrastCb = document.getElementById('a11y_contrast');
 const dyslexiaCb = document.getElementById('a11y_dyslexia');
 const motionCb = document.getElementById('a11y_motion');

 if (noneCb) {
 noneCb.addEventListener('change', () => {
 if (noneCb.checked) {
 if (contrastCb) contrastCb.checked = false;
 if (dyslexiaCb) dyslexiaCb.checked = false;
 if (motionCb) motionCb.checked = false;
 } else {
 if (!contrastCb?.checked && !dyslexiaCb?.checked && !motionCb?.checked) {
 noneCb.checked = true;
 }
 }
 });
 }

 const onAdjustmentChange = () => {
 const anyChecked = Boolean(contrastCb?.checked || dyslexiaCb?.checked || motionCb?.checked);
 if (anyChecked) {
 if (noneCb) noneCb.checked = false;
 } else {
 if (noneCb) noneCb.checked = true;
 }
 };

 contrastCb?.addEventListener('change', onAdjustmentChange);
 dyslexiaCb?.addEventListener('change', onAdjustmentChange);
 motionCb?.addEventListener('change', onAdjustmentChange);

 document.getElementById('saveA11yBtn')?.addEventListener('click', async (e) => {
 const btn = e.currentTarget;
 if (btn.disabled) return;
 btn.disabled = true;
 btn.textContent = 'Saving...';

 const selectedModes = [];
 if (noneCb?.checked) {
 // Standard settings: no adjustments requested
 } else {
 if (contrastCb?.checked) selectedModes.push('high_contrast');
 if (dyslexiaCb?.checked) selectedModes.push('dyslexia_font');
 if (motionCb?.checked) selectedModes.push('reduced_motion');
 }

 state.accessibilityModes = selectedModes;
 applyAccessibility(selectedModes);

 try {
 await apiFetch('/recruit/accessibility', {
 method: 'POST',
 body: JSON.stringify({
 session_id: state.sessionId,
 modes_enabled: selectedModes
 })
 });
 } catch (err) {
 console.warn('Accessibility preferences save error:', err);
 }

 state.screen = 'warmup';
 logEvent('accessibility', 'preferences_saved', { modes: selectedModes });
 saveLocalState({ immediate: true });
 renderScreen();
 });
}

// 3. Warm-up Phase
function renderWarmup(app) {
 let taps = [];
 let warmupStartTime = performance.now();

 app.innerHTML = `
 <div class="space-y-6 text-center py-4 ">
 <span class="act-badge">Device Check · رہنمائی</span>
 <h2 class="text-2xl text-[var(--text-primary)]">Screen & Rhythm Check</h2>
 <p class="text-xs text-black max-w-md mx-auto leading-relaxed">
 Please tap or click the center circle 3 times at a natural, comfortable pace to check your device.
 </p>

 <div class="py-8 flex justify-center">
 <button id="tapTarget" class="w-24 h-24 rounded-full border-2 border-[var(--accent-gold)] bg-white text-[var(--accent-gold)] text-xl flex items-center justify-center hover:bg-amber-50 shadow-sm">
 Tap (0/3)
 </button>
 </div>

 <div id="warmupStatus" class="text-xs text-black tracking-wider uppercase font-medium">
 Waiting for tap 1 of 3...
 </div>
 </div>
 `;

 const btn = document.getElementById('tapTarget');
 const status = document.getElementById('warmupStatus');

 btn?.addEventListener('click', async () => {
 taps.push(performance.now());
 const count = taps.length;
 btn.textContent = `Tap (${count}/3)`;
 status.textContent = `Recorded tap ${count} of 3`;

 if (count >= 3) {
 btn.setAttribute('disabled', 'true');
 btn.classList.add('opacity-50');

 const latencies = [taps[1] - taps[0], taps[2] - taps[1]];
 const avgLatency = (latencies[0] + latencies[1]) / 2;
 const readingDwell = performance.now() - warmupStartTime;

 try {
 await apiFetch('/recruit/warmup', {
 method: 'POST',
 body: JSON.stringify({
 session_id: state.sessionId,
 tap_latency_baseline_ms: avgLatency,
 reading_dwell_baseline_ms: readingDwell,
 pointer_type: 'ontouchstart' in window ? 'touch' : 'mouse',
 viewport_class: window.innerWidth < 768 ? 'mobile' : 'desktop'
 })
 });
 } catch (err) {
 console.warn('Warmup save error:', err);
 }

 logEvent('warmup', 'warmup_completed', { avgLatency, readingDwell });

 // Load Public SJT payload with clear loading state and retry resilience
 async function loadSjtWithRetry() {
 app.innerHTML = `
 <div class="space-y-6 text-center py-16 ">
 <div class="waiting-spinner"></div>
 <h2 class="text-xl text-[var(--text-primary)]">Loading Scenarios...</h2>
 <p class="text-xs text-black max-w-sm mx-auto leading-relaxed">
 Connecting to the assessment server. This may take a few moments if starting from cold.
 </p>
 </div>
 `;

 try {
 const sjtResp = await apiFetch('/recruit/sjt/public');
 if (!sjtResp || !sjtResp.ok) {
 throw new Error(sjtResp ? `Server returned HTTP ${sjtResp.status}` : 'Network timeout');
 }
 const sjtData = await sjtResp.json();
      const rawScenarios = (sjtData && sjtData.scenarios && sjtData.scenarios.length > 0) ? sjtData.scenarios : FALLBACK_V2_1_SCENARIOS;
      state.sjtScenarios = rawScenarios.map(sc => {
        const v21 = SJT_V2_1_COPY[sc.id];
        if (!v21) return sc;
        return {
          ...sc,
          act_title_en: v21.act_title_en || sc.act_title?.en || sc.act_title_en,
          act_title_ur: v21.act_title_ur || sc.act_title?.ur || sc.act_title_ur,
          setup: v21.setup || sc.setup,
          options: (sc.options || []).map(opt => ({
            ...opt,
            text: (v21.options && v21.options[opt.id]) || opt.text
          }))
        };
      });
 state.currentSjtIndex = 0;
 state.screen = 'sjt_briefing';
 saveLocalState({ immediate: true });
 renderScreen();
 } catch (err) {
 console.warn('Failed to load SJT payload:', err);
 app.innerHTML = `
 <div class="space-y-6 text-center py-12 ">
 <div class="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 text-[var(--text-primary)] flex items-center justify-center mx-auto text-xl ">!</div>
 <h2 class="text-xl text-[var(--text-primary)]">Connection Notice</h2>
 <p class="text-xs text-black max-w-sm mx-auto leading-relaxed">
 The server is taking longer than expected to respond. Your device check is safely saved.
 </p>
 <div class="pt-2">
 <button id="retrySjtLoadBtn" class="min-h-[44px] px-6 py-2.5 bg-[var(--text-primary)] text-white text-xs uppercase tracking-widest hover:bg-[var(--accent-gold)] shadow-sm rounded-xs">
 Retry Connection &rarr;
 </button>
 </div>
 </div>
 `;
 document.getElementById('retrySjtLoadBtn')?.addEventListener('click', () => {
 loadSjtWithRetry();
 });
 }
 }

 loadSjtWithRetry();
 }
 });
}

// 4. Section 1 Orientation (SJT Briefing)
function renderSjtBriefing(app) {
 const segmentProgress = document.getElementById('segmentProgress');
 if (segmentProgress) {
 segmentProgress.innerHTML = '<span>Section 1 &middot; Overview</span>';
 }
 const progressBarFill = document.getElementById('progressBarFill');
 if (progressBarFill) {
 progressBarFill.style.width = '0%';
 }

 app.innerHTML = `
 <div class="max-w-2xl mx-auto py-4 sm:py-6 space-y-6">
 <!-- Header: English Left, Urdu Right -->
 <div class="flex justify-between items-start pb-4 border-b border-[var(--grid-border)]">
 <div>
 <span class="act-badge">Section 1 &middot; Overview</span>
 <h1 class="text-xl sm:text-3xl font-serif text-[var(--text-primary)]">Situational Scenarios</h1>
 </div>
 <div class="text-right shrink-0">
 <span class="font-serif text-xl sm:text-3xl text-[var(--text-secondary)] block" style="font-family: var(--font-urdu); direction: rtl;">تفہیم و ارادہ</span>
 <span class="text-[10px] sm:text-xs text-[var(--accent-gold)] uppercase tracking-wider block mt-1">7 Scenarios</span>
 </div>
 </div>

 <p class="text-sm sm:text-base text-[var(--text-primary)] leading-relaxed">
 You will read 7 short situations from creative studio life, community events, and teamwork.
 </p>

 <!-- 3 Spacious Step Cards (Zero Construct Exposure) -->
 <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
 <div class="bg-[#faf8f5] border border-[var(--grid-border)] p-4 rounded-xs space-y-2">
 <div class="w-7 h-7 rounded-full bg-[var(--accent-gold)] text-white text-xs flex items-center justify-center font-serif">1</div>
 <h3 class="text-sm font-semibold text-[var(--text-primary)]">Read the Story</h3>
 <p class="text-xs text-[var(--text-secondary)] leading-relaxed">
 Each card describes a real situation that took place in the studio.
 </p>
 </div>

 <div class="bg-[#faf8f5] border border-[var(--grid-border)] p-4 rounded-xs space-y-2">
 <div class="w-7 h-7 rounded-full bg-[var(--accent-gold)] text-white text-xs flex items-center justify-center font-serif">2</div>
 <h3 class="text-sm font-semibold text-[var(--text-primary)]">Pick Your Choice</h3>
 <p class="text-xs text-[var(--text-secondary)] leading-relaxed">
 Choose the response that best matches what you would actually do.
 </p>
 </div>

 <div class="bg-[#faf8f5] border border-[var(--grid-border)] p-4 rounded-xs space-y-2">
 <div class="w-7 h-7 rounded-full bg-[var(--accent-gold)] text-white text-xs flex items-center justify-center font-serif">3</div>
 <h3 class="text-sm font-semibold text-[var(--text-primary)]">No Trick Questions</h3>
 <p class="text-xs text-[var(--text-secondary)] leading-relaxed">
 There is no right or wrong answer. Pick what you would genuinely do.
 </p>
 </div>
 </div>

 <!-- Pacing & Action Bar -->
 <div class="pt-6 border-t border-[var(--grid-border)] flex flex-col sm:flex-row justify-between items-center gap-4">
 <span class="text-xs text-[var(--text-secondary)]">7 scenarios &middot; Self-paced (approx. 6–8 mins) &middot; Tap options or press keys 1–4</span>
 <button id="startSjtBtn" class="w-full sm:w-auto min-h-[44px] px-8 py-3 bg-[var(--text-primary)] text-white text-xs uppercase tracking-widest hover:bg-[var(--accent-gold)] shadow-sm rounded-xs">
 Begin Section 1: Scenarios &rarr;
 </button>
 </div>
 </div>
 `;

 logEvent('sjt_briefing', 'briefing_viewed');

 document.getElementById('startSjtBtn')?.addEventListener('click', () => {
 state.screen = 'sjt';
 saveLocalState({ immediate: true });
 renderScreen();
 });
}

// 5. SJT Phase

 let sjtKeydownHandler = null;

 function selectSjtOption(scenario, optId, inputType) {
    if (state.sjtResponses[scenario.id] === optId) return;

    state.sjtResponses[scenario.id] = optId;
    logEvent('sjt', inputType === 'keyboard' ? 'option_selected_key' : 'option_selected', { scenario_id: scenario.id, option_id: optId });

    // Update DOM classes and aria attributes instead of full render
    const cards = document.querySelectorAll('.option-card');
    cards.forEach(c => {
        if (c.getAttribute('data-opt-id') === optId) {
            c.classList.add('selected');
            c.setAttribute('aria-pressed', 'true');
            c.focus();
        } else {
            c.classList.remove('selected');
            c.setAttribute('aria-pressed', 'false');
        }
    });

    const nextBtn = document.getElementById('nextSjtBtn');
    if (nextBtn) nextBtn.disabled = false;
    saveLocalState();
 }

 function renderSJT(app, progressBarFill) {

 const baseScenario = state.sjtScenarios[state.currentSjtIndex];
 if (!baseScenario) {
 submitSjtAndProceed();
 return;
 }
 const v21 = SJT_V2_1_COPY[baseScenario.id];
 const scenario = v21 ? {
   ...baseScenario,
   act_title_en: v21.act_title_en || baseScenario.act_title_en,
   act_title_ur: v21.act_title_ur || baseScenario.act_title_ur,
   setup: v21.setup || baseScenario.setup,
   options: (baseScenario.options || []).map(opt => ({
     ...opt,
     text: (v21.options && v21.options[opt.id]) || opt.text
   }))
 } : baseScenario;

 const total = state.sjtScenarios.length;
 const current = state.currentSjtIndex + 1;
 // Total 21 assessment units: 7 Judgment scenarios + 14 Interactive Activities
 if (progressBarFill) {
 progressBarFill.style.width = `${((current - 1) / 21) * 100}%`;
 }

 const segmentProgress = document.getElementById('segmentProgress');
 if (segmentProgress) {
 const remainingMins = Math.max(1, Math.round(((total - current + 1) * 35 + 14 * 32) / 60));
 segmentProgress.innerHTML = `<span class="text-black hidden sm:inline mr-2 text-[10px] sm:text-xs font-normal">About ${remainingMins} mins remaining</span><span>Judgment ${current} / ${total}</span>`;
 }

 const selectedOptId = state.sjtResponses[scenario.id] || null;

 const optionsHtml = scenario.options.map(opt => `
 <div class="outside-opt-card option-card ${selectedOptId === opt.id ? 'selected' : ''}" data-opt-id="${opt.id}" tabindex="0" role="button" aria-pressed="${selectedOptId === opt.id ? 'true' : 'false'}" aria-label="Option ${opt.id.slice(-1)}">
 <div class="opt-bullet">${opt.id.slice(-1)}</div>
 <div style="flex:1;" class="text-[13px] sm:text-sm text-[var(--text-primary)] font-medium leading-snug sm:leading-normal">${opt.text}</div>
 </div>
 `).join('');

 app.innerHTML = `
 <div class="space-y-3.5 sm:space-y-5">
 <!-- Top Context: English Title on Top-Left, Urdu on Top-Right -->
 <div class="border-b border-[var(--grid-border)] pb-2.5 sm:pb-3 flex justify-between items-start gap-3 sm:gap-4">
 <div>
 <span class="act-badge">Scenario ${current} of ${total}</span>
 <h2 class="text-base sm:text-xl font-serif text-[var(--text-primary)] mt-0.5">${scenario.act_title_en}</h2>
 </div>
 <div class="text-right shrink-0">
 ${scenario.act_title_ur ? `<span class="font-serif text-lg sm:text-2xl text-[var(--text-secondary)] block" style="font-family: var(--font-urdu); direction: rtl;">${scenario.act_title_ur}</span>` : ''}
 <span class="text-[10px] sm:text-xs text-[var(--accent-gold)] uppercase tracking-wider block mt-1">Section 1 &middot; ${current} of ${total}</span>
 </div>
 </div>

 <!-- SITUATION / STIMULUS: Prominent serif text (Hero) -->
 <div class="scenario-text text-sm sm:text-base font-serif text-[var(--text-primary)] leading-normal sm:leading-relaxed bg-[#faf8f5] p-3.5 sm:p-5 border-l-4 border-l-[var(--accent-gold)] border border-[var(--grid-border)] rounded-xs shadow-xs">
 ${scenario.setup}
 </div>

 <!-- YOUR TASK: Placed immediately before options -->
 <div class="py-2 px-2.5 sm:p-3 bg-amber-50/70 border border-[var(--accent-gold)]/40 rounded-xs flex items-center gap-2">
 <span class="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[var(--accent-gold)] inline-block shrink-0"></span>
 <div class="text-[11px] sm:text-xs font-semibold text-[var(--text-primary)]">
 <strong class="uppercase text-[10px] sm:text-xs tracking-wider text-[var(--accent-gold)] mr-1">Your Task:</strong>
 Read the situation above and pick what you would do.
 </div>
 </div>

 <!-- OPTIONS -->
 <div class="space-y-2 sm:space-y-2.5">
 ${optionsHtml}
 </div>

 <!-- PRIMARY ACTION -->
 <div class="pt-4 sm:pt-5 flex flex-col sm:flex-row justify-between items-center gap-3 border-t border-[var(--grid-border)]">
 <span class="text-xs text-[var(--text-secondary)] order-2 sm:order-1 text-[11px]">Tip: Press keys 1 to 4 on your keyboard, or click an option</span>
 <button id="nextSjtBtn" ${selectedOptId ? '' : 'disabled'} class="w-full sm:w-auto min-h-[44px] px-8 py-3 bg-[var(--text-primary)] text-white text-xs uppercase tracking-widest hover:bg-[var(--accent-gold)] disabled:opacity-40 disabled:hover:bg-[var(--text-primary)] shadow-sm rounded-xs order-1 sm:order-2">
 ${current === total ? 'Complete Section 1 &rarr;' : 'Next Scenario &rarr;'}
 </button>
 </div>
 </div>
 `;

 logEvent('sjt', 'scenario_displayed', { scenario_id: scenario.id, index: current });

 // Option selection handlers
   app.querySelectorAll('.option-card').forEach(card => {
     card.addEventListener('click', () => {
       const optId = card.getAttribute('data-opt-id');
       selectSjtOption(scenario, optId, 'pointer');
     });
   });

   document.getElementById('nextSjtBtn')?.addEventListener('click', () => {
     if (state.sjtResponses[scenario.id]) {
       state.currentSjtIndex++;
       if (sjtKeydownHandler) {
         document.removeEventListener('keydown', sjtKeydownHandler);
         sjtKeydownHandler = null;
       }
       renderSJT(app, progressBarFill);
       scrollToTop();
     }
   });

   if (sjtKeydownHandler) {
     document.removeEventListener('keydown', sjtKeydownHandler);
   }
   sjtKeydownHandler = (e) => {
     if (['1', '2', '3', '4'].includes(e.key)) {
       const idx = parseInt(e.key) - 1;
       if (scenario.options[idx]) {
         selectSjtOption(scenario, scenario.options[idx].id, 'keyboard');
       }
     } else if (e.key === 'Enter') {
       const nextBtn = document.getElementById('nextSjtBtn');
       if (nextBtn && !nextBtn.disabled) {
         nextBtn.click();
       }
     }
   };
   document.addEventListener('keydown', sjtKeydownHandler);
}

let isSubmittingSjt = false;
async function submitSjtAndProceed() {
 if (isSubmittingSjt) return;
 isSubmittingSjt = true;
 if (sjtKeydownHandler) { document.removeEventListener('keydown', sjtKeydownHandler); sjtKeydownHandler = null; }
 const app = document.getElementById('recruitApp');
 if (app) {
 app.innerHTML = `
 <div class="space-y-6 text-center py-16 ">
 <div class="waiting-spinner"></div>
 <h2 class="text-xl text-[var(--text-primary)]">Saving Judgments...</h2>
 <p class="text-xs text-black">Recording your situation judgments to your session profile.</p>
 </div>
 `;
 }

 try {
 const res = await apiFetch('/recruit/sjt/submit', {
 method: 'POST',
 body: JSON.stringify({
 session_id: state.sessionId,
 responses: state.sjtResponses
 })
 });
 if (!res || !res.ok) {
 throw new Error(res ? `Server returned HTTP ${res.status}` : 'Connection failed');
 }
 state.screen = 'gba_briefing';
 state.currentWorldIndex = 0;
 state.currentMiniGameIndex = 0;
 logEvent('sjt', 'sjt_complete', { response_count: Object.keys(state.sjtResponses).length });
 saveLocalState({ immediate: true });
 renderScreen();
 } catch (err) {
 console.warn('SJT submit error:', err);
 if (app) {
 app.innerHTML = `
 <div class="space-y-6 text-center py-12 ">
 <div class="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 text-[var(--text-primary)] flex items-center justify-center mx-auto text-xl ">!</div>
 <h2 class="text-xl text-[var(--text-primary)]">Submission Notice</h2>
 <p class="text-xs text-black max-w-sm mx-auto leading-relaxed">
 Could not record responses due to a temporary server connection delay. Your choices are safely kept.
 </p>
 <div class="pt-2">
 <button id="retrySjtSubmitBtn" class="min-h-[44px] px-6 py-2.5 bg-[var(--text-primary)] text-white text-xs uppercase tracking-widest hover:bg-[var(--accent-gold)] shadow-sm rounded-xs">
 Retry Submission &rarr;
 </button>
 </div>
 </div>
 `;
 const retrySjtBtn = document.getElementById('retrySjtSubmitBtn');
 if (retrySjtBtn) {
 retrySjtBtn.addEventListener('click', () => {
 retrySjtBtn.disabled = true;
 retrySjtBtn.textContent = 'Submitting...';
 submitSjtAndProceed();
 });
 }
 }
 } finally {
 isSubmittingSjt = false;
 }
}

// 6. Section 2 Orientation (GBA Briefing)
function renderGbaBriefing(app) {
 const segmentProgress = document.getElementById('segmentProgress');
 if (segmentProgress) {
 segmentProgress.innerHTML = '<span>Section 2 &middot; Overview</span>';
 }
 const progressBarFill = document.getElementById('progressBarFill');
 if (progressBarFill) {
 progressBarFill.style.width = `${(7 / 21) * 100}%`;
 }

 app.innerHTML = `
 <div class="max-w-2xl mx-auto py-4 sm:py-6 space-y-6">
 <!-- Header: English Left, Urdu Right -->
 <div class="flex justify-between items-start pb-4 border-b border-[var(--grid-border)]">
 <div>
 <span class="act-badge">Section 2 &middot; Overview</span>
 <h1 class="text-xl sm:text-3xl font-serif text-[var(--text-primary)]">Interactive Studio Activities</h1>
 </div>
 <div class="text-right shrink-0">
 <span class="font-serif text-xl sm:text-3xl text-[var(--text-secondary)] block" style="font-family: var(--font-urdu); direction: rtl;">عملی مشاغل</span>
 <span class="text-[10px] sm:text-xs text-[var(--accent-gold)] uppercase tracking-wider block mt-1">14 Activities</span>
 </div>
 </div>

 <p class="text-sm sm:text-base text-[var(--text-primary)] leading-relaxed">
 A series of 14 short interactive exercises across seven creative studio areas.
 </p>

 <!-- 3 Spacious Step Cards (Zero Construct Exposure) -->
 <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
 <div class="bg-[#faf8f5] border border-[var(--grid-border)] p-4 rounded-xs space-y-2">
 <div class="w-7 h-7 rounded-full bg-[var(--accent-gold)] text-white text-xs flex items-center justify-center font-serif">1</div>
 <h3 class="text-sm font-semibold text-[var(--text-primary)]">Seven Areas</h3>
 <p class="text-xs text-[var(--text-secondary)] leading-relaxed">
 You will visit 7 studio rooms (Sound, Archives, Canvas, Mosaic, etc.).
 </p>
 </div>

 <div class="bg-[#faf8f5] border border-[var(--grid-border)] p-4 rounded-xs space-y-2">
 <div class="w-7 h-7 rounded-full bg-[var(--accent-gold)] text-white text-xs flex items-center justify-center font-serif">2</div>
 <h3 class="text-sm font-semibold text-[var(--text-primary)]">Simple Actions</h3>
 <p class="text-xs text-[var(--text-secondary)] leading-relaxed">
 Each activity has a simple 1-sentence task. Just click, tap, or drag.
 </p>
 </div>

 <div class="bg-[#faf8f5] border border-[var(--grid-border)] p-4 rounded-xs space-y-2">
 <div class="w-7 h-7 rounded-full bg-[var(--accent-gold)] text-white text-xs flex items-center justify-center font-serif">3</div>
 <h3 class="text-sm font-semibold text-[var(--text-primary)]">Not a Speed Test</h3>
 <p class="text-xs text-[var(--text-secondary)] leading-relaxed">
 These are not video games. Fast reflexes are not needed. Take your time.
 </p>
 </div>
 </div>

 <!-- Pacing & Action Bar -->
 <div class="pt-6 border-t border-[var(--grid-border)] flex flex-col sm:flex-row justify-between items-center gap-4">
 <span class="text-xs text-[var(--text-secondary)]">14 short tasks (2 per area) &middot; 1 to 2 minutes each &middot; Self-paced</span>
 <button id="startGbaBtn" class="w-full sm:w-auto min-h-[44px] px-8 py-3 bg-[var(--text-primary)] text-white text-xs uppercase tracking-widest hover:bg-[var(--accent-gold)] shadow-sm rounded-xs">
 Enter World 1: The Frequency &rarr;
 </button>
 </div>
 </div>
 `;

 logEvent('gba_briefing', 'briefing_viewed');

 document.getElementById('startGbaBtn')?.addEventListener('click', () => {
 state.screen = 'games';
 saveLocalState({ immediate: true });
 renderScreen();
 });
}

// 7. Game Battery Container & Dispatcher
function renderGames(app, progressBarFill) {
 const currentWorldCode = state.worldSequence[state.currentWorldIndex];
 if (!currentWorldCode || state.currentWorldIndex >= state.worldSequence.length) {
 finishAssessment();
 return;
 }

 state.activeMiniGameInProgress = true;
 saveLocalState({ immediate: true });

 const currentActivityNumber = state.currentWorldIndex * 2 + state.currentMiniGameIndex + 1;
 const totalActivities = 14;

 const segmentProgress = document.getElementById('segmentProgress');
 if (segmentProgress) {
 const remainingActivities = totalActivities - currentActivityNumber + 1;
 const remainingMins = Math.max(1, Math.round((remainingActivities * 32) / 60));
 segmentProgress.innerHTML = `<span class="text-black hidden sm:inline mr-2 text-[10px] sm:text-xs font-normal">About ${remainingMins} min${remainingMins > 1 ? 's' : ''} remaining</span><span>Activities ${currentActivityNumber} / ${totalActivities}</span>`;
 }

 if (progressBarFill) {
 const currentProgressStep = 7 + (currentActivityNumber - 1);
 progressBarFill.style.width = `${(currentProgressStep / 21) * 100}%`;
 }

 runMiniGame({
 appContainer: app,
 worldCode: currentWorldCode,
 worldIndex: state.currentWorldIndex,
 miniGameIndex: state.currentMiniGameIndex,
 seeds: state.seeds,
 logEvent: (action, data, stateSnapshot, inputType) => {
 const mgId = getMiniGameId(currentWorldCode, state.currentMiniGameIndex);
 logEvent('game', action, data, stateSnapshot, inputType, mgId);
 },
 onMiniGameComplete: (mgResult) => {
 state.activeMiniGameInProgress = false;
 const mgId = getMiniGameId(currentWorldCode, state.currentMiniGameIndex);
 logEvent('game', 'minigame_end', mgResult, {}, 'mouse', mgId);
 flushTelemetry();
 if (state.currentMiniGameIndex < 1) {
 state.currentMiniGameIndex++;
 } else {
 state.currentMiniGameIndex = 0;
 state.currentWorldIndex++;
 }
 saveLocalState({ immediate: true });
 renderGames(app, progressBarFill);
 }
 });
}

function getMiniGameId(worldCode, mgIndex) {
 const coreGames = CANDIDATE_CORE_GAMES && CANDIDATE_CORE_GAMES[worldCode];
 if (coreGames && coreGames[mgIndex]) {
 return coreGames[mgIndex];
 }
 const fallback = {
 'W1': ['F1', 'F2'],
 'W2': ['A1', 'A2'],
 'W3': ['C1', 'C2'],
 'W4': ['E1', 'E2'],
 'W5': ['Q1', 'Q2'],
 'W6': ['CR1', 'CR3'],
 'W7': ['M1', 'M2']
 };
 return (fallback[worldCode] && fallback[worldCode][mgIndex]) || 'MG';
}

let isFinishingAssessment = false;

function renderFinalizationRetry(app, message) {
 if (!app) return;
 app.innerHTML = `
 <div class="space-y-6 text-center py-16 ">
 <div class="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 text-[var(--text-primary)] flex items-center justify-center mx-auto text-xl ">!</div>
 <h2 class="text-2xl text-[var(--text-primary)]">Connection Notice</h2>
 <p class="text-xs text-black max-w-md mx-auto leading-relaxed">${message}</p>
 <div class="pt-2">
 <button id="retryFinalizationBtn" class="min-h-[44px] px-6 py-2.5 bg-[var(--text-primary)] text-white text-xs uppercase tracking-widest hover:bg-[var(--accent-gold)] shadow-sm rounded-xs">Retry Finalization &rarr;</button>
 </div>
 </div>
 `;
 const retryBtn = document.getElementById('retryFinalizationBtn');
 if (retryBtn) {
 retryBtn.addEventListener('click', () => {
 retryBtn.disabled = true;
 retryBtn.textContent = 'Connecting...';
 finishAssessment();
 });
 }
}

async function finishAssessment() {
 if (isFinishingAssessment) return;
 isFinishingAssessment = true;
 state.activeMiniGameInProgress = false;
 saveLocalState({ immediate: true });

 const app = document.getElementById('recruitApp');
 if (app) {
 app.innerHTML = `
 <div class="space-y-6 text-center py-16 ">
 <div class="waiting-spinner"></div>
 <h2 id="finalizingHeading" class="text-2xl text-[var(--text-primary)]">Synchronizing activity...</h2>
 <p id="finalizingSubtext" class="text-xs text-black">Saving your completed activity... Please keep this page open.</p>
 </div>
 `;
 }

 // Guard against Enter/Space duplicate triggers during finalization
 const keyGuard = (e) => {
 if (['Enter', ' ', 'Spacebar'].includes(e.key)) {
 e.preventDefault();
 }
 };
 window.addEventListener('keydown', keyGuard, { capture: true });

 try {
 // Completion is only valid after every remaining telemetry batch is acknowledged.
 const telemetryFlushed = await flushAllTelemetry();
 if (!telemetryFlushed) {
 window.removeEventListener('keydown', keyGuard, { capture: true });
 isFinishingAssessment = false;
 renderFinalizationRetry(app, 'Connection could not be confirmed. Your saved activity has not been discarded. You can retry.');
 return;
 }

 const head = document.getElementById('finalizingHeading');
 const sub = document.getElementById('finalizingSubtext');
 if (head) head.textContent = 'Finalizing assessment...';
 if (sub) sub.textContent = 'Saving your completed activity... Please keep this page open.';

 let response = null;
 for (let attempt = 0; attempt < 3; attempt++) {
 try {
 response = await apiFetch('/recruit/complete', {
 method: 'POST',
 body: JSON.stringify({ session_id: state.sessionId })
 });
 if (response && response.ok) break;
 } catch (e) {
 if (attempt === 2) throw e;
 }
 await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
 }

 if (!response || !response.ok) {
 throw new Error(response ? `Server returned HTTP ${response.status}` : 'No response from server');
 }

 const resJson = await response.json().catch(() => ({}));
 if (resJson.status === 'SUCCESS' || resJson.session_status === 'COMPLETE' || resJson.is_already_completed) {
 window.removeEventListener('keydown', keyGuard, { capture: true });
 state.screen = 'complete';
 state.telemetryTerminal = true;
 state.telemetryQueue = [];
 TelemetryOutbox.clear().catch(e => console.warn(e));
 saveLocalState({ immediate: true });
 renderScreen();
 return;
 }

 throw new Error('Unexpected completion status');
 } catch (err) {
 window.removeEventListener('keydown', keyGuard, { capture: true });
 console.warn('Session complete submission error:', err);
 renderFinalizationRetry(app, 'The final session confirmation was not received. Your saved activity has not been discarded. You can retry.');
 } finally {
 window.removeEventListener('keydown', keyGuard, { capture: true });
 isFinishingAssessment = false;
 }
}

// 6. Paused Modal
function renderPaused(app) {
 app.innerHTML = `
 <div class="space-y-6 text-center py-12">
 <h2 class="text-3xl text-[var(--text-primary)]">Session Paused</h2>
 <p class="text-sm text-black max-w-md mx-auto">
 Your progress has been preserved. Take as much time as you need. Timing metrics are suspended while paused.
 </p>
 <div class="pt-4">
 <button id="resumeBtn" class="px-8 py-3 bg-[var(--text-primary)] text-white text-xs uppercase tracking-widest hover:bg-[var(--accent-gold)] ">
 Resume Session &rarr;
 </button>
 </div>
 </div>
 `;
 document.getElementById('resumeBtn')?.addEventListener('click', togglePause);
}

// 7. Completion Screen with In-House Interview Slot Picker
async function renderComplete(app) {
  let selectedDate = null;
  let selectedTime = null;
  let selectedDateLabel = null;
  let existingBooking = null;

  try {
    if (state.sessionId) {
      const bResp = await apiFetch(`/recruit/interview-booking/${state.sessionId}`);
      if (bResp && bResp.ok) {
        const bData = await bResp.json();
        existingBooking = bData.booking;
      }
    }
  } catch (e) {
    console.warn('Could not fetch existing booking:', e);
  }

  let availableDays = [];
  try {
    const sResp = await apiFetch('/recruit/interview-slots');
    if (sResp && sResp.ok) {
      const sData = await sResp.json();
      availableDays = sData.days || [];
    }
  } catch (e) {
    console.warn('Could not fetch interview slots:', e);
  }

  if (!availableDays || availableDays.length === 0) {
    const today = new Date();
    for (let i = 1; i <= 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      if (d.getDay() === 0) continue;
      // Build the ISO date from local components; toISOString() would shift the day for
      // timezones ahead of UTC and book a different date than the label the candidate picked.
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const fullLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      availableDays.push({
        date: iso,
        date_label: label,
        full_date_label: fullLabel,
        times: ['11:00 AM', '03:00 PM', '05:30 PM', '07:00 PM']
      });
      if (availableDays.length >= 5) break;
    }
  }

  const renderBookingConfirmed = (booking) => `
    <div class="p-6 bg-[#f4f7f4] border border-[#bce0bc] text-left space-y-4">
      <div class="flex items-center gap-2.5 text-emerald-800 font-semibold text-sm">
        <span class="w-6 h-6 rounded-full bg-emerald-800 text-white flex items-center justify-center text-xs shrink-0">&#10003;</span>
        <span>Interview Confirmed &bull; ${window.escapeHtml(booking.slot_display)}</span>
      </div>
      <p class="text-xs text-stone-700 leading-relaxed">
        Your interview time is locked. We have notified our recruiting team and will reach out with the Google Meet link via WhatsApp &amp; Email.
      </p>
      <div class="flex flex-wrap gap-2.5 pt-2">
        <a href="${booking.whatsapp_notify_url || `https://wa.me/?text=${encodeURIComponent(`Hi Alfaaz Team, I (${booking.candidate_name || 'Candidate'}) have scheduled my volunteer interview for ${booking.slot_display}. Looking forward to speaking with you!`)}`}" target="_blank" rel="noopener noreferrer" class="px-4 py-2.5 bg-[#25d366] text-white text-xs uppercase tracking-wider font-semibold hover:bg-[#1ebe5b] transition inline-flex items-center gap-2 shadow-xs">
          Notify on WhatsApp &rarr;
        </a>
        <a href="${booking.google_calendar_url || `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('Alfaaz Volunteer Interview')}&details=${encodeURIComponent(`Interview with Alfaaz Collective for ${booking.candidate_name || 'Candidate'}`)}&location=Google+Meet`}" target="_blank" rel="noopener noreferrer" class="px-4 py-2.5 bg-white border border-[var(--grid-border)] text-stone-800 text-xs uppercase tracking-wider font-semibold hover:border-[var(--accent-gold)] transition inline-flex items-center gap-2">
          Add to Google Calendar
        </a>
      </div>
    </div>
  `;

  const renderSlotPicker = () => `
    <div id="schedulerCard" class="max-w-xl mx-auto mt-8 p-5 sm:p-6 bg-[#faf8f5] border border-[var(--grid-border)] text-left space-y-5">
      <div class="border-b border-[var(--grid-border)] pb-3">
        <span class="act-badge">Next Step &bull; Final Stage</span>
        <h2 class="text-xl sm:text-2xl text-[var(--text-primary)] font-serif mt-1">Select Interview Timing</h2>
        <p class="text-xs text-stone-600 mt-1 leading-relaxed">
          Choose a date and time slot that works best for you. Both you and our recruitment lead will be notified immediately.
        </p>
      </div>

      <!-- Step 1: Date Selection -->
      <div>
        <label class="block text-xs uppercase tracking-wider text-black font-semibold mb-2">1. Choose Date</label>
        <div id="datePillsContainer" class="flex flex-wrap gap-2">
          ${availableDays.map((day, idx) => `
            <button type="button" class="date-pill px-3 py-2 text-xs border border-[var(--grid-border)] bg-white hover:border-[var(--accent-gold)] transition-colors text-stone-800 ${idx === 0 ? 'selected-date border-[var(--accent-gold)] bg-[#fdfaf3] font-bold' : ''}" data-date="${day.date}" data-label="${day.full_date_label}">
              ${day.date_label}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Step 2: Time Selection -->
      <div>
        <label class="block text-xs uppercase tracking-wider text-black font-semibold mb-2">2. Choose Time Slot (IST)</label>
        <div id="timePillsContainer" class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <!-- Populated dynamically based on selected date -->
        </div>
      </div>

      <!-- Confirmation Footer -->
      <div class="pt-3 border-t border-[var(--grid-border)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div id="selectedSlotSummary" class="text-xs text-stone-600 italic">
          Select a time slot to proceed.
        </div>
        <button type="button" id="confirmInterviewBtn" disabled class="px-6 py-2.5 bg-[var(--text-primary)] text-white text-xs uppercase tracking-widest hover:bg-[var(--accent-gold)] transition-colors opacity-40 cursor-not-allowed">
          Confirm Schedule &rarr;
        </button>
      </div>
    </div>
  `;

  app.innerHTML = `
  <div class="space-y-6 text-center py-12 px-3 sm:px-4 max-w-2xl mx-auto">
    <div class="w-16 h-16 rounded-full bg-[var(--text-primary)] border border-emerald-200 text-white mx-auto flex items-center justify-center text-2xl font-bold">
      &#10003;
    </div>
    <div class="space-y-2">
      <h1 class="text-2xl sm:text-3xl text-[var(--text-primary)] font-serif">Assessment Complete</h1>
      <p class="text-xs sm:text-sm text-stone-600 max-w-lg mx-auto leading-relaxed">
        Thank you for your time, care, and attention. Your responses have been safely saved to the Alfaaz Collective research registry.
      </p>
    </div>

    <div id="interviewSection">
      ${existingBooking ? renderBookingConfirmed(existingBooking) : renderSlotPicker()}
    </div>

    <div class="text-[11px] text-stone-500 pt-2 space-y-1">
      <p>Need a different timing or have questions? Email us directly at <a href="mailto:alfaaz2k20@gmail.com" class="text-[var(--accent-gold)] hover:underline">alfaaz2k20@gmail.com</a></p>
    </div>

    <div class="pt-4">
      <a href="index.html" class="inline-block px-6 py-2.5 border border-[var(--grid-border)] text-xs uppercase tracking-widest text-[var(--text-primary)] hover:border-[var(--accent-gold)] transition-colors">
        Return to Alfaaz Home
      </a>
    </div>
  </div>
  `;

  if (existingBooking) return;

  const datePills = app.querySelectorAll('.date-pill');
  const timeContainer = app.querySelector('#timePillsContainer');
  const summaryEl = app.querySelector('#selectedSlotSummary');
  const confirmBtn = app.querySelector('#confirmInterviewBtn');

  if (availableDays.length > 0) {
    selectedDate = availableDays[0].date;
    selectedDateLabel = availableDays[0].full_date_label;
  }

  const updateTimesForDate = (dateVal) => {
    selectedTime = null;
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.classList.add('opacity-40', 'cursor-not-allowed');
    }
    if (summaryEl) {
      summaryEl.textContent = 'Please choose a time slot.';
    }

    const dayObj = availableDays.find(d => d.date === dateVal);
    const times = dayObj ? dayObj.times : ['11:00 AM', '03:00 PM', '05:30 PM', '07:00 PM'];

    if (timeContainer) {
      timeContainer.innerHTML = times.map(t => `
        <button type="button" class="time-pill px-3 py-2 text-xs border border-[var(--grid-border)] bg-white hover:border-[var(--accent-gold)] transition-colors text-stone-800" data-time="${t}">
          ${t}
        </button>
      `).join('');

      timeContainer.querySelectorAll('.time-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          timeContainer.querySelectorAll('.time-pill').forEach(b => {
            b.classList.remove('selected-time', 'bg-[#fdfaf3]', 'border-[var(--accent-gold)]', 'font-bold');
          });
          btn.classList.add('selected-time', 'bg-[#fdfaf3]', 'border-[var(--accent-gold)]', 'font-bold');
          selectedTime = btn.getAttribute('data-time');

          const slotDisplay = `${selectedDateLabel} at ${selectedTime} IST`;
          if (summaryEl) {
            summaryEl.innerHTML = `<span class="text-stone-900 font-semibold">Selected:</span> ${slotDisplay}`;
          }
          if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.classList.remove('opacity-40', 'cursor-not-allowed');
          }
        });
      });
    }
  };

  datePills.forEach(btn => {
    btn.addEventListener('click', () => {
      datePills.forEach(b => {
        b.classList.remove('selected-date', 'border-[var(--accent-gold)]', 'bg-[#fdfaf3]', 'font-bold');
      });
      btn.classList.add('selected-date', 'border-[var(--accent-gold)]', 'bg-[#fdfaf3]', 'font-bold');
      selectedDate = btn.getAttribute('data-date');
      selectedDateLabel = btn.getAttribute('data-label');
      updateTimesForDate(selectedDate);
    });
  });

  if (selectedDate) {
    updateTimesForDate(selectedDate);
  }

  confirmBtn?.addEventListener('click', async () => {
    if (!selectedDate || !selectedTime || !state.sessionId) return;
    const slotDisplay = `${selectedDateLabel} at ${selectedTime} IST`;
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = 'Scheduling...';

    try {
      const resp = await apiFetch('/recruit/schedule-interview', {
        method: 'POST',
        body: JSON.stringify({
          session_id: state.sessionId,
          candidate_name: state.candidateName || null,
          candidate_email: state.candidateEmail || null,
          candidate_phone: state.candidatePhone || null,
          slot_date: selectedDate,
          slot_time: selectedTime,
          slot_display: slotDisplay
        })
      });

      if (!resp || !resp.ok) {
        const errJson = resp ? await resp.json().catch(() => ({})) : {};
        throw new Error(errJson.detail || 'Could not schedule interview. Please try again.');
      }

      const resData = await resp.json();
      const booking = resData.booking || {
        candidate_name: state.candidateName || 'Candidate',
        slot_display: slotDisplay
      };

      const interviewSection = app.querySelector('#interviewSection');
      if (interviewSection) {
        interviewSection.innerHTML = renderBookingConfirmed(booking);
      }
    } catch (err) {
      console.error('[Scheduling Error]', err);
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = 'Confirm Schedule &rarr;';
      if (summaryEl) {
        summaryEl.innerHTML = `<span class="text-red-700 font-semibold">${window.escapeHtml(err.message)}</span>`;
      }
    }
  });
}

