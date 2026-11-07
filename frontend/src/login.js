// login.js — Centralized Sovereign Auth Suite
// Primary Cloudflare-native authentication with 50/50 dual toggle and GIS One-Tap

let currentMode = 'login'; // Module-scoped: 'login' | 'register'

function normalizeE164Phone(raw, prefixInput = "+91") {
  if (!raw) return null;
  let trimmed = String(raw).trim();
  if (trimmed.startsWith("+")) {
    let clean = "+" + trimmed.slice(1).replace(/\D/g, "");
    return /^\+[1-9]\d{6,14}$/.test(clean) ? clean : null;
  }
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) digits = digits.slice(1);
  const prefix = prefixInput || "+91";
  const full = (prefix.startsWith("+") ? prefix : "+" + prefix) + digits;
  return /^\+[1-9]\d{6,14}$/.test(full) ? full : null;
}

function getApiUrl(endpoint) {
  const base = (window.ALFAAZ_API_URL || '').replace(/\/$/, '');
  const path = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
  return `${base}${path}`;
}

async function federatedLogin(idToken, provider, mode) {
  const url = getApiUrl('/auth/federated-login');
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: idToken, provider, mode })
    });
  } catch (netErr) {
    console.error('[FEDERATED AUTH NETWORK ERROR]', netErr, 'URL was:', url);
    const err = new Error('Could not reach backend auth server. Please ensure local server is running on ' + window.location.origin);
    err.code = 'NETWORK_ERROR';
    throw err;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) {
    const err = new Error(data.error || data.detail || 'Provider authentication failed.');
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
}

