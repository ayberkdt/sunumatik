/* scene.mjs — HERHANGİ BİR three nesnesinden montaj grafiği türetir.
 * docs/exploded-view-plan.md §9.
 *
 * Katalog adaptörü (catalog.mjs) beyan edilmiş bir cisim içindir: parça
 * listesi, kütleler ve arayüzler zaten yazılıdır. Ama elimizdeki
 * cisimlerin çoğu beyan edilmemiştir — craft_blocks araçları, bir
 * mekanizma, dışarıdan gelen bir glTF. Bu adaptör onları da patlatılabilir
 * yapar ve BUNU YAPARKEN NE UYDURDUĞUNU SÖYLER.
 *
 * Türetme kuralları:
 *   • Parça = sahne grafiğinde ADI olan düğüm (Group ya da Mesh). Ad yoksa
 *     düğüm kendi ebeveyninin bir parçasıdır, ayrı parça değildir.
 *   • Ebeveyn = en yakın parça-atası. Böylece montaj ağacı sahne
 *     hiyerarşisinden gelir, uydurulmaz.
 *   • Konum = düğümün sınır kutusunun KÖK uzayındaki merkezi. Grup
 *     orijinleri çoğu zaman gövdenin merkezinde değildir; patlatma yönü
 *     merkezden çıkar, orijinden değil.
 *   • Kütle = beyan edilmemişse sınır hacmiyle orantılı TAHMİN. Tahmin
 *     `tahmini: true` ile damgalanır ve bütçe onu ayrı toplar; hiçbir yerde
 *     ölçülmüş kütle gibi gösterilmez.
 *   • Arayüz = addan çıkarılan sınıf (yoksa 'civata'), yalnızca bir
 *     VARSAYIMDIR; `arayuzTahmini: true` taşır.
 */

/* Addan arayüz sınıfı tahmini. Eşleşme yoksa cıvata varsayılır: en
   yaygın ve en zararsız varsayım odur (sökülebilir, yön vermez). */
const AD_ARAYUZ = [
  [/(kilit|latch|lock|clamp|kelepce)/i, 'kelepce'],
  [/(mentese|hinge|kapak|hatch|door)/i, 'mentese'],
  [/(conta|seal|port|dock|basinc)/i, 'basincli'],
  [/(kablo|cable|harness|konnektor|connector|wire)/i, 'elektrik'],
  [/(boru|pipe|hat|line|valf|valve|akiskan|fluid|feed)/i, 'akiskan'],
  [/(ayirma|separat|stage|pyro|bolt.?cut)/i, 'ayirma'],
  [/(ray|rail|slide|kizak)/i, 'kizak'],
  [/(kaynak|weld|bond|yapistir)/i, 'kaynak'],
];

/* Kütle sınıfı → görünür hacim başına eşdeğer yoğunluk (kg/m³).
   Uzay yapıları büyük ölçüde BOŞTUR: bir tankın sınır hacmi ile kütlesi
   arasındaki oran suyun yoğunluğu değil, onda biri mertebesindedir. Bu
   sayılar bir ölçüm değil, büyüklük mertebesi ayarıdır — tahminin
   tahmin olduğu bu yüzden ilan edilir. */
export const EFEKTIF_YOGUNLUK = Object.freeze({
  hafif: 45,       // panel, anten, ısıl örtü — neredeyse yüzey
  yapi: 160,       // gövde kabuğu, çerçeve, şasi
  yogun: 420,      // motor, batarya, tekerlek göbeği, reaktör
  varsayilan: 160,
});

const YOGUN_AD = /(motor|engine|nozul|nozzle|batarya|battery|reaktor|reactor|gobek|hub|tekerlek|wheel|pompa|pump|turbo)/i;
const HAFIF_AD = /(panel|anten|antenna|dish|canak|radyator|radiator|kanat|wing|bayrak|flag|mli|ortu|blanket|film)/i;

function yogunlukSinifi(ad) {
  if (YOGUN_AD.test(ad)) return 'yogun';
  if (HAFIF_AD.test(ad)) return 'hafif';
  return 'yapi';
}

