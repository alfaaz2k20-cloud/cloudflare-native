/* ==========================================================================
 ALFAAZ RECRUIT — WORLD 5: THE HIDDEN GALLERY (نہاں خانہ)
 Mini-games: Q1 (Information Seeking), Q2 (Investigation Under Uncertainty), Q3 (Knowledge Integration)
 Adheres to Design Freeze v1 + Addendum v1.1.
 Emits raw behavioral telemetry only (no client-authored scores or correctness).
 Remediated for plain English (<= 12 words per sentence), mobile-first layout,
 and scoped candidate content protection.
 ========================================================================== */

import { renderTutorialCard, bindTutorialCard, renderGameShell, scrollToTop } from './index.js';

export function runTheHiddenGallery(context, renderHeader) {
 const { appContainer, miniGameIndex, gameId, logEvent, onMiniGameComplete } = context;

 const targetGame = gameId || (miniGameIndex === 0 ? 'Q1' : (miniGameIndex === 1 ? 'Q2' : 'Q3'));
 if (targetGame === 'Q1') {
 runQ1InformationSeeking(appContainer, renderHeader, logEvent, onMiniGameComplete);
 } else if (targetGame === 'Q2') {
 runQ2InvestigationUnderUncertainty(appContainer, renderHeader, logEvent, onMiniGameComplete);
 } else {
 runQ3KnowledgeIntegration(appContainer, renderHeader, logEvent, onMiniGameComplete);
 }
}

