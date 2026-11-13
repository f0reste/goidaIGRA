import { characters, upgrades, upgradeLabels, weapons, weaponStats } from './data.js';
import { paintBriefing, paintPortrait, paintWeapon } from './art.js';
import { makePlayerView } from './play.js';

const $ = (id) => document.getElementById(id);
const screens = ['home', 'lobby', 'play', 'result', 'shop'];
const linkCode = new URL(location.href).searchParams.get('room') || '';
const tokenKey = 'iron-rebellion-profile-v1';
const getSaved = (key) => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const save = (key, value) => {
  try { localStorage.setItem(key, value); } catch { /* Browser storage can be disabled. */ }
};
let current = 'home';
let previous = 'home';
let profile = null;
let room = null;
let self = null;
let result = null;
let selected = 'phantom';
let toastTimer;
let resultTimer;
let networkReady = false;
let replacing = false;

function text(id, value) {
  $(id).textContent = value;
}

function toast(message) {
  clearTimeout(toastTimer);
  text('toast', message);
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3600);
}

function screen(next) {
  if (current === 'play' && next !== 'play') player.close();
  current = next;
  for (const id of screens) $(id).hidden = id !== next;
  $('operations-nav').classList.toggle('is-current', next !== 'shop');
  $('arsenal-nav').classList.toggle('is-current', next === 'shop');
  $('arsenal-nav').disabled = next === 'play';
  if (next === 'shop') renderShop();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value != null) node.textContent = value;
  if (className) node.className = className;
  return node;
}

function makeCharacters() {
  for (const [id, character] of Object.entries(characters)) {
    const button = element('button', null, 'character');
    button.type = 'button';
    button.dataset.character = id;
    button.setAttribute('aria-pressed', String(selected === id));
    button.title = character.description;
    const portrait = element('canvas');
    portrait.width = 43;
    portrait.height = 47;
    portrait.setAttribute('aria-hidden', 'true');
    paintPortrait(portrait, id);
    const caption = element('span');
    caption.append(element('strong', character.name), element('small', character.role + ' · ' + character.ability));
    button.append(portrait, caption);
    button.addEventListener('click', () => {
      selected = id;
      save('iron-rebellion-character', id);
      for (const other of $('characters').children) other.setAttribute('aria-pressed', String(other === button));
    });
    $('characters').append(button);
  }
}

function setNetwork(online, label) {
  networkReady = online;
  $('net-status').classList.toggle('online', online);
  $('net-status').lastElementChild.textContent = label;
  for (const button of [$('host'), $('solo'), $('join-form').querySelector('button')]) button.disabled = !online;
}

function rpc(event, ...args) {
  return new Promise((resolve) => {
    if (!socket?.connected || !networkReady) {
      toast('Соединение с сервером ещё не восстановлено.');
      resolve(null);
      return;
    }
    socket.timeout(5000).emit(event, ...args, (error, reply) => {
      if (error || reply?.error) {
        toast(error ? 'Сервер не ответил. Попробуйте ещё раз.' : reply.error);
        resolve(null);
        return;
      }
      resolve(reply);
    });
  });
}

function credits() {
  const value = new Intl.NumberFormat('ru-RU').format(profile?.credits ?? 0) + ' CR';
  text('nav-credits', value);
  text('shop-credits', value);
  if (current === 'shop') renderShop();
}

async function enter(mode) {
  player.enableAudio();
  const code = $('join-code').value.toUpperCase().trim();
  if (mode === 'join' && !/^[A-Z2-9]{5}$/.test(code)) {
    toast('Введите код из пяти символов.');
    $('join-code').focus();
    return;
  }
  const nick = $('nick').value.trim() || 'Боец';
  save('iron-rebellion-nick', nick);
  await rpc('enter', { mode, code, nick, character: selected });
}

