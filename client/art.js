import { characters, gate, terrain, VIEW, WORLD } from './data.js';

function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h));
}

function poly(ctx, color, points) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (const [i, [x, y]] of points.entries()) i ? ctx.lineTo(Math.round(x), Math.round(y)) : ctx.moveTo(Math.round(x), Math.round(y));
  ctx.closePath();
  ctx.fill();
}

function label(ctx, text, x, y, color = '#eef5dc', size = 11, align = 'left') {
  ctx.font = size + 'px monospace';
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(text, Math.round(x), Math.round(y));
}

function rand(i) {
  const value = Math.sin(i * 124.63 + 4.218) * 43758.5453;
  return value - Math.floor(value);
}

function mountain(ctx, width, camera, y, size, spacing, color) {
  const offset = camera % spacing;
  const index = Math.floor(camera / spacing);
  const points = [[-spacing - offset, 460]];
  for (let i = -1; i < width / spacing + 2; i++) {
    const x = i * spacing - offset;
    points.push([x, y - rand(i + index + y) * size], [x + spacing * .42, y - rand(i + index + y + 168) * size * .48]);
  }
  points.push([width + spacing * 2, 460]);
  poly(ctx, color, points);
}

function tree(ctx, x, base, scale, color, light, seed) {
  const tall = (80 + rand(seed) * 113) * scale;
  const width = (31 + rand(seed + 5) * 26) * scale;
  rect(ctx, color, x - 5 * scale, base - tall + 13 * scale, 11 * scale, tall - 7 * scale);
  rect(ctx, light, x + 4 * scale, base - tall + 25 * scale, 3 * scale, tall - 24 * scale);
  for (let i = 0; i < 8; i++) {
    const branchY = base - tall + i * 8 * scale;
    const spread = width * (1 - i * .072);
    const shift = (rand(seed + i * 23) - .5) * 44 * scale;
    rect(ctx, color, x + shift - spread, branchY, spread * 2, 11 * scale);
    rect(ctx, color, x + shift - spread * .77, branchY - 7 * scale, spread * 1.54, 9 * scale);
    rect(ctx, light, x + shift - spread * .68, branchY - 7 * scale, spread * .92, 2 * scale);
  }
  if (seed % 3 === 0) {
    rect(ctx, color, x + width * .7, base - tall + 28 * scale, 2 * scale, 63 * scale);
    rect(ctx, light, x + width * .7 + 3 * scale, base - tall + 28 * scale, 2 * scale, 42 * scale);
  }
}

function background(ctx, camera, width, height, time, bunker = 0) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#203429');
  sky.addColorStop(.5, '#789268');
  sky.addColorStop(1, '#b9b37b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const sunX = width * .68 - camera * .022;
  ctx.fillStyle = '#cbd39b';
  ctx.beginPath();
  ctx.arc(Math.round(sunX), 142, 75, 0, 2 * Math.PI);
  ctx.fill();
  for (let i = 0; i < 11; i++) {
    const x = ((i * 197 + time * 3 - camera * .065) % (width + 250) + width + 250) % (width + 250) - 150;
    const y = 51 + rand(i * 17) * 177;
    rect(ctx, '#9fa98145', x, y, 100 + rand(i * 23) * 110, 4);
    rect(ctx, '#bcc29635', x + 26, y - 6, 117, 3);
  }
  mountain(ctx, width, camera * .12, 334, 133, 157, '#506b53');
  mountain(ctx, width, camera * .2, 365, 118, 118, '#3f604d');
  for (const [speed, spacing, base, scale, color, light] of [[.26, 55, 399, 1.02, '#2d5243', '#3f6450'], [.52, 86, 457, 1.57, '#203c32', '#2c5140']]) {
    const shift = camera * speed;
    const start = Math.floor(shift / spacing) - 2;
    const end = start + Math.ceil(width / spacing) + 5;
    for (let i = start; i <= end; i++) tree(ctx, i * spacing - shift, base + rand(i + 55) * 24, scale, color, light, i + (speed * 100 | 0));
  }
  rect(ctx, '#152d27', 0, 450, width, 100);

  if (bunker > 0) {
    ctx.save();
    ctx.globalAlpha = bunker;
    rect(ctx, '#151e21', 0, 0, width, height);
    for (let x = -(camera * .53 % 150); x < width + 150; x += 150) {
      rect(ctx, '#222f31', x + 8, 138, 128, 313);
      rect(ctx, '#2d3a3b', x + 10, 141, 124, 3);
      rect(ctx, '#111b1b', x + 13, 146, 119, 295);
      rect(ctx, '#354344', x + 28, 173, 72, 210);
      rect(ctx, '#253431', x + 31, 176, 66, 204);
      rect(ctx, '#4a5a49', x + 34, 186, 60, 7);
      rect(ctx, '#495348', x + 33, 204, 13, 158);
      rect(ctx, '#192422', x + 48, 206, 45, 156);
      for (let i = 0; i < 5; i++) rect(ctx, '#243230', x + 49, 218 + i * 20, 42, 3);
      rect(ctx, '#a6a46c', x + 63, 165, 18, 3);
      rect(ctx, '#f3bd7560', x + 61, 168, 22, 3);
    }
    rect(ctx, '#0c1718', 0, 79, width, 16);
    rect(ctx, '#34413e', 0, 94, width, 4);
    rect(ctx, '#111c1b', 0, 120, width, 10);
    ctx.restore();
  }
}

