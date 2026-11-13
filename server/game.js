import { characters, enemyTypes, gate, terrain, weaponStats, weapons, WORLD } from '../client/data.js';

const checkpoints = [112, 1860, 2670, 3590, 4350];
const enemyLayout = [
  ['infantry', 510], ['infantry', 758], ['infantry', 1040], ['drone', 1100, 310],
  ['infantry', 1810], ['infantry', 2055], ['drone', 2120, 306], ['shield', 2310],
  ['infantry', 2540], ['drone', 2740, 290], ['infantry', 2910], ['shield', 3080],
  ['drone', 3270, 283], ['infantry', 3450], ['infantry', 3665], ['shield', 3835],
  ['drone', 3970, 305], ['infantry', 4025]
];
const objectLayout = [
  ['crate', 330], ['ammo', 650], ['barrel', 805], ['crate', 1010],
  ['secret', 1105], ['ammo', 1885], ['barrel', 1995], ['crate', 2325],
  ['med', 2488], ['ammo', 2668], ['barrel', 2845], ['crate', 3030],
  ['barrel', 3330], ['med', 3505], ['generator', 3740], ['ammo', 3784],
  ['generator', 4040], ['ammo', 4450], ['med', 4540]
];
const objectStats = {
  crate: [38, 36, 22], barrel: [26, 40, 18], secret: [45, 60, 68], generator: [44, 62, 100],
  ammo: [27, 18, 0], med: [23, 20, 0]
};
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const center = (body) => ({ x: body.x, y: body.y - body.h / 2 });
const contains = (body, x, y, margin = 0) => Math.abs(x - body.x) <= body.w / 2 + margin && y >= body.y - body.h - margin && y <= body.y + margin;
const living = (member) => member.connected && member.hp > 0;
const dtMax = 1 / 15;

export function createMission(members) {
  const squad = members.filter((member) => member.connected);
  const hpScale = 1 + (squad.length - 1) * .5;
  const game = {
    phase: 'active', time: 0, serial: 0, bridge: 'intact', bridgeAt: 0, boss: null, gateOpen: false,
    players: new Map(), enemies: [], objects: [], bullets: [], grenades: [], turrets: [], effects: [],
    alert: null, result: null, defeated: 0, elite: 0, secrets: 0, lastStand: 0, lastStandUsed: false
  };
  game.players = new Map(squad.map((member, i) => {
    const id = member.id;
    const main = member.profile.equipped;
    const level = member.profile.owned[main];
    const stats = weaponStats(main, level);
    return [id, {
      id, nick: member.nick, character: member.character, connected: true, x: 112 + i * 42, y: WORLD.floor,
      w: 27, h: 42, vx: 0, vy: 0, grounded: true, hp: 100, facing: 1, angle: 0, checkpoint: 0,
      invuln: 0, cooldown: 0, dash: 0, reload: 0, shot: 0, revive: 0, downed: 0, input: {}, previous: {},
      grenades: 3, main, weapon: main, level, mag: stats.mag, reserve: stats.reserve, mainShots: 0
    }];
  }));
  game.enemies = enemyLayout.map(([type, x, y]) => makeEnemy(game, type, x, y, hpScale));
  if (squad.length === 2) {
    for (const [type, x, y] of [['drone', 910, 313], ['infantry', 1880], ['drone', 3080, 268], ['infantry', 3875]]) {
      game.enemies.push(makeEnemy(game, type, x, y, hpScale));
    }
  }
  game.objects = objectLayout.map(([type, x]) => {
    const [w, h, hp] = objectStats[type];
    return { id: ++game.serial, type, x, y: WORLD.floor, w, h, hp, gone: false };
  });
  announce(game, 'ОПЕРАЦИЯ «ЖЕЛЕЗНЫЙ ШТОРМ»', 'Найдите аванпост HELIOS. Держитесь вместе.', 4);
  return game;
}