function renderLobby() {
  if (!room) return;
  text('lobby-code', room.code);
  const url = new URL(location.pathname, location.origin);
  url.searchParams.set('room', room.code);
  $('invite-url').value = url.href;
  const elements = room.members.map((member) => {
    const row = element('div', null, 'member');
    const identity = element('div');
    identity.append(element('span', member.nick + (member.id === self ? ' (вы)' : '')), element('small', characters[member.character].name));
    const status = !member.connected ? 'НЕТ СВЯЗИ' : member.ready ? 'ГОТОВ' : 'ПОДГОТОВКА';
    row.append(identity, element('em', status + (room.host === member.id ? ' · КОМАНДИР' : '')));
    return row;
  });
  while (elements.length < 2) elements.push(element('div', 'Ожидаем второго бойца…', 'member empty'));
  $('members').replaceChildren(...elements);

  const me = room.members.find((member) => member.id === self);
  const host = room.host === self;
  const online = room.members.filter((member) => member.connected);
  const allReady = online.length === 2 && online.every((member) => member.ready);
  text('ready', me?.ready ? 'ОТМЕНИТЬ ГОТОВНОСТЬ' : 'ГОТОВ');
  $('start').hidden = !host;
  $('start').disabled = !allReady;
  text('lobby-hint', online.length < 2 ? 'Скопируйте ссылку и отправьте её второму бойцу.' : allReady ? 'Отряд готов к высадке.' : 'Оба бойца должны подтвердить готовность.');
}

function renderShop() {
  const cards = [];
  for (const [id, weapon] of Object.entries(weapons)) {
    if (id === 'pistol') continue;
    const level = profile?.owned[id] || 0;
    const equipped = profile?.equipped === id;
    const stats = weaponStats(id, Math.max(1, level));
    const card = element('article', null, 'panel weapon-card');
    const preview = element('canvas');
    preview.width = 240;
    preview.height = 95;
    preview.setAttribute('aria-hidden', 'true');
    paintWeapon(preview, id);
    const damage = Number(stats.damage.toFixed(1)) + (weapon.pellets ? ' × ' + weapon.pellets : '');
    card.append(preview, element('h2', weapon.name), element('p', weapon.kind + ' · Урон ' + damage + ' · Магазин ' + stats.mag));
    const upgrade = level ? 'Уровень ' + level + ' / 5 · ' + (level < 5 ? 'далее ' + upgradeLabels[level + 1] : upgradeLabels[5]) : 'Цена ' + weapon.price + ' CR';
    card.append(element('p', upgrade, 'mode-hint'));
    const actions = element('div', null, 'actions');
    const action = (caption, type, disabled, primary = false) => {
      const button = element('button', caption, 'button ' + (primary ? 'primary' : 'secondary'));
      button.disabled = disabled;
      button.addEventListener('click', async () => {
        button.disabled = true;
        const reply = await rpc('shop', { weapon: id, action: type });
        if (reply?.profile) {
          profile = reply.profile;
          credits();
          toast(type === 'equip' ? 'Оружие выбрано.' : type === 'buy' ? 'Оружие куплено.' : 'Улучшение установлено.');
        } else renderShop();
      });
      return button;
    };
    if (level === 0) actions.append(action('КУПИТЬ · ' + weapon.price + ' CR', 'buy', !profile || profile.credits < weapon.price, true));
    else {
      actions.append(action(equipped ? 'ВЫБРАНО' : 'СНАРЯДИТЬ', 'equip', equipped, !equipped));
      if (level < 5) actions.append(action('УЛУЧШИТЬ · ' + upgrades[level + 1] + ' CR', 'upgrade', profile.credits < upgrades[level + 1]));
    }
    card.append(actions);
    cards.push(card);
  }
  $('shop-items').replaceChildren(...cards);
}

function openShop() {
  if (current === 'play') return;
  previous = current;
  screen('shop');
}

function operationScreen() {
  if (room?.phase === 'active') return;
  if (room?.phase === 'lobby') {
    screen('lobby');
    renderLobby();
  } else if (result) {
    screen('result');
    renderResult();
  } else screen('home');
}

