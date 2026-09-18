const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;
const HISTORY_MAX = 100;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/device', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'device.html'));
});

const devices = new Map();
const monitors = new Map();
const socketType = new Map();

function getDeviceSummary(code) {
  const d = devices.get(code);
  if (!d) return null;
  return {
    pairingCode: code,
    lat: d.lat,
    lng: d.lng,
    speed: d.speed,
    lastUpdate: d.lastUpdate,
    status: d.status,
    history: d.history.slice()
  };
}

function broadcastDeviceToPairedMonitors(code) {
  const summary = getDeviceSummary(code);
  if (!summary) return;
  for (const [socketId, mon] of monitors.entries()) {
    if (mon.pairedCodes && mon.pairedCodes.has(code)) {
      io.to(socketId).emit('monitor:deviceUpdate', summary);
    }
  }
}

io.on('connection', (socket) => {
  console.log('[SOCKET] Connected:', socket.id);

  socket.on('device:register', ({ pairingCode }) => {
    const code = String(pairingCode || '').trim().toUpperCase();
    if (!code) return;
    socketType.set(socket.id, { type: 'device', code });
    if (!devices.has(code)) {
      devices.set(code, {
        lat: null,
        lng: null,
        speed: 0,
        lastUpdate: Date.now(),
        status: 'connected',
        history: []
      });
    } else {
      devices.get(code).status = 'connected';
      devices.get(code).lastUpdate = Date.now();
    }
    console.log(`[DEVICE] Registered: ${code} (socket ${socket.id})`);
    broadcastDeviceToPairedMonitors(code);
  });

  socket.on('device:location', ({ pairingCode, lat, lng, speed, timestamp }) => {
    const code = String(pairingCode || '').trim().toUpperCase();
    if (!code || lat == null || lng == null) return;
    const dev = devices.get(code);
    if (!dev) {
      devices.set(code, {
        lat, lng, speed: speed || 0, lastUpdate: timestamp || Date.now(),
        status: 'connected', history: []
      });
    } else {
      dev.lat = lat;
      dev.lng = lng;
      dev.speed = Number(speed) || 0;
      dev.lastUpdate = timestamp || Date.now();
      dev.status = (dev.speed > 0.5) ? 'moving' : 'connected';
      dev.history.push({ lat, lng, t: dev.lastUpdate });
      if (dev.history.length > HISTORY_MAX) {
        dev.history.splice(0, dev.history.length - HISTORY_MAX);
      }
    }
    broadcastDeviceToPairedMonitors(code);
  });

  socket.on('monitor:subscribe', () => {
    socketType.set(socket.id, { type: 'monitor' });
    monitors.set(socket.id, { pairedCodes: new Set() });
    console.log(`[MONITOR] Subscribed: ${socket.id}`);
  });

  socket.on('monitor:pair', ({ pairingCode }) => {
    const code = String(pairingCode || '').trim().toUpperCase();
    if (!code) return;
    const mon = monitors.get(socket.id);
    if (!mon) return;
    mon.pairedCodes.add(code);
    console.log(`[MONITOR] ${socket.id} paired with ${code}`);
    const summary = getDeviceSummary(code);
    if (summary) {
      socket.emit('monitor:deviceUpdate', summary);
    } else {
      socket.emit('monitor:deviceUpdate', {
        pairingCode: code,
        lat: null, lng: null, speed: 0,
        lastUpdate: null, status: 'offline', history: []
      });
    }
  });

  socket.on('monitor:unpair', ({ pairingCode }) => {
    const code = String(pairingCode || '').trim().toUpperCase();
    const mon = monitors.get(socket.id);
    if (mon && mon.pairedCodes) {
      mon.pairedCodes.delete(code);
      console.log(`[MONITOR] ${socket.id} unpaired ${code}`);
    }
  });

  socket.on('disconnect', () => {
    const info = socketType.get(socket.id);
    if (info) {
      if (info.type === 'device') {
        const code = info.code;
        const dev = devices.get(code);
        if (dev) {
          dev.status = 'disconnected';
          dev.lastUpdate = Date.now();
          broadcastDeviceToPairedMonitors(code);
        }
        console.log(`[DEVICE] Disconnected: ${code}`);
      } else if (info.type === 'monitor') {
        monitors.delete(socket.id);
        console.log(`[MONITOR] Disconnected: ${socket.id}`);
      }
    }
    socketType.delete(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`  Monitor:        http://localhost:${PORT}/`);
  console.log(`  Device Sim:     http://localhost:${PORT}/device`);
});
