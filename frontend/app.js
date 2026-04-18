/* ============================================================
   PigTrack — app.js
   Talks to Flask backend at BASE_URL
   ============================================================ */

const BASE_URL = 'https://pigo-care-backend.onrender.com';

/* ── API KEY ─────────────────────────────────────────────────
   Shared secret sent as the x-api-key header on every request.
   Must match the API_KEY environment variable on the backend.
   ──────────────────────────────────────────────────────────── */
const API_KEY = 'pigocare2024';

/* ── UTILITIES ──────────────────────────────────────────────── */

function $(id) { return document.getElementById(id); }
function $qs(sel, ctx = document) { return ctx.querySelector(sel); }

function showToast(msg, type = 'info', duration = 3200) {
  const tc = $('toast-container');
  const t  = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-dot"></span><span>${msg}</span>`;
  tc.appendChild(t);
  setTimeout(() => {
    t.classList.add('hiding');
    setTimeout(() => t.remove(), 220);
  }, duration);
}

function fmtDate(str) {
  if (!str) return '—';
  try {
    const d = new Date(str);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return str; }
}

/* ── NAVIGATION ─────────────────────────────────────────────── */

const views = {
  registry: { view: $('view-registry'), nav: $('nav-registry'), title: 'Pig DataBase' },
  register: { view: $('view-register'),  nav: $('nav-register'),  title: 'Register New Pig'  },
  search:   { view: $('view-search'),    nav: $('nav-search'),    title: 'Search Pigs'   },
};

function switchView(name) {
  Object.entries(views).forEach(([k, v]) => {
    v.view.classList.toggle('active', k === name);
    v.nav.classList.toggle('active', k === name);
  });
  $('topbar-title').textContent = views[name].title;
  // Hide the "Register Pig" button when already on that page
  $('topbar-add-btn').classList.toggle('hidden', name === 'register');
  // Persist so browser reload returns to same view
  localStorage.setItem('pigo_active_view', name);
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();  // stops href="#" from scrolling or reloading
    const v = item.dataset.view;
    if (v) {
      switchView(v);
      if (window.innerWidth <= 768) closeSidebar();
    }
  });
});

$('topbar-add-btn').addEventListener('click', () => switchView('register'));

// Restore last visited view on page load (prevents redirect to database on reload)
const _savedView = localStorage.getItem('pigo_active_view');
switchView(_savedView && views[_savedView] ? _savedView : 'registry');

/* ── SIDEBAR MOBILE TOGGLE ──────────────────────────────────── */

const sidebar = $('sidebar');

function closeSidebar() { sidebar.classList.remove('open'); }
function openSidebar()  { sidebar.classList.add('open'); }

$('sidebar-toggle').addEventListener('click', () => {
  sidebar.classList.toggle('open');
});

document.addEventListener('click', e => {
  if (window.innerWidth <= 768 && !sidebar.contains(e.target) && e.target !== $('sidebar-toggle')) {
    closeSidebar();
  }
});

/* ── SERVER STATUS ───────────────────────────────────────────── */

async function checkServer() {
  try {
    const r = await fetch(`${BASE_URL}/`, {
      signal: AbortSignal.timeout(4000),
      headers: { 'x-api-key': API_KEY },
    });
    if (r.ok) {
      $('status-dot').className  = 'status-dot online';
      $('status-text').textContent = 'Server Online';
    } else {
      throw new Error();
    }
  } catch {
    $('status-dot').className  = 'status-dot offline';
    $('status-text').textContent = 'Server Offline';
  }
}

checkServer();
setInterval(checkServer, 15000);

/* ── REGISTRY VIEW ──────────────────────────────────────────── */

let allPigs = [];
let viewMode = 'grid'; // 'grid' | 'list'

