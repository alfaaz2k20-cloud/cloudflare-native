/* ==========================================================================
 ALFAAZ RECRUIT — GAME BATTERY RUNNER & DISPATCHER
 ========================================================================== */

import { runTheArchive } from './the_archive.js';
import { runTheFrequency } from './the_frequency.js';
import { runTheSharedCanvas } from './the_shared_canvas.js';
import { runTheShiftingGrid } from './the_shifting_grid.js';
import { runTheHiddenGallery } from './the_hidden_gallery.js';
import { runTheBrokenTool } from './the_broken_tool.js';
import { runTheRepetition } from './the_repetition.js';

export const WORLD_METADATA = {
 'W1': { name: 'The Frequency', name_ur: 'آواز', subtitle: 'Acoustics & Dialogue' },
 'W2': { name: 'The Archive', name_ur: 'دستاویز', subtitle: 'Manuscripts & Preservation' },
 'W3': { name: 'The Shared Canvas', name_ur: 'مشترکہ کینوس', subtitle: 'Artisan Workshop' },
 'W4': { name: 'The Shifting Grid', name_ur: 'بدلتا گرڈ', subtitle: 'Mosaic & Rhythm' },
 'W5': { name: 'The Hidden Gallery', name_ur: 'پوشیدہ گیلری', subtitle: 'Exhibition Discovery' },
 'W6': { name: 'The Broken Tool', name_ur: 'ٹوٹا آلہ', subtitle: 'Material Assembly' },
 'W7': { name: 'The Repetition', name_ur: 'دہرائی', subtitle: 'Readiness & Ceremony' }
};

export function renderGameShell({
 worldCode = '',
 worldIndex = 0,
 stepBadge = '',
 title = '',
 goal = '',
 subtitle = '',
 instruction = '',
 instructionPrompt = 'Your Task',
 preZoneContent = '',
 stimulusContent = '',
 interactionContent = '',
 postZoneContent = '',
 feedbackContent = '',
 summaryContent = '',
 actionButtonId = '',
 actionButtonText = '',
 actionButtonDisabled = false,
 secondaryActionHtml = '',
 progressText = '',
 extraContent = ''
}) {
 const meta = WORLD_METADATA[worldCode] || { name: 'Alfaaz Workshop', name_ur: '' };
 const wIdx = typeof worldIndex === 'number' ? worldIndex : 0;
 const cleanBadge = (stepBadge && !stepBadge.toLowerCase().includes('takes about')) ? stepBadge : '';

 return `
 <div class="max-w-2xl mx-auto space-y-3.5 sm:space-y-4">
 <!-- TOP BAR: English Left, Urdu Right -->
 <div class="flex justify-between items-start pb-2.5 sm:pb-3 border-b border-[var(--grid-border)]">
 <div>
 <span class="act-badge">World ${wIdx + 1} of 7 &middot; ${meta.name}</span>
 <h2 class="text-base sm:text-xl font-serif text-[var(--text-primary)] mt-0.5">${title}</h2>
 </div>
 <div class="text-right shrink-0 ml-4">
 ${meta.name_ur ? `<span class="font-serif text-lg sm:text-2xl text-[var(--text-secondary)] block" style="font-family: var(--font-urdu); direction: rtl;">${meta.name_ur}</span>` : ''}
 ${cleanBadge ? `<span class="text-[10px] sm:text-[11px] text-[var(--accent-gold)] uppercase tracking-wider block mt-1">${cleanBadge}</span>` : ''}
 </div>
 </div>

 <!-- GOAL BANNER (Rendered BEFORE stimulus tile!) -->
 ${goal ? `
 <div class="gba-goal-banner candidate-content-protected">
 <span class="goal-badge">Goal</span>
 <span class="goal-text">${goal}</span>
 </div>
 ` : ''}

 <!-- PRE ZONE (outside stage, e.g. Sound Report or Step 1 Clues) -->
 ${preZoneContent ? `
 <div class="candidate-content-protected">
 ${preZoneContent}
 </div>
 ` : ''}

 <!-- MAIN STIMULUS / SITUATION (HERO: Inside stage / tile) -->
 ${stimulusContent ? `
 <div class="candidate-content-protected">
 ${stimulusContent}
 </div>
 ` : ''}

 <!-- DIRECTIVE: Placed JUST BEFORE options -->
 ${instruction ? `
 <div class="options-directive candidate-content-protected">
 <span>${instruction}</span>
 <span class="text-[11px] text-[var(--text-secondary)] font-medium lowercase">tap to select</span>
 </div>
 ` : ''}

 <!-- INTERACTION AREA (Options / Controls / Actions) -->
 ${interactionContent ? `<div class="candidate-content-protected">${interactionContent}</div>` : ''}

 <!-- POST ZONE (outside stage, e.g. Step 2 Volume Fader or Test Setup) -->
 ${postZoneContent ? `
 <div class="candidate-content-protected">
 ${postZoneContent}
 </div>
 ` : ''}

 <!-- FEEDBACK REGION -->
 ${feedbackContent ? `
 <div class="candidate-content-protected">
 ${feedbackContent}
 </div>
 ` : ''}

 <!-- ACTIVE SELECTION / SUMMARY AREA -->
 ${summaryContent ? `
 <div class="p-2.5 sm:p-3.5 bg-white border border-[var(--grid-border)] rounded-xs text-xs sm:text-sm font-sans text-[var(--text-primary)] flex justify-between items-center candidate-content-protected">
 ${summaryContent}
 </div>
 ` : ''}

 <!-- PRIMARY ACTION BAR -->
 ${(actionButtonText || secondaryActionHtml) ? `
 <div class="flex flex-col sm:flex-row justify-end items-center gap-3 pt-2">
 ${secondaryActionHtml || ''}
 ${actionButtonText ? `
 <button type="button" id="${actionButtonId}" ${actionButtonDisabled ? 'disabled' : ''} class="w-full sm:w-auto px-6 sm:px-8 py-2.5 sm:py-3.5 bg-[var(--text-primary)] text-white text-xs font-bold uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer interactive-option shadow-sm rounded-xs flex items-center justify-center gap-2 min-h-[44px]">
 ${actionButtonText}
 </button>
 ` : ''}
 </div>
 ` : ''}

 <!-- EXTRA CONTENT -->
 ${extraContent || ''}

 <!-- PROGRESS FOOTER -->
 ${progressText ? `
 <div class="text-right text-xs text-[var(--text-secondary)] font-sans pt-1">
 ${progressText}
 </div>
 ` : ''}
 </div>
 `;
}

