import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomInt, randomUUID } from 'node:crypto';
import { Server } from 'socket.io';
import { characters, TICK } from '../client/data.js';
import { cleanInput, createMission, snapshot, stepMission } from './game.js';
import { openProfiles } from './profile.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const clientRoot = resolve(root, 'client');
const profiles = openProfiles(process.env.DATA_DIR || resolve(root, 'data'));
function option(name) {
  const index = process.argv.indexOf(name, 2);
  return index >= 2 ? process.argv[index + 1] : undefined;
}
const port = Number(option('--port') || process.env.PORT || 3000);
const host = option('--host') || '0.0.0.0';
const codes = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rooms = new Map();
const activeByToken = new Map();
const membership = new Map();
const reconnectMs = 3 * 60 * 1000;
const maxRooms = 80;
const mime = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', svg: 'image/svg+xml', woff2: 'font/woff2' };
const vendors = {
  '/vendor/phaser.min.js': 'phaser/dist/phaser.min.js',
  '/fonts/barlow.woff2': '@fontsource/barlow-condensed/files/barlow-condensed-latin-800-normal.woff2',
  '/fonts/inter-latin.woff2': '@fontsource/inter/files/inter-latin-500-normal.woff2',
  '/fonts/inter-cyrillic.woff2': '@fontsource/inter/files/inter-cyrillic-500-normal.woff2',
  '/fonts/mono-latin.woff2': '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2',
  '/fonts/mono-cyrillic.woff2': '@fontsource/ibm-plex-mono/files/ibm-plex-mono-cyrillic-500-normal.woff2'
};

const server = createServer((req, res) => {
  try {
    const method = req.method;
    if (method !== 'GET' && method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(method === 'HEAD' ? undefined : '{"ok":true}');
      return;
    }
    const pathname = decodeURIComponent(url.pathname);
    const vendor = Object.hasOwn(vendors, pathname) ? vendors[pathname] : null;
    const path = vendor ? resolve(root, 'node_modules', vendor) : resolve(clientRoot, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!vendor && !path.startsWith(clientRoot + sep)) {
      res.writeHead(404).end('Not found');
      return;
    }
    const stat = statSync(path);
    if (!stat.isFile()) {
      res.writeHead(404).end('Not found');
      return;
    }
    const extension = path.split('.').at(-1);
    res.writeHead(200, {
      'Content-Type': mime[extension] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': vendor ? 'public, max-age=3600' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin'
    });
    if (method === 'HEAD') res.end();
    else createReadStream(path).on('error', () => res.destroy()).pipe(res);
  } catch {
    res.writeHead(404).end('Not found');
  }
});

const io = new Server(server, { maxHttpBufferSize: 8192 });

