/* ==========================================================================
 ALFAAZ RECRUIT — WORLD 7: THE REPETITION (تکرار)
 Mini-games: M1 (The Ceremonial Seal), M2 (The Courtesy Sleeves), M3 (The Evening Registry)
 Adheres to Design Freeze v1 + Addendum v1.1.
 Emits primitive behavioral telemetry only.
 Stopping at mandatory minimum is neutral; continuation is non-evaluative behavioral information.
 Remediated for plain English (<= 12 words per sentence), mobile-first layout,
 and scoped candidate content protection.
 ========================================================================== */

import { renderTutorialCard, bindTutorialCard, renderGameShell, scrollToTop } from './index.js';

export function runTheRepetition(context, renderHeader) {
 const { appContainer, miniGameIndex, gameId, logEvent, onMiniGameComplete } = context;

 const targetGame = gameId || (miniGameIndex === 0 ? 'M1' : (miniGameIndex === 1 ? 'M2' : 'M3'));
 if (targetGame === 'M1') {
 runM1Minimum(appContainer, renderHeader, logEvent, onMiniGameComplete);
 } else if (targetGame === 'M2') {
 runM2Optional(appContainer, renderHeader, logEvent, onMiniGameComplete);
 } else {
 runM3ReducedReward(appContainer, renderHeader, logEvent, onMiniGameComplete);
 }
}

