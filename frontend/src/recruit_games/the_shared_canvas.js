/* ==========================================================================
 ALFAAZ RECRUIT — WORLD 3: THE SHARED CANVAS (مشترکہ نقش)
 Mini-games: C1 (Resource Cooperation), C2 (Coordination), C3 (Collaboration Repair)
 Plain language remediation for human playtest pass 1.
 Sentences <= 12 words. Simple conversational English. Jargon removed.
 Preserves raw behavioral telemetry emissions and exact stimulus/action IDs.
 ========================================================================== */

import { renderTutorialCard, bindTutorialCard, renderGameShell, scrollToTop } from './index.js';

export function runTheSharedCanvas(context, renderHeader) {
 const { appContainer, miniGameIndex, gameId, logEvent, onMiniGameComplete } = context;

 const targetGame = gameId || (miniGameIndex === 0 ? 'C1' : (miniGameIndex === 1 ? 'C2' : 'C3'));
 if (targetGame === 'C1') {
 runC1ResourceCooperation(appContainer, renderHeader, logEvent, onMiniGameComplete);
 } else if (targetGame === 'C2') {
 runC2Coordination(appContainer, renderHeader, logEvent, onMiniGameComplete);
 } else {
 runC3CollaborationRepair(appContainer, renderHeader, logEvent, onMiniGameComplete);
 }
}

