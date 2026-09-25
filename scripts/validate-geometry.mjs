#!/usr/bin/env node
/* validate-geometry.mjs — ÇİZİLEN geometri, BEYAN edilenle tutuyor mu.
 *
 * NEDEN VAR
 * ─────────
 * Bu depodaki en pahalı hata sınıfı yön ve hizalama. Her biri tek tek
 * yakalandı ve her seferinde önce KULLANICI gördü:
 *
 *   güneş dizisi güneşten 48° sapmış, kosinüs 0,201
 *   yüksek kazançlı anten nadirden tam 180°, yani derin uzaya
 *   panel tarlası beyan ettiği yerden 37 m ötede, reaktörün üstünde
 *   kriyojenik tanklar pedin 1,06 m altında
 *   regolit örtüsü, örttüğü modülün yanına dikilmiş dikey bir duvar
 *   yan paneller beyan ettikleri kalınlığın 60 katı
 *   uydunun tamamı yan yatmış (kamera yukarısı ile gövde yukarısı 90° ayrı)
 *
 * Hepsi ölçülebilirdi. Ölçülemez olan, ölçümün KOŞAMAMASIYDI: gövdeyi kuran
 * kod doku için canvas ister, node'da canvas yoktur, dolayısıyla hiçbir kapı
 * çizilen geometriye bakamıyor ve bütün denetimler kataloğun kendi kendisiyle
 * tutarlılığını sınamakla yetiniyordu. `scripts/dom-stub.mjs` ve
 * `scripts/three-resolver.mjs` tam bunu açar.
 *
 * NE SINAR
 * ────────
 *   1. Her parçanın ÇİZİLEN sınır kutusu, BEKLENEN kutusunun içinde mi.
 *      Beklenen kutu yalnız `pos ± size/2` değildir: çoğaltma ve yönlendirme
 *      kuralları da modellenir, yoksa doğru çizilmiş bir dizi hata sayılır.
 *   2. Nişangâh beyan eden parça gerçekten oraya bakıyor mu.
 *   3. Gövde çerçevesi +Z yukarı olan sahnenin sayfası `camera.up`'ı
 *      ayarlıyor mu. Ayarlamayan sayfa aracı yan yatırır ve bu, tek tek
 *      parçalara bakarak ASLA bulunamaz.
 *
 * EŞİK ve RATCHET
 * ───────────────
 * Eşik ölçümden seçildi, tahminden değil: el rayı, ayak pabucu, kanatçık
 * gibi meşru ayrıntılar en çok 0,63 m taşıyor; gerçek kusurlar 1 m'nin
 * üstünde başlıyordu (37 m, 8,2 m, 1,86 m). SERT EŞİK 0,65 m: bunun üstü
 * düşer. Altı, kayıtlı tabana göre sınanır — küçük taşmalar büyüyemez.
 *
 * Koşum: node scripts/validate-geometry.mjs [--taban-yaz]
 */
import { register } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
register(pathToFileURL(path.join(kok, 'scripts/three-resolver.mjs')).href, import.meta.url);
const { domKur } = await import(pathToFileURL(path.join(kok, 'scripts/dom-stub.mjs')).href);
domKur();
const THREE = await import('three');

const TABAN_YOL = path.join(kok, 'scripts', 'geometri-taban.json');
const tabanYaz = process.argv.includes('--taban-yaz');
const SERT_ESIK = 0.65;

let gecti = 0, kaldi = 0;
const bolum = (ad) => console.log(`\n== ${ad}`);
const ok = (kosul, ad, detay = '') => {
  if (kosul) { gecti++; console.log(`  ok  ${ad}${detay ? '  (' + detay + ')' : ''}`); }
  else { kaldi++; console.log(`  HATA ${ad}${detay ? '  (' + detay + ')' : ''}`); }
};