function drawPylon(ctx, x, y, width, height) {
  rect(ctx, '#152721', x, y - height, width, height);
  rect(ctx, '#2a4236', x + 6, y - height, 7, height);
  rect(ctx, '#66735b', x + 5, y - height, width - 10, 6);
  for (let k = 24; k < height; k += 35) rect(ctx, '#32463b', x + 14, y - k, width - 22, 3);
}

function scenery(ctx, camera, width, time) {
  const left = Math.max(0, Math.floor(camera / 84) - 2);
  const right = Math.ceil((camera + width) / 84) + 1;
  for (let i = left; i <= right; i++) {
    const wx = i * 84 + rand(i) * 44;
    if (wx < 1170 || (wx > 1805 && wx < 2630)) {
      const x = wx - camera;
      if (i % 3 === 0) tree(ctx, x, 440, 1.8 + rand(i + 2) * .4, '#142c24', '#254437', i);
      for (let k = 0; k < 5; k++) {
        const d = rand(i * 31 + k) * 50;
        const height = 6 + rand(i + k * 51) * 21;
        rect(ctx, k % 2 ? '#416c45' : '#2a4c36', x + d, 439 - height, 3, height);
        rect(ctx, '#5d804d', x + d - 4, 438 - height, 6, 3);
      }
    }
  }
  for (const x of [3580, 3720, 3890, 4050, 4230, 4405, 4645, 4955, 5320]) {
    if (x < camera - 100 || x > camera + width + 100) continue;
    drawPylon(ctx, x - camera, 442, 46, 220 + (x % 60));
    rect(ctx, '#688473', x - camera - 8, 233 - (x % 60), 61, 8);
    rect(ctx, '#b99e64', x - camera + 19, 246 - (x % 60), 8, 5);
  }

  if (camera < 1810 && camera + width > 1200) {
    rect(ctx, '#253f3b', 1200 - camera, 472, 604, 70);
    for (let i = 0; i < 22; i++) {
      const x = (i * 41 + time * (10 + i % 3)) % 590;
      rect(ctx, i % 3 ? '#41655b' : '#799481', 1200 + x - camera, 476 + (i * 23) % 53, Math.min(41, 604 - x), 2);
    }
    for (const x of [1218, 1440, 1732, 1784]) drawPylon(ctx, x - camera, 490, 14, 58);
  }
}

