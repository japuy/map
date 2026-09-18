(function () {
  const map = L.map('map', {
    zoomControl: true,
    attributionControl: true
  }).setView([-6.2088, 106.8456], 11);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  const PALETTE = [
    '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#7c3aed',
    '#ea580c', '#0891b2', '#db2777', '#4f46e5', '#059669'
  ];

  function hashCode(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  function colorFor(code) {
    return PALETTE[hashCode(code) % PALETTE.length];
  }

  function deviceIcon(code, status) {
    const color = colorFor(code);
    const ring = (status === 'connected' || status === 'moving')
      ? `<circle cx="14" cy="14" r="13" fill="none" stroke="${color}" stroke-width="2" opacity="0.35"/>`
      : '';
    const inner = (status === 'moving') ? '#2563eb' : (status === 'connected' ? '#16a34a' : '#94a3b8');
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
        ${ring}
        <circle cx="14" cy="14" r="9" fill="${color}" stroke="#ffffff" stroke-width="2.5"/>
        <circle cx="14" cy="14" r="3.2" fill="${inner}"/>
      </svg>`;
    return L.divIcon({
      className: 'dev-marker',
      html: svg,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14]
    });
  }

  const state = {
    devices: new Map()
  };

  function speedClass(speed) {
    if (speed < 0.5) return 'speed-zero';
    if (speed < 30) return 'speed-low';
    if (speed < 80) return 'speed-mid';
    return 'speed-high';
  }

  function fmtTime(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    return d.toLocaleTimeString('id-ID', { hour12: false });
  }

  function fmtCoord(v) {
    if (v == null) return '-';
    return Number(v).toFixed(5);
  }

  function statusLabel(s) {
    if (s === 'moving') return 'Bergerak';
    if (s === 'connected') return 'Terhubung';
    if (s === 'disconnected') return 'Terputus';
    if (s === 'offline') return 'Offline';
    return s || '-';
  }

  function ensureDevice(code) {
    let d = state.devices.get(code);
    if (!d) {
      const marker = L.marker([0, 0], {
        icon: deviceIcon(code, 'offline')
      });
      const polyline = L.polyline([], {
        color: colorFor(code),
        weight: 4,
        opacity: 0.72
      });
      d = {
        code,
        marker,
        polyline,
        data: null,
        cardEl: null
      };
      state.devices.set(code, d);
    }
    return d;
  }

  function renderDeviceCard(code, data) {
    const d = ensureDevice(code);
    const listEl = document.getElementById('deviceList');
    const emptyHint = listEl.querySelector('.empty-hint');
    if (emptyHint) emptyHint.remove();

    if (!d.cardEl) {
      const card = document.createElement('div');
      card.className = 'device-card';
      card.dataset.code = code;
      card.innerHTML = `
        <div class="device-head">
          <div class="device-title-row">
            <span class="device-name" data-role="name">${code}</span>
          </div>
          <button class="btn btn-danger" data-role="remove">Hapus</button>
        </div>
        <div class="device-head" style="margin-bottom:10px;">
          <span class="status-badge connected" data-role="status">
            <span class="dot"></span>
            <span class="status-text">Terhubung</span>
          </span>
        </div>
        <div class="device-info-grid">
          <div class="info-block">
            <span class="label">Kecepatan</span>
            <div class="value speed-zero" data-role="speed">0 km/j</div>
          </div>
          <div class="info-block">
            <span class="label">Update</span>
            <div class="value" data-role="time">-</div>
          </div>
          <div class="info-block">
            <span class="label">Lat</span>
            <div class="value" data-role="lat">-</div>
          </div>
          <div class="info-block">
            <span class="label">Lng</span>
            <div class="value" data-role="lng">-</div>
          </div>
        </div>
      `;
      card.querySelector('[data-role="remove"]').addEventListener('click', () => {
        removeDevice(code);
      });
      listEl.appendChild(card);
      d.cardEl = card;
    }

    const card = d.cardEl;
    const statusBadge = card.querySelector('[data-role="status"]');
    const statusText = statusBadge.querySelector('.status-text');
    const speedEl = card.querySelector('[data-role="speed"]');
    const timeEl = card.querySelector('[data-role="time"]');
    const latEl = card.querySelector('[data-role="lat"]');
    const lngEl = card.querySelector('[data-role="lng"]');

    const st = data.status || 'offline';
    statusBadge.className = 'status-badge ' + st;
    statusText.textContent = statusLabel(st);

    const speed = Number(data.speed) || 0;
    speedEl.className = 'value ' + speedClass(speed);
    speedEl.textContent = speed.toFixed(1) + ' km/j';

    timeEl.textContent = fmtTime(data.lastUpdate);
    latEl.textContent = fmtCoord(data.lat);
    lngEl.textContent = fmtCoord(data.lng);
  }

  function renderMapMarker(code, data) {
    const d = ensureDevice(code);
    d.data = data;

    if (data.lat != null && data.lng != null) {
      const latlng = [data.lat, data.lng];

      if (!d.markerAdded) {
        d.marker.addTo(map);
        d.polyline.addTo(map);
        d.markerAdded = true;
      }

      d.marker.setLatLng(latlng);
      d.marker.setIcon(deviceIcon(code, data.status || 'connected'));

      const popupHTML = `
        <div class="pop-name">${code}</div>
        <div class="pop-row"><span class="k">Status</span><span class="v">${statusLabel(data.status)}</span></div>
        <div class="pop-row"><span class="k">Kecepatan</span><span class="v">${(Number(data.speed)||0).toFixed(1)} km/j</span></div>
        <div class="pop-row"><span class="k">Lat</span><span class="v">${fmtCoord(data.lat)}</span></div>
        <div class="pop-row"><span class="k">Lng</span><span class="v">${fmtCoord(data.lng)}</span></div>
        <div class="pop-row"><span class="k">Update</span><span class="v">${fmtTime(data.lastUpdate)}</span></div>
      `;
      d.marker.bindPopup(popupHTML);

      const hist = data.history || [];
      if (hist.length > 0) {
        d.polyline.setLatLngs(hist.map(p => [p.lat, p.lng]));
      }

      if (map.getBounds().contains(latlng) === false) {
        map.panTo(latlng, { animate: true, duration: 0.6 });
      }
    }
  }

  function removeDevice(code) {
    const d = state.devices.get(code);
    if (!d) return;
    if (d.markerAdded) {
      map.removeLayer(d.marker);
      map.removeLayer(d.polyline);
    }
    if (d.cardEl) {
      d.cardEl.remove();
    }
    state.devices.delete(code);
    if (socket && socket.connected) {
      socket.emit('monitor:unpair', { pairingCode: code });
    }
    const listEl = document.getElementById('deviceList');
    if (listEl.children.length === 0) {
      listEl.innerHTML = `
        <div class="empty-hint">
          <span class="icon">🗺️</span>
          Belum ada device yang ditambahkan.<br/>
          Masukkan Pairing Code untuk mulai memantau.
        </div>`;
    }
  }

  const socket = io();

  socket.on('connect', () => {
    console.log('[Monitor] Connected to server');
    socket.emit('monitor:subscribe');
    for (const code of state.devices.keys()) {
      socket.emit('monitor:pair', { pairingCode: code });
    }
  });

  socket.on('disconnect', () => {
    console.warn('[Monitor] Disconnected from server');
  });

  socket.on('monitor:deviceUpdate', (payload) => {
    const code = payload.pairingCode;
    if (!state.devices.has(code)) return;
    renderDeviceCard(code, payload);
    renderMapMarker(code, payload);
  });

  function pairNewDevice(code) {
    code = String(code || '').trim().toUpperCase();
    if (!code) return;
    if (state.devices.has(code)) return;
    ensureDevice(code);
    renderDeviceCard(code, {
      pairingCode: code,
      lat: null, lng: null, speed: 0,
      lastUpdate: null, status: 'offline', history: []
    });
    socket.emit('monitor:pair', { pairingCode: code });
  }

  const pairInput = document.getElementById('pairCode');
  const pairBtn = document.getElementById('pairBtn');

  function submitPair() {
    pairNewDevice(pairInput.value);
    pairInput.value = '';
    pairInput.focus();
  }

  pairBtn.addEventListener('click', submitPair);
  pairInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitPair();
  });

  setTimeout(() => { map.invalidateSize(); }, 150);
  window.addEventListener('resize', () => map.invalidateSize());
})();