/* ── çizilen kutu: köşe noktalarından, örneklenmiş ağlar dâhil ─────── */
const v = new THREE.Vector3();
const m4 = new THREE.Matrix4();
function cizilenKutu(n) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  let bulundu = false;
  n.traverse(o => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    bulundu = true;
    const a = o.geometry.attributes.position;
    const yut = (mat) => {
      for (let i = 0; i < a.count; i++) {
        v.fromBufferAttribute(a, i).applyMatrix4(mat);
        for (let j = 0; j < 3; j++) {
          const c = v.getComponent(j);
          if (c < mn[j]) mn[j] = c;
          if (c > mx[j]) mx[j] = c;
        }
      }
    };
    /* InstancedMesh: her örnek kendi matrisindedir; gövdeyi bir kez saymak
       260 kayanın 259'unu görmezden gelmek olur. */
    if (o.isInstancedMesh) {
      const w = new THREE.Matrix4();
      for (let k = 0; k < o.count; k++) {
        o.getMatrixAt(k, m4);
        yut(w.multiplyMatrices(o.matrixWorld, m4));
      }
      return;
    }
    yut(o.matrixWorld);
  });
  return bulundu ? { mn, mx } : null;
}

/* ── beklenen kutu: çoğaltma ve yönlendirme MODELLENİR ─────────────── */
function beklenenKutu(p, katalog) {
  const mn = p.pos.map((c, i) => c - p.size[i] / 2);
  const mx = p.pos.map((c, i) => c + p.size[i] / 2);
  const kat = (nokta) => {
    for (let i = 0; i < 3; i++) {
      mn[i] = Math.min(mn[i], nokta[0][i]);
      mx[i] = Math.max(mx[i], nokta[1][i]);
    }
  };

  /* Yönlendirilen hat: `size` nominal bir koşudur, gerçek yol uç
     noktalardan türetilir. Kutusu X'e hizalı yazılıyken çapraz koşan bir
     hat 8,2 m "taşıyor" görünüyordu - ki taşmıyordu, kutu yanlıştı. */
  if (p.boru?.ucNoktalar && katalog.partById) {
    const uc = p.boru.ucNoktalar.map(id => katalog.partById(id)).filter(Boolean);
    if (uc.length === 2) {
      const pay = (p.boru.odM ?? 0.1) * 2 + 0.5;   // askı, tava, genleşme ilmeği
      for (const u of uc) {
        kat([u.pos.map(c => c - pay), u.pos.map(c => c + pay)]);
      }
    }
  }

  /* Çoğaltma. Habitat deseni katalogda (`dizilim`) ve `size` zaten dizinin
     zarfıdır. Uydu tarafında `qty` kopyaları YANSITILARAK yerleşir ve `size`
     tek birimi anlatır; kuralı burada modellemezsek doğru çizilmiş bir çift
     yıldız izleyici hata sayılır. */
  const n = p.qty ?? 1;
  if (n > 1 && !p.dizilim && katalog.yansimali) {
    const [x, y, z] = p.pos;
    const yerler = n === 4
      ? [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => [a * Math.abs(x), b * Math.abs(y), z])
      : n === 2 ? [[Math.abs(x), y, z], [-Math.abs(x), y, z]]
        : n === 3 ? [0, 1, 2].map(i => [x, y + (i - 1) * 0.42, z]) : [[x, y, z]];
    for (const q of yerler) {
      kat([q.map((c, i) => c - p.size[i] / 2), q.map((c, i) => c + p.size[i] / 2)]);
    }
  }
  return { mn, mx };
}

