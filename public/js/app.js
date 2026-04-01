// app.js — Main application logic

const App = {
  neighbours: [],
  currentId: null,
  editingId: null,
  formResidents: [],
  formPets: [],
  mapInitialized: false,

  async init() {
    // Check auth
    const { authenticated } = await API.checkAuth();
    if (!authenticated) {
      this.showLogin();
    } else {
      this.showApp();
      await this.loadNeighbours();
    }

    this.bindEvents();
  },

  showLogin() {
    document.getElementById('login-overlay').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
  },

  showApp() {
    document.getElementById('login-overlay').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    if (!this.mapInitialized) {
      Map.init('map');
      Search.init(
        document.getElementById('search-input'),
        document.getElementById('search-results'),
        (id) => this.showDetail(id)
      );
      this.mapInitialized = true;
    }
  },

  bindEvents() {
    // Login
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = document.getElementById('login-password').value;
      const result = await API.login(password);
      if (result.ok) {
        this.showApp();
        await this.loadNeighbours();
      } else {
        document.getElementById('login-error').classList.remove('hidden');
      }
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', async () => {
      await API.logout();
      this.showLogin();
    });

    // Add button
    document.getElementById('add-btn').addEventListener('click', () => this.openAddModal());

    // Detail panel
    document.getElementById('detail-close-btn').addEventListener('click', () => this.closeDetail());
    document.getElementById('detail-edit-btn').addEventListener('click', () => {
      this.openEditModal(this.currentId);
    });
    document.getElementById('detail-delete-btn').addEventListener('click', () => {
      this.confirmDelete(this.currentId);
    });

    // Modal
    document.getElementById('modal-close-btn').addEventListener('click', () => this.closeModal());
    document.getElementById('modal-cancel-btn').addEventListener('click', () => this.closeModal());
    document.getElementById('neighbour-form').addEventListener('submit', (e) => this.handleFormSubmit(e));

    // Geocode button
    document.getElementById('geocode-btn').addEventListener('click', () => this.geocodeAddress());
    document.getElementById('pick-btn').addEventListener('click', () => this.openPickLocation(40.5437, -111.7489));

    // Dynamic lists
    document.querySelectorAll('.add-row-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        if (target === 'residents') this.addResidentRow();
        if (target === 'pets') this.addPetRow();
      });
    });

    // Delete modal
    document.getElementById('delete-cancel-btn').addEventListener('click', () => this.closeDeleteModal());
    document.getElementById('delete-confirm-btn').addEventListener('click', () => this.executeDelete());

    // Click outside modal to close
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') this.closeModal();
    });
    document.getElementById('delete-modal').addEventListener('click', (e) => {
      if (e.target.id === 'delete-modal') this.closeDeleteModal();
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
        this.closeDeleteModal();
        this.closeDetail();
      }
    });
  },

  async loadNeighbours() {
    try {
      this.neighbours = await API.getNeighbours();
      this.renderNeighbourList();
      Map.setNeighbours(this.neighbours);
    } catch (e) {
      console.error('Failed to load neighbours:', e);
    }
  },

  renderNeighbourList() {
    const list = document.getElementById('neighbour-list');
    const empty = document.getElementById('list-empty');

    if (!this.neighbours.length) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    list.innerHTML = this.neighbours.map(n => `
      <div class="neighbour-card${n.id === this.currentId ? ' active' : ''}" data-id="${n.id}">
        <div class="nc-address">${n.address}</div>
        <div class="nc-summary">${n.summary || 'No details yet'}</div>
        ${n.tags && n.tags.length ? `
          <div class="nc-tags">
            ${n.tags.slice(0, 4).map(t => `<span class="tag">${t}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `).join('');

    list.querySelectorAll('.neighbour-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        this.showDetail(id);
        Map.highlightMarker(id);
      });
    });
  },

  async showDetail(id) {
    try {
      const n = await API.getNeighbour(id);
      this.currentId = id;
      
      document.getElementById('detail-address').textContent = n.address;
      
      // Render markdown content
      const content = marked.parse(n.content || '');
      document.getElementById('detail-content').innerHTML = content;

      // Highlight active card
      document.querySelectorAll('.neighbour-card').forEach(c => {
        c.classList.toggle('active', c.dataset.id === id);
      });

      document.getElementById('detail-panel').classList.add('open');
    } catch (e) {
      console.error('Failed to load neighbour:', e);
    }
  },

  closeDetail() {
    document.getElementById('detail-panel').classList.remove('open');
    this.currentId = null;
    document.querySelectorAll('.neighbour-card').forEach(c => c.classList.remove('active'));
  },

  openAddModal() {
    this.editingId = null;
    document.getElementById('modal-title').textContent = 'Add Neighbour';
    document.getElementById('form-submit-btn').textContent = 'Add';
    document.getElementById('form-id').value = '';
    document.getElementById('form-address').value = '';
    document.getElementById('form-lat').value = '';
    document.getElementById('form-lng').value = '';
    document.getElementById('form-notes').value = '';
    document.getElementById('form-tags').value = '';
    document.getElementById('geocode-status').textContent = '';
    document.getElementById('geocode-status').style.color = '';
    this.formResidents = [];
    this.formPets = [];
    this.renderDynamicLists();
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('form-address').focus();
  },

  async openEditModal(id) {
    try {
      const n = await API.getNeighbour(id);
      this.editingId = id;
      document.getElementById('modal-title').textContent = 'Edit Neighbour';
      document.getElementById('form-submit-btn').textContent = 'Save';
      document.getElementById('form-id').value = n.id;
      document.getElementById('form-address').value = n.address || '';
      document.getElementById('form-lat').value = n.coordinates?.[0] || '';
      document.getElementById('form-lng').value = n.coordinates?.[1] || '';
      document.getElementById('form-tags').value = (n.tags || []).join(', ');
      document.getElementById('geocode-status').textContent = '';

      // Parse residents and pets from content
      this.formResidents = this.parseResidents(n.content);
      this.formPets = this.parsePets(n.content);
      this.formNotes = this.parseNotes(n.content);
      document.getElementById('form-notes').value = this.formNotes;
      this.renderDynamicLists();

      this.closeDetail();
      document.getElementById('modal-overlay').classList.remove('hidden');
    } catch (e) {
      console.error('Failed to load neighbour for edit:', e);
    }
  },

  parseResidents(content) {
    const residents = [];
    const lines = content.split('\n');
    let inSection = false;
    let current = null;
    lines.forEach(line => {
      if (line.startsWith('## Residents')) { inSection = true; current = null; return; }
      if (line.startsWith('##') || line.startsWith('#')) {
        if (current) residents.push(current);
        inSection = false; current = null; return;
      }
      if (!inSection) return;
      const personMatch = line.match(/^(\s*)-\s+\*\*([^:]+):\*\*\s+(.+)/);
      const contactMatch = line.match(/^(\s*)-\s+(Phone|Email):\s+(.+)/);
      if (personMatch) {
        if (current) residents.push(current);
        current = { role: personMatch[2], name: personMatch[3].trim(), phone: '', email: '' };
        return;
      }
      if (contactMatch && current) {
        const indent = contactMatch[1].length;
        if (indent > 0) {
          if (contactMatch[2].toLowerCase() === 'phone') current.phone = contactMatch[3].trim();
          else if (contactMatch[2].toLowerCase() === 'email') current.email = contactMatch[3].trim();
        }
        return;
      }
    });
    if (current) residents.push(current);
    return residents;
  },

  parsePets(content) {
    const pets = [];
    const lines = content.split('\n');
    let inSection = false;
    lines.forEach(line => {
      if (line.startsWith('## Pets')) { inSection = true; return; }
      if (line.startsWith('##') || line.startsWith('#')) { inSection = false; return; }
      if (inSection && line.trim().startsWith('-')) {
        const match = line.match(/- ([^(]+)\(([^)]+)\)/);
        if (match) pets.push({ name: match[1].trim(), type: match[2].trim() });
      }
    });
    return pets;
  },

  parseNotes(content) {
    const lines = content.split('\n');
    let inSection = false;
    let notes = [];
    lines.forEach(line => {
      if (line.startsWith('## Notes')) { inSection = true; return; }
      if (line.startsWith('##') || line.startsWith('#')) { inSection = false; return; }
      if (inSection && !line.trim().startsWith('-')) {
        notes.push(line.trim());
      }
    });
    return notes.join(' ').trim();
  },

  _syncResidentsFromDOM() {
    this.formResidents = [];
    document.querySelectorAll('#residents-list .resident-row').forEach(row => {
      const name = row.querySelector('[data-field="name"]')?.value?.trim();
      const role = row.querySelector('[data-field="role"]')?.value?.trim();
      const phone = row.querySelector('[data-field="phone"]')?.value?.trim();
      const email = row.querySelector('[data-field="email"]')?.value?.trim();
      if (name) this.formResidents.push({ role: role || 'Member', name, phone, email });
    });
  },

  _syncPetsFromDOM() {
    this.formPets = [];
    document.querySelectorAll('#pets-list .dynamic-row').forEach(row => {
      const name = row.querySelector('[data-field="name"]')?.value?.trim();
      const type = row.querySelector('[data-field="type"]')?.value?.trim();
      if (name) this.formPets.push({ name, type: type || 'pet' });
    });
  },

  renderDynamicLists() {
    const residentsList = document.getElementById('residents-list');
    const petsList = document.getElementById('pets-list');

    residentsList.innerHTML = this.formResidents.map((r, i) => `
      <div class="dynamic-row resident-row" data-index="${i}">
        <input type="text" class="role-input" value="${r.role || ''}" placeholder="Role" data-field="role">
        <input type="text" value="${r.name || ''}" placeholder="Name" data-field="name">
        <button type="button" class="remove-btn" data-type="resident" data-index="${i}">✕</button>
        <div class="resident-contacts" data-index="${i}">
          <input type="text" class="contact-input" value="${r.phone || ''}" placeholder="Phone" data-field="phone">
          <input type="text" class="contact-input" value="${r.email || ''}" placeholder="Email" data-field="email">
        </div>
      </div>
    `).join('');

    petsList.innerHTML = this.formPets.map((p, i) => `
      <div class="dynamic-row" data-index="${i}">
        <input type="text" value="${p.name || ''}" placeholder="Pet name" data-field="name">
        <input type="text" class="role-input" value="${p.type}" placeholder="Type (dog, cat...)" data-field="type">
        <button type="button" class="remove-btn" data-type="pet" data-index="${i}">✕</button>
      </div>
    `).join('');

    // Remove buttons
    residentsList.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._syncResidentsFromDOM();
        const i = parseInt(btn.dataset.index);
        this.formResidents.splice(i, 1);
        this.renderDynamicLists();
      });
    });
    petsList.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._syncPetsFromDOM();
        const i = parseInt(btn.dataset.index);
        this.formPets.splice(i, 1);
        this.renderDynamicLists();
      });
    });
  },

  addResidentRow() {
    this._syncResidentsFromDOM();
    this.formResidents.push({ role: '', name: '', phone: '', email: '' });
    this.renderDynamicLists();
  },

  addPetRow() {
    this._syncPetsFromDOM();
    this.formPets.push({ name: '', type: '' });
    this.renderDynamicLists();
  },

  async geocodeAddress() {
    const address = document.getElementById('form-address').value.trim();
    if (!address) return;
    
    const status = document.getElementById('geocode-status');
    status.textContent = 'Looking up...';
    
    try {
      const result = await API.geocode(address);
      if (result.lat && result.lng) {
        this.openPickLocation(result.lat, result.lng);
        status.textContent = 'Click the map to place the marker';
        status.style.color = 'var(--primary)';
      } else {
        status.textContent = 'Address not found — use "Pick on map"';
        status.style.color = 'var(--accent)';
      }
    } catch (e) {
      status.textContent = 'Geocoding failed';
      status.style.color = 'var(--danger)';
    }
  },

  openPickLocation(lat, lng) {
    // Hide the form modal completely, show a full-screen map for picking
    const modal = document.getElementById('modal-overlay');
    modal.classList.add('hidden');

    const pickOverlay = document.createElement('div');
    pickOverlay.id = 'pick-overlay';
    pickOverlay.style.cssText = `
      position: fixed; inset: 0; z-index: 700;
      display: flex; flex-direction: column;
    `;
    pickOverlay.innerHTML = `
      <div style="background:var(--surface);padding:0.75rem 1rem;display:flex;align-items:center;gap:1rem;border-bottom:1px solid var(--border);flex-shrink:0">
        <span style="flex:1;font-weight:600">Click on the map to place the marker</span>
        <span id="pick-coords" style="font-family:'JetBrains Mono',monospace;font-size:0.85rem;color:var(--muted)">${lat.toFixed(5)}, ${lng.toFixed(5)}</span>
        <button id="pick-cancel" class="btn btn-ghost">Cancel</button>
        <button id="pick-confirm" class="btn btn-accent">Confirm</button>
      </div>
      <div id="pick-map" style="flex:1"></div>
    `;
    document.body.appendChild(pickOverlay);

    const pickMap = L.map('pick-map', { zoomControl: true }).setView([lat, lng], 19);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19
    }).addTo(pickMap);

    let marker = L.marker([lat, lng], {
      icon: L.divIcon({
        html: '<div class="marker-pin"></div>',
        className: 'custom-marker',
        iconSize: [24, 32], iconAnchor: [12, 32]
      })
    }).addTo(pickMap);

    const coordsEl = pickOverlay.querySelector('#pick-coords');
    pickMap.on('click', (e) => {
      marker.setLatLng(e.latlng);
      coordsEl.textContent = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
    });

    pickOverlay.querySelector('#pick-cancel').addEventListener('click', () => {
      pickMap.remove();
      pickOverlay.remove();
      modal.classList.remove('hidden');
    });

    pickOverlay.querySelector('#pick-confirm').addEventListener('click', () => {
      const ll = marker.getLatLng();
      document.getElementById('form-lat').value = ll.lat.toFixed(6);
      document.getElementById('form-lng').value = ll.lng.toFixed(6);
      document.getElementById('geocode-status').textContent = `Position set (${ll.lat.toFixed(4)}, ${ll.lng.toFixed(4)})`;
      document.getElementById('geocode-status').style.color = 'var(--primary)';
      pickMap.remove();
      pickOverlay.remove();
      modal.classList.remove('hidden');
    });
  },

  closeModal() {
    // Clean up any pick-location map that might be open
    const pickOverlay = document.getElementById('pick-overlay');
    if (pickOverlay) { pickOverlay.remove(); }
    document.getElementById('modal-overlay').classList.add('hidden');
    this.editingId = null;
  },

  async handleFormSubmit(e) {
    e.preventDefault();

    // Gather form data
    const address = document.getElementById('form-address').value.trim();
    if (!address) return;

    // Read dynamic lists from DOM
    const residents = [];
    document.querySelectorAll('#residents-list .resident-row').forEach(row => {
      const role = row.querySelector('[data-field="role"]')?.value?.trim();
      const name = row.querySelector('[data-field="name"]')?.value?.trim();
      const phone = row.querySelector('[data-field="phone"]')?.value?.trim();
      const email = row.querySelector('[data-field="email"]')?.value?.trim();
      if (name) residents.push({ role: role || 'Member', name, phone, email });
    });

    const pets = [];
    document.querySelectorAll('#pets-list .dynamic-row').forEach(row => {
      const name = row.querySelector('[data-field="name"]')?.value?.trim();
      const type = row.querySelector('[data-field="type"]')?.value?.trim();
      if (name) pets.push({ name, type: type || 'pet' });
    });

    const notes = document.getElementById('form-notes').value.trim();
    const tagsStr = document.getElementById('form-tags').value.trim();
    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];

    const lat = parseFloat(document.getElementById('form-lat').value);
    const lng = parseFloat(document.getElementById('form-lng').value);
    const coordinates = (!isNaN(lat) && !isNaN(lng)) ? [lat, lng] : [];

    const data = {
      id: this.editingId,
      address,
      residents,
      pets,
      notes,
      tags,
      coordinates
    };

    try {
      await API.saveNeighbour(data);
      this.closeModal();
      await this.loadNeighbours();
    } catch (err) {
      alert('Failed to save: ' + err.message);
    }
  },

  confirmDelete(id) {
    this.deleteTarget = id;
    const n = this.neighbours.find(n => n.id === id);
    document.getElementById('delete-address').textContent = n?.address || id;
    document.getElementById('delete-modal').classList.remove('hidden');
  },

  closeDeleteModal() {
    document.getElementById('delete-modal').classList.add('hidden');
    this.deleteTarget = null;
  },

  async executeDelete() {
    if (!this.deleteTarget) return;
    try {
      await API.deleteNeighbour(this.deleteTarget);
      this.closeDeleteModal();
      this.closeDetail();
      await this.loadNeighbours();
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  }
};

// Init on DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());
