// search.js — client-side search

const Search = {
  debounceTimer: null,

  init(inputEl, resultsEl, onSelect) {
    this.inputEl = inputEl;
    this.resultsEl = resultsEl;
    this.onSelect = onSelect;

    this.inputEl.addEventListener('input', () => this.onInput());
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-wrap')) this.close();
    });
  },

  async onInput() {
    const q = this.inputEl.value.trim();
    clearTimeout(this.debounceTimer);

    if (!q) {
      this.close();
      return;
    }

    this.debounceTimer = setTimeout(async () => {
      try {
        const results = await API.search(q);
        this.showResults(results);
      } catch (e) {
        console.error('Search error:', e);
      }
    }, 200);
  },

  showResults(results) {
    if (!results.length) {
      this.resultsEl.innerHTML = '<div class="search-result-item"><span class="sr-address">No results</span></div>';
    } else {
      this.resultsEl.innerHTML = results.slice(0, 8).map(r => `
        <div class="search-result-item" data-id="${r.id}">
          <div class="sr-address">${r.address || r.id}</div>
          <div class="sr-summary">Lat: ${r.coordinates?.[0]?.toFixed(4) || '—'}, Lng: ${r.coordinates?.[1]?.toFixed(4) || '—'}</div>
        </div>
      `).join('');
    }
    this.resultsEl.classList.remove('hidden');
    this.resultsEl.querySelectorAll('.search-result-item[data-id]').forEach(el => {
      el.addEventListener('click', () => {
        this.onSelect(el.dataset.id);
        this.close();
      });
    });
  },

  close() {
    this.resultsEl.classList.add('hidden');
    this.inputEl.value = '';
  }
};
