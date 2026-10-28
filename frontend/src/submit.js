// submit.js — Centralized Submission Logic
document.addEventListener('DOMContentLoaded', () => {
 const userData = localStorage.getItem('alfaaz_user');
 const token = localStorage.getItem('alfaaz_token');

 if (!userData || !token) {
 window.location.href = 'login.html';
 return;
 }

 const form = document.getElementById('submission-form');
 if (!form) return;

 const cloudinaryConfig = window.ALFAAZ_CLOUDINARY || {
 cloudName: 'dmqwjpmjk',
 uploadPreset: 'alfaaz_vault'
 };
 const { cloudName: CLOUD_NAME, uploadPreset: UPLOAD_PRESET } = cloudinaryConfig;

 form.addEventListener('submit', async (e) => {
 e.preventDefault();
 const btn = document.getElementById('submit-btn');
 const status = document.getElementById('status-msg');
 const fileInput = document.getElementById('file-upload');

 const file = fileInput && fileInput.files && fileInput.files[0];
 if (!file) {
  status.style.color = "var(--accent-red)";
  status.innerText = "Please select a manuscript or document to upload.";
  btn.innerText = "Submit to Storage";
  btn.disabled = false;
  return;
 }
 if (file.size > 20 * 1024 * 1024) {
  status.style.color = "var(--accent-red)";
  status.innerText = "File size exceeds the 20MB limit.";
  btn.innerText = "Submit to Storage";
  btn.disabled = false;
  return;
 }

 btn.innerText = "Uploading...";
 btn.disabled = true;
 status.style.color = "var(--text-secondary)";
 status.innerText = "Uploading your file to secure storage...";

 try {
 const formData = new FormData();
 formData.append('file', file);
 formData.append('upload_preset', UPLOAD_PRESET);

 const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, {
 method: 'POST',
 body: formData
 });
 const cloudData = await cloudRes.json();

 if (!cloudData.secure_url) {
 throw new Error("Failed to secure file link.");
 }

 btn.innerText = "Finalizing...";
 status.innerText = "Notifying the Curator...";

 const vaultData = {
 submission_type: document.getElementById('sub-type').value,
 title: document.getElementById('title').value,
 file_url: cloudData.secure_url,
 note: document.getElementById('note').value
 };

 const pyRes = await window.globalApiFetch('/vault/submit', {
 method: 'POST',
 body: JSON.stringify(vaultData)
 });

 if (pyRes && pyRes.ok) {
 status.style.color = "var(--accent-green)";
 status.innerText = "Submission Successful";
 btn.style.background = "var(--accent-gold)";
 btn.style.borderColor = "var(--accent-gold)";
 btn.innerText = "File Secured";

 setTimeout(() => { window.location.href = 'dashboard.html'; }, 2000);
 } else {
 throw new Error("The Storage system rejected the submission.");
 }
 } catch (error) {
 status.style.color = "var(--accent-red)";
 status.innerText = "ERROR: " + error.message;
 btn.innerText = "Submit to Storage";
 btn.disabled = false;
 }
 });
});
