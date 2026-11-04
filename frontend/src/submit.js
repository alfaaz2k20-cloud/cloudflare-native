// submit.js — Centralized Creative Vault Submission Logic
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('alfaaz_token');
  const userData = localStorage.getItem('alfaaz_user');

  if (!token || !userData) {
    window.location.href = 'login.html?redirect=submit.html';
    return;
  }

  const form = document.getElementById('submission-form');
  const fileInput = document.getElementById('file-upload');
  const fileFeedback = document.getElementById('file-feedback');
  const btn = document.getElementById('submit-btn');
  const statusMsg = document.getElementById('status-msg');

  if (!form) return;


  const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];
  const ALLOWED_MIME_PREFIXES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

  // Immediate feedback on file selection
  fileInput?.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      if (fileFeedback) fileFeedback.textContent = '';
      return;
    }

    const fileName = file.name.toLowerCase();
    const hasValidExt = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext));
    const hasValidMime = file.type ? ALLOWED_MIME_PREFIXES.includes(file.type) : true;

    if (!hasValidExt || !hasValidMime) {
      if (fileFeedback) {
        fileFeedback.style.color = 'var(--accent-red-text)';
        fileFeedback.textContent = '✗ Unsupported format. Only PDF, PNG, JPG, or WebP files are allowed.';
      }
      fileInput.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      if (fileFeedback) {
        fileFeedback.style.color = 'var(--accent-red-text)';
        fileFeedback.textContent = `✗ File too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Limit is 20MB.`;
      }
      fileInput.value = '';
      return;
    }

    const sizeFormatted = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${(file.size / 1024).toFixed(0)} KB`;

    if (fileFeedback) {
      fileFeedback.style.color = 'var(--accent-green-text)';
      fileFeedback.innerHTML = `✓ Ready: <strong>${window.escapeHtml(file.name)}</strong> (${sizeFormatted})`;
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const file = fileInput && fileInput.files && fileInput.files[0];
    if (!file) {
      if (statusMsg) {
        statusMsg.style.color = 'var(--accent-red-text)';
        statusMsg.textContent = 'Please choose a document or manuscript to upload.';
      }
      return;
    }

    const titleInput = document.getElementById('title');
    const subTypeSelect = document.getElementById('sub-type');
    const noteInput = document.getElementById('note');

    const title = titleInput ? titleInput.value.trim() : '';
    const submissionType = subTypeSelect ? subTypeSelect.value.trim() : '';
    const note = noteInput ? noteInput.value.trim() : null;

    if (!title) {
      if (statusMsg) {
        statusMsg.style.color = 'var(--accent-red-text)';
        statusMsg.textContent = 'Title is required.';
      }
      return;
    }

    if (btn) {
      btn.innerText = 'Uploading to Storage...';
      btn.disabled = true;
    }
    if (statusMsg) {
      statusMsg.style.color = 'var(--accent-gold-text)';
      statusMsg.textContent = 'Securing asset in the Alfaaz Storage Vault...';
    }

    const restoreBtn = () => {
      if (btn) {
        btn.innerText = 'Deposit into Storage';
        btn.disabled = false;
        btn.style.background = '';
        btn.style.borderColor = '';
      }
    };

    try {
      if (btn) btn.innerText = 'Depositing in Vault...';
      if (statusMsg) {
        statusMsg.style.color = 'var(--text-secondary)';
        statusMsg.textContent = 'Transmitting creative work directly to encrypted vault...';
      }

      // Direct authenticated multipart upload to Cloudflare R2 via /vault/submit
      const formData = new FormData();
      formData.append('file', file);
      formData.append('submission_type', submissionType);
      formData.append('title', title);
      if (note) formData.append('note', note);

      const res = await window.globalApiFetch('/vault/submit', {
        method: 'POST',
        body: formData
      });

      if (res && res.ok) {
        if (statusMsg) {
          statusMsg.style.color = 'var(--accent-green-text)';
          statusMsg.textContent = '✓ Work deposited successfully into the Curator\'s Storage.';
        }
        if (btn) {
          btn.style.background = 'var(--accent-gold)';
          btn.style.borderColor = 'var(--accent-gold)';
          btn.innerText = 'File Secured';
        }
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 1800);
        return;
      }

      const errorData = await res?.json().catch(() => ({}));
      const errorMsg = errorData.error || errorData.detail || 'The vault rejected the submission. Please try again.';
      throw new Error(errorMsg);

    } catch (err) {
      console.error('[Vault submit error]:', err);
      if (statusMsg) {
        statusMsg.style.color = 'var(--accent-red-text)';
        statusMsg.textContent = `Error: ${err.message || 'Storage connection failed'}`;
      }
      restoreBtn();
    }
  });
});
