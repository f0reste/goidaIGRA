import { characters, VIEW, weapons, WORLD, zones } from './data.js';
import { paintGame } from './art.js';

const keys = {
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'jump', ArrowUp: 'jump',
  KeyS: 'duck', ArrowDown: 'duck', KeyR: 'reload', KeyQ: 'swap', KeyG: 'grenade', KeyF: 'ability', KeyE: 'interact'
};
const byId = (id) => document.getElementById(id);
const setText = (id, value) => {
  const el = byId(id);
  if (el.textContent !== value) el.textContent = value;
};
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function audioEffects() {
  let context;
  let muted = false;
  let latest = 0;
  let bridge = 'intact';
  function enable() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    try {
      context ??= new Audio();
      if (context.state === 'suspended') context.resume().catch(() => {});
    } catch {
      context = null;
    }
  }
  function sound(frequency, endFrequency, duration, gain, kind) {
    if (muted || context?.state !== 'running') return;
    const at = context.currentTime;
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    oscillator.type = kind;
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, at + duration);
    volume.gain.setValueAtTime(gain, at);
    volume.gain.exponentialRampToValueAtTime(.001, at + duration);
    oscillator.connect(volume).connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + duration);
  }
  return {
    enable,
    reset() { latest = 0; bridge = 'intact'; },
    toggle() { muted = !muted; if (!muted) enable(); return muted; },
    update(state, p) {
      if (bridge !== state.bridge) {
        bridge = state.bridge;
        if (bridge === 'warning') sound(354, 650, .7, .07, 'triangle');
      }
      for (const e of state.effects) {
        if (e.id <= latest) continue;
        latest = e.id;
        if (Math.abs(e.x - p.x) > 650) continue;
        if (e.type === 'blast') sound(96, 31, .24, .12, 'sawtooth');
        if (e.type === 'muzzle') sound(160, 66, .065, .042, 'square');
        if (e.type === 'hitPlayer' && Math.abs(e.x - p.x) < 24) sound(187, 84, .17, .07, 'triangle');
        if (e.type === 'heal') sound(420, 680, .18, .07, 'sine');
      }
    }
  };
}