function arayuzTahmin(ad) {
  for (const [re, sinif] of AD_ARAYUZ) if (re.test(ad)) return sinif;
  return 'civata';
}

/* craft_blocks düğüm adları İngilizce ve kısadır (`RockerL`, `HgaAz`):
   API adı olarak doğru, etiket olarak okunmaz. Karşılığı olmayan ad
   OLDUĞU GİBİ kalır — uydurma bir çeviri, yanlış bir etiketten daha
   kötüdür çünkü yanlış olduğu anlaşılmaz. */
export const CRAFT_ADLARI = Object.freeze({
  rover: 'Gezgin gövdesi', chassis: 'Şasi', body: 'Gövde', deck: 'Güverte',
  rockerL: 'Sol rocker kolu', rockerR: 'Sağ rocker kolu',
  bogieL: 'Sol bojı', bogieR: 'Sağ bojı', differential: 'Diferansiyel çubuğu',
  steerFL: 'Sol ön direksiyon', steerFR: 'Sağ ön direksiyon',
  steerRL: 'Sol arka direksiyon', steerRR: 'Sağ arka direksiyon',
  armJ1: 'Kol eklemi 1 (omuz)', armJ2: 'Kol eklemi 2 (dirsek)', armJ3: 'Kol eklemi 3 (bilek)',
  mastPan: 'Direk yalpa ekseni', mastTilt: 'Direk eğim ekseni', mast: 'Kamera direği',
  hgaAz: 'Yüksek kazançlı anten — azimut', hgaEl: 'Yüksek kazançlı anten — yükseliş',
  panelL: 'Sol güneş kanadı', panelR: 'Sağ güneş kanadı', panel: 'Güneş kanadı',
  gimbal: 'Gimbal', nozzle: 'Lüle', engine: 'Motor', tank: 'Tank',
  stage1: 'Birinci kademe', stage2: 'İkinci kademe', interstage: 'Kademeler arası',
  fairing: 'Başlık kaportası', booster: 'Yardımcı roket', boosterL: 'Sol yardımcı roket',
  boosterR: 'Sağ yardımcı roket', leg: 'İniş ayağı', legs: 'İniş ayakları',
  dish: 'Çanak anten', radiator: 'Radyatör', wheel: 'Tekerlek', hub: 'Göbek',
});