function finalizeAuth(data, redirectTarget, mode = currentMode) {
  try {
    if (data?.user) {
      localStorage.setItem('alfaaz_user', JSON.stringify(data.user));
    }
    if (data?.token) {
      localStorage.setItem('alfaaz_token', data.token);
    }

    if (mode === 'register' || data?.is_new_user) {
      sessionStorage.setItem('alfaaz_just_joined', 'true');
    }

    const defaultDest = (data?.user?.status === 'ADMIN' || data?.user?.role === 'ADMIN') ? 'admin.html' : 'dashboard.html';
    const finalDest = redirectTarget || defaultDest;

    const isAdmin = data?.user?.status === 'ADMIN' || data?.user?.role === 'ADMIN';
    const isMissingPhone = !isAdmin && data?.user && !data.user.phone;
    const isMissingEmail = !isAdmin && data?.user && !data.user.email_verified && !data.user.auth_provider?.includes('google');

    if (isMissingPhone && document.getElementById('verificationStep')) {
      setTimeout(() => {
        showVerificationStep(data.user, data.token, finalDest, 'whatsapp');
      }, 400);
    } else if (isMissingEmail && document.getElementById('verificationStep')) {
      setTimeout(() => {
        showVerificationStep(data.user, data.token, finalDest, 'email');
      }, 400);
    } else {
      setTimeout(() => {
        window.location.href = finalDest;
      }, 500);
    }
  } catch (err) {
    console.error('[FINALIZE AUTH RECOVERY]', err);
    const defaultDest = (data?.user?.status === 'ADMIN' || data?.user?.role === 'ADMIN') ? 'admin.html' : 'dashboard.html';
    window.location.href = redirectTarget || defaultDest;
  }
}

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
  const socialAuthHint = document.getElementById('socialAuthHint');
  const emailInput = document.getElementById('email');
  const pwInput = document.getElementById('password');
  const togglePw = document.getElementById('togglePw');
  const confirmGroup = document.getElementById('confirmPasswordGroup');
  const confirmPwInput = document.getElementById('confirmPassword');
  const displayNameGroup = document.getElementById('displayNameGroup');
  const regFullName = document.getElementById('regFullName');
  const whatsappGroup = document.getElementById('whatsappGroup');
  const whatsappInput = document.getElementById('whatsappNumber');
  const regCountryPrefix = document.getElementById('regCountryPrefix');
  const footerText = document.getElementById('footerText');
  const footerActionLink = document.getElementById('footerActionLink');
  const returnBtn = document.getElementById('returnBtn');

  currentMode = 'login'; // 'login' | 'register'
  let turnstileToken = '';
  let gisInitialized = false;
  let gisLoadFailed = false;
  let isFederatedAuthInProgress = false;

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

  // Helper to resolve Google Client ID reliably
  function getGoogleClientId() {
    return (window.ALFAAZ_GOOGLE_CLIENT_ID || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_CLIENT_ID) || '').trim();
  }

  // Helper to render or update GIS button cleanly without iframe duplication
  function renderGisButton() {
    const gisContainer = document.getElementById('googleBtnContainer');
    const clientId = getGoogleClientId();
    if (!gisContainer || !clientId || !window.google?.accounts?.id || !gisInitialized) return;

    // Reset container to avoid duplicate iframes on re-rendering or tab switching
    gisContainer.innerHTML = '';
    gisContainer.style.display = 'flex';

    const containerWidth = gisContainer.clientWidth || 320;
    const buttonWidth = Math.min(320, Math.max(200, Math.floor(containerWidth)));

    try {
      window.google.accounts.id.renderButton(gisContainer, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: currentMode === 'register' ? 'signup_with' : 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: buttonWidth
      });
    } catch (err) {
      console.warn('GIS renderButton error:', err);
    }
  }

  // Check URL mode parameter (?mode=register or register.html)
  if (urlParams.get('mode') === 'register' || window.location.pathname.includes('register.html')) {
    setAuthMode('register');
  }

  // 2. Dual Segmented Toggle Handler (Zero layout shift)
  function setAuthMode(mode) {
    currentMode = mode;
    const socialDividerText = document.getElementById('socialDividerText');
    const googleBtn = document.getElementById('btnGoogleAuth');
    const clientId = getGoogleClientId();

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
      if (whatsappGroup) whatsappGroup.style.display = 'block';
      if (confirmGroup) confirmGroup.style.display = 'block';
      regFullName?.setAttribute('required', 'true');
      whatsappInput?.setAttribute('required', 'true');
      confirmPwInput?.setAttribute('required', 'true');
      if (forgotBtn) forgotBtn.style.display = 'none';

      if (footerText) footerText.textContent = 'Already in the collective?';
      if (footerActionLink) footerActionLink.textContent = 'Log In';

      if (socialDividerText) socialDividerText.textContent = 'or register with your details';
      if (googleBtn) {
        googleBtn.setAttribute('aria-label', clientId ? 'Sign up with Google' : 'Sign up with Google (Coming Soon)');
      }
      renderGisButton();
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
      if (whatsappGroup) whatsappGroup.style.display = 'none';
      if (confirmGroup) confirmGroup.style.display = 'none';
      regFullName?.removeAttribute('required');
      whatsappInput?.removeAttribute('required');
      confirmPwInput?.removeAttribute('required');
      if (forgotBtn) forgotBtn.style.display = 'block';

      if (footerText) footerText.textContent = 'New to the collective?';
      if (footerActionLink) footerActionLink.textContent = 'Register here';

      if (socialDividerText) socialDividerText.textContent = 'or continue with email';
      if (googleBtn) {
        googleBtn.setAttribute('aria-label', clientId ? 'Sign in with Google' : 'Sign in with Google (Coming Soon)');
      }
      renderGisButton();
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
    togglePw.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
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
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '[::1]';
    // On localhost, always use 1x00000000000000000000AA to avoid 110200 Domain Mismatch
    const sitekey = isLocal ? '1x00000000000000000000AA' : (window.ALFAAZ_TURNSTILE_SITEKEY || '0x4AAAAAAFsRHzhKR6YGsXSy');
    if (window.turnstile && container && !container.hasChildNodes()) {
      try {
        window.turnstile.render('#loginTurnstile', {
          sitekey: sitekey,
          theme: 'light',
          callback: (token) => {
            turnstileToken = token;
          },
          'expired-callback': () => { turnstileToken = ''; },
          'error-callback': (code) => {
            console.error('Turnstile verification error:', code);
            turnstileToken = '';
            if (isLocal) {
              // In local dev, gracefully inform developer without blocking submission
              const container = document.getElementById('loginTurnstile');
              if (container) {
                container.innerHTML = '<div style="font-size:10px; color:var(--text-secondary); line-height:1.4; text-align:center; padding:6px; border:1px dashed var(--grid-border); border-radius:3px;">Local Dev Mode: Turnstile bypassed for localhost.</div>';
              }
              turnstileToken = 'dummy-local-pass-token';
            } else {
              showHint('Security verification encountered a network interruption. Resetting challenge, please retry.');
              try {
                if (window.turnstile && typeof window.turnstile.reset === 'function') {
                  setTimeout(() => {
                    try { window.turnstile.reset('#loginTurnstile'); } catch (_) {}
                  }, 1000);
                }
              } catch (resetErr) {
                console.warn('Turnstile reset error:', resetErr);
              }
            }
          }
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

  let forgotHintTimer = null;
  function showHint(message, isSuccess = false) {
    if (!forgotHint) return;
    clearTimeout(forgotHintTimer);
    forgotHint.textContent = (isSuccess ? '✓ ' : '✗ ') + message;
    forgotHint.style.color = isSuccess ? 'var(--accent-green-text)' : 'var(--accent-red-text)';
    forgotHint.classList.add('visible');
    forgotHintTimer = setTimeout(() => {
      forgotHint.classList.remove('visible');
      forgotHint.style.color = '';
    }, 6000);
  }

  let socialHintTimer = null;
  function showSocialHint(message, isSuccess = false) {
    if (!socialAuthHint) {
      showHint(message, isSuccess);
      return;
    }
    clearTimeout(socialHintTimer);
    socialAuthHint.textContent = (isSuccess ? '✓ ' : 'ⓘ ') + message;
    socialAuthHint.style.color = isSuccess ? 'var(--accent-green-text)' : 'var(--accent-gold)';
    socialAuthHint.style.display = 'block';
    socialHintTimer = setTimeout(() => {
      socialAuthHint.style.display = 'none';
      socialAuthHint.textContent = '';
    }, 8000);
  }

  // 6. Primary Form Submit (Email & Password + WhatsApp on Register)
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isFederatedAuthInProgress) return;
    const emailValue = emailInput.value.trim();
    const passwordValue = pwInput.value;
    const fullNameValue = regFullName?.value?.trim() || '';

    let whatsappNormalized = '';
    if (currentMode === 'register') {
      if (!fullNameValue || fullNameValue.length < 2) {
        showHint('Please enter your full name (at least 2 characters).');
        regFullName?.focus();
        return;
      }
      if (fullNameValue.length > 80) {
        showHint('Full name must be under 80 characters.');
        regFullName?.focus();
        return;
      }
      const selectedPrefix = regCountryPrefix ? regCountryPrefix.value : '+91';
      whatsappNormalized = normalizeE164Phone(whatsappInput?.value, selectedPrefix) || '';
      if (!whatsappNormalized) {
        showHint('Please enter a valid WhatsApp mobile number (e.g. 9876543210).');
        whatsappInput?.focus();
        return;
      }

      const confirmValue = confirmPwInput?.value || '';
      if (passwordValue !== confirmValue) {
        showHint('Passwords do not match.');
        confirmPwInput?.focus();
        return;
      }
    }

    const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '[::1]';
    if (!turnstileToken && window.turnstile && !isLocalHost) {
      showHint('Please complete the security challenge below.');
      const tEl = document.getElementById('loginTurnstile');
      if (tEl) {
        tEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        tEl.style.transition = 'outline 0.3s ease';
        tEl.style.outline = '2px solid var(--accent-gold)';
        setTimeout(() => { tEl.style.outline = 'none'; }, 2500);
      }
      return;
    }

    submitBtn.textContent = currentMode === 'register' ? 'Creating Account...' : 'Authenticating...';
    submitBtn.disabled = true;

    const endpoint = currentMode === 'register' ? '/auth/register' : '/auth/login';
    const effectiveTurnstileToken = turnstileToken || (isLocalHost ? 'dummy-local-pass-token' : '');
    const payload = {
      email: emailValue,
      password: passwordValue,
      turnstile_token: effectiveTurnstileToken,
      ...(currentMode === 'register' ? { full_name: fullNameValue, phone: whatsappNormalized } : {})
    };

    try {
      const response = await fetch(getApiUrl(endpoint), {
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
        markAuthSuccess('email');
        finalizeAuth(data, redirectTarget, currentMode);
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
      const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '[::1]';
      const effectiveTurnstileToken = turnstileToken || (isLocalHost ? 'dummy-local-pass-token' : '');
      const response = await fetch(getApiUrl('/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailValue, turnstile_token: effectiveTurnstileToken })
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

  function markAuthSuccess() {
    if (submitBtn) {
      submitBtn.textContent = 'Welcome';
      submitBtn.style.background = 'var(--accent-gold)';
      submitBtn.style.color = '#fff';
      submitBtn.style.borderColor = 'var(--accent-gold)';
    }
    const authSub = document.getElementById('authSubtitle');
    if (authSub) {
      authSub.textContent = '✓ Authenticated successfully. Redirecting...';
      authSub.style.color = 'var(--accent-green-text)';
    }
  }

  // Google Identity Services (GIS) Native Integration (Zero Firebase)
  function initGoogleIdentity() {
    const googleBtn = document.getElementById('btnGoogleAuth');
    const gisContainer = document.getElementById('googleBtnContainer');
    const clientId = getGoogleClientId();

    if (!clientId) {
      // Visibly gated per Rule 4: Zero-Facade Engineering
      if (gisContainer) {
        gisContainer.style.display = 'none';
        gisContainer.innerHTML = '';
      }
      const socialGrid = document.querySelector('.social-buttons-grid');
      if (socialGrid) {
        socialGrid.classList.remove('has-active-google');
      }
      if (googleBtn) {
        googleBtn.style.display = '';
        googleBtn.classList.add('gated');
        googleBtn.setAttribute('title', 'Google Sign-In is awaiting Google OAuth Client ID setup (Coming Soon)');
        googleBtn.setAttribute('aria-label', currentMode === 'register' ? 'Sign up with Google (Coming Soon)' : 'Sign in with Google (Coming Soon)');
        if (!googleBtn.querySelector('.gated-pill')) {
          const pill = document.createElement('span');
          pill.className = 'gated-pill';
          pill.textContent = 'Soon';
          googleBtn.appendChild(pill);
        }
      }
      return;
    }

    // Configured state: hide redundant fake button in grid and show official Google button
    const socialGrid = document.querySelector('.social-buttons-grid');
    if (googleBtn) {
      googleBtn.style.display = 'none';
      googleBtn.classList.remove('gated');
      googleBtn.removeAttribute('title');
      const pill = googleBtn.querySelector('.gated-pill');
      if (pill) pill.remove();
      googleBtn.setAttribute('aria-label', currentMode === 'register' ? 'Sign up with Google' : 'Sign in with Google');
    }
    if (socialGrid) {
      socialGrid.classList.add('has-active-google');
    }

    if (!window.google?.accounts?.id || gisInitialized) {
      return;
    }

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          if (response && response.credential) {
            if (isFederatedAuthInProgress || (submitBtn && submitBtn.disabled && submitBtn.textContent.includes('...'))) return;
            isFederatedAuthInProgress = true;
            if (submitBtn) submitBtn.disabled = true;
            try {
              showSocialHint('Authenticating with Google...', true);
              const data = await federatedLogin(response.credential, 'google', currentMode);
              markAuthSuccess();
              finalizeAuth(data, redirectTarget, currentMode);
            } catch (err) {
              console.error('[GIS AUTH HANDLER ERROR]', err);
              isFederatedAuthInProgress = false;
              if (submitBtn) submitBtn.disabled = false;
              if (err.status === 404 || err.code === 'ACCOUNT_NOT_FOUND') {
                setAuthMode('register');
                showHint(err.message || 'No account found. Please register below with your WhatsApp number to join.');
                showSocialHint('');
              } else if (err.code === 'NETWORK_ERROR' || (err.message && (err.message.includes('reach backend') || err.message.includes('Failed to fetch')))) {
                showSocialHint(err.message || 'Connection to auth server failed. Please ensure local server is running.');
              } else {
                showSocialHint(err.message || 'Google authentication failed.');
              }
            }
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true
      });

      gisInitialized = true;
      renderGisButton();

      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          console.log('GIS One-Tap status:', notification.getNotDisplayedReason?.() || notification.getSkippedReason?.() || 'skipped');
        }
      });
    } catch (err) {
      console.warn('GIS init error:', err);
    }
  }

  // 1. Immediately evaluate configuration state (synchronously gates unconfigured state on DOM load)
  initGoogleIdentity();

  // 2. If client ID is present, initialize GIS when library loads
  if (getGoogleClientId() && !gisInitialized) {
    if (window.google?.accounts?.id) {
      initGoogleIdentity();
    } else {
      const gsiScript = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
      let attempts = 0;
      let pollInterval = null;
      if (gsiScript) {
        gsiScript.addEventListener('load', () => {
          if (!gisInitialized) initGoogleIdentity();
        });
        gsiScript.addEventListener('error', () => {
          gisLoadFailed = true;
          if (pollInterval) clearInterval(pollInterval);
        });
      }
      pollInterval = setInterval(() => {
        attempts++;
        if (window.google?.accounts?.id) {
          clearInterval(pollInterval);
          initGoogleIdentity();
        } else if (attempts >= 50) {
          clearInterval(pollInterval);
          gisLoadFailed = true;
        }
      }, 150);
      window.addEventListener('load', () => {
        if (!gisInitialized && !gisLoadFailed) {
          setTimeout(initGoogleIdentity, 200);
        }
      });
    }
  }

  // 3. Responsive GIS button re-render on viewport resize
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (!gisInitialized) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      renderGisButton();
    }, 200);
  });

  document.getElementById('btnGoogleAuth')?.addEventListener('click', () => {
    if (isFederatedAuthInProgress || (submitBtn && submitBtn.disabled && submitBtn.textContent.includes('...'))) return;
    const clientId = getGoogleClientId();
    if (clientId) {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment() || notification.isDismissedMoment?.()) {
            const reason = notification.getNotDisplayedReason?.() || notification.getSkippedReason?.() || notification.getDismissedReason?.() || '';
            console.log('GIS One-Tap prompt status:', reason);
            const gisContainer = document.getElementById('googleBtnContainer');
            if (gisContainer) {
              gisContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }
        });
      } else if (gisLoadFailed) {
        showSocialHint('Google Sign-In could not be loaded. Please continue with the form below.');
      } else {
        showSocialHint('Google Identity Services is loading. Please try again in a moment.');
      }
    } else {
      showSocialHint(
        currentMode === 'register'
          ? 'Google Sign-In is awaiting Google OAuth Client ID setup. Please register with your Full Name, WhatsApp, Email & Password below.'
          : 'Google Sign-In is awaiting Google OAuth Client ID setup. Please log in with your Email & Password below.'
      );
    }
  });

  document.getElementById('btnAppleAuth')?.addEventListener('click', () => {
    showSocialHint('Apple Sign-In is in developer onboarding. Please use the form below.');
  });

  document.getElementById('btnMetaAuth')?.addEventListener('click', () => {
    showSocialHint('Meta Sign-In is in developer review. Please use the form below.');
  });
});


  function showVerificationStep(user, token, redirectTarget, mode) {
    const dest = redirectTarget || 'dashboard.html';
    const verifStep = document.getElementById('verificationStep');
    if (!verifStep) {
      window.location.href = dest;
      return;
    }

    const authForm = document.getElementById('authForm');
    if (authForm) authForm.style.display = 'none';
    const nav = document.querySelector('.auth-segmented-nav');
    if (nav) nav.style.display = 'none';
    const phoneSection = document.querySelector('.phone-auth-section');
    if (phoneSection) phoneSection.style.display = 'none';
    document.querySelectorAll('.auth-divider').forEach(d => d.style.display = 'none');
    const socialGrid = document.querySelector('.social-buttons-grid');
    if (socialGrid) socialGrid.style.display = 'none';
    const gisContainer = document.getElementById('googleBtnContainer');
    if (gisContainer) {
      gisContainer.style.display = 'none';
      gisContainer.innerHTML = '';
    }
    const socialHint = document.getElementById('socialAuthHint');
    if (socialHint) {
      socialHint.style.display = 'none';
      socialHint.textContent = '';
    }
    const turnstileContainer = document.getElementById('loginTurnstile');
    if (turnstileContainer) turnstileContainer.style.display = 'none';
    const toggleFooter = document.getElementById('toggleAuthFooter');
    if (toggleFooter) toggleFooter.style.display = 'none';
    const authSub = document.getElementById('authSubtitle');
    if (authSub) {
      authSub.textContent = mode === 'whatsapp' ? 'Complete your profile' : 'Account verification required';
      authSub.style.color = 'var(--text-secondary)';
    }

    verifStep.style.display = 'block';

    const titleEl = document.getElementById('verifStepTitle');
    const descEl = document.getElementById('verifStepDesc');
    const phoneGroup = document.getElementById('verifPhoneGroup');
    const countryPrefixSelect = document.getElementById('verifCountryPrefix');
    const phoneInput = document.getElementById('verifPhoneInput');
    const saveWhatsAppBtn = document.getElementById('saveWhatsAppBtn');
    const targetGroup = document.getElementById('verifTargetGroup');
    const targetLabel = document.getElementById('verifTargetLabel');
    const targetInput = document.getElementById('verifTarget');
    const sendBtn = document.getElementById('sendCodeBtn');
    const codeGroup = document.getElementById('verifCodeGroup');
    const codeInput = document.getElementById('verifCode');
    const confirmBtn = document.getElementById('confirmCodeBtn');
    const skipLink = document.getElementById('skipVerifLink');

    if (skipLink) {
      skipLink.href = dest;
    }

    // Determine actual purpose: 'whatsapp' (NO OTP), 'email' (Email OTP)
    const isWhatsAppMode = mode === 'whatsapp' || !user.phone;

    if (isWhatsAppMode) {
      // 1. WhatsApp Capture (NO OTP, MANDATORY - Cannot skip)
      if (titleEl) titleEl.textContent = 'WhatsApp Mobile Number';
      if (descEl) descEl.textContent = 'WhatsApp contact is mandatory for all Alfaaz Collective members to receive invitations and announcements.';
      if (phoneGroup) phoneGroup.style.display = 'block';
      if (targetGroup) targetGroup.style.display = 'none';
      if (codeGroup) codeGroup.style.display = 'none';
      if (sendBtn) sendBtn.style.display = 'none';
      if (confirmBtn) confirmBtn.style.display = 'none';
      if (skipLink) skipLink.style.display = 'none';
      const skipContainer = document.getElementById('skipVerifContainer');
      if (skipContainer) skipContainer.style.display = 'none';
      if (saveWhatsAppBtn) {
        saveWhatsAppBtn.style.display = 'block';
        saveWhatsAppBtn.textContent = 'Save & Continue →';
        saveWhatsAppBtn.disabled = false;
        if (phoneInput) {
          phoneInput.value = user.phone || '';
          setTimeout(() => phoneInput.focus(), 100);
        }

        saveWhatsAppBtn.onclick = async () => {
          const rawNum = phoneInput ? phoneInput.value.trim() : '';
          const prefix = countryPrefixSelect ? countryPrefixSelect.value : '+91';
          const fullNumber = rawNum.startsWith('+') ? rawNum : (prefix + rawNum.replace(/\D/g, ''));
          
          if (!/^\+[1-9]\d{6,14}$/.test(fullNumber)) {
            alert('Please enter a valid WhatsApp mobile number in E.164 format (e.g., +919876543210).');
            return;
          }

          saveWhatsAppBtn.disabled = true;
          saveWhatsAppBtn.textContent = 'Saving...';

          try {
            const res = await fetch(getApiUrl('/auth/me'), {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
              },
              body: JSON.stringify({ phone: fullNumber })
            });
            const resData = await res.json().catch(() => ({}));
            if (res.ok) {
              user.phone = fullNumber;
              user.phone_verified = 0;
              localStorage.setItem('alfaaz_user', JSON.stringify(user));
              saveWhatsAppBtn.textContent = 'Saved ✓';
              saveWhatsAppBtn.style.background = 'var(--accent-green)';
              saveWhatsAppBtn.style.color = '#fff';
              setTimeout(() => {
                window.location.href = dest;
              }, 500);
            } else {
              alert(resData.detail || resData.error || 'Failed to save WhatsApp number.');
              saveWhatsAppBtn.disabled = false;
              saveWhatsAppBtn.textContent = 'Save & Continue →';
            }
          } catch (e) {
            alert('Network error saving WhatsApp number: ' + e.message);
            saveWhatsAppBtn.disabled = false;
            saveWhatsAppBtn.textContent = 'Save & Continue →';
          }
        };
      }
    } else {
      // 2. Email Cross-Verification (Code sent to email)
      if (titleEl) titleEl.textContent = 'Email Cross-Verification';
      if (descEl) descEl.textContent = 'To secure your account, please verify your email address. You can skip this for now and complete it later.';
      if (phoneGroup) phoneGroup.style.display = 'none';
      if (saveWhatsAppBtn) saveWhatsAppBtn.style.display = 'none';
      if (targetGroup) targetGroup.style.display = 'block';
      const emailSkipContainer = document.getElementById('skipVerifContainer');
      if (emailSkipContainer) emailSkipContainer.style.display = 'block';
      if (skipLink) skipLink.style.display = '';
      if (targetLabel) targetLabel.textContent = 'Email Address';
      if (targetInput) {
        targetInput.type = 'email';
        targetInput.value = user.email || '';
        targetInput.placeholder = 'you@example.com';
      }
      if (sendBtn) {
        sendBtn.style.display = 'block';
        sendBtn.onclick = async () => {
          const val = targetInput ? targetInput.value.trim() : '';
          if (!val) {
            alert('Please enter a valid email address.');
            return;
          }
          sendBtn.disabled = true;
          sendBtn.textContent = 'Sending...';
          try {
            const res = await fetch(getApiUrl('/verification/email/send'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
              },
              body: JSON.stringify({ email: val })
            });
            const resData = await res.json().catch(() => ({}));
            if (res.ok) {
              sendBtn.textContent = 'Code Sent';
              sendBtn.style.display = 'none';
              if (codeGroup) codeGroup.style.display = 'block';
              if (confirmBtn) confirmBtn.style.display = 'block';
              if (codeInput) codeInput.focus();
            } else {
              alert(resData.error || 'Failed to dispatch verification code.');
              sendBtn.disabled = false;
              sendBtn.textContent = 'Send Code';
            }
          } catch (e) {
            alert('Error dispatching code: ' + e.message);
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send Code';
          }
        };
      }

      if (confirmBtn) {
        confirmBtn.onclick = async () => {
          const code = codeInput ? codeInput.value.trim() : '';
          if (code.length !== 6) {
            alert('Please enter a 6-digit code.');
            return;
          }
          confirmBtn.disabled = true;
          confirmBtn.textContent = 'Verifying...';
          try {
            const res = await fetch(getApiUrl('/verification/email/confirm'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
              },
              body: JSON.stringify({ code })
            });
            const resData = await res.json().catch(() => ({}));
            if (res.ok) {
              confirmBtn.textContent = 'Verified ✓';
              confirmBtn.style.background = 'var(--accent-green)';
              confirmBtn.style.color = '#fff';
              setTimeout(() => {
                window.location.href = dest;
              }, 800);
            } else {
              alert(resData.error || 'Invalid or expired verification code.');
              confirmBtn.disabled = false;
              confirmBtn.textContent = 'Confirm';
            }
          } catch (e) {
            alert('Error verifying code: ' + e.message);
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Confirm';
          }
        };
      }
    }
  }
