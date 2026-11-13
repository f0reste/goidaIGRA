export const VIEW = { width: 960, height: 540 };
export const WORLD = { width: 5430, floor: 440, gravity: 980 };
export const TICK = 30;

export const characters = {
  phantom: { name: 'Рэй «Фантом»', role: 'Штурмовик', ability: 'Рывок', color: '#68e4fa', description: 'Быстрый рывок с краткой неуязвимостью.' },
  spark: { name: 'Алекс «Искра»', role: 'Инженер', ability: 'Турель', color: '#f6bc5d', description: 'Автоматическая турель прикрывает команду 12 секунд.' }
};

export const weapons = {
  pistol: { name: 'P-9 «Резерв»', kind: 'Запасной пистолет', damage: 14, rate: 3.8, speed: 740, mag: Infinity, reserve: Infinity, reload: 0, price: 0, color: '#fff3b8' },
  rifle: { name: 'AR-17 «Штурм»', kind: 'Штурмовая винтовка', damage: 12, rate: 6, speed: 800, mag: 30, reserve: 150, reload: 1.15, price: 0, color: '#fff1a0' },
  shotgun: { name: 'SG-8 «Гром»', kind: 'Дробовик', damage: 9, rate: 1.2, speed: 680, mag: 6, reserve: 42, reload: 1.3, price: 500, pellets: 5, color: '#ffbc7a' },
  machinegun: { name: 'MG-40 «Мясорубка»', kind: 'Тяжёлый пулемёт', damage: 7, rate: 12, speed: 840, mag: 64, reserve: 192, reload: 1.8, price: 900, color: '#a4fbdf' }
};
export const upgrades = [0, 0, 200, 350, 600, 1000];
export const upgradeLabels = ['', 'Базовая модель', '+15% урона', '+20% ёмкости', '+15% темпа огня', 'Особый эффект'];

export const terrain = [
  { x: 0, y: 440, w: 1200, kind: 'grass' },
  { x: 1200, y: 440, w: 90, kind: 'bridge' },
  { x: 1290, y: 440, w: 112, kind: 'bridge', fragile: true },
  { x: 1402, y: 440, w: 134, kind: 'bridge' },
  { x: 1536, y: 440, w: 118, kind: 'bridge', fragile: true },
  { x: 1654, y: 440, w: 150, kind: 'bridge' },
  { x: 1804, y: 440, w: 835, kind: 'grass' },
  { x: 2639, y: 440, w: 2791, kind: 'concrete' },
  { x: 445, y: 363, w: 135, kind: 'grass' },
  { x: 840, y: 370, w: 141, kind: 'grass' },
  { x: 1940, y: 355, w: 142, kind: 'grass' },
  { x: 2265, y: 374, w: 152, kind: 'grass' },
  { x: 2690, y: 359, w: 154, kind: 'metal' },
  { x: 2985, y: 324, w: 157, kind: 'metal' },
  { x: 3260, y: 375, w: 175, kind: 'metal' },
  { x: 3640, y: 355, w: 149, kind: 'metal' },
  { x: 3860, y: 321, w: 143, kind: 'metal' },
  { x: 4520, y: 362, w: 150, kind: 'metal' },
  { x: 4768, y: 331, w: 130, kind: 'metal' },
  { x: 5166, y: 350, w: 146, kind: 'metal' }
];

export const gate = 4115;
export const zones = [
  { x: 0, name: 'Берег реки' },
  { x: 1080, name: 'Заброшенный мост' },
  { x: 1870, name: 'Путь к бункеру' },
  { x: 2610, name: 'Подземный бункер' },
  { x: 3510, name: 'Аванпост HELIOS' },
  { x: 4350, name: 'Арена «Бульдога»' }
];

export const enemyTypes = {
  infantry: { hp: 40, w: 30, h: 42, range: 510, reward: 10 },
  drone: { hp: 25, w: 36, h: 23, range: 515, reward: 10 },
  shield: { hp: 120, w: 39, h: 46, range: 470, reward: 30 }
};

export function weaponStats(id, level = 1) {
  const base = weapons[id];
  return {
    ...base,
    damage: base.damage * (level >= 2 ? 1.15 : 1),
    mag: Math.ceil(base.mag * (level >= 3 ? 1.2 : 1)),
    rate: base.rate * (level >= 4 ? 1.15 : 1),
    special: level === 5
  };
}
