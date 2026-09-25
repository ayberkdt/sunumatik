/* astro-build.mjs — katalogdan GİYSİYİ kurar.
 *
 * Her gövde `astro-parts.mjs` satırındaki `sekil`, `size` ve `pos` ile
 * kurulur; burada tek bir ölçü elle yazılmaz. Eksen sözleşmesi depodaki
 * sözleşmenin aynısıdır: +X ileri (figürün baktığı yön), +Z yukarı, ve
 * çıplak silindir/koni/lathe kurucusu kullanılmaz.
 *
 * POZ. Bir astronot bir kutu değil: duruşu bir İŞ anlatır. `pozlar` içindeki
 * her poz, kalça/diz/omuz/dirsek açılarını derece cinsinden beyan eder ve
 * geometri o açılardan kurulur - böylece "eğilip alet alıyor" ile "panel
 * siliyor" arasındaki fark, elle taşınmış vertexler değil, okunabilir
 * sayılardır.
 */
import { PARTS, partById, BOY_M, OMUZ_M } from './astro-parts.mjs';
import { cylGeoX, cylGeoY, cylGeoZ } from '../core/geometry-axis.mjs';
import * as D from '../core/hardware-kit.mjs';

const TAU = Math.PI * 2;
const RAD = Math.PI / 180;

/* Giysi rengi bir boya işi değil: dış katman beyazdır çünkü güneşi geri
   yansıtmak zorundadır, mafsallar ve yataklar metaldir, vizör altındır. */
export function suitMaterials(THREE, tk = {}) {
  const std = (renk, kaba, metal) => new THREE.MeshStandardMaterial({
    color: renk, roughness: kaba, metalness: metal });
  return {
    kumas: std(tk.kumas ?? 0xe8e9ec, 0.86, 0.04),
    kumasGolge: std(tk.kumasGolge ?? 0xc8cbd2, 0.9, 0.04),
    sert: std(tk.sert ?? 0xdfe2e8, 0.42, 0.34),
    metal: std(tk.metal ?? 0x9aa2ae, 0.34, 0.86),
    koyu: std(tk.koyu ?? 0x3b4049, 0.6, 0.5),
    vizor: new THREE.MeshStandardMaterial({ color: 0xd8a94a, roughness: 0.08,
      metalness: 0.95, transparent: true, opacity: 0.82, side: THREE.DoubleSide }),
    cam: new THREE.MeshStandardMaterial({ color: 0x9fc4d8, roughness: 0.05,
      metalness: 0.1, transparent: true, opacity: 0.26, side: THREE.DoubleSide }),
    serit: std(tk.serit ?? 0xc23b3b, 0.7, 0.1),
    kit: D.hardwareMaterials(THREE, tk),
  };
}

/* Konvolüt mafsal: basınçlı bir giysinin bükülebilmesinin TEK yolu. Hacmi
   sabit tutan kıvrımlar olmadan bir tulum dik bir silindirdir ve diz
   bükülmez - bu yüzden burada süs değil, mafsalın kendisidir. */
function konvolut(THREE, M, r, boy, n = 4) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const z = (i / (n - 1) - 0.5) * boy;
    const k = new THREE.Mesh(new THREE.TorusGeometry(r * 1.06, r * 0.22, 6, 18), M.kumasGolge);
    k.position.z = z;
    g.add(k);
  }
  const ic = new THREE.Mesh(cylGeoZ(r, r, boy, 14), M.kumas);
  g.add(ic);
  return g;
}

/** Kilit halkası: iki basınçlı parçanın birleştiği yer, her zaman görünür. */
function kilitHalkasi(THREE, M, r) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TorusGeometry(r * 1.04, r * 0.11, 8, 22), M.metal));
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8;
    const t = new THREE.Mesh(new THREE.BoxGeometry(r * 0.12, r * 0.1, r * 0.2), M.koyu);
    t.position.set(Math.cos(a) * r * 1.04, Math.sin(a) * r * 1.04, 0);
    t.rotation.z = a;
    g.add(t);
  }
  return g;
}