/** Ad → görünür etiket: 'craft:rover' → 'rover', 'sol-on-tekerlek' → 'Sol ön tekerlek'. */
function etiketle(ad) {
  const ham = String(ad).replace(/^craft:/, '');
  const bilinen = CRAFT_ADLARI[ham] || CRAFT_ADLARI[ham.replace(/#\d+$/, '')];
  if (bilinen) return bilinen;
  /* camelCase'i de ayır: 'mastTilt' → 'mast Tilt' → 'Mast tilt'. */
  const s = ham.replace(/[-_]+/g, ' ').replace(/([a-z\d])([A-Z])/g, '$1 $2').trim();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * Sahne nesnesinden montaj beyanı üretir.
 *
 * @param THREE  three ad alanı (Box3/Vector3 için)
 * @param root   kök Object3D
 * @param opts.maxDepth   kaç kat aşağı inilecek (varsayılan 3). Derinlik
 *                        arttıkça parça sayısı patlar ve etiket okunmaz
 *                        olur; üç kat çoğu araç için doğru ayrıntıdır.
 * @param opts.minOran    kökün en büyük boyutuna göre en küçük parça oranı;
 *                        bunun altındaki düğümler ebeveynine katılır.
 * @param opts.massKg     bilinen TOPLAM kütle. Verilirse tahminler bu
 *                        toplama ÖLÇEKLENİR; verilmezse ham tahmin kalır.
 * @param opts.group      düğüm → grup adı işlevi (öbekleme için)
 * @returns { parts, nodes, tahmin }  — parts doğrudan createAssembly'ye,
 *          nodes doğrudan createExplodedView'e verilir.
 */
export function assemblyFromScene(THREE, root, {
  maxDepth = 3, minOran = 0.035, massKg = null, group = null, adAyikla = null,
} = {}) {
  root.updateMatrixWorld(true);
  const kokKutu = new THREE.Box3().setFromObject(root);
  const kokBoyut = kokKutu.getSize(new THREE.Vector3());
  const gabari = Math.max(kokBoyut.x, kokBoyut.y, kokBoyut.z) || 1;
  const esik = gabari * minOran;

  const tersKok = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const kutu = new THREE.Box3(), merkez = new THREE.Vector3(), boyut = new THREE.Vector3();

  /* 1) Aday düğümler: adı olan ve yeterince büyük olanlar. */
  const adaylar = [];
  const gez = (o, derinlik, ebeveynId) => {
    let benimId = ebeveynId;
    const ad = adAyikla ? adAyikla(o) : o.name;
    if (ad && derinlik > 0 && derinlik <= maxDepth) {
      kutu.setFromObject(o);
      if (kutu.isEmpty()) return;
      kutu.getSize(boyut);
      if (Math.max(boyut.x, boyut.y, boyut.z) >= esik) {
        kutu.getCenter(merkez).applyMatrix4(tersKok);
        benimId = ad;
        adaylar.push({ o, id: ad, parent: ebeveynId, derinlik,
          pos: [merkez.x, merkez.y, merkez.z], size: [boyut.x, boyut.y, boyut.z] });
      }
    }
    for (const c of o.children) gez(c, derinlik + 1, benimId);
  };
  for (const c of root.children) gez(c, 1, null);

  /* 2) Aynı ad birden çok kez geçebilir (dizi elemanları). Ada sıra eki
        verilir; kimlik benzersiz olmak ZORUNDA, yoksa montaj grafiği iki
        farklı gövdeyi tek parça sanar. */
  const sayac = new Map();
  for (const a of adaylar) {
    const n = (sayac.get(a.id) || 0) + 1;
    sayac.set(a.id, n);
    a.benzersiz = n === 1 ? a.id : `${a.id}#${n}`;
  }
  const idHarita = new Map(adaylar.map(a => [a.o, a.benzersiz]));

  /* 3) Ebeveyn kimliğini benzersiz kimliğe çevir (en yakın aday-ata). */
  for (const a of adaylar) {
    let p = a.o.parent;
    a.parentId = null;
    while (p && p !== root) {
      if (idHarita.has(p)) { a.parentId = idHarita.get(p); break; }
      p = p.parent;
    }
  }

  /* 4) Kütle tahmini: sınır hacmi × efektif yoğunluk. */
  let hamToplam = 0;
  for (const a of adaylar) {
    const hacim = a.size[0] * a.size[1] * a.size[2];
    const sinif = yogunlukSinifi(a.id);
    /* İç içe parçaların hacmi iki kez sayılmasın: ebeveynin hacminden
       çocuklarınki düşülür. Düşülmezse toplam kütle katlanır. */
    a.__hacim = hacim;
    a.__sinif = sinif;
  }
  for (const a of adaylar) {
    let cocukHacim = 0;
    for (const b of adaylar) if (b.parentId === a.benzersiz) cocukHacim += b.__hacim;
    a.__netHacim = Math.max(a.__hacim - cocukHacim, a.__hacim * 0.08);
    hamToplam += a.__netHacim * EFEKTIF_YOGUNLUK[a.__sinif];
  }
  const olcek = massKg && hamToplam > 0 ? massKg / hamToplam : 1;

  const parts = adaylar.map(a => ({
    id: a.benzersiz,
    ad: etiketle(a.id),
    parent: a.parentId,
    pos: a.pos,
    size: a.size,
    massKg: Number((a.__netHacim * EFEKTIF_YOGUNLUK[a.__sinif] * olcek).toFixed(3)),
    iface: arayuzTahmin(a.id),
    group: group ? group(a.o, a.benzersiz) : a.__sinif,
    step: a.derinlik,
    /* Damga: bu satırdaki kütle ve arayüz ÖLÇÜLMEDİ, türetildi. */
    tahmini: true,
    arayuzTahmini: true,
    why: `Sahne grafiğinden türetildi (derinlik ${a.derinlik}). Kütle sınır hacmi ` +
      `${a.__netHacim.toExponential(2)} m³ × ${EFEKTIF_YOGUNLUK[a.__sinif]} kg/m³ (${a.__sinif}) ` +
      `üzerinden TAHMİN edilmiştir; ölçülmüş değer değildir.`,
  }));

  /* Montaj grafiği TEK KÖKLÜDÜR ve bu keyfi değil: patlatma yönü
     ebeveyne göre türetilir, kök de yerinde durur. Sahne grafiğinde ise
     kökün altında genelde birden çok adlı düğüm bulunur (gezginde
     `rockerL`, `rockerR`, gövde… hepsi köksüz kalıyordu ve
     createAssembly "ikinci kök" diye atıyordu).

     Çözüm bir istisna değil, bir BEYAN: cismin bütününü temsil eden
     sentetik bir kök eklenir. Kütlesi sıfırdır çünkü kendisi bir parça
     değil, parçaların ortak çerçevesidir. */
  const koksuz = parts.filter(p => p.parent === null);
  if (koksuz.length !== 1) {
    kokKutu.getCenter(merkez);
    const kokId = root.name || 'govde';
    const sentetik = {
      id: kokId,
      ad: etiketle(kokId),
      parent: null,
      pos: [merkez.x - (root.position?.x ?? 0), merkez.y - (root.position?.y ?? 0), merkez.z - (root.position?.z ?? 0)],
      size: [kokBoyut.x, kokBoyut.y, kokBoyut.z],
      massKg: 0,
      iface: 'civata',
      group: 'cerceve',
      step: 0,
      tahmini: true,
      arayuzTahmini: true,
      sentetik: true,
      why: `Sahne grafiğinde ${koksuz.length} adet köksüz düğüm vardı; montaj grafiği tek köklü ` +
        'olmak zorunda olduğu için cismin bütününü temsil eden bu çerçeve ÜRETİLDİ. ' +
        'Kendisi bir parça değildir, kütlesi bu yüzden sıfırdır.',
    };
    for (const p of koksuz) p.parent = kokId;
    parts.unshift(sentetik);
  }

  const nodes = new Map(adaylar.map(a => [a.benzersiz, a.o]));
  for (const a of adaylar) a.o.userData.partId = a.benzersiz;
  /* Sentetik kökün düğümü cismin kendisidir: görünür kalır ama patlatma
     onu yerinde tutar. */
  if (!nodes.has(parts[0].id) && parts[0].sentetik) nodes.set(parts[0].id, root);

  return {
    parts, nodes,
    tahmin: {
      kutleTahmini: true,
      arayuzTahmini: true,
      toplamKg: Number(parts.reduce((s, p) => s + p.massKg, 0).toFixed(2)),
      olceklendi: Boolean(massKg),
      gabari,
      not: massKg
        ? `Toplam ${massKg} kg beyan edildi; parça kütleleri bu toplama ölçeklendi (çarpan ${olcek.toFixed(4)}).`
        : 'Hiçbir kütle beyan edilmedi; bütün kütleler hacimden tahmindir ve mutlak değeri anlamlı DEĞİLDİR — yalnız oranları kabaca doğrudur.',
    },
  };
}

/**
 * craft_blocks araçları için ince sarmalayıcı: rig eklemlerini adım
 * numarasına çevirir, böylece "sırayla montaj" oynatımı eklem ağacını
 * izler.
 */
export function assemblyFromCraft(THREE, root, opts = {}) {
  const sonuc = assemblyFromScene(THREE, root, opts);
  const rig = root.userData?.rig;
  if (!rig || !rig.joints) return sonuc;
  const eklemAdlari = new Set(Object.values(rig.joints).map(j => j.node));
  for (const p of sonuc.parts) {
    const ham = p.id.split('#')[0];
    if (eklemAdlari.has(ham)) {
      p.group = 'hareketli';
      /* Eklemli parça en sonda takılır: hareketli bir bağlantı, sabit
         yapının üstüne oturur. */
      p.step = (p.step ?? 1) + 1;
    }
  }
  sonuc.tahmin.eklemSayisi = eklemAdlari.size;
  return sonuc;
}
