/* ==========================================================================
 ALFAAZ RECRUIT — WORLD 4: THE SHIFTING GRID (متغیر گرڈ)
 Mini-games: E1 (Rule Shift), E2 (Setback Recovery), E3 (Changing Conditions)
 Plain language remediation for human playtest pass 1.
 Sentences <= 12 words. Simple conversational English. Jargon removed.
 Preserves raw behavioral telemetry emissions and exact stimulus/action IDs.
 ========================================================================== */

import { renderTutorialCard, bindTutorialCard, renderGameShell, scrollToTop } from './index.js';

export function runTheShiftingGrid(context, renderHeader) {
 const { appContainer, miniGameIndex, gameId, logEvent, onMiniGameComplete } = context;

 const targetGame = gameId || (miniGameIndex === 0 ? 'E1' : (miniGameIndex === 1 ? 'E2' : 'E3'));
 if (targetGame === 'E1') {
 runE1RuleShift(appContainer, renderHeader, logEvent, onMiniGameComplete);
 } else if (targetGame === 'E2') {
 runE2SetbackRecovery(appContainer, renderHeader, logEvent, onMiniGameComplete);
 } else {
 runE3ChangingConditions(appContainer, renderHeader, logEvent, onMiniGameComplete);
 }
}

// --------------------------------------------------------------------------
// E1: Rule Shift (9 trials, unannounced rule shift)
// --------------------------------------------------------------------------
function runE1RuleShift(app, renderHeader, logEvent, onComplete) {
 let inTutorial = false;
 let currentIdx = 0;
 let trialStartTime = 0;
 let lastInputModality = 'mouse';
 let selectedChoice = null;

 const trials = [
 { stimulus_id: 'E1_T1', color: 'Gold', shape: 'Square', icon: '&#9632;', label: 'Gold Square' },
 { stimulus_id: 'E1_T2', color: 'Sage', shape: 'Circle', icon: '&#9679;', label: 'Sage Circle' },
 { stimulus_id: 'E1_T3', color: 'Gold', shape: 'Circle', icon: '&#9679;', label: 'Gold Circle' },
 { stimulus_id: 'E1_T4', color: 'Sage', shape: 'Square', icon: '&#9632;', label: 'Sage Square' },
 { stimulus_id: 'E1_T5', color: 'Gold', shape: 'Square', icon: '&#9632;', label: 'Gold Square' },
 { stimulus_id: 'E1_T6', color: 'Sage', shape: 'Circle', icon: '&#9679;', label: 'Sage Circle' },
 { stimulus_id: 'E1_T7', color: 'Gold', shape: 'Circle', icon: '&#9679;', label: 'Gold Circle' },
 { stimulus_id: 'E1_T8', color: 'Gold', shape: 'Square', icon: '&#9632;', label: 'Gold Square' }
 ];


 function render() {
 if (inTutorial) {
 app.innerHTML = `
 <div class="candidate-content-protected max-w-2xl mx-auto">
 ${renderHeader('The Ceramic Mosaic', 'Sort each tile into the matching container.')}
 ${renderTutorialCard({
 icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>`,
 goal: 'Sort 8 tiles into the matching containers.',
 steps: [
 'Look at the tile shape and color.',
 'Click Container 1 or Container 2 to place it.',
 'Watch the feedback note to see if your choice fit the rule.'
 ]
 })}
 </div>
 `;
 bindTutorialCard(app, () => {
 inTutorial = false;
 currentIdx = 0;
 trialStartTime = performance.now();
 logTrialPresented();
 render();
 });
 return;
 }

  const t = trials[currentIdx];

  app.innerHTML = renderGameShell({
    worldCode: 'W4',
    worldIndex: 3,
    title: 'The Ceramic Mosaic',
    goal: 'Sort each tile into the matching container.',
    subtitle: 'Sort each ceramic tile into the matching container.',
    instructionPrompt: 'Your Task',
    instruction: 'Tap Container 1 or Container 2 below to place this tile now.',
    stimulusContent: `
      <div class="stage-content">
        <div style="font-size:0.75rem; text-transform:uppercase; color:#baa890; margin-bottom:6px;">Tile to Sort (${currentIdx + 1} of ${trials.length})</div>
        <div style="width:72px; height:72px; background:${t.color === 'Gold' ? '#b38b4d' : '#487352'}; border-radius:10px; border:2px solid ${t.color === 'Gold' ? '#5a421b' : '#28442e'}; display:flex; align-items:center; justify-content:center; box-shadow:0 6px 16px rgba(0,0,0,0.4); margin:0 auto;">
          <span style="font-size:2.4rem; color:#fff;">${t.shape === 'Square' ? '■' : '●'}</span>
        </div>
        <div style="font-size:1rem; color:#f6efe5; margin-top:8px; font-weight:700;">${t.color} ${t.shape}</div>
      </div>
    `,
    interactionContent: `
      <div class="space-y-3">
        <div class="options-directive">
          <span>Tap Container 1 or Container 2 to place tile now:</span>
          <span style="font-size:0.75rem; color:var(--text-secondary);">Direct tap to sort</span>
        </div>
        <div class="mosaic-containers-row">
          <button type="button" class="container-box-btn bin-btn" data-choice="container_1" id="btnContainer1" tabindex="0">
            <div style="width:46px; height:46px; background:#b38b4d; border:2px solid #5a421b; border-radius:8px; display:inline-flex; align-items:center; justify-content:center; box-shadow:0 3px 8px rgba(0,0,0,0.18); margin:2px auto;">
              <span style="font-size:1.6rem; color:#fff; line-height:1;">●</span>
            </div>
            <div style="font-weight:700; font-size:1rem; margin-top:6px;">Container 1</div>
            <div style="font-size:0.8rem; color:var(--text-secondary);">Reference: Gold Circle</div>
          </button>
          <button type="button" class="container-box-btn bin-btn" data-choice="container_2" id="btnContainer2" tabindex="0">
            <div style="width:46px; height:46px; background:#487352; border:2px solid #28442e; border-radius:8px; display:inline-flex; align-items:center; justify-content:center; box-shadow:0 3px 8px rgba(0,0,0,0.18); margin:2px auto;">
              <span style="font-size:1.6rem; color:#fff; line-height:1;">■</span>
            </div>
            <div style="font-weight:700; font-size:1rem; margin-top:6px;">Container 2</div>
            <div style="font-size:0.8rem; color:var(--text-secondary);">Reference: Sage Square</div>
          </button>
        </div>
      </div>
    `,
    summaryContent: `
      <span>Sorting progress:</span>
      <span class="text-sm text-black">${currentIdx + 1} / ${trials.length}</span>
    `,
    progressText: `Tile ${currentIdx + 1} of ${trials.length}`
  });

  app.querySelectorAll('.bin-btn').forEach(btn => {
    const handleDirectSort = (modality) => {
      lastInputModality = modality;
      const choice = btn.getAttribute('data-choice');
      btn.style.borderColor = 'var(--accent-gold)';
      const latency = Math.round(performance.now() - trialStartTime);

      logEvent('tile_sorted', {
        trial_index: currentIdx,
        stimulus_id: t.stimulus_id,
        choice: choice,
        latency_ms: latency,
        input_modality: lastInputModality,
        task_def_version: '1.0'
      });

      setTimeout(() => {
        if (currentIdx < trials.length - 1) {
          currentIdx++;
          selectedChoice = null;
          trialStartTime = performance.now();
          logTrialPresented();
          render();
          scrollToTop();
        } else {
          onComplete({
            mini_game: 'E1',
            observations_count: trials.length
          });
        }
      }, 220);
    };

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      handleDirectSort('mouse');
    });
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleDirectSort('keyboard');
      }
    });
  });
  }

 function logTrialPresented() {
 const t = trials[currentIdx];
 logEvent('trial_presented', {
 trial_index: currentIdx,
 stimulus_id: t.stimulus_id,
 tile_color: t.color,
 tile_shape: t.shape,
 task_def_version: '1.0'
 });
 }

 render();
}

// --------------------------------------------------------------------------
// E2: Setback Recovery (4 sequences)
// --------------------------------------------------------------------------
function runE2SetbackRecovery(app, renderHeader, logEvent, onComplete) {
 let inTutorial = false;
 let currentSeq = 0;
 let selectedAction = null;
 let lastInputModality = 'mouse';

 const sequences = [
 {
 stimulus_id: 'E2_S1',
 title: 'Sequence 1: Ink Spill on Desk',
 situation: 'A small drop of ink spilled onto your active pattern card.',
 has_disruption: true,
 disruption_type: 'ink_spill_masking_workspace',
 options: [
 { id: 'clear_workspace', label: 'Dab ink with a cloth and straighten your card', note: 'Calm cleanup' },
 { id: 'rush_uncleaned', label: 'Keep placing tiles around the wet ink', note: 'Rushed step' },
 { id: 'pause_idle', label: 'Step away and wait for help', note: 'Long wait' }
 ]
 },
 {
 stimulus_id: 'E2_S2',
 title: 'Sequence 2: Calm Studio Work',
 situation: 'The workbench is clean, tidy, and well lit.',
 has_disruption: false,
 disruption_type: 'undisrupted_control',
 options: [
 { id: 'standard_sequence', label: 'Continue placing tiles according to plan', note: 'Steady step' },
 { id: 'unnecessary_rework', label: 'Take tiles apart to re-check for no reason', note: 'Unneeded check' },
 { id: 'pause_idle', label: 'Stop and wait before continuing', note: 'Unneeded pause' }
 ]
 },
 {
 stimulus_id: 'E2_S3',
 title: 'Sequence 3: Breeze Blows Paper',
 situation: 'A sudden breeze blew your reference drawing off the table.',
 has_disruption: true,
 disruption_type: 'draft_blows_reference_card',
 options: [
 { id: 'stabilize_reference', label: 'Pick up paper and weigh it down with a stone', note: 'Fix and secure' },
 { id: 'guess_motif', label: 'Place tiles from memory without looking at plan', note: 'Guessing' },
 { id: 'pause_idle', label: 'Wait for the wind to stop', note: 'Waiting' }
 ]
 }
 ];


 function render() {
 if (inTutorial) {
 app.innerHTML = `
 <div class="candidate-content-protected max-w-2xl mx-auto">
 ${renderHeader('The Courtyard Setup', 'Respond constructively to workshop situations.')}
 ${renderTutorialCard({
 icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
 goal: 'Respond to unexpected workshop situations across 3 rounds.',
 steps: [
 'Read what just happened in the workshop.',
 'Pick what you would do next from the 3 options.',
 'Click Confirm to move to the next situation.'
 ]
 })}
 </div>
 `;
 bindTutorialCard(app, () => {
 inTutorial = false;
 currentSeq = 0;
 selectedAction = null;
 logSequencePresented();
 render();
 });
 return;
 }

  const s = sequences[currentSeq];
  const activeOpt = s.options.find(o => o.id === selectedAction);

  app.innerHTML = renderGameShell({
    worldCode: 'W4',
    worldIndex: 3,
    title: 'The Courtyard Setup',
    goal: 'Respond calmly when unexpected studio events happen.',
    subtitle: 'Choose the best response when unexpected studio events happen.',
    instructionPrompt: 'Your Task',
    instruction: 'Read what happened in the studio above. Choose your immediate response below.',
    stimulusContent: `
      <div class="stage-content space-y-3">
        <!-- Prominent Situation Cue -->
        <div class="p-4 sm:p-5 bg-white border border-[var(--grid-border)] rounded-xs shadow-xs text-left">
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-xs uppercase tracking-wider text-[var(--accent-gold)] font-bold">${s.title}</span>
            <span class="text-xs uppercase tracking-wider text-[var(--text-secondary)] font-medium">Studio Situation</span>
          </div>
          <div class="text-base sm:text-lg font-serif text-[var(--text-primary)] font-semibold leading-relaxed">
            ${s.situation}
          </div>
        </div>

        <!-- Visual Workshop Environment Tile -->
        <div class="realistic-ink-desk">
          <div class="desk-sheet">
            <div style="font-size:0.75rem; text-transform:uppercase; color:#786653; font-weight:700;">Studio Drawing Sheet</div>
            <div style="font-size:0.95rem; font-weight:700; margin:3px 0; color:#382d22;">${s.title}</div>
            <div style="font-size:0.85rem; color:#5c4e3f; line-height:1.4;">${s.situation}</div>
            ${s.stimulus_id === 'E2_S1' ? `
              <!-- Truly Random Organic Ink Splatter SVG -->
              <svg style="position:absolute; right:20px; bottom:10px; width:125px; height:95px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.6));" viewBox="0 0 120 90">
                <path d="M50,42 C38,30 22,38 18,50 C14,64 30,72 45,68 C58,65 65,74 78,70 C92,65 105,52 98,38 C92,25 78,20 68,32 C62,38 56,34 50,42 Z" fill="#0b0c0f"/>
                <path d="M72,30 C80,18 92,22 86,34 Z" fill="#0b0c0f"/>
                <circle cx="16" cy="36" r="3.2" fill="#0b0c0f"/>
                <circle cx="28" cy="22" r="2.4" fill="#0b0c0f"/>
                <circle cx="85" cy="18" r="3.8" fill="#0b0c0f"/>
                <circle cx="106" cy="46" r="2.8" fill="#0b0c0f"/>
                <circle cx="62" cy="78" r="3" fill="#0b0c0f"/>
                <circle cx="40" cy="80" r="2.2" fill="#0b0c0f"/>
              </svg>
            ` : s.stimulus_id === 'E2_S3' ? `
              <!-- Wind Breeze Drift Graphic -->
              <div style="position:absolute; right:25px; bottom:15px; opacity:0.85; font-size:2.2rem;">
                🍃 📄
              </div>
            ` : `
              <!-- Clean Steady Studio Graphic -->
              <div style="position:absolute; right:25px; bottom:15px; opacity:0.85; font-size:2.2rem;">
                ✨ 🎨
              </div>
            `}
          </div>
        </div>
      </div>
    `,
    interactionContent: `
      <div class="space-y-3">
        <div class="options-directive">
          <span>Choose what you would do right now:</span>
          <span style="font-size:0.75rem; color:var(--text-secondary);">Tap to select</span>
        </div>
        <div class="outside-options space-y-2.5">
          ${s.options.map((opt, idx) => {
            const bullet = String.fromCharCode(65 + idx);
            const isSelected = selectedAction === opt.id;
            return `
              <button type="button" class="outside-opt-card e2-opt ${isSelected ? 'selected' : ''}" data-action="${opt.id}" tabindex="0">
                <div class="opt-bullet">${bullet}</div>
                <div style="flex:1;">
                  <div class="text-sm sm:text-base font-semibold text-[var(--text-primary)]">${opt.label}</div>
                  <div class="text-xs text-[var(--text-secondary)] mt-0.5">${opt.note || ''}</div>
                </div>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `,
    summaryContent: `
      <span>${selectedAction ? `You selected: <strong class="text-[var(--text-primary)]">${activeOpt?.label}</strong>` : 'Select an option above to continue.'}</span>
      <span class="text-sm text-black">${currentSeq + 1} / ${sequences.length}</span>
    `,
    actionButtonId: 'confirmE2Btn',
    actionButtonText: currentSeq < sequences.length - 1 ? 'Confirm Choice &rarr;' : 'Confirm & Finish &rarr;',
    actionButtonDisabled: !selectedAction,
    progressText: `Scenario ${currentSeq + 1} of ${sequences.length}`
  });

 app.querySelectorAll('.e2-opt').forEach(opt => {
 const chooseAction = (modality) => {
 lastInputModality = modality;
 selectedAction = opt.getAttribute('data-action');
 logEvent('action_selected', {
 trial_index: currentSeq,
 stimulus_id: s.stimulus_id,
 action_id: selectedAction,
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });
 render();
 };

 opt.addEventListener('click', () => chooseAction('mouse'));
 opt.addEventListener('keydown', (e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 chooseAction('keyboard');
 }
 });
 });

 document.getElementById('confirmE2Btn')?.addEventListener('click', () => {
 logEvent('sequence_completed', {
 trial_index: currentSeq,
 stimulus_id: s.stimulus_id,
 chosen_action: selectedAction,
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });

 if (currentSeq < sequences.length - 1) {
 currentSeq++;
      selectedAction = null;
      logSequencePresented();
      render();
      scrollToTop();
 } else {
 onComplete({
 mini_game: 'E2',
 observations_count: sequences.length
 });
 }
 });
 }

 function logSequencePresented() {
 const s = sequences[currentSeq];
 logEvent('sequence_presented', {
 trial_index: currentSeq,
 stimulus_id: s.stimulus_id,
 has_disruption: s.has_disruption,
 disruption_type: s.disruption_type,
 task_def_version: '1.0'
 });
 }

 render();
}