/* ── pozlar ──────────────────────────────────────────────────────────
   Açı beyan edilir, vertex taşınmaz. Sayılar derece. */
export const POZLAR = Object.freeze({
  dik: { ad: 'Standing', kalca: [0, 0], diz: [0, 0], omuz: [0, 0], dirsek: [10, 10], govdeEgim: 0 },
  egilme: { ad: 'Crouched at a task', kalca: [-52, -52], diz: [66, 66], omuz: [-34, -34], dirsek: [58, 58], govdeEgim: 26 },
  uzanma: { ad: 'Reaching up to a panel', kalca: [0, 0], diz: [6, 6], omuz: [-104, -30], dirsek: [22, 14], govdeEgim: -6 },
  tasima: { ad: 'Carrying a load', kalca: [-8, -8], diz: [12, 12], omuz: [-48, -48], dirsek: [74, 74], govdeEgim: 8 },
  yuruyus: { ad: 'Walking', kalca: [-20, 18], diz: [24, 6], omuz: [16, -16], dirsek: [22, 26], govdeEgim: 4 },
});

function govde(THREE, p, M, poz) {
  const [sx, sy, sz] = p.size;
  const g = new THREE.Group();
  const ekle = (m) => { m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };

  switch (p.sekil) {
    case 'tulum': {
      /* Soğutma tulumu: giysinin altında kalır, yalnız boyundan ve
         bileklerden görünür. Boruları görünür çünkü ISIYI TAŞIYAN şey o. */
      const t = ekle(new THREE.Mesh(cylGeoZ(sx * 0.42, sx * 0.46, sz * 0.82, 16), M.koyu));
      for (let i = 0; i < 9; i++) {
        const hat = ekle(new THREE.Mesh(
          new THREE.TorusGeometry(sx * 0.43, sx * 0.022, 5, 20), M.serit));
        hat.position.z = (i / 8 - 0.5) * sz * 0.76;
      }
      void t;
      break;
    }
    case 'altGovde': {
      /* Kalça halkası, iki bacak, her birinde kalça ve diz konvolütü. */
      /* Kalca halkasi parcanin TEPESINDEDIR: alt govde yerden kalcaya
         kadar olan parcadir, merkezi degil. Halkayi merkeze koymak
         bacaklari 0,47 m asagi sarkitiyordu ve figur beyan edilen 1,95 m
         yerine 2,44 m cikiyordu. */
      const kalcaZ = sz * 0.46;
      /* Bel/kalca kabugu: alt govde yalniz bacaklardan ibaret degildir ve
         olmayinca altindaki sogutma tulumu disaridan gorunuyordu - giysinin
         en disinda kalan sey, tene giyilen katman oluyordu. */
      const bel = ekle(new THREE.Mesh(cylGeoZ(sx * 0.46, sx * 0.4, sz * 0.26, 18), M.kumas));
      bel.scale.y = sy / sx;
      bel.position.z = kalcaZ - sz * 0.1;
      const kemer = ekle(new THREE.Mesh(new THREE.TorusGeometry(sx * 0.45, sx * 0.05, 6, 24), M.kumasGolge));
      kemer.scale.y = sy / sx;
      kemer.position.z = kalcaZ - sz * 0.19;
      g.add(kilitHalkasi(THREE, M, sx * 0.48)).position.z = kalcaZ;
      const bacakR = sx * 0.17, bacakBoy = sz * 0.40;
      /* Dizi zaten [indeks, yan] ciftleri tasiyor; ustune `.entries()`
         koymak `yan`'i bir DIZI yapiyordu ve bacak konumlari NaN'a
         donuyordu - olculen: alt govde yalnizca 0,048 m yer kapliyor,
         yani kalca halkasi disinda hicbir sey cizilmiyordu. */
      for (const [i, yan] of [[0, -1], [1, 1]]) {
        const kalca = new THREE.Group();
        kalca.position.set(0, yan * sx * 0.22, kalcaZ - sz * 0.04);
        kalca.rotation.y = (poz?.kalca?.[i] ?? 0) * RAD;
        g.add(kalca);
        const ust = konvolut(THREE, M, bacakR, bacakBoy, 4);
        ust.position.z = -bacakBoy / 2;
        kalca.add(ust);
        const diz = new THREE.Group();
        diz.position.z = -bacakBoy;
        diz.rotation.y = (poz?.diz?.[i] ?? 0) * RAD;
        kalca.add(diz);
        const alt = konvolut(THREE, M, bacakR * 0.92, bacakBoy, 3);
        alt.position.z = -bacakBoy / 2;
        diz.add(alt);
        /* Diz kapağı: konvolütü koruyan sert plaka. */
        const kapak = new THREE.Mesh(
          new THREE.BoxGeometry(bacakR * 1.5, bacakR * 1.5, bacakR * 0.5), M.sert);
        kapak.position.set(bacakR * 0.85, 0, 0);
        diz.add(kapak);
        diz.userData.ayakUcu = -bacakBoy;
        /* Mafsal DISA acilir: cizme diz grubuna baglanacak, yoksa bacak
           bukulur ama ayak havada asili kalir - olculen: comelmede boy
           1,95'ten yalniz 1,89'a iniyordu. */
        (g.userData.diz ??= []).push(diz);
      }
      break;
    }
    case 'cizme': {
      const c = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx, sy * 0.78, sz * 0.62), M.kumasGolge));
      c.position.z = sz * 0.1;
      const taban = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx * 1.1, sy, sz * 0.22), M.koyu));
      taban.position.z = -sz * 0.34;
      /* Taban deseni: tozda tutunmanın tek yolu. */
      for (let i = 0; i < 5; i++) {
        const d = ekle(new THREE.Mesh(
          new THREE.BoxGeometry(sx * 1.05, sy * 0.1, sz * 0.06), M.metal));
        d.position.set(0, (i / 4 - 0.5) * sy * 0.8, -sz * 0.44);
      }
      g.add(kilitHalkasi(THREE, M, sx * 0.4)).position.z = sz * 0.42;
      break;
    }
    case 'ustGovde': {
      /* Sert kabuk: omuzlarda geniş, belde dar. Dört yatak buraya oturur. */
      const kabuk = ekle(new THREE.Mesh(cylGeoZ(sx * 0.5, sx * 0.42, sz * 0.86, 20), M.sert));
      kabuk.scale.y = sy / sx;
      const omuzKir = ekle(new THREE.Mesh(cylGeoY(sx * 0.46, sx * 0.46, OMUZ_M * 0.42, 16), M.sert));
      omuzKir.position.z = sz * 0.3;
      omuzKir.scale.z = 0.62;
      g.add(kilitHalkasi(THREE, M, sx * 0.42)).position.z = -sz * 0.45;
      g.add(kilitHalkasi(THREE, M, sx * 0.28)).position.z = sz * 0.46;
      /* Göğüs şeridi: mürettebatı uzaktan ayırt eden şey. */
      const serit = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx * 0.16, sy * 1.02, sz * 0.5), M.serit));
      serit.position.set(sx * 0.3, 0, 0);
      break;
    }
    case 'yatak': {
      g.add(kilitHalkasi(THREE, M, sx * 0.44));
      const y = ekle(new THREE.Mesh(cylGeoY(sx * 0.42, sx * 0.42, sy * 0.7, 16), M.metal));
      void y;
      break;
    }
    case 'kol': {
      /* Üst kol, dirsek konvolütü, ön kol ve bilek yatağı. */
      const r = sx * 0.42, yari = sz * 0.44;
      const ust = konvolut(THREE, M, r, yari, 3);
      ust.position.z = -yari / 2;
      g.add(ust);
      const dirsek = new THREE.Group();
      dirsek.position.z = -yari;
      dirsek.rotation.y = (poz?.dirsek?.[0] ?? 12) * RAD;
      g.add(dirsek);
      const on = konvolut(THREE, M, r * 0.88, yari, 3);
      on.position.z = -yari / 2;
      dirsek.add(on);
      const bilek = kilitHalkasi(THREE, M, r * 0.8);
      bilek.position.z = -yari;
      dirsek.add(bilek);
      /* Eldiven bilege baglanir: kol bukulunce el de gider. */
      g.userData.bilek = dirsek;
      g.userData.bilekZ = -yari;
      break;
    }
    case 'eldiven': {
      const el = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx * 0.9, sy, sz * 0.52), M.kumasGolge));
      el.position.z = -sz * 0.1;
      /* Parmaklar: dördü bitişik, başparmak ayrı - kavrama böyle okunur. */
      for (let i = 0; i < 4; i++) {
        const pr = ekle(new THREE.Mesh(
          new THREE.BoxGeometry(sx * 0.2, sy * 0.19, sz * 0.3), M.kumas));
        pr.position.set(sx * 0.12, (i / 3 - 0.5) * sy * 0.66, -sz * 0.4);
        pr.rotation.y = 0.5;
      }
      const bas = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx * 0.22, sy * 0.2, sz * 0.24), M.kumas));
      bas.position.set(sx * 0.2, -sy * 0.42, -sz * 0.18);
      bas.rotation.x = -0.5;
      g.add(kilitHalkasi(THREE, M, sx * 0.4)).position.z = sz * 0.36;
      break;
    }
    case 'paket': {
      const kutu = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz * 0.9), M.sert));
      kutu.position.z = 0;
      /* Üst kapak, alt havalandırma ve yan tutamaklar. */
      const kapak = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx * 1.02, sy * 1.04, sz * 0.08), M.koyu));
      kapak.position.z = sz * 0.46;
      for (const ex of [-1, 1]) {
        const tut = ekle(new THREE.Mesh(cylGeoZ(sx * 0.03, sx * 0.03, sz * 0.4, 8), M.metal));
        tut.position.set(ex * sx * 0.46, -sy * 0.3, 0);
      }
      /* Yüceltici: ısının gittiği yer, dışarıdan görünür bir levha. */
      const yuc = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx * 0.5, sy * 0.1, sz * 0.3), M.metal));
      yuc.position.set(0, -sy * 0.52, sz * 0.1);
      for (let i = 0; i < 4; i++) {
        const kan = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx * 0.46, sy * 0.02, sz * 0.03), M.koyu));
        kan.position.set(0, -sy * 0.58, sz * (0.22 - i * 0.07));
      }
      const lv = D.levha(THREE, M.kit, [p.tech?.no || p.id, 'LIFE SUPPORT'],
        { w: sx * 0.6, h: sz * 0.14 });
      lv.position.set(0, -sy * 0.52, -sz * 0.28);
      lv.rotation.x = Math.PI / 2;
      g.add(lv);
      break;
    }
    case 'kutu': {
      ekle(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), M.koyu));
      for (const ex of [-1, 1]) {
        const sise = ekle(new THREE.Mesh(cylGeoZ(sz * 0.36, sz * 0.36, sx * 0.44, 12), M.metal));
        sise.position.set(ex * sx * 0.26, 0, 0);
        sise.rotation.y = Math.PI / 2;
      }
      break;
    }
    case 'kask': {
      /* Kabarcık kask: baş içeride DÖNER, kask dönmez. */
      const kab = ekle(new THREE.Mesh(new THREE.SphereGeometry(sx * 0.5, 26, 18), M.cam));
      /* Altın vizör: morötesini ve ısıyı kesen şey, yarı indirilmiş. */
      const viz = ekle(new THREE.Mesh(
        new THREE.SphereGeometry(sx * 0.53, 26, 14, -0.9, 1.8, 0, Math.PI * 0.42), M.vizor));
      viz.rotation.x = Math.PI / 2;
      viz.rotation.z = -Math.PI / 2;
      g.add(kilitHalkasi(THREE, M, sx * 0.34)).position.z = -sz * 0.46;
      void kab;
      break;
    }
    case 'lamba': {
      const boyunduruk = ekle(new THREE.Mesh(cylGeoY(sx * 0.03, sx * 0.03, sy * 1.5, 8), M.metal));
      boyunduruk.position.z = 0;
      /* Dört baş: gölge vakumda mutlak siyahtır ve tek kaynak kendi elini
         gölgeler. */
      for (let i = 0; i < 4; i++) {
        const x = (i / 3 - 0.5) * sx * 0.8;
        const lm = ekle(new THREE.Mesh(cylGeoX(sz * 0.3, sz * 0.34, sz * 0.5, 10), M.koyu));
        lm.position.set(x, sy * 0.2, 0);
        const cam = ekle(new THREE.Mesh(cylGeoX(sz * 0.26, sz * 0.26, sz * 0.06, 10), M.kit.white));
        cam.position.set(x, sy * 0.45, 0);
      }
      const kam = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx * 0.12, sy * 0.4, sz * 0.5), M.koyu));
      kam.position.set(0, sy * 0.1, sz * 0.3);
      break;
    }
    case 'panel': {
      const pn = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), M.koyu));
      const ekran = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx * 0.5, sy * 0.1, sz * 0.4), M.kit.white));
      ekran.position.set(-sx * 0.2, sy * 0.52, sz * 0.15);
      /* Anahtarlar eldivenle çevrilecek kadar büyük ve birbirinden ayırt
         edilecek kadar farklı. */
      for (let i = 0; i < 4; i++) {
        const a = ekle(new THREE.Mesh(cylGeoY(sz * 0.14, sz * 0.14, sy * 0.3, 8),
          i % 2 ? M.metal : M.serit));
        a.position.set(sx * (i / 3 - 0.5) * 0.62, sy * 0.5, -sz * 0.22);
      }
      void pn;
      break;
    }
    case 'halat': {
      /* Makara, karabina ve alet halkaları. Bağlanmamış alet, EVA'yı tek
         başına bitiren şeydir. */
      const mak = ekle(new THREE.Mesh(cylGeoY(sz * 0.4, sz * 0.4, sy * 0.6, 14), M.koyu));
      const kanca = ekle(new THREE.Mesh(new THREE.TorusGeometry(sz * 0.2, sz * 0.05, 6, 14), M.metal));
      kanca.position.set(sx * 0.3, sy * 0.3, -sz * 0.2);
      for (let i = 0; i < 3; i++) {
        const halka = ekle(new THREE.Mesh(new THREE.TorusGeometry(sz * 0.14, sz * 0.035, 6, 12), M.metal));
        halka.position.set((i / 2 - 0.5) * sx * 0.7, sy * 0.2, -sz * 0.34);
        halka.rotation.x = Math.PI / 2;
      }
      void mak;
      break;
    }
    default:
      ekle(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), M.kumas));
  }
  return g;
}

