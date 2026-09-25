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

/**
 * Kurulmuş gövdeleri katalog kimliğine göre DÜĞÜM haritasına çevirir.
 *
 * `sat-build.mjs` çoklu parçaları (qty > 1) ayrı gövdeler olarak kurar ve
 * kimliklerine `#1`, `#2` ekler; katalog ise onları TEK satırda beyan eder.
 * Patlatma katalog satırını taşır, gövdeleri değil — bu yüzden kopyalar
 * ortak bir kapsayıcıya alınır ve kapsayıcı kopyaların ORTALAMA konumuna
 * oturur. Ortalama yerine ilk kopyanın konumu alınsaydı dört köşedeki
 * itici takımı tek köşeye doğru patlardı.
 *
 * @param yapim  { root, parts:[{ id, group }] }
 * @returns Map(katalogKimliği → Object3D)
 */
export function nodesFromBuild(THREE, yapim) {
  const oebek = new Map();
  for (const q of yapim.parts) {
    const ham = String(q.id).split('#')[0];
    if (!oebek.has(ham)) oebek.set(ham, []);
    oebek.get(ham).push(q.group);
  }
  const nodes = new Map();
  for (const [id, govdeler] of oebek) {
    if (govdeler.length === 1) {
      const g = govdeler[0];
      g.userData.partId = id;
      g.traverse(o => { o.userData.partId = id; });
      nodes.set(id, g);
      continue;
    }
    const kap = new THREE.Group();
    kap.name = id;
    const ort = new THREE.Vector3();
    for (const g of govdeler) ort.add(g.position);
    ort.divideScalar(govdeler.length);
    kap.position.copy(ort);
    for (const g of govdeler) { g.position.sub(ort); kap.add(g); }
    yapim.root.add(kap);
    kap.userData.partId = id;
    kap.traverse(o => { o.userData.partId = id; });
    nodes.set(id, kap);
  }
  return nodes;
}