function newCode() {
  let code;
  do {
    code = Array.from({ length: 5 }, () => codes[randomInt(codes.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function updateRoom(room) {
  io.to(room.code).emit('room', {
    code: room.code, practice: room.practice, phase: room.game?.phase ?? 'lobby', host: room.host,
    members: [...room.members.values()].map(({ id, nick, character, connected, ready }) => ({ id, nick, character, connected, ready }))
  });
}

function roomMember(socket) {
  const entry = membership.get(socket.data.token);
  const room = rooms.get(entry?.code);
  return { room, member: room?.members.get(entry?.id) };
}

function assignHost(room) {
  if (!room.members.get(room.host)?.connected) room.host = [...room.members.values()].find((member) => member.connected)?.id ?? null;
}

function resetRoom(room) {
  room.game = null;
  for (const member of room.members.values()) member.ready = false;
  updateRoom(room);
}

function removeMember(room, member) {
  room.members.delete(member.id);
  membership.delete(member.token);
  room.game?.players.delete(member.id);
  assignHost(room);
  if (!room.members.size) rooms.delete(room.code);
  else updateRoom(room);
}

function begin(room) {
  room.game = createMission([...room.members.values()]);
  updateRoom(room);
  io.to(room.code).emit('mission', snapshot(room.game));
}

function finish(room) {
  const game = room.game;
  if (game.result) return;
  const victory = game.phase === 'victory';
  const base = game.defeated * 10 + game.elite * 30 + game.secrets * 100 + (victory ? 500 : 0);
  const eligible = [...room.members.values()].filter((member) => game.players.has(member.id));
  game.result = { victory, time: game.time, kills: game.defeated + game.elite, secrets: game.secrets, members: {} };
  for (const member of eligible) {
    const player = game.players.get(member.id);
    const flawless = victory && player.downed === 0 ? 150 : 0;
    const reward = base + flawless;
    profiles.award(member.token, member.profile, reward);
    game.result.members[member.id] = { reward, flawless, profile: member.profile };
  }
  updateRoom(room);
  io.to(room.code).emit('mission', snapshot(game));
  for (const member of eligible) sendResult(room, member);
}

function sendResult(room, member) {
  const result = room.game?.result;
  if (!result) return;
  const { members, ...report } = result;
  io.to(member.socket).emit('result', { ...report, ...members[member.id] });
}

function nickname(value) {
  return typeof value === 'string' ? value.trim().replace(/[\p{C}<>]/gu, '').slice(0, 20) || 'Боец' : 'Боец';
}

function bindMember(room, member, socket) {
  member.socket = socket.id;
  member.connected = true;
  member.offlineAt = 0;
  const player = room.game?.players.get(member.id);
  if (player) {
    player.connected = true;
    player.input = {};
  }
  socket.join(room.code);
  assignHost(room);
  socket.emit('identity', { id: member.id });
  updateRoom(room);
  if (room.game) socket.emit('mission', snapshot(room.game));
  sendResult(room, member);
}

io.on('connection', (socket) => {
  const account = profiles.getOrCreate(socket.handshake.auth?.token);
  const token = account.id;
  const previous = activeByToken.get(token);
  if (previous && previous !== socket.id) {
    const oldSocket = io.sockets.sockets.get(previous);
    oldSocket?.emit('sessionReplaced');
    oldSocket?.disconnect();
  }
  socket.data.token = token;
  socket.data.profile = account.profile;
  activeByToken.set(token, socket.id);

  const restored = roomMember(socket);
  if (restored.member) socket.data.profile = restored.member.profile;
  socket.emit('account', { token, profile: socket.data.profile });
  if (restored.member) bindMember(restored.room, restored.member, socket);

  socket.on('enter', (payload, reply) => {
    if (typeof reply !== 'function') return;
    if (roomMember(socket).member) return reply({ error: 'Вы уже в комнате.' });
    const mode = payload?.mode;
    const code = typeof payload?.code === 'string' ? payload.code.toUpperCase().trim().slice(0, 8) : '';
    let room = rooms.get(code);
    if (mode === 'join') {
      if (!room || room.practice) return reply({ error: 'Комната с таким кодом не найдена.' });
      if (room.game) return reply({ error: 'Миссия уже идёт. Подождите, пока игроки вернутся в лобби.' });
      if (room.members.size >= 2) return reply({ error: 'Комната заполнена.' });
    } else if (mode === 'host' || mode === 'solo') {
      if (rooms.size >= maxRooms) return reply({ error: 'Сервер занят. Попробуйте позже.' });
      room = { code: newCode(), practice: mode === 'solo', members: new Map(), host: null, game: null };
      rooms.set(room.code, room);
    } else return reply({ error: 'Выберите режим игры.' });

    const id = randomUUID();
    const character = Object.hasOwn(characters, payload?.character) ? payload.character : 'phantom';
    const member = { id, token, socket: socket.id, profile: socket.data.profile, nick: nickname(payload?.nick), character, connected: true, ready: false, offlineAt: 0 };
    room.members.set(id, member);
    membership.set(token, { code: room.code, id });
    bindMember(room, member, socket);
    reply({ code: room.code });
    if (room.practice) begin(room);
  });

  socket.on('ready', (ready) => {
    const { room, member } = roomMember(socket);
    if (!member || room.game) return;
    member.ready = ready === true;
    updateRoom(room);
  });

  socket.on('start', (reply) => {
    if (typeof reply !== 'function') return;
    const { room, member } = roomMember(socket);
    if (!member || room.host !== member.id || room.game) return reply({ error: 'Запустить миссию может командир комнаты.' });
    const squad = [...room.members.values()].filter((m) => m.connected);
    if (!room.practice && (squad.length < 2 || squad.some((m) => !m.ready))) return reply({ error: 'Дождитесь второго бойца и готовности отряда.' });
    begin(room);
    reply({ ok: true });
  });

  socket.on('input', (value) => {
    const { room, member } = roomMember(socket);
    if (!member || room.game?.phase !== 'active') return;
    const player = room.game.players.get(member.id);
    if (player) player.input = cleanInput(value);
  });

  socket.on('shop', (payload, reply) => {
    if (typeof reply !== 'function') return;
    const { room } = roomMember(socket);
    if (room?.game?.phase === 'active') return reply({ error: 'Арсенал доступен между миссиями.' });
    const profile = socket.data.profile;
    const error = profiles.purchase(token, profile, payload?.weapon, payload?.action);
    reply(error ? { error } : { profile });
  });

  socket.on('return', (reply) => {
    if (typeof reply !== 'function') return;
    const { room, member } = roomMember(socket);
    if (!member || !room.game || room.game.phase === 'active' || room.host !== member.id) return reply({ error: 'Возвращение в лобби запускает командир.' });
    if (room.practice) begin(room);
    else resetRoom(room);
    reply({ ok: true });
  });

  socket.on('leave', (reply) => {
    const { room, member } = roomMember(socket);
    if (member) {
      socket.leave(room.code);
      removeMember(room, member);
    }
    if (typeof reply === 'function') reply({ ok: true });
  });

  socket.on('disconnect', () => {
    if (activeByToken.get(token) === socket.id) activeByToken.delete(token);
    const { room, member } = roomMember(socket);
    if (!member || member.socket !== socket.id) return;
    member.connected = false;
    member.offlineAt = Date.now();
    if (!room.game) member.ready = false;
    const player = room.game?.players.get(member.id);
    if (player) {
      player.connected = false;
      player.input = {};
    }
    assignHost(room);
    updateRoom(room);
  });
});

setInterval(() => {
  for (const room of rooms.values()) {
    const game = room.game;
    if (game?.phase !== 'active') continue;
    stepMission(game, 1 / TICK);
    if (game.phase === 'active') io.to(room.code).volatile.emit('state', snapshot(game));
    else finish(room);
  }
}, 1000 / TICK);

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    for (const member of room.members.values()) {
      if (!member.connected && now - member.offlineAt > reconnectMs) removeMember(room, member);
    }
  }
}, 10_000).unref();

server.listen(port, host, () => console.log('IRON REBELLION • http://localhost:' + port));