function drawTerrain(ctx, state, camera, width) {
  for (const p of terrain) {
    if (p.x + p.w < camera || p.x > camera + width || (p.fragile && state.bridge === 'broken')) continue;
    const x = p.x - camera;
    const y = p.y;
    const deep = y >= WORLD.floor && ['concrete', 'grass'].includes(p.kind);
    const isGrass = p.kind === 'grass';
    const bridge = p.kind === 'bridge';
    const metal = p.kind === 'metal' || p.kind === 'concrete';
    rect(ctx, isGrass ? '#302a21' : bridge ? '#443b2b' : '#293332', x, y, p.w, deep ? 106 : 15);
    rect(ctx, isGrass ? '#71844d' : bridge ? '#ae9668' : '#708278', x, y, p.w, 4);
    rect(ctx, isGrass ? '#425636' : bridge ? '#786449' : '#475b56', x, y + 4, p.w, 6);
    if (!deep) rect(ctx, '#13221b', x + 4, y + 12, p.w - 8, 4);
    const first = Math.max(0, Math.floor((camera - p.x) / 17));
    const last = Math.min(Math.ceil(p.w / 17), first + Math.ceil(width / 17) + 2);
    for (let i = first; i < last; i++) {
      const tx = x + i * 17;
      if (tx + 12 > x + p.w) continue;
      if (deep) {
        rect(ctx, metal ? '#3e4740' : '#514236', tx + 2, y + 19 + rand(i + p.x) * 16, 5 + rand(i * 5) * 8, 2);
        rect(ctx, metal ? '#1e2924' : '#2a2620', tx + 1, y + 48 + rand(i * 3 + p.x) * 35, 10, 3);
      } else rect(ctx, '#222a22', tx + 5, y + 7, 2, 3);
    }
    if (p.fragile && state.bridge === 'warning') {
      rect(ctx, Math.floor(state.time * 7) % 2 ? '#ff784ba0' : '#b9374260', x, y - 10, p.w, 12);
      for (let i = 0; i < p.w - 8; i += 15) rect(ctx, '#ff9d63', x + i, y - 9, 7, 2);
    }
  }
  if (!state.gateOpen && gate > camera - 50 && gate < camera + width + 50) {
    const x = gate - camera;
    rect(ctx, '#182522', x - 16, 171, 32, 269);
    rect(ctx, '#536052', x - 16, 171, 8, 269);
    rect(ctx, '#455747', x - 4, 180, 14, 252);
    for (let i = 0; i < 12; i++) rect(ctx, i % 2 ? '#cda65e' : '#27312b', x - 3, 201 + i * 12, 9, 8);
    rect(ctx, '#ff6956', x - 4, 183, 11, 6);
  }
}

function drawBridgeEvent(ctx, state, camera, time) {
  if (state.bridge !== 'warning' || !inView(1500, camera)) return;
  const age = Math.max(0, 3.1 - (state.bridgeAt - state.time));
  const x = 1030 + age * 255 - camera;
  const y = 181 + Math.sin(time * 4) * 8;
  poly(ctx, '#1d2a23', [[x-75,y+10],[x-58,y+1],[x-22,y+10],[x-13,y-6],[x+31,y-6],[x+47,y+4],[x+47,y+21],[x-23,y+21]]);
  rect(ctx, '#65755c', x-13, y-5, 40, 5);
  rect(ctx, '#42574a', x-13, y+1, 58, 11);
  rect(ctx, '#a3b79c', x+25, y+1, 14, 7);
  rect(ctx, '#202e26', x+1, y-17, 5, 13);
  rect(ctx, '#273d32', x-55, y-19, 114, 4);
  rect(ctx, '#9db09a', x-45 + (time * 850 % 61), y-19, 37, 2);
  rect(ctx, '#141f19', x-18, y+25, 57, 4);
  rect(ctx, '#ff8b58', x-22, y+11, 6, 3);
  if (age < 1.55) return;
  const target = age > 2.36 ? 1595 : 1346;
  const progress = (age * 3.2) % 1;
  const shotX = x + (target - camera - x) * progress;
  const shotY = y + 20 + (WORLD.floor - y - 23) * progress;
  rect(ctx, '#ff9b64', shotX - 3, shotY - 3, 6, 7);
  rect(ctx, '#ffe8a7', shotX - 1, shotY - 1, 3, 4);
}