export function makePlayerView(socket) {
  const pointer = { x: 600, y: 410, inside: false, active: false };
  const held = new Set();
  const display = new Map();
  const audio = audioEffects();
  let state = null;
  let selfId = null;
  let canvas = null;
  let active = false;
  let mouseDown = false;
  let menuOpen = false;
  let phaser = null;
  let camera = 0;
  let aim = 0;
  let prevTime = 0;
  let finishedAt = 0;

  function self() {
    return state?.players.find((p) => p.id === selfId);
  }

  function send() {
    if (!active || !socket.connected || !state || state.phase !== 'active') return;
    const p = self();
    if (!p) return;
    if (pointer.active) {
      const visual = display.get(p.id) || p;
      aim = Math.atan2(pointer.y - (visual.y - p.h * .61), camera + pointer.x - visual.x);
    }
    const input = { angle: aim, fire: mouseDown && !menuOpen };
    if (!menuOpen) for (const code of held) if (keys[code]) input[keys[code]] = true;
    socket.volatile.emit('input', input);
  }

  function clearInput() {
    held.clear();
    mouseDown = false;
    send();
  }

  function menu(value) {
    menuOpen = value;
    byId('game-menu').hidden = !value;
    clearInput();
    if (value) byId('resume').focus();
    else canvas?.focus({ preventScroll: true });
  }

  function attachCanvas(gameCanvas) {
    canvas = gameCanvas;
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'Игровое поле. Движение A и D, прыжок Space, стрельба левой кнопкой мыши.');
    const track = (event) => {
      const box = canvas.getBoundingClientRect();
      pointer.x = (event.clientX - box.left) * VIEW.width / box.width;
      pointer.y = (event.clientY - box.top) * VIEW.height / box.height;
      pointer.inside = true;
      pointer.active = true;
    };
    canvas.addEventListener('pointermove', track);
    canvas.addEventListener('pointerleave', () => { pointer.inside = false; });
    canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || menuOpen) return;
      event.preventDefault();
      track(event);
      canvas.focus({ preventScroll: true });
      audio.enable();
      mouseDown = true;
      send();
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  function lerpEntity(entity, prefix, dt) {
    if (!entity) return null;
    const key = prefix + (entity.id ?? '');
    let position = display.get(key);
    if (!position || Math.abs(position.x - entity.x) > 190 || Math.abs(position.y - entity.y) > 190) {
      position = { x: entity.x, y: entity.y };
      display.set(key, position);
    }
    const smooth = 1 - Math.exp(-dt * 31);
    position.x += (entity.x - position.x) * smooth;
    position.y += (entity.y - position.y) * smooth;
    return { ...entity, ...position };
  }

  function startEngine() {
    if (phaser) return;
    const { Phaser } = window;
    if (!Phaser) throw new Error('Игровой движок не загрузился.');
    phaser = new Phaser.Game({
      type: Phaser.CANVAS, width: VIEW.width, height: VIEW.height, parent: 'game',
      pixelArt: true, roundPixels: true, banner: false, audio: { noAudio: true },
      input: { keyboard: false, mouse: false, touch: false },
      scene: {
        create() {
          this.frame = this.textures.createCanvas('battlefield', VIEW.width, VIEW.height);
          this.add.image(0, 0, 'battlefield').setOrigin(0);
          attachCanvas(this.game.canvas);
        },
        update(ms, delta) {
          if (!active || !state || !this.frame) return;
          const dt = Math.min(.05, delta / 1000);
          const players = state.players.map((p) => lerpEntity(p, '', dt));
          const p = players.find((item) => item.id === selfId) || players[0];
          if (!p) return;
          const desired = state.phase === 'victory' ? WORLD.width - VIEW.width : clamp(p.x - VIEW.width * .37, 0, WORLD.width - VIEW.width);
          const lag = Math.abs(desired - camera);
          camera += (desired - camera) * (lag > 400 ? 1 : 1 - Math.exp(-dt * 6.6));
          const enemies = state.enemies.map((e) => lerpEntity(e, 'enemy', dt));
          const boss = lerpEntity(state.boss, 'boss', dt);
          const player = players.find((item) => item.id === selfId);
          if (player && pointer.active) {
            player.angle = aim;
            player.facing = Math.cos(aim) >= 0 ? 1 : -1;
          }
          const keep = new Set([...players.map((entry) => entry.id), ...enemies.map((e) => 'enemy' + e.id), 'boss']);
          for (const id of display.keys()) if (!keep.has(id)) display.delete(id);
          const time = state.time + (finishedAt ? (performance.now() - finishedAt) / 1000 : 0);
          paintGame(this.frame.getContext(), { ...state, players, enemies, boss, time }, camera, selfId, menuOpen ? null : pointer, ms / 1000);
          this.frame.refresh();
        }
      }
    });
  }

  function paintHud() {
    const p = self();
    if (!p) return;
    const char = characters[p.character];
    setText('hud-name', char.name);
    setText('hud-hp', Math.ceil(p.hp) + ' HP');
    byId('health-fill').style.width = p.hp + '%';
    byId('health-fill').style.background = p.hp <= 28 ? '#ff8468' : '';
    const buddy = state.players.find((entry) => entry.id !== selfId);
    setText('hud-squad', buddy ? buddy.nick + ' · ' + (!buddy.connected ? 'нет связи' : buddy.hp === 0 ? 'ждёт помощи' : Math.ceil(buddy.hp) + ' HP') : '');
    const zone = zones.findLast((z) => p.x >= z.x);
    setText('hud-zone', zone.name.toUpperCase());
    let objective = 'НАЙДИТЕ АВАНПОСТ';
    if (state.lastStand > 0) objective = 'ПОСЛЕДНИЙ РУБЕЖ · ' + Math.ceil(state.lastStand) + ' С';
    else if (state.boss?.stage === 2) objective = 'УНИЧТОЖЬТЕ РЕАКТОР';
    else if (state.boss) objective = 'ОСТАНОВИТЕ «БУЛЬДОГА»';
    else if (state.gateOpen) objective = 'ПРОЙДИТЕ ЧЕРЕЗ ВОРОТА';
    else if (p.x > 3500) objective = 'ГЕНЕРАТОРЫ · ' + (2 - state.objects.filter((obj) => obj.type === 'generator').length) + ' / 2';
    else if (p.x > 1070 && p.x < 1850) objective = 'ПРЕОДОЛЕЙТЕ МОСТ';
    setText('hud-objective', objective);
    setText('hud-weapon', weapons[p.weapon].name);
    setText('hud-grenades', 'Гранаты ' + p.grenades);
    setText('hud-ammo', p.weapon === 'pistol' ? '∞' : p.reload > 0 ? 'ЗАРЯДКА' : p.mag + ' / ' + p.reserve);
    setText('ability-name', char.ability);
    setText('ability-state', p.cooldown > 0 ? Math.ceil(p.cooldown) + ' с' : 'Готово');
    byId('boss-hud').hidden = !state.boss;
    if (state.boss) {
      setText('boss-stage', state.boss.stage === 1 ? 'БРОНЯ' : 'РЕАКТОР');
      byId('boss-fill').style.width = 100 * state.boss.hp / state.boss.max + '%';
    }
    byId('game-alert').hidden = !state.alert;
    if (state.alert) {
      setText('alert-title', state.alert.title);
      setText('alert-detail', state.alert.detail);
    }
    audio.update(state, p);
  }

  window.addEventListener('keydown', (event) => {
    if (!active) return;
    if (event.code === 'Escape') {
      event.preventDefault();
      if (!event.repeat) menu(!menuOpen);
      return;
    }
    if (!keys[event.code] || menuOpen) return;
    event.preventDefault();
    if (!held.has(event.code)) {
      held.add(event.code);
      send();
    }
  });
  window.addEventListener('keyup', (event) => {
    if (held.delete(event.code)) send();
  });
  window.addEventListener('pointerup', () => { mouseDown = false; send(); });
  window.addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
  setInterval(send, 1000 / 30);
  byId('pause').addEventListener('click', () => menu(!menuOpen));
  byId('resume').addEventListener('click', () => menu(false));
  byId('mute').addEventListener('click', () => {
    const value = audio.toggle();
    byId('mute').setAttribute('aria-pressed', String(value));
    setText('mute', value ? 'Звук выкл.' : 'Звук вкл.');
  });

  return {
    setIdentity(id) { selfId = id; },
    enableAudio() { audio.enable(); },
    open(code, practice) {
      active = true;
      setText('play-room', practice ? 'ТРЕНИРОВКА' : 'КОМНАТА ' + code);
      startEngine();
      menu(false);
    },
    render(next, newMission = false) {
      if (newMission || next.time < prevTime) {
        camera = 0;
        display.clear();
        pointer.active = false;
        aim = 0;
        audio.reset();
        finishedAt = 0;
      }
      if (next.phase !== 'active' && !finishedAt) finishedAt = performance.now();
      prevTime = next.time;
      state = next;
      paintHud();
    },
    close() {
      clearInput();
      active = false;
      state = null;
      prevTime = 0;
      display.clear();
      audio.reset();
      if (phaser) {
        phaser.destroy(true);
        phaser = null;
        canvas = null;
      }
    }
  };
}
