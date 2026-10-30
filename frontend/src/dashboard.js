// dashboard.js — Centralized Dashboard Logic
document.addEventListener('DOMContentLoaded', () => {
 const cloudinaryConfig = window.ALFAAZ_CLOUDINARY || {
 cloudName: 'dmqwjpmjk',
 uploadPreset: 'alfaaz_vault'
 };

 // TOAST SYSTEM
 function showToast(message, type = 'info', duration = 3500) {
 const container = document.getElementById('toastContainer');
 if (!container) return;
 const t = document.createElement('div');
 t.className = `toast ${type}`; t.textContent = message;
 container.appendChild(t);
 requestAnimationFrame(() => { requestAnimationFrame(() => t.classList.add('show')); });
 setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, duration);
 }

 // AUTH CHECK
 const userData = localStorage.getItem('alfaaz_user');
 const token = localStorage.getItem('alfaaz_token');
 if (!userData || !token) {
 window.location.href = 'login.html?redirect=dashboard.html';
 return;
 }
 let user;
 try {
 user = JSON.parse(userData);
 } catch (error) {
 localStorage.removeItem('alfaaz_user');
 window.location.href = 'login.html';
 return;
 }

 const dashEmail = document.getElementById('dashEmail');
 const dashStatus = document.getElementById('dashStatus');
 const adminLink = document.getElementById('adminLink');
 const logoutBtn = document.getElementById('logoutBtn');

 if (dashEmail) dashEmail.textContent = user.email;
 if (dashStatus) dashStatus.textContent = user.status;
 if (user.status === 'ADMIN' && adminLink) adminLink.style.display = 'block';

 // IMPORTANT: logoutBtn is now part of the <alfaaz-nav> component usually, 
 // but the dashboard had a specific logout trigger we should support if it's there.
 if (logoutBtn) {
 logoutBtn.addEventListener('click', () => { localStorage.clear(); window.location.href = 'login.html'; });
 }

 // PROFILE LOGIC
 async function loadProfile() {
 try {
 const res = await window.globalApiFetch('/auth/me');
 if (!res || !res.ok) return;
 const data = await res.json();
 const dashName = document.getElementById('dashName');
 const nameEditInput = document.getElementById('nameEditInput');
 if (dashName) dashName.textContent = data.full_name || '—';
 if (nameEditInput) nameEditInput.value = data.full_name || '';
 } catch (e) {
 console.error("Profile load error:", e);
 }
 }

 window.startEditName = function() { 
 document.getElementById('nameDisplayRow').style.display='none'; 
 document.getElementById('nameEditRow').style.display='flex'; 
 };
 window.cancelEditName = function() { 
 document.getElementById('nameDisplayRow').style.display='flex'; 
 document.getElementById('nameEditRow').style.display='none'; 
 };
 window.saveEditName = async function() {
 const val = document.getElementById('nameEditInput').value;
 const res = await window.globalApiFetch('/auth/me', { method: 'PATCH', body: JSON.stringify({ full_name: val }) });
 if(res && res.ok) { 
 document.getElementById('dashName').textContent = val; 
 window.cancelEditName(); 
 showToast('Name updated', 'success'); 
 }
 };

 // CURATOR AI TERMINAL
 function appendPhantomMessage(output, label, text, style = '') {
 const row = document.createElement('div');
 row.style.cssText = style;
 if (label) {
 const strong = document.createElement('strong');
 strong.textContent = `${label}:`;
 row.appendChild(strong);
 row.appendChild(document.createTextNode(' '));
 }
 row.appendChild(document.createTextNode(text));
 output.appendChild(row);
 output.scrollTop = output.scrollHeight;
 return row;
 }

 window.askPhantom = async function() {
 const input = document.getElementById('phantomInput'), output = document.getElementById('phantomOutput');
 if (!input || !output) return;
 const query = input.value.trim();
 if (!query) return; 
 input.value = '';
 
 appendPhantomMessage(output, 'You', query, 'margin-top:1.5rem; color: var(--accent-gold-text); font-weight: 500;');
 const loadMsg = appendPhantomMessage(output, '', 'Curator AI is reflecting...', 'color:var(--text-secondary); font-style:italic; margin-top:0.5rem;');
 
 const coldTimer = setTimeout(() => {
   if (loadMsg.isConnected) {
     loadMsg.textContent = 'Waking the archives... Curator AI is preparing your answer.';
   }
 }, 4000);

 const history = window.alfaazCuratorMemory?.history?.() || [];

 async function executeQuery() {
   return await window.globalApiFetch('/phantom/ask', { 
     method: 'POST', 
     body: JSON.stringify({ question: query, history }) 
   });
 }

 try {
   let res = await executeQuery();
   if (res && (res.status === 502 || res.status === 503)) {
     if (loadMsg.isConnected) loadMsg.textContent = 'Connecting to archives...';
     await new Promise(r => setTimeout(r, 3000));
     res = await executeQuery();
   }

   clearTimeout(coldTimer);
   if (loadMsg.isConnected) loadMsg.remove();

   if (res && res.ok) {
     const data = await res.json();
     appendPhantomMessage(output, 'Curator AI', data.answer, 'color:var(--text-primary); margin-top:0.5rem; border-left: 2px solid var(--accent-gold); padding-left: 8px;');
     window.alfaazCuratorMemory?.add?.('user', query);
     window.alfaazCuratorMemory?.add?.('assistant', data.answer);
   } else if (res && res.status === 429) {
     appendPhantomMessage(output, '', 'Curator AI is currently occupied with other visitors. Please wait a moment.', 'color:var(--accent-red-text); margin-top:0.5rem;');
   } else {
     appendPhantomMessage(output, '', 'The archives are momentarily quiet. Please inquire again in a few moments.', 'color:var(--accent-red-text); margin-top:0.5rem;');
   }
 } catch (err) { 
   clearTimeout(coldTimer);
   if (loadMsg.isConnected) loadMsg.remove();
   appendPhantomMessage(output, '', 'Connection interrupted. Please try again.', 'color:var(--accent-red-text); margin-top:0.5rem;');
 }
 output.scrollTop = output.scrollHeight;
 };
 window.askCurator = window.askPhantom;
 
 document.getElementById('phantomInput')?.addEventListener('keydown', function (e) {
 if (e.key === 'Enter') {
 e.preventDefault();
 window.askPhantom();
 }
 });

 // EVENTS
 async function loadActiveEvents() {
 const container = document.getElementById('activeEventsContainer');
 if (!container) return;
 try {
 const res = await window.globalApiFetch('/events/active');
 if (!res || !res.ok) return;
 const events = await res.json();
 if (!events.length) { container.innerHTML = '<div style="font-size:12px; color:var(--text-secondary); font-style:italic;">No upcoming events at this time.</div>'; return; }
 container.innerHTML = events.map(e => `
 <div class="list-item">
 <div style="flex:1;">
 <div style="font-family:var(--font-heading); font-size:1.5rem; color:var(--text-primary); margin-bottom:5px;">${window.escapeHtml(e.name)}</div>
 <div style="font-size:10px; color:var(--accent-gold); text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">${window.escapeHtml(e.event_date || 'TBD')}</div>
 <div style="font-size:12px; color:var(--text-secondary);">${window.escapeHtml(e.description || '')}</div>
 </div>
 <div><button class="action-btn gold" style="margin-top:0; padding:0.6rem 1.5rem;" ${e.full ? 'disabled' : ''} onclick="openRsvpModal(${e.id})">${e.full ? 'FULL' : 'RSVP'}</button></div>
 </div>`).join('');
 if (window.refreshGlobalEffects) window.refreshGlobalEffects();
 } catch (e) { container.innerHTML = '<p style="color:var(--accent-red); font-size:12px;">Server Unreachable</p>'; }
 }

 async function loadMyTickets() {
 const container = document.getElementById('myTicketsContainer');
 if (!container) return;
 try {
 const res = await window.globalApiFetch('/events/my-registrations');
 if (!res || !res.ok) return;
 const tickets = await res.json();
 if (!tickets.length) { container.innerHTML = '<div style="font-size:12px; color:var(--text-secondary); font-style:italic;">No registrations found.</div>'; return; }
 container.innerHTML = tickets.map(t => `
 <div class="list-item" style="border-left:2px solid var(--accent-green); background: var(--bg-primary);">
 <div><div style="font-family:var(--font-heading); font-size:1.3rem;">${window.escapeHtml(t.event_name)}</div><div style="font-size:10px; color:var(--text-secondary); margin-top:4px; letter-spacing: 1px; text-transform: uppercase;">${window.escapeHtml(t.event_date || 'TBD')}</div></div>
 <div style="align-self:center;"><span class="badge badge-green">AUTHORIZED</span></div>
 </div>`).join('');
 } catch (e) {}
 }

 // RSVP LOGIC
 let currentRsvpEventId = null;
 window.openRsvpModal = function(eventId) { 
 currentRsvpEventId = eventId; 
 document.getElementById('rsvpWhatsapp').value = ''; 
 document.getElementById('rsvpModal').style.display = 'flex'; 
 };
 window.closeRsvpModal = function() { 
 document.getElementById('rsvpModal').style.display = 'none'; 
 currentRsvpEventId = null; 
 };
 window.submitRsvp = async function() {
 const wa = document.getElementById('rsvpWhatsapp').value.trim();
 if (!wa) { showToast('WhatsApp is required.', 'error'); return; }
 const btn = document.getElementById('confirmRsvpBtn'); btn.textContent = "Processing..."; btn.disabled = true;
 try {
 const res = await window.globalApiFetch('/events/register', { method: 'POST', body: JSON.stringify({ event_id: currentRsvpEventId, whatsapp_number: wa }) });
 if (res && res.ok) { window.closeRsvpModal(); showToast('Spot secured.', 'success'); loadActiveEvents(); loadMyTickets(); }
 else { const data = await res.json().catch(() => ({})); showToast(data.detail || data.error || 'Registration failed.', 'error'); }
 } catch (e) { showToast('Network error while securing spot.', 'error'); }
 btn.textContent = "Secure Spot"; btn.disabled = false;
 };

 // CLUBS
 async function loadClubStatus() {
 try {
 const res = await window.globalApiFetch('/clubs/my-status');
 if (!res || !res.ok) return;
 const data = await res.json();
 const viewStatus = document.getElementById('clubStatusView'), viewApply = document.getElementById('clubApplyView');
 if (data.status === "NONE") { 
 if (viewStatus) viewStatus.style.display = "none"; 
 if (viewApply) viewApply.style.display = "block"; 
 } 
 else {
 if (viewApply) viewApply.style.display = "none"; 
 if (viewStatus) viewStatus.style.display = "block";
 const myClubName = document.getElementById('myClubName');
 const myClubBadge = document.getElementById('myClubBadge');
 const myClubNote = document.getElementById('myClubNote');

 if (myClubName) myClubName.textContent = data.club;
 let bc = data.status === 'PENDING' ? 'badge-gold' : data.status === 'APPROVED' ? 'badge-green' : 'badge-red';
 if (myClubBadge) myClubBadge.innerHTML = `<span class="badge ${bc}">${data.status}</span>`;
 if (data.admin_note && myClubNote) myClubNote.textContent = `Curator's Note: "${data.admin_note}"`;
 }
 } catch (e) {}
 }

 window.submitClubApplication = async function() {
 const club = document.getElementById('clubSelect').value, note = document.getElementById('clubNote').value;
 const btn = document.getElementById('clubSubmitBtn'), msg = document.getElementById('clubMsg');
 btn.textContent = "Submitting..."; btn.disabled = true;
 try {
 const res = await window.globalApiFetch('/clubs/apply', { method: 'POST', body: JSON.stringify({ club_name: club, note: note }) });
 if (res && res.ok) { 
 msg.style.color = "var(--accent-green)"; 
 msg.textContent = "Application submitted."; 
 showToast('Applied to collective.', 'success'); 
 setTimeout(() => loadClubStatus(), 1500); 
 }
 else { 
 const data = await res.json(); 
 msg.style.color = "var(--accent-red)"; 
 msg.textContent = data.detail; 
 btn.textContent = "Submit Application"; btn.disabled = false; 
 }
 } catch (e) { 
 msg.style.color = "var(--accent-red)"; msg.textContent = "Failed."; 
 btn.textContent = "Submit Application"; btn.disabled = false; 
 }
 };

 // EXHIBITIONS
 async function loadExhibitionStatus() {
 try {
 const [cfgRes, statusRes] = await Promise.all([ 
 window.globalApiFetch('/exhibitions/config'), 
 window.globalApiFetch('/exhibitions/my-status') 
 ]);
 
 if (!cfgRes || !statusRes) return;
 
 const cfg = await cfgRes.json();
 const data = await statusRes.json();
 
 const masterPanel = document.getElementById('exhibitionPanel');
 if (!masterPanel) return;

 if (!cfg.is_open && data.status === "NONE") { 
 masterPanel.style.display = "none"; 
 return; 
 }
 masterPanel.style.display = "block";
 
 ['exhibApplyView','exhibPendingView','exhibRejectedView','exhibApprovedView','exhibFinalizedView'].forEach(id => { 
 const el = document.getElementById(id); if (el) el.style.display = 'none'; 
 });
 
 if (data.status === "NONE") {
 document.getElementById('exhibApplyView').style.display = "block";
 }
 else if (data.status === "PENDING") {
 document.getElementById('exhibPendingView').style.display = "block";
 }
 else if (data.status === "REJECTED") { 
 document.getElementById('exhibRejectedView').style.display = "block"; 
 if (data.curator_note) document.getElementById('exhibRejectedNote').textContent = `"Curator Note: ${data.curator_note}"`; 
 }
 else if (data.status === "APPROVED" && (data.registration_status === "SUBMITTED" || data.registration_status === "CONFIRMED")) {
 document.getElementById('exhibFinalizedView').style.display = "block";
 }
 else if (data.status === "APPROVED") { 
 document.getElementById('exhibApprovedView').style.display = "block"; 
 if (data.curator_note) document.getElementById('exhibApprovedNote').textContent = `"${data.curator_note}"`; 
 
 const tcLink = document.getElementById('btnTcLink');
 const paymentLink = document.getElementById('btnPaymentLink');
 const paymentDetails = document.getElementById('paymentDetails');

 if (tcLink) {
 const safeTnc = window.safeHttpUrl ? window.safeHttpUrl(cfg.tnc_pdf_url) : (cfg.tnc_pdf_url && (cfg.tnc_pdf_url.startsWith('http://') || cfg.tnc_pdf_url.startsWith('https://')) ? cfg.tnc_pdf_url : null);
 if (safeTnc) {
 tcLink.href = safeTnc; tcLink.target = '_blank'; tcLink.rel = 'noopener noreferrer';
 tcLink.style.opacity = '1'; tcLink.style.pointerEvents = 'auto';
 } else {
 tcLink.removeAttribute('href'); tcLink.removeAttribute('target'); tcLink.removeAttribute('rel');
 tcLink.style.opacity = '0.55'; tcLink.style.pointerEvents = 'none';
 }
 }

 if (paymentLink) {
 const safeQr = window.safeHttpUrl ? window.safeHttpUrl(cfg.payment_qr_url) : (cfg.payment_qr_url && (cfg.payment_qr_url.startsWith('http://') || cfg.payment_qr_url.startsWith('https://')) ? cfg.payment_qr_url : null);
 if (safeQr) {
 paymentLink.href = safeQr; paymentLink.target = '_blank'; paymentLink.rel = 'noopener noreferrer';
 paymentLink.style.opacity = '1'; paymentLink.style.pointerEvents = 'auto';
 } else {
 paymentLink.removeAttribute('href'); paymentLink.removeAttribute('target'); paymentLink.removeAttribute('rel');
 paymentLink.style.opacity = '0.55'; paymentLink.style.pointerEvents = 'none';
 }
 }

 if (paymentDetails) {
 const paymentLines = [];
 if (cfg.registration_fee) paymentLines.push(`Fee: ${cfg.registration_fee}`);
 if (cfg.payment_instructions) paymentLines.push(cfg.payment_instructions);
 paymentDetails.textContent = paymentLines.join(' | ');
 paymentDetails.style.display = paymentLines.length ? 'block' : 'none';
 }
 }
 
 if (window.refreshGlobalEffects) window.refreshGlobalEffects();
 } catch (e) {
 console.error("Exhibition load error:", e);
 }
 }

 document.getElementById('paymentProofForm')?.addEventListener('submit', async (e) => {
 e.preventDefault();
 const tcChecked = document.getElementById('tcCheckbox').checked;
 if(!tcChecked) return;
 
 const fileInput = document.getElementById('paymentScreenshot');
 const btn = document.getElementById('finalizeExhibBtn');
 const msg = document.getElementById('finalizeMsg');
 
 btn.textContent = "Uploading..."; btn.disabled = true;
 msg.style.color = "var(--text-secondary)"; msg.textContent = "Securing payment proof in vault...";

 try {
 const formData = new FormData(); 
 formData.append('file', fileInput.files[0]); 
 formData.append('upload_preset', cloudinaryConfig.uploadPreset); 
 
 const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/upload`, { method: 'POST', body: formData });
 const cloudData = await cloudRes.json();
 if (!cloudData.secure_url) throw new Error("Cloud vault upload failed.");

 msg.textContent = "Updating registration status...";
 const res = await window.globalApiFetch('/exhibitions/finalize', {
 method: 'POST',
 body: JSON.stringify({ agreed_to_tnc: true, payment_proof_url: cloudData.secure_url })
 });

 if (res && res.ok) {
 msg.style.color = "var(--accent-green)"; msg.textContent = "Registration Finalized!";
 showToast('Registration complete.', 'success');
 setTimeout(() => loadExhibitionStatus(), 1500); 
 } else {
 throw new Error("Server rejected the finalize request.");
 }
 } catch (err) {
 msg.style.color = "var(--accent-red)"; msg.textContent = err.message;
 btn.textContent = "Finalize Registration"; btn.disabled = false;
 }
 });

 // INIT
 loadProfile(); 
 loadActiveEvents(); 
 loadMyTickets(); 
 loadClubStatus(); 
 loadExhibitionStatus();
});