function drawLab(ctx, state, camera) {
  const x = 5330 - camera;
  if (x > VIEW.width + 70) return;
  const open = state.phase === 'victory';
  rect(ctx, '#1c2923', x - 37, 297, 132, 143);
  rect(ctx, '#5c6957', x - 34, 299, 132, 6);
  rect(ctx, '#374a3c', x - 33, 306, 132, 8);
  rect(ctx, '#111d19', x - 23, 324, 73, 116);
  if (open) {
    rect(ctx, '#324f4a', x - 19, 328, 64, 112);
    rect(ctx, '#759a85', x - 15, 331, 56, 3);
    rect(ctx, '#426f61', x - 4, 358, 34, 82);
    rect(ctx, '#8fd8b8', x + 5, 359, 17, 2);
    poly(ctx, '#98c4a729', [[x-15,332],[x+41,332],[x+69,439],[x-42,439]]);
    label(ctx, 'HELIOS LAB', x + 14, 321, '#b3e6ba', 10, 'center');
  } else {
    rect(ctx, '#47544a', x - 19, 328, 64, 112);
    for (let i = 0; i < 9; i++) rect(ctx, '#2e3d34', x - 16, 333 + i * 11, 58, 3);
    rect(ctx, '#df735b', x + 9, 320, 9, 3);
  }
}

export function drawFighter(ctx, x, y, type, facing = 1, phase = 0, angle = 0, duck = false, down = false, moving = false, shieldOpen = false) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(facing, 1);
  const enemy = type === 'infantry' || type === 'shield';
  const color = enemy ? '#dd815e' : characters[type]?.color || '#75def2';
  if (down) {
    rect(ctx, '#10201b', -18, -13, 42, 13);
    rect(ctx, color, -14, -11, 12, 6);
    rect(ctx, '#4f6150', 0, -10, 21, 8);
    ctx.restore();
    return;
  }
  if (duck) ctx.scale(1, .69);
  const stride = moving ? Math.sin(phase * 15) * 4.5 : 0;
  rect(ctx, '#111b17', -15, -5, 33, 6);
  rect(ctx, '#19251f', -13, -19, 10, 17 - stride);
  rect(ctx, '#26362b', 3, -19, 10, 17 + stride);
  rect(ctx, '#69725c', -13, -17, 7, 7);
  rect(ctx, '#4c5b4b', 5, -17, 7, 7);
  rect(ctx, '#0d1713', -15, -5 - stride, 15, 5);
  rect(ctx, '#101913', 3, -5 + stride, 15, 5);
  rect(ctx, '#192720', -14, -35, 26, 19);
  rect(ctx, color, -12, -31, 21, 8);
  rect(ctx, '#374f42', -11, -22, 20, 6);
  rect(ctx, '#121d17', -13, -43, 25, 14);
  rect(ctx, '#65745f', -11, -43, 20, 5);
  rect(ctx, '#364840', -12, -38, 22, 9);
  rect(ctx, color, 1, -36, 10, 3);
  rect(ctx, '#e4ebe0', 8, -36, 3, 2);
  rect(ctx, '#283b32', -17, -33, 7, 16);
  rect(ctx, '#59725e', -16, -31, 4, 9);
  ctx.save();
  ctx.translate(5, -25);
  if (!enemy) ctx.rotate(facing === 1 ? angle : Math.PI - angle);
  rect(ctx, '#101713', 0, -4, 25, 8);
  rect(ctx, '#829284', 1, -5, 18, 3);
  rect(ctx, '#596960', 21, -2, 9, 3);
  rect(ctx, '#4d5e50', -4, 1, 11, 5);
  ctx.restore();
  if (type === 'shield') {
    const shift = shieldOpen ? 17 : 0;
    rect(ctx, '#2a3029', 13, -40 + shift, 14, 37 - shift);
    rect(ctx, '#8f8a69', 13, -40 + shift, 4, 37 - shift);
    rect(ctx, '#d78a58', 16, -35 + shift, 9, 4);
    rect(ctx, '#6e7462', 19, -27 + shift, 6, 19 - shift);
  }
  ctx.restore();
}