function makeEnemy(game, type, x, y = WORLD.floor, hpScale = 1) {
  const { w, h, hp } = enemyTypes[type];
  return { id: ++game.serial, type, x, y, home: x, baseY: y, w, h, hp: hp * hpScale, max: hp * hpScale, facing: -1, fire: .65 + (x % 96) / 70, open: 0, moving: false };
}

function announce(game, title, detail, duration = 4) {
  game.alert = { title, detail, end: game.time + duration };
}

function effect(game, type, x, y, duration = .28) {
  game.effects.push({ id: ++game.serial, type, x, y, end: game.time + duration, duration });
}

function shoot(game, side, x, y, angle, config) {
  if (game.bullets.length >= 240) return;
  game.bullets.push({
    id: ++game.serial, side, x, y, vx: Math.cos(angle) * config.speed, vy: Math.sin(angle) * config.speed,
    damage: config.damage, color: config.color, life: config.life ?? 1.28, style: config.style || 'shot',
    explosive: config.explosive || false, pierce: config.pierce || false, hit: []
  });
}

function platforms(game) {
  return terrain.filter((p) => !p.fragile || game.bridge !== 'broken');
}

function landing(game, x, oldY, y, width) {
  return platforms(game).find((p) => x + width / 2 > p.x && x - width / 2 < p.x + p.w && oldY <= p.y && y >= p.y);
}

function physics(game, player, dt) {
  const input = player.input;
  const axis = Number(Boolean(input.right)) - Number(Boolean(input.left));
  const ducking = input.duck && player.grounded && !player.dash;
  player.h = ducking ? 29 : 42;
  const speed = 220 * (player.weapon === 'machinegun' ? .85 : 1) * (game.lastStand > 0 ? 1.17 : 1);
  player.vx = player.dash > 0 ? player.dashDirection * 480 : axis * speed * (ducking ? .55 : 1);
  const previousX = player.x;
  player.x = clamp(previousX + player.vx * dt, 18, WORLD.width - 18);
  if (!game.gateOpen && previousX < gate && player.x > gate - 17) player.x = gate - 17;

  if (input.jump && !player.previous.jump && player.grounded) {
    player.vy = -445;
    player.grounded = false;
  }
  fallPlayer(game, player, dt);
  if (player.hp > 0 && player.grounded) {
    const next = checkpoints.findLastIndex((x) => player.x >= x);
    player.checkpoint = Math.max(player.checkpoint, next);
  }
}

function fallPlayer(game, player, dt) {
  const oldY = player.y;
  player.vy = Math.min(player.vy + WORLD.gravity * dt, 690);
  player.y += player.vy * dt;
  player.grounded = false;
  if (player.vy >= 0) {
    const platform = landing(game, player.x, oldY, player.y, player.w);
    if (platform) {
      player.y = platform.y;
      player.vy = 0;
      player.grounded = true;
    }
  }
  if (player.y > 600) {
    const index = player.checkpoint;
    player.x = checkpoints[index] + ((player.x | 0) % 2) * 16;
    player.y = WORLD.floor;
    player.vy = 0;
    hurtPlayer(game, player, 28, true);
  }
}

function hurtPlayer(game, player, damage, forced = false) {
  if (player.hp <= 0 || (!forced && player.invuln > 0)) return;
  player.hp = Math.max(0, player.hp - damage);
  player.invuln = 0.62;
  effect(game, 'hitPlayer', player.x, player.y - 24);
  if (player.hp === 0) {
    player.downed++;
    player.vx = 0;
    player.h = 24;
    player.reload = 0;
    player.revive = 0;
    effect(game, 'down', player.x, player.y - 16, .6);
  }
}

