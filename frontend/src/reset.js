// reset.js — Centralized Reset Password Logic
document.addEventListener('DOMContentLoaded', () => {
 const urlParams = new URLSearchParams(window.location.search);
 const token = urlParams.get('token');
 
 function isTokenLikelyExpired(t) {
 try {
 const encodedPayload = t.split('.')[1];
 const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
 const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
 const payload = JSON.parse(atob(padded));
 return payload.exp && (payload.exp * 1000 < Date.now());
 } catch {
 return false;
 }
 }
 
 const expiredOverlay = document.getElementById('expiredOverlay');
 if (!token || isTokenLikelyExpired(token)) {
 if (expiredOverlay) expiredOverlay.classList.add('show');
 }

 const form = document.getElementById('resetForm');
 const submitBtn = document.querySelector('.submit-btn');
 const newPwInput = document.getElementById('newPassword');
 const confirmInput = document.getElementById('confirmPassword');
 const strengthBar = document.getElementById('strengthBar');
 const strengthLabel = document.getElementById('strengthLabel');
 const matchIndicator = document.getElementById('matchIndicator');
 const toggleNew = document.getElementById('toggleNew');
 const toggleConfirm = document.getElementById('toggleConfirm');

 if (!form) return;

 toggleNew?.addEventListener('click', () => {
 const isHidden = newPwInput.type === 'password';
 newPwInput.type = isHidden ? 'text' : 'password';
 toggleNew.textContent = isHidden ? 'hide' : 'show';
 });

 toggleConfirm?.addEventListener('click', () => {
 const isHidden = confirmInput.type === 'password';
 confirmInput.type = isHidden ? 'text' : 'password';
 toggleConfirm.textContent = isHidden ? 'hide' : 'show';
 });

 function getStrength(pw) {
 let s = 0;
 if (pw.length >= 8) s++;
 if (pw.length >= 12) s++;
 if (/[A-Z]/.test(pw)) s++;
 if (/[0-9]/.test(pw)) s++;
 if (/[^A-Za-z0-9]/.test(pw)) s++;
 return s;
 }

 const levels = [
 { label: '', color: 'transparent', pct: '0%' },
 { label: 'WEAK', color: 'var(--accent-red)', pct: '20%' },
 { label: 'WEAK', color: 'var(--accent-red)', pct: '35%' },
 { label: 'MODERATE', color: 'var(--accent-gold)', pct: '60%' },
 { label: 'STRONG', color: 'var(--accent-green)', pct: '80%' },
 { label: 'SECURE', color: 'var(--accent-green)', pct: '100%' }
 ];
 
 newPwInput?.addEventListener('input', () => {
 const pw = newPwInput.value;
 const score = pw.length === 0 ? 0 : Math.max(1, getStrength(pw));
 const lv = levels[score];
 if (strengthBar) {
 strengthBar.style.width = lv.pct;
 strengthBar.style.background = lv.color;
 }
 if (strengthLabel) {
 strengthLabel.textContent = lv.label;
 strengthLabel.style.color = lv.color;
 }
 checkMatch();
 });

 function checkMatch() {
 const cf = confirmInput?.value;
 if (!cf) {
 if (matchIndicator) matchIndicator.textContent = '';
 return;
 }
 if (newPwInput?.value === cf) {
 if (matchIndicator) {
 matchIndicator.textContent = '✓ Passwords Match';
 matchIndicator.style.color = 'var(--accent-green-text)';
 }
 } else {
 if (matchIndicator) {
 matchIndicator.textContent = '✗ Mismatch Detected';
 matchIndicator.style.color = 'var(--accent-red-text)';
 }
 }
 }

 confirmInput?.addEventListener('input', checkMatch);

 form.addEventListener('submit', async (e) => {
 e.preventDefault();
 const newPassword = newPwInput?.value;
 const confirmPassword = confirmInput?.value;

 if (newPassword.length < 8) {
 if (matchIndicator) {
 matchIndicator.textContent = '✗ Password must be at least 8 characters.';
 matchIndicator.style.color = 'var(--accent-red)';
 }
 return;
 }
 if (newPassword !== confirmPassword) {
 if (matchIndicator) {
 matchIndicator.textContent = '✗ Passwords must match.';
 matchIndicator.style.color = 'var(--accent-red)';
 }
 confirmInput?.focus();
 return;
 }

 submitBtn.textContent = "Updating...";
 submitBtn.disabled = true;

 try {
 // Use the centralized fetch to maintain consistency
 const response = await window.globalApiFetch('/auth/reset-password', {
 method: 'POST',
 body: JSON.stringify({ token: token, new_password: newPassword })
 });
 if (!response) throw new Error("No response from authentication service.");
 const data = await response.json();
 
 if (response.ok) {
 submitBtn.textContent = "Success";
 submitBtn.style.background = "var(--accent-gold)";
 submitBtn.style.borderColor = "var(--accent-gold)";
 submitBtn.style.color = "#fff";
 setTimeout(() => { window.location.href = 'login.html'; }, 1500);
 } else if (response.status === 401) {
 if (expiredOverlay) expiredOverlay.classList.add('show');
 } else {
 submitBtn.textContent = "Update Password";
 submitBtn.disabled = false;
 const msg = data.detail || "Unknown error.";
 if (matchIndicator) {
  matchIndicator.textContent = '✗ ' + msg;
  matchIndicator.style.color = 'var(--accent-red-text)';
 } else {
  alert("Error: " + msg);
 }
 }
 } catch (error) {
 submitBtn.textContent = "Update Password";
 submitBtn.disabled = false;
 if (matchIndicator) {
  matchIndicator.textContent = '✗ Cannot reach the server. Please check connection.';
  matchIndicator.style.color = 'var(--accent-red-text)';
 } else {
  alert("Cannot reach the server.");
 }
 }
 });
});
