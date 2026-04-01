// api.js — API fetch wrappers

const API = {
  async checkAuth() {
    const res = await fetch('/api/auth/check');
    return res.json();
  },

  async login(password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    return res.json();
  },

  async logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save');
    }
    return res.json();
  },

  async deleteNeighbour(id) {
    const res = await fetch(`/api/neighbours/${id}`, { method: 'DELETE' });
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