function controlPlayer(game, player, dt) {
  const input = player.input;
  for (const key of ['invuln', 'cooldown', 'dash', 'shot']) player[key] = Math.max(0, player[key] - dt);
  if (player.hp <= 0) {
    fallPlayer(game, player, dt);
    return;
  }
  if (Number.isFinite(input.angle)) player.angle = input.angle;
  player.facing = Math.cos(player.angle) >= 0 ? 1 : -1;
  if (input.swap && !player.previous.swap) {
    player.weapon = player.weapon === player.main ? 'pistol' : player.main;
    player.reload = 0;
    player.shot = Math.max(.13, player.shot);
  }
  const stats = weaponStats(player.weapon, player.weapon === player.main ? player.level : 1);
  if (player.reload > 0) {
    player.reload = Math.max(0, player.reload - dt);
    if (player.reload === 0) {
      const loaded = Math.min(stats.mag - player.mag, player.reserve);
      player.mag += loaded;
      player.reserve -= loaded;
    }
  }

  if (input.ability && !player.previous.ability && player.cooldown === 0) {
    player.cooldown = 20;
    if (player.character === 'phantom') {
      player.dash = .25;
      player.dashDirection = input.left ? -1 : input.right ? 1 : player.facing;
      player.invuln = Math.max(player.invuln, .45);
      effect(game, 'dash', player.x, player.y - 20, .32);
    } else {
      game.turrets.push({ id: ++game.serial, x: player.x, y: player.y, facing: player.facing, fire: 0, until: game.time + 12 });
      effect(game, 'dash', player.x, player.y - 20, .35);
    }
  }
  physics(game, player, dt);

  if (input.grenade && !player.previous.grenade && player.grenades > 0) {
    player.grenades--;
    game.grenades.push({ id: ++game.serial, x: player.x, y: player.y - 27, vx: Math.cos(player.angle) * 370, vy: Math.sin(player.angle) * 300 - 155, life: 1.05 });
  }
  const infinite = player.weapon === 'pistol';
  if (!infinite && !player.reload && player.reserve > 0 && ((input.reload && !player.previous.reload && player.mag < stats.mag) || (input.fire && player.mag === 0))) {
    player.reload = stats.reload * (game.lastStand > 0 ? .65 : 1);
  }
  if (input.fire && player.shot === 0 && player.reload === 0 && (infinite || player.mag > 0)) {
    if (!infinite) {
      player.mag--;
      player.mainShots++;
    }
    player.shot = 1 / stats.rate;
    const pellets = stats.pellets || 1;
    const bonus = player.weapon === 'machinegun' && stats.special && player.mainShots % 10 === 0 ? 2 : 1;
    const muzzleX = player.x + Math.cos(player.angle) * 19;
    const muzzleY = player.y - player.h * .61 + Math.sin(player.angle) * 14;
    for (let i = 0; i < pellets; i++) {
      shoot(game, 'player', muzzleX, muzzleY, player.angle + (i - (pellets - 1) / 2) * .13, {
        ...stats, damage: stats.damage * bonus, life: player.weapon === 'shotgun' ? .49 : 1.25,
        pierce: stats.special && player.weapon !== 'machinegun'
      });
    }
    effect(game, 'muzzle', muzzleX, muzzleY, .1);
  }
  player.previous = { ...input };
}

function updateRevives(game, connected, dt) {
  for (const down of connected.filter((p) => p.hp <= 0)) {
    const assisted = connected.some((p) => p.hp > 0 && p.input.interact && distance(p, down) < 85);
    down.revive = clamp(down.revive + (assisted ? dt : -dt * 1.8), 0, 3);
    if (down.revive >= 3) {
      down.hp = 45;
      down.h = 42;
      down.invuln = 1.8;
      down.revive = 0;
      effect(game, 'heal', down.x, down.y - 24, .6);
    }
  }
}

function closest(players, x, y) {
  let best = null;
  let bestDistance = Infinity;
  for (const p of players) {
    const d = Math.hypot(p.x - x, p.y - p.h / 2 - y);
    if (d < bestDistance) {
      best = p;
      bestDistance = d;
    }
  }
  return best;
}

