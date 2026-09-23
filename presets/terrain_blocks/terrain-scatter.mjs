/* terrain-scatter.mjs — kaya / çakıl / ejecta bloğu (§8.2).

   Mavi-gürültü (best-candidate) yerleşim: küçük popülasyonlar düzgün-rastgele
   konunca KÜMELENİR (sözleşme §5) — her aday, sınıfın MEVCUT konumlarına
   uzaklığı en büyük olan k adaydan seçilir. Boy dağılımı düşük-eğik, nadir
   büyük. Yoğunluk eğime (10–30° yamaçlar) ve krater ejecta halkalarına göre
   artar. Kapı içi (ped, koridor) kayasız. Kayalar yarı gömülü ve YEREL
   NORMALE yatırılır. Sınıf başına tek InstancedMesh: üç çizim çağrısı.

   Kaya biçimi: bozulmuş, yassıltılmış ikosahedron (kırık blok silüeti;
   lunar_descent'in çok-yüzlü reçetesinin ucuz akrabası). */

import { mulberry32, spatialHash, smoothstep } from './terrain-noise.mjs';

const CLASSES = {
  block:  { detail: 2, sizeMin: .02, sizeMax: .06, rMin: 1.5, rMax: 60 },   // 2–6 m, 150 m – 6 km
  rock:   { detail: 1, sizeMin: .004, sizeMax: .02, rMin: .35, rMax: 24 },  // 40 cm – 2 m
  pebble: { detail: 0, sizeMin: .0005, sizeMax: .0022, rMin: .015, rMax: .4 }, // 5–22 cm, vista bandı
};

function rockGeometry(THREE, rnd, detail) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const j = 1 + (rnd() - .5) * .55;
    p.setXYZ(i, p.getX(i) * j, p.getY(i) * j * .62, p.getZ(i) * j);
  }
  g.computeVertexNormals();
  return g;
}

export function scatterRocks(THREE, field, {
  seed = 1, counts = { block: 16, rock: 60, pebble: 180 }, tone = 0x7d7970, material,
  slopeBias = 1.2, ejectaBoost = 1.5, candidates = 6,
} = {}) {
  const rnd = mulberry32(seed ^ 0x4A7A11);
  const craters = field.layers.find(L => L.name === 'craterField')?.describe().craters ?? [];
  const ejectaHash = spatialHash(60);
  for (const k of craters) if (k.age < .5 && k.R > .5) ejectaHash.insert(k, k.x, k.z, k.R * 2.6);
  const ejectaAt = (x, z) => {
    const list = ejectaHash.at(x, z);
    if (!list) return 0;
    let m = 0;
    for (const k of list) { const s = Math.hypot(x - k.x, z - k.z) / k.R; if (s > 1 && s < 2.6) m = Math.max(m, (1 - smoothstep(1.6, 2.6, s)) * (1 - k.age)); }
    return m;
  };
  const mat = material || new THREE.MeshLambertMaterial({ color: tone });
  const group = new THREE.Group();
  const instances = [];
  const meshes = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qy = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), nv = new THREE.Vector3(), sc = new THREE.Vector3(), pv = new THREE.Vector3();
  const nrm = [0, 1, 0];

  for (const [cls, spec] of Object.entries(CLASSES)) {
    const want = counts[cls] ?? 0;
    if (!want) continue;
    const geo = rockGeometry(THREE, rnd, spec.detail);
    const mesh = new THREE.InstancedMesh(geo, mat, want);
    mesh.castShadow = cls !== 'pebble'; mesh.receiveShadow = true;
    const placed = [];
    const hash = spatialHash(Math.max(.5, spec.rMax / 8));
    let n = 0, tries = 0;
    while (n < want && tries < want * 40) {
      tries++;
      /* best-candidate: k aday, mevcutlara en uzak olan */
      let best = null, bestD = -1;
      for (let c = 0; c < candidates; c++) {
        const t = rnd() * Math.PI * 2;
        const d = spec.rMin + Math.pow(rnd(), 1.4) * (spec.rMax - spec.rMin);
        const x = Math.cos(t) * d, z = Math.sin(t) * d;
        if (field.isClear(x, z)) continue;
        const slope = field.slopeDeg(x, z);
        const w = 1 + slopeBias * smoothstep(8, 30, slope) * (1 - smoothstep(35, 45, slope)) + ejectaBoost * ejectaAt(x, z);
        if (rnd() > w / (1 + slopeBias + ejectaBoost)) continue;   // yoğunluk: kabul-ret
        let nearest = Infinity;
        const list = hash.at(x, z);
        if (list) for (const o of list) nearest = Math.min(nearest, Math.hypot(x - o.x, z - o.z));
        if (nearest > bestD) { bestD = nearest; best = { x, z }; }
      }
      if (!best) continue;
      const size = spec.sizeMin + Math.pow(rnd(), 2.2) * (spec.sizeMax - spec.sizeMin);   // düşük-eğik, nadir büyük
      const y = field.height(best.x, best.z) + size * .22;                                 // yarı gömülü
      field.normal(best.x, best.z, nrm);
      nv.set(nrm[0], nrm[1], nrm[2]);
      q.setFromUnitVectors(up, nv);
      qy.setFromAxisAngle(up, rnd() * Math.PI * 2);
      q.multiply(qy);
      sc.set(size * (.8 + rnd() * .5), size * .62, size * (.8 + rnd() * .5));
      pv.set(best.x, y, best.z);
      m4.compose(pv, q, sc);
      mesh.setMatrixAt(n, m4);
      const inst = { x: best.x, z: best.z, y, r: size, cls };
      instances.push(inst); placed.push(inst); hash.insert(inst, best.x, best.z, 0);
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
    meshes.push(mesh);
  }
  return {
    group, instances, meshes, material: mat,
    stats: () => Object.fromEntries(meshes.map(m => [m.geometry.parameters?.detail ?? 0, m.count])),
    dispose() { for (const m of meshes) { m.geometry.dispose(); m.dispose(); } if (!material) mat.dispose(); },
  };
}