async function loadPigs() {
  const loadingEl = $('registry-loading');
  const emptyEl   = $('registry-empty');
  const grid      = $('pig-grid');

  loadingEl.classList.remove('hidden');
  emptyEl.classList.add('hidden');
  grid.innerHTML = '';
  grid.appendChild(loadingEl);

  // Show warm-up hint if request takes > 4s (Render cold start)
  const warmupTimer = setTimeout(() => {
    const p = loadingEl.querySelector('p');
    if (p) p.textContent = 'Server is warming up, please wait…';
  }, 4000);

  try {
    const res = await fetch(`${BASE_URL}/pigs`, {
      signal: AbortSignal.timeout(35000),
      headers: { 'x-api-key': API_KEY },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allPigs = await res.json();
    renderPigs(allPigs);
    updateStats(allPigs);
  } catch (err) {
    loadingEl.classList.add('hidden');
    showToast('Failed to load pigs: ' + err.message, 'error');
  } finally {
    clearTimeout(warmupTimer);
    const p = loadingEl.querySelector('p');
    if (p) p.textContent = 'Loading pigs…';
  }
}

function updateStats(pigs) {
  const vaccinated   = pigs.filter(p => p.vaccinated).length;
  const unvaccinated = pigs.length - vaccinated;
  $('stat-total').textContent        = pigs.length;
  $('stat-vaccinated').textContent   = vaccinated;
  $('stat-unvaccinated').textContent = unvaccinated;
}

function renderPigs(pigs) {
  const grid = $('pig-grid');
  grid.innerHTML = '';
  grid.className = 'pig-grid' + (viewMode === 'list' ? ' list-view' : '');

  if (pigs.length === 0) {
    $('registry-empty').classList.remove('hidden');
    return;
  }

  $('registry-empty').classList.add('hidden');

  pigs.forEach((pig, i) => {
    const card = buildPigCard(pig, i);
    grid.appendChild(card);
  });
}

function buildPigCard(pig, idx = 0) {
  const isList = viewMode === 'list';
  const card = document.createElement('div');
  card.className = 'pig-card' + (isList ? ' list-card' : '');
  card.style.animationDelay = `${idx * 0.04}s`;

  const imgEl = pig.image
    ? `<img class="pig-card-image" src="${pig.image}" alt="${pig.pig_name}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="pig-card-image-placeholder" style="display:none">🐷</div>`
    : `<div class="pig-card-image-placeholder">🐷</div>`;

  const vaccBadge = pig.vaccinated
    ? `<span class="badge badge-vaccinated">✓ Vaccinated</span>`
    : `<span class="badge badge-unvaccinated">✗ Unvaccinated</span>`;

  card.innerHTML = `
    ${imgEl}
    <div class="pig-card-body">
      <div class="pig-card-header">
        <div class="pig-card-name">${esc(pig.pig_name)}</div>
        <div class="pig-card-id">${esc(pig.pig_id)}</div>
      </div>
      <div class="pig-card-meta">
        <div class="pig-card-meta-row">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          ${esc(pig.breed)}
        </div>
        <div class="pig-card-meta-row">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
          ${esc(pig.farm_name)}
        </div>
      </div>
      <div class="pig-card-footer">
        ${vaccBadge}
        <button class="btn btn-ghost btn-sm" data-action="edit" data-pig-id="${esc(pig.pig_id)}">Edit</button>
      </div>
    </div>
  `;

  card.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-action="edit"]');
    if (editBtn) {
      openPigModal(pig, true);
    } else {
      openPigModal(pig, false);
    }
  });

  return card;
}

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* View mode toggle */
$('grid-btn').addEventListener('click', () => {
  viewMode = 'grid';
  $('grid-btn').classList.add('active');
  $('list-btn').classList.remove('active');
  renderPigs(filteredPigs());
});

$('list-btn').addEventListener('click', () => {
  viewMode = 'list';
  $('list-btn').classList.add('active');
  $('grid-btn').classList.remove('active');
  renderPigs(filteredPigs());
});

/* Reload / refresh database */
$('registry-reload-btn').addEventListener('click', async () => {
  const btn = $('registry-reload-btn');
  if (btn.classList.contains('spinning')) return; // prevent double-tap

  btn.classList.add('spinning');
  btn.disabled = true;

  // Stop spinning after exactly one rotation
  btn.querySelector('svg').addEventListener('animationend', () => {
    btn.classList.remove('spinning');
    btn.disabled = false;
  }, { once: true });

  await loadPigs();
  showToast('Database refreshed', 'success', 2000);
});

/* Quick filter */
$('registry-filter').addEventListener('input', () => {
  renderPigs(filteredPigs());
});

