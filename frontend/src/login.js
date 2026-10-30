// login.js — Centralized Login Logic
document.addEventListener('DOMContentLoaded', () => {
 const form = document.getElementById('authForm');
 const submitBtn = document.querySelector('.submit-btn');
 const forgotBtn = document.getElementById('forgotBtn');
 const emailInput = document.getElementById('email');
 const pwInput = document.getElementById('password');
 const togglePw = document.getElementById('togglePw');
 const forgotHint = document.getElementById('forgotHint');

 if (!form) return;

 // Propagate redirect parameter to the registration link
 const initialParams = new URLSearchParams(window.location.search);
 const initialRedirect = initialParams.get('redirect');
 if (initialRedirect) {
  const regLink = document.querySelector('.toggle-auth a');
  if (regLink && regLink.getAttribute('href')?.startsWith('register.html')) {
   regLink.setAttribute('href', `register.html?redirect=${encodeURIComponent(initialRedirect)}`);
  }
 }

 // Toggle Password Visibility
 togglePw?.addEventListener('click', () => {
 const isHidden = pwInput.type === 'password';
 pwInput.type = isHidden ? 'text' : 'password';
 togglePw.textContent = isHidden ? 'hide' : 'show';
 });

 // Forgot Password Hint
 forgotBtn?.addEventListener('mouseenter', () => {
 if (!emailInput.value.trim()) forgotHint.classList.add('visible');
 });
 forgotBtn?.addEventListener('mouseleave', () => {
 forgotHint.classList.remove('visible');
 });

 // Handle Login Submit
 form.addEventListener('submit', async (e) => {
 e.preventDefault();
 const emailValue = emailInput.value.trim();
 const passwordValue = pwInput.value;

 submitBtn.textContent = "Authenticating...";
 submitBtn.disabled = true;

 try {
 // Using the globalApiFetch consolidated in global.js
 const response = await window.globalApiFetch('/auth/login', {
 method: 'POST',
 body: JSON.stringify({ email: emailValue, password: passwordValue })
 });
 if (!response) throw new Error("No response from authentication service.");
 const data = await response.json().catch(() => ({}));

 if (response.ok) {
 submitBtn.textContent = "Welcome";
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
  window.location.href = redirect || (data.user.status === 'ADMIN' ? 'admin.html' : 'dashboard.html');
  }, 800);
 } else {
 submitBtn.textContent = "Log In";
 submitBtn.disabled = false;
 const card = document.querySelector('.auth-card');
 if (card) {
 card.style.borderColor = 'var(--accent-red)';
 setTimeout(() => card.style.borderColor = 'var(--grid-border)', 1200);
 }
 const hint = document.getElementById('forgotHint');
 if (hint) {
  hint.textContent = '✗ ' + (data.detail || 'Invalid credentials.');
  hint.style.color = 'var(--accent-red-text)';
  hint.classList.add('visible');
  setTimeout(() => { hint.classList.remove('visible'); hint.style.color = ''; }, 4000);
 } else {
  alert("Access Denied: " + (data.detail || "Invalid credentials."));
 }
 }
 } catch (error) {
 submitBtn.textContent = "Log In";
 submitBtn.disabled = false;
 const hint = document.getElementById('forgotHint');
 if (hint) {
  hint.textContent = '✗ Cannot reach the server. Please check connection.';
  hint.style.color = 'var(--accent-red-text)';
  hint.classList.add('visible');
  setTimeout(() => { hint.classList.remove('visible'); hint.style.color = ''; }, 4000);
 } else {
  alert("Cannot reach the server.");
 }
 }
 });

 // Handle Forgot Password
 forgotBtn?.addEventListener('click', async (e) => {
 e.preventDefault();
 const emailValue = emailInput.value.trim();
 if (!emailValue) {
 forgotHint.classList.add('visible');
 emailInput.focus();
 setTimeout(() => forgotHint.classList.remove('visible'), 3000);
 return;
 }

 const original = submitBtn.textContent;
 submitBtn.textContent = "Sending Email...";
 submitBtn.disabled = true;

 try {
 const response = await window.globalApiFetch('/auth/forgot-password', {
 method: 'POST',
 body: JSON.stringify({ email: emailValue })
 });
 if (!response) throw new Error("No response from authentication service.");
 const data = await response.json().catch(() => ({}));
 if (response.ok) alert(data.message);
 else alert("Request failed: " + (data.detail || "Unknown error."));
 } catch (error) {
 alert("Cannot reach the server.");
 } finally {
 submitBtn.textContent = original;
 submitBtn.disabled = false;
 }
 });
});
