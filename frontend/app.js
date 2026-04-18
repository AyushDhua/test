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
  const emptyEl = $('registry-empty');
  const grid    = $('pig-grid');

  // Guard: only needed on very first call before DOM is ready
  if (!grid) return;

  // Always create a fresh loading indicator (the old one gets wiped by renderPigs)
  grid.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p id="loading-msg">Loading pigs…</p>
    </div>`;
  if (emptyEl) emptyEl.classList.add('hidden');

  // Show warm-up hint if request takes > 4s (Render cold start)
  const warmupTimer = setTimeout(() => {
    const msg = document.getElementById('loading-msg');
    if (msg) msg.textContent = 'Server is warming up, please wait…';
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
    grid.innerHTML = '';
    showToast('Failed to load pigs: ' + err.message, 'error');
  } finally {
    clearTimeout(warmupTimer);
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

  try {
    await loadPigs();
    showToast('Database refreshed', 'success', 2000);
  } finally {
    // Always re-enable — don't rely on animationend which may not fire
    btn.classList.remove('spinning');
    btn.disabled = false;
  }
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

        <div style="display:flex;gap:10px;justify-content:space-between;flex-wrap:wrap;align-items:center">
          <button class="btn btn-danger btn-sm" id="modal-delete-btn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            Delete Pig
          </button>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" id="modal-edit-cancel">Cancel</button>
            <button class="btn btn-primary btn-sm" id="modal-save-btn">
              <span id="modal-save-text">Save Changes</span>
              <span class="btn-spinner hidden" id="modal-save-spinner"></span>
            </button>
          </div>
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

  /* Delete */
  body.querySelector('#modal-delete-btn').addEventListener('click', () => {
    deletePig(pig.pig_id, pig.pig_name);
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

async function deletePig(pigId, pigName) {
  const confirmed = window.confirm(`Delete "${pigName}"?\n\nThis cannot be undone.`);
  if (!confirmed) return;

  try {
    const res  = await fetch(`${BASE_URL}/delete/${encodeURIComponent(pigId)}`, {
      method: 'DELETE',
      headers: { 'x-api-key': API_KEY },
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    closeModal();
    showToast(`${pigName} deleted from database.`, 'success');
    await loadPigs();
  } catch (err) {
    showToast('Delete failed: ' + err.message, 'error');
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

/* ── BREED SEARCHABLE DROPDOWN ──────────────────────────────── */

const BREEDS = [
  'Ankamali Pig', 'Banna Mini Pig', 'Berkshire', 'Chester White',
  'Duroc', 'Fengjing', 'Ghungroo', 'Gori', 'Hampshire', 'Hereford Pig',
  'Huai Pig', 'Jinhua', 'Landrace', 'Large Black', 'Large White (Yorkshire)',
  'Meishan', 'Middle White', 'Min Pig', 'Mukota Pig', 'Niang Megha',
  'Ossabaw Island Hog', 'Pietrain', 'Poland China', 'Spotted (Spots)',
  'Tamworth', 'Tenyi Vo', 'Tibetan Pig', 'Vietnamese Pot-bellied Pig',
  'Wuzhishan Pig', 'Xiang Pig', 'Zovawk',
  'Other',
];

const breedDropdown   = $('breed-dropdown');
const breedTrigger    = $('breed-trigger');
const breedTriggerTxt = $('breed-trigger-text');
const breedPanel      = $('breed-panel');
const breedSearchEl   = $('breed-search');
const breedList       = $('breed-list');
const breedHidden     = $('reg-breed');
const breedOtherInput = $('breed-other-input');

function renderBreedList(filter = '') {
  const q = filter.toLowerCase().trim();
  breedList.innerHTML = '';
  BREEDS.forEach(breed => {
    if (q && !breed.toLowerCase().includes(q)) return;
    const li = document.createElement('li');
    li.className = 'breed-option' + (breed === 'Other' ? ' breed-other-marker' : '');
    li.textContent = breed;
    li.addEventListener('click', () => selectBreed(breed));
    breedList.appendChild(li);
  });
  if (!breedList.children.length) {
    const li = document.createElement('li');
    li.className = 'breed-no-results';
    li.textContent = 'No breeds found';
    breedList.appendChild(li);
  }
}

function selectBreed(breed) {
  breedTriggerTxt.textContent = breed;
  breedTrigger.classList.add('has-value');
  breedTrigger.classList.remove('invalid');
  if (breed === 'Other') {
    breedHidden.value = '';
    breedOtherInput.classList.remove('hidden');
    breedOtherInput.value = '';
    breedOtherInput.focus();
  } else {
    breedHidden.value = breed;
    breedOtherInput.classList.add('hidden');
    breedOtherInput.value = '';
  }
  closeBreedPanel();
}

breedOtherInput.addEventListener('input', () => {
  breedHidden.value = breedOtherInput.value.trim();
});

function openBreedPanel() {
  breedPanel.classList.remove('hidden');
  breedSearchEl.value = '';
  renderBreedList();
  breedTrigger.classList.add('open');
  setTimeout(() => breedSearchEl.focus(), 50);
}

function closeBreedPanel() {
  breedPanel.classList.add('hidden');
  breedTrigger.classList.remove('open');
}

breedTrigger.addEventListener('click', (e) => {
  e.stopPropagation();
  breedPanel.classList.contains('hidden') ? openBreedPanel() : closeBreedPanel();
});

breedSearchEl.addEventListener('input', () => renderBreedList(breedSearchEl.value));

document.addEventListener('click', (e) => {
  if (!breedDropdown.contains(e.target)) closeBreedPanel();
});

function resetBreedDropdown() {
  breedTriggerTxt.textContent = 'Select a breed…';
  breedHidden.value = '';
  breedTrigger.classList.remove('has-value', 'invalid', 'open');
  breedOtherInput.classList.add('hidden');
  breedOtherInput.value = '';
  closeBreedPanel();
}

/* ── FARM SEARCHABLE DROPDOWN ───────────────────────────────── */

const FARMS = [
  { name: 'A & A Piggery Farm',                                                    address: 'Id More, Sikidri, Ranchi, Jharkhand 835219, India' },
  { name: 'AICRP on Pig – Assam Agricultural University Campus',                   address: 'Khanapara, Guwahati, Assam 781022, India' },
  { name: 'AICRP on Pig – College of Veterinary Sciences, Agartala',               address: 'Agartala, Tripura 799006, India' },
  { name: 'AICRP on Pig – College of Veterinary Sciences, Aizawl',                address: 'Aizawl, Mizoram 796015, India' },
  { name: 'AICRP on Pig – College of Veterinary Sciences, Gangtok',               address: 'Gangtok, Sikkim 737102, India' },
  { name: 'AICRP on Pig – College of Veterinary Sciences, Imphal',                address: 'Imphal, Manipur 795004, India' },
  { name: 'AICRP on Pig – College of Veterinary Sciences, Itanagar',              address: 'Itanagar, Arunachal Pradesh 791111, India' },
  { name: 'AICRP on Pig – ICAR-CCARI Campus',                                    address: 'Old Goa, Goa 403402, India' },
  { name: 'AICRP on Pig – ICAR-CIARI Campus',                                    address: 'Port Blair, Andaman & Nicobar Islands 744101, India' },
  { name: 'AICRP on Pig – ICAR-IVRI Campus',                                     address: 'Izatnagar, Bareilly, Uttar Pradesh 243122, India' },
  { name: 'AICRP on Pig – ICAR-RCNEH Campus',                                    address: 'Umiam, Meghalaya 793103, India' },
  { name: 'AICRP on Pig – Nagaland University, Medziphema Campus',               address: 'Dimapur, Nagaland 797106, India' },
  { name: 'AICRP on Pig – West Bengal University of Animal & Fishery Sciences',   address: 'Mohanpur, Nadia, West Bengal 741252, India' },
  { name: 'Ajit Pig Farm',                                                          address: 'Sankosai, Asura, West Singhbhum, Jharkhand 833202, India' },
  { name: 'Anil Mahto Pig Farm',                                                    address: 'Madhaipur, Natundanga, Bardhaman, West Bengal 713381, India' },
  { name: 'Ankush Pig Farms',                                                       address: 'Ghatkhed, Maharashtra 444602, India' },
  { name: 'Aparna Agro',                                                            address: 'Near Ram Mandir, Laxmi Sagar, Bhubaneswar, Odisha, India' },
  { name: 'Ashirwad Piggery Farm',                                                  address: 'Hill View Colony, Jamshedpur, Jharkhand, India' },
  { name: 'Assam Agricultural University Pig Farm',                                 address: 'Khanapara, Guwahati, Assam 781022, India' },
  { name: 'Atoz Farm',                                                              address: 'Sayestanagar, North 24 Parganas, West Bengal 743427, India' },
  { name: 'Baba Pigry Farm',                                                        address: 'Punjab, India' },
  { name: 'Barki Devi Pig Farm',                                                    address: 'NH19, Barakatha, Jharkhand, India' },
  { name: 'Bethlehem Rabbit Farm & Agricultural (Pig Unit)',                        address: 'India' },
  { name: 'Bihar Animal Sciences University Pig Farm',                              address: 'Patna, Bihar 800014, India' },
  { name: 'Bishop Braddy Agro Farm',                                                address: 'Fatehpur, Uttar Pradesh 212652, India' },
  { name: 'Bobby Piggery Farm',                                                     address: 'India' },
  { name: 'Brothers Agriculture & Farming Company',                                 address: 'Bistupur, Jamshedpur, Jharkhand, India' },
  { name: 'Budheswar Soren Pig Farm',                                               address: 'Mayurbhanj, Odisha 757040, India' },
  { name: 'Ccube Pig Farm',                                                         address: 'Chokkasandra, Bengaluru, Karnataka 560099, India' },
  { name: 'Chaudhary Pig Farm',                                                     address: 'Naraura, Bulandshahr, Uttar Pradesh, India' },
  { name: 'Devsatya Farms Pvt Ltd',                                                 address: 'Farrukhabad, Uttar Pradesh 209601, India' },
  { name: 'Diyan Livestock Pig Farm',                                               address: 'Village Kot, Dadri, Uttar Pradesh, India' },
  { name: 'Dumbi Hembrom Pig Farm',                                                 address: 'West Singhbhum, Jharkhand, India' },
  { name: 'Farmers Universe Pigg Farm',                                             address: 'Jharkhand, India' },
  { name: 'Five Square Agro Pig Farm',                                              address: 'Raigarh, Chhattisgarh, India' },
  { name: 'Gitanjali Farm (Pig Unit)',                                              address: 'India' },
  { name: 'GK Farms (Pig Farming Unit)',                                            address: 'Coimbatore, Tamil Nadu, India' },
  { name: 'Government Livestock Farm (Pig Unit)',                                   address: 'Hisar, Haryana 125004, India' },
  { name: 'Government Pig Breeding Farm – Kanke',                                  address: 'Kanke, Ranchi, Jharkhand 834006, India' },
  { name: 'Government Pig Breeding Farm – Khanapara',                              address: 'Khanapara, Guwahati, Assam 781022, India' },
  { name: 'Government Pig Breeding Farm – Medziphema',                             address: 'Medziphema, Dimapur, Nagaland 797106, India' },
  { name: 'Government Pig Farm – Agartala',                                        address: 'Agartala, Tripura 799001, India' },
  { name: 'Government Pig Farm – Aizawl',                                          address: 'Aizawl, Mizoram 796001, India' },
  { name: 'Government Pig Farm – Bhubaneswar',                                     address: 'Bhubaneswar, Odisha 751003, India' },
  { name: 'Government Pig Farm – Byrnihat',                                        address: 'Byrnihat, Ri-Bhoi, Meghalaya 793101, India' },
  { name: 'Government Pig Farm – Gangtok',                                         address: 'Gangtok, Sikkim 737101, India' },
  { name: 'Government Pig Farm – Imphal',                                          address: 'Imphal, Manipur 795004, India' },
  { name: 'Government Pig Farm – Itanagar',                                        address: 'Itanagar, Arunachal Pradesh 791111, India' },
  { name: 'Government Pig Farm – Kalyani',                                         address: 'Kalyani, Nadia, West Bengal 741235, India' },
  { name: 'Government Pig Farm – Patna',                                           address: 'Patna, Bihar 800014, India' },
  { name: 'HOSH Farms Pig Unit',                                                    address: 'Vizianagaram, Andhra Pradesh 535006, India' },
  { name: 'HPS Piggery Farm',                                                       address: 'Char Brahmanagar, Nadia, West Bengal 741301, India' },
  { name: 'ICAR – CCARI Pig Unit',                                                 address: 'Ela, Old Goa, Goa 403402, India' },
  { name: 'ICAR – CIARI Pig Farm',                                                 address: 'Port Blair, Andaman & Nicobar Islands 744101, India' },
  { name: 'ICAR – ERS Pig Farm',                                                   address: 'Kalyani, Nadia, West Bengal 741235, India' },
  { name: 'ICAR – IVRI Pig Farm',                                                  address: 'Izatnagar, Bareilly, Uttar Pradesh 243122, India' },
  { name: 'ICAR – NRC on Pig',                                                     address: 'Rani, Guwahati, Kamrup, Assam 781131, India' },
  { name: 'ICAR – RCNEH Pig Unit',                                                 address: 'Umiam, Barapani, Meghalaya 793103, India' },
  { name: 'Irene Piggery',                                                          address: 'Lawngtlai, Mizoram, India' },
  { name: 'Jaswant Pig Farm',                                                       address: 'Dhaulana, Ghaziabad, Uttar Pradesh, India' },
  { name: 'JB Agro & Livestock',                                                    address: 'Nadia, West Bengal, India' },
  { name: 'Joy Baba Lokenath Piggery Firm',                                         address: 'Bongaon, West Bengal 743245, India' },
  { name: 'K.K Pig Breeding Farm & Training Centre',                                address: 'Ranchi, Jharkhand 835303, India' },
  { name: 'Kaimur & Umang Piggery Group',                                           address: 'Bihar, India' },
  { name: 'Kamboj Pig Farm',                                                        address: 'India' },
  { name: 'Karnal Swine Breeding Farm',                                             address: 'Karnal, Haryana 132037, India' },
  { name: 'Kerala Veterinary and Animal Sciences University Pig Farm',              address: 'Mannuthy, Thrissur, Kerala 680651, India' },
  { name: 'Khushi Livestock Pig Farm',                                              address: 'India' },
  { name: 'Maa Kali Pig Farm',                                                      address: 'North 24 Parganas, West Bengal, India' },
  { name: 'Maa Piggery Bhollakash',                                                 address: 'Bhollakash, India' },
  { name: 'Mina Pork Meat Pig Farm',                                                address: 'North 24 Parganas, West Bengal, India' },
  { name: 'Mizoram University Pig Farm',                                            address: 'Aizawl, Mizoram 796004, India' },
  { name: 'Monu Sree Pig Farm',                                                     address: 'Chakdaha, West Bengal 741248, India' },
  { name: 'Murmu Enterprise Pig Farm',                                              address: 'Jharkhand, India' },
  { name: 'Nagaland University Pig Farm',                                           address: 'Medziphema, Dimapur, Nagaland 797106, India' },
  { name: 'Narsanda Pig Farm',                                                      address: 'Jharkhand, India' },
  { name: 'Narsing Farm',                                                           address: 'Ranchi, Jharkhand, India' },
  { name: 'New Jyoti Foundation Pig Farm',                                          address: 'Jharkhand, India' },
  { name: 'Om Sai Piggery Farm',                                                    address: 'Jharkhand, India' },
  { name: 'Padangka Livestock Farm',                                                address: 'Chukuniapara, Assam 781135, India' },
  { name: 'Paras Farma Pig Unit',                                                   address: 'India' },
  { name: 'Pig Farming Training & Research Institute of India Farm',                address: 'Helencha, Bongaon, West Bengal 743270, India' },
  { name: 'Pradhan Pig Farming',                                                    address: 'Jamulanda, India' },
  { name: 'Raghuvanshi Pig Farm',                                                   address: 'Noida, Uttar Pradesh 201304, India' },
  { name: 'Raj Kumar Piggery Farm',                                                 address: 'Kamalpur, Punjab 147101, India' },
  { name: 'Rana Pig Farm',                                                          address: 'Pindaura Jahangeerpur, India' },
  { name: 'Sagar Livestock Pig Farm',                                               address: 'Yamunanagar, Haryana 135133, India' },
  { name: 'Sai Agro Pig Farm',                                                      address: 'Daund, Maharashtra 412207, India' },
  { name: 'SKUAST Pig Farm',                                                        address: 'Jammu, Jammu & Kashmir 180009, India' },
  { name: 'Snow White Piggery',                                                     address: 'Jharkhand, India' },
  { name: 'SS Piggery Farm',                                                        address: 'Majhola, Moradabad, Uttar Pradesh 244001, India' },
  { name: 'Suvojit Pig Farm',                                                       address: 'Sayestanagar, North 24 Parganas, West Bengal, India' },
  { name: 'Sure Farm Pig Unit',                                                     address: 'Dehradun, Uttarakhand 248002, India' },
  { name: 'TANUVAS Pig Farm',                                                       address: 'Madhavaram, Chennai, Tamil Nadu 600051, India' },
  { name: 'Tripura Veterinary College Pig Farm',                                    address: 'Agartala, Tripura 799006, India' },
  { name: 'Universal Piggery',                                                      address: 'India' },
  { name: 'Vikas Kumar Agro Livestock Farm',                                        address: 'Patna, Bihar, India' },
  { name: 'Vikas Livestock Pig Farm',                                               address: 'Saharanpur, Uttar Pradesh 247001, India' },
  { name: 'West Bengal University of Animal & Fishery Sciences Pig Farm',          address: 'Mohanpur, Nadia, West Bengal 741252, India' },
  { name: 'Other', address: '' },
];

const farmDropdown      = $('farm-dropdown');
const farmTrigger       = $('farm-trigger');
const farmTriggerTxt    = $('farm-trigger-text');
const farmPanel         = $('farm-panel');
const farmSearchEl      = $('farm-search');
const farmListEl        = $('farm-list');
const farmHiddenName    = $('reg-farm-name');
const farmHiddenAddr    = $('reg-farm-address');
const farmAddrDisplay   = $('farm-address-display');
const farmOtherWrap     = $('farm-other-wrap');
const farmOtherName     = $('farm-other-name');
const farmOtherAddress  = $('farm-other-address');

function renderFarmList(filter = '') {
  const q = filter.toLowerCase().trim();
  farmListEl.innerHTML = '';
  FARMS.forEach(farm => {
    if (q && !farm.name.toLowerCase().includes(q)) return;
    const li = document.createElement('li');
    li.className = 'breed-option' + (farm.name === 'Other' ? ' breed-other-marker' : '');
    li.textContent = farm.name;
    li.addEventListener('click', () => selectFarm(farm));
    farmListEl.appendChild(li);
  });
  if (!farmListEl.children.length) {
    const li = document.createElement('li');
    li.className = 'breed-no-results';
    li.textContent = 'No farms found';
    farmListEl.appendChild(li);
  }
}

function selectFarm(farm) {
  farmTriggerTxt.textContent = farm.name;
  farmTrigger.classList.add('has-value');
  farmTrigger.classList.remove('invalid');

  const farmAddrSection = $('farm-address-section');

  if (farm.name === 'Other') {
    farmHiddenName.value  = '';
    farmHiddenAddr.value  = '';
    if (farmAddrSection) farmAddrSection.classList.add('hidden');
    farmAddrDisplay.textContent = '';
    farmOtherWrap.classList.remove('hidden');
    farmOtherName.value   = '';
    farmOtherAddress.value = '';
    farmOtherName.focus();
  } else {
    farmHiddenName.value  = farm.name;
    farmHiddenAddr.value  = farm.address;
    farmOtherWrap.classList.add('hidden');
    // Show auto-filled address with heading
    farmAddrDisplay.textContent = farm.address;
    if (farmAddrSection) farmAddrSection.classList.remove('hidden');
  }
  closeFarmPanel();
}

farmOtherName.addEventListener('input',    () => { farmHiddenName.value = farmOtherName.value.trim(); });
farmOtherAddress.addEventListener('input', () => { farmHiddenAddr.value = farmOtherAddress.value.trim(); });

function openFarmPanel() {
  farmPanel.classList.remove('hidden');
  farmSearchEl.value = '';
  renderFarmList();
  farmTrigger.classList.add('open');
  setTimeout(() => farmSearchEl.focus(), 50);
}

function closeFarmPanel() {
  farmPanel.classList.add('hidden');
  farmTrigger.classList.remove('open');
}

farmTrigger.addEventListener('click', (e) => {
  e.stopPropagation();
  farmPanel.classList.contains('hidden') ? openFarmPanel() : closeFarmPanel();
});

farmSearchEl.addEventListener('input', () => renderFarmList(farmSearchEl.value));

document.addEventListener('click', (e) => {
  if (!farmDropdown.contains(e.target)) closeFarmPanel();
});

function resetFarmDropdown() {
  farmTriggerTxt.textContent = 'Select a farm…';
  farmHiddenName.value  = '';
  farmHiddenAddr.value  = '';
  farmTrigger.classList.remove('has-value', 'invalid', 'open');
  const farmAddrSection = $('farm-address-section');
  if (farmAddrSection) farmAddrSection.classList.add('hidden');
  farmAddrDisplay.textContent = '';
  farmOtherWrap.classList.add('hidden');
  farmOtherName.value    = '';
  farmOtherAddress.value = '';
  closeFarmPanel();
}

/* Reset */
$('reg-reset').addEventListener('click', () => {
  regForm.reset();
  preview.classList.add('hidden');
  placeholder.classList.remove('hidden');
  vaccDateWrap.style.display = 'none';
  $('reg-feedback').classList.add('hidden');
  regForm.querySelectorAll('input').forEach(el => el.classList.remove('invalid'));
  resetBreedDropdown();
  resetFarmDropdown();
});

/* Submit */
regForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const required = ['reg-pig-name', 'reg-dob'];
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

  // Breed dropdown validation
  if (!breedHidden.value.trim()) {
    breedTrigger.classList.add('invalid');
    valid = false;
  } else {
    breedTrigger.classList.remove('invalid');
  }

  // Farm dropdown validation
  if (!farmHiddenName.value.trim()) {
    farmTrigger.classList.add('invalid');
    valid = false;
  } else {
    farmTrigger.classList.remove('invalid');
  }
  if (!farmHiddenAddr.value.trim()) {
    if (farmOtherWrap.classList.contains('hidden')) {
      farmTrigger.classList.add('invalid');
    } else {
      farmOtherAddress.classList.add('invalid');
    }
    valid = false;
  } else {
    farmOtherAddress.classList.remove('invalid');
  }

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

    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    // Show the auto-generated ID prominently
    const assignedId = data.pig.pig_id;
    if ($('auto-id-display')) $('auto-id-display').textContent = `Auto-assigned on save`;
    showFeedback('reg-feedback', 'success', `✓ ${data.pig.pig_name} registered — ID: ${assignedId}`);
    showToast(`${data.pig.pig_name} added — ID: ${assignedId}`, 'success', 4500);
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

document.addEventListener('DOMContentLoaded', () => {
  loadPigs();
});