export const CANDIDATE_CORE_GAMES = {
 'W1': ['F1', 'F2'],
 'W2': ['A1', 'A2'],
 'W3': ['C1', 'C2'],
 'W4': ['E1', 'E2'],
 'W5': ['Q1', 'Q2'],
 'W6': ['CR1', 'CR3'],
 'W7': ['M1', 'M2']
};

export const RESEARCH_BANK_GAMES = {
 'W1': ['F3'],
 'W2': ['A3'],
 'W3': ['C3'],
 'W4': ['E3'],
 'W5': ['Q3'],
 'W6': ['CR2'],
 'W7': ['M3']
};

export const ALL_GAMES_BY_WORLD = {
 'W1': ['F1', 'F2', 'F3'],
 'W2': ['A1', 'A2', 'A3'],
 'W3': ['C1', 'C2', 'C3'],
 'W4': ['E1', 'E2', 'E3'],
 'W5': ['Q1', 'Q2', 'Q3'],
 'W6': ['CR1', 'CR2', 'CR3'],
 'W7': ['M1', 'M2', 'M3']
};

export function renderTutorialCard({ icon, goal, steps }) {
 return `
 <div class="tutorial-card cursor-pointer p-4 sm:p-6 border border-[var(--accent-gold)] bg-gradient-to-br from-[#faf8f5] to-[#f5efe8] space-y-3 sm:space-y-4 mb-4 sm:mb-6 interactive-option rounded-xs" tabindex="0" role="button" aria-label="Begin Activity Guide">
 <div class="flex justify-between items-start gap-3 sm:gap-4">
 <div>
 <span class="text-[11px] sm:text-xs uppercase tracking-widest text-[var(--accent-gold)] font-medium block">Activity Guide &middot; رہنمائے عمل</span>
 <h3 class="text-sm sm:text-base font-serif text-[var(--text-primary)] font-semibold mt-0.5">${goal}</h3>
 </div>
 <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-amber-100/80 border border-[var(--accent-gold)] flex items-center justify-center text-[var(--accent-gold)] shrink-0">
 ${icon || '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'}
 </div>
 </div>

 <div class="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3 pt-1">
 ${steps.map((s, idx) => `
 <div class="bg-white/90 border border-[var(--grid-border)] p-3 sm:p-4 rounded-xs flex items-start gap-2 sm:gap-2.5">
 <span class="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[var(--accent-gold)] text-white text-[11px] sm:text-xs flex items-center justify-center font-serif shrink-0 mt-0.5">${idx + 1}</span>
 <div class="text-[11px] sm:text-xs text-[var(--text-primary)] leading-relaxed">${s}</div>
 </div>
 `).join('')}
 </div>

 <div class="pt-2 flex flex-col sm:flex-row justify-between items-center gap-2">
 <span class="text-xs text-[var(--text-secondary)] italic">Click anywhere or press Enter to begin</span>
 <button id="startActivityBtn" class="w-full sm:w-auto px-6 py-2.5 bg-[var(--text-primary)] text-white text-xs uppercase tracking-widest interactive-option flex items-center justify-center gap-2 rounded-xs">
 Begin Activity &rarr;
 </button>
 </div>
 </div>
 `;
}