function updateEnemies(game, standing, dt) {
  for (const enemy of game.enemies) {
    if (enemy.hp <= 0) continue;
    const p = closest(standing, enemy.x, enemy.y - enemy.h / 2);
    if (!p) continue;
    const gap = p.x - enemy.x;
    const range = enemyTypes[enemy.type].range;
    const active = Math.abs(gap) < range + 75;
    enemy.moving = false;
    if (!active || (enemy.home === 510 && p.x < 190)) continue;
    enemy.facing = Math.sign(gap) || 1;
    enemy.fire -= dt;
    enemy.open = Math.max(0, enemy.open - dt);
    const flying = enemy.type === 'drone';
    if (flying) enemy.y = enemy.baseY + Math.sin(game.time * 2.5 + enemy.id) * 25;
    if (Math.abs(gap) > (flying ? 125 : 140)) {
      const next = clamp(enemy.x + enemy.facing * (flying ? 88 : 64) * dt, enemy.home - 175, enemy.home + 165);
      if (flying || platforms(game).some((platform) => platform.y === WORLD.floor && next > platform.x + 13 && next < platform.x + platform.w - 13)) {
        enemy.moving = next !== enemy.x;
        enemy.x = next;
      }
    }
    if (Math.abs(gap) < range && enemy.fire <= 0) {
      const origin = center(enemy);
      const target = center(p);
      const angle = Math.atan2(target.y - origin.y, target.x - origin.x);
      shoot(game, 'enemy', origin.x + Math.cos(angle) * 16, origin.y, angle, {
        damage: enemy.type === 'shield' ? 14 : 10, speed: flying ? 300 : 365, color: '#ff6779', life: 2
      });
      enemy.fire = enemy.type === 'infantry' ? 1.35 : 1.7;
      if (enemy.type === 'shield') enemy.open = .58;
    }
  }
}

function hitEnemy(game, enemy, damage, sourceX, bypass = false) {
  if (enemy.hp <= 0) return;
  const blocked = enemy.type === 'shield' && !enemy.open && Math.sign(sourceX - enemy.x) === enemy.facing && !bypass;
  enemy.hp = Math.max(0, enemy.hp - (blocked ? damage * .12 : damage));
  effect(game, blocked ? 'spark' : 'hit', enemy.x, enemy.y - enemy.h / 2, .16);
  if (enemy.hp === 0) {
    if (enemy.type === 'shield') game.elite++;
    else game.defeated++;
    effect(game, 'blast', enemy.x, enemy.y - enemy.h / 2, .34);
  }
}

function hitObject(game, obj, damage) {
  if (obj.gone || obj.hp <= 0) return;
  obj.hp = Math.max(0, obj.hp - damage);
  effect(game, 'spark', obj.x, obj.y - obj.h / 2, .17);
  if (obj.hp > 0) return;
  obj.gone = true;
  if (obj.type === 'barrel') explode(game, obj.x, obj.y - 18, 120, 62);
  else effect(game, 'debris', obj.x, obj.y - obj.h / 2, .45);
  if (obj.type === 'secret') {
    game.secrets++;
    announce(game, 'ТАЙНИК ОБНАРУЖЕН', 'Команда получит 100 CR за находку.', 3);
  }
}

function bossTarget(boss) {
  return boss.stage === 1 ? boss : { x: boss.x, y: boss.y - 67, w: 52, h: 42 };
}

function hitBoss(game, damage) {
  const boss = game.boss;
  if (!boss || boss.hp <= 0) return;
  const part = bossTarget(boss);
  boss.hp = Math.max(0, boss.hp - damage);
  effect(game, 'spark', part.x, part.y - part.h / 2, .15);
}

