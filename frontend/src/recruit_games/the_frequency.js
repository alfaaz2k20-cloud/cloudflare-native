/* ==========================================================================
 ALFAAZ RECRUIT — WORLD 1: THE FREQUENCY (تعدد)
 Mini-games: F1 (Tuning the Hall), F2 (The Gathering Voices), F3 (The Echo of the Room)
 Plain language remediation for human playtest pass 1.
 Sentences <= 12 words. Simple conversational English. Jargon removed.
 Preserves raw behavioral telemetry emissions and exact stimulus/action IDs.
 ========================================================================== */

import { renderTutorialCard, bindTutorialCard, renderGameShell, scrollToTop } from './index.js';

export function runTheFrequency(context, renderHeader) {
 const { appContainer, miniGameIndex, gameId, logEvent, onMiniGameComplete } = context;

 const targetGame = gameId || (miniGameIndex === 0 ? 'F1' : (miniGameIndex === 1 ? 'F2' : 'F3'));
 if (targetGame === 'F1') {
 runF1CueDetection(appContainer, renderHeader, logEvent, onMiniGameComplete);
 } else if (targetGame === 'F2') {
 runF2AmbiguousCue(appContainer, renderHeader, logEvent, onMiniGameComplete);
 } else {
 runF3ContextChange(appContainer, renderHeader, logEvent, onMiniGameComplete);
 }
}

