// Isolated protocol fixture: no production database or mock fallback in app runtime.
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../../Racehorse_Training_Management_System_MT_BE/package.json', import.meta.url));
const { Server } = require('socket.io');
const records = [];
const incidents = [];
const horse = { id: 'h1', name: 'Atlas', status: 'ACTIVE', isMedicalLocked: false, weightKg: 480 };
const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'content-type,authorization');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.end(); return; }
  if (req.url === '/records') { res.end(JSON.stringify(records)); return; }
  if (req.url === '/incidents') { res.end(JSON.stringify(incidents)); return; }
  if (req.url.match(/^\/api\/training\/workouts\/w[12]$/)) {
    res.end(JSON.stringify({ success: true, data: { id: req.url.split('/').pop(), trainingPlanId: 'p1', horseId: 'h1', horse, scheduledDate: '2026-11-14T10:00:00Z', workoutType: 'BREEZE', intensity: 'HEAVY', trackSurface: 'TURF', distanceMeters: 800, status: 'SCHEDULED' } })); return;
  }
  const start = req.url.match(/^\/api\/simulator\/workouts\/(w[12])\/start$/);
  if (start) { res.end(JSON.stringify({ success: true, data: { sessionId: `WORKOUT-${start[1]}`, status: 'PENDING', launchUrl: 'http://localhost:5175/unused' } })); return; }
  const latest = req.url.match(/^\/api\/simulator\/workouts\/(w[12])\/latest$/);
  if (latest) {
    const result = records.find(r => r.payload.session_id === `WORKOUT-${latest[1]}`)?.payload.result;
    if (!result) { res.statusCode = 404; res.end(JSON.stringify({ success: false, code: 'SIMULATOR_RESULT_NOT_FOUND' })); return; }
    res.end(JSON.stringify({ success: true, data: { status: 'COMPLETED', resultDraft: { actualDistanceMeters: result.distanceCompletedM, actualTimeSeconds: result.durationS, heartRatePeak: result.peakHr, heartRateRecovery: result.hrRecovery10m, topSpeedKmh: result.topSpeedKmh, actualSurface: 'TURF', trackCondition: 'GOOD' } } })); return;
  }
  if (req.url.startsWith('/api/horses/')) {
    const id = req.url.split('/').pop();
    res.end(JSON.stringify({ success: true, data: { ...horse, id, name: `Horse ${id.slice(1)}` } })); return;
  }
  if (req.url === '/lock') {
    io.of('/simulator').emit('sys:medical_lock_sync', { event: 'sys:medical_lock_sync', horse_id: 'h1', medical_lock: true });
    res.end('{}'); return;
  }
  const match = req.url.match(/\/sessions\/([^/]+)\/context/);
  if (match) {
    const id = decodeURIComponent(match[1]), type = id.split('-')[0];
    const data = { type, sessionId: id, status: 'PENDING', horse,
      workout: { id: 'w1', distanceMeters: 800, intensity: 'HEAVY', trackSurface: 'TURF', workoutType: 'BREEZE' },
      tournamentName: type === 'RACE' ? 'EquiFlow Cup' : undefined, distanceMeters: 1200, surface: 'GRASS',
      entries: Array.from({ length: 8 }, (_, i) => ({ lane: i + 1, registrationId: `r${i}`, horse: { id: `h${i + 1}`, name: `Horse ${i + 1}`, status: 'ACTIVE' } })),
    };
    res.end(JSON.stringify({ success: true, data })); return;
  }
  res.statusCode = 404; res.end('{}');
});
const io = new Server(server, { cors: { origin: '*' } });
io.of('/simulator').on('connection', socket => {
  socket.on('sim:incident_report', (payload, ack) => { incidents.push(payload); ack?.({ accepted: true }); });
  for (const event of ['sim:session_finished', 'sim:exam_finished']) socket.on(event, (payload, ack) => {
    if (socket.handshake.auth.sessionId.includes('reject')) { ack({ accepted: false, code: 'TEST_REJECTED' }); return; }
    records.push({ event, payload }); ack({ accepted: true });
  });
});
server.listen(4302, '127.0.0.1');