// --------------------------------------------------------------------------
// C1: Resource Cooperation (3 rounds: deficit, balanced, surplus control)
// --------------------------------------------------------------------------
function runC1ResourceCooperation(app, renderHeader, logEvent, onComplete) {
 let inTutorial = false;
 let currentRound = 0;
 let transferCount = 0;
 let lastInputModality = 'mouse';

 const rounds = [
 {
 stimulus_id: 'C1_R1',
 title: 'Round 1: Partner Needs Tiles',
 description: 'Your partner needs 3 more tiles to finish. You have 8 tiles.',
 partner_initial: 2,
 user_initial: 8,
 default_transfer: 0,
 context_note: 'Partner Needs Help'
 },
 {
    stimulus_id: 'C1_R3',
    title: 'Round 2: Scarce Personal Supply',
    description: 'You only have 3 tiles (need 5 to finish). Your partner already has 7 tiles.',
    partner_initial: 7,
    user_initial: 3,
    default_transfer: 0,
    context_note: 'You Are Short on Tiles'
  }
 ];


 function render() {
 if (inTutorial) {
 app.innerHTML = `
 <div class="candidate-content-protected max-w-2xl mx-auto">
 ${renderHeader("The Artisan's Basket", 'Coordinate ceramic tiles with your workshop partner.')}
 ${renderTutorialCard({
 icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>`,
 goal: 'Share tiles with your partner across 2 rounds.',
 steps: [
 'Check how many tiles you and your partner currently have.',
 'Use plus and minus to move tiles if you wish.',
 'Click Confirm to complete the round.'
 ]
 })}
 </div>
 `;
 bindTutorialCard(app, () => {
 inTutorial = false;
 currentRound = 0;
 transferCount = 0;
 logRoundPresented();
 render();
 });
 return;
 }

  const r = rounds[currentRound];
  const partnerTotal = r.partner_initial + transferCount;
  const userTotal = r.user_initial - transferCount;

  app.innerHTML = renderGameShell({
    worldCode: 'W3',
    worldIndex: 2,
    title: 'Resource Cooperation',
    goal: 'Share ceramic tiles so both you and your partner have enough to finish.',
    subtitle: 'Coordinate ceramic tiles with your workshop partner.',
    instructionPrompt: 'Your Task',
    instruction: 'Use + / − to choose how many tiles to share with your partner.',
    stimulusContent: `
      <div class="stage-content">
        <div class="dual-boards">
          <div class="board-box">
            <div class="board-title">Your Wall</div>
            <div class="tiles-grid" id="youTilesGrid">
              ${Array.from({length: Math.max(0, userTotal)}, () => '<div class="tile-chip"></div>').join('')}
            </div>
            <div style="font-size:0.75rem; color:#baa890; margin-top:6px;">You have: <span class="font-bold text-white">${userTotal}</span> (Need 5)</div>
          </div>
          <div class="board-box">
            <div class="board-title">Partner&#39;s Wall</div>
            <div class="tiles-grid" id="partnerTilesGrid">
              ${Array.from({length: Math.max(0, partnerTotal)}, () => '<div class="tile-chip partner"></div>').join('')}
            </div>
            <div style="font-size:0.75rem; margin-top:6px; color:${partnerTotal >= 5 ? '#8cd39e' : '#e6be82'};">
              ${partnerTotal >= 5 ? `✓ Partner has enough tiles (${partnerTotal}/5)` : `Partner needs ${5 - partnerTotal} more tile(s)`}
            </div>
          </div>
        </div>
      </div>
    `,
    interactionContent: `
      <div class="space-y-4">
        <div class="p-4 bg-white border border-[var(--grid-border)] rounded-xs space-y-3">
          <div class="flex items-center justify-between pb-2 border-b border-[var(--grid-border)]">
            <span class="text-xs uppercase tracking-wider text-[var(--accent-gold)] font-bold">Round ${currentRound + 1} of ${rounds.length}: ${r.title}</span>
            <span class="text-xs text-[var(--text-secondary)]">${r.context_note}</span>
          </div>
          <p class="text-sm sm:text-base text-[var(--text-primary)] leading-relaxed">
            ${r.description}
          </p>
          <div class="p-4 bg-[#faf8f5] border border-[var(--grid-border)] rounded-xs text-center">
            <div class="counter-controls">
              <button type="button" class="counter-btn" id="minusTileBtn" aria-label="Decrease shared tiles">−</button>
              <span style="font-size:1.25rem; font-weight:800; color:var(--accent-gold); min-width:120px;" id="sharedCountText">${transferCount} tile(s)</span>
              <button type="button" class="counter-btn" id="plusTileBtn" aria-label="Increase shared tiles">+</button>
            </div>
            <div class="text-xs text-[var(--text-secondary)] mt-2">Tap buttons to adjust tiles given to partner</div>
          </div>
        </div>
      </div>
    `,
    summaryContent: `
      <span>Sharing: <strong class="text-[var(--text-primary)]">${transferCount} tiles</strong> (You keep ${userTotal})</span>
      <span class="text-sm text-black">Round ${currentRound + 1} of ${rounds.length}</span>
    `,
    actionButtonId: 'confirmTransferBtn',
    actionButtonText: currentRound < rounds.length - 1 ? 'Confirm Allocation &rarr;' : 'Confirm & Finish &rarr;',
    progressText: `Round ${currentRound + 1} of ${rounds.length}`
  });

 document.getElementById('minusTileBtn')?.addEventListener('click', () => {
 lastInputModality = 'mouse';
 if (transferCount > 0) {
 transferCount--;
 logEvent('resource_transferred', {
 trial_index: currentRound,
 stimulus_id: r.stimulus_id,
 delta: -1,
 action_type: 'return_to_user',
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });
 render();
 }
 });

 document.getElementById('plusTileBtn')?.addEventListener('click', () => {
 lastInputModality = 'mouse';
 if (transferCount < r.user_initial) {
 transferCount++;
 logEvent('resource_transferred', {
 trial_index: currentRound,
 stimulus_id: r.stimulus_id,
 delta: 1,
 action_type: 'transfer_to_partner',
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });
 render();
 }
 });

 document.getElementById('confirmTransferBtn')?.addEventListener('click', () => {
 logEvent('allocation_confirmed', {
 trial_index: currentRound,
 stimulus_id: r.stimulus_id,
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });

 if (currentRound < rounds.length - 1) {
 currentRound++;
      transferCount = 0;
      logRoundPresented();
      render();
      scrollToTop();
 } else {
 onComplete({
 mini_game: 'C1',
 observations_count: rounds.length
 });
 }
 });
 }

 function logRoundPresented() {
 const r = rounds[currentRound];
 logEvent('round_presented', {
 trial_index: currentRound,
 stimulus_id: r.stimulus_id,
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });
 }

 render();
}

// --------------------------------------------------------------------------
// C2: Coordination (3 coordinated placement rounds)
// --------------------------------------------------------------------------
function runC2Coordination(app, renderHeader, logEvent, onComplete) {
 let inTutorial = false;
 let currentRound = 0;
 let chosenSlot = null;
 let lastInputModality = 'mouse';

 const rounds = [
 {
 stimulus_id: 'C2_R1',
 title: 'Round 1: Open Wall Space',
 partner_desc: 'Partner hung their painting on the top left corner.',
 slots: [
 { id: 'SLOT_NORTH_RIGHT', label: 'Top Right (Even Spacing)' },
 { id: 'SLOT_OVERLAP_LEFT', label: 'Next to Partner (Tight Cluster)' },
 { id: 'SLOT_BOTTOM_CENTER', label: 'Bottom Center (Center Spot)' }
 ]
 },
 {
 stimulus_id: 'C2_R2',
 title: 'Round 2: Keep Hallway Clear',
 partner_desc: 'Partner is framing the center hallway. Keep the doorway path clear.',
 slots: [
 { id: 'SLOT_PERIMETER_EAST', label: 'East Wall (Keeps Path Open)' },
 { id: 'SLOT_CENTER_ADJACENT', label: 'Center Slot (Crowds the Hall)' },
 { id: 'SLOT_PERIMETER_WEST', label: 'West Wall (Keeps Path Open)' }
 ]
 }
 ];


 function render() {
 if (inTutorial) {
 app.innerHTML = `
 <div class="candidate-content-protected max-w-2xl mx-auto">
 ${renderHeader('The Gallery Wall', 'Coordinate artwork placement with your partner.')}
 ${renderTutorialCard({
 icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"></path></svg>`,
 goal: 'Choose a wall spot for your piece across 2 rounds.',
 steps: [
 'See where your partner hung their artwork.',
 'Choose an open wall spot from the options.',
 'Click Confirm to hang your piece.'
 ]
 })}
 </div>
 `;
 bindTutorialCard(app, () => {
 inTutorial = false;
 currentRound = 0;
 chosenSlot = null;
 logRoundPresented();
 render();
 });
 return;
 }

  const r = rounds[currentRound];
  const activeSlot = r.slots.find(s => s.id === chosenSlot);

  app.innerHTML = renderGameShell({
    worldCode: 'W3',
    worldIndex: 2,
    title: 'The Gallery Wall',
    goal: 'Choose where on the wall to hang your artwork alongside your partner\'s painting.',
    subtitle: 'Coordinate artwork placement with your partner.',
    instructionPrompt: 'Your Task',
    instruction: 'Look at the wall layout above. Choose an open spot below to hang your artwork.',
    stimulusContent: `
      <div class="stage-content">
        <div class="wall-spots-canvas">
          <div class="partner-frame">Partner&#39;s Painting<br><span style="font-size:0.68rem; opacity:0.8;">(Already Hung)</span></div>
          <div class="hanging-spot-marker ${chosenSlot === r.slots[0]?.id ? 'active' : ''}" id="markerSpot1" style="right:20px; top:18px; width:72px; height:60px;">Spot 1</div>
          <div class="hanging-spot-marker ${chosenSlot === r.slots[1]?.id ? 'active' : ''}" id="markerSpot2" style="left:96px; top:24px; width:72px; height:76px;">Spot 2</div>
          <div class="hanging-spot-marker ${chosenSlot === r.slots[2]?.id ? 'active' : ''}" id="markerSpot3" style="bottom:12px; left:50%; transform:translateX(-50%); width:88px; height:46px;">Spot 3</div>
        </div>
        <div class="text-xs text-center text-[var(--text-secondary)] mt-2">
          ${r.partner_desc}
        </div>
      </div>
    `,
    interactionContent: `
      <div class="space-y-3">
        <div class="options-directive">
          <span>Choose where on the wall to hang your artwork:</span>
          <span style="font-size:0.75rem; color:var(--text-secondary);">Tap to select</span>
        </div>
        <div class="outside-options space-y-2.5">
          ${r.slots.map((s, idx) => {
            const bullet = String.fromCharCode(65 + idx);
            const isSelected = chosenSlot === s.id;
            return `
              <button type="button" class="outside-opt-card slot-btn ${isSelected ? 'selected' : ''}" data-slot="${s.id}" tabindex="0">
                <div class="opt-bullet">${bullet}</div>
                <div style="flex:1;">
                  <div class="text-sm sm:text-base font-semibold text-[var(--text-primary)]">${s.label}</div>
                  <div class="text-xs text-[var(--text-secondary)] mt-0.5">Wall Spot ${idx + 1}</div>
                </div>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `,
    summaryContent: `
      <span>${chosenSlot ? `You selected: <strong class="text-[var(--text-primary)]">${activeSlot?.label}</strong>` : 'Select a spot above to continue.'}</span>
      <span class="text-sm text-black">Round ${currentRound + 1} of ${rounds.length}</span>
    `,
    actionButtonId: 'confirmWallBtn',
    actionButtonText: currentRound < rounds.length - 1 ? 'Confirm Placement &rarr;' : 'Confirm & Finish &rarr;',
    actionButtonDisabled: !chosenSlot,
    progressText: `Round ${currentRound + 1} of ${rounds.length}`
  });

 app.querySelectorAll('.slot-btn').forEach(btn => {
 const selectSlot = (modality) => {
 lastInputModality = modality;
 chosenSlot = btn.getAttribute('data-slot');
 logEvent('placement_attempted', {
 trial_index: currentRound,
 stimulus_id: r.stimulus_id,
 slot_id: chosenSlot,
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });
 render();
 };

 btn.addEventListener('click', () => selectSlot('mouse'));
 btn.addEventListener('keydown', (e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 selectSlot('keyboard');
 }
 });
 });

 document.getElementById('confirmWallBtn')?.addEventListener('click', () => {
 logEvent('placement_confirmed', {
 trial_index: currentRound,
 stimulus_id: r.stimulus_id,
 chosen_slot: chosenSlot,
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });

 if (currentRound < rounds.length - 1) {
 currentRound++;
      chosenSlot = null;
      logRoundPresented();
      render();
      scrollToTop();
 } else {
 onComplete({
 mini_game: 'C2',
 observations_count: rounds.length
 });
 }
 });
 }

 function logRoundPresented() {
 const r = rounds[currentRound];
 logEvent('round_presented', {
 trial_index: currentRound,
 stimulus_id: r.stimulus_id,
 task_def_version: '1.0'
 });
 }

 render();
}