function explode(game, x, y, radius, damage, enemy = false) {
  effect(game, 'blast', x, y, .48);
  const inRange = (target) => distance({ x, y }, center(target)) < radius;
  if (enemy) {
    for (const p of game.players.values()) if (living(p) && inRange(p)) hurtPlayer(game, p, damage);
  } else {
    for (const e of game.enemies) if (e.hp > 0 && inRange(e)) hitEnemy(game, e, damage, x, true);
    for (const obj of game.objects) if (!obj.gone && obj.hp > 0 && inRange(obj)) hitObject(game, obj, damage);
    if (game.boss && game.boss.hp > 0 && inRange(bossTarget(game.boss))) hitBoss(game, damage);
  }
}

function updateProjectiles(game, dt) {
  for (const bullet of game.bullets) {
    bullet.life -= dt;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    if (bullet.x < 0 || bullet.x > WORLD.width || bullet.y < 0 || bullet.y > WORLD.floor + 3) bullet.life = 0;
    if (bullet.life <= 0) {
      if (bullet.explosive) explode(game, bullet.x, Math.min(bullet.y, WORLD.floor), 73, bullet.damage, true);
      continue;
    }
    const hit = (body) => contains(body, bullet.x, bullet.y, 5);
    if (!game.gateOpen && Math.abs(bullet.x - gate) < 14) {
      bullet.life = 0;
      continue;
    }
    if (bullet.side === 'enemy') {
      const cover = game.objects.find((o) => !o.gone && ['crate', 'barrel'].includes(o.type) && hit(o));
      if (cover) {
        hitObject(game, cover, bullet.damage);
        if (bullet.explosive) explode(game, bullet.x, bullet.y, 73, bullet.damage, true);
        bullet.life = 0;
        continue;
      }
      const p = [...game.players.values()].find((entry) => living(entry) && hit(entry));
      if (p) {
        if (bullet.explosive) explode(game, bullet.x, bullet.y, 73, bullet.damage, true);
        else hurtPlayer(game, p, bullet.damage);
        bullet.life = 0;
      }
      continue;
    }
    const enemy = game.enemies.find((e) => e.hp > 0 && !bullet.hit.includes(e.id) && hit(e));
    const obj = game.objects.find((o) => !o.gone && o.hp > 0 && hit(o));
    const boss = game.boss?.hp > 0 ? game.boss : null;
    if (obj) {
      hitObject(game, obj, bullet.damage);
      bullet.life = 0;
    } else if (enemy) {
      hitEnemy(game, enemy, bullet.damage, bullet.x - bullet.vx * dt, bullet.pierce);
      bullet.hit.push(enemy.id);
      if (!bullet.pierce || bullet.hit.length >= 2) bullet.life = 0;
    } else if (boss && hit(bossTarget(boss))) {
      hitBoss(game, bullet.damage);
      bullet.life = 0;
    } else if (boss && hit(boss)) {
      effect(game, 'spark', bullet.x, bullet.y, .13);
      bullet.life = 0;
    }
  }
  game.bullets = game.bullets.filter((b) => b.life > 0);

  for (const grenade of game.grenades) {
    const oldY = grenade.y;
    grenade.life -= dt;
    grenade.vy += WORLD.gravity * .7 * dt;
    grenade.x = clamp(grenade.x + grenade.vx * dt, 0, game.gateOpen ? WORLD.width : gate - 8);
    grenade.y += grenade.vy * dt;
    const platform = grenade.vy > 0 && landing(game, grenade.x, oldY, grenade.y + 4, 10);
    if (platform) {
      grenade.y = platform.y - 4;
      grenade.vy *= -.34;
      grenade.vx *= .69;
    }
    if (grenade.life <= 0) explode(game, grenade.x, grenade.y, 118, 78);
  }
  game.grenades = game.grenades.filter((g) => g.life > 0);
}