function filteredPigs() {
  const q = $('registry-filter').value.trim().toLowerCase();
  if (!q) return allPigs;
  return allPigs.filter(p =>
    p.pig_name.toLowerCase().includes(q) ||
    p.pig_id.toLowerCase().includes(q) ||
    p.breed.toLowerCase().includes(q) ||
    p.farm_name.toLowerCase().includes(q) ||
    p.farm_address.toLowerCase().includes(q)
  );
}

/* ── PIG DETAIL / EDIT MODAL ────────────────────────────────── */

function openPigModal(pig, editMode = false) {
  const body = $('modal-body');

  const vaccBadge = pig.vaccinated
    ? `<span class="badge badge-vaccinated">✓ Vaccinated</span>`
    : `<span class="badge badge-unvaccinated">✗ Unvaccinated</span>`;

  const imgBlock = pig.image
    ? `<img class="modal-img" src="${esc(pig.image)}" alt="${esc(pig.pig_name)}" />`
    : `<div class="modal-img-placeholder">🐷</div>`;

  body.innerHTML = `
    ${imgBlock}
    <div class="modal-content">
      <div class="modal-header">
        <div>
          <div class="modal-pig-name">${esc(pig.pig_name)}</div>
          <div class="modal-pig-id">${esc(pig.pig_id)}</div>
        </div>
        ${vaccBadge}
      </div>

      <div class="modal-details">
        <div class="detail-item">
          <div class="detail-label">Breed</div>
          <div class="detail-value">${esc(pig.breed)}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Date of Birth</div>
          <div class="detail-value">${fmtDate(pig.dob)}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Farm</div>
          <div class="detail-value">${esc(pig.farm_name)}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Vaccine Date</div>
          <div class="detail-value">${fmtDate(pig.vaccine_date)}</div>
        </div>
        <div class="detail-item" style="grid-column:1/-1">
          <div class="detail-label">Farm Address</div>
          <div class="detail-value">${esc(pig.farm_address)}</div>
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn btn-ghost btn-sm" id="modal-edit-toggle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit Details
        </button>
      </div>

      <!-- EDIT FORM -->
      <div class="modal-edit-section${editMode ? ' open' : ''}" id="modal-edit-section">
        <h3 class="form-section-title" style="margin-bottom:0">Edit Information</h3>

        <div class="modal-edit-grid">
          <div class="modal-edit-field">
            <label>Pig Name</label>
            <input type="text" id="edit-pig-name" value="${esc(pig.pig_name)}" placeholder="Pig name" />
          </div>
          <div class="modal-edit-field">
            <label>Date of Birth</label>
            <input type="date" id="edit-dob" value="${pig.dob || ''}" />
          </div>
          <div class="modal-edit-field">
            <label>Breed</label>
            <input type="text" id="edit-breed" value="${esc(pig.breed)}" placeholder="Breed" />
          </div>
          <div class="modal-edit-field">
            <label>Farm Name</label>
            <input type="text" id="edit-farm-name" value="${esc(pig.farm_name)}" placeholder="Farm name" />
          </div>
          <div class="modal-edit-field full">
            <label>Farm Address</label>
            <input type="text" id="edit-farm-address" value="${esc(pig.farm_address)}" placeholder="Farm address" />
          </div>
          <div class="modal-edit-field" style="align-items:flex-start">
            <label>Vaccinated</label>
            <label class="toggle-switch" style="margin-top:4px">
              <input type="checkbox" id="edit-vaccinated" ${pig.vaccinated ? 'checked' : ''} />
              <span class="toggle-thumb"></span>
            </label>
          </div>
          <div class="modal-edit-field">
            <label>Vaccine Date</label>
            <input type="date" id="edit-vaccine-date" value="${pig.vaccine_date || ''}" />
          </div>
          <div class="modal-edit-field full">
            <label>Replace Image (optional)</label>
            <input type="file" id="edit-image" accept="image/*" style="padding:8px;font-size:12.5px" />
          </div>
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" id="modal-edit-cancel">Cancel</button>
          <button class="btn btn-primary btn-sm" id="modal-save-btn">
            <span id="modal-save-text">Save Changes</span>
            <span class="btn-spinner hidden" id="modal-save-spinner"></span>
          </button>
        </div>
        <div class="form-feedback hidden" id="modal-edit-feedback"></div>
      </div>
    </div>
  `;

  /* Edit toggle */
  body.querySelector('#modal-edit-toggle').addEventListener('click', () => {
    const sec = $('modal-edit-section');
    sec.classList.toggle('open');
  });

  body.querySelector('#modal-edit-cancel').addEventListener('click', () => {
    $('modal-edit-section').classList.remove('open');
  });

  /* Save */
  body.querySelector('#modal-save-btn').addEventListener('click', async () => {
    await saveEdit(pig.pig_id);
  });

  /* Show modal */
  $('modal-overlay').classList.remove('hidden');
  $('pig-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  $('modal-overlay').classList.add('hidden');
  $('pig-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

$('modal-close').addEventListener('click', closeModal);
$('modal-overlay').addEventListener('click', closeModal);

async function saveEdit(pigId) {
  const saveBtn     = $('modal-save-btn');
  const saveText    = $('modal-save-text');
  const saveSpinner = $('modal-save-spinner');
  const feedback    = $('modal-edit-feedback');

  saveBtn.disabled = true;
  saveText.textContent = 'Saving…';
  saveSpinner.classList.remove('hidden');

  const fd = new FormData();
  fd.append('pig_name',     $('edit-pig-name').value.trim());
  fd.append('dob',          $('edit-dob').value);
  fd.append('breed',        $('edit-breed').value.trim());
  fd.append('farm_name',    $('edit-farm-name').value.trim());
  fd.append('farm_address', $('edit-farm-address').value.trim());
  fd.append('vaccinated',   $('edit-vaccinated').checked ? 'true' : 'false');
  fd.append('vaccine_date', $('edit-vaccine-date').value);

  const imgFile = $('edit-image').files[0];
  if (imgFile) fd.append('image', imgFile);

  try {
    const res  = await fetch(`${BASE_URL}/update/${encodeURIComponent(pigId)}`, {
      method: 'POST',
      headers: { 'x-api-key': API_KEY },
      body:   fd,
      // NOTE: Do NOT set Content-Type manually for FormData —
      // the browser sets it automatically with the correct multipart boundary.
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    feedback.className = 'form-feedback success';
    feedback.textContent = '✓ Pig updated successfully!';
    feedback.classList.remove('hidden');

    showToast(`${data.pig.pig_name} updated!`, 'success');
    closeModal();
    await loadPigs();
  } catch (err) {
    feedback.className = 'form-feedback error';
    feedback.textContent = '✗ ' + err.message;
    feedback.classList.remove('hidden');
  } finally {
    saveBtn.disabled = false;
    saveText.textContent = 'Save Changes';
    saveSpinner.classList.add('hidden');
  }
}

/* ── REGISTER PIG FORM ──────────────────────────────────────── */

const regForm       = $('register-form');
const regVaccinated = $('reg-vaccinated');
const vaccDateWrap  = $('vaccine-date-wrap');

regVaccinated.addEventListener('change', () => {
  vaccDateWrap.style.display = regVaccinated.checked ? 'grid' : 'none';
});

/* Image preview */
const uploadZone   = $('upload-zone');
const fileInput    = $('reg-image');
const preview      = $('upload-preview');
const placeholder  = $('upload-placeholder');

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  preview.src = url;
  preview.classList.remove('hidden');
  placeholder.classList.add('hidden');
});

uploadZone.addEventListener('dragover', e => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});

uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));

uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    fileInput.files = e.dataTransfer.files;
    const url = URL.createObjectURL(file);
    preview.src = url;
    preview.classList.remove('hidden');
    placeholder.classList.add('hidden');
  }
});

/* Reset */
$('reg-reset').addEventListener('click', () => {
  regForm.reset();
  preview.classList.add('hidden');
  placeholder.classList.remove('hidden');
  vaccDateWrap.style.display = 'none';
  $('reg-feedback').classList.add('hidden');
  regForm.querySelectorAll('input').forEach(el => el.classList.remove('invalid'));
});

/* Submit */
regForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const required = ['reg-pig-name', 'reg-pig-id', 'reg-dob', 'reg-breed', 'reg-farm-name', 'reg-farm-address'];
  let valid = true;

  required.forEach(id => {
    const el = $(id);
    if (!el.value.trim()) {
      el.classList.add('invalid');
      valid = false;
    } else {
      el.classList.remove('invalid');
    }
  });

  if (!fileInput.files[0]) {
    uploadZone.style.borderColor = 'var(--red)';
    valid = false;
  } else {
    uploadZone.style.borderColor = '';
  }

  if (!valid) {
    showFeedback('reg-feedback', 'error', 'Please fill in all required fields and upload an image.');
    return;
  }

  const submitBtn     = $('reg-submit');
  const submitText    = $('reg-submit-text');
  const submitSpinner = $('reg-spinner');

  submitBtn.disabled = true;
  submitText.textContent = 'Registering…';
  submitSpinner.classList.remove('hidden');

  const fd = new FormData();
  fd.append('pig_name',     $('reg-pig-name').value.trim());
  fd.append('pig_id',       $('reg-pig-id').value.trim());
  fd.append('dob',          $('reg-dob').value);
  fd.append('breed',        $('reg-breed').value.trim());
  fd.append('farm_name',    $('reg-farm-name').value.trim());
  fd.append('farm_address', $('reg-farm-address').value.trim());
  fd.append('vaccinated',   regVaccinated.checked ? 'true' : 'false');
  fd.append('vaccine_date', $('reg-vaccine-date').value);
  fd.append('image',        fileInput.files[0]);

  try {
    const res  = await fetch(`${BASE_URL}/upload`, {
      method: 'POST',
      headers: { 'x-api-key': API_KEY },
      body: fd,
      // NOTE: Do NOT set Content-Type manually for FormData —
      // the browser sets it automatically with the correct multipart boundary.
    });
    const data = await res.json();

    if (res.status === 409) {
      $('reg-pig-id').classList.add('invalid');
      throw new Error('A pig with this ID already exists.');
    }
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    showFeedback('reg-feedback', 'success', `✓ ${data.pig.pig_name} registered successfully!`);
    showToast(`${data.pig.pig_name} added to registry!`, 'success');
    regForm.reset();
    preview.classList.add('hidden');
    placeholder.classList.remove('hidden');
    vaccDateWrap.style.display = 'none';
    await loadPigs();

  } catch (err) {
    showFeedback('reg-feedback', 'error', '✗ ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitText.textContent = 'Register Pig';
    submitSpinner.classList.add('hidden');
  }
});

