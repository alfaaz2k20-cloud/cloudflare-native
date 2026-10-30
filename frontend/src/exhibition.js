// exhibition.js — Centralized Exhibition Logic
document.addEventListener('DOMContentLoaded', () => {
 const token = localStorage.getItem('alfaaz_token');
 if (!token) {
 window.location.href = `login.html?redirect=exhibition.html`;
 return;
 }

 const headerTitle = document.getElementById('headerTitle');
 const closedMessage = document.getElementById('closedMessage');
 const detailsBox = document.getElementById('detailsBox');
 const applicationFormContainer = document.getElementById('applicationFormContainer');
 const exDates = document.getElementById('exDates');
 const exVenue = document.getElementById('exVenue');
 const exDesc = document.getElementById('exDesc');

 // ── Cloudinary PDF Upload ──────────────────────────────────────────
 const cloudinaryConfig = window.ALFAAZ_CLOUDINARY || {
 cloudName: 'dmqwjpmjk',
 uploadPreset: 'alfaaz_vault'
 };
 const { cloudName: CLOUD_NAME, uploadPreset: UPLOAD_PRESET } = cloudinaryConfig;
 let uploadedPdfUrl = null;

 document.getElementById('portfolioFile')?.addEventListener('change', async (e) => {
 const file = e.target.files[0];
 const status = document.getElementById('uploadStatus');
 if (!file || !status) return;

 if (file.type !== 'application/pdf') {
 status.style.color = 'var(--accent-red)';
 status.textContent = '✗ Only PDF files are accepted.';
 e.target.value = '';
 uploadedPdfUrl = null;
 return;
 }
 if (file.size > 15 * 1024 * 1024) {
 status.style.color = 'var(--accent-red)';
 status.textContent = '✗ File exceeds the 15MB limit.';
 e.target.value = '';
 uploadedPdfUrl = null;
 return;
 }

 status.style.color = 'var(--accent-gold-text)';
 status.textContent = `Uploading ${file.name}...`;

 try {
 const formData = new FormData();
 formData.append('file', file);
 formData.append('upload_preset', UPLOAD_PRESET);
 const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: 'POST', body: formData });
 const data = await res.json().catch(() => ({}));
 if (data.secure_url) {
  uploadedPdfUrl = data.secure_url;
  status.style.color = 'var(--accent-green-text)';
  status.textContent = '✓ Uploaded successfully.';
 } else {
  const detail = data.error?.message ? `: ${data.error.message}` : '';
  throw new Error(`Upload failed${detail}`);
 }
 } catch (uploadErr) {
 status.style.color = 'var(--accent-red-text)';
 status.textContent = `✗ ${uploadErr.message || 'Upload failed — please try again.'}`;
 uploadedPdfUrl = null;
 }
 });

 // ── Page Init ─────────────────────────────────────────────────────
 async function initExhibition() {
 try {
 const res = await window.globalApiFetch('/exhibitions/config');
 if (!res || !res.ok) throw new Error("Failed to load config");
 const config = await res.json();
 
 if (headerTitle) headerTitle.textContent = config.title || 'Exhibition';

 if (!config.is_open) {
 if (closedMessage) closedMessage.style.display = 'block';
 } else {
 if (detailsBox) detailsBox.style.display = 'flex';
 if (applicationFormContainer) applicationFormContainer.style.display = 'block';
 if (exDates) exDates.textContent = config.date_text;
 if (exVenue) exVenue.textContent = config.venue;
 if (exDesc) exDesc.textContent = config.about_text || 'Applications are now open for the upcoming exhibition cycle.';

 // Gate: block if already applied for this cycle
 if (window.globalApiFetch) {
 const statusRes = await window.globalApiFetch('/exhibitions/my-status');
 if (statusRes && statusRes.ok) {
 const statusData = await statusRes.json();
 if (statusData.status !== 'NONE') {
 if (applicationFormContainer) {
 applicationFormContainer.innerHTML = `
 <div class="panel fade-in text-center" style="padding: 4rem 2rem;">
 <i data-lucide="check-circle" class="w-8 h-8 mx-auto mb-4" style="color: var(--accent-green);"></i>
 <h3 style="font-family: var(--font-heading); font-size: 1.5rem; margin-bottom: 1rem;">Application Received</h3>
 <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 2rem;">You have already submitted a portfolio for this exhibition cycle. Please track your status in the dashboard.</p>
 <a href="dashboard.html" class="action-btn gold" style="display:inline-block;">Go to Dashboard</a>
 </div>
 `;
 }
 if (window.lucide) window.lucide.createIcons();
 }
 }
 }
 }
 } catch (err) {
 if (headerTitle) headerTitle.textContent = 'Server Error';
 if (closedMessage) closedMessage.style.display = 'block';
 }

 const fadeElements = document.querySelectorAll('.fade-in');
 setTimeout(() => { fadeElements.forEach(el => el.classList.add('visible')); }, 100);
 if (window.lucide) window.lucide.createIcons();

 if (window.turnstile && document.getElementById('exhibitionTurnstile')) {
  try {
   window.turnstile.render('#exhibitionTurnstile', {
    sitekey: window.ALFAAZ_TURNSTILE_SITEKEY || '0x4AAAAAAFsRHzhKR6YGsXSy',
    theme: 'light'
   });
  } catch (_) {}
 }
 }

 // ── Form Submission ───────────────────────────────────────────────
 document.getElementById('exhibForm')?.addEventListener('submit', async (e) => {
 e.preventDefault();
 const btn = document.getElementById('submitBtn');
 const msg = document.getElementById('formMsg');

 // Guard: PDF must be uploaded first
 if (!uploadedPdfUrl) {
 if (msg) {
 msg.style.color = 'var(--accent-red-text)';
 msg.textContent = 'Please upload your portfolio PDF before submitting.';
 }
 return;
 }

 const turnstileToken = window.turnstile ? (window.turnstile.getResponse() || '') : (document.querySelector('[name="cf-turnstile-response"]')?.value || '');

 const payload = {
 full_name: document.getElementById('fname').value.trim(),
 age: parseInt(document.getElementById('age').value),
 address: document.getElementById('address').value.trim(),
 whatsapp: document.getElementById('whatsapp').value.trim(),
 genre: document.getElementById('genre').value.trim(),
 medium: document.getElementById('medium').value.trim(),
 portfolio_url: uploadedPdfUrl,
 over_19: document.getElementById('checkAge').checked,
 agreed_to_screening: document.getElementById('checkScreen').checked,
 applicant_note: document.getElementById('note').value.trim() || null,
 turnstile_token: turnstileToken
 };

 if (btn) { btn.textContent = "Submitting..."; btn.disabled = true; }
 if (msg) { msg.textContent = ''; msg.style.color = ''; }

 const restoreBtn = () => {
 if (btn) { btn.textContent = 'Submit to Curator'; btn.disabled = false; }
 };

 try {
 if (!window.globalApiFetch) {
 throw new Error('Submission is unavailable right now.');
 }

 const res = await window.globalApiFetch('/exhibitions/apply', {
 method: 'POST', body: JSON.stringify(payload)
 });

 if (res && res.ok) {
 if (msg) {
 msg.style.color = 'var(--accent-green-text)';
 msg.textContent = '✓ Portfolio submitted. Redirecting to dashboard...';
 }
 setTimeout(() => window.location.href = 'dashboard.html', 2000);
 return;
 }

 const errorData = await res?.json().catch(() => ({}));
 if (msg) {
 msg.style.color = 'var(--accent-red-text)';
 msg.textContent = errorData.detail || errorData.error || 'Submission failed. Please try again.';
 }
 restoreBtn();
 } catch (err) {
 console.error('[Exhibition submit error]', err);
 if (msg) {
 msg.style.color = 'var(--accent-red-text)';
 msg.textContent = 'Could not reach the server. Please check your connection and try again.';
 }
 restoreBtn();
 }
 });

 initExhibition();
});