// --------------------------------------------------------------------------
// Q1: Information Seeking (4 required decisions, voluntary optional resources)
// Resources have genuinely different value (useful vs low-value controls).
// Clicks alone do not equal curiosity.
// --------------------------------------------------------------------------
function runQ1InformationSeeking(app, renderHeader, logEvent, onComplete) {
 let inTutorial = false;
 let currentDecision = 0;
 let selectedChoice = null;
 let viewedResources = {};
 let lastInputModality = 'mouse';

 const decisions = [
 {
 stimulus_id: 'Q1_D1',
 title: 'Old Handwritten Manuscript Page',
 scenario: 'Choose the best way to protect this delicate 19th-century manuscript page.',
 options: [
 { id: 'flexible_cord_binding', label: 'Soft Cord Binding (Allows the spine to bend gently)' },
 { id: 'tight_adhesive_clamp', label: 'Firm Glue Clamp (Holds the edge tight and stiff)' },
 { id: 'unbound_portfolio', label: 'Clean Paper Folder (Kept loose inside a safe folder)' }
 ],
 optional_resources: [
 { id: 'OPT_USEFUL_1', topic: 'Binding Methods Note', info_value: 'high', summary: 'Local bookbinders used soft cord to protect delicate paper borders.' },
 { id: 'OPT_CONTROL_1', topic: 'Library Stamp Dates', info_value: 'low', summary: 'City library stamps began in late October 1888.' }
 ]
 },
 {
 stimulus_id: 'Q1_D2',
 title: 'Painted Wooden Pen Case',
 scenario: 'The paint is old and tiny pieces of shiny coat are peeling off. Choose how to care for it.',
 options: [
 { id: 'curing_linseed_glaze', label: 'Natural Plant Oil (Wipes gently and dries slowly)' },
 { id: 'quick_synthetic_seal', label: 'Quick Spray Polish (Dries fast with a shiny coat)' },
 { id: 'wax_buff_only', label: 'Clean Dry Cloth (Gentle dry rub with soft cloth)' }
 ],
 optional_resources: [
 { id: 'OPT_USEFUL_2', topic: 'Pen Case Care Note', info_value: 'high', summary: 'Natural oil dries slowly and keeps paint bright without cracking.' },
 { id: 'OPT_CONTROL_2', topic: 'Cabinet Hinge Maintenance', info_value: 'low', summary: 'Brass display cabinet hinges need oiling twice each year.' }
 ]
 },
 {
 stimulus_id: 'Q1_D3',
 title: 'Artisan Workshop Register',
 scenario: 'Identify the origin of this undated workshop record book.',
 options: [
 { id: 'guild_ledger_verified', label: 'Crafts Guild Register (Has official guild stamp)' },
 { id: 'private_merchant_tally', label: 'Shopkeeper Daily Notebook (Informal daily sales notes)' },
 { id: 'state_excise_record', label: 'City Tax Register (Official tax collection book)' }
 ],
 optional_resources: [
 { id: 'OPT_USEFUL_1', topic: 'Register Stitching Styles', info_value: 'high', summary: 'Red thread stitching was reserved for registered craft guilds.' },
 { id: 'OPT_CONTROL_1', topic: 'Filing Code Reference', info_value: 'low', summary: 'Old municipal tax files use code series B.' }
 ]
 }
 ];

 function render() {
 if (inTutorial) {
 app.innerHTML = `
 <div class="candidate-content-protected">
 <div class="flex items-center gap-2 mb-3">
 <span class="act-badge">World 5: The Hidden Gallery</span>
 
 </div>
 ${renderTutorialCard({
 icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>`,
 goal: 'Make preservation choices for 3 historic items.',
 steps: [
 'Read the artifact prompt and choose your option.',
 'Click optional research notes if you want more background.',
 'Click Confirm when you are ready to continue.'
 ]
 })}
 </div>
 `;
 bindTutorialCard(app, () => {
 inTutorial = false;
 currentDecision = 0;
 selectedChoice = null;
 logDecisionPresented();
 render();
 });
 return;
 }

  const d = decisions[currentDecision];
  const hasTipOpened = Object.keys(viewedResources).length > 0;

  app.innerHTML = renderGameShell({
    worldCode: 'W5',
    worldIndex: 4,
    title: 'The Curatorial Dossier',
    goal: 'Choose the best way to care for old objects.',
    subtitle: 'Choose the best way to care for each historic item.',
    instructionPrompt: 'Your Task',
    instruction: 'Review the object and choose the best care action below. Open the research tip if helpful.',
    stimulusContent: `
      <div class="stage-content">
        <div style="width:92%; background:#2c241d; border:1px solid #4a3d31; border-radius:10px; padding:16px; margin:0 auto; text-align:left;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
            <span style="font-size:0.75rem; color:#d8baa0; text-transform:uppercase; font-weight:700;">Old Object ${currentDecision + 1} of ${decisions.length}</span>
            <button type="button" class="btn ${hasTipOpened ? '' : 'pulse-btn'}" id="btnResearchNote" style="padding:6px 12px; font-size:0.78rem; background:#4a392b; color:#ffffff; border:1.5px solid var(--accent-gold);">
              ${hasTipOpened ? '📖 Research Tip Opened' : '📖 Open Research Tip'}
            </button>
          </div>
          <div style="font-size:1.05rem; font-weight:700; color:#fff; margin-bottom:6px;">${d.title}</div>
          <p style="font-size:0.88rem; color:#cfc2b2; margin:0; line-height:1.5;">
            ${d.scenario}
          </p>
          <div id="tipBox" style="display:${hasTipOpened ? 'block' : 'none'}; margin-top:12px; padding:10px 14px; background:#1e1712; border-left:3px solid var(--accent-gold); font-size:0.84rem; color:#e0d0b8; border-radius:4px;">
            <b>Tip from old makers:</b> ${d.optional_resources[0]?.summary || 'Natural tree oil dries slowly and keeps paint bright without cracking.'}
          </div>
        </div>
      </div>
    `,
    interactionContent: `
      <div class="space-y-4">
        <!-- Outside Actions with A, B, C bullets -->
        <div class="space-y-3">
          <div class="options-directive">
            <span>Choose how to care for this object:</span>
            <span style="font-size:0.75rem; color:var(--text-secondary);">Tap to select</span>
          </div>
          <div class="outside-options space-y-2.5">
            ${d.options.map((opt, idx) => {
              const bullet = String.fromCharCode(65 + idx);
              const isSelected = selectedChoice === opt.id;
              return `
                <button type="button" class="outside-opt-card q1-opt ${isSelected ? 'selected' : ''}" data-choice="${opt.id}" tabindex="0">
                  <div class="opt-bullet">${bullet}</div>
                  <div style="flex:1;">
                    <div class="text-sm sm:text-base font-semibold text-[var(--text-primary)]">${opt.label}</div>
                    <div class="text-xs text-[var(--text-secondary)] mt-0.5">Action ${bullet}</div>
                  </div>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `,
    summaryContent: `
      <span>${selectedChoice ? `You selected: <strong class="text-[var(--text-primary)]">${d.options.find(o => o.id === selectedChoice)?.label}</strong>` : 'Select an action above to continue.'}</span>
      <span class="text-sm text-black">${currentDecision + 1} / ${decisions.length}</span>
    `,
    actionButtonId: 'confirmQ1Btn',
    actionButtonText: currentDecision < decisions.length - 1 ? 'Confirm Decision &rarr;' : 'Confirm & Finish &rarr;',
    actionButtonDisabled: !selectedChoice,
    progressText: `Record ${currentDecision + 1} of ${decisions.length}`
  });

  const tipBtn = document.getElementById('btnResearchNote');
  if (tipBtn) {
    tipBtn.onclick = () => {
      const resId = d.optional_resources[0]?.id || 'OPT_USEFUL_1';
      viewedResources[resId] = true;
      logEvent('optional_resource_viewed', {
        trial_index: currentDecision,
        stimulus_id: d.stimulus_id,
        resource_id: resId,
        input_modality: 'mouse',
        task_def_version: '1.0'
      });
      render();
    };
  }

 app.querySelectorAll('.opt-res-card').forEach(card => {
 card.addEventListener('click', () => {
 lastInputModality = 'mouse';
 const resId = card.getAttribute('data-res');
 viewedResources[resId] = true;
 logEvent('optional_resource_viewed', {
 trial_index: currentDecision,
 stimulus_id: d.stimulus_id,
 resource_id: resId,
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });
 render();
 });
 });

 // Handler for decision choices
 app.querySelectorAll('.q1-opt').forEach(opt => {
 const chooseOption = (modality) => {
 lastInputModality = modality;
 selectedChoice = opt.getAttribute('data-choice');
 render();
 };

 opt.addEventListener('click', () => chooseOption('mouse'));
 opt.addEventListener('keydown', (e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 chooseOption('keyboard');
 }
 });
 });

 document.getElementById('confirmQ1Btn')?.addEventListener('click', () => {
 logEvent('decision_submitted', {
 trial_index: currentDecision,
 stimulus_id: d.stimulus_id,
 choice: selectedChoice,
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });

 if (currentDecision < decisions.length - 1) {
 currentDecision++;
      selectedChoice = null;
      viewedResources = {};
      logDecisionPresented();
      render();
      scrollToTop();
 } else {
 onComplete({
 mini_game: 'Q1',
 observations_count: decisions.length
 });
 }
 });
 }

 function logDecisionPresented() {
 const d = decisions[currentDecision];
 logEvent('decision_presented', {
 trial_index: currentDecision,
 stimulus_id: d.stimulus_id,
 task_def_version: '1.0'
 });
 }

 render();
}

