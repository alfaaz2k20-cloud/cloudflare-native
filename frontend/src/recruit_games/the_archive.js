/* ==========================================================================
 ALFAAZ RECRUIT — WORLD 2: THE ARCHIVE (دستاویز)
 Mini-games: A1 (The Manuscript Folios), A2 (The Fragile Leaf), A3 (The Exhibition Ledger)
 Plain language remediation for human playtest pass 1.
 Sentences <= 12 words. Simple conversational English. Jargon removed.
 Preserves raw behavioral telemetry emissions and exact stimulus/action IDs.
 ========================================================================== */

import { renderTutorialCard, bindTutorialCard, renderGameShell, scrollToTop } from './index.js';

export function runTheArchive(context, renderHeader) {
 const { appContainer, miniGameIndex, gameId, logEvent, onMiniGameComplete, worldIndex } = context;

 const targetGame = gameId || (miniGameIndex === 0 ? 'A1' : (miniGameIndex === 1 ? 'A2' : 'A3'));
 if (targetGame === 'A1') {
 runA1Classification(appContainer, renderHeader, logEvent, onMiniGameComplete, worldIndex);
 } else if (targetGame === 'A2') {
 runA2ExceptionHandling(appContainer, renderHeader, logEvent, onMiniGameComplete, worldIndex);
 } else {
 runA3QualityControl(appContainer, renderHeader, logEvent, onMiniGameComplete, worldIndex);
 }
}