/**
 * Giysiyi kurar.
 * @param opts.poz  POZLAR anahtarı ya da poz nesnesi
 * @param opts.seritRenk  göğüs şeridi rengi — iki mürettebat böyle ayrılır
 */
export function buildAstronaut(THREE, { tokens = {}, poz = 'dik', seritRenk = null } = {}) {
  const P = typeof poz === 'string' ? (POZLAR[poz] ?? POZLAR.dik) : poz;
  const M = suitMaterials(THREE, tokens);
  if (seritRenk !== null) M.serit = new THREE.MeshStandardMaterial({
    color: seritRenk, roughness: 0.7, metalness: 0.1 });

  const kok = new THREE.Group();
  /* Gövde eğimi belden: bir insan eğilirken bacakları yerinde kalır. */
  const bel = new THREE.Group();
  bel.position.z = 0.9;
  bel.rotation.y = P.govdeEgim * RAD;
  const nodes = new Map();

  for (const p of PARTS) {
    const n = p.qty ?? 1;
    const yerler = n === 2
      ? [[p.pos[0], -Math.abs(p.pos[0]) === 0 ? p.pos[1] : p.pos[1], p.pos[2]],
        [p.pos[0], p.pos[1], p.pos[2]]]
      : [p.pos];
    /* qty 2 olan parçalar SOL ve SAĞ olarak aynalanır; hangi tarafta
       olduğunu `pos`'un x'i değil, aynalama belirler. */
    const kopyalar = n === 2 ? [-1, 1] : [0];
    kopyalar.forEach((yan, i) => {
      void yerler;
      const gg = govde(THREE, p, M, P);
      const x = p.pos[0], y = p.pos[1], z = p.pos[2];
      gg.name = n === 2 ? `${p.id}#${i + 1}` : p.id;
      gg.userData.part = p;
      gg.userData.partId = p.id;

      /* İSKELETE BAĞLAMA. Bir parçayı mutlak konuma koymak onu manken
         yapar: bacak bükülür, ayak havada kalır. Her parça, hareketini
         takip etmesi gereken MAFSALA bağlanır. */
      const dizler = nodes.get('alt-govde')?.userData.diz;
      const kolG = i === 0 ? nodes.get('kollar') : nodes.get('kollar#2') ?? nodes.get('kollar');
      if (p.id === 'cizmeler' && dizler && dizler[i]) {
        gg.position.set(x, 0, (dizler[i].userData.ayakUcu ?? 0) + 0.02);
        dizler[i].add(gg);
      } else if (p.id === 'eldivenler' && kolG?.userData.bilek) {
        gg.position.set(0, 0, kolG.userData.bilekZ - 0.1);
        kolG.userData.bilek.add(gg);
      } else if (p.id === 'kollar') {
        /* Kol omuzdan döner; omuz açısı poza aittir. */
        const omuz = new THREE.Group();
        omuz.position.set(0, yan * Math.abs(p.pos[0]) * 0.9, 1.44 - 0.9);
        omuz.rotation.y = (P.omuz?.[i] ?? 0) * RAD;
        bel.add(omuz);
        gg.position.set(0, 0, 0);
        omuz.add(gg);
      } else {
        if (n === 2) gg.position.set(yan * Math.abs(x), y, z);
        else gg.position.set(x, y, z);
        const anne = z > 0.9 ? bel : kok;
        if (anne === bel) gg.position.z = z - 0.9;
        anne.add(gg);
      }
      nodes.set(i === 0 ? p.id : `${p.id}#${i + 1}`, gg);
    });
  }
  kok.add(bel);
  /* AYAKLAR YERE OTURUR. Hangi pozda hangi noktanin en alta dustugu poza
     baglidir; sabit bir ofset yazmak, comelmis bir figuru havada birakir.
     Olculur ve koke o kadar kaydirilir - bu, figuru bir yuzeye koymanin
     dogru yoludur ve her poz icin kendiliginden dogru calisir. */
  kok.updateMatrixWorld(true);
  {
    const kutu = new THREE.Box3();
    const v = new THREE.Vector3();
    let enAlt = Infinity;
    kok.traverse((o) => {
      if (!o.isMesh || !o.geometry?.attributes?.position) return;
      const a = o.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) {
        v.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld);
        if (v.z < enAlt) enAlt = v.z;
      }
    });
    if (Number.isFinite(enAlt)) kok.position.z -= enAlt;
    void kutu;
  }
  kok.userData.notes = { regime: 'yüzey EVA',
    why: `Giysili boy ${BOY_M} m, omuz ${OMUZ_M} m: habitat kapısı ve tutamak aralıkları bu ölçüye göre belirlenir, çıplak insana göre değil.` };
  kok.userData.poz = P;
  return { root: kok, bel, nodes, materials: M, poz: P };
}

export { PARTS, partById };