// --------------------------------------------------------------------------
// Q2: Investigation Under Uncertainty (EXACTLY 4 exploration opportunities)
// Varying uncertainty and expected value. One opportunity is low-value control.
// Raw clicks do not equal curiosity.
// --------------------------------------------------------------------------
function runQ2InvestigationUnderUncertainty(app, renderHeader, logEvent, onComplete) {
 let inTutorial = false;
 let currentTrial = 0;
 let inspectedClues = {};
 let selectedAttribution = null;
 let lastInputModality = 'mouse';

 const relics = [
 {
 stimulus_id: 'Q2_T1',
 artifact_id: 'manuscript_seal_1',
 title: 'Relic 1: Wax Seal on Parchment',
 description: 'A dark red wax seal stamped onto an old parchment document.',
 uncertainty_level: 'moderate',
 expected_value: 'high',
 clues: [
 { id: 'CLUE_SEAL_INTAGLIO', label: 'Carved Seal Border Script', detail: 'Shows the official stamp of the Srinagar city office from 1862.' },
 { id: 'CLUE_WAX_RESIN', label: 'Wax Material Analysis', detail: 'Made with local pine resin rather than imported European wax.' },
 { id: 'CLUE_PARCHMENT_GRAIN', label: 'Parchment Skin Grain', detail: 'Mountain goatskin with hand-scraped natural grain.' }
 ],
 attributions: [
 { id: 'attr_imperial_registrar_srinagar', label: 'City Office of Srinagar (1860s)' },
 { id: 'attr_commercial_trader', label: 'River Trader Shipping Record' },
 { id: 'attr_modern_reproduction', label: 'Modern Souvenir Copy' }
 ]
 },
 {
 stimulus_id: 'Q2_T2',
 artifact_id: 'ciphered_marginalia_2',
 title: 'Relic 2: Star Chart with Handwritten Notes',
 description: 'Handwritten notes written in old cursive script along a star chart.',
 uncertainty_level: 'high',
 expected_value: 'high',
 clues: [
 { id: 'CLUE_CIPHER_DIACRITIC', label: 'Script Number Marks', detail: 'Notes record the date of an eclipse in 1845.' },
 { id: 'CLUE_SCRIBE_HAND', label: 'Penmanship Style', detail: 'Matches the private notebook of court scholar Mir Habib.' },
 { id: 'CLUE_GALL_INK_CORROSION', label: 'Ink Aging Depth', detail: 'Natural ink aging shows paper is over 170 years old.' }
 ],
 attributions: [
 { id: 'attr_court_astrologer_notebook', label: 'Court Scholar Personal Notebook' },
 { id: 'attr_apothecary_recipe', label: 'Herbal Medicine Recipe' },
 { id: 'attr_random_scribble', label: 'Scribe Practice Scratches' }
 ]
 },
 {
 stimulus_id: 'Q2_T3',
 artifact_id: 'standard_receipt_3',
 title: 'Relic 3: City Transit Toll Receipt (Control)',
 description: 'A printed paper slip with standard columns and serial numbers.',
 uncertainty_level: 'low',
 expected_value: 'low_control',
 clues: [
 { id: 'CLUE_PRINT_TYPE', label: 'Standard Moveable Type', detail: 'Mass-printed transit slip used for routine city transport.' },
 { id: 'CLUE_STAMP_INK', label: 'Routine Blue Ink Stamp', detail: 'Common government office stamp with standard numbering.' }
 ],
 attributions: [
 { id: 'attr_standard_tax_slip', label: 'City Transit Pass Receipt' },
 { id: 'attr_royal_chancery_grant', label: 'Palace Land Grant' },
 { id: 'attr_secret_monastery_order', label: 'Monastic Travel Permission' }
 ]
 }
 ];

  const relicVisuals = [
    {
      badgeText: 'SEAL',
      badgeBg: '#963728',
      badgeBorder: '#5a1c12',
      padBorder: '#48392d',
      noun: 'wax seal',
      surface: 'Velvet Display Pad'
    },
    {
      badgeText: 'CHART',
      badgeBg: '#233554',
      badgeBorder: '#142038',
      padBorder: '#2d3d5e',
      noun: 'star chart',
      surface: 'Study Folio Desk'
    },
    {
      badgeText: 'RECEIPT',
      badgeBg: '#443b32',
      badgeBorder: '#28221b',
      padBorder: '#4a3f35',
      noun: 'transit receipt',
      surface: 'Archival Tray'
    }
  ];

 function render() {
 if (inTutorial) {
 app.innerHTML = `
 <div class="candidate-content-protected">
 <div class="flex items-center gap-2 mb-3">
 <span class="act-badge">World 5: The Hidden Gallery</span>
 
 </div>
 ${renderTutorialCard({
 icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>`,
 goal: 'Inspect 3 historic relics to identify where they came from.',
 steps: [
 'Read the description of the relic.',
 'Click any clues you want to inspect.',
 'Pick your conclusion and click Confirm.'
 ]
 })}
 </div>
 `;
 bindTutorialCard(app, () => {
 inTutorial = false;
 currentTrial = 0;
 inspectedClues = {};
 selectedAttribution = null;
 logArtifactPresented();
 render();
 });
 return;
 }

  const r = relics[currentTrial];
  const v = relicVisuals[currentTrial] || relicVisuals[0];
  const lastClueId = Object.keys(inspectedClues).pop();
  const lastClue = lastClueId ? r.clues.find(c => c.id === lastClueId) : null;

  app.innerHTML = renderGameShell({
    worldCode: 'W5',
    worldIndex: 4,
    title: 'The Relic Anomaly',
    goal: 'Inspect clues on the old object to find where it came from.',
    subtitle: 'Inspect physical clues to identify each historic object.',
    instructionPrompt: 'Your Task',
    instruction: `Complete Step 1 by inspecting clues. Then choose where this ${v.noun} came from in Step 2.`,
    stimulusContent: `
      <div class="stage-content">
        <div style="width:86%; background:#292019; border:1.5px solid ${v.padBorder}; border-radius:10px; padding:16px; text-align:center; margin:0 auto;">
          <div style="font-size:0.75rem; color:#d8baa0; text-transform:uppercase; font-weight:700; letter-spacing:0.04em;">Historical Artifact on ${v.surface}</div>
          <div style="width:54px; height:54px; border-radius:50%; background:${v.badgeBg}; margin:10px auto; display:flex; align-items:center; justify-content:center; color:#fff; font-size:0.72rem; font-weight:800; box-shadow:0 4px 10px rgba(0,0,0,0.5); border:2px solid ${v.badgeBorder}; letter-spacing:0.05em;">
            ${v.badgeText}
          </div>
          <div style="font-size:0.92rem; color:#f0e2d2; font-weight:600;">${r.title}</div>
          <div style="font-size:0.78rem; color:#ad9e8e; margin-top:3px; line-height:1.4;">${r.description}</div>
          <div style="font-size:0.75rem; color:#c4a482; margin-top:4px; font-style:italic;">Origin unknown · Inspect clues below to identify</div>
        </div>
      </div>
    `,
    interactionContent: `
      <div class="space-y-4">
        <!-- Step 1 Outside Tile: Clues Inspection Grid -->
        <div class="p-4 bg-white border border-[var(--grid-border)] rounded-xs space-y-3">
          <div class="flex items-center gap-2 pb-2 border-b border-[var(--grid-border)]">
            <span class="w-6 h-6 rounded-full bg-[var(--accent-gold)] text-white text-xs font-bold flex items-center justify-center font-serif">1</span>
            <span class="text-xs uppercase tracking-wider text-[var(--text-primary)] font-bold">Step 1: Tap to check clues on this ${v.noun}</span>
          </div>
          <div class="flex gap-2 flex-wrap" id="clueRow">
            ${r.clues.map(c => `
              <button type="button" class="btn clue-btn ${inspectedClues[c.id] ? 'selected bg-amber-50/70 border-[var(--accent-gold)]' : 'bg-white border-[var(--grid-border)]'}" style="flex:1; min-width:120px; padding:8px 10px; font-size:0.8rem;" data-clue="${c.id}">
                🔍 ${c.label}
              </button>
            `).join('')}
          </div>
          <div id="clueNoteBox" class="text-xs sm:text-sm text-[var(--text-primary)] p-2.5 bg-[#faf8f5] rounded-xs border border-[var(--grid-border)]">
            ${lastClue ? `<b>${lastClue.label}:</b> ${lastClue.detail}` : 'Tap any clue button above to inspect physical details.'}
          </div>
        </div>

        <!-- Step 2 Outside Tile: Origin Attributions -->
        <div class="space-y-3">
          <div class="options-directive">
            <span>Step 2: Choose where this ${v.noun} came from:</span>
            <span style="font-size:0.75rem; color:var(--text-secondary);">Tap to select</span>
          </div>
          <div class="outside-options space-y-2.5">
            ${r.attributions.map((attr, idx) => {
              const bullet = String.fromCharCode(65 + idx);
              const isSelected = selectedAttribution === attr.id;
              return `
                <button type="button" class="outside-opt-card q2-attr ${isSelected ? 'selected' : ''}" data-attr="${attr.id}" tabindex="0">
                  <div class="opt-bullet">${bullet}</div>
                  <div style="flex:1;">
                    <div class="text-sm sm:text-base font-semibold text-[var(--text-primary)]">${attr.label}</div>
                    <div class="text-xs text-[var(--text-secondary)] mt-0.5">Origin ${bullet}</div>
                  </div>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `,
    summaryContent: `
      <span>${selectedAttribution ? `You selected: <strong class="text-[var(--text-primary)]">${r.attributions.find(a => a.id === selectedAttribution)?.label}</strong>` : 'Inspect clues and select an origin.'}</span>
      <span class="text-sm text-black">${currentTrial + 1} / ${relics.length}</span>
    `,
    actionButtonId: 'confirmQ2Btn',
    actionButtonText: currentTrial < relics.length - 1 ? 'Confirm Origin &rarr;' : 'Confirm & Finish &rarr;',
    actionButtonDisabled: !selectedAttribution,
    progressText: `Relic ${currentTrial + 1} of ${relics.length}`
  });

 app.querySelectorAll('.clue-btn').forEach(btn => {
 const inspect = (modality) => {
 lastInputModality = modality;
 const clueId = btn.getAttribute('data-clue');
 inspectedClues[clueId] = true;
 logEvent('clue_inspected', {
 trial_index: currentTrial,
 stimulus_id: r.stimulus_id,
 artifact_id: r.artifact_id,
 clue_id: clueId,
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });
 render();
 };

 btn.addEventListener('click', () => inspect('mouse'));
 btn.addEventListener('keydown', (e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 inspect('keyboard');
 }
 });
 });

 app.querySelectorAll('.q2-attr').forEach(opt => {
 const selectAttr = (modality) => {
 lastInputModality = modality;
 selectedAttribution = opt.getAttribute('data-attr');
 render();
 };

 opt.addEventListener('click', () => selectAttr('mouse'));
 opt.addEventListener('keydown', (e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 selectAttr('keyboard');
 }
 });
 });

 document.getElementById('confirmQ2Btn')?.addEventListener('click', () => {
 logEvent('investigation_finalized', {
 trial_index: currentTrial,
 stimulus_id: r.stimulus_id,
 artifact_id: r.artifact_id,
 attribution_choice: selectedAttribution,
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });

 if (currentTrial < relics.length - 1) {
 currentTrial++;
 inspectedClues = {};
 selectedAttribution = null;
 logArtifactPresented();
 render();
 scrollToTop();
 } else {
 onComplete({
 mini_game: 'Q2',
 observations_count: relics.length
 });
 }
 });
 }

 function logArtifactPresented() {
 const r = relics[currentTrial];
 logEvent('artifact_presented', {
 trial_index: currentTrial,
 stimulus_id: r.stimulus_id,
 artifact_id: r.artifact_id,
 uncertainty_level: r.uncertainty_level,
 expected_value: r.expected_value,
 task_def_version: '1.0'
 });
 }

 render();
}

