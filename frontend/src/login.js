// login.js — Centralized Sovereign Auth Suite
// Primary Cloudflare-native authentication with 50/50 dual toggle and GIS One-Tap

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

async function federatedLogin(idToken, provider) {
  const res = await fetch('/auth/federated-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_token: idToken, provider })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) {
    throw new Error(data.error || data.detail || 'Provider authentication failed.');
  }
  return data;
}

function finalizeAuth(data, redirectTarget) {
  localStorage.setItem('alfaaz_user', JSON.stringify(data.user));
  localStorage.setItem('alfaaz_token', data.token);

  const defaultDest = (data.user?.status === 'ADMIN' || data.user?.role === 'ADMIN') ? 'admin.html' : 'dashboard.html';
  const finalDest = redirectTarget || defaultDest;

  const isAdmin = data.user?.status === 'ADMIN' || data.user?.role === 'ADMIN';
  const needsCrossVerification = !isAdmin && data.user && (!data.user.email_verified || !data.user.phone_verified);
  if (needsCrossVerification && document.getElementById('verificationStep')) {
    setTimeout(() => {
      showVerificationStep(data.user, data.token, finalDest);
    }, 400);
  } else {
    setTimeout(() => {
      window.location.href = finalDest;
    }, 700);
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
    const socialDividerText = document.getElementById('socialDividerText');
    const googleBtn = document.getElementById('btnGoogleAuth');
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
      if (googleBtn) googleBtn.setAttribute('aria-label', 'Sign up with Google');
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
      if (googleBtn) googleBtn.setAttribute('aria-label', 'Sign in with Google');
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
          callback: (token) => {
            turnstileToken = token;
            if (phoneHint && phoneHint.textContent.includes('security verification')) {
              setPhoneHint('Security verified. Proceeding with your code...', true);
              if (sendOtpBtn && !sendOtpBtn.disabled) {
                setTimeout(() => sendOtpBtn.click(), 400);
              }
            }
          },
          'expired-callback': () => { turnstileToken = ''; },
          'error-callback': (code) => {
            console.error('Turnstile verification error:', code);
            const container = document.getElementById('loginTurnstile');
            if (container) {
              container.innerHTML = '<div style="font-size:11px; color:var(--accent-red-text); line-height:1.4; text-align:center; padding:8px; border:1px dashed var(--accent-red); border-radius:3px;">Security challenge error (code: ' + code + ').<br>If on workers.dev or custom domain, verify hostname in Cloudflare Turnstile settings.</div>';
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

  function showHint(message, isSuccess = false) {
    if (!forgotHint) return;
    forgotHint.textContent = (isSuccess ? '✓ ' : '✗ ') + message;
    forgotHint.style.color = isSuccess ? 'var(--accent-green-text)' : 'var(--accent-red-text)';
    forgotHint.classList.add('visible');
    setTimeout(() => {
      forgotHint.classList.remove('visible');
      forgotHint.style.color = '';
    }, 6000);
  }

  function showSocialHint(message, isSuccess = false) {
    if (!socialAuthHint) {
      showHint(message, isSuccess);
      return;
    }
    socialAuthHint.textContent = (isSuccess ? '✓ ' : 'ⓘ ') + message;
    socialAuthHint.style.color = isSuccess ? 'var(--accent-green-text)' : 'var(--accent-gold)';
    socialAuthHint.style.display = 'block';
    setTimeout(() => {
      socialAuthHint.style.display = 'none';
      socialAuthHint.textContent = '';
    }, 8000);
  }

  // 6. Primary Form Submit (Email & Password + WhatsApp on Register)
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
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

    if (!turnstileToken && window.turnstile && window.ALFAAZ_TURNSTILE_SITEKEY) {
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
    const payload = {
      email: emailValue,
      password: passwordValue,
      turnstile_token: turnstileToken,
      ...(currentMode === 'register' ? { full_name: fullNameValue, phone: whatsappNormalized } : {})
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
        markAuthSuccess('email');
        finalizeAuth(data, redirectTarget);
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
    if (window.ALFAAZ_GOOGLE_CLIENT_ID) {
      if (googleBtn) {
        googleBtn.classList.remove('gated');
        googleBtn.removeAttribute('title');
      }
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: window.ALFAAZ_GOOGLE_CLIENT_ID,
            callback: async (response) => {
              if (response && response.credential) {
                try {
                  const data = await federatedLogin(response.credential, 'google');
                  markAuthSuccess();
                  finalizeAuth(data, redirectTarget);
                } catch (err) {
                  showSocialHint(err.message || 'Google authentication failed.');
                }
              }
            }
          });
          window.google.accounts.id.prompt();
        } catch (err) {
          console.warn('GIS init error:', err);
        }
      }
    } else {
      // Visibly gated per Rule 4: Zero-Facade Engineering
      if (googleBtn) {
        googleBtn.classList.add('gated');
        googleBtn.setAttribute('title', 'Google Sign-In is awaiting Google OAuth Client ID setup (Coming Soon)');
        if (!googleBtn.querySelector('.gated-pill')) {
          const pill = document.createElement('span');
          pill.className = 'gated-pill';
          pill.textContent = 'Soon';
          googleBtn.appendChild(pill);
        }
      }
    }
  }

  if (window.google?.accounts?.id) {
    initGoogleIdentity();
  } else {
    window.addEventListener('load', () => setTimeout(initGoogleIdentity, 600));
  }

  document.getElementById('btnGoogleAuth')?.addEventListener('click', () => {
    if (window.ALFAAZ_GOOGLE_CLIENT_ID && window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    } else {
      showSocialHint('Google Sign-In is awaiting Google OAuth Client ID setup. Please register with your Full Name, WhatsApp, Email & Password below.');
    }
  });

  document.getElementById('btnAppleAuth')?.addEventListener('click', () => {
    showSocialHint('Apple Sign-In is in developer onboarding. Please use the form below.');
  });

  document.getElementById('btnMetaAuth')?.addEventListener('click', () => {
    showSocialHint('Meta Sign-In is in developer review. Please use the form below.');
  });
});


  function showVerificationStep(user, token, redirectTarget) {
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
    const turnstileContainer = document.getElementById('loginTurnstile');
    if (turnstileContainer) turnstileContainer.style.display = 'none';
    const toggleFooter = document.getElementById('toggleAuthFooter');
    if (toggleFooter) toggleFooter.style.display = 'none';

    verifStep.style.display = 'block';

    const isMissingEmail = !user.email_verified;
    const titleEl = document.getElementById('verifStepTitle');
    const descEl = document.getElementById('verifStepDesc');
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

    let purpose = isMissingEmail ? 'email' : 'phone';
    if (isMissingEmail) {
      if (titleEl) titleEl.textContent = 'Email Cross-Verification';
      if (descEl) descEl.textContent = 'To secure your account, please verify your email address.';
      if (targetLabel) targetLabel.textContent = 'Email Address';
      if (targetInput) {
        targetInput.type = 'email';
        targetInput.value = user.email || '';
        targetInput.placeholder = 'you@example.com';
      }
    } else {
      if (titleEl) titleEl.textContent = 'Mobile Cross-Verification';
      if (descEl) descEl.textContent = 'To secure your account, please verify your mobile number.';
      if (targetLabel) targetLabel.textContent = 'Mobile Number (E.164)';
      if (targetInput) {
        targetInput.type = 'tel';
        targetInput.value = user.phone || '';
        targetInput.placeholder = '+14155552671';
      }
    }

    if (sendBtn) {
      sendBtn.onclick = async () => {
        const val = targetInput ? targetInput.value.trim() : '';
        if (!val) {
          alert('Please enter a valid ' + purpose + '.');
          return;
        }
        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending...';
        try {
          const endpoint = purpose === 'email' ? '/verification/email/send' : '/verification/phone/send';
          const body = purpose === 'email' ? { email: val } : { phone: val };
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify(body)
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
          const endpoint = purpose === 'email' ? '/verification/email/confirm' : '/verification/phone/confirm';
          const res = await fetch(endpoint, {
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