// --------------------------------------------------------------------------
// M1: Baseline Diligence (Exactly 3 mandatory units)
// Minimum is clearly stated. Completion of mandatory units satisfies the requirement.
// Completion alone is not "high motivation".
// --------------------------------------------------------------------------
function runM1Minimum(app, renderHeader, logEvent, onComplete) {
 let inTutorial = false;
 let currentIdx = 0;
 let lastInputModality = 'mouse';

 const units = [
 { stimulus_id: 'M1_U1', recipient: 'Master Ghulam — Calligraphy Diwan', note: 'Formal invitation envelope 1' },
 { stimulus_id: 'M1_U2', recipient: 'Valley Youth Literary Guild', note: 'Formal invitation envelope 2' }
 ];

 function render() {
 if (inTutorial) {
 app.innerHTML = `
 <div class="candidate-content-protected">
 <div class="flex items-center gap-2 mb-3">
 <span class="act-badge">World 7: The Repetition</span>
 
 </div>
 ${renderTutorialCard({
 icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>`,
 goal: 'Apply wax seals to 3 invitation envelopes.',
 steps: [
 'Look at the named recipient on the envelope.',
 'Click the button to apply the wax seal.',
 'Completing all 3 envelopes finishes this activity.'
 ]
 })}
 </div>
 `;
 bindTutorialCard(app, () => {
 inTutorial = false;
 currentIdx = 0;
 logUnitPresented();
 render();
 });
 return;
 }

  const u = units[currentIdx];
  let selectedPress = 'seal_firm';

  app.innerHTML = renderGameShell({
    worldCode: 'W7',
    worldIndex: 6,
    title: 'The Ceremonial Seal',
    goal: 'Apply wax seals to event invitations across 3 rounds.',
    subtitle: 'Apply wax seals to event invitations.',
    instructionPrompt: 'Your Task',
    instruction: 'Choose your seal technique below, then apply the wax seal to the invitation.',
    stimulusContent: `
      <div class="stage-content">
        <div style="width:86%; background:#efe8db; border:1px solid #d8caa8; border-radius:10px; padding:16px; text-align:center; box-shadow:0 4px 12px rgba(0,0,0,0.25); margin:0 auto;">
          <div style="font-size:0.75rem; text-transform:uppercase; color:#785c45; font-weight:700;">Event Invitation Envelope ${currentIdx + 1} of ${units.length}</div>
          <div style="font-size:0.95rem; font-weight:700; color:#2d241c; margin:4px 0;">To: ${u.recipient}</div>
          <div style="width:44px; height:44px; border-radius:50%; background:#9c382a; margin:10px auto; display:flex; align-items:center; justify-content:center; color:#fff; font-size:0.72rem; font-weight:700; box-shadow:0 3px 8px rgba(0,0,0,0.3);">
            SEAL
          </div>
          <div style="font-size:0.8rem; color:#635242;">${u.note} &bull; Warm red wax drop is ready</div>
        </div>
      </div>
    `,
    interactionContent: `
      <div class="space-y-3">
        <div class="options-directive">
          <span>Choose how you want to press the stamp:</span>
          <span style="font-size:0.75rem; color:var(--text-secondary);">Tap to select</span>
        </div>
        <div class="outside-options space-y-2.5">
          <button type="button" class="outside-opt-card seal-opt ${selectedPress === 'seal_gentle' ? 'selected' : ''}" data-press="seal_gentle" tabindex="0">
            <div class="opt-bullet">A</div>
            <div style="flex:1;">
              <div class="text-sm sm:text-base font-semibold text-[var(--text-primary)]">Gentle Press</div>
              <div class="text-xs text-[var(--text-secondary)] mt-0.5">Light touch on wax</div>
            </div>
          </button>
          <button type="button" class="outside-opt-card seal-opt ${selectedPress === 'seal_firm' ? 'selected' : ''}" data-press="seal_firm" tabindex="0">
            <div class="opt-bullet">B</div>
            <div style="flex:1;">
              <div class="text-sm sm:text-base font-semibold text-[var(--text-primary)]">Firm Balanced Press</div>
              <div class="text-xs text-[var(--text-secondary)] mt-0.5">Hold stamp steady for 2 seconds</div>
            </div>
          </button>
          <button type="button" class="outside-opt-card seal-opt ${selectedPress === 'seal_quick' ? 'selected' : ''}" data-press="seal_quick" tabindex="0">
            <div class="opt-bullet">C</div>
            <div style="flex:1;">
              <div class="text-sm sm:text-base font-semibold text-[var(--text-primary)]">Quick Tap</div>
              <div class="text-xs text-[var(--text-secondary)] mt-0.5">Fast downward stamp</div>
            </div>
          </button>
        </div>
      </div>
    `,
    summaryContent: `
      <span>Stamp technique: <strong class="text-[var(--text-primary)]">Ready to seal</strong></span>
      <span class="text-sm text-black">Envelope ${currentIdx + 1} of ${units.length}</span>
    `,
    actionButtonId: 'stampBtn',
    actionButtonText: (currentIdx === units.length - 1) ? 'Confirm & Finish &rarr;' : 'Apply Wax Seal &rarr;',
    progressText: `Envelope ${currentIdx + 1} of ${units.length} (Required Minimum: 2)`
  });

  app.querySelectorAll('.seal-opt').forEach(btn => {
    btn.onclick = () => {
      app.querySelectorAll('.seal-opt').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedPress = btn.getAttribute('data-press');
    };
  });

 document.getElementById('stampBtn')?.addEventListener('click', () => {
 lastInputModality = 'mouse';
 logEvent('unit_action_performed', {
 stimulus_id: u.stimulus_id,
 unit_index: currentIdx,
 action_type: 'press_wax_seal',
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });

 logEvent('unit_completed', {
 stimulus_id: u.stimulus_id,
 unit_index: currentIdx,
 task_def_version: '1.0'
 });

 if (currentIdx < units.length - 1) {
 currentIdx++;
 logUnitPresented();
 render();
 scrollToTop();
 } else {
 onComplete({
 mini_game: 'M1',
 observations_count: units.length
 });
 }
 });
 }

 function logUnitPresented() {
 const u = units[currentIdx];
 logEvent('unit_presented', {
 stimulus_id: u.stimulus_id,
 unit_index: currentIdx,
 is_mandatory: true,
 task_def_version: '1.0'
 });
 }

 render();
}

// --------------------------------------------------------------------------
// M2: The Courtesy Sleeves (Optional Continuation)
// 3 mandatory units. Explicit finish-or-continue choice after minimum.
// Up to 3 optional units. Stopping at minimum is neutral.
// Continuation is behavioral information, not a motivation score.
// --------------------------------------------------------------------------
function runM2Optional(app, renderHeader, logEvent, onComplete) {
 let inTutorial = false;
 let phase = 'mandatory'; // 'mandatory' | 'choice' | 'optional'
 let mandatoryIdx = 0;
 let optionalIdx = 0;
 let lastInputModality = 'mouse';

 const mandatoryUnits = [
 { stimulus_id: 'M2_M1', label: 'Guest Folder 1: Artisan Guild', is_mandatory: true },
 { stimulus_id: 'M2_M2', label: 'Guest Folder 2: Regional Patrons', is_mandatory: true }
 ];

 const optionalUnits = [
 { stimulus_id: 'M2_O1', label: 'Extra Folder 1: Visiting Students', is_mandatory: false },
 { stimulus_id: 'M2_O2', label: 'Extra Folder 2: Community Observers', is_mandatory: false }
 ];

 function render() {
 if (inTutorial) {
 app.innerHTML = `
 <div class="candidate-content-protected">
 <div class="flex items-center gap-2 mb-3">
 <span class="act-badge">World 7: The Repetition</span>
 
 </div>
 ${renderTutorialCard({
 icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>`,
 goal: 'Stamp 2 required folders, then decide if you want to continue.',
 steps: [
 'Stamp the 2 required guest folders.',
 'After folder 2, you choose whether to finish or do optional extras.',
 'Stopping after 2 is completely fine and has no penalty.'
 ]
 })}
 </div>
 `;
 bindTutorialCard(app, () => {
 inTutorial = false;
 phase = 'mandatory';
 mandatoryIdx = 0;
 optionalIdx = 0;
 logUnitPresented(mandatoryUnits[0]);
 render();
 });
 return;
 }

  if (phase === 'mandatory') {
    const u = mandatoryUnits[mandatoryIdx];
    app.innerHTML = renderGameShell({
      worldCode: 'W7',
      worldIndex: 6,
      stepBadge: `Required Phase (${mandatoryIdx + 1}/2)`,
      title: 'The Courtesy Sleeves',
      goal: 'Assemble 2 required folders, then decide if you want to do extra.',
      subtitle: 'Prepare courtesy sleeves for event attendees.',
      instructionPrompt: 'Your Task',
      instruction: 'Assemble the required folder below. Two required folders are needed to satisfy this activity.',
      stimulusContent: `
        <div class="stage-content">
          <div style="width:90%; background:#2f261e; border:1px solid #4a3d31; border-radius:10px; padding:16px; text-align:center; margin:0 auto;">
            <div style="font-size:0.75rem; text-transform:uppercase; color:#d4baa2; font-weight:700; margin-bottom:4px;">Required Folder ${mandatoryIdx + 1} of ${mandatoryUnits.length}</div>
            <div style="font-size:1.05rem; font-weight:700; color:#fff; margin:6px 0;">${u.label}</div>
            <div style="font-size:0.82rem; color:#baa38c; margin-top:6px;">Place courtesy papers inside and fold sleeve closed</div>
          </div>
        </div>
      `,
      interactionContent: `
        <div class="p-4 bg-white border border-[var(--grid-border)] rounded-xs text-center space-y-2">
          <div class="text-sm font-semibold text-[var(--text-primary)]">Ready to assemble ${u.label}</div>
          <div class="text-xs text-[var(--text-secondary)]">Click button below to fold and seal this folder.</div>
        </div>
      `,
      actionButtonId: 'foldSleeveBtn',
      actionButtonText: 'Assemble Required Folder &rarr;',
      progressText: `Required Folder ${mandatoryIdx + 1} of ${mandatoryUnits.length}`
    });

 document.getElementById('foldSleeveBtn')?.addEventListener('click', () => {
 lastInputModality = 'mouse';
 logEvent('unit_action_performed', {
 stimulus_id: u.stimulus_id,
 unit_index: mandatoryIdx,
 action_type: 'assemble_sleeve',
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });

 logEvent('unit_completed', {
 stimulus_id: u.stimulus_id,
 unit_index: mandatoryIdx,
 is_mandatory: true,
 task_def_version: '1.0'
 });

 if (mandatoryIdx < mandatoryUnits.length - 1) {
 mandatoryIdx++;
 logUnitPresented(mandatoryUnits[mandatoryIdx]);
 render();
 scrollToTop();
 } else {
 // Transition to explicit choice point
 phase = 'choice';
 logEvent('choice_presented', {
 trial_index: mandatoryUnits.length,
 mandatory_completed_count: mandatoryUnits.length,
 task_def_version: '1.0'
 });
 render();
 scrollToTop();
 }
 });

  } else if (phase === 'choice') {
    app.innerHTML = renderGameShell({
      worldCode: 'W7',
      worldIndex: 6,
      stepBadge: 'Requirement Completed',
      title: 'The Courtesy Sleeves',
      goal: 'Assemble 2 required folders, then decide if you want to do extra.',
      subtitle: 'Required minimum completed.',
      stimulusContent: `
        <div class="stage-content">
          <div style="width:90%; background:#2f261e; border:1px solid #4a3d31; border-radius:10px; padding:16px; text-align:center; margin:0 auto;">
            <div style="font-size:0.75rem; text-transform:uppercase; color:#8cd39e; font-weight:700; margin-bottom:4px;">✓ Requirement Satisfied</div>
            <div style="font-size:1.05rem; font-weight:700; color:#fff; margin:6px 0;">2 Required Folders Completed</div>
            <div style="font-size:0.82rem; color:#baa38c; margin-top:6px;">Stopping now fulfills the activity completely. You may finish or do extra.</div>
          </div>
        </div>
      `,
      interactionContent: `
        <div class="space-y-3">
          <div class="options-directive">
            <span>Required folders completed! You may finish or do extra:</span>
            <span style="font-size:0.75rem; color:var(--text-secondary);">Your choice</span>
          </div>
          <div class="grid grid-cols-1 gap-3">
            <button type="button" id="concludeBtn" class="btn primary full min-h-[48px] py-3.5" style="background:#2d6a3e; color:#fff; font-weight:700; border-radius:var(--radius-sm);" tabindex="0">
              ✓ Finish Activity Now (Requirement Met)
            </button>
            ${optionalIdx < optionalUnits.length ? `
            <button type="button" id="continueOptionalBtn" class="btn full min-h-[48px] py-3.5 bg-white border border-[var(--grid-border)] text-[var(--text-primary)]" style="font-weight:600; border-radius:var(--radius-sm);" tabindex="0">
              + Assemble Optional Extra Folder (${optionalIdx + 1}/${optionalUnits.length})
            </button>
            ` : ''}
          </div>
        </div>
      `,
      progressText: 'Requirement Satisfied (2/2 Mandatory Completed)'
    });

 document.getElementById('concludeBtn')?.addEventListener('click', () => {
 lastInputModality = 'mouse';
 logEvent('continuation_choice_selected', {
 choice: 'conclude',
 optional_index: optionalIdx,
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });

 onComplete({
 mini_game: 'M2',
 observations_count: mandatoryUnits.length + optionalIdx
 });
 });

 document.getElementById('continueOptionalBtn')?.addEventListener('click', () => {
 lastInputModality = 'mouse';
 logEvent('continuation_choice_selected', {
 choice: 'continue',
 optional_index: optionalIdx,
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });

 phase = 'optional';
 logUnitPresented(optionalUnits[optionalIdx]);
 render();
 scrollToTop();
 });

 } else if (phase === 'optional') {
 const u = optionalUnits[optionalIdx];
 app.innerHTML = renderGameShell({
 worldCode: 'W7',
 worldIndex: 6,
 stepBadge: 'Voluntary Extra',
 title: 'The Courtesy Sleeves',
 subtitle: 'Voluntary extra folder preparation.',
 instructionPrompt: 'Voluntary Extra',
 instruction: 'You may assemble this extra folder or finish at any time. Stopping is completely neutral.',
 stimulusContent: `
 <div class="p-6 sm:p-8 bg-[#faf8f5] border border-[var(--grid-border)] text-center shadow-xs rounded-xs">
 <div class="max-w-sm mx-auto p-4 bg-white border border-[var(--grid-border)] rounded-xs">
 <span class="text-sm uppercase tracking-wider text-stone-500 ">Voluntary Courtesy Folder</span>
 <div class="text-sm font-semibold text-[var(--text-primary)] mt-1">${u.label}</div>
 </div>
 </div>
 `,
 secondaryActionHtml: `
 <button type="button" id="stopOptionalEarlyBtn" class="px-5 py-3 bg-stone-100 border border-stone-300 text-stone-700 text-base uppercase tracking-wider interactive-option rounded-xs w-full sm:w-auto min-h-[44px] cursor-pointer">
 Conclude Now
 </button>
 `,
 actionButtonId: 'foldOptionalSleeveBtn',
 actionButtonText: (optionalIdx === optionalUnits.length - 1) ? 'Confirm & Finish &rarr;' : 'Assemble Extra Folder &rarr;',
 progressText: `Extra Folder ${optionalIdx + 1} of ${optionalUnits.length}`
 });

 document.getElementById('stopOptionalEarlyBtn')?.addEventListener('click', () => {
 lastInputModality = 'mouse';
 logEvent('continuation_choice_selected', {
 choice: 'conclude',
 optional_index: optionalIdx,
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });

 onComplete({
 mini_game: 'M2',
 observations_count: mandatoryUnits.length + optionalIdx
 });
 });

 document.getElementById('foldOptionalSleeveBtn')?.addEventListener('click', () => {
 lastInputModality = 'mouse';
 logEvent('unit_action_performed', {
 stimulus_id: u.stimulus_id,
 unit_index: mandatoryUnits.length + optionalIdx,
 action_type: 'assemble_sleeve',
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });

 logEvent('unit_completed', {
 stimulus_id: u.stimulus_id,
 unit_index: mandatoryUnits.length + optionalIdx,
 is_mandatory: false,
 task_def_version: '1.0'
 });

 optionalIdx++;
 if (optionalIdx < optionalUnits.length) {
 phase = 'choice';
 logEvent('choice_presented', {
 trial_index: mandatoryUnits.length + optionalIdx,
 mandatory_completed_count: mandatoryUnits.length,
 task_def_version: '1.0'
 });
 render();
 scrollToTop();
 } else {
 onComplete({
 mini_game: 'M2',
 observations_count: mandatoryUnits.length + optionalIdx
 });
 }
 });
 }
 }

 function logUnitPresented(u) {
 logEvent('unit_presented', {
 stimulus_id: u.stimulus_id,
 unit_index: u.is_mandatory ? mandatoryIdx : mandatoryUnits.length + optionalIdx,
 is_mandatory: u.is_mandatory,
 task_def_version: '1.0'
 });
 }

 render();
}