function updateTurrets(game, dt) {
  game.turrets = game.turrets.filter((t) => t.until > game.time);
  for (const t of game.turrets) {
    t.fire -= dt;
    if (t.fire > 0) continue;
    const targets = game.enemies.filter((e) => e.hp > 0);
    if (game.boss?.hp > 0) targets.push(bossTarget(game.boss));
    const target = closest(targets, t.x, t.y - 19);
    if (!target || Math.abs(target.x - t.x) > 490) continue;
    const angle = Math.atan2(target.y - target.h / 2 - (t.y - 19), target.x - t.x);
    t.facing = Math.cos(angle) > 0 ? 1 : -1;
    shoot(game, 'player', t.x + 13 * t.facing, t.y - 19, angle, { damage: 9, speed: 690, color: '#a3fadb' });
    t.fire = .32;
  }
}

function updatePickups(game, standing) {
  for (const obj of game.objects) {
    if (obj.gone || !['ammo', 'med'].includes(obj.type)) continue;
    const player = standing.find((p) => distance(center(p), center(obj)) < 38 && (obj.type === 'ammo' ? p.reserve < weapons[p.main].reserve * 1.5 : p.hp < 100));
    if (!player) continue;
    obj.gone = true;
    if (obj.type === 'ammo') {
      player.reserve = Math.min(weapons[player.main].reserve * 2, player.reserve + Math.max(12, weapons[player.main].mag * 2));
      effect(game, 'ammo', obj.x, obj.y - 24, .4);
    } else {
      player.hp = Math.min(100, player.hp + 38);
      effect(game, 'heal', obj.x, obj.y - 24, .4);
    }
  }
}

function updateBridge(game, farthest) {
  if (game.bridge === 'intact' && farthest.x >= 1110) {
    game.bridge = 'warning';
    game.bridgeAt = game.time + 3.1;
    announce(game, 'ОБСТРЕЛ МОСТА', 'Два пролёта под ударом. Следите за красной разметкой.', 3);
  }
  if (game.bridge === 'warning' && game.time >= game.bridgeAt) {
    game.bridge = 'broken';
    for (const p of terrain.filter((p) => p.fragile)) effect(game, 'blast', p.x + p.w / 2, p.y - 4, .73);
    announce(game, 'МОСТ ОБРУШИЛСЯ', 'Перепрыгните провалы. Дальше вход в бункер.', 3.5);
  }
}

function updateBoss(game, standing, farthest, dt) {
  if (!game.boss && farthest.x >= 4570) {
    const max = standing.length > 1 ? 920 : 650;
    game.boss = { x: 5115, y: WORLD.floor, w: 170, h: 67, hp: max, max, stage: 1, fire: 1.5, attack: 0, facing: -1 };
    announce(game, 'БУЛЬДОГ-01', 'Сбейте броню танка и уничтожьте его реактор.', 3.5);
  }
  const boss = game.boss;
  if (!boss || boss.hp <= 0) return;
  if (boss.stage === 1 && boss.hp <= boss.max * .52) {
    boss.stage = 2;
    boss.fire = 1.2;
    announce(game, 'РЕАКТОР ОТКРЫТ', 'Цельтесь в оранжевый реактор на крыше танка.', 5);
    effect(game, 'blast', boss.x, boss.y - 86, .55);
  }

  const target = closest(standing.filter((p) => p.x > 4300), boss.x, boss.y - 40);
  if (!target) return;
  boss.facing = target.x >= boss.x ? 1 : -1;
  if (boss.stage === 2 && Math.abs(target.x - boss.x) > 180) {
    boss.x = clamp(boss.x + boss.facing * 102 * dt, 4670, 5300);
  }
  if (boss.stage === 2) {
    for (const p of standing) if (contains(boss, p.x, p.y - 10, 5)) hurtPlayer(game, p, 19);
  }
  boss.fire -= dt;
  if (boss.fire > 0) return;
  const missile = ++boss.attack % (boss.stage === 1 ? 3 : 2) === 0;
  const origin = { x: boss.x + boss.facing * 78, y: boss.y - 53 };
  const point = center(target);
  const angle = Math.atan2(point.y - origin.y, point.x - origin.x);
  const offsets = missile ? [-.14, .07] : [-.13, 0, .13];
  for (const offset of offsets) {
    shoot(game, 'enemy', origin.x, origin.y, angle + offset, {
      speed: missile ? 225 : 480, damage: missile ? 25 : 13, color: missile ? '#ffab51' : '#ff676a', life: 3,
      explosive: missile, style: missile ? 'rocket' : 'shot'
    });
  }
  effect(game, 'spark', origin.x, origin.y, .2);
  boss.fire = boss.stage === 1 ? 1.53 : 1.14;
}

