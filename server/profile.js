import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import { upgrades, weapons } from '../client/data.js';

export function openProfiles(directory) {
  mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(resolve(directory, 'profiles.sqlite'));
  db.exec('CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, data TEXT NOT NULL)');
  const get = db.prepare('SELECT data FROM profiles WHERE id = ?');
  const put = db.prepare('INSERT INTO profiles VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data');

  function save(id, profile) {
    put.run(id, JSON.stringify(profile));
  }

  return {
    getOrCreate(token) {
      const entry = typeof token === 'string' && /^[a-f0-9]{48}$/.test(token) && get.get(token);
      if (entry) return { id: token, profile: JSON.parse(entry.data) };
      const id = randomBytes(24).toString('hex');
      const profile = { credits: 0, owned: { rifle: 1 }, equipped: 'rifle' };
      save(id, profile);
      return { id, profile };
    },
    award(id, profile, amount) {
      profile.credits += amount;
      save(id, profile);
    },
    purchase(id, profile, weapon, action) {
      if (!Object.hasOwn(weapons, weapon) || weapon === 'pistol') return 'Оружие недоступно.';
      const level = profile.owned[weapon] || 0;
      if (action === 'equip') {
        if (!level) return 'Сначала купите оружие.';
        profile.equipped = weapon;
      } else {
        const cost = action === 'buy' && !level ? weapons[weapon].price : action === 'upgrade' && level > 0 ? upgrades[level + 1] : undefined;
        if (cost === undefined) return 'Эта операция недоступна.';
        if (profile.credits < cost) return 'Недостаточно кредитов.';
        profile.credits -= cost;
        profile.owned[weapon] = level + 1;
      }
      save(id, profile);
      return null;
    }
  };
}