function drawDrone(ctx, x, y, t) {
  rect(ctx, '#14241e', x - 21, y - 19, 42, 13);
  rect(ctx, '#42534b', x - 18, y - 22, 36, 12);
  rect(ctx, '#76867a', x - 15, y - 23, 30, 4);
  rect(ctx, '#18261d', x - 8, y - 14, 16, 15);
  rect(ctx, '#fb646c', x - 6, y - 12, 12, 5);
  rect(ctx, '#fff1b7', x - 3, y - 12, 6, 2);
  for (const dx of [-24, 20]) {
    rect(ctx, '#a3b3a0', x + dx - 6, y - 19, 13, 2);
    rect(ctx, '#f5876c', x + dx, y - 8, 4, 3 + Math.sin(t * 22) * 2);
  }
}

export function drawTank(ctx, x, y, boss, time) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  const dir = boss.facing ?? -1;
  ctx.scale(dir, 1);
  rect(ctx, '#101712', -89, -20, 178, 22);
  rect(ctx, '#314139', -79, -27, 160, 24);
  rect(ctx, '#111a16', -81, -19, 165, 17);
  for (let i = -74; i < 76; i += 19) {
    rect(ctx, '#556557', i, -16, 13, 12);
    rect(ctx, '#202d26', i + 3, -14, 7, 8);
    rect(ctx, '#758069', i, -2, 12, 2);
  }
  poly(ctx, '#26392f', [[-79,-24],[-81,-43],[-66,-55],[56,-55],[84,-40],[88,-24]]);
  poly(ctx, '#5b6b53', [[-79,-40],[-63,-54],[56,-54],[79,-43],[59,-39],[-63,-39]]);
  rect(ctx, '#354a3b', -59, -39, 124, 13);
  rect(ctx, '#6c7b60', -55, -36, 20, 3);
  rect(ctx, '#9da379', 55, -36, 18, 7);
  rect(ctx, '#efaa5a', 59, -35, 11, 3);
  rect(ctx, '#1a271e', -39, -68, 92, 15);
  rect(ctx, '#526650', -34, -70, 72, 12);
  rect(ctx, '#72826a', -32, -70, 66, 3);
  rect(ctx, '#27362b', 32, -57, 62, 8);
  rect(ctx, '#798671', 37, -58, 47, 3);
  rect(ctx, '#101b14', 84, -61, 13, 12);
  rect(ctx, '#707b6e', 86, -61, 9, 3);
  rect(ctx, '#29392d', -65, -64, 17, 16);
  rect(ctx, '#9d8763', -63, -64, 12, 3);
  rect(ctx, '#b1ae88', -12, -37, 4, 6);
  rect(ctx, '#b1ae88', -6, -37, 4, 6);
  rect(ctx, '#b1ae88', 0, -37, 4, 6);
  if (boss.stage === 2) {
    const flare = Math.sin(time * 8) * .13;
    rect(ctx, '#ad421e66', -32, -111, 64, 43);
    rect(ctx, '#302b21', -26, -99, 52, 29);
    rect(ctx, '#ff733e', -20, -98, 40, 24);
    rect(ctx, '#ffb551', -15, -96, 30, 20);
    ctx.globalAlpha = .83 + flare;
    rect(ctx, '#fff4b1', -9, -92, 18, 12);
    ctx.globalAlpha = 1;
    rect(ctx, '#fb8951', -28, -95, 5, 21);
    rect(ctx, '#fb8951', 23, -95, 5, 21);
  }
  ctx.restore();
}