// --------------------------------------------------------------------------
// A1: The Manuscript Folios (5 rule-governed classification items)
// --------------------------------------------------------------------------
function runA1Classification(app, renderHeader, logEvent, onComplete, worldIndex = 1) {
 let inTutorial = false;
 let currentDocIdx = 0;
 let guideOpened = false;
 let selectedFolder = null;
 let docStartTime = 0;
 let lastInputModality = 'mouse';

 const documents = [
 {
 id: 'DOC_01',
 title: 'Old Calligraphy Book (1842)',
 rule_prompt: 'Sorting Rule: Sort by Century',
 tags: ['Year: 1842', '19th Century', 'Handmade Paper', 'Poem Verse']
 },
 {
 id: 'DOC_02',
 title: 'Poetry Song Book',
 rule_prompt: 'Sorting Rule: Sort by Type',
 tags: ['Type: Poetry', 'Song Verses', 'Urdu', 'Paper Pages']
 },
 {
 id: 'DOC_03',
 title: 'Exhibition Visitor Book (1924)',
 rule_prompt: 'Sorting Rule: Sort by Century',
 tags: ['Year: 1924', '20th Century', 'Visitor List', 'Signatures']
 },
 {
 id: 'DOC_04',
 title: 'Lal Ded Verses in Kashmiri',
 rule_prompt: 'Sorting Rule: Sort by Language',
 tags: ['Language: Kashmiri', 'Wise Verses', 'Local Poetry']
 }
 ];

 const folders = [
 { id: '19th_century', label: '19th Century Shelf', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
 { id: '20th_century', label: '20th Century Shelf', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
 { id: 'poetry', label: 'Poetry Shelf', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
 { id: 'chronicle', label: 'History Shelf', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
 { id: 'kashmiri', label: 'Kashmiri Language Shelf', icon: 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129' }
 ];

 function render() {
 if (inTutorial) {
 app.innerHTML = `
 <div class="candidate-content-protected max-w-2xl mx-auto">
 ${renderHeader('The Manuscript Folios', 'Sort each historical page onto its proper shelf.')}
 ${renderTutorialCard({
 icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>`,
 goal: 'File each document onto the correct shelf across 5 rounds.',
 steps: [
 'Check the date and description on each document card.',
 'Click the matching shelf to file it.',
 'Open the shelf guide anytime if you need a reminder.'
 ]
 })}
 </div>
 `;
 bindTutorialCard(app, () => {
 inTutorial = false;
 currentDocIdx = 0;
 selectedFolder = null;
 docStartTime = performance.now();
 render();
 });
 return;
 }

 if (currentDocIdx >= documents.length) {
 onComplete({
 mini_game: 'A1',
 observations_count: documents.length
 });
 return;
 }

 const doc = documents[currentDocIdx];
 docStartTime = performance.now();

 const stimulusContent = `
    <div class="p-5 sm:p-6 bg-[#faf8f5] border-l-4 border-l-[var(--accent-gold)] border border-[var(--grid-border)] rounded-xs shadow-xs space-y-2">
      <div class="flex justify-between items-start mb-1">
        <span class="text-xs uppercase tracking-wider text-[var(--accent-gold)] font-bold">Folio ${currentDocIdx + 1} of ${documents.length}</span>
        <button id="guideBtn" type="button" class="text-xs text-[var(--accent-gold)] border border-[var(--accent-gold)]/40 px-2.5 py-1 interactive-option flex items-center gap-1.5 rounded-xs min-h-[32px] bg-white ${guideOpened ? '' : 'pulse-btn'}" tabindex="0">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          ${guideOpened ? 'Close Guide' : 'Shelf Guide'}
        </button>
      </div>

      <div id="guideModal" class="${guideOpened ? '' : 'hidden'} p-3 mb-2 bg-amber-50/80 border border-[var(--accent-gold)]/40 text-xs text-[var(--text-primary)] space-y-1 rounded-xs">
        <div>&bull; <strong>Century Rule:</strong> Sort by century made (19th vs 20th Century).</div>
        <div>&bull; <strong>Type Rule:</strong> Sort by content type (Poetry vs History).</div>
        <div>&bull; <strong>Language Rule:</strong> Sort by language (Kashmiri).</div>
      </div>

      <h3 class="text-base sm:text-lg font-serif text-[var(--text-primary)] font-semibold leading-relaxed">${doc.title}</h3>
      <div class="flex flex-wrap gap-2 pt-1">
        ${doc.tags.map(t => `<span class="px-2.5 py-1 bg-white border border-[var(--grid-border)] text-xs text-[var(--text-primary)] font-medium rounded-xs">${t}</span>`).join('')}
      </div>
    </div>
  `;

 const activeFolder = folders.find(f => f.id === selectedFolder);

 const interactionContent = `
 <div>
 <div class="text-base uppercase tracking-wider text-black mb-2 ">Select Destination Shelf:</div>
 <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
 ${folders.map(f => {
 const isSelected = selectedFolder === f.id;
 return `
 <button type="button" class="folder-btn p-3.5 bg-white border ${isSelected ? 'border-[var(--accent-gold)] bg-amber-50/70 shadow-xs ring-1 ring-[var(--accent-gold)]/40' : 'border-[var(--grid-border)]'} text-base font-semibold interactive-option text-left flex items-center justify-between rounded-xs min-h-[48px]" data-folder="${f.id}" tabindex="0">
 <span class="flex items-center gap-2.5">
 <span class="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center text-[9px] ${isSelected ? 'bg-[var(--accent-gold)] text-white' : 'text-stone-300'}">${isSelected ? '✓' : ''}</span>
 <span class="text-[var(--text-primary)]">${f.label}</span>
 </span>
 <svg class="w-4 h-4 text-[var(--accent-gold)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${f.icon}"></path></svg>
 </button>
 `;
 }).join('')}
 </div>
 </div>
 `;

 const summaryContent = `
 <span>${selectedFolder ? `Selected shelf: <strong class="text-[var(--text-primary)]">${activeFolder?.label}</strong>` : 'Select a shelf above, then click Confirm.'}</span>
 <span class="text-sm text-black ">${currentDocIdx + 1} / ${documents.length}</span>
 `;

 app.innerHTML = renderGameShell({
 worldCode: 'W2',
 worldIndex,
 title: 'The Manuscript Folios',
 subtitle: 'Sort each historical page onto its proper shelf.',
 instructionPrompt: 'Your Task',
    instruction: `Pick the shelf below that matches this page (${doc.rule_prompt}).`,
 stimulusContent,
 interactionContent,
 summaryContent,
 actionButtonId: 'confirmShelfBtn',
 actionButtonText: currentDocIdx < documents.length - 1 ? 'Confirm Shelf &rarr;' : 'Confirm & Finish &rarr;',
 actionButtonDisabled: !selectedFolder,
 progressText: `Page ${currentDocIdx + 1} of ${documents.length}`
 });

 logEvent('item_presented', {
 trial_index: currentDocIdx,
 stimulus_id: doc.id,
 task_def_version: '1.0'
 });

 document.getElementById('guideBtn')?.addEventListener('click', () => {
 guideOpened = !guideOpened;
 render();
 logEvent('guide_viewed', {
 trial_index: currentDocIdx,
 stimulus_id: doc.id,
 task_def_version: '1.0'
 });
 });

 app.querySelectorAll('.folder-btn').forEach(btn => {
 const handleSelect = (modality) => {
 lastInputModality = modality;
 selectedFolder = btn.getAttribute('data-folder');
 render();
 };

 btn.addEventListener('click', () => handleSelect('mouse'));
 btn.addEventListener('keydown', (e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 handleSelect('keyboard');
 }
 });
 });

 document.getElementById('confirmShelfBtn')?.addEventListener('click', () => {
 if (!selectedFolder) return;
 logEvent('item_sorted', {
 trial_index: currentDocIdx,
 stimulus_id: doc.id,
 choice: selectedFolder,
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });

 currentDocIdx++;
    selectedFolder = null;
    render();
    scrollToTop();
 });
 }

 render();
}

// --------------------------------------------------------------------------
// A2: The Fragile Leaf (>= 3 genuine exception decisions)
// Conditions: true_exception, clean_control, true_exception
// --------------------------------------------------------------------------
function runA2ExceptionHandling(app, renderHeader, logEvent, onComplete, worldIndex = 1) {
 let inTutorial = false;
 let currentTrial = 0;
 let chosenAction = null;
 let lastInputModality = 'mouse';

 const trials = [
 {
 stimulus_id: 'EXC_01',
 title: 'Kashmiri Poetry Page with Water Wear',
 anomaly_description: 'Water fading on lower margin. The accession year stamp is blurred and appears as "18--".',
 type_note: 'Physical Damage & Blurred Year'
 },
 {
 stimulus_id: 'EXC_02',
 title: 'Clean Calligraphy Page (1890)',
 anomaly_description: 'The paper is clean, smooth, and strong. The black ink is clear with no stains or marks.',
 type_note: 'Clean Page Inspection'
 },
 {
 stimulus_id: 'EXC_03',
 title: 'Loose Book Page with Number Jump',
 anomaly_description: 'The binding threads are broken. The page numbers skip directly from page 14 to page 19.',
 type_note: 'Missing Pages & Loose Thread'
 },
 {
 stimulus_id: 'EXC_04',
 title: 'Story Page with Split Binding',
 anomaly_description: 'The middle fold is split down the center, and the red stamp is upside down.',
 type_note: 'Broken Spine & Upside-Down Stamp'
 }
 ];


 const actions = [
 {
 id: 'flag_exception',
 title: 'Flag for Special Repair',
 desc: 'Place page in a clean protective folder for careful repair.',
 tag: 'Special Repair'
 },
 {
 id: 'file_standard',
 title: 'Place on Regular Shelf',
 desc: 'Place page directly onto the standard open shelves.',
 tag: 'Regular Shelf'
 },
 {
 id: 'defer_review',
 title: 'Hold in Storage Box',
 desc: 'Hold page safely in storage until more background notes arrive.',
 tag: 'Hold in Box'
 }
 ];

 function render() {
 if (inTutorial) {
 app.innerHTML = `
 <div class="candidate-content-protected max-w-2xl mx-auto">
 ${renderHeader('The Fragile Leaf', 'Examine the page condition and choose a handling step.')}
 ${renderTutorialCard({
 icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>`,
 goal: 'Check the condition of 4 pages and choose how to handle them.',
 steps: [
 'Look at the condition notes on the page.',
 'Decide if the page is clean or damaged.',
 'Choose whether to file normally, quarantine for repair, or consult.'
 ]
 })}
 </div>
 `;
 bindTutorialCard(app, () => {
 inTutorial = false;
 currentTrial = 0;
 chosenAction = null;
 render();
 });
 return;
 }

 const t = trials[currentTrial];
 const activeAct = actions.find(a => a.id === chosenAction);

 const stimulusContent = `
    <div class="p-5 sm:p-6 bg-[#faf8f5] border-l-4 border-l-[var(--accent-gold)] border border-[var(--grid-border)] rounded-xs shadow-xs space-y-2">
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs uppercase tracking-wider text-[var(--accent-gold)] font-bold">${t.title}</span>
        <span class="text-xs text-[var(--text-secondary)] uppercase bg-white px-2 py-0.5 border border-[var(--grid-border)] rounded-xs">${t.type_note}</span>
      </div>
      <p class="text-base sm:text-lg font-serif text-[var(--text-primary)] leading-relaxed">
        ${t.anomaly_description}
      </p>
    </div>
  `;

 const interactionContent = `
 <div class="space-y-2.5">
 <div class="text-base uppercase tracking-wider text-black mb-1 ">Choose handling action:</div>
 ${actions.map(a => `
 <div class="a2-opt p-3.5 bg-white border ${chosenAction === a.id ? 'border-[var(--accent-gold)] bg-amber-50/70 shadow-xs ring-1 ring-[var(--accent-gold)]/40' : 'border-[var(--grid-border)]'} cursor-pointer interactive-option rounded-xs min-h-[52px]" data-action="${a.id}" tabindex="0" role="button">
 <div class="flex justify-between items-center mb-0.5">
 <div class="text-base font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
 <span class="w-2 h-2 rounded-full ${chosenAction === a.id ? 'bg-[var(--accent-gold)]' : 'bg-stone-300'}"></span>
 ${a.title}
 </div>
 </div>
 <div class="text-[11px] text-black leading-relaxed pl-3.5">${a.desc}</div>
 </div>
 `).join('')}
 </div>
 `;

 const summaryContent = `
 <span>${chosenAction ? `You selected: <strong class="text-[var(--text-primary)]">${activeAct?.title}</strong>` : 'Select an option above to continue.'}</span>
 <span class="text-sm text-black ">${currentTrial + 1} / 4</span>
 `;

 app.innerHTML = renderGameShell({
 worldCode: 'W2',
 worldIndex,
 title: 'The Fragile Leaf',
 subtitle: 'Examine page condition and choose a handling step.',
 instructionPrompt: 'Your Task',
    instruction: 'Check the condition notes above. Choose how you want to handle this page below.',
 stimulusContent,
 interactionContent,
 summaryContent,
 actionButtonId: 'a2ConfirmBtn',
 actionButtonText: currentTrial < 3 ? 'Confirm Choice &rarr;' : 'Confirm & Finish &rarr;',
 actionButtonDisabled: !chosenAction,
 progressText: `Folio ${currentTrial + 1} of 4`
 });

 logEvent('item_presented', {
 trial_index: currentTrial,
 stimulus_id: t.stimulus_id,
 task_def_version: '1.0'
 });

 const btn = document.getElementById('a2ConfirmBtn');

 app.querySelectorAll('.a2-opt').forEach(opt => {
 const handleSelect = (modality) => {
 lastInputModality = modality;
 chosenAction = opt.getAttribute('data-action');
 render();
 };

 opt.addEventListener('click', () => handleSelect('mouse'));
 opt.addEventListener('keydown', (e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 handleSelect('keyboard');
 }
 });
 });

 btn?.addEventListener('click', () => {
 logEvent('decision_logged', {
 trial_index: currentTrial,
 stimulus_id: t.stimulus_id,
 action_id: chosenAction,
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });

  if (currentTrial < 3) {
  currentTrial++;
  chosenAction = null;
  render();
  scrollToTop();
  } else {
 onComplete({
 mini_game: 'A2',
 observations_count: 4
 });
 }
 });
 }

 render();
}

// --------------------------------------------------------------------------
// A3: The Exhibition Ledger (5 display cards)
// --------------------------------------------------------------------------
function runA3QualityControl(app, renderHeader, logEvent, onComplete) {
 let inTutorial = false;
 let flaggedRecords = new Set();
 let inspectedRecords = new Set();
 let lastInputModality = 'mouse';

 const records = [
 {
 id: 'REC_01',
 title: 'Card 1: Habba Khatoon Poem',
 text: 'Poet: Habba Khatoon | Era: 16th Century | Birthplace: Chandhara (Recorded as: Chanhadra)',
 note: 'Folio Label Verification'
 },
 {
 id: 'REC_02',
 title: 'Card 2: Carved Walnut Pen Box',
 text: 'Artifact: Carved Walnut Calligraphy Pen Box | Dimensions: 24 cm x 6 cm | Medium: Seasoned Walnut',
 note: 'Object Metadata Verification'
 },
 {
 id: 'REC_03',
 title: 'Card 3: River Verse Excerpt',
 text: 'Verse Excerpt: "The river remembers the boatman\'s song" | Translator: [Not Specified / Blank]',
 note: 'Folio Label Verification'
 },
 {
 id: 'REC_04',
 title: 'Card 4: Kashmiri Vakh Lyric Leaf',
 text: 'Folio Leaf: Kashmiri Vakh Lyric Leaf | Script: Sharda & Persian | Accession: AR-1892',
 note: 'Manuscript Leaf Verification'
 },
 {
 id: 'REC_05',
 title: 'Card 5: Exhibition Opening Notice',
 text: 'Exhibition Opening Reception: February 31st, 2026 | Location: Main Pavilion',
 note: 'Public Schedule Verification'
 }
 ];

 function render() {
 if (inTutorial) {
 app.innerHTML = `
 <div class="candidate-content-protected max-w-2xl mx-auto">
 ${renderHeader('The Exhibition Ledger', 'Review 5 display cards for factual mistakes.')}
 ${renderTutorialCard({
 icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>`,
 goal: 'Carefully proofread all 5 display records. Flag only those with clear errors.',
 steps: [
 'Read each display card carefully.',
 'Click the flag button on any card that contains an error.',
 'Clean cards should remain unflagged.',
 'Click verify when finished.'
 ]
 })}
 </div>
 `;
 bindTutorialCard(app, () => {
 inTutorial = false;
 flaggedRecords = new Set();
 inspectedRecords = new Set();
 render();
 });
 return;
 }

 app.innerHTML = `
 <div class="max-w-2xl mx-auto">
 <!-- TOP BAR -->
 <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 pb-2 border-b border-[var(--grid-border)]">
 <div class="flex items-center gap-2">
 <span class="act-badge">World 2: The Archive</span>
 
 </div>
 </div>

 <!-- TASK HEADER -->
 <div class="mb-4">
 <h2 class="text-xl sm:text-2xl text-[var(--text-primary)]">The Exhibition Ledger</h2>
 <p class="text-base text-black mt-0.5">Proofread all 5 display cards. Flag any card that has an error.</p>
 </div>

 <!-- YOUR TASK -->
 <div class="p-3 sm:p-4 bg-amber-50/70 border border-[var(--accent-gold)]/40 rounded-xs mb-4 candidate-content-protected">
 <div class="text-sm uppercase tracking-wider text-[var(--accent-gold)] font-semibold mb-1">Your Task</div>
 <div class="text-base text-[var(--text-primary)] leading-relaxed">
 Read all 5 display cards. Click flag if a card has a mistake. Leave clean cards unflagged.
 </div>
 </div>

 <!-- LOOK AT THIS & INTERACTION AREA -->
 <div class="space-y-3 mb-5 candidate-content-protected">
 ${records.map((r, idx) => {
 const isFlagged = flaggedRecords.has(r.id);
 return `
 <div class="record-card p-4 bg-white border ${isFlagged ? 'border-[var(--text-primary)] bg-amber-50/20' : 'border-[var(--grid-border)]'} rounded-xs interactive-option shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3" data-id="${r.id}" tabindex="0">
 <div class="space-y-1 flex-1">
 <div class="flex items-center gap-2">
 <span class="text-sm text-[var(--accent-gold)] uppercase tracking-wider font-semibold">Ledger Card ${idx + 1} of 5</span>
 </div>
 <div class="text-base font-semibold text-[var(--text-primary)]">${r.title}</div>
 <div class="text-base text-black leading-relaxed bg-[#faf8f5] p-2.5 border border-[var(--grid-border)]/60 rounded-xs mt-1">
 ${r.text}
 </div>
 </div>

 <button type="button" class="toggle-flag-btn px-4 py-2.5 border text-base uppercase tracking-wider shrink-0 interactive-option rounded-xs min-h-[44px] w-full sm:w-auto ${isFlagged ? 'bg-[var(--text-primary)] text-white border-[var(--text-primary)]' : 'bg-white text-black border-[var(--grid-border)] '}" data-id="${r.id}">
 ${isFlagged ? 'Mistake Flagged ✓' : 'Flag Mistake'}
 </button>
 </div>
 `;
 }).join('')}
 </div>

 <!-- YOUR CHOICE -->
 <div class="p-3 bg-white border border-[var(--grid-border)] rounded-xs mb-4 text-base text-black flex justify-between items-center">
 <span>Cards flagged: <strong class="text-[var(--text-primary)]">${flaggedRecords.size} of 5</strong></span>
 <span class="text-sm text-black ">Clean cards remain unflagged</span>
 </div>

 <!-- PRIMARY ACTION BUTTON -->
 <div class="flex justify-end">
 <button id="a3SubmitBtn" class="w-full sm:w-auto px-7 py-3 bg-[var(--text-primary)] text-white text-base uppercase tracking-widest interactive-option shadow-sm rounded-xs min-h-[44px]">
 Verify and Complete World 2 &rarr;
 </button>
 </div>
 </div>
 `;

 // Track record inspection events
 app.querySelectorAll('.record-card').forEach((card, idx) => {
 const recId = card.getAttribute('data-id');
 const inspect = () => {
 if (!inspectedRecords.has(recId)) {
 inspectedRecords.add(recId);
 logEvent('record_inspected', {
 trial_index: idx,
 stimulus_id: recId,
 task_def_version: '1.0'
 });
 }
 };

 card.addEventListener('focus', inspect);
 card.addEventListener('mouseenter', inspect);
 });

 // Toggle discrepancy buttons
 app.querySelectorAll('.toggle-flag-btn').forEach((btn, idx) => {
 const recId = btn.getAttribute('data-id');
 const toggle = (modality) => {
 lastInputModality = modality;
 const nowFlagged = !flaggedRecords.has(recId);
 if (nowFlagged) {
 flaggedRecords.add(recId);
 } else {
 flaggedRecords.delete(recId);
 }

 logEvent('discrepancy_toggled', {
 trial_index: idx,
 stimulus_id: recId,
 flagged_state: nowFlagged,
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });

 render();
 };

 btn.addEventListener('click', () => toggle('mouse'));
 btn.addEventListener('keydown', (e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 toggle('keyboard');
 }
 });
 });

 document.getElementById('a3SubmitBtn')?.addEventListener('click', () => {
 logEvent('verification_finalized', {
 action_id: 'approve_ledger',
 input_modality: lastInputModality,
 task_def_version: '1.0'
 });

 onComplete({
 mini_game: 'A3',
 observations_count: records.length
 });
 });
 }

 render();
}