export function stepMission(game, seconds) {
  if (game.phase !== 'active') return;
  const connected = [...game.players.values()].filter((p) => p.connected);
  if (!connected.length) return;
  const dt = clamp(seconds, 0, dtMax);
  game.time += dt;
  game.lastStand = Math.max(0, game.lastStand - dt);
  for (const p of connected) controlPlayer(game, p, dt);
  updateRevives(game, connected, dt);
  const standing = connected.filter(living);
  if (!standing.length) {
    game.phase = 'defeat';
    return;
  }
  if (standing.length === connected.length) game.lastStandUsed = false;
  if (connected.length > 1 && standing.length === 1 && !game.lastStandUsed) {
    game.lastStandUsed = true;
    game.lastStand = 10;
    announce(game, 'ПОСЛЕДНИЙ РУБЕЖ', 'Движение и перезарядка ускорены на 10 секунд.', 4);
  }
  const farthest = standing.reduce((a, b) => a.x > b.x ? a : b);
  updateBridge(game, farthest);
  updateEnemies(game, standing, dt);
  updatePickups(game, standing);
  updateTurrets(game, dt);
  updateBoss(game, standing, farthest, dt);
  updateProjectiles(game, dt);

  if (!game.gateOpen && game.objects.filter((o) => o.type === 'generator').every((o) => o.gone)) {
    game.gateOpen = true;
    announce(game, 'ВОРОТА ОТКРЫТЫ', 'Впереди тяжёлая боевая машина.', 4);
  }
  if (game.boss && game.boss.hp === 0) {
    effect(game, 'blast', game.boss.x, game.boss.y - 48, 1.16);
    effect(game, 'debris', 5317, WORLD.floor - 78, 1.16);
    announce(game, 'БУЛЬДОГ УНИЧТОЖЕН', 'За стеной аванпоста открыт вход в лабораторию HELIOS.', 2);
    game.phase = 'victory';
  }
  game.effects = game.effects.filter((e) => e.end >= game.time);
}

export function snapshot(game) {
  return {
    time: game.time, phase: game.phase, bridge: game.bridge, bridgeAt: game.bridgeAt, gateOpen: game.gateOpen,
    boss: game.boss, alert: game.alert?.end > game.time ? game.alert : null, lastStand: game.lastStand, secrets: game.secrets,
    players: [...game.players.values()].map(({ previous, input, ...p }) => p),
    enemies: game.enemies.filter((e) => e.hp > 0), objects: game.objects.filter((o) => !o.gone),
    bullets: game.bullets.map(({ id, x, y, vx, vy, color, style }) => ({ id, x, y, vx, vy, color, style })),
    grenades: game.grenades.map(({ id, x, y, life }) => ({ id, x, y, life })), turrets: game.turrets, effects: game.effects
  };
}

export function cleanInput(value) {
  if (!value || typeof value !== 'object') return {};
  const clean = {};
  for (const key of ['left', 'right', 'jump', 'duck', 'fire', 'reload', 'swap', 'grenade', 'ability', 'interact']) {
    clean[key] = value[key] === true;
  }
  clean.angle = typeof value.angle === 'number' && Number.isFinite(value.angle) ? clamp(value.angle, -Math.PI, Math.PI) : 0;
  return clean;
}
