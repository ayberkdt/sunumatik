/* adapters/catalog.mjs — BEYAN EDİLMİŞ katalogları montaj sözleşmesine çevirir.
 * docs/exploded-view-plan.md §9.
 *
 * `sat-parts.mjs` biçimindeki bir modül (PARTS, STEPS, SUBSYSTEMS) doğrudan
 * `core/assembly.mjs` sözleşmesine oturur. Çeviri ince tutulur: alan adları
 * eşlenir, hiçbir sayı yeniden hesaplanmaz — kaynak katalog tek gerçektir.
 */

import { createAssembly } from '../../core/assembly.mjs';

/** Katalog modülü → montaj grafiği. */
export function assemblyFromCatalog(mod, { axis = [0, 0, 1], wetIds = ['itici-yakit'] } = {}) {
  const parts = mod.PARTS.map(p => ({
    id: p.id,
    ad: p.ad,
    parent: p.mountsTo ?? null,
    iface: p.arayuz,
    step: p.step,
    group: p.sistem,
    massKg: p.massKg,
    qty: p.qty,
    pos: p.pos,
    size: p.size,
    why: p.why,
    wet: wetIds.includes(p.id),
    sekil: p.sekil,
    tech: p.tech || null,
    ports: p.ports || null,
    dir: p.dir || null,
  }));
  return createAssembly({
    units: 'm', axis,
    steps: (mod.STEPS || []).map(s => ({ no: s.no, ad: s.ad, aciklama: s.aciklama })),
    parts,
  });
}

/** Alt sistem renk/ad tablosu (vitrin için). */
export function groupsFromCatalog(mod) {
  const g = mod.SUBSYSTEMS || {};
  return Object.fromEntries(Object.entries(g).map(([k, v]) => [k, { ad: v.ad, renk: v.renk, neden: v.neden }]));
}
