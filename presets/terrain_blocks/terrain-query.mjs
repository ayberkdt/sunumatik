/* terrain-query.mjs — fizik ve figürlerin tükettiği sorgu API'si (§6, R7).

   Hepsi SAF ve tahsissiz (out parametreli). `height` ANALİTİKtir: örgüden
   okunmaz; örgü zaten aynı fonksiyondan (+ eğim düzeltmesi) örülür, tekerlek
   asla "örgü ile analitik arası boşlukta" havada kalmaz. Kayalar
   terrain-scatter'ın ürettiği örnek listesinden hücre ızgarasıyla bulunur.

     q.height(x, z)                    // birim
     q.normal(x, z, out)               // merkezi fark, adım = yerel çözünürlük
     q.slopeDeg(x, z)
     q.contact(x, z, rWheel, out)      // küre/silindir–yükseklik alanı teması
     q.raycastDown(x, y, z, out)       // dikey ışın; kaya örneklerini de tarar
     q.nearestRocks(x, z, r, out)      // engel kaçınma / ayak yerleşimi
     q.rockAt(x, z)                    // bu noktanın üstünde kaya var mı
     q.isClear(x, z)                   // kapı içinde mi */

import { spatialHash } from './terrain-noise.mjs';

export function createTerrainQuery(field, scatter = null) {
  const rocks = scatter?.instances ?? [];
  const hash = spatialHash(4);
  for (const r of rocks) hash.insert(r, r.x, r.z, r.r);
  const n3 = [0, 1, 0];

  const contact = (x, z, rWheel, out = {}) => {
    /* tekerlek merkezi, yarıçap disk içindeki en yüksek "h + √(r²−d²)" ile
       oturur (silindir ekseni bilinmiyor: küre yaklaşımı, 9 örnek) */
    let best = -Infinity, bx = x, bz = z;
    const k = rWheel * .7;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const px = x + i * k, pz = z + j * k, d2 = (px - x) ** 2 + (pz - z) ** 2;
      if (d2 > rWheel * rWheel) continue;
      const y = field.height(px, pz) + Math.sqrt(rWheel * rWheel - d2);
      if (y > best) { best = y; bx = px; bz = pz; }
    }
    out.y = best; out.x = bx; out.z = bz;
    out.normal = field.normal(bx, bz, out.normal ?? [0, 1, 0]);
    out.slopeDeg = field.slopeDeg(bx, bz);
    return out;
  };
  const rockAt = (x, z) => {
    const list = hash.at(x, z);
    if (!list) return null;
    let hit = null, top = -Infinity;
    for (const r of list) { const d = Math.hypot(x - r.x, z - r.z); if (d < r.r * .9) { const y = r.y + r.r * .55; if (y > top) { top = y; hit = r; } } }
    return hit;
  };
  const raycastDown = (x, y, z, out = {}) => {
    const ground = field.height(x, z);
    const rock = rockAt(x, z);
    const rockTop = rock ? rock.y + rock.r * .55 : -Infinity;
    if (rock && rockTop >= ground && rockTop <= y) { out.y = rockTop; out.kind = 'rock'; out.rock = rock; out.normal = n3.slice(); return out; }
    out.y = ground; out.kind = 'ground'; out.rock = null; out.normal = field.normal(x, z, out.normal ?? [0, 1, 0]);
    return out;
  };
  const nearestRocks = (x, z, r, out = []) => {
    out.length = 0;
    const cells = Math.ceil(r / hash.cell);
    const seen = new Set();
    for (let i = -cells; i <= cells; i++) for (let j = -cells; j <= cells; j++) {
      const list = hash.at(x + i * hash.cell, z + j * hash.cell);
      if (!list) continue;
      for (const rk of list) { if (seen.has(rk)) continue; seen.add(rk); const d = Math.hypot(x - rk.x, z - rk.z) - rk.r; if (d <= r) out.push({ rock: rk, dist: d }); }
    }
    out.sort((a, b) => a.dist - b.dist);
    return out;
  };
  return {
    height: field.height, normal: field.normal, slopeDeg: field.slopeDeg, gradient: field.gradient,
    hardness: field.hardness, isClear: field.isClear, corridorAt: field.corridorAt,
    contact, raycastDown, nearestRocks, rockAt, rocks,
  };
}