function renderResult() {
  if (!result) return;
  text('result-title', result.victory ? 'МИССИЯ ВЫПОЛНЕНА' : 'МИССИЯ ПРОВАЛЕНА');
  text('result-detail', result.victory ? '«Бульдог-01» уничтожен. За стеной аванпоста обнаружен вход в лабораторию HELIOS.' : 'Отряд выведен из строя. Полученные кредиты можно потратить в арсенале.');
  const seconds = Math.floor(result.time);
  const values = [
    ['Награда', '+' + result.reward + ' CR'], ['Противники', result.kills],
    ['Тайники', result.secrets + ' / 1'], ['Время', Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0')]
  ];
  $('result-stats').replaceChildren(...values.map(([name, value]) => {
    const row = element('div');
    row.append(element('dt', name), element('dd', value));
    return row;
  }));
  text('return', room?.practice ? 'ЕЩЁ РАЗ' : 'В ЛОББИ');
  $('return').hidden = room?.host !== self;
}

async function leave() {
  const reply = await rpc('leave');
  if (!reply) return;
  clearTimeout(resultTimer);
  room = null;
  self = null;
  result = null;
  history.replaceState(null, '', location.pathname);
  $('join-code').value = '';
  screen('home');
}

const socket = typeof window.io === 'function' ? window.io({ autoConnect: false, auth: (callback) => callback({ token: getSaved(tokenKey) }) }) : null;
const player = makePlayerView(socket || { connected: false });
$('nick').value = getSaved('iron-rebellion-nick') || 'Боец';
const savedCharacter = getSaved('iron-rebellion-character');
if (Object.hasOwn(characters, savedCharacter)) selected = savedCharacter;
paintBriefing($('briefing-art'));
makeCharacters();

if (/^[a-z2-9]{5}$/i.test(linkCode)) {
  $('join-code').value = linkCode.toUpperCase();
  requestAnimationFrame(() => $('deploy').scrollIntoView({ block: 'center' }));
}

$('host').addEventListener('click', () => enter('host'));
$('solo').addEventListener('click', () => enter('solo'));
$('join-form').addEventListener('submit', (event) => { event.preventDefault(); enter('join'); });
$('ready').addEventListener('click', () => {
  if (!networkReady || !room) return;
  const me = room.members.find((member) => member.id === self);
  socket.emit('ready', !me?.ready);
});
$('start').addEventListener('click', () => { player.enableAudio(); rpc('start'); });
$('return').addEventListener('click', () => { player.enableAudio(); rpc('return'); });
for (const id of ['leave-lobby', 'leave-game', 'leave-result']) $(id).addEventListener('click', leave);
for (const id of ['arsenal-nav', 'result-shop']) $(id).addEventListener('click', openShop);
for (const id of ['home-button', 'operations-nav']) $(id).addEventListener('click', operationScreen);
$('shop-back').addEventListener('click', () => {
  if (previous === 'result' && result) { screen('result'); renderResult(); }
  else operationScreen();
});
$('copy-invite').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('invite-url').value);
    toast('Ссылка скопирована.');
  } catch {
    $('invite-url').hidden = false;
    $('invite-url').select();
    toast('Скопируйте выделенную ссылку.');
  }
});

setNetwork(false, 'Подключение');
if (!socket) {
  setNetwork(false, 'Сервер недоступен');
  toast('Откройте игру через запущенный сервер проекта.');
} else {
  socket.on('account', (account) => {
    save(tokenKey, account.token);
    profile = account.profile;
    credits();
    setNetwork(true, 'На связи');
  });
  socket.on('identity', ({ id }) => {
    self = id;
    player.setIdentity(id);
  });
  socket.on('room', (next) => {
    const old = room;
    room = next;
    if (room.phase === 'lobby') {
      clearTimeout(resultTimer);
      result = null;
      if (current !== 'shop' || old?.phase !== 'lobby') screen('lobby');
      renderLobby();
    } else if (current === 'result') renderResult();
  });
  socket.on('mission', (state) => {
    if (!room) return;
    if (state.phase === 'active') {
      clearTimeout(resultTimer);
      result = null;
      screen('play');
      player.open(room.code, room.practice);
      player.render(state, true);
    } else if (current === 'play') player.render(state);
  });
  socket.on('state', (state) => {
    if (current === 'play') player.render(state);
  });
  socket.on('result', (report) => {
    result = report;
    profile = report.profile;
    credits();
    clearTimeout(resultTimer);
    resultTimer = setTimeout(() => {
      if (!result) return;
      screen('result');
      renderResult();
    }, current === 'play' ? (report.victory ? 1600 : 550) : 0);
  });
  socket.on('sessionReplaced', () => {
    replacing = true;
    setNetwork(false, 'Другой сеанс');
    room = null;
    result = null;
    screen('home');
    toast('Этот профиль открыт в другом окне.');
  });
  socket.on('disconnect', () => {
    if (replacing) return;
    setNetwork(false, 'Нет связи');
    toast('Связь прервалась. Переподключаемся…');
  });
  socket.on('connect_error', () => setNetwork(false, 'Нет связи'));
  socket.connect();
}