export function scrollToTop(behavior = 'smooth') {
  if (typeof window !== 'undefined') {
    requestAnimationFrame(() => {
      try {
        window.scrollTo({ top: 0, left: 0, behavior });
      } catch (_) {
        window.scrollTo(0, 0);
      }
    });
  }
}

export function bindTutorialCard(app, onStart) {
 let started = false;
 const trigger = (e) => {
 if (e) {
 if (typeof e.preventDefault === 'function') e.preventDefault();
 if (typeof e.stopPropagation === 'function') e.stopPropagation();
 }
 if (started) return;
 started = true;
    onStart();
    scrollToTop();
 };

 const btn = app.querySelector('#startActivityBtn');
 const card = app.querySelector('.tutorial-card');

 if (btn) {
 btn.addEventListener('click', trigger, { once: true });
 }

 if (card) {
 card.addEventListener('click', (e) => {
 trigger(e);
 }, { once: true });
 card.addEventListener('keydown', (e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 trigger(e);
 }
 }, { once: true });
 }
}

export function runMiniGame(context) {
  scrollToTop();
 const { appContainer, worldCode, worldIndex, miniGameIndex, gameId, onMiniGameComplete } = context;
 const meta = WORLD_METADATA[worldCode] || { name: 'Alfaaz Workshop', name_ur: '', subtitle: '' };

 const resolvedGameId = gameId || (CANDIDATE_CORE_GAMES[worldCode] && CANDIDATE_CORE_GAMES[worldCode][miniGameIndex]) || null;
 const extendedContext = { ...context, gameId: resolvedGameId };

 // Clean, Poetic Header Shell with English on Left, Urdu on Right
 const renderHeader = (mgTitle, mgDesc) => `
 <div class="border-b border-[var(--grid-border)] pb-3 mb-5 flex justify-between items-start gap-4">
 <div>
 <span class="act-badge">World ${worldIndex + 1} of 7 &middot; ${meta.name}</span>
 <h2 class="text-xl sm:text-2xl font-serif text-[var(--text-primary)] mt-0.5">${mgTitle}</h2>
 <p class="text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">${mgDesc}</p>
 </div>
 <div class="text-right shrink-0">
 ${meta.name_ur ? `<span class="font-serif text-2xl sm:text-3xl text-[var(--text-secondary)] block" style="font-family: var(--font-urdu); direction: rtl;">${meta.name_ur}</span>` : ''}
 </div>
 </div>
 `;

 // Dispatch to World Runners
 switch (worldCode) {
 case 'W1':
 runTheFrequency(extendedContext, renderHeader);
 break;
 case 'W2':
 runTheArchive(extendedContext, renderHeader);
 break;
 case 'W3':
 runTheSharedCanvas(extendedContext, renderHeader);
 break;
 case 'W4':
 runTheShiftingGrid(extendedContext, renderHeader);
 break;
 case 'W5':
 runTheHiddenGallery(extendedContext, renderHeader);
 break;
 case 'W6':
 runTheBrokenTool(extendedContext, renderHeader);
 break;
 case 'W7':
 runTheRepetition(extendedContext, renderHeader);
 break;
 default:
 if (onMiniGameComplete) onMiniGameComplete({});
 break;
 }
}