// --------------------------------------------------------------------------
// E3: Changing Conditions (3 condition transitions)
// --------------------------------------------------------------------------
function runE3ChangingConditions(app, renderHeader, logEvent, onComplete) {
 let inTutorial = false;
 let currentCondition = 0;
 let selectedLayout = null;
 let lastInputModality = 'mouse';

 const conditions = [
 {
 stimulus_id: 'E3_C1',
 title: 'Condition 1: Three Colors Available',
 constraint_state: 'standard_three_color_palette',
 description: 'Gold, sage, and terracotta colors are all on the table.',
 options: [
 { id: 'standard_layout', label: 'Three-Color Pattern (Balanced three-color arrangement)' },
 { id: 'tonal_adaptation', label: 'Single Color Shades (One shade only)' },
 { id: 'compact_adaptation', label: 'Half-Grid Squeeze' }
 ]
 },
 {
 stimulus_id: 'E3_C2',
 title: 'Condition 2: Only Indigo Blue Available',
 constraint_state: 'monochrome_indigo_only',
 description: 'Only one blue color is available on the table.',
 options: [
 { id: 'tonal_adaptation', label: 'Light and Dark Shading (Create depth using light and dark tones)' },
 { id: 'standard_layout', label: 'Try Three Colors (Cannot be done with one color)' },
 { id: 'compact_adaptation', label: 'Small Stamp Layout' }
 ]
 },
 {
 stimulus_id: 'E3_C3',
 title: 'Condition 3: Half-Size Wall Space',
 constraint_state: 'boundary_constricted_half_grid',
 description: 'The wall space is cut in half. The artwork must fit smaller dimensions.',
 options: [
 { id: 'compact_adaptation', label: 'Compact Small Design (Scale down pattern to fit half wall)' },
 { id: 'standard_layout', label: 'Full Size Layout (Too wide for the small wall)' },
 { id: 'tonal_adaptation', label: 'Unscaled Shading Layout' }
 ]
 }
 ];

 function render() {
 if (inTutorial) {
 app.innerHTML = `
 <div class="candidate-content-protected max-w-2xl mx-auto">
 ${renderHeader('The Shifting Medium', 'Adapt design layout when studio materials change.')}
 ${renderTutorialCard({
 icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"></path></svg>`,
 goal: 'Adapt your mosaic design strategy to match shifting studio constraints.',
 steps: [
 'Examine the active studio condition in each round.',
 'Choose the layout option that matches the condition.',
 'Confirm your choice across all 3 rounds.'
 ]
 })}
 </div>
 `;
 bindTutorialCard(app, () => {
 inTutorial = false;
 currentCondition = 0;
 selectedLayout = null;
 logConditionPresented();
 render();
 });
 return;
 }

 const c = conditions[currentCondition];
 const activeLayout = c.options.find(o => o.id === selectedLayout);

 app.innerHTML = `
 <div class="max-w-2xl mx-auto">
 <!-- TOP BAR -->
 <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 pb-2 border-b border-[var(--grid-border)]">
 <div class="flex items-center gap-2">
 <span class="act-badge">World 4: The Shifting Grid</span>
 
 </div>
 </div>

 <!-- TASK HEADER -->
 <div class="mb-4">
 <h2 class="text-xl sm:text-2xl text-[var(--text-primary)]">The Shifting Medium</h2>
 <p class="text-base text-black mt-0.5">Adapt design layout to active studio conditions.</p>
 </div>

 <!-- YOUR TASK -->
 <div class="p-3 sm:p-4 bg-amber-50/70 border border-[var(--accent-gold)]/40 rounded-xs mb-4 candidate-content-protected">
 <div class="text-sm uppercase tracking-wider text-[var(--accent-gold)] font-semibold mb-1">Your Task</div>
 <div class="text-base text-[var(--text-primary)] leading-relaxed">
 Read the active condition below. Pick the layout that fits best.
 </div>
 </div>

 <!-- LOOK AT THIS -->
 <div class="p-3.5 bg-white border border-[var(--grid-border)] rounded-xs mb-4 shadow-xs candidate-content-protected flex items-center justify-between">
 <span class="text-base text-[var(--text-primary)]">
 <strong>${c.title}:</strong> ${c.description}
 </span>
 <span class="text-sm uppercase tracking-wider text-[var(--accent-gold)] font-medium">Layout ${currentCondition + 1} of ${conditions.length}</span>
 </div>

 <!-- INTERACTION AREA -->
 <div class="p-5 bg-[#faf8f5] border border-[var(--grid-border)] mb-4 rounded-xs shadow-xs candidate-content-protected">
 <div class="text-sm text-black uppercase tracking-wider mb-2.5">Layout Options:</div>
 <div class="space-y-2.5">
 ${c.options.map(opt => `
 <div class="e3-opt p-3.5 bg-white border ${selectedLayout === opt.id ? 'border-[var(--accent-gold)] bg-amber-50/70 shadow-xs' : 'border-[var(--grid-border)]'} rounded-xs cursor-pointer interactive-option text-base flex items-center justify-between min-h-[48px]" data-layout="${opt.id}" tabindex="0" role="button">
 <span class="flex items-center gap-2">
 <span class="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center text-[9px] ${selectedLayout === opt.id ? 'bg-[var(--accent-gold)] text-white' : 'text-stone-300'}">${selectedLayout === opt.id ? '✓' : ''}</span>
 <span class="text-[var(--text-primary)] font-medium">${opt.label}</span>
 </span>
 <span class="text-sm text-[var(--accent-gold)] uppercase font-medium">Option ${opt.id.replace('LAYOUT_', '')}</span>
 </div>
 `).join('')}
 </div>
 </div>

 <!-- YOUR CHOICE -->
 <div class="p-3 bg-white border border-[var(--grid-border)] rounded-xs mb-4 text-base text-black flex justify-between items-center">
 <span>${selectedLayout ? `You selected: <strong class="text-[var(--text-primary)]">${activeLayout?.label}</strong>` : 'Select a layout above to continue.'}</span>
 <span class="text-sm text-black ">${currentCondition + 1} / ${conditions.length}</span>
 </div>

 <!-- PRIMARY ACTION BUTTON -->
 <div class="flex justify-end">
 <button type="button" id="confirmE3Btn" ${selectedLayout ? '' : 'disabled'} class="w-full sm:w-auto px-7 py-3 bg-[var(--text-primary)] text-white text-base uppercase tracking-widest disabled:opacity-40 interactive-option shadow-sm rounded-xs min-h-[44px]">
 ${currentCondition < conditions.length - 1 ? 'Confirm Layout &rarr;' : 'Finish World 4 &rarr;'}
 </button>
 </div>
 </div>
 `;

 app.querySelectorAll('.e3-opt').forEach(opt => {
 const chooseLayout = (modality) => {
 lastInputModality = modality;
 selectedLayout = opt.getAttribute('data-layout');
 logEvent('composition_action_attempted', {
 trial_index: currentCondition,
 stimulus_id: c.stimulus_id,
 action_id: selectedLayout,
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });
 render();
 };

 opt.addEventListener('click', () => chooseLayout('mouse'));
 opt.addEventListener('keydown', (e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 chooseLayout('keyboard');
 }
 });
 });

 document.getElementById('confirmE3Btn')?.addEventListener('click', () => {
 logEvent('composition_confirmed', {
 trial_index: currentCondition,
 stimulus_id: c.stimulus_id,
 chosen_action: selectedLayout,
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });

 if (currentCondition < conditions.length - 1) {
 currentCondition++;
 selectedLayout = null;
 logConditionPresented();
 render();
 scrollToTop();
 } else {
 onComplete({
 mini_game: 'E3',
 observations_count: 3
 });
 }
 });
 }

 function logConditionPresented() {
 const c = conditions[currentCondition];
 logEvent('condition_presented', {
 trial_index: currentCondition,
 stimulus_id: c.stimulus_id,
 constraint_state: c.constraint_state,
 task_def_version: '1.0'
 });
 }

 render();
}