// --------------------------------------------------------------------------
// C3: Collaboration Repair (3 breakdown / recovery opportunities)
// Candidate must: identify breakdown -> perform useful repair -> execute repaired action
// --------------------------------------------------------------------------
function runC3CollaborationRepair(app, renderHeader, logEvent, onComplete) {
 let inTutorial = false;
 let currentOpportunity = 0;
 let selectedFault = null;
 let selectedRepair = null;
 let lastInputModality = 'mouse';

 const opportunities = [
 {
 stimulus_id: 'C3_R1',
 title: 'Opportunity 1: Partner Lantern is Dark',
 partner_state: 'Your partner\'s lantern turned dark during setup.',
 condition_type: 'identify_and_repair',
 fault_options: [
 { id: 'fault_conduit_disconnected', label: 'The wire came loose at the connector' },
 { id: 'fault_bulb_broken', label: 'The glass bulb is broken' },
 { id: 'fault_switch_off', label: 'The main hall switch is off' }
 ],
 repair_options: [
 { id: 'adjust_conduit', label: 'Reconnect the loose wire and tighten the clamp' },
 { id: 'call_help_desk', label: 'Call the main help desk' },
 { id: 'replace_lantern', label: 'Take down the entire lamp' }
 ],
 execution_action: 'restore_power'
 },
 {
 stimulus_id: 'C3_R2',
 title: 'Opportunity 2: Hanging Rope Stuck',
 partner_state: 'The hanging rope got caught in the wheel bracket.',
 condition_type: 'identify_and_repair',
 fault_options: [
 { id: 'fault_cable_pulley_pinch', label: 'Rope is pinched between wheel and metal frame' },
 { id: 'fault_cable_snapped', label: 'The rope snapped completely' },
 { id: 'fault_wall_anchor_loose', label: 'The wall hook is loose' }
 ],
 repair_options: [
 { id: 'reseat_pulley_cable', label: 'Loosen the lever and place the rope back on the wheel' },
 { id: 'call_facility_maintenance', label: 'File a general repair request' },
 { id: 'force_pull_cable', label: 'Pull the rope down hard' }
 ],
 execution_action: 'align_panel_height'
 },
 {
 stimulus_id: 'C3_R3',
 title: 'Opportunity 3: Shadow Blocks Artwork',
 partner_state: 'A movable wooden screen casts a dark shadow over your partner\'s painting.',
 condition_type: 'identify_and_repair',
 fault_options: [
 { id: 'fault_blindspot_obstruction', label: 'Wooden screen blocks the spotlight beam' },
 { id: 'fault_color_distortion', label: 'The light color looks wrong' }
 ],
 repair_options: [
 { id: 'shift_lantern', label: 'Turn the spotlight slightly to shine around the screen' },
 { id: 'generic_complaint', label: 'Submit a general lighting complaint' }
 ],
 execution_action: 'illuminate_path'
 }
 ];

 function render() {
 if (inTutorial) {
 app.innerHTML = `
 <div class="candidate-content-protected max-w-2xl mx-auto">
 ${renderHeader('The Dual Lanterns', 'Resolve studio breakdowns to keep the hall ready.')}
 ${renderTutorialCard({
 icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>`,
 goal: 'Find the work issue, pick a fix, and repair it together.',
 steps: [
 'Examine the situation described in each round.',
 'Identify the issue from the list.',
 'Choose a helpful fix and apply the repair.'
 ]
 })}
 </div>
 `;
 bindTutorialCard(app, () => {
 inTutorial = false;
 currentOpportunity = 0;
 selectedFault = null;
 selectedRepair = null;
 logRepairPresented();
 render();
 });
 return;
 }

 const opp = opportunities[currentOpportunity];
 const activeFault = opp.fault_options.find(f => f.id === selectedFault);
 const activeRepair = opp.repair_options.find(r => r.id === selectedRepair);

 app.innerHTML = `
 <div class="max-w-2xl mx-auto">
 <!-- TOP BAR -->
 <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 pb-2 border-b border-[var(--grid-border)]">
 <div class="flex items-center gap-2">
 <span class="act-badge">World 3: The Shared Canvas</span>
 
 </div>
 </div>

 <!-- TASK HEADER -->
 <div class="mb-4">
 <h2 class="text-xl sm:text-2xl text-[var(--text-primary)]">The Dual Lanterns</h2>
 <p class="text-base text-black mt-0.5">Resolve studio issues to keep exhibition work moving.</p>
 </div>

 <!-- YOUR TASK -->
 <div class="p-3 sm:p-4 bg-amber-50/70 border border-[var(--accent-gold)]/40 rounded-xs mb-4 candidate-content-protected">
 <div class="text-sm uppercase tracking-wider text-[var(--accent-gold)] font-semibold mb-1">Your Task</div>
 <div class="text-base text-[var(--text-primary)] leading-relaxed">
 Step 1: Identify what went wrong. Step 2: Choose how to fix it.
 </div>
 </div>

 <!-- LOOK AT THIS -->
 <div class="p-3.5 bg-white border border-[var(--grid-border)] rounded-xs mb-4 shadow-xs candidate-content-protected flex items-center justify-between">
 <span class="text-base text-[var(--text-primary)]">
 <strong>${opp.title}:</strong> ${opp.partner_state}
 </span>
 <span class="text-sm uppercase tracking-wider text-[var(--accent-gold)] font-medium">Stage ${currentOpportunity + 1} of 3</span>
 </div>

 <!-- INTERACTION AREA -->
 <div class="p-5 bg-[#faf8f5] border border-[var(--grid-border)] mb-4 rounded-xs shadow-xs candidate-content-protected">
 <!-- Step 1: Identify Breakdown -->
 <div class="mb-4">
 <div class="text-base font-semibold uppercase tracking-wider text-[var(--text-primary)] mb-2 ">
 Step 1: What is the issue?
 </div>
 <div class="space-y-2">
 ${opp.fault_options.map(f => `
 <div class="fault-opt p-3 bg-white border ${selectedFault === f.id ? 'border-[var(--accent-gold)] bg-amber-50/70 shadow-xs font-medium' : 'border-[var(--grid-border)] '} rounded-xs cursor-pointer interactive-option text-base flex items-center gap-2 min-h-[44px]" data-fault="${f.id}" tabindex="0" role="button">
 <span class="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center text-[8px] ${selectedFault === f.id ? 'bg-[var(--accent-gold)] text-white' : 'text-stone-300'}">${selectedFault === f.id ? '✓' : ''}</span>
 <span class="text-[var(--text-primary)]">${f.label}</span>
 </div>
 `).join('')}
 </div>
 </div>

 <!-- Step 2: Perform Constructive Repair -->
 ${selectedFault ? `
 <div class="pt-4 border-t border-[var(--grid-border)] ">
 <div class="text-base font-semibold uppercase tracking-wider text-[var(--text-primary)] mb-2 ">
 Step 2: Choose a constructive fix:
 </div>
 <div class="space-y-2">
 ${opp.repair_options.map(r => `
 <div class="repair-opt p-3 bg-white border ${selectedRepair === r.id ? 'border-[var(--accent-gold)] bg-amber-50/70 shadow-xs font-medium' : 'border-[var(--grid-border)] '} rounded-xs cursor-pointer interactive-option text-base flex items-center gap-2 min-h-[44px]" data-repair="${r.id}" tabindex="0" role="button">
 <span class="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center text-[8px] ${selectedRepair === r.id ? 'bg-[var(--accent-gold)] text-white' : 'text-stone-300'}">${selectedRepair === r.id ? '✓' : ''}</span>
 <span class="text-[var(--text-primary)]">${r.label}</span>
 </div>
 `).join('')}
 </div>
 </div>
 ` : ''}
 </div>

 <!-- YOUR CHOICE -->
 <div class="p-3 bg-white border border-[var(--grid-border)] rounded-xs mb-4 text-base text-black flex justify-between items-center">
 <span>${selectedFault && selectedRepair ? `Fix selected: <strong class="text-[var(--text-primary)]">${activeRepair?.label}</strong>` : (selectedFault ? 'Now choose a fix in Step 2.' : 'Select an issue in Step 1.')}</span>
 <span class="text-sm text-black ">${currentOpportunity + 1} / 3</span>
 </div>

 <!-- PRIMARY ACTION BUTTON -->
 <div class="flex justify-end">
 <button type="button" id="executeRepairBtn" ${selectedFault && selectedRepair ? '' : 'disabled'} class="w-full sm:w-auto px-7 py-3 bg-[var(--text-primary)] text-white text-base uppercase tracking-widest disabled:opacity-40 interactive-option shadow-sm rounded-xs min-h-[44px]">
 ${currentOpportunity < 2 ? 'Apply Fix & Next Problem &rarr;' : 'Finish World 3 &rarr;'}
 </button>
 </div>
 </div>
 `;

 // Handlers for Step 1
 app.querySelectorAll('.fault-opt').forEach(opt => {
 const selectFault = (modality) => {
 lastInputModality = modality;
 selectedFault = opt.getAttribute('data-fault');
 logEvent('breakdown_identified', {
 trial_index: currentOpportunity,
 stimulus_id: opp.stimulus_id,
 fault_id: selectedFault,
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });
 render();
 };

 opt.addEventListener('click', () => selectFault('mouse'));
 opt.addEventListener('keydown', (e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 selectFault('keyboard');
 }
 });
 });

 // Handlers for Step 2
 app.querySelectorAll('.repair-opt').forEach(opt => {
 const selectRepair = (modality) => {
 lastInputModality = modality;
 selectedRepair = opt.getAttribute('data-repair');
 logEvent('repair_action_performed', {
 trial_index: currentOpportunity,
 stimulus_id: opp.stimulus_id,
 repair_action_id: selectedRepair,
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });
 render();
 };

 opt.addEventListener('click', () => selectRepair('mouse'));
 opt.addEventListener('keydown', (e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 selectRepair('keyboard');
 }
 });
 });

 // Step 3 Execution
 document.getElementById('executeRepairBtn')?.addEventListener('click', () => {
 logEvent('repaired_action_executed', {
 trial_index: currentOpportunity,
 stimulus_id: opp.stimulus_id,
 fault_id: selectedFault,
 repair_action_id: selectedRepair,
 execution_action_id: opp.execution_action,
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });

 if (currentOpportunity < 2) {
 currentOpportunity++;
 selectedFault = null;
 selectedRepair = null;
 logRepairPresented();
 render();
 scrollToTop();
 } else {
 onComplete({
 mini_game: 'C3',
 observations_count: 3
 });
 }
 });
 }

 function logRepairPresented() {
 const opp = opportunities[currentOpportunity];
 logEvent('repair_presented', {
 trial_index: currentOpportunity,
 stimulus_id: opp.stimulus_id,
 task_def_version: '1.0'
 });
 }

 render();
}