function showFeedback(id, type, msg) {
  const el = $(id);
  el.className = `form-feedback ${type}`;
  el.textContent = msg;
  el.classList.remove('hidden');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ── SEARCH VIEW ────────────────────────────────────────────── */

let searchDebounce;

$('search-input').addEventListener('input', () => {
  const q = $('search-input').value.trim();
  $('search-clear').classList.toggle('hidden', q.length === 0);

  clearTimeout(searchDebounce);
  if (q.length < 2) {
    $('search-hint').classList.remove('hidden');
    $('search-results').classList.add('hidden');
    $('search-empty').classList.add('hidden');
    return;
  }
  searchDebounce = setTimeout(() => doSearch(q), 320);
});

$('search-clear').addEventListener('click', () => {
  $('search-input').value = '';
  $('search-clear').classList.add('hidden');
  $('search-hint').classList.remove('hidden');
  $('search-results').classList.add('hidden');
  $('search-empty').classList.add('hidden');
  $('search-input').focus();
});

async function doSearch(q) {
  const results = $('search-results');
  results.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Searching…</p></div>`;
  results.classList.remove('hidden');
  $('search-hint').classList.add('hidden');
  $('search-empty').classList.add('hidden');

  try {
    const res  = await fetch(`${BASE_URL}/search?query=${encodeURIComponent(q)}`, {
      signal: AbortSignal.timeout(35000),
      headers: { 'x-api-key': API_KEY },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const pigs = await res.json();

    results.innerHTML = '';

    if (pigs.length === 0) {
      results.classList.add('hidden');
      $('search-empty').classList.remove('hidden');
      return;
    }

    $('search-empty').classList.add('hidden');
    results.className = 'pig-grid';

    pigs.forEach((pig, i) => {
      const card = buildPigCard(pig, i);
      results.appendChild(card);
    });

  } catch (err) {
    results.innerHTML = '';
    results.classList.add('hidden');
    showToast('Search failed: ' + err.message, 'error');
  }
}

/* ── INIT ────────────────────────────────────────────────────── */

loadPigs();
