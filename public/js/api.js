// api.js — API fetch wrappers

const API = {
  _csrfToken: null,

  // Fetch CSRF token from server (called once at init)
  async fetchCsrfToken() {
    try {
      const res = await fetch('/api/auth/csrf-token');
      if (res.ok) {
        const data = await res.json();
        this._csrfToken = data.csrfToken;
      }
    } catch (e) {
      console.error('Failed to fetch CSRF token:', e);
    }
  },

  // Read CSRF token from cookie (fallback / primary method)
  _getCsrfToken() {
    const match = document.cookie.match(/csrfToken=([^;]+)/);
    return match ? match[1] : this._csrfToken;
  },

  _headers(extra = {}) {
    const headers = { 'Content-Type': 'application/json', ...extra };
    const token = this._getCsrfToken();
    if (token) headers['X-CSRF-Token'] = token;
    return headers;
  },

  async checkAuth() {
    const res = await fetch('/api/auth/check');
    return res.json();
  },

  async login(password) {
    // Login has its own rate limiter server-side; no CSRF needed (no session yet)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    // Fetch CSRF token after successful login to prepare for authenticated requests
    if (res.ok) await this.fetchCsrfToken();
    return res.json();
  },

  async logout() {
    const res = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: this._headers()
    });
    this._csrfToken = null;
    return res.json();
  },

  async getNeighbours() {
    const res = await fetch('/api/neighbours');
    if (!res.ok) throw new Error('Failed to load neighbours');
    return res.json();
  },

  async getNeighbour(id) {
    const res = await fetch(`/api/neighbours/${id}`);
    if (!res.ok) throw new Error('Failed to load neighbour');
    return res.json();
  },

  async saveNeighbour(data) {
    const method = data.id ? 'PUT' : 'POST';
    const url = data.id ? `/api/neighbours/${data.id}` : '/api/neighbours';
    const res = await fetch(url, {
      method,
      headers: this._headers(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save');
    }
    return res.json();
  },

  async deleteNeighbour(id) {
    const res = await fetch(`/api/neighbours/${id}`, {
      method: 'DELETE',
      headers: this._headers()
    });
    if (!res.ok) throw new Error('Failed to delete');
    return res.json();
  },

  async search(query) {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Search failed');
    return res.json();
  },

  async geocode(address) {
    const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
    if (!res.ok) throw new Error('Geocoding failed');
    return res.json();
  }
};