/* ── sahneler ──────────────────────────────────────────────────────── */
const sahneler = [];
{
  const H = await import(pathToFileURL(path.join(kok, 'presets/habitat_blocks/hab-build.mjs')).href);
  const HP = await import(pathToFileURL(path.join(kok, 'presets/habitat_blocks/hab-parts.mjs')).href);
  for (const env of ['mars', 'moon']) {
    const r = H.buildHabitat(THREE, { env });
    r.root.updateMatrixWorld(true);
    sahneler.push({ ad: `habitat/${env}`, parcalar: HP.PARTS, katalog: { partById: HP.partById, yansimali: false },
      dugum: (id) => r.nodes.get(id) });
  }
}
{
  const S = await import(pathToFileURL(path.join(kok, 'presets/satellite_integration/sat-build.mjs')).href);
  const SP = await import(pathToFileURL(path.join(kok, 'presets/satellite_integration/sat-parts.mjs')).href);
  const r = S.buildSatellite(THREE, {});
  r.root.updateMatrixWorld(true);
  /* Uydu tarafında her parça KENDİ grubunu alır ama qty kopyaları ayrı
     çocuklardır; hepsini tek kutuda toplamak gerekir. */
  const grupla = (id) => {
    const cs = r.root.children.filter(c => c.userData?.part?.id === id);
    if (!cs.length) return null;
    const g = new THREE.Group();
    for (const c of cs) g.add(c.clone(true));
    g.updateMatrixWorld(true);
    return g;
  };
  sahneler.push({ ad: 'uydu', parcalar: SP.PARTS, katalog: { partById: SP.partById, yansimali: true },
    dugum: grupla });
}

/* ── 1. çizilen kutu beklenenin içinde mi ──────────────────────────── */
bolum('1 çizilen geometri beyan edilen kutunun içinde');
const taban = fs.existsSync(TABAN_YOL) ? JSON.parse(fs.readFileSync(TABAN_YOL, 'utf8')) : {};
const yeniTaban = {};
const sert = [];
const buyuyen = [];
let olculen = 0, enBuyuk = 0, enBuyukAd = '';

for (const s of sahneler) {
  for (const p of s.parcalar) {
    const n = s.dugum(p.id);
    if (!n) continue;
    const ciz = cizilenKutu(n);
    if (!ciz) continue;
    olculen++;
    const bek = beklenenKutu(p, s.katalog);
    const tas = [0, 1, 2].map(i => Math.max(bek.mn[i] - ciz.mn[i], ciz.mx[i] - bek.mx[i], 0));
    const en = Math.max(...tas);
    const eksen = 'xyz'[tas.indexOf(en)];
    const anahtar = `${s.ad}/${p.id}`;
    yeniTaban[anahtar] = +en.toFixed(3);
    if (en > enBuyuk) { enBuyuk = en; enBuyukAd = anahtar; }
    /* Parca kendi zarf payini BEYAN edebilir (gergi teli, ankraj gibi ince
       ama uzak uzantilar). Pay katalogda yazilidir; kapinin icinde gizli bir
       muafiyet listesi tutmak, neyin neden gecildigini gorunmez kilar. */
    const esik = SERT_ESIK + (p.zarfPay ?? 0);
    if (en > esik) sert.push(`${anahtar} ${en.toFixed(2)} m ${eksen} (esik ${esik.toFixed(2)})`);
    else if (anahtar in taban && en > taban[anahtar] + 0.02) {
      buyuyen.push(`${anahtar} ${taban[anahtar].toFixed(2)} → ${en.toFixed(2)} m`);
    }
  }
}

ok(olculen > 60, 'sahneler node\'da kuruluyor ve ölçülüyor', `${olculen} parça`);
ok(sert.length === 0, `hiçbir parça sert eşiğini (${SERT_ESIK} m + beyan edilen pay) aşmıyor`,
  sert.join(', ') || `en büyük ${enBuyuk.toFixed(2)} m (${enBuyukAd})`);
ok(buyuyen.length === 0, 'kayıtlı tabana göre hiçbir taşma büyümedi',
  buyuyen.join(', ') || `${Object.keys(taban).length} kayıt`);

