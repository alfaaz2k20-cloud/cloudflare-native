// reset.js — Centralized Reset Password Logic
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  if (token) {
    try {
      window.history.replaceState(null, '', window.location.pathname);
    } catch {}
  }

  function isTokenLikelyExpired(t) {
    try {
      const parts = t.split('.');
      if (parts.length < 2) return true;
      const encodedPayload = parts[1];
      const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
      const payload = JSON.parse(atob(padded));
      return Boolean(payload.exp && (payload.exp * 1000 < Date.now()));
    } catch {
      return false;
    }
  }

  const expiredOverlay = document.getElementById('expiredOverlay');
  const form = document.getElementById('resetForm');
  const submitBtn = form?.querySelector('.submit-btn');
  const newPwInput = document.getElementById('newPassword');
  const confirmInput = document.getElementById('confirmPassword');
  const strengthBar = document.getElementById('strengthBar');
  const strengthLabel = document.getElementById('strengthLabel');
  const matchIndicator = document.getElementById('matchIndicator');
  const toggleNew = document.getElementById('toggleNew');
  const toggleConfirm = document.getElementById('toggleConfirm');

  function showExpired() {
    if (expiredOverlay) expiredOverlay.classList.add('show');
    if (newPwInput) newPwInput.disabled = true;
    if (confirmInput) confirmInput.disabled = true;
    if (submitBtn) submitBtn.disabled = true;
    if (form) form.setAttribute('aria-hidden', 'true');
  }

  if (!token || isTokenLikelyExpired(token)) {
    showExpired();
  }

  if (!form) return;

  toggleNew?.addEventListener('click', () => {
    const isHidden = newPwInput.type === 'password';
    newPwInput.type = isHidden ? 'text' : 'password';
    toggleNew.textContent = isHidden ? 'hide' : 'show';
    toggleNew.setAttribute('aria-label', isHidden ? 'Hide new password' : 'Show new password');
  });

  toggleConfirm?.addEventListener('click', () => {
    const isHidden = confirmInput.type === 'password';
    confirmInput.type = isHidden ? 'text' : 'password';
    toggleConfirm.textContent = isHidden ? 'hide' : 'show';
    toggleConfirm.setAttribute('aria-label', isHidden ? 'Hide confirm password' : 'Show confirm password');
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
    const newPassword = newPwInput?.value || '';
    const confirmPassword = confirmInput?.value || '';

    if (newPassword.length < 8 || newPassword.length > 128 || !newPassword.trim()) {
      if (matchIndicator) {
        matchIndicator.textContent = '✗ Password must be between 8 and 128 characters.';
        matchIndicator.style.color = 'var(--accent-red-text)';
      }
      newPwInput?.focus();
      return;
    }

    if (newPassword !== confirmPassword) {
      if (matchIndicator) {
        matchIndicator.textContent = '✗ Passwords must match.';
        matchIndicator.style.color = 'var(--accent-red-text)';
      }
      confirmInput?.focus();
      return;
    }

    if (submitBtn) {
      submitBtn.textContent = 'Updating...';
      submitBtn.disabled = true;
    }

    try {
      const response = await window.globalApiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: token, new_password: newPassword })
      });

      if (!response) {
        throw new Error('No response from authentication service.');
      }

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        if (submitBtn) {
          submitBtn.textContent = 'Success';
          submitBtn.style.background = 'var(--accent-gold)';
          submitBtn.style.borderColor = 'var(--accent-gold)';
          submitBtn.style.color = '#fff';
        }
        if (matchIndicator) {
          matchIndicator.textContent = '✓ Password updated successfully. Redirecting to login...';
          matchIndicator.style.color = 'var(--accent-green-text)';
        }
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 1500);
      } else if (
        response.status === 401 ||
        (response.status === 400 &&
          (data.detail?.toLowerCase().includes('expired') ||
            data.detail?.toLowerCase().includes('invalid') ||
            data.detail?.toLowerCase().includes('token')))
      ) {
        showExpired();
      } else if (response.status === 429) {
        if (submitBtn) {
          submitBtn.textContent = 'Update Password';
          submitBtn.disabled = false;
        }
        if (matchIndicator) {
          matchIndicator.textContent = '✗ Too many attempts. Please wait a minute before retrying.';
          matchIndicator.style.color = 'var(--accent-red-text)';
        }
      } else {
        if (submitBtn) {
          submitBtn.textContent = 'Update Password';
          submitBtn.disabled = false;
        }
        const msg = data.detail || data.error || 'Unable to update password. Please try again.';
        if (matchIndicator) {
          matchIndicator.textContent = '✗ ' + msg;
          matchIndicator.style.color = 'var(--accent-red-text)';
        }
      }
    } catch (error) {
      if (submitBtn) {
        submitBtn.textContent = 'Update Password';
        submitBtn.disabled = false;
      }
      if (matchIndicator) {
        matchIndicator.textContent = '✗ Network connection interrupted. Please try again.';
        matchIndicator.style.color = 'var(--accent-red-text)';
      }
    }
  });
});
