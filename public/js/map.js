// map.js — Leaflet map management

const Map = {
  map: null,
  markers: {},
  myLocationMarker: null,

  init(containerId) {
    this.container = document.getElementById(containerId);
    this.map = L.map(this.container, {
      zoomControl: true,
      attributionControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(this.map);

    // Default view (will be overridden when neighbours load)
    // Default map center
    this.map.setView([40.5437, -111.7489], 16);

    // Add "My Location" button
    this._addMyLocationButton();
  },

  _addMyLocationButton() {
    const btn = L.control({ position: 'topright' });
    btn.onAdd = () => {
      const el = L.DomUtil.create('button', 'my-location-btn');
      el.innerHTML = '📍 Me';
      el.title = 'Show my location';
      el.style.cssText = `
        background: white;
        border: 1px solid #ccc;
        border-radius: 6px;
        padding: 6px 10px;
        font-size: 14px;
        cursor: pointer;
        box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        font-family: inherit;
        z-index: 1000;
      `;
      el.addEventListener('click', (e) => {
        L.DomEvent.stopPropagation(e);
        this.locateMe();
      });
      return el;
    };
    btn.addTo(this.map);
  },

  locateMe() {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        if (this.myLocationMarker) {
          this.myLocationMarker.setLatLng([lat, lng]);
        } else {
          this.myLocationMarker = L.marker([lat, lng], {
            icon: L.divIcon({
              html: `<div class="my-location-pin">
                <div class="my-location-dot"></div>
                <div class="my-location-pulse"></div>
              </div>`,
              className: 'my-location-marker',
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            })
          }).addTo(this.map);
        }

        this.map.setView([lat, lng], 18);
      },
      (err) => {
        alert('Could not get your location: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  },

  setNeighbours(neighbours) {
    // Clear existing markers
    Object.values(this.markers).forEach(m => m.remove());
    this.markers = {};

    // Delegated event: catch "View details" clicks on the map container.
    // Attached once here (not inside forEach) — avoids duplicate listeners.
    const popupClickHandler = (e) => {
      const link = e.target.closest('.popup-link');
      if (link) {
        e.preventDefault();
        App.showDetail(link.dataset.neighbourId);
      }
    };
    this.container.removeEventListener('click', popupClickHandler);
    this.container.addEventListener('click', popupClickHandler);

    // Add markers for neighbours with coordinates
    const withCoords = neighbours.filter(n => n.coordinates && n.coordinates.length === 2);
    
    withCoords.forEach(n => {
      const [lat, lng] = n.coordinates;
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          html: '<div class="marker-pin"></div>',
          className: 'custom-marker',
          iconSize: [24, 32],
          iconAnchor: [12, 32]
        })
      });

      const petEmoji = this.extractPetsEmoji(n);
      marker.bindPopup(`
        <div class="popup-address">${n.address}</div>
        <div class="popup-summary">${n.summary || ''} ${petEmoji}</div>
        <a href="#" class="popup-link" data-neighbour-id="${n.id}">View details →</a>
      `);

      marker.addTo(this.map);
      this.markers[n.id] = marker;
    });

    // Fit bounds if we have neighbours with coords
    if (withCoords.length > 1) {
      const group = L.featureGroup(withCoords.map(n => this.markers[n.id]));
      this.map.fitBounds(group.getBounds().pad(0.1));
    } else if (withCoords.length === 1) {
      this.map.setView(withCoords[0].coordinates, 17);
    }
  },

  extractPetsEmoji(n) {
    // Simple emoji extraction for popup
    if (!n.summary) return '';
    if (n.summary.includes('pet')) return '🐾';
    return '';
  },

  highlightMarker(id) {
    if (this.markers[id]) {
      this.markers[id].openPopup();
      const latlng = this.markers[id].getLatLng();
      this.map.setView(latlng, Math.max(this.map.getZoom(), 17));
    }
  },

  centerOn(id) {
    if (this.markers[id]) {
      const latlng = this.markers[id].getLatLng();
      this.map.setView(latlng, 18);
    }
  }
};
