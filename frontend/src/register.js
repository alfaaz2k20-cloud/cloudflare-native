// register.js — Centralized Registration Logic
document.addEventListener('DOMContentLoaded', () => {
 const form = document.getElementById('registerForm');
 const submitBtn = document.querySelector('.submit-btn');
 const passwordInput = document.getElementById('regPassword');
 const confirmInput = document.getElementById('regConfirm');
 const strengthBar = document.getElementById('strengthBar');
 const strengthLabel = document.getElementById('strengthLabel');
 const matchIndicator = document.getElementById('matchIndicator');

 if (!form) return;

 // Propagate redirect parameter to the login link
 const initialParams = new URLSearchParams(window.location.search);
 const initialRedirect = initialParams.get('redirect');
 if (initialRedirect) {
  const loginLink = document.querySelector('.toggle-auth a');
  if (loginLink && loginLink.getAttribute('href')?.startsWith('login.html')) {
   loginLink.setAttribute('href', `login.html?redirect=${encodeURIComponent(initialRedirect)}`);
  }
 }

 // Strength Meter Logic
 function getStrength(pw) {
 let score = 0;
 if (pw.length >= 8) score++;
 if (pw.length >= 12) score++;
 if (/[A-Z]/.test(pw)) score++;
 if (/[0-9]/.test(pw)) score++;
 if (/[^A-Za-z0-9]/.test(pw)) score++;
 return score;
 }

 const strengthLevels = [
 { label: '', color: 'transparent', pct: '0%' },
 { label: 'WEAK', color: 'var(--accent-red)', pct: '20%' },
 { label: 'WEAK', color: 'var(--accent-red)', pct: '35%' },
 { label: 'MODERATE', color: 'var(--accent-gold)', pct: '60%' },
 { label: 'STRONG', color: 'var(--accent-green)', pct: '80%' },
 { label: 'SECURE', color: 'var(--accent-green)', pct: '100%' }
 ];

 passwordInput?.addEventListener('input', () => {
 const pw = passwordInput.value;
 const score = pw.length === 0 ? 0 : Math.max(1, getStrength(pw));
 const level = strengthLevels[score];
 if (strengthBar) {
 strengthBar.style.width = level.pct;
 strengthBar.style.background = level.color;
 }
 if (strengthLabel) {
 strengthLabel.textContent = level.label;
 strengthLabel.style.color = level.color;
 }
 checkMatch();
 });

 function checkMatch() {
 const pw = passwordInput?.value;
 const cf = confirmInput?.value;
 if (!cf) {
 if (matchIndicator) matchIndicator.textContent = '';
 return;
 }
 if (pw === cf) {
 if (matchIndicator) {
 matchIndicator.textContent = '✓ Passwords Match';
 matchIndicator.style.color = 'var(--accent-green)';
 }
 } else {
 if (matchIndicator) {
 matchIndicator.textContent = '✗ Mismatch Detected';
 matchIndicator.style.color = 'var(--accent-red)';
 }
 }
 }

 confirmInput?.addEventListener('input', checkMatch);

 if (window.turnstile && document.getElementById('registerTurnstile')) {
  try {
   window.turnstile.render('#registerTurnstile', {
    sitekey: window.ALFAAZ_TURNSTILE_SITEKEY || '0x4AAAAAAFsRHzhKR6YGsXSy',
    theme: 'light'
   });
  } catch (_) {}
 }

 // Handle Registration Submit
 form.addEventListener('submit', async (e) => {
 e.preventDefault();
 const emailValue = document.getElementById('regEmail')?.value.trim();
 const nameValue = document.getElementById('regName')?.value.trim();
 const passwordValue = passwordInput?.value;
 const confirmValue = confirmInput?.value;

 if (passwordValue.length < 8) {
 if (matchIndicator) {
 matchIndicator.textContent = '✗ Password must be at least 8 characters.';
 matchIndicator.style.color = 'var(--accent-red)';
 }
 return;
 }
 if (passwordValue !== confirmValue) {
 if (matchIndicator) {
 matchIndicator.textContent = '✗ Passwords must match before proceeding.';
 matchIndicator.style.color = 'var(--accent-red)';
 }
 confirmInput?.focus();
 return;
 }
 
 submitBtn.textContent = "Processing...";
 submitBtn.disabled = true;

 try {
 const turnstileToken = window.turnstile ? (window.turnstile.getResponse() || '') : (document.querySelector('[name="cf-turnstile-response"]')?.value || '');
 // Using the globalApiFetch consolidated in global.js
 const response = await window.globalApiFetch('/auth/register', {
 method: 'POST',
 body: JSON.stringify({
 email: emailValue,
 password: passwordValue,
 full_name: nameValue || null,
 turnstile_token: turnstileToken
 })
 });
 if (!response) throw new Error("No response from authentication service.");
 const data = await response.json();

 if (response.ok) {
 submitBtn.textContent = "Account Created";
 submitBtn.style.background = "var(--accent-gold)";
 submitBtn.style.color = "#fff";
 submitBtn.style.borderColor = "var(--accent-gold)";
 
 localStorage.setItem('alfaaz_user', JSON.stringify(data.user));
 localStorage.setItem('alfaaz_token', data.token);

 setTimeout(() => {
 const params = new URLSearchParams(window.location.search);
  let redirect = params.get('redirect');
  if (redirect) {
   const isSafeRelative = /^\/[^/\\]/.test(redirect) || /^[a-zA-Z0-9_-]+\.html(\?.*)?$/.test(redirect);
   if (!isSafeRelative) {
    redirect = null;
   }
  }
  window.location.href = redirect || 'dashboard.html';
 }, 1000);
 } else {
 submitBtn.textContent = "Create Account";
 submitBtn.disabled = false;
 const errMsg = data.detail?.[0]?.msg || data.detail || data.error || "Registration failed.";
 if (matchIndicator) {
  matchIndicator.textContent = '✗ ' + errMsg;
  matchIndicator.style.color = 'var(--accent-red-text)';
 } else {
  alert("Registration Failed: " + errMsg);
 }
 }
 } catch (error) {
 submitBtn.textContent = "Create Account";
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