// --------------------------------------------------------------------------
// Q3: Knowledge Integration (3 ambiguity/integration episodes)
// Optional context can be retrieved. Later decision requires integrating
// the retrieved insight rather than bare clicks.
// --------------------------------------------------------------------------
function runQ3KnowledgeIntegration(app, renderHeader, logEvent, onComplete) {
 let inTutorial = false;
 let currentEpisode = 0;
 let contextRetrieved = false;
 let selectedIntegrationChoice = null;
 let lastInputModality = 'mouse';

 const episodes = [
 {
 stimulus_id: 'Q3_E1',
 title: 'Episode 1: The Master Painter’s Folio',
 ambiguity_type: 'unattributed_artisan_folio',
 ambiguity_text: 'An illuminated folio has gold dust borders and charcoal sketches. Two master painters worked during this era.',
 context_id: 'provenance_context_1',
 context_title: 'Rainawari Workshop Records (1870–1885)',
 context_text: 'Records confirm Master Sadiq worked in Rainawari. He used willow-branch charcoal sketches and lapis blue borders.',
 decision_question: 'Attribute the folio maker and technique lineage:',
 choices: [
 { id: 'choice_sadiq_rainawari', label: 'Master Sadiq (Rainawari workshop — willow charcoal sketch)' },
 { id: 'choice_habib_court', label: 'Master Habib (Palace court — imported graphite pencil)' },
 { id: 'choice_generic_bazaar', label: 'General City Market Production' }
 ]
 },
 {
 stimulus_id: 'Q3_E2',
 title: 'Episode 2: The Exhibition Pavilion Ceiling',
 ambiguity_type: 'mismatched_period_provenance',
 ambiguity_text: 'A carved ceiling panel displays woodwork styles from two different rebuilding periods.',
 context_id: 'provenance_context_2',
 context_title: 'Dal Lake Pavilion Repair Notes (1902)',
 context_text: 'Following the 1902 Dal Lake flood, builders used seasoned cedar wood. Earlier builders used soft river pine.',
 decision_question: 'Identify the structural timber and repair era:',
 choices: [
 { id: 'choice_post_flood_cedar', label: 'Post-1902 Flood Repair (Seasoned mountain cedar wood)' },
 { id: 'choice_pre_flood_pine', label: 'Original Pre-Flood Building (Soft river pine wood)' },
 { id: 'choice_modern_concrete', label: 'Twentieth Century Replica' }
 ]
 },
 {
 stimulus_id: 'Q3_E3',
 title: 'Episode 3: The Woven Silk Couplet',
 ambiguity_type: 'regional_dialect_verse_origin',
 ambiguity_text: 'A woven silk pashmina scarf has an old Kashmiri verse embroidered on it.',
 context_id: 'provenance_context_3',
 context_title: 'Valley Poetry Records (Lalla-Ded Shrines)',
 context_text: 'Verses with this 4-beat pattern come from southern valley shrines (Pampore and Tral).',
 decision_question: 'Select the verified cultural origin of this verse:',
 choices: [
 { id: 'choice_southern_vakh_shrine', label: 'Southern Valley Shrine Verse (Traditional 4-beat rhythm)' },
 { id: 'choice_urban_court_ghazal', label: 'Palace Court Scribe Poem (Formal Persian rhyming meter)' },
 { id: 'choice_folk_bazaar_song', label: 'Traveling Caravan Folk Song' }
 ]
 }
 ];


 function render() {
 if (inTutorial) {
 app.innerHTML = `
 <div class="candidate-content-protected">
 <div class="flex items-center gap-2 mb-3">
 <span class="act-badge">World 5: The Hidden Gallery</span>
 
 </div>
 ${renderTutorialCard({
 icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>`,
 goal: 'Connect archival clues to solve catalog questions across 3 episodes.',
 steps: [
 'Read the historical question in each episode.',
 'Click to open the archival research note if you need facts.',
 'Select your catalog conclusion.',
 'Click confirm to finish World 5.'
 ]
 })}
 </div>
 `;
 bindTutorialCard(app, () => {
 inTutorial = false;
 currentEpisode = 0;
 contextRetrieved = false;
 selectedIntegrationChoice = null;
 logEpisodePresented();
 render();
 });
 return;
 }

 const ep = episodes[currentEpisode];

 app.innerHTML = `
 <div class="">
 <!-- TOP BAR -->
 <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
 <div class="flex items-center gap-2">
 <span class="act-badge">World 5: The Hidden Gallery</span>
 
 </div>
 </div>

 <!-- TASK HEADER -->
 <div class="mb-4">
 <h2 class="text-xl sm:text-2xl text-[var(--text-primary)]">The Weaver's Chronicle</h2>
 <p class="text-base text-black mt-0.5">Connect historical clues to solve catalog questions.</p>
 </div>

 <!-- YOUR TASK -->
 <div class="p-3 sm:p-4 bg-amber-50/70 border border-[var(--accent-gold)]/40 rounded-xs mb-4 candidate-content-protected">
 <div class="text-sm uppercase tracking-wider text-[var(--accent-gold)] font-semibold mb-1">Your Task</div>
 <div class="text-base text-[var(--text-primary)] leading-relaxed">
 Read the mystery below. You may open the reference note. Choose the best answer to continue.
 </div>
 </div>

 <!-- LOOK AT THIS -->
 <div class="p-4 sm:p-5 bg-white border border-[var(--grid-border)] mb-4 shadow-xs rounded-xs candidate-content-protected">
 <div class="flex items-center justify-between mb-2">
 <span class="text-sm uppercase tracking-wider text-[var(--accent-gold)] font-semibold">Historic Case</span>
 <span class="text-sm text-[var(--accent-gold)] uppercase font-medium">Case ${currentEpisode + 1} of 3</span>
 </div>
 <div class="text-sm sm:text-base font-semibold text-[var(--text-primary)]">${ep.title}</div>
 <div class="text-base text-black mt-1.5 leading-relaxed">${ep.ambiguity_text}</div>
 </div>

 <!-- INTERACTION AREA 1: Optional Context Retrieval -->
 <div class="p-4 bg-[#faf8f5] border border-[var(--grid-border)] mb-4 rounded-xs shadow-xs candidate-content-protected">
 <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
 <span class="text-sm uppercase text-[var(--accent-gold)] font-semibold tracking-wider">Archival Research Note</span>
 ${!contextRetrieved ? `
 <button type="button" id="retrieveContextBtn" class="px-4 py-2 bg-white border border-[var(--grid-border)] text-sm uppercase tracking-wider text-[var(--text-primary)] interactive-option rounded-xs shadow-xs min-h-[44px] flex items-center justify-center gap-1.5" tabindex="0">
 <span>Open Research Note</span> &rarr;
 </button>
 ` : '<span class="text-sm text-[var(--text-primary)] font-semibold uppercase">Note Opened</span>'}
 </div>

 ${contextRetrieved ? `
 <div class="p-3.5 bg-white border border-emerald-600/40 rounded-xs text-base text-[var(--text-primary)] leading-relaxed ">
 <div class="text-sm uppercase tracking-wider text-[var(--text-primary)] font-semibold mb-1">${ep.context_title}</div>
 <div>${ep.context_text}</div>
 </div>
 ` : `
 <div class="text-base text-black italic">
 Optional research notes are available to clarify historic details.
 </div>
 `}
 </div>

 <!-- YOUR CHOICE: Downstream Integration Decision -->
 <div class="p-4 sm:p-5 bg-white border border-[var(--grid-border)] mb-5 shadow-xs rounded-xs candidate-content-protected">
 <div class="text-sm text-black uppercase tracking-wider mb-2.5">${ep.decision_question}</div>
 <div class="space-y-2.5">
 ${ep.choices.map(c => `
 <div class="q3-choice p-3.5 bg-white border ${selectedIntegrationChoice === c.id ? 'border-[var(--accent-gold)] bg-amber-50/50 shadow-xs' : 'border-[var(--grid-border)]'} rounded-xs cursor-pointer interactive-option text-base flex items-center justify-between min-h-[48px]" data-choice="${c.id}" tabindex="0" role="button">
 <span class="flex items-center gap-2.5">
 <span class="w-4 h-4 rounded-full border border-current flex items-center justify-center text-sm shrink-0 ${selectedIntegrationChoice === c.id ? 'bg-[var(--accent-gold)] text-white' : 'text-stone-300'}">${selectedIntegrationChoice === c.id ? '✓' : ''}</span>
 <span class="text-[var(--text-primary)] font-medium">${c.label}</span>
 </span>
 <span class="text-sm text-[var(--accent-gold)] uppercase font-medium shrink-0">Format ${c.id.replace('CHOICE_', '')}</span>
 </div>
 `).join('')}
 </div>
 </div>

 <!-- PRIMARY ACTION BUTTON -->
 <div class="flex justify-end mb-4">
 <button type="button" id="confirmQ3Btn" ${selectedIntegrationChoice ? '' : 'disabled'} class="px-7 py-3.5 bg-[var(--text-primary)] text-white text-base uppercase tracking-widest disabled:opacity-40 interactive-option shadow-sm rounded-xs w-full sm:w-auto min-h-[44px]">
 ${currentEpisode < episodes.length - 1 ? 'Confirm Choice &rarr;' : 'Finish World 5 &rarr;'}
 </button>
 </div>

 <!-- Progress Footer -->
 <div class="text-right text-[11px] text-black ">
 Episode ${currentEpisode + 1} of ${episodes.length}
 </div>
 </div>
 `;

 document.getElementById('retrieveContextBtn')?.addEventListener('click', () => {
 lastInputModality = 'mouse';
 contextRetrieved = true;
 logEvent('context_requested', {
 trial_index: currentEpisode,
 stimulus_id: ep.stimulus_id,
 context_id: ep.context_id,
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });
 render();
 });

 app.querySelectorAll('.q3-choice').forEach(choice => {
 const selectChoice = (modality) => {
 lastInputModality = modality;
 selectedIntegrationChoice = choice.getAttribute('data-choice');
 render();
 };

 choice.addEventListener('click', () => selectChoice('mouse'));
 choice.addEventListener('keydown', (e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 selectChoice('keyboard');
 }
 });
 });

 document.getElementById('confirmQ3Btn')?.addEventListener('click', () => {
 logEvent('decision_submitted', {
 trial_index: currentEpisode,
 stimulus_id: ep.stimulus_id,
 choice: selectedIntegrationChoice,
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });

 if (currentEpisode < episodes.length - 1) {
 currentEpisode++;
 contextRetrieved = false;
 selectedIntegrationChoice = null;
 logEpisodePresented();
 render();
 scrollToTop();
 } else {
 onComplete({
 mini_game: 'Q3',
 observations_count: 3
 });
 }
 });
 }

 function logEpisodePresented() {
 const ep = episodes[currentEpisode];
 logEvent('episode_presented', {
 trial_index: currentEpisode,
 stimulus_id: ep.stimulus_id,
 ambiguity_type: ep.ambiguity_type,
 task_def_version: '1.0'
 });
 }

 render();
}