// --------------------------------------------------------------------------
// M3: Persistence Under Reduced Feedback
// Honest repetitive task; feedback becomes less salient across trials.
// Explicit stop option available on EVERY unit once minimum is reached.
// No artificial submission experience or deception. Stopping at minimum is neutral.
// Maximum observed continuation is right-censored at 6 units (3 mandatory + 3 voluntary).
// --------------------------------------------------------------------------
function runM3ReducedReward(app, renderHeader, logEvent, onComplete) {
 let inTutorial = false;
 let currentIdx = 0;
 let lastInputModality = 'mouse';

 const allUnits = [
 { stimulus_id: 'M3_U1', is_mandatory: true, row_name: 'Gallery Row 1: Lighting & Illumination Alignment', feedback_type: 'salient' },
 { stimulus_id: 'M3_U2', is_mandatory: true, row_name: 'Gallery Row 2: Poetry Anthologies Welcome Stand', feedback_type: 'moderate' },
 { stimulus_id: 'M3_U3', is_mandatory: true, row_name: 'Gallery Row 3: Courtyard Entry Floral Registry', feedback_type: 'minimal' },
 { stimulus_id: 'M3_U4', is_mandatory: false, row_name: 'Gallery Row 4: Auxiliary Bench Linen Inspection', feedback_type: 'none' },
 { stimulus_id: 'M3_U5', is_mandatory: false, row_name: 'Gallery Row 5: Outer Colonnade Lantern Wick Inspection', feedback_type: 'none' },
 { stimulus_id: 'M3_U6', is_mandatory: false, row_name: 'Gallery Row 6: Perimeter Garden Urn Water Check', feedback_type: 'none' }
 ];

 const mandatoryCount = 3;

 function render() {
 if (inTutorial) {
 app.innerHTML = `
 <div class="candidate-content-protected">
 <div class="flex items-center gap-2 mb-3">
 <span class="act-badge">World 7: The Repetition</span>
 
 </div>
 ${renderTutorialCard({
 icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>`,
 goal: 'Verify checklist rows for gallery preparation. A minimum of 3 rows is required.',
 steps: [
 'Mandatory requirement: Exactly 3 checklist rows.',
 'Completing 3 rows satisfies this activity.',
 'You may conclude at any time after row 3, or continue. Stopping is neutral.',
 'Feedback messages become shorter on later rows. This is normal and intentional.'
 ]
 })}
 </div>
 `;
 bindTutorialCard(app, () => {
 inTutorial = false;
 currentIdx = 0;
 logTrialPresented();
 render();
 });
 return;
 }

 const u = allUnits[currentIdx];
 const hasMetMinimum = currentIdx >= mandatoryCount;

 app.innerHTML = `
 <div class="">
 <!-- TOP BAR -->
 <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
 <div class="flex items-center gap-2">
 <span class="act-badge">World 7: The Repetition</span>
 
 </div>
 <div class="text-[11px] ${hasMetMinimum ? 'text-[var(--text-primary)]' : 'text-[var(--text-primary)]'} font-medium">
 ${hasMetMinimum ? 'Optional Continuation' : 'Required Minimum (3)'}
 </div>
 </div>

 <!-- TASK HEADER -->
 <div class="mb-4">
 <h2 class="text-xl sm:text-2xl text-[var(--text-primary)]">The Evening Registry</h2>
 <p class="text-base text-black mt-0.5">
 ${hasMetMinimum ? 'Requirement met (3/3). You may conclude now or continue.' : 'Mandatory requirement: 3 rows. Completing 3 satisfies the activity.'}
 </p>
 </div>

 ${hasMetMinimum ? `
 <div class="p-3.5 bg-stone-50 border border-stone-200 rounded-xs text-base text-stone-700 mb-4 space-y-1 candidate-content-protected">
 <div class="flex items-center justify-between">
 <span class="font-medium text-[var(--text-primary)]">Mandatory minimum completed (3 of 3 rows).</span>
 <span class="text-sm text-stone-500 uppercase font-semibold">Stopping is neutral</span>
 </div>
 <p class="text-[11px] text-stone-600 leading-relaxed">
 You may finish this activity now, or verify extra rows. Feedback details decrease on later rows; this is normal and intentional.
 </p>
 </div>
 ` : `
 <!-- YOUR TASK -->
 <div class="p-3 sm:p-4 bg-amber-50/70 border border-[var(--accent-gold)]/40 rounded-xs mb-4 candidate-content-protected">
 <div class="text-sm uppercase tracking-wider text-[var(--accent-gold)] font-semibold mb-1">Your Task</div>
 <div class="text-base text-[var(--text-primary)] leading-relaxed">
 Review the checklist row below and click Verify Row. Completing 3 rows satisfies the activity.
 </div>
 </div>
 `}

 <!-- LOOK AT THIS: Registry Row Item -->
 <div class="p-6 sm:p-8 bg-[#faf8f5] border border-[var(--grid-border)] mb-5 text-center shadow-xs rounded-xs candidate-content-protected">
 <div class="max-w-md mx-auto p-4 bg-white border border-[var(--grid-border)] rounded-xs">
 <span class="text-sm uppercase tracking-wider text-black ">Checklist Item</span>
 <div class="text-sm font-semibold text-[var(--text-primary)] mt-1">${u.row_name}</div>
 </div>
 </div>

 <!-- PRIMARY ACTION BUTTONS -->
 <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
 <div>
 ${hasMetMinimum ? `
 <button type="button" id="concludeM3Btn" class="px-6 py-3 bg-stone-100 border border-stone-300 text-stone-800 text-base uppercase tracking-wider interactive-option rounded-xs w-full sm:w-auto min-h-[44px]">
 Conclude Activity &rarr;
 </button>
 ` : '<span></span>'}
 </div>
 <button type="button" id="verifyRowBtn" class="px-7 py-3.5 bg-[var(--text-primary)] text-white text-base uppercase tracking-widest interactive-option shadow-sm rounded-xs w-full sm:w-auto min-h-[44px]">
 Verify Row &rarr;
 </button>
 </div>

 <!-- Progress Footer -->
 <div class="text-right text-[11px] text-black ">
 Row ${currentIdx + 1} of ${allUnits.length}
 </div>
 </div>
 `;

 document.getElementById('concludeM3Btn')?.addEventListener('click', () => {
 lastInputModality = 'mouse';
 logEvent('conclude_selected', {
 stimulus_id: u.stimulus_id,
 unit_index: currentIdx,
 total_units_completed: currentIdx,
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });

 onComplete({
 mini_game: 'M3',
 observations_count: currentIdx
 });
 });

 document.getElementById('verifyRowBtn')?.addEventListener('click', () => {
 lastInputModality = 'mouse';
 logEvent('unit_action_performed', {
 stimulus_id: u.stimulus_id,
 unit_index: currentIdx,
 action_type: 'verify_registry_entry',
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });

 logEvent('unit_completed', {
 stimulus_id: u.stimulus_id,
 unit_index: currentIdx,
 task_def_version: '1.0'
 });

 if (currentIdx < allUnits.length - 1) {
 currentIdx++;
 logTrialPresented();
 render();
 scrollToTop();
 } else {
 // Reached right-censoring ceiling of 6 units
 onComplete({
 mini_game: 'M3',
 observations_count: allUnits.length
 });
 }
 });
 }

 function logTrialPresented() {
 const u = allUnits[currentIdx];
 logEvent('trial_presented', {
 stimulus_id: u.stimulus_id,
 unit_index: currentIdx,
 is_mandatory: u.is_mandatory,
 task_def_version: '1.0'
 });
 }

 render();
}