function drawObject(ctx, obj, x, t) {
  const { type, y, w, h } = obj;
  const top = y - h;
  if (type === 'ammo' || type === 'med') {
    const color = type === 'ammo' ? '#e0e884' : '#aaf0ce';
    rect(ctx, '#17271d', x - w / 2 - 2, top, w + 4, h);
    rect(ctx, '#53654d', x - w / 2, top + 3, w, h - 4);
    rect(ctx, color, x - 8, top + 7, 16, 3);
    rect(ctx, color, x - 2, top + 4, 4, 10);
    rect(ctx, '#1c2c22', x - w / 2, y - 4, w, 3);
    if (Math.sin(t * 5 + x) > 0) rect(ctx, color, x - 1, top - 5, 2, 2);
  } else if (type === 'barrel') {
    rect(ctx, '#402725', x - 13, top, 26, h);
    rect(ctx, '#a74737', x - 11, top + 4, 21, h - 7);
    rect(ctx, '#e6a057', x - 10, top + 9, 18, 4);
    rect(ctx, '#e4a05c', x - 3, top + 16, 6, 8);
    rect(ctx, '#2e2f24', x - 14, y - 7, 28, 4);
  } else if (type === 'generator') {
    rect(ctx, '#222920', x - 24, top, 48, h);
    rect(ctx, '#5f6243', x - 21, top + 3, 42, h - 6);
    rect(ctx, '#2b3c32', x - 17, top + 8, 34, h - 15);
    rect(ctx, '#a09960', x - 17, top + 8, 34, 4);
    rect(ctx, Math.sin(t * 6) > 0 ? '#ffb462' : '#cd7541', x - 8, top + 20, 16, 13);
    for (let k = 0; k < 3; k++) rect(ctx, '#94a37a', x - 10, y - 10 - k * 5, 20, 2);
    poly(ctx, '#ffb462', [[x - 5, top - 11], [x + 5, top - 11], [x, top - 5]]);
  } else {
    const secret = type === 'secret';
    rect(ctx, '#282f23', x - w / 2, top, w, h);
    rect(ctx, secret ? '#5e674a' : '#876b48', x - w / 2 + 3, top + 3, w - 6, h - 6);
    rect(ctx, secret ? '#8a9066' : '#b88c54', x - w / 2 + 4, top + 3, w - 8, 3);
    for (let i = 0; i < 3; i++) rect(ctx, '#363829', x - w / 2 + 6, top + 8 + i * 8, w - 12, 2);
    if (secret) rect(ctx, '#dec176', x + 8, top + 14, 3, 7);
  }
}

function drawEffect(ctx, effect, camera, t) {
  const age = 1 - Math.max(0, effect.end - t) / effect.duration;
  const x = effect.x - camera;
  const y = effect.y;
  const blast = effect.type === 'blast';
  const debris = effect.type === 'debris';
  const light = effect.type === 'heal' || effect.type === 'ammo' || effect.type === 'dash';
  const colors = blast ? ['#fff4aa', '#ffb64f', '#e8663e', '#65523b'] : light ? ['#dbf9ab', '#78e5c3'] : debris ? ['#926a47', '#bda171'] : ['#f5c484', '#ffa064', '#fae1a3'];
  const count = blast ? 27 : debris ? 14 : 7;
  const radius = blast ? 58 : debris ? 34 : 22;
  ctx.save();
  ctx.globalAlpha = Math.max(.1, 1 - age * .92);
  for (let i = 0; i < count; i++) {
    const angle = i * 2.399 + effect.id * .6;
    const dist = radius * (.15 + age) * (rand(effect.id + i * 3) * .9 + .16);
    const size = (blast ? 7 : 3) * (1.1 - age * .48) + rand(i + effect.id) * 4;
    rect(ctx, colors[i % colors.length], x + Math.cos(angle) * dist, y + Math.sin(angle) * dist + (debris ? age * age * 29 : 0), size, size);
  }
  ctx.restore();
}

function inView(x, camera) {
  return x > camera - 110 && x < camera + VIEW.width + 110;
}