/* TERS SINAV: ölçüm gerçekten geometriye bakıyor mu? Bilerek kaydırılmış
   bir kutu YAKALANMAK zorunda - yoksa bu bölüm hiçbir şey ölçmüyordur. */
{
  const s = sahneler[0];
  const p = s.parcalar.find(q => q.id === 'hab-silindir');
  const n = s.dugum(p.id);
  const ciz = cizilenKutu(n);
  const sahte = { ...p, pos: [p.pos[0] + 5, p.pos[1], p.pos[2]] };
  const bek = beklenenKutu(sahte, s.katalog);
  const tas = Math.max(...[0, 1, 2].map(i => Math.max(bek.mn[i] - ciz.mn[i], ciz.mx[i] - bek.mx[i], 0)));
  ok(tas > SERT_ESIK, 'TERS SINAV: 5 m kaydırılmış beyan yakalanıyor',
    `sahte beyanla taşma ${tas.toFixed(2)} m`);
}

/* ── 2. nişangâh beyan eden parça oraya bakıyor mu ──────────────────── */
bolum('2 nişangâh: beyan edilen yön ile çizilen yön');
{
  const deg = 180 / Math.PI;
  const SP = await import(pathToFileURL(path.join(kok, 'presets/satellite_integration/sat-parts.mjs')).href);
  const uydu = sahneler.find(s => s.ad === 'uydu');
  let sayilan = 0;
  for (const p of SP.PARTS) {
    if (!p.nis) continue;
    const n = uydu.dugum(p.id);
    if (!n) continue;
    /* Nişangâhı taşıyan grup, parçanın kendi grubudur. */
    const alt = n.children[0] ?? n;
    const q = alt.getWorldQuaternion(new THREE.Quaternion());
    const ciz = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const bek = SP.boresightYonu(p.nis);
    const sapma = ciz.angleTo(new THREE.Vector3(bek[0], bek[1], bek[2])) * deg;
    ok(sapma < 0.5, `${p.id}: çizilen boresight beyanla aynı`, `sapma ${sapma.toFixed(3)}°`);
    sayilan++;
  }
  ok(sayilan > 0, 'nişangâh beyan eden parça ölçüldü', `${sayilan} parça`);
}

/* ── 3. sayfa, gövde çerçevesinin yukarısını biliyor mu ─────────────── */
bolum('3 kamera yukarısı gövde çerçevesiyle aynı');
{
  /* Blok sözleşmesi "+X ileri, +Z yukarı" der. Bunu söylemeyen sayfa aracı
     YAN YATIRIR - ölçülen: kamera yukarısı (0,1,0), gövde yukarısı (0,0,1),
     arada 90° - ve bu, parçalara tek tek bakarak asla bulunamaz, çünkü
     parçaların hepsi kendi içinde doğrudur. */
  const zYukari = ['satellite_integration', 'habitat_blocks', 'exploded_view',
    'aircraft_blocks', 'comms_antenna'];
  const eksik = [];
  for (const ad of zYukari) {
    const yol = path.join(kok, 'presets', ad, 'index.html');
    if (!fs.existsSync(yol)) continue;
    const kod = fs.readFileSync(yol, 'utf8');
    if (!/camera\.up\.set\(\s*0\s*,\s*0\s*,\s*1\s*\)/.test(kod)) eksik.push(ad);
  }
  ok(eksik.length === 0, 'gövde çerçevesi +Z olan her sayfa camera.up ayarlıyor',
    eksik.join(', ') || `${zYukari.length} sayfa`);
  const sahteKod = 'const camera = new THREE.PerspectiveCamera(38);';
  ok(!/camera\.up\.set\(\s*0\s*,\s*0\s*,\s*1\s*\)/.test(sahteKod),
    'TERS SINAV: ayarlamayan sayfa yakalanır', 'kancasız kod eşleşmiyor');
}

if (tabanYaz) {
  fs.writeFileSync(TABAN_YOL, JSON.stringify(yeniTaban, null, 1) + '\n', 'utf8');
  console.log(`\nTaban yazıldı: ${path.relative(kok, TABAN_YOL)} (${Object.keys(yeniTaban).length} kayıt)`);
}

console.log(`\n${gecti}/${gecti + kaldi} geçti`);
process.exit(kaldi === 0 ? 0 : 1);