// --------------------------------------------------------------------------
// F1: Tuning the Hall (6 trials)
// Conditions: accommodate, maintain_objective, clarify
// --------------------------------------------------------------------------
function runF1CueDetection(app, renderHeader, logEvent, onComplete) {
 let inTutorial = false;
 let currentTrial = 0;
 let sliderVal = 50;
 let selectedAction = null;
 let lastInputModality = 'mouse';
 let animationFrameId = null;

 const trials = [
    {
      stimulus_id: 'F1_T1',
      title: 'Sound Report: Front Row Echo',
      cue_text: '"Front rows are hearing too much echo from the wall speakers during the opening reading."',
      default_action: 'accommodate',
      actionA_desc: 'Change volume fader to balance echo',
      actionB_desc: 'Keep acoustics as they are for reading',
      actionC_desc: 'Run diagnostics on microphone cable'
    },
    {
      stimulus_id: 'F1_T2',
      title: 'Sound Report: Clear Hall Acoustics',
      cue_text: '"Center hall sound is clear, balanced, and easy to hear for all attendees."',
      default_action: 'maintain_objective',
      actionA_desc: 'Adjust volume fader settings anyway',
      actionB_desc: 'Keep acoustics as they are for reading',
      actionC_desc: 'Run diagnostics on microphone cable'
    },
    {
      stimulus_id: 'F1_T3',
      title: 'Sound Report: Quiet Whisper',
      cue_text: '"The speaker is reciting a whisper. Words are hard to hear in the rear seats."',
      default_action: 'accommodate',
      actionA_desc: 'Change volume fader to boost voice',
      actionB_desc: 'Keep acoustics as they are for reading',
      actionC_desc: 'Run diagnostics on microphone cable'
    },
    {
      stimulus_id: 'F1_T4',
      title: 'Sound Report: Audio Dropout',
      cue_text: '"Sound suddenly went silent. It could be an artistic pause or an equipment failure."',
      default_action: 'clarify',
      actionA_desc: 'Change volume fader to high level',
      actionB_desc: 'Keep acoustics as they are for reading',
      actionC_desc: 'Run diagnostics on microphone cable'
    },
    {
      stimulus_id: 'F1_T5',
      title: 'Sound Report: Steady Room Acoustics',
      cue_text: '"Group singing is steady and projected cleanly across the entire gallery hall."',
      default_action: 'maintain_objective',
      actionA_desc: 'Readjust volume fader across hall',
      actionB_desc: 'Keep acoustics as they are for reading',
      actionC_desc: 'Run diagnostics on microphone cable'
    }
  ];


 function render() {
 if (animationFrameId) {
 cancelAnimationFrame(animationFrameId);
 animationFrameId = null;
 }

 if (inTutorial) {
 app.innerHTML = `
 <div class="candidate-content-protected max-w-2xl mx-auto">
 ${renderHeader('Tuning the Hall', 'Adjust the hall sound to support the poetry reading.')}
 ${renderTutorialCard({
 icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z"></path></svg>`,
 goal: 'Balance the room sound for the reading across 5 rounds.',
 steps: [
 'Read the sound note from the hall.',
 'Choose what to do: Adjust, Keep, or Check.',
 'Move the volume slider if needed, then click Confirm.'
 ]
 })}
 </div>
 `;
 bindTutorialCard(app, () => {
 inTutorial = false;
 currentTrial = 0;
 sliderVal = 50;
 selectedAction = null;
      render();
 });
 return;
 }

 const t = trials[currentTrial];

 app.innerHTML = renderGameShell({
    worldCode: 'W1',
    worldIndex: 0,
    title: 'Tuning the Hall',
    goal: 'Balance the room sound across 5 rounds.',
    subtitle: 'Adjust the hall sound to support the poetry reading.',
    instructionPrompt: 'Your Task',
    instruction: 'Complete Step 1, then balance the volume in Step 2.',
    interactionContent: `
    <div class="space-y-4">
      <!-- STEP 1: REPORT + ACTION CHOICES -->
      <div class="p-4 sm:p-5 bg-white border border-[var(--grid-border)] rounded-xs space-y-3">
        <div class="flex items-center gap-2 pb-2 border-b border-[var(--grid-border)]">
          <span class="w-6 h-6 rounded-full bg-[var(--accent-gold)] text-white text-xs font-bold flex items-center justify-center font-serif">1</span>
          <span class="text-xs uppercase tracking-wider text-[var(--text-primary)] font-bold">Step 1: Read the report and choose an action</span>
        </div>
        <!-- Sound Report from Hall -->
        <div class="p-3.5 bg-[#faf8f5] border-l-4 border-l-[var(--accent-gold)] border border-[var(--grid-border)] rounded-xs">
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-xs uppercase tracking-wider text-[var(--accent-gold)] font-bold">${t.title}</span>
            <span class="text-xs text-[var(--text-secondary)] uppercase">Sound Report</span>
          </div>
          <div id="partnerSpeech" class="text-base sm:text-lg font-serif text-[var(--text-primary)] leading-relaxed italic">
            ${t.cue_text}
          </div>
        </div>
        <!-- Action Options Outside Tile with A, B, C bullets -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <button type="button" class="outside-opt-card f1-action-btn ${selectedAction === 'accommodate' ? 'selected' : ''}" data-action="accommodate">
            <div class="opt-bullet">A</div>
            <div style="flex:1;">
              <div class="text-sm font-semibold text-[var(--text-primary)]">Fix Sound</div>
              <div class="text-xs text-[var(--text-secondary)] mt-0.5">${t.actionA_desc || 'Change volume fader to balance echo'}</div>
            </div>
          </button>
          <button type="button" class="outside-opt-card f1-action-btn ${selectedAction === 'maintain_objective' ? 'selected' : ''}" data-action="maintain_objective">
            <div class="opt-bullet">B</div>
            <div style="flex:1;">
              <div class="text-sm font-semibold text-[var(--text-primary)]">Keep As Is</div>
              <div class="text-xs text-[var(--text-secondary)] mt-0.5">${t.actionB_desc || 'Leave sound settings as they are'}</div>
            </div>
          </button>
          <button type="button" class="outside-opt-card f1-action-btn ${selectedAction === 'clarify' ? 'selected' : ''}" data-action="clarify">
            <div class="opt-bullet">C</div>
            <div style="flex:1;">
              <div class="text-sm font-semibold text-[var(--text-primary)]">Check First</div>
              <div class="text-xs text-[var(--text-secondary)] mt-0.5">${t.actionC_desc || 'Run test on microphone cable'}</div>
            </div>
          </button>
        </div>
      </div>

      <!-- TILE + STEP 2 AS ONE UNIT -->
      <div class="p-4 sm:p-5 bg-white border border-[var(--grid-border)] rounded-xs space-y-3">
        <div class="flex items-center gap-2 pb-2 border-b border-[var(--grid-border)]">
          <span class="w-6 h-6 rounded-full bg-[var(--accent-gold)] text-white text-xs font-bold flex items-center justify-center font-serif">2</span>
          <span class="text-xs uppercase tracking-wider text-[var(--text-primary)] font-bold">Step 2: Adjust Volume Fader</span>
        </div>
        <!-- Visual Tile: Acoustic Monitor -->
        <div class="p-2.5 bg-[#faf8f5] border border-[var(--grid-border)] rounded-xs">
          <div class="flex items-center justify-between mb-1.5 px-1">
            <span class="text-xs uppercase tracking-wider text-[var(--accent-gold)] font-bold">Hall Acoustic Monitor</span>
            <span class="text-xs text-[var(--text-secondary)]">Live Waveform</span>
          </div>
          <canvas id="waveCanvas" width="600" height="80" class="w-full h-20 bg-stone-900 border border-stone-800 rounded-xs mb-1"></canvas>
        </div>
        <!-- Slider Control inside the unit -->
        <div class="w-full max-w-md mx-auto pt-1">
          <div class="flex justify-between items-center text-xs text-[var(--text-secondary)] mb-1 font-medium">
            <span>Soft (0)</span>
            <span class="text-xs font-semibold text-[var(--accent-gold)] bg-stone-100 px-3 py-1 border border-[var(--grid-border)] rounded-xs" id="sliderValDisplay">${sliderVal}</span>
            <span>Bright (100)</span>
          </div>
          <input type="range" id="freqSlider" min="0" max="100" step="5" value="${sliderVal}" class="w-full accent-[#bd6f5d] cursor-pointer h-2 bg-stone-200 rounded-lg min-h-[44px]">
          <div class="text-center text-xs text-[var(--text-secondary)] mt-1">Slide control left or right to balance the sound</div>
        </div>
      </div>
    </div>
    `,
    summaryContent: `
      <span>Action: <strong class="text-[var(--text-primary)]" id="choiceSummary">${selectedAction ? (selectedAction === 'accommodate' ? 'Fix Sound' : (selectedAction === 'maintain_objective' ? 'Keep As Is' : 'Check First')) : 'None selected'} (Fader: ${sliderVal})</strong></span>
      <span class="text-sm text-black">${currentTrial + 1} / ${trials.length}</span>
    `,
    actionButtonId: 'lockFreqBtn',
    actionButtonDisabled: !selectedAction,
    actionButtonText: currentTrial < trials.length - 1 ? 'Confirm Setting &rarr;' : 'Confirm & Finish &rarr;',
    progressText: `Sound Report ${currentTrial + 1} of ${trials.length}`
  });

 const canvas = document.getElementById('waveCanvas');
 const ctx = canvas?.getContext('2d');
 const slider = document.getElementById('freqSlider');
 const valDisplay = document.getElementById('sliderValDisplay');
 const choiceSummary = document.getElementById('choiceSummary');

 let waveOffset = 0;
 function drawWave() {
 if (!ctx || !canvas) return;
 ctx.clearRect(0, 0, canvas.width, canvas.height);

 ctx.strokeStyle = '#f0eeea';
 ctx.lineWidth = 1;
 for (let x = 0; x < canvas.width; x += 30) {
 ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
 }

 ctx.strokeStyle = '#bd6f5d';
 ctx.lineWidth = 2.5;
 ctx.beginPath();

 const freq = 0.015 + (sliderVal / 100) * 0.05;
 const amp = 14 + (Math.abs(sliderVal - 50) / 50) * 16;

 for (let x = 0; x < canvas.width; x++) {
 const y = canvas.height / 2 + Math.sin(x * freq + waveOffset) * amp;
 if (x === 0) ctx.moveTo(x, y);
 else ctx.lineTo(x, y);
 }
 ctx.stroke();
 waveOffset += 0.04;
 animationFrameId = requestAnimationFrame(drawWave);
 }
 drawWave();

 // Action button handlers
  app.querySelectorAll('.f1-action-btn').forEach(btn => {
    const handleChoose = (modality) => {
      lastInputModality = modality;
      selectedAction = btn.getAttribute('data-action');
      app.querySelectorAll('.f1-action-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      if (choiceSummary) {
        const lbl = selectedAction === 'accommodate' ? 'Fix Sound' : (selectedAction === 'maintain_objective' ? 'Keep As Is' : 'Check First');
        choiceSummary.textContent = `${lbl} (Fader: ${sliderVal})`;
      }
      const lockBtn = document.getElementById('lockFreqBtn');
      if (lockBtn) lockBtn.removeAttribute('disabled');
    };
    btn.addEventListener('click', () => handleChoose('mouse'));
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleChoose('keyboard');
      }
    });
  });

 let lastSliderLogTime = 0;
 let sliderThrottleTimer = null;

 const emitSliderEvent = (val, modality) => {
 logEvent('slider_input', {
 trial_index: currentTrial,
 stimulus_id: t.stimulus_id,
 slider_position_raw: val,
 input_modality: modality,
 task_def_version: '1.0'
 });
 lastSliderLogTime = Date.now();
 };

 slider?.addEventListener('input', (e) => {
 lastInputModality = e.pointerType || 'mouse';
 sliderVal = parseInt(e.target.value, 10);
 if (valDisplay) valDisplay.textContent = sliderVal;
 if (choiceSummary) {
 const lbl = selectedAction === 'accommodate' ? 'Adjust Sound' : (selectedAction === 'maintain_objective' ? 'Keep Baseline' : 'Check Channel');
 choiceSummary.textContent = `${lbl} (Level: ${sliderVal})`;
 }

 const now = Date.now();
 if (now - lastSliderLogTime >= 100) {
 if (sliderThrottleTimer) {
 clearTimeout(sliderThrottleTimer);
 sliderThrottleTimer = null;
 }
 emitSliderEvent(sliderVal, lastInputModality);
 } else if (!sliderThrottleTimer) {
 sliderThrottleTimer = setTimeout(() => {
 emitSliderEvent(sliderVal, lastInputModality);
 sliderThrottleTimer = null;
 }, 100 - (now - lastSliderLogTime));
 }
 });

 slider?.addEventListener('change', () => {
 if (sliderThrottleTimer) {
 clearTimeout(sliderThrottleTimer);
 sliderThrottleTimer = null;
 }
 emitSliderEvent(sliderVal, lastInputModality);
 });

 slider?.addEventListener('keydown', (e) => {
 if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
 lastInputModality = 'keyboard';
 }
 });

 document.getElementById('lockFreqBtn')?.addEventListener('click', () => {
 if (sliderThrottleTimer) {
 clearTimeout(sliderThrottleTimer);
 sliderThrottleTimer = null;
 }
 if (animationFrameId) {
 cancelAnimationFrame(animationFrameId);
 animationFrameId = null;
 }

 logEvent('trial_submit', {
 trial_index: currentTrial,
 stimulus_id: t.stimulus_id,
 action_id: selectedAction,
 slider_position_raw: sliderVal,
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });

    if (currentTrial < trials.length - 1) {
      currentTrial++;
      sliderVal = 50;
      selectedAction = null;
      render();
      scrollToTop();
    } else {
      onComplete({
        mini_game: 'F1',
        observations_count: trials.length
      });
    }
 });
 }

 render();
}

// --------------------------------------------------------------------------
// F2: The Gathering Voices (4 trials)
// Action choices: act, clarify, maintain
// --------------------------------------------------------------------------
function runF2AmbiguousCue(app, renderHeader, logEvent, onComplete) {
 let inTutorial = false;
 let currentTrial = 0;
 let selectedAction = null;
 let lastInputModality = 'mouse';

 const trials = [
 {
 stimulus_id: 'F2_T1',
 speaker_role: 'Stage Lead',
 cue_text: '"The poet gestures toward the side speaker, asking for sound help."',
 condition_label: 'Direct Request'
 },
 {
 stimulus_id: 'F2_T2',
 speaker_role: 'Hall Helper',
 cue_text: '"The speaker pauses with an uncertain look. No words are spoken."',
 condition_label: 'Ambiguous Signal'
 },
 {
 stimulus_id: 'F2_T3',
 speaker_role: 'Sound Helper',
 cue_text: '"The performer sings with intense emotion as part of the poem."',
 condition_label: 'Expressive Intensity'
 }
 ];


 const choices = [
 {
 id: 'act',
 title: 'Act Directly',
 desc: 'Take action right away to help the speaker.'
 },
 {
 id: 'clarify',
 title: 'Ask for Clarity',
 desc: 'Check with the speaker before making any changes.'
 },
 {
 id: 'maintain',
 title: 'Keep Course',
 desc: 'Stay on course without stepping in too early.'
 }
 ];

 function render() {
 if (inTutorial) {
 app.innerHTML = `
 <div class="candidate-content-protected max-w-2xl mx-auto">
 ${renderHeader('The Gathering Voices', 'Coordinate sound with your hall team.')}
 ${renderTutorialCard({
 icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"></path></svg>`,
 goal: 'Respond to teammate messages across 3 rounds.',
 steps: [
 'Read the message from your teammate.',
 'Choose your next step: Act, Ask, or Keep Course.',
 'Click Confirm to save your choice.'
 ]
 })}
 </div>
 `;
 bindTutorialCard(app, () => {
 inTutorial = false;
 currentTrial = 0;
 selectedAction = null;
 render();
 });
 return;
 }

 const t = trials[currentTrial];

 const selectedChoice = choices.find(c => c.id === selectedAction);
 app.innerHTML = renderGameShell({
 worldCode: 'W1',
 worldIndex: 0,
 title: 'The Gathering Voices',
 subtitle: 'Coordinate sound with your hall team.',
 instructionPrompt: 'Your Task',
 instruction: 'Choose how you want to respond right now:',
 stimulusContent: `
 <div class="p-5 sm:p-6 bg-[#faf8f5] border-l-4 border-l-[var(--accent-gold)] border border-[var(--grid-border)] rounded-xs shadow-xs">
 <div class="flex items-center justify-between mb-2">
 <span class="text-xs uppercase tracking-wider text-[var(--accent-gold)] font-bold">${t.speaker_role}</span>
 <span class="text-xs text-[var(--text-secondary)] uppercase">${t.condition_label || 'Signal'}</span>
 </div>
 <div class="text-base sm:text-lg font-serif text-[var(--text-primary)] leading-relaxed italic">
 ${t.cue_text}
 </div>
 </div>
 `,
 interactionContent: `
 <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
 ${choices.map(c => `
 <div class="f2-card p-4 bg-white border ${selectedAction === c.id ? 'border-[var(--accent-gold)] bg-amber-50/70 shadow-xs ring-1 ring-[var(--accent-gold)]/40' : 'border-[var(--grid-border)]'} cursor-pointer interactive-option space-y-1.5 rounded-xs min-h-[56px]" data-action="${c.id}" tabindex="0" role="button">
 <div class="text-sm sm:text-base font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
 <span class="w-2 h-2 rounded-full ${selectedAction === c.id ? 'bg-[var(--accent-gold)]' : 'bg-stone-300'}"></span>
 ${c.title}
 </div>
 <div class="text-xs text-[var(--text-secondary)] leading-relaxed">${c.desc}</div>
 </div>
 `).join('')}
 </div>
 `,
 summaryContent: `
 <span id="f2ChoiceText">${selectedAction ? `You selected: <strong class="text-[var(--text-primary)]">${selectedChoice?.title}</strong>` : 'Select an option above to continue.'}</span>
 <span class="text-sm text-black ">${currentTrial + 1} / ${trials.length}</span>
 `,
 actionButtonId: 'f2ConfirmBtn',
 actionButtonText: currentTrial < trials.length - 1 ? 'Confirm Choice &rarr;' : 'Confirm & Finish &rarr;',
 actionButtonDisabled: !selectedAction,
 progressText: `Message ${currentTrial + 1} of ${trials.length}`
 });

 const confirmBtn = document.getElementById('f2ConfirmBtn');
 const choiceText = document.getElementById('f2ChoiceText');

 app.querySelectorAll('.f2-card').forEach(card => {
 const selectCard = (modality) => {
 lastInputModality = modality;
 selectedAction = card.getAttribute('data-action');
 app.querySelectorAll('.f2-card').forEach(c => {
 c.classList.remove('border-[var(--accent-gold)]', 'bg-amber-50/70', 'shadow-xs');
 c.classList.add('border-[var(--grid-border)]');
 c.querySelector('span.rounded-full')?.classList.remove('bg-[var(--accent-gold)]');
 c.querySelector('span.rounded-full')?.classList.add('bg-stone-300');
 });
 card.classList.add('border-[var(--accent-gold)]', 'bg-amber-50/70', 'shadow-xs');
 card.classList.remove('border-[var(--grid-border)]');
 card.querySelector('span.rounded-full')?.classList.add('bg-[var(--accent-gold)]');
 card.querySelector('span.rounded-full')?.classList.remove('bg-stone-300');
 if (confirmBtn) confirmBtn.disabled = false;
 if (choiceText) {
 const ch = choices.find(c => c.id === selectedAction);
 choiceText.innerHTML = `You selected: <strong class="text-[var(--text-primary)]">${ch?.title}</strong>`;
 }
 };

 card.addEventListener('click', () => selectCard('mouse'));
 card.addEventListener('keydown', (e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 selectCard('keyboard');
 }
 });
 });

 confirmBtn?.addEventListener('click', () => {
 logEvent('trial_submit', {
 trial_index: currentTrial,
 stimulus_id: t.stimulus_id,
 action_id: selectedAction,
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });

 if (currentTrial < trials.length - 1) {
 currentTrial++;
 selectedAction = null;
 render();
 scrollToTop();
 } else {
 onComplete({
 mini_game: 'F2',
 observations_count: trials.length
 });
 }
 });
 }

 render();
}

// --------------------------------------------------------------------------
// F3: The Echo of the Room (3 context transitions)
// Mechanic: Baseline response -> New context changes interpretation -> Updated response
// --------------------------------------------------------------------------
function runF3ContextChange(app, renderHeader, logEvent, onComplete) {
 let inTutorial = false;
 let currentTransition = 0;
 let phase = 'baseline';
 let selectedBaselineChoice = null;
 let selectedUpdatedChoice = null;
 let lastInputModality = 'mouse';

 const transitions = [
 {
 stimulus_id: 'F3_T1',
 cue_id: 'cue_expressive_crescendo',
 title: 'Round 1: Rising Voice Line',
 cue_text: '"The poet begins a rising, powerful verse."',
 baseline_context: 'Small Practice Room — Sound dies down quickly with no echo.',
 baseline_options: [
 { id: 'support_volume', label: 'Support Volume', desc: 'Lift volume so sound carries across the room.' },
 { id: 'dampen_level', label: 'Lower Level', desc: 'Turn volume down before the loud peak.' },
 { id: 'neutral_hold', label: 'Keep Steady', desc: 'Keep room settings steady without changes.' }
 ],
 shifted_context: 'Stone Hall — High stone walls bounce sound and create heavy echo.',
 shifted_options: [
 { id: 'attenuate_reverb', label: 'Lower Echo', desc: 'Trim room echo so words stay clear.' },
 { id: 'support_volume', label: 'Support Volume', desc: 'Keep the volume boost from the small room.' },
 { id: 'neutral_hold', label: 'Keep Steady', desc: 'Make no changes for the stone room.' }
 ]
 },
 {
 stimulus_id: 'F3_T2',
 cue_id: 'cue_sotto_voce_pause',
 title: 'Round 2: Quiet Whisper',
 cue_text: '"The poet drops into a quiet whisper between lines."',
 baseline_context: 'Quiet Sitting Room — Audience sits close and easily hears every word.',
 baseline_options: [
 { id: 'preserve_natural_intimacy', label: 'Keep Natural Tone', desc: 'Keep sound soft and clear without extra volume.' },
 { id: 'boost_high_gain', label: 'High Boost', desc: 'Force the whisper to play at loud volume.' },
 { id: 'cut_channel', label: 'Mute Feed', desc: 'Treat quiet verse as dead sound.' }
 ],
 shifted_context: 'Courtyard Gate — Nearby street chatter and fountain water cover soft voices.',
 shifted_options: [
 { id: 'boost_intelligibility', label: 'Boost Voice', desc: 'Lift the voice so outdoor chatter does not hide it.' },
 { id: 'preserve_natural_intimacy', label: 'Keep Natural Tone', desc: 'Leave voice unboosted so whisper is hard to hear.' },
 { id: 'cut_channel', label: 'Mute Feed', desc: 'Treat quiet sound as an equipment issue.' }
 ]
 },
 {
 stimulus_id: 'F3_T3',
 cue_id: 'cue_rhythmic_syncopation',
 title: 'Round 3: Pause Before Verse',
 cue_text: '"The poet pauses suddenly before the final line."',
 baseline_context: 'Solo Recital — A single speaker recites at a steady, driving pace.',
 baseline_options: [
 { id: 'sustain_cadence', label: 'Keep Pace', desc: 'Keep the steady beat moving through the pause.' },
 { id: 'halt_accompaniment', label: 'Stop Sound', desc: 'Stop all instruments abruptly on the pause.' },
 { id: 'force_metronome', label: 'Speed Up', desc: 'Push the recital forward past the pause.' }
 ],
 shifted_context: 'Group Singing — A chorus enters during the pause to sing an answer line.',
 shifted_options: [
 { id: 'open_reciprocal_space', label: 'Make Space', desc: 'Pause instruments to let the chorus answer clearly.' },
 { id: 'sustain_cadence', label: 'Keep Pace', desc: 'Play straight through without waiting for the chorus.' },
 { id: 'force_metronome', label: 'Speed Up', desc: 'Rush the group tempo forward.' }
 ]
 }
 ];

 function render() {
 if (inTutorial) {
 app.innerHTML = `
 <div class="candidate-content-protected max-w-2xl mx-auto">
 ${renderHeader('The Echo of the Room', 'Adjust your choices when room sound changes.')}
 ${renderTutorialCard({
 icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path></svg>`,
 goal: 'See how the same performance needs a new response when the room changes.',
 steps: [
 'Read what the performer does in the first room.',
 'Pick your first response.',
 'See the new room setting and pick an updated response.'
 ]
 })}
 </div>
 `;
 bindTutorialCard(app, () => {
 inTutorial = false;
 currentTransition = 0;
 phase = 'baseline';
 selectedBaselineChoice = null;
 selectedUpdatedChoice = null;
 logTransitionPresented();
 render();
 });
 return;
 }

 const tr = transitions[currentTransition];

 if (phase === 'baseline') {
 const activeOpt = tr.baseline_options.find(o => o.id === selectedBaselineChoice);
 app.innerHTML = `
 <div class="max-w-2xl mx-auto">
 <!-- TOP BAR -->
 <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 pb-2 border-b border-[var(--grid-border)]">
 <div class="flex items-center gap-2">
 <span class="act-badge">World 1: The Frequency</span>
 
 </div>
 </div>

 <!-- TASK HEADER -->
 <div class="mb-4">
 <h2 class="text-xl sm:text-2xl text-[var(--text-primary)]">The Echo of the Room</h2>
 <p class="text-base text-black mt-0.5">Pick your response for the first room setting.</p>
 </div>

 <!-- YOUR TASK -->
 <div class="p-3 sm:p-4 bg-amber-50/70 border border-[var(--accent-gold)]/40 rounded-xs mb-4 candidate-content-protected">
 <div class="text-sm uppercase tracking-wider text-[var(--accent-gold)] font-semibold mb-1">Your Task</div>
 <div class="text-base text-[var(--text-primary)] leading-relaxed">
 Read the performer action in this room. Pick your first response.
 </div>
 </div>

 <!-- LOOK AT THIS -->
 <div class="p-4 bg-white border border-[var(--grid-border)] rounded-xs mb-4 shadow-xs candidate-content-protected space-y-3">
 <div>
 <span class="text-sm uppercase tracking-wider text-[var(--accent-gold)] font-semibold">Performer Action</span>
 <div class="text-base text-[var(--text-primary)] font-medium mt-0.5 leading-relaxed">${tr.cue_text}</div>
 </div>
 <div class="p-3 bg-amber-50/50 border border-[var(--grid-border)] rounded-xs">
 <span class="text-sm uppercase tracking-wider text-[var(--text-primary)] font-semibold">First Room Setting</span>
 <div class="text-base text-[var(--text-primary)] mt-0.5">${tr.baseline_context}</div>
 </div>
 </div>

 <!-- INTERACTION AREA -->
 <div class="space-y-2.5 mb-4 candidate-content-protected">
 <div class="text-base uppercase tracking-wider text-black mb-1 ">Choose your response:</div>
 ${tr.baseline_options.map(opt => `
 <div class="f3-opt p-3.5 bg-white border ${selectedBaselineChoice === opt.id ? 'border-[var(--accent-gold)] bg-amber-50/70 shadow-xs' : 'border-[var(--grid-border)]'} cursor-pointer interactive-option rounded-xs min-h-[50px]" data-choice="${opt.id}" tabindex="0" role="button">
 <div class="text-base font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
 <span class="w-2 h-2 rounded-full ${selectedBaselineChoice === opt.id ? 'bg-[var(--accent-gold)]' : 'bg-stone-300'}"></span>
 ${opt.label}
 </div>
 <div class="text-[11px] text-black mt-0.5 leading-relaxed">${opt.desc}</div>
 </div>
 `).join('')}
 </div>

 <!-- YOUR CHOICE -->
 <div class="p-3 bg-white border border-[var(--grid-border)] rounded-xs mb-4 text-base text-black flex justify-between items-center">
 <span>${selectedBaselineChoice ? `You selected: <strong class="text-[var(--text-primary)]">${activeOpt?.label}</strong>` : 'Select an option above to continue.'}</span>
 <span class="text-sm text-black ">Step 1 of 2</span>
 </div>

 <!-- PRIMARY ACTION BUTTON -->
 <div class="flex justify-end">
 <button id="f3BaselineBtn" ${selectedBaselineChoice ? '' : 'disabled'} class="w-full sm:w-auto px-7 py-3 bg-[var(--text-primary)] text-white text-base uppercase tracking-widest disabled:opacity-40 interactive-option shadow-sm rounded-xs min-h-[44px]">
 Confirm and See Room Shift &rarr;
 </button>
 </div>
 </div>
 `;

 app.querySelectorAll('.f3-opt').forEach(opt => {
 const select = (modality) => {
 lastInputModality = modality;
 selectedBaselineChoice = opt.getAttribute('data-choice');
 render();
 };
 opt.addEventListener('click', () => select('mouse'));
 opt.addEventListener('keydown', (e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 select('keyboard');
 }
 });
 });

 document.getElementById('f3BaselineBtn')?.addEventListener('click', () => {
 logEvent('baseline_response_selected', {
 trial_index: currentTransition,
 stimulus_id: tr.stimulus_id,
 cue_id: tr.cue_id,
 choice_id: selectedBaselineChoice,
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });

 phase = 'shifted';
 logEvent('context_shifted', {
 trial_index: currentTransition,
 stimulus_id: tr.stimulus_id,
 cue_id: tr.cue_id,
 shifted_context: tr.shifted_context,
 task_def_version: '1.0'
 });
 render();
 });

 } else {
 // phase === 'shifted'
 const activeShiftedOpt = tr.shifted_options.find(o => o.id === selectedUpdatedChoice);
 app.innerHTML = `
 <div class="max-w-2xl mx-auto">
 <!-- TOP BAR -->
 <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 pb-2 border-b border-[var(--grid-border)]">
 <div class="flex items-center gap-2">
 <span class="act-badge">World 1: The Frequency</span>
 
 </div>
 </div>

 <!-- TASK HEADER -->
 <div class="mb-4">
 <h2 class="text-xl sm:text-2xl text-[var(--text-primary)]">The Echo of the Room</h2>
 <p class="text-base text-black mt-0.5">The room has changed. Update your response.</p>
 </div>

 <!-- YOUR TASK -->
 <div class="p-3 sm:p-4 bg-amber-50/70 border border-[var(--accent-gold)]/40 rounded-xs mb-4 candidate-content-protected">
 <div class="text-sm uppercase tracking-wider text-[var(--accent-gold)] font-semibold mb-1">Your Task</div>
 <div class="text-base text-[var(--text-primary)] leading-relaxed">
 The performer action is the same. Pick your updated response for the new room.
 </div>
 </div>

 <!-- LOOK AT THIS -->
 <div class="p-4 bg-white border border-[var(--grid-border)] rounded-xs mb-4 shadow-xs candidate-content-protected space-y-3">
 <div>
 <span class="text-sm uppercase tracking-wider text-[var(--accent-gold)] font-semibold">Same Performer Action</span>
 <div class="text-base text-[var(--text-primary)] font-medium mt-0.5 leading-relaxed">${tr.cue_text}</div>
 </div>
 <div class="p-3 bg-amber-100/70 border border-[var(--text-primary)]/50 rounded-xs">
 <span class="text-sm uppercase tracking-wider text-[var(--text-primary)] font-semibold">New Room Setting</span>
 <div class="text-base text-[var(--text-primary)] font-medium mt-0.5">${tr.shifted_context}</div>
 </div>
 </div>

 <!-- INTERACTION AREA -->
 <div class="space-y-2.5 mb-4 candidate-content-protected">
 <div class="text-base uppercase tracking-wider text-black mb-1 ">Choose your updated response:</div>
 ${tr.shifted_options.map(opt => `
 <div class="f3-updated-opt p-3.5 bg-white border ${selectedUpdatedChoice === opt.id ? 'border-[var(--accent-gold)] bg-amber-50/70 shadow-xs' : 'border-[var(--grid-border)]'} cursor-pointer interactive-option rounded-xs min-h-[50px]" data-choice="${opt.id}" tabindex="0" role="button">
 <div class="text-base font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
 <span class="w-2 h-2 rounded-full ${selectedUpdatedChoice === opt.id ? 'bg-[var(--accent-gold)]' : 'bg-stone-300'}"></span>
 ${opt.label}
 </div>
 <div class="text-[11px] text-black mt-0.5 leading-relaxed">${opt.desc}</div>
 </div>
 `).join('')}
 </div>

 <!-- YOUR CHOICE -->
 <div class="p-3 bg-white border border-[var(--grid-border)] rounded-xs mb-4 text-base text-black flex justify-between items-center">
 <span>${selectedUpdatedChoice ? `You selected: <strong class="text-[var(--text-primary)]">${activeShiftedOpt?.label}</strong>` : 'Select an option above to continue.'}</span>
 <span class="text-sm text-black ">Step 2 of 2</span>
 </div>

 <!-- PRIMARY ACTION BUTTON -->
 <div class="flex justify-end">
 <button id="f3UpdatedBtn" ${selectedUpdatedChoice ? '' : 'disabled'} class="w-full sm:w-auto px-7 py-3 bg-[var(--text-primary)] text-white text-base uppercase tracking-widest disabled:opacity-40 interactive-option shadow-sm rounded-xs min-h-[44px]">
 ${currentTransition < 2 ? 'Save Updated Setting & Next Round &rarr;' : 'Finish World 1 &rarr;'}
 </button>
 </div>
 </div>
 `;

 app.querySelectorAll('.f3-updated-opt').forEach(opt => {
 const select = (modality) => {
 lastInputModality = modality;
 selectedUpdatedChoice = opt.getAttribute('data-choice');
 render();
 };
 opt.addEventListener('click', () => select('mouse'));
 opt.addEventListener('keydown', (e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 select('keyboard');
 }
 });
 });

 document.getElementById('f3UpdatedBtn')?.addEventListener('click', () => {
 logEvent('updated_response_selected', {
 trial_index: currentTransition,
 stimulus_id: tr.stimulus_id,
 cue_id: tr.cue_id,
 choice_id: selectedUpdatedChoice,
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });

 logEvent('transition_completed', {
 trial_index: currentTransition,
 stimulus_id: tr.stimulus_id,
 task_def_version: '1.0'
 });

 if (currentTransition < 2) {
 currentTransition++;
 phase = 'baseline';
 selectedBaselineChoice = null;
 selectedUpdatedChoice = null;
 logTransitionPresented();
 render();
 scrollToTop();
 } else {
 onComplete({
 mini_game: 'F3',
 observations_count: 3
 });
 }
 });
 }
 }

 function logTransitionPresented() {
 const tr = transitions[currentTransition];
 logEvent('transition_presented', {
 trial_index: currentTransition,
 stimulus_id: tr.stimulus_id,
 cue_id: tr.cue_id,
 baseline_context: tr.baseline_context,
 task_def_version: '1.0'
 });
 }

 render();
}
