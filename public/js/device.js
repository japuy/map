(function () {
  const $ = (id) => document.getElementById(id);

  const pairingCodeEl = $('pairingCode');
  const simModeEl = $('simMode');
  const baseLatEl = $('baseLat');
  const baseLngEl = $('baseLng');
  const startBtn = $('startBtn');
  const stopBtn = $('stopBtn');
  const geoBtn = $('geoBtn');
  const clearLogBtn = $('clearLog');

  const curLatEl = $('curLat');
  const curLngEl = $('curLng');
  const curSpeedEl = $('curSpeed');
  const curTimeEl = $('curTime');

  const connStatus = $('connStatus');
  const connText = $('connText');
  const logBody = $('logBody');

  let socket = null;
  let timerId = null;
  let simState = null;
  let geoWatchId = null;
  let isRunning = false;
  let registered = false;

  function nowStr() {
    const d = new Date();
    return d.toLocaleTimeString('id-ID', { hour12: false });
  }

  function log(msg, level = 'info') {
    const line = document.createElement('div');
    line.className = 'log-line ' + level;
    line.innerHTML = `<span class="t">[${nowStr()}]</span>${msg}`;
    logBody.appendChild(line);
    logBody.scrollTop = logBody.scrollHeight;
    while (logBody.childElementCount > 300) {
      logBody.removeChild(logBody.firstChild);
    }
  }

  clearLogBtn.addEventListener('click', () => {
    logBody.innerHTML = '';
  });

  function setConn(on, text) {
    connStatus.classList.toggle('cs-on', !!on);
    connStatus.classList.toggle('cs-off', !on);
    connText.textContent = text || (on ? 'Terhubung ke server' : 'Terputus dari server');
  }

  function ensureSocket() {
    if (socket) return socket;
    socket = io();
    socket.on('connect', () => {
      setConn(true);
      log('Socket terhubung ke server', 'ok');
      if (isRunning && !registered) {
        doRegister();
      }
    });
    socket.on('disconnect', () => {
      setConn(false);
      log('Socket terputus dari server', 'warn');
      registered = false;
    });
    socket.on('connect_error', (e) => {
      setConn(false);
      log('Gagal konek ke server: ' + e.message, 'err');
    });
    return socket;
  }

  function code() {
    return String(pairingCodeEl.value || '').trim().toUpperCase() || 'DEV-0001';
  }

  function doRegister() {
    const s = ensureSocket();
    if (s.connected) {
      s.emit('device:register', { pairingCode: code() });
      registered = true;
      log(`Register device: <b>${code()}</b>`, 'ok');
    }
  }

  function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const toRad = (d) => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function fmtCoord(v) {
    return Number(v).toFixed(6);
  }

  function updateStatusTiles(lat, lng, speed, ts) {
    curLatEl.textContent = fmtCoord(lat);
    curLngEl.textContent = fmtCoord(lng);
    curSpeedEl.textContent = speed.toFixed(2) + ' km/j';
    curTimeEl.textContent = new Date(ts).toLocaleTimeString('id-ID', { hour12: false });
  }

  function sendUpdate(lat, lng, speed, ts) {
    const s = ensureSocket();
    if (!s.connected) return;
    const payload = {
      pairingCode: code(),
      lat, lng, speed,
      timestamp: ts
    };
    s.emit('device:location', payload);
    updateStatusTiles(lat, lng, speed, ts);
    log(`Sending update → lat=${fmtCoord(lat)}, lng=${fmtCoord(lng)}, speed=${speed.toFixed(1)} km/j`, 'info');
  }

  function stepRandom(state) {
    const STEP_DEG = 0.00003 + Math.random() * 0.00008;
    const ang = state.angle + (Math.random() - 0.5) * 0.6;
    state.angle = ang;
    const nlat = state.lat + Math.sin(ang) * STEP_DEG;
    const nlng = state.lng + Math.cos(ang) * STEP_DEG;
    return [nlat, nlng];
  }

  function stepCircle(state) {
    state.theta += 0.012;
    const r = 0.0035;
    const nlat = state.baseLat + Math.sin(state.theta) * r;
    const nlng = state.baseLng + Math.cos(state.theta) * r;
    return [nlat, nlng];
  }

  function stepStatic(state) {
    return [state.lat, state.lng];
  }

  let _smoothSpeed = 0;

  function startSimulation() {
    if (isRunning) return;
    const baseLat = Number(baseLatEl.value);
    const baseLng = Number(baseLngEl.value);
    if (Number.isNaN(baseLat) || Number.isNaN(baseLng)) {
      alert('Koordinat awal tidak valid');
      return;
    }
    const mode = simModeEl.value;
    _smoothSpeed = 0;
    simState = {
      mode,
      baseLat,
      baseLng,
      lat: baseLat,
      lng: baseLng,
      prevLat: baseLat,
      prevLng: baseLng,
      prevT: Date.now(),
      angle: Math.random() * Math.PI * 2,
      theta: 0
    };
    isRunning = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    pairingCodeEl.disabled = true;
    simModeEl.disabled = true;
    baseLatEl.disabled = true;
    baseLngEl.disabled = true;

    ensureSocket();
    doRegister();
    log(`Mulai simulasi mode: <b>${simModeEl.options[simModeEl.selectedIndex].text}</b>`, 'ok');

    timerId = setInterval(() => {
      let nlat, nlng;
      if (simState.mode === 'random') [nlat, nlng] = stepRandom(simState);
      else if (simState.mode === 'circle') [nlat, nlng] = stepCircle(simState);
      else [nlat, nlng] = stepStatic(simState);

      const now = Date.now();
      const dtHours = (now - simState.prevT) / 1000 / 3600;
      const distKm = haversine(simState.prevLat, simState.prevLng, nlat, nlng);
      let rawSpeed = dtHours > 0 ? distKm / dtHours : 0;
      if (!Number.isFinite(rawSpeed)) rawSpeed = 0;
      if (simState.mode === 'static') { rawSpeed = 0; _smoothSpeed = 0; }
      else { _smoothSpeed = _smoothSpeed * 0.6 + rawSpeed * 0.4; }
      const speed = Math.max(0, Math.min(_smoothSpeed, 180));

      simState.prevLat = simState.lat;
      simState.prevLng = simState.lng;
      simState.prevT = now;
      simState.lat = nlat;
      simState.lng = nlng;

      sendUpdate(nlat, nlng, speed, now);
    }, 1000);
  }

  function stopSimulation() {
    if (!isRunning) return;
    isRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    pairingCodeEl.disabled = false;
    simModeEl.disabled = false;
    baseLatEl.disabled = false;
    baseLngEl.disabled = false;
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    if (geoWatchId != null) {
      navigator.geolocation.clearWatch(geoWatchId);
      geoWatchId = null;
    }
    registered = false;
    log('Simulasi dihentikan.', 'warn');
  }

  startBtn.addEventListener('click', startSimulation);
  stopBtn.addEventListener('click', stopSimulation);

  geoBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      alert('Browser tidak mendukung Geolocation API');
      return;
    }
    if (isRunning) {
      alert('Hentikan simulasi terlebih dahulu sebelum pakai lokasi asli');
      return;
    }
    log('Minta izin lokasi ke browser...', 'info');
    geoWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed } = pos.coords;
        const speedKmh = (speed && speed > 0) ? (speed * 3.6) : 0;
        if (!isRunning) {
          baseLatEl.value = Number(latitude).toFixed(6);
          baseLngEl.value = Number(longitude).toFixed(6);
          isRunning = true;
          startBtn.disabled = true;
          stopBtn.disabled = false;
          pairingCodeEl.disabled = true;
          simModeEl.disabled = true;
          ensureSocket();
          doRegister();
          log('Menggunakan lokasi asli GPS (watch position)', 'ok');
        }
        sendUpdate(latitude, longitude, speedKmh, Date.now());
      },
      (err) => {
        log('Gagal baca lokasi: ' + err.message, 'err');
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
  });

  ensureSocket();
  log('Siap. Isi Pairing Code lalu klik Mulai Simulasi.', 'info');
})();
