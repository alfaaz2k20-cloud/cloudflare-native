// admin.js — Centralized Administration Logic
document.addEventListener('DOMContentLoaded', () => {
 const userData = localStorage.getItem('alfaaz_user');
 if (!userData) {
 window.location.href = 'login.html?redirect=admin.html';
 return;
 }

 let user;
 try {
 user = JSON.parse(userData);
 } catch (error) {
 localStorage.removeItem('alfaaz_user');
 window.location.href = 'login.html?redirect=admin.html';
 return;
 }

 if (!user || user.status !== 'ADMIN') {
 window.location.href = 'dashboard.html';
 return;
 }

 const logoutBtn = document.getElementById('logoutBtn');
 if (logoutBtn) {
 logoutBtn.addEventListener('click', () => { localStorage.clear(); window.location.href = 'login.html'; });
 }

 const tabLoaded = {};
 window.switchTab = function(name) {
 document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
 document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
 const targetBtn = document.querySelector(`[onclick="switchTab('${name}')"]`);
 if (targetBtn) targetBtn.classList.add('active');
 const targetPanel = document.getElementById(`tab-${name}`);
 if (targetPanel) targetPanel.classList.add('active');
 if (!tabLoaded[name]) { tabLoaded[name] = true; loadTab(name); }
 };

 function loadTab(name) {
 if (name === 'events') window.loadEvents();
 if (name === 'exhibitions') { window.loadExhibitionManager(); window.loadExhibitionsData('ALL'); }
 if (name === 'clubs') window.loadClubs('ALL');
 if (name === 'roster') window.loadRoster();
 if (name === 'submissions') window.loadSubmissions();
 if (name === 'diagnostics') window.checkEmailStatus();
 if (name === 'recruitment') { if (typeof window.loadRecruitment === 'function') window.loadRecruitment(); else window.location.href = 'research.html'; }
 }

 // ==========================================
 // EVENTS LOGIC
 // ==========================================
 let allEvents = [];
 window.loadEvents = async function() {
 const container = document.getElementById('eventsContainer');
 if(!container) return;
 try {
 const res = await window.globalApiFetch('/admin/events');
 if(!res) return;
 allEvents = await res.json();
 if (!allEvents.length) { container.innerHTML = '<div class="empty-state">No events found.</div>'; return; }
 container.innerHTML = '';
 allEvents.forEach(e => {
 const card = document.createElement('div'); card.className = 'data-card event-card';
 const isOpen = e.registration_open; const capLabel = e.capacity === 0 ? '∞' : `${e.registered}/${e.capacity}`;
 const safeName = window.escapeHtml(e.name);
 const safeDesc = window.escapeHtml(e.description || '—');
 const safeDate = window.escapeHtml(e.event_date || '—');
 card.innerHTML = `
 <div><div class="data-label">Event</div><div class="data-display">${safeName}</div><div style="font-size:11px; color:var(--text-secondary); margin-top: 4px;">${safeDesc}</div></div>
 <div><div class="data-label">Date</div><div class="data-display" style="font-size:12px;">${safeDate}</div></div>
 <div><div class="data-label">Registered</div><div class="data-display">${capLabel}</div></div>
 <div><div class="data-label">Status</div><span class="badge ${isOpen ? 'badge-open' : 'badge-closed'}">${isOpen ? 'Open' : 'Closed'}</span></div>
 <div style="display:flex; flex-direction:column; gap:0.6rem;">
 <button class="action-btn ${isOpen ? '' : 'gold'}" style="padding: 0.6rem; font-size:9px;" data-action="toggle-event" data-id="${e.id}">${isOpen ? 'Close Registration' : 'Open Registration'}</button>
 <button class="action-btn gold" style="padding: 0.6rem; font-size:9px;" data-action="view-registrations" data-id="${e.id}">View List</button>
 <button class="action-btn" style="padding: 0.6rem; font-size:9px; border-color:var(--accent-red); color:var(--accent-red-text);" data-action="delete-event" data-id="${e.id}" data-name="${safeName}">Delete</button>
 </div>`;
 container.appendChild(card);
 });

 if (!container.dataset.actionsBound) {
 container.dataset.actionsBound = '1';
 container.addEventListener('click', (ev) => {
 const btn = ev.target.closest('button[data-action]');
 if (!btn || !container.contains(btn)) return;
 const id = Number(btn.dataset.id);
 if (!Number.isFinite(id)) return;
 const action = btn.dataset.action;
 if (action === 'toggle-event') window.toggleEvent(id, btn);
 else if (action === 'view-registrations') window.viewRegistrations(id);
 else if (action === 'delete-event') window.deleteEvent(id, btn.dataset.name || 'this event', btn);
 });
 }

 if(window.refreshGlobalEffects) window.refreshGlobalEffects();
 } catch (e) { container.innerHTML = '<div class="empty-state">Error loading events.</div>'; }
 };

 window.handleCreateEvent = async function() {
 const name = document.getElementById('ev-name').value.trim(), date = document.getElementById('ev-date').value.trim(), capacity = parseInt(document.getElementById('ev-capacity').value) || 0, desc = document.getElementById('ev-desc').value.trim(), msg = document.getElementById('ev-create-msg');
 if (!name) return;
 if (msg) msg.textContent = 'Creating...';
 try {
 const res = await window.globalApiFetch('/admin/events/create', { method: 'POST', body: JSON.stringify({ name, description: desc, event_date: date, capacity }) });
 if (res && res.ok) {
 if (msg) msg.textContent = '✓ Created.';
 window.loadEvents();
 } else {
 const err = await res?.json().catch(() => ({}));
 if (msg) msg.textContent = err.error || err.detail || 'Could not create the event.';
 }
 } catch (err) {
 console.error('[Create event error]', err);
 if (msg) msg.textContent = 'Could not reach the server. Please try again.';
 }
 };
 window.toggleEvent = async function(id, btn) {
 const original = btn ? btn.textContent : '';
 if (btn) btn.textContent = '...';
 try {
 const res = await window.globalApiFetch(`/admin/events/${id}/toggle`, { method: 'PATCH' });
 if (res && res.ok) { window.loadEvents(); return; }
 const err = await res?.json().catch(() => ({}));
 if (btn) btn.textContent = original;
 alert(err.error || err.detail || 'Could not update registration status.');
 } catch (err) {
 console.error('[Toggle event error]', err);
 if (btn) btn.textContent = original;
 alert('Could not reach the server. Please try again.');
 }
 };
 window.deleteEvent = async function(id, name, btn) {
 if (!confirm(`Delete ${name}?`)) return;
 const original = btn ? btn.textContent : '';
 if (btn) btn.textContent = '...';
 try {
 const res = await window.globalApiFetch(`/admin/events/${id}`, { method: 'DELETE' });
 if (res && res.ok) { window.loadEvents(); return; }
 const err = await res?.json().catch(() => ({}));
 if (btn) btn.textContent = original;
 alert(err.error || err.detail || 'Could not delete the event.');
 } catch (err) {
 console.error('[Delete event error]', err);
 if (btn) btn.textContent = original;
 alert('Could not reach the server. Please try again.');
 }
 };

 window.viewRegistrations = async function(id) {
 const event = allEvents.find(e => e.id === id); document.getElementById('modalTitle').textContent = event.name; document.getElementById('modalBody').innerHTML = 'Loading...'; document.getElementById('regModal').classList.add('open');
 const res = await window.globalApiFetch(`/admin/events/${id}/registrations`);
 if(!res) return;
 const data = await res.json();
 let html = `<div style="font-size:12px; margin-bottom:1.5rem; color:var(--accent-gold-text); font-weight:600; letter-spacing: 1px; text-transform: uppercase;">Total Approved: ${data.registrations.length}</div>`;
 data.registrations.forEach((r, i) => {
 const safeEmail = window.escapeHtml(r.email);
 const safeWa = r.whatsapp ? 'WA: ' + window.escapeHtml(r.whatsapp) : 'No WA provided';
 html += `<div style="padding:1rem 0; border-bottom:1px solid var(--grid-border); font-size:13px; display:flex; justify-content:space-between; align-items: center;"><span><strong style="color: var(--accent-gold-text); margin-right: 10px;">${i+1}.</strong> ${safeEmail}</span><span style="color:var(--text-primary); font-size: 11px; background: var(--bg-primary); padding: 4px 10px; border-radius: 2px;">${safeWa}</span></div>`;
 });
 document.getElementById('modalBody').innerHTML = html || '<div class="empty-state">No registrations.</div>';
 };
 window.closeModal = function() { document.getElementById('regModal').classList.remove('open'); };

 // ==========================================
 // EXHIBITIONS LOGIC (TRUE EVENTS MODEL)
 // ==========================================
 let allExhibs = [], activeCycleFilter = 'ALL';
 let currentCycleView = 'ALL';

 window.loadExhibitionManager = async function() {
 const res = await window.globalApiFetch('/admin/exhibitions/list');
 if (!res || !res.ok) return;

 const exhibitions = await res.json();
 const container = document.getElementById('exhibitionListContainer');
 const statusText = document.getElementById('portalLiveStatus');
 if(!container) return;
 container.innerHTML = '';

 if (!container.dataset.actionsBound) {
 container.dataset.actionsBound = '1';
 container.addEventListener('click', (ev) => {
 const btn = ev.target.closest('button[data-action="activate-exhibition"]');
 if (!btn || !container.contains(btn)) return;
 const id = Number(btn.dataset.id);
 if (!Number.isFinite(id)) return;
 window.activateExhibition(id, btn.dataset.title || 'this exhibition');
 });
 }

 const liveEx = exhibitions.find(e => e.is_active);
 if (liveEx) {
 if (statusText) statusText.innerHTML = `Currently Live: <strong style="color: var(--accent-green-text);">${window.escapeHtml(liveEx.title)}</strong>`;
 } else {
 if (statusText) statusText.innerHTML = `<strong style="color: var(--accent-red-text);">CLOSED</strong> (No active exhibition)`;
 }

 if (exhibitions.length === 0) {
 container.innerHTML = '<div style="font-size: 12px; color: var(--text-secondary);">No exhibitions created yet.</div>';
 return;
 }

 exhibitions.forEach(ex => {
 const card = document.createElement('div');
 card.style.cssText = `border: 1px solid ${ex.is_active ? 'var(--accent-gold)' : 'var(--grid-border)'}; padding: 1.5rem; background: ${ex.is_active ? 'var(--bg-primary)' : 'transparent'}; transition: all 0.3s;`;

 const statusBadge = ex.is_active
 ? `<span style="font-size: 9px; padding: 3px 8px; background: var(--accent-gold); color: #fff; letter-spacing: 1px; text-transform: uppercase;">Live Now</span>`
 : `<span style="font-size: 9px; padding: 3px 8px; border: 1px solid var(--grid-border); color: var(--text-secondary); letter-spacing: 1px; text-transform: uppercase;">Inactive</span>`;

 const safeTitle = window.escapeHtml(ex.title);
 const safeDateText = window.escapeHtml(ex.date_text);
 const actionBtn = ex.is_active
 ? `<button disabled style="font-family: var(--font-body); font-size: 10px; text-transform: uppercase; letter-spacing: 1px; padding: 0.5rem 1rem; background: transparent; border: 1px solid var(--grid-border); color: var(--text-secondary); cursor: not-allowed;">Currently Active</button>`
 : `<button data-action="activate-exhibition" data-id="${ex.id}" data-title="${safeTitle}" class="action-btn gold" style="padding: 0.5rem 1rem; font-size: 10px;">Set as Live</button>`;

 card.innerHTML = `
 <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
 <div>
 <div style="font-family: var(--font-heading); font-size: 1.3rem; color: var(--text-primary); margin-bottom: 0.2rem;">${safeTitle}</div>
 <div style="font-size: 11px; color: var(--text-secondary);">${safeDateText}</div>
 </div>
 ${statusBadge}
 </div>
 <div>${actionBtn}</div>
 `;
 container.appendChild(card);
 });
 };

 window.createNewExhibition = async function() {
 const btn = document.querySelector('button[onclick="createNewExhibition()"]');
 const msg = document.getElementById('createExMsg');

 const payload = {
 title: document.getElementById('newExTitle').value.trim(),
 date_text: document.getElementById('newExDate').value.trim(),
 venue: document.getElementById('newExVenue').value.trim(),
 about_text: document.getElementById('newExDesc').value.trim(),
 tnc_pdf_url: document.getElementById('newExTnc').value.trim(),
 registration_fee: document.getElementById('newExFee').value.trim(),
 payment_qr_url: document.getElementById('newExQr').value.trim(),
 payment_instructions: document.getElementById('newExPayInst').value.trim()
 };

 if (!payload.title || !payload.date_text || !payload.venue) {
 msg.textContent = "Title, Dates, and Venue are required.";
 msg.style.color = "var(--accent-red-text)";
 return;
 }

 btn.textContent = "Creating..."; btn.disabled = true;
 const res = await window.globalApiFetch('/admin/exhibitions/create', { method: 'POST', body: JSON.stringify(payload) });

 if (res && res.ok) {
 msg.textContent = "✓ Exhibition Created!";
 msg.style.color = "var(--accent-green-text)";
 document.querySelectorAll('#newExTitle, #newExDate, #newExVenue, #newExDesc, #newExTnc, #newExFee, #newExQr, #newExPayInst').forEach(el => el.value = '');
 await window.loadExhibitionManager();
 } else {
 msg.textContent = "Failed to create. Title might already exist.";
 msg.style.color = "var(--accent-red)";
 }

 btn.textContent = "Create Exhibition"; btn.disabled = false;
 setTimeout(() => msg.textContent = '', 4000);
 };

 window.activateExhibition = async function(id, title) {
 if (!confirm(`Are you sure you want to make "${title}" the live exhibition on the public portal?`)) return;
 const res = await window.globalApiFetch(`/admin/exhibitions/${id}/activate`, { method: 'PATCH' });
 if (res && res.ok) { await window.loadExhibitionManager(); await window.loadExhibitionsData('ALL'); }
 else { alert("Failed to activate exhibition."); }
 };

 window.deactivateAllExhibitions = async function() {
 if (!confirm("Are you sure you want to CLOSE the exhibition portal? The public will not be able to apply until you set a cycle to live.")) return;
 const res = await window.globalApiFetch('/admin/exhibitions/deactivate-all', { method: 'PATCH' });
 if (res && res.ok) { await window.loadExhibitionManager(); alert("Portal successfully closed."); }
 else { alert("Failed to close portal."); }
 };

 async function buildCycleSelector() {
 const res = await window.globalApiFetch('/admin/exhibitions/cycles');
 if (!res || !res.ok) return;
 const { cycles, current } = await res.json();
 const wrap = document.getElementById('cycleSelectWrap');
 if (!wrap) return;

 let opts = `<option value="">Active Now: ${current || 'None'}</option>`;
 cycles.forEach(c => { if (c !== current) opts += `<option value="${c}">${c}</option>`; });
 opts += `<option value="ALL">— All Archive —</option>`;

 wrap.innerHTML = `
 <label style="font-size:10px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;margin-right:0.8rem;">Viewing Cycle:</label>
 <select id="cycleSelect" style="background:transparent;border:none;border-bottom:1px solid var(--grid-border);color:var(--text-primary);font-family:var(--font-body);font-size:12px;padding:0.4rem 0;outline:none;">
 ${opts}
 </select>`;

 const sel = document.getElementById('cycleSelect');
 sel.value = currentCycleView;

 sel.addEventListener('change', async (e) => {
 currentCycleView = e.target.value;
 const query = currentCycleView ? `?cycle=${encodeURIComponent(currentCycleView)}` : '';
 const r = await window.globalApiFetch(`/admin/exhibitions${query}`);
 if (r && r.ok) { allExhibs = await r.json(); window.filterExhibitions('ALL'); }
 });
 }

 window.loadExhibitionsData = async function(f) {
 currentCycleView = 'ALL';
 const res = await window.globalApiFetch('/admin/exhibitions?cycle=ALL');
 if (!res) return;
 allExhibs = await res.json();
 await buildCycleSelector();
 window.renderExhibitions(f);
 };

 const hasPaymentSubmission = (a) => a.registration_status === 'SUBMITTED' || a.registration_status === 'CONFIRMED' || Boolean(a.payment_proof_url);
 const getExhibitionLabel = (a) => a.registration_status === 'CONFIRMED' ? 'CONFIRMED' : hasPaymentSubmission(a) ? 'PAYMENT SUBMITTED' : a.status;

 window.filterExhibitions = function(f) {
 activeCycleFilter = f;
 document.querySelectorAll('[id^="filt-"]').forEach(b => b.classList.remove('gold'));
 const target = document.getElementById(`filt-${f}`);
 if (target) target.classList.add('gold');
 window.renderExhibitions(f);
 };

 window.renderExhibitions = function(f) {
 const container = document.getElementById('exhibitionsContainer');
 const apps = f === 'ALL' ? allExhibs : allExhibs.filter(a => f === 'FINALIZED' ? hasPaymentSubmission(a) : f === 'APPROVED' ? a.status === 'APPROVED' && !hasPaymentSubmission(a) : a.status === f);

 container.innerHTML = '';
 if (!apps.length) { container.innerHTML = '<div class="empty-state">No portfolios found.</div>'; return; }

 apps.forEach(a => {
 const card = document.createElement('div');
 card.className = 'data-card exhib-card';
 const displayStatus = getExhibitionLabel(a);
 const badge = a.status === 'PENDING' ? 'badge-pending' : a.status === 'APPROVED' ? 'badge-approved' : 'badge-rejected';

 const safePortfolio = window.safeHttpUrl ? window.safeHttpUrl(a.portfolio_url) : (a.portfolio_url && (a.portfolio_url.startsWith('http://') || a.portfolio_url.startsWith('https://')) ? a.portfolio_url : null);
 let actionBtns = safePortfolio
   ? `<a href="${window.escapeHtml(safePortfolio)}" target="_blank" rel="noopener noreferrer" class="action-btn gold" style="padding:0.6rem;font-size:9px;text-align:center;">View Portfolio</a>`
   : `<span class="action-btn" style="padding:0.6rem;font-size:9px;text-align:center;opacity:0.4;cursor:not-allowed;">Invalid Portfolio</span>`;

 if (a.status === 'PENDING') {
 actionBtns += `
 <button class="action-btn" style="padding:0.6rem;font-size:9px;" onclick="reviewExhibition(${Number(a.id)},'APPROVED',this)">Approve</button>
 <button class="action-btn" style="padding:0.6rem;font-size:9px;border-color:var(--accent-red);color:var(--accent-red-text);" onclick="reviewExhibition(${Number(a.id)},'REJECTED',this)">Reject</button>`;
 } else if (a.status === 'REJECTED') {
 actionBtns += `<button class="action-btn" style="padding:0.6rem;font-size:9px;" onclick="revertExhibition(${Number(a.id)},this)">Undo Rejection</button>`;
 }
 if (a.payment_proof_url) {
 const safePayment = window.safeHttpUrl ? window.safeHttpUrl(a.payment_proof_url) : (a.payment_proof_url && (a.payment_proof_url.startsWith('http://') || a.payment_proof_url.startsWith('https://')) ? a.payment_proof_url : null);
 if (safePayment) {
 actionBtns += `<a href="${window.escapeHtml(safePayment)}" target="_blank" rel="noopener noreferrer" class="action-btn" style="padding:0.6rem;font-size:9px;border-color:var(--accent-green);color:var(--accent-green-text);text-align:center;margin-top:0.5rem;">View Payment Receipt</a>`;
 }
 }
 if (a.registration_status === 'SUBMITTED') {
 actionBtns += `<button class="action-btn gold" style="padding:0.6rem;font-size:9px;" onclick="confirmExhibitionPayment(${a.id},this)">Confirm Payment</button>`;
 }

 const cycleName = window.escapeHtml(a.exhibition_cycle ? a.exhibition_cycle : 'LEGACY ARCHIVE');
 const cycleTag = `<div style="font-size:10px; margin-top:6px; color:var(--accent-gold-text); letter-spacing:1.5px; text-transform:uppercase; font-weight:600;">CYCLE: ${cycleName}</div>`;

 const safeFullName = window.escapeHtml(a.full_name);
 const safeUserEmail = window.escapeHtml(a.user_email);
 const safeGenre = window.escapeHtml(a.genre);
 const safeMedium = window.escapeHtml(a.medium);

 card.innerHTML = `
 <div>
 <div class="data-label">Artist</div>
 <div class="data-display">${safeFullName}</div>
 <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">${safeUserEmail}</div>
 ${cycleTag}
 </div>
 <div>
 <div class="data-label">Art Profile</div>
 <div class="data-display" style="font-size:13px;">${safeGenre}</div>
 <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">Medium: ${safeMedium}</div>
 </div>
 <div><div class="data-label">Status</div><span class="badge ${badge}">${displayStatus}</span></div>
 <div style="display:flex;flex-direction:column;gap:0.5rem;">${actionBtns}</div>`;
 container.appendChild(card);
 });
 if (window.refreshGlobalEffects) window.refreshGlobalEffects();
 };

 window.reviewExhibition = async function(id, status, btn) {
 const note = prompt('Curator Note to Artist (optional):');
 btn.textContent = '...'; btn.disabled = true;
 const res = await window.globalApiFetch('/admin/exhibitions/review', { method: 'POST', body: JSON.stringify({ application_id: id, status: status, curator_note: note || null }) });
 if (res && res.ok) { await window.loadExhibitionsData('ALL'); window.filterExhibitions(activeCycleFilter); }
 else { btn.textContent = status === 'APPROVED' ? 'Approve' : 'Reject'; btn.disabled = false; }
 };

 window.revertExhibition = async function(id, btn) {
 if (!confirm('Undo rejection and return to Pending?')) return;
 btn.textContent = '...'; btn.disabled = true;
 const res = await window.globalApiFetch(`/admin/exhibitions/${id}/revert`, { method: 'PATCH' });
 if (res && res.ok) { await window.loadExhibitionsData('ALL'); window.filterExhibitions(activeCycleFilter); }
 else { btn.textContent = 'Undo Rejection'; btn.disabled = false; }
 };

 window.confirmExhibitionPayment = async function(id, btn) {
 if (!confirm('Confirm this payment? This will notify the artist.')) return;
 btn.textContent = '...'; btn.disabled = true;
 const res = await window.globalApiFetch(`/admin/exhibitions/${id}/confirm-payment`, { method: 'PATCH' });
 if (res && res.ok) { await window.loadExhibitionsData('ALL'); window.filterExhibitions('FINALIZED'); }
 else { btn.textContent = 'Confirm Payment'; btn.disabled = false; }
 };

 // ==========================================
 // CLUBS LOGIC
 // ==========================================
 let allClubApps = [];
 window.loadClubs = async function(f) { const res = await window.globalApiFetch('/admin/club-applications'); if(!res) return; allClubApps = await res.json(); window.renderClubs(f); };
 window.filterClubs = function(f) { document.querySelectorAll('[id^="filter-"]').forEach(b => { b.classList.remove('gold'); b.style.color = ''; b.style.borderColor = ''; }); const target = document.getElementById(`filter-${f}`); if(target) target.classList.add('gold'); window.renderClubs(f); };
 window.renderClubs = function(f) {
 const container = document.getElementById('clubsContainer'); const apps = f === 'ALL' ? allClubApps : allClubApps.filter(a => a.status === f); container.innerHTML = '';
 if (!apps.length) { container.innerHTML = '<div class="empty-state">No applications found.</div>'; return; }
 apps.forEach(a => {
 const card = document.createElement('div'); card.className = 'data-card club-card'; const badge = a.status === 'PENDING' ? 'badge-pending' : a.status === 'APPROVED' ? 'badge-approved' : 'badge-rejected';
 const safeEmail = window.escapeHtml(a.user_email);
 const safeClub = window.escapeHtml(a.club_name);
 card.innerHTML = `
 <div><div class="data-label">User</div><div class="data-display">${safeEmail}</div></div>
 <div><div class="data-label">Club</div><div class="data-display">${safeClub}</div></div>
 <div><div class="data-label">Status</div><span class="badge ${badge}">${a.status}</span></div>
 <div style="display:flex; flex-direction:column; gap:0.5rem;">
 ${a.status === 'PENDING' ? `<button class="action-btn" style="padding:0.6rem; font-size:9px;" onclick="reviewClub(${a.id}, 'APPROVED', this)">Approve</button><button class="action-btn" style="padding:0.6rem; font-size:9px; border-color:var(--accent-red); color:var(--accent-red-text);" onclick="reviewClub(${a.id}, 'REJECTED', this)">Reject</button>` : ''}
 ${a.status === 'REJECTED' ? `<button class="action-btn" style="padding:0.6rem; font-size:9px;" onclick="revertClub(${a.id}, this)">Undo</button>` : ''}
 </div>`;
 container.appendChild(card);
 });
 if(window.refreshGlobalEffects) window.refreshGlobalEffects();
 };
 window.reviewClub = async function(id, status, btn) { const note = status === 'REJECTED' ? prompt('Note:') : null; btn.textContent = '...'; const res = await window.globalApiFetch('/admin/club-applications/review', { method: 'POST', body: JSON.stringify({ application_id: id, status, admin_note: note }) }); if (res && res.ok) window.loadClubs('ALL'); };
 window.revertClub = async function(id, btn) { if (!confirm('Undo rejection?')) return; btn.textContent = '...'; btn.disabled = true; const res = await window.globalApiFetch(`/admin/club-applications/${id}/revert`, { method: 'PATCH' }); if (res && res.ok) { window.loadClubs('ALL'); window.filterClubs('ALL'); } };

 // ========================================= // ==========================================
 // ROSTER LOGIC & ACTIVITY LEDGER
 // ==========================================
 window.toggleActivityDrawer = function(index) {
   const drawer = document.getElementById('drawer-' + index);
   const btn = document.getElementById('drawer-btn-' + index);
   if (!drawer) return;
   const isOpen = drawer.classList.contains('open');
   if (isOpen) {
     drawer.classList.remove('open');
     if (btn) btn.textContent = 'Activity Ledger ▾';
   } else {
     drawer.classList.add('open');
     if (btn) btn.textContent = 'Activity Ledger ▴';
   }
 };

 window.loadRoster = async function() {
   const container = document.getElementById('rosterContainer');
   const res = await window.globalApiFetch('/admin/users');
   if (!res) return;
   const users = await res.json();
   container.innerHTML = '';
   if (!users.length) {
     container.innerHTML = '<div class="empty-state">No users registered yet.</div>';
     return;
   }
   users.forEach((u, i) => {
     const card = document.createElement('div');
     card.className = 'roster-card';
     const safeEmail = window.escapeHtml(u.email || '-');
     const safePhone = window.escapeHtml(u.phone || '-');
     const safeName = window.escapeHtml(u.full_name || 'Member');
     const safeProvider = window.escapeHtml(u.auth_provider || 'email');
     const isSelf = u.email === user.email;

     const emailBadge = u.email_verified
       ? '<span class="badge badge-verified">✓ Email</span>'
       : '<span class="badge badge-unverified">Email Pending</span>';

     const phoneBadge = u.phone_verified
       ? '<span class="badge badge-verified">✓ Phone</span>'
       : (u.phone ? '<span class="badge badge-unverified">Phone Pending</span>' : '<span class="badge badge-closed">No Phone</span>');

     const deleteBtn = (isSelf || u.status === 'ADMIN') ? '' : `
       <button class="action-btn" style="border-color: var(--accent-red); color: var(--accent-red-text); padding:0.6rem 0.8rem; font-size:9px;" data-email="${safeEmail}" onclick="deleteUser(this.getAttribute('data-email'), this)">Purge</button>
     `;

     let clubsHtml = '<div class="activity-empty">No club applications on record.</div>';
     if (u.clubs && u.clubs.length) {
       clubsHtml = u.clubs.map(c => `
         <div class="activity-item">
           <div style="font-weight: 500;">${window.escapeHtml(c.club_name)}</div>
           <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
             <span class="badge badge-${(c.status || '').toLowerCase()}">${window.escapeHtml(c.status)}</span>
             <span style="font-size:10px; color:var(--text-secondary);">${window.escapeHtml(c.created_at ? c.created_at.slice(0, 10) : '')}</span>
           </div>
         </div>
       `).join('');
     }

     let eventsHtml = '<div class="activity-empty">No event registrations on record.</div>';
     if (u.events && u.events.length) {
       eventsHtml = u.events.map(e => `
         <div class="activity-item">
           <div style="font-weight: 500;">${window.escapeHtml(e.event_name)}</div>
           <div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">Date: ${window.escapeHtml(e.event_date || 'TBD')}</div>
         </div>
       `).join('');
     }

     let exhibitionsHtml = '<div class="activity-empty">No exhibition cycles on record.</div>';
     if (u.exhibitions && u.exhibitions.length) {
       exhibitionsHtml = u.exhibitions.map(x => `
         <div class="activity-item">
           <div style="font-weight: 500;">${window.escapeHtml(x.exhibition_cycle || 'Cycle')}</div>
           <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
             <span class="badge badge-${(x.status || '').toLowerCase()}">Review: ${window.escapeHtml(x.status)}</span>
             <span style="font-size:10px; color:var(--text-secondary);">Reg: ${window.escapeHtml(x.registration_status || 'NONE')}</span>
           </div>
         </div>
       `).join('');
     }

     let feesHtml = '<div class="activity-empty">No exhibition fee records.</div>';
     if (u.fees && u.fees.length) {
       feesHtml = u.fees.map(f => {
         const proofLink = f.payment_proof_url ? `<a href="${window.escapeHtml(f.payment_proof_url)}" target="_blank" rel="noopener" style="color:var(--accent-gold); text-decoration:underline; font-size:11px;">Proof ↗</a>` : '<span style="color:var(--text-secondary); font-size:11px;">No Proof</span>';
         return `
           <div class="activity-item">
             <div style="display:flex; justify-content:space-between;">
               <span style="font-weight:500;">${window.escapeHtml(f.exhibition_cycle)}</span>
               <span style="font-size:11px;">${window.escapeHtml(f.registration_fee)}</span>
             </div>
             <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
               <span class="badge ${f.registration_status === 'CONFIRMED' ? 'badge-approved' : 'badge-pending'}">${window.escapeHtml(f.registration_status)}</span>
               ${proofLink}
             </div>
           </div>
         `;
       }).join('');
     }

     card.innerHTML = `
       <div class="roster-header">
         <div>
           <div class="data-label">${safeName}</div>
           <div class="data-display" style="font-size: 13px;">${safeEmail}</div>
           <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Phone: ${safePhone}</div>
           <div style="display: flex; gap: 0.4rem; margin-top: 0.5rem; flex-wrap: wrap;">
             ${emailBadge}
             ${phoneBadge}
             <span class="badge badge-closed">${safeProvider}</span>
           </div>
         </div>
         <div>
           <div class="data-label">Role</div>
           <select id="st-${i}" style="margin:0; font-size:12px;">
             <option value="PARTICIPANT" ${u.status === 'PARTICIPANT' ? 'selected' : ''}>Participant</option>
             <option value="ADMIN" ${u.status === 'ADMIN' ? 'selected' : ''}>Admin</option>
           </select>
         </div>
         <div style="display:flex; flex-direction:column; gap:0.5rem; align-items:stretch;">
           <div style="display:flex; gap:0.5rem; align-items:center;">
             <button class="action-btn gold" style="padding:0.6rem 0.8rem; font-size:9px; flex:1;" data-email="${safeEmail}" onclick="updateStatus(this.getAttribute('data-email'), ${i}, this)">Save Role</button>
             ${deleteBtn}
           </div>
           <button class="activity-toggle-btn" id="drawer-btn-${i}" onclick="toggleActivityDrawer(${i})">Activity Ledger ▾</button>
         </div>
       </div>
       <div class="activity-drawer" id="drawer-${i}">
         <div class="activity-grid">
           <div>
             <div class="activity-col-title">Circles & Clubs</div>
             ${clubsHtml}
           </div>
           <div>
             <div class="activity-col-title">Event RSVPs</div>
             ${eventsHtml}
           </div>
           <div>
             <div class="activity-col-title">Exhibitions</div>
             ${exhibitionsHtml}
           </div>
           <div>
             <div class="activity-col-title">Fee Ledger</div>
             ${feesHtml}
           </div>
         </div>
       </div>
     `;
     container.appendChild(card);
   });
   if (window.refreshGlobalEffects) window.refreshGlobalEffects();
 };

 window.deleteUser = async function(email, btn) {
 if (!confirm(`Are you sure you want to completely purge user ${email}? This will delete all their registrations, submissions, and club applications.`)) {
 return;
 }
 btn.textContent = '...';
 btn.disabled = true;
 try {
 const res = await window.globalApiFetch(`/admin/users/${encodeURIComponent(email)}`, { method: 'DELETE' });
 if (res && res.ok) {
 window.loadRoster();
 } else {
 alert('Failed to delete user.');
 btn.textContent = 'Purge';
 btn.disabled = false;
 }
 } catch (e) {
 alert('Error purging user: ' + e.message);
 btn.textContent = 'Purge';
 btn.disabled = false;
 }
 };

 window.updateStatus = async function(email, i, btn) { const status = document.getElementById(`st-${i}`).value; btn.textContent = '...'; const res = await window.globalApiFetch('/admin/update_status', { method: 'POST', body: JSON.stringify({ email, status }) }); if (res && res.ok) { if (email === user.email && status === 'PARTICIPANT') { localStorage.clear(); window.location.href = 'login.html'; } btn.textContent = '✓'; setTimeout(() => btn.textContent = 'Save Role', 2000); } };

 // ==========================================
 // STORAGE VAULT SUBMISSIONS
 // ==========================================
 window.loadSubmissions = async function() {
 const container = document.getElementById('submissionsContainer');
 if (!container) return;
 container.innerHTML = '<div class="empty-state">Loading submissions...</div>';
 try {
 const res = await window.globalApiFetch('/admin/submissions');
 if (!res || !res.ok) {
 container.innerHTML = '<div class="empty-state">Unable to load submissions.</div>';
 return;
 }
 const subs = await res.json();
 if (!subs || !subs.length) {
 container.innerHTML = '<div class="empty-state">No submissions found in Storage Vault.</div>';
 return;
 }
 container.innerHTML = '';
 subs.forEach(s => {
 const card = document.createElement('div');
 card.className = 'data-card exhib-card';
 const safeTitle = window.escapeHtml(s.title || 'Untitled');
 const safeType = window.escapeHtml(s.submission_type || 'Work');
 const safeAuthor = window.escapeHtml(s.author_email || 'Anonymous');
 const safeNote = window.escapeHtml(s.note || '');
 const safeDate = s.created_at ? new Date(s.created_at).toLocaleDateString() : '';
 const safeUrl = window.safeHttpUrl(s.file_url);
 const linkHtml = safeUrl
 ? `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="action-btn gold" style="padding:0.6rem 1rem; font-size:9px; text-decoration:none; display:inline-block;">View File &rarr;</a>`
 : `<span style="font-size:11px; color:var(--text-secondary);">(No valid URL)</span>`;

 card.innerHTML = `
 <div>
 <div class="data-label">${safeType} · ${safeDate}</div>
 <div class="data-display" style="font-weight:600; font-size:15px; margin-bottom:0.3rem;">${safeTitle}</div>
 <div style="font-size:11px; color:var(--text-secondary);">${safeAuthor}</div>
 </div>
 <div>
 <div class="data-label">Author Note</div>
 <div style="font-size:12px; color:var(--text-secondary); max-height:80px; overflow-y:auto;">${safeNote || '—'}</div>
 </div>
 <div style="display:flex; justify-content:flex-end; align-items:center;">
 ${linkHtml}
 </div>
 `;
 container.appendChild(card);
 });
 if (window.refreshGlobalEffects) window.refreshGlobalEffects();
 } catch (e) {
 container.innerHTML = `<div class="empty-state">Error loading submissions: ${window.escapeHtml(e.message)}</div>`;
 }
 };

 // ==========================================
 // SYSTEM & EMAIL DIAGNOSTICS
 // ==========================================
 window.checkEmailStatus = async function() {
 const statusEl = document.getElementById('emailWebhookStatus');
 if (!statusEl) return;
 try {
 const res = await window.globalApiFetch('/admin/email/status');
 if (res && res.ok) {
 const data = await res.json();
 if (data.make_webhook_configured) {
 statusEl.style.color = 'var(--accent-gold-text)';
 statusEl.textContent = 'CONFIGURED (Make.com Webhook URL Present — Live Delivery Unverified Until Dispatched)';
 } else {
 statusEl.style.color = 'var(--accent-red-text)';
 statusEl.textContent = 'NOT CONFIGURED (MAKE_WEBHOOK_URL Absent in Environment)';
 }
 } else {
 statusEl.textContent = 'Unable to determine webhook configuration status';
 }
 } catch (e) {
 statusEl.textContent = 'Error checking webhook status';
 }
 };

 window.sendTestEmail = async function() {
 const btn = document.getElementById('btnTestEmail');
 const msg = document.getElementById('emailTestMsg');
 if (!btn || !msg) return;
 btn.textContent = 'Dispatching...';
 btn.disabled = true;
 msg.textContent = '';
 try {
 const res = await window.globalApiFetch('/admin/email/test', { method: 'POST' });
 if (res && res.ok) {
 msg.style.color = 'var(--accent-green)';
 msg.textContent = 'Webhook accepted test payload (200 OK). External inbox delivery depends on Make.com scenario processing.';
 } else {
 const errData = await res.json().catch(() => ({}));
 msg.style.color = 'var(--accent-red)';
 msg.textContent = `Webhook dispatch failed: ${errData.detail || 'Service returned error'}`;
 }
 } catch (e) {
 msg.style.color = 'var(--accent-red)';
 msg.textContent = `Error: ${e.message}`;
 } finally {
 btn.textContent = 'Send Test Email';
 btn.disabled = false;
 }
 };

 // ==========================================
 // VOLUNTEER RECRUITMENT LOGIC
 // ==========================================
 window.switchTab('events');
});
