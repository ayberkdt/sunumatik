/* bind.mjs — davranış kanallarını three.js'e YAZAR (tek yer).
 * docs/breathing-motion-plan.md §2.
 *
 * İKİNCİL KANAL KURALI: nefes hiçbir zaman rayı ya da simülasyonu
 * sürmez; üstüne EKLENİR. Bu yüzden bağlayıcı, bağlandığı anda taban
 * pozu (konum, dönüş, ölçek, emissive, ışık şiddeti) bir kez okur ve her
 * karede `taban + offset` yazar. Sahne kendi mantığıyla tabanı
 * değiştirdiğinde `rebase()` çağrılır — nefes birikmez.
 *
 * Yasak sınıflar burada da reddedilir (budget.mjs ile aynı liste): arazi,
 * alan, yörünge, gölge, boşta HUD. Sessizce geçmek, sahneyi yanlış
 * göstermenin en kolay yoludur.
 */

import { FORBIDDEN_CLASSES, YASAK } from './budget.mjs';

const ax = { x: 'x', y: 'y', z: 'z' };

function sinifSec(obj, verilen) {
  if (verilen) return verilen;
  const u = obj?.userData || {};
  if (u.lifeClass) return u.lifeClass;
  if (u.preset === 'terrain_blocks' || /terrain|arazi|ground|zemin/i.test(obj?.name || '')) return 'terrain';
  if (/orbit|yorunge|trail|iz$/i.test(obj?.name || '')) return 'orbit';
  if (/hud/i.test(obj?.name || '')) return 'hud';
  return 'craft';
}

/**
 * Bir davranışı bir hedefe bağlar.
 *
 * target: { object?, material?, light?, camera? }
 * map:    kanal → yazılacak yer. Örnek:
 *         { pan: { node: mastPan, rot: 'z' }, emissive: { material: m },
 *           nefes: { scale: obj }, x: { pos: obj, axis: 'x' } }
 */
export function bindBehaviour(behaviour, map, { sinif = null, object = null } = {}) {
  const cls = sinifSec(object, sinif ?? behaviour.sinif);
  if (FORBIDDEN_CLASSES.includes(cls)) {
    throw new Error(`life-signs bind: '${behaviour.id}' ${cls} sınıfına bağlanamaz — ${YASAK[cls]}`);
  }
  const kanallar = Object.keys(map);
  const taban = new Map();

  const oku = () => {
    taban.clear();
    for (const k of kanallar) {
      const m = map[k];
      if (!m) continue;
      if (m.pos) taban.set(k, m.pos.position[ax[m.axis || 'x']]);
      else if (m.rot !== undefined && m.node) taban.set(k, m.node.rotation[m.rot]);
      else if (m.scale) taban.set(k, m.scale.scale.x);
      else if (m.material) taban.set(k, m.material.emissiveIntensity ?? 1);
      else if (m.light) taban.set(k, m.light.intensity);
      else if (m.set) taban.set(k, 0);
    }
  };
  oku();

  const yaz = (t) => {
    const s = behaviour.sample(t) || {};
    for (const k of kanallar) {
      const m = map[k];
      if (!m) continue;
      const v = s[k];
      if (v === undefined || v === null || typeof v !== 'number') { m.set?.(s[k], s); continue; }
      const gain = m.gain ?? 1;
      const b = taban.get(k) ?? 0;
      if (m.pos) m.pos.position[ax[m.axis || 'x']] = b + v * gain;
      else if (m.rot !== undefined && m.node) m.node.rotation[m.rot] = b + v * gain;
      else if (m.scale) { const sc = 1 + v * gain; m.scale.scale.setScalar(b * sc); }
      else if (m.material) m.material.emissiveIntensity = Math.max(0, m.absolute ? v * gain : b + v * gain);
      else if (m.light) m.light.intensity = Math.max(0, m.absolute ? v * gain : b + v * gain);
      else if (m.set) m.set(v, s);
    }
    return s;
  };

  return {
    id: behaviour.id, behaviour, sinif: cls,
    /** Tabanı yeniden oku (sahne hedefi kendi mantığıyla taşıdıysa). */
    rebase: oku,
    /** t anını yaz; örneklenen kanalları döndürür. */
    apply: yaz,
    /** Nefesi geri al: taban poza dön (reduced/export tablosu için). */
    reset() { for (const k of kanallar) { const m = map[k], b = taban.get(k) ?? 0;
      if (!m) continue;
      if (m.pos) m.pos.position[ax[m.axis || 'x']] = b;
      else if (m.rot !== undefined && m.node) m.node.rotation[m.rot] = b;
      else if (m.scale) m.scale.scale.setScalar(b);
      else if (m.material) m.material.emissiveIntensity = b;
      else if (m.light) m.light.intensity = b;
    } },
  };
}

/** Birden çok bağlayıcıyı tek elden sürer. */
export function createBinder() {
  const list = [];
  return {
    add(behaviour, map, opts) { const h = bindBehaviour(behaviour, map, opts); list.push(h); return h; },
    apply(t) { const out = {}; for (const h of list) out[h.id] = h.apply(t); return out; },
    rebase() { for (const h of list) h.rebase(); },
    reset() { for (const h of list) h.reset(); },
    get handles() { return list.slice(); },
  };
}