export function paintGame(ctx, state, camera, selfId, pointer, visualTime) {
  const { width, height } = VIEW;
  ctx.imageSmoothingEnabled = false;
  const mid = camera + width / 2;
  const bunker = Math.min(1, Math.max(0, (mid - 2600) / 320), Math.max(0, (3750 - mid) / 290));
  background(ctx, camera, width, height, visualTime, bunker);
  scenery(ctx, camera, width, visualTime);
  drawTerrain(ctx, state, camera, width);
  drawLab(ctx, state, camera);
  drawBridgeEvent(ctx, state, camera, visualTime);

  for (const obj of state.objects) if (inView(obj.x, camera)) drawObject(ctx, obj, obj.x - camera, visualTime);
  for (const e of state.enemies) {
    if (!inView(e.x, camera)) continue;
    if (e.type === 'drone') drawDrone(ctx, e.x - camera, e.y, visualTime);
    else drawFighter(ctx, e.x - camera, e.y, e.type, e.facing, visualTime + e.id, 0, false, false, e.moving, e.open > 0);
    if (e.hp < e.max) {
      rect(ctx, '#222b24', e.x - camera - 14, e.y - e.h - 8, 28, 3);
      rect(ctx, '#ff9277', e.x - camera - 14, e.y - e.h - 8, 28 * e.hp / e.max, 3);
    }
  }
  if (state.boss?.hp > 0) drawTank(ctx, state.boss.x - camera, state.boss.y, state.boss, visualTime);
  for (const t of state.turrets) {
    const x = t.x - camera;
    rect(ctx, '#121f19', x - 17, t.y - 7, 34, 7);
    rect(ctx, '#637d69', x - 11, t.y - 21, 22, 17);
    rect(ctx, '#aff4a6', x - 5, t.y - 18, 10, 4);
    rect(ctx, '#91a98f', x + (t.facing < 0 ? -22 : 7), t.y - 20, 15, 5);
  }

  for (const p of state.players) {
    if (!inView(p.x, camera)) continue;
    const x = p.x - camera;
    ctx.save();
    if (!p.connected) ctx.globalAlpha = .34;
    else if (p.invuln > 0 && Math.floor(visualTime * 18) % 3 === 0) ctx.globalAlpha = .55;
    drawFighter(ctx, x, p.y, p.character, p.facing, visualTime, p.angle, p.h < 40, p.hp === 0, Math.abs(p.vx) > 10 && p.grounded);
    ctx.restore();
    const color = characters[p.character].color;
    const down = p.hp === 0;
    const title = !p.connected ? 'НЕТ СВЯЗИ' : down ? (p.id === selfId ? 'ЖДИТЕ СОЮЗНИКА' : 'УДЕРЖИВАЙТЕ E') : p.id === selfId ? 'ВЫ' : p.nick;
    const lineY = p.y - (down ? 21 : p.h + 13);
    const box = Math.max(26, title.length * 6.6 + 12);
    rect(ctx, '#101b16d9', x - box / 2, lineY - 11, box, 14);
    label(ctx, title, x, lineY, down ? '#ffaf7c' : color, 10, 'center');
    if (p.revive > 0) {
      rect(ctx, '#28352b', x - 25, lineY + 5, 50, 4);
      rect(ctx, '#a9f49c', x - 25, lineY + 5, p.revive * 50 / 3, 4);
    }
  }

  for (const b of state.bullets) {
    const x = b.x - camera;
    if (b.style === 'rocket') {
      rect(ctx, '#ff663d', x - Math.sign(b.vx) * 9, b.y - 2, 14, 4);
      rect(ctx, '#fee9a1', x - 4, b.y - 3, 9, 6);
    } else {
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, b.y);
      ctx.lineTo(x - b.vx * .015, b.y - b.vy * .015);
      ctx.stroke();
    }
  }
  for (const g of state.grenades) {
    rect(ctx, '#18241b', g.x - camera - 5, g.y - 5, 10, 10);
    rect(ctx, '#b1c465', g.x - camera - 3, g.y - 3, 6, 6);
    rect(ctx, '#ff9c5e', g.x - camera, g.y - 5, 3, 2);
  }
  for (const e of state.effects) if (e.end > state.time) drawEffect(ctx, e, camera, state.time);
  if (pointer?.inside) {
    const { x, y } = pointer;
    for (const [dx, dy, w, h] of [[-10,0,6,1],[4,0,6,1],[0,-10,1,6],[0,4,1,6],[0,0,1,1]]) {
      rect(ctx, '#18261a', x + dx - 1, y + dy - 1, w + 2, h + 2);
      rect(ctx, '#f6ffc0', x + dx, y + dy, w, h);
    }
  }
}

