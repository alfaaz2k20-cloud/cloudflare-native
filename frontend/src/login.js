// login.js — Centralized Curatorial Auth Suite
// Primary, working authentication with 50/50 dual toggle and honest, curated integration gating

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');
  const authTitle = document.getElementById('authTitle');
  const authTitleEn = document.getElementById('authTitleEn');
  const authSubtitle = document.getElementById('authSubtitle');
  const form = document.getElementById('authForm');
  const submitBtn = document.getElementById('submitBtn');
  const forgotBtn = document.getElementById('forgotBtn');
  const forgotHint = document.getElementById('forgotHint');
  const emailInput = document.getElementById('email');
  const pwInput = document.getElementById('password');
  const togglePw = document.getElementById('togglePw');
  const confirmGroup = document.getElementById('confirmPasswordGroup');
  const confirmPwInput = document.getElementById('confirmPassword');
  const displayNameGroup = document.getElementById('displayNameGroup');
  const regFullName = document.getElementById('regFullName');
  const footerText = document.getElementById('footerText');
  const footerActionLink = document.getElementById('footerActionLink');
  const returnBtn = document.getElementById('returnBtn');

  let currentMode = 'login'; // 'login' | 'register'
  let turnstileToken = '';

  // 1. Safe Redirect Target Evaluation
  const urlParams = new URLSearchParams(window.location.search);
  let redirectTarget = urlParams.get('redirect');
  if (redirectTarget) {
    const isSafeRelative = /^\/[^/\\]/.test(redirectTarget) || /^[a-zA-Z0-9_-]+\.html(\?.*)?$/.test(redirectTarget);
    if (!isSafeRelative) {
      redirectTarget = null;
    } else if (returnBtn) {
      returnBtn.setAttribute('href', redirectTarget);
    }
  }

  // Check URL mode parameter (?mode=register or register.html)
  if (urlParams.get('mode') === 'register' || window.location.pathname.includes('register.html')) {
    setAuthMode('register');
  }

  // 2. Dual Segmented Toggle Handler (Zero layout shift)
  function setAuthMode(mode) {
    currentMode = mode;
    if (mode === 'register') {
      tabRegister?.classList.add('active');
      tabRegister?.setAttribute('aria-selected', 'true');
      tabLogin?.classList.remove('active');
      tabLogin?.setAttribute('aria-selected', 'false');

      if (authTitle) authTitle.setAttribute('data-ur', 'شمولیت');
      if (authTitleEn) authTitleEn.textContent = 'Register';
      if (authSubtitle) authSubtitle.textContent = 'Join the collective';
      if (submitBtn) submitBtn.textContent = 'Create Account';

      if (displayNameGroup) displayNameGroup.style.display = 'block';
      if (confirmGroup) confirmGroup.style.display = 'block';
      if (forgotBtn) forgotBtn.style.display = 'none';

      if (footerText) footerText.textContent = 'Already in the collective?';
      if (footerActionLink) footerActionLink.textContent = 'Log In';
    } else {
      tabLogin?.classList.add('active');
      tabLogin?.setAttribute('aria-selected', 'true');
      tabRegister?.classList.remove('active');
      tabRegister?.setAttribute('aria-selected', 'false');

      if (authTitle) authTitle.setAttribute('data-ur', 'داخلہ');
      if (authTitleEn) authTitleEn.textContent = 'Login';
      if (authSubtitle) authSubtitle.textContent = 'Access your account';
      if (submitBtn) submitBtn.textContent = 'Log In';

      if (displayNameGroup) displayNameGroup.style.display = 'none';
      if (confirmGroup) confirmGroup.style.display = 'none';
      if (forgotBtn) forgotBtn.style.display = 'block';

      if (footerText) footerText.textContent = 'New to the collective?';
      if (footerActionLink) footerActionLink.textContent = 'Register here';
    }
  }

  tabLogin?.addEventListener('click', () => setAuthMode('login'));
  tabRegister?.addEventListener('click', () => setAuthMode('register'));
  footerActionLink?.addEventListener('click', (e) => {
    e.preventDefault();
    setAuthMode(currentMode === 'login' ? 'register' : 'login');
  });

  // 3. Password Visibility Toggle
  togglePw?.addEventListener('click', () => {
    const isHidden = pwInput.type === 'password';
    pwInput.type = isHidden ? 'text' : 'password';
    togglePw.textContent = isHidden ? 'hide' : 'show';
  });

  // 4. Lost Password Hint Behavior
  forgotBtn?.addEventListener('mouseenter', () => {
    if (!emailInput?.value?.trim() && forgotHint) forgotHint.classList.add('visible');
  });
  forgotBtn?.addEventListener('mouseleave', () => {
    if (forgotHint) forgotHint.classList.remove('visible');
  });

  // 5. Cloudflare Turnstile Integration
  function initTurnstile() {
    const container = document.getElementById('loginTurnstile');
    const sitekey = window.ALFAAZ_TURNSTILE_SITEKEY || '0x4AAAAAAFsRHzhKR6YGsXSy';
    if (window.turnstile && container && !container.hasChildNodes()) {
      try {
        window.turnstile.render('#loginTurnstile', {
          sitekey: sitekey,
          theme: 'light',
          callback: (token) => { turnstileToken = token; },
          'expired-callback': () => { turnstileToken = ''; }
        });
      } catch (err) {
        console.warn('Turnstile render warning:', err);
      }
    }
  }

  if (window.turnstile) {
    initTurnstile();
  } else {
    window.addEventListener('load', () => {
      setTimeout(initTurnstile, 400);
      setTimeout(() => {
        const container = document.getElementById('loginTurnstile');
        if (!window.turnstile && container && !container.hasChildNodes()) {
          container.innerHTML = '<div style="font-size:10px; color:var(--accent-gold-text); line-height:1.4; text-align:center; padding:6px; border:1px dashed var(--accent-gold); border-radius:3px;">Security verification taking longer to load.<br>If you use an aggressive ad-blocker, please allow Cloudflare Turnstile.</div>';
        }
      }, 3500);
    });
  }

  function showHint(message, isSuccess = false) {
    if (!forgotHint) return;
    forgotHint.textContent = (isSuccess ? '✓ ' : '✗ ') + message;
    forgotHint.style.color = isSuccess ? 'var(--accent-green-text)' : 'var(--accent-red-text)';
    forgotHint.classList.add('visible');
    setTimeout(() => {
      forgotHint.classList.remove('visible');
      forgotHint.style.color = '';
    }, 5000);
  }

  // 6. Primary Form Submit (Email & Password)
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailValue = emailInput.value.trim();
    const passwordValue = pwInput.value;
    const fullNameValue = regFullName?.value?.trim() || '';

    if (currentMode === 'register') {
      const confirmValue = confirmPwInput?.value || '';
      if (passwordValue !== confirmValue) {
        showHint('Passwords do not match.');
        confirmPwInput?.focus();
        return;
      }
    }

    submitBtn.textContent = currentMode === 'register' ? 'Creating Account...' : 'Authenticating...';
    submitBtn.disabled = true;

    const endpoint = currentMode === 'register' ? '/auth/register' : '/auth/login';
    const payload = {
      email: emailValue,
      password: passwordValue,
      turnstile_token: turnstileToken,
      ...(currentMode === 'register' && fullNameValue ? { full_name: fullNameValue } : {})
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.token) {
        submitBtn.textContent = 'Welcome';
        submitBtn.style.background = 'var(--accent-gold)';
        submitBtn.style.color = '#fff';
        submitBtn.style.borderColor = 'var(--accent-gold)';

        localStorage.setItem('alfaaz_user', JSON.stringify(data.user));
        localStorage.setItem('alfaaz_token', data.token);

        setTimeout(() => {
          const defaultDest = (data.user?.status === 'ADMIN' || data.user?.role === 'ADMIN') ? 'admin.html' : 'dashboard.html';
          window.location.href = redirectTarget || defaultDest;
        }, 700);
      } else {
        submitBtn.textContent = currentMode === 'register' ? 'Create Account' : 'Log In';
        submitBtn.disabled = false;
        if (window.turnstile) { try { window.turnstile.reset(); turnstileToken = ''; } catch (_) {} }
        showHint(data.detail || data.error || 'Authentication failed. Please check credentials.');
      }
    } catch (error) {
      submitBtn.textContent = currentMode === 'register' ? 'Create Account' : 'Log In';
      submitBtn.disabled = false;
      showHint('Cannot reach server. Please check your connection.');
    }
  });

  // 7. Lost Password Recovery
  forgotBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    const emailValue = emailInput.value.trim();
    if (!emailValue) {
      showHint('Enter your email above, then click "Lost Password?"');
      emailInput.focus();
      return;
    }

    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Sending Email...';
    submitBtn.disabled = true;

    try {
      const response = await fetch('/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailValue, turnstile_token: turnstileToken })
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        showHint(data.message || 'If registered, a reset link was sent.', true);
        if (window.turnstile) { try { window.turnstile.reset(); turnstileToken = ''; } catch (_) {} }
      } else {
        showHint(data.detail || 'Password reset request failed.');
      }
    } catch (err) {
      showHint('Cannot reach server. Please check your connection.');
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });
});