export function paintBriefing(canvas) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  background(ctx, 12, width, height, 0);
  scenery(ctx, 9, width, 1);
  const beam = ctx.createLinearGradient(595, 155, 1040, 450);
  beam.addColorStop(0, '#d7d7933e');
  beam.addColorStop(1, '#557e6320');
  poly(ctx, beam, [[694,117],[744,104],[1100,453],[843,453]]);
  rect(ctx, '#26392c', 565, 411, 570, 79);
  rect(ctx, '#657c55', 568, 411, 570, 5);
  for (let i = 0; i < 65; i++) {
    const x = 565 + rand(i * 7) * 575;
    const y = 416 + rand(i * 23) * 75;
    rect(ctx, i % 3 ? '#3d4a35' : '#5c6549', x, y, 8 + rand(i) * 19, 2 + rand(i + 7) * 3);
  }

  for (let x = 911; x < 1150; x += 118) drawPylon(ctx, x, 410, 29, 227);
  rect(ctx, '#263b31', 910, 197, 259, 19);
  rect(ctx, '#62765b', 910, 196, 259, 4);
  rect(ctx, '#ca8468', 953, 200, 13, 4);
  ctx.save();
  ctx.translate(886, 413);
  ctx.scale(1.67, 1.67);
  drawTank(ctx, 0, 0, { facing: -1, stage: 2 }, 2);
  ctx.restore();
  ctx.save();
  ctx.translate(705, 415);
  ctx.scale(1.29, 1.29);
  drawFighter(ctx, 0, 0, 'phantom', 1, 0, -.2);
  ctx.restore();
  drawDrone(ctx, 1030, 254, 1.5);
  drawDrone(ctx, 977, 283, 0);
  for (let i = 0; i < 54; i++) {
    const x = 650 + rand(i * 26 + 3) * 480;
    const y = 210 + rand(i * 53 + 4) * 226;
    rect(ctx, i % 4 ? '#b8c98768' : '#ffab70af', x, y, 1 + (i % 3), 1 + (i % 2));
  }
}

export function paintPortrait(canvas, character) {
  const ctx = canvas.getContext('2d');
  rect(ctx, '#182319', 0, 0, 43, 47);
  for (let i = 0; i < 8; i++) rect(ctx, '#27372a', 0, i * 6, 43, 1);
  drawFighter(ctx, 20, 45, character, 1, 0, -.15);
}

export function paintWeapon(canvas, id) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  rect(ctx, '#151f16', 0, 0, width, height);
  for (let x = 0; x < width; x += 12) rect(ctx, '#233226', x, 0, 1, height);
  for (let y = 0; y < height; y += 12) rect(ctx, '#233226', 0, y, width, 1);
  const long = id === 'machinegun' ? 126 : id === 'shotgun' ? 116 : 105;
  const color = id === 'machinegun' ? '#a3d2a0' : id === 'shotgun' ? '#bd9a65' : '#c4d49d';
  const x = (width - long) / 2 - 9;
  const y = height / 2 - 6;
  rect(ctx, '#0c140e', x - 5, y - 3, long + 22, 23);
  rect(ctx, '#505f48', x, y, long, 11);
  rect(ctx, color, x + 16, y - 2, long - 26, 4);
  rect(ctx, '#a0aa7f', x + long - 12, y + 1, 27, 5);
  rect(ctx, '#28382a', x + long + 4, y - 1, 13, 9);
  rect(ctx, '#252f24', x - 4, y + 7, 31, 10);
  rect(ctx, '#768164', x + 35, y + 6, 12, 17);
  rect(ctx, '#1d271e', x + 36, y + 18, 13, 7);
  if (id !== 'shotgun') rect(ctx, '#636e55', x + 52, y + 9, 23, id === 'machinegun' ? 19 : 15);
  for (let i = 0; i < 6; i++) rect(ctx, '#26352a', x + long - 47 + i * 5, y + 3, 3, 4);
}
