// craft-effects.mjs — Motor ateşleme efekt sistemi (craft-blocks yol arkadaşı).
//
// DONMUŞ API:
//   buildEngineFX({ scale = 1, tip = 'vakum', seed = 1, palette } = {})
//     → { group, update(dt, { gaz, atesle }), dispose() }
//   (setPalette(palette) EK bir kolaylıktır — donmuş üçlü aynen korunur;
//    dış tüketiciler varlığını `fx.setPalette?.(p)` ile yoklamalıdır.)
//
//   • group: THREE.Group — orijin MOTOR AĞZINDA, alev −X yönünde uzar
//     (craft-blocks eksen sözleşmesiyle aynı: −X = egzoz).
//   • update(dt, { gaz, atesle, zeminMesafe }): her karede çağrılır. gaz 0..1.
//     atesle false→true geçişinde ateşleme geçici rejimi (flaş + halka +
//     kıvılcım + basınçlanma aşımı), true→false geçişinde ~0.5 sn sönüm kuyruğu.
//     zeminMesafe (OPSİYONEL, sahne birimi): motor ağzından çarpma düzlemine
//     uzaklık. Verilmezse 'hover' için plüm ucu (eski davranış), diğer
//     tiplerde zemin etkisi YOKTUR — mevcut çağrılar birebir korunur.
//   • dispose(): geometri / malzeme / doku / ışık temizliği.
//
//   tip: 'vakum'    — uzayda çok geniş açıyla genleşen, soluk ve SAYDAM plüm
//        'atmosfer' — dar huzme + eksen boyunca sönümlenen ŞOK HÜCRELERİ
//        'hover'    — iniş motoru: kısa huzme + zemin etkisi (radyal duvar jeti)
//
// ─── FİZİKSEL MODEL (stilize, akışkan çözücü DEĞİL) ───────────────────────
// Plüm, EŞ EKSENLİ İÇ İÇE KABUKLARDAN oluşan tek bir mesh'tir (tek çizim
// çağrısı). Her kabuk q = r/R(u) sabit oranında bir dönel yüzeydir; additive
// toplamları, eksene dik bir görüş ışını boyunca yoğunluk integralinin
// (Abel dönüşümünün) ayrıklaştırılmasıdır — merkezde kalın, kenarda ince
// optik yol kendiliğinden çıkar. Bu yüzden plüm HACİMLİ okunur, boyalı bir
// koni gibi değil.
//   • Kesme katmanı (shear layer): dış sınır düz koni yüzeyi DEĞİLDİR.
//     Yarıçap, seed'li periyodik değer gürültüsüyle bozulur; genlik aşağı
//     akışta büyür (smoothstep(0.02,0.42,u)) ve q² ile dış kabuklarda
//     yoğunlaşır — çekirdek (izentropik potansiyel koni) düzgün kalır.
//     Gürültü fazı zamanla AŞAĞI AKAR (advect): faz = u·kx − t·v.
//     Her kabuğun kendi faz kayması vardır → kabuklar iç içe geçer.
//   • Sıcaklık rampası: T(u,q) = T0·exp(−u/λ)·(1 − 0.40 q). Renk YALNIZ
//     sıcaklıktan türetilir (analitik siyah-cisim benzeri rampa); doku yok.
//     Boğazda beyaz-mavimsi → sarı → turuncu → uçta koyu kızıl ve saydam.
//   • Şok hücreleri (yalnız 'atmosfer'): aşırı/eksik genleşmiş huzmede
//     eksene dik şok cepheleri kenar→eksen→kenar salınır. Hücre yarıçapı
//     rf = |1 − 2p| (p = hücre içi faz) — bu, (u,q) düzleminde X çizer,
//     dönel süpürmede ELMAS/BAKLAVA kesit verir (küre DEĞİL). Aralık aşağı
//     akışta GENİŞLER (c = u/(1+0.85u) çarpıtması) ve genlik exp(−n·k) ile
//     SÖNÜMLENİR. Aralık gazla artar (L ≈ 1.3·D·√(Mj²−1); basınç oranı
//     yükseldikçe hücre uzar, sayısı azalır).
//   • Zemin etkisi ('hover' / zeminMesafe): plüm çarpma düzlemine yaklaşırken
//     yarıçap kabarır (durma bölgesi), sıcaklık yükselir; düzlemde radyal
//     DUVAR JETİ tabakası — dışa akan, hafifçe yükselen, ışınsal saçaklı disk.
//
// Deterministiktir: tüm rastgelelik seed'li (mulberry32 + GLSL hash), zaman
// yalnız update(dt) toplamından akar — Math.random / Date.now KULLANILMAZ.
// Alev diegetik ışıktır (motor gerçekten ışık kaynağıdır); veri
// işaretlerindeki sürekli-glow yasağı bu sahne efektine uygulanmaz. Parlaklık
// salınımı, epilepsi tetiklememek için ±%15 bandında tutulur.
//
// Craft-blocks malzemelerine DOKUNULMAZ: çan kızarması dahil her parça bu
// grubun kendi mesh'idir. Bütçe: 4 mesh (plüm / zemin jeti / halka / çan kor)
// + tek Points + tek Sprite + tek PointLight.

import * as THREE from 'three';
import { CRAFT_PALETTE } from './craft-blocks.mjs';

/* ------------------------------------------------------------------ */
/* Deterministik yardımcılar                                           */
/* ------------------------------------------------------------------ */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));

/* ------------------------------------------------------------------ */
/* Tip tabloları — boyutlar scale=1 için, mutlak sahne birimi          */
/* ------------------------------------------------------------------ */
// boy/agiz DEĞERLERİ DONDURULMUŞTUR: index.html'deki FX_BOYLAR askı hesabı ve
// lunar-descent'in motor ağzı yerleşimi bunlara dayanır.
//   cikis  : q=1 kabuğunun uçtaki yarıçapı (dış hale kabuğu ×1.32)
//   kavis  : R(u) = agiz + (cikis−agiz)·u^kavis   (<1 hızlı açılım, >1 geç)
//   opak   : kararlı yanmada zirve additive katkı ölçeği
//   sigma  : radyal emisyon genişliği σ(u) = sigma0 + sigmaU·u
//   parlaBoy: emisyon sönüm uzunluğu (u birimi) — plümün "yandığı" mesafe
//   kesme  : kesme katmanı gürültü genliği · kesmeHiz: advekte hızı
//   nAci/nEks: kesme katmanı burgaç sayısı (çevrede / eksende). Burgaç boyu
//     yerel katman kalınlığı mertebesindedir; bu yüzden GEOMETRİYE bağlıdır —
//     dar/uzun huzmede az açısal + çok eksenel, kısa/geniş huzmede tersi.
//     Tek bir sabit çift kullanılırsa geniş plümler yelpaze gibi kırışır
//     (7. tur kanıtı: vakumda radyal faset). nAci ÇİFT olmalı (oktav ×1.5).
//   sok    : şok hücresi şiddeti (0 = yok)
//   T0/sogu: sıcaklık rampası (boğaz sıcaklığı ve aşağı akış soğuma katsayısı)
const TIPLER = Object.freeze({
  // vakum: karşı basınç yok → boğazdan itibaren çok geniş açıyla genleşir,
  // yoğunluk hızla düşer; gerçek vakum plümü NEREDEYSE GÖRÜNMEZDİR.
  // Sunum için okunaklı ama saydam: arka plan dış zarftan geçer.
  vakum: {
    boy: 0.95, agiz: 0.100, cikis: 0.46, kavis: 0.55,
    opak: 0.085, sigma0: 0.66, sigmaU: 1.05, parlaBoy: 0.52,
    kesme: 0.13, kesmeHiz: 10.0, nAci: 12.0, nEks: 12.0, sok: 0.0,
    T0: 0.86, sogu: 2.20, isik: 1.0, isikX: 0.30, zemin: false,
  },
  // atmosfer: dış basınç huzmeyi sıkar → dar, geç açılan koni; eksende
  // periyodik şok hücreleri (mach elmasları).
  atmosfer: {
    boy: 1.35, agiz: 0.085, cikis: 0.150, kavis: 1.70,
    opak: 0.215, sigma0: 0.70, sigmaU: 0.40, parlaBoy: 0.95,
    sokKuv: 1.95,
    kesme: 0.30, kesmeHiz: 24.0, nAci: 6.0, nEks: 22.0, sok: 1.0,
    T0: 1.03, sogu: 1.55, isik: 1.15, isikX: 0.34, zemin: false,
  },
  // hover: iniş motoru; kısa/küt huzme + zemin etkisi (durma bölgesi kabarması
  // ve radyal duvar jeti).
  hover: {
    boy: 0.50, agiz: 0.115, cikis: 0.31, kavis: 0.85,
    opak: 0.200, sigma0: 0.74, sigmaU: 0.72, parlaBoy: 0.90,
    kesme: 0.18, kesmeHiz: 11.0, nAci: 14.0, nEks: 10.0, sok: 0.0,
    T0: 0.95, sogu: 1.70, isik: 1.3, isikX: 0.55,
    zemin: true, zeminYaricap: 1.15, zeminOp: 0.26,
  },
});

// İç içe kabuklar: [q, fazKayması, ağırlık, δ]. Ağırlık ≈ kabuk kalınlığı Δq
// (Abel toplamının ayrık ağırlığı); radyal profil σ(u) ile fragment'te gelir.
// δ = (Δq/2)/q — kabuğun BAĞIL yarı kalınlığı. Limb (kenar) katkısı bununla
// ANALİTİK olarak integre edilir; noktasal 1/|N·V| çekirdeği q=b'de ıraksar ve
// 7 ayrık kabukta kabuk başına bir parlak dikey çizgi bırakıyordu (4. tur kanıtı).
const KABUKLAR = Object.freeze([
  [0.09, 2.15, 0.62, 0.80],   // eksen kabuğu: şok hücrelerinin yığıldığı yer
  [0.24, 0.00, 1.00, 0.50],
  [0.45, 1.31, 1.00, 0.34],
  [0.65, 2.77, 0.96, 0.26],
  [0.84, 4.02, 0.92, 0.22],
  [1.00, 5.41, 0.86, 0.24],
  [1.32, 0.83, 0.70, 0.30],   // dış hale: sürüklenen/karışan sıcak gaz zarfı
]);

// Gürültü çözünürlüğü. Plüm EKRANDA uzun ve ince olduğu için gürültü de
// eksende çok daha yüksek frekanslı olmalıdır; aksi halde yapılar boydan boya
// uzayıp "lif demeti" gibi okunur (2. tur kanıtı). Açısal 3 → eksenel 13 taban
// En ince oktav açıda 12, eksende ~32 hücre; 4 örnek/hücre için ızgara buna
// göre seçilir. Altına inilirse gürültü örtüşür ve dikey lif bandı doğar.
const NU = 128;  // eksenel bölüm
const NV = 48;   // açısal bölüm

/* ------------------------------------------------------------------ */
/* Ateşleme zaman çizelgesi (saniye, ateşleme kenarından itibaren)     */
/* ------------------------------------------------------------------ */
// Ateşleme bir OLAY olarak okunmalı; dört evre ayrı ayrı görülebilir:
//   0 → ON_AKIM      ignitör ön-akımı: kıvılcım tacı + cılız torç, basınç yok
//   ON_AKIM          SERT FLAŞ: parlama + açılan basınç halkası + kıvılcım patlaması
//   ON_AKIM → ~0.35  plüm açılır (basınç yükselir, kısa aşım)
//   ~0.35 →          kararlı yanma (titreşim bandına oturur)
const ON_AKIM = 0.055;

/* ------------------------------------------------------------------ */
/* Ortak GLSL: periyodik değer gürültüsü + sıcaklık→renk rampası       */
/* ------------------------------------------------------------------ */
// Açısal eksen `per` periyoduyla SARILIR: dönel yüzeyde dikiş oluşmaz.
// GLSL güvenliği (webgl-scene-contract §3): pow tabanları daima ≥ 0,
// smoothstep kenarları asla eşit değil, negatif tabanlı kuvvet yok.
const GLSL_ORTAK = /* glsl */`
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  // x ekseni "per" tamsayı periyoduyla sarılan 2B değer gürültüsü (−1..1).
  float vnoise(vec2 p, float per) {
    vec2 i = floor(p), f = fract(p);
    vec2 w = f * f * (3.0 - 2.0 * f);
    float x0 = mod(i.x, per), x1 = mod(i.x + 1.0, per);
    float a = hash21(vec2(x0, i.y));
    float b = hash21(vec2(x1, i.y));
    float c = hash21(vec2(x0, i.y + 1.0));
    float d = hash21(vec2(x1, i.y + 1.0));
    return mix(mix(a, b, w.x), mix(c, d, w.x), w.y) * 2.0 - 1.0;
  }
  // Oktavlar burada TOPLANMAZ: her tüketici kendi oktav adımını açıkça yazar.
  // Kesme katmanında açısal ve eksenel adım FARKLIDIR (burgaçlar ortalama
  // akışla eksende uzar) ve en ince oktav, tüketicinin ızgara çözünürlüğüne
  // göre seçilir — genel amaçlı bir fbm() bu iki kısıtı birlikte tutamıyordu.
`;

// Sıcaklık → renk. Siyah-cisim benzeri; T=1 civarı beyaz-mavimsi boğaz,
// T≈0.5 sarı-turuncu gövde, T≈0.2 koyu kızıl uç. ACESFilmic altında ölçüldü:
// ara tonlar doygun kalsın diye yeşil kanal turuncu bölgede bastırılır.
const GLSL_SICAKLIK = /* glsl */`
  vec3 sicaklikRengi(float T) {
    T = clamp(T, 0.0, 1.25);
    vec3 c = vec3(0.0);
    c = mix(c, vec3(0.42, 0.030, 0.006), smoothstep(0.00, 0.12, T));
    c = mix(c, vec3(0.88, 0.105, 0.016), smoothstep(0.12, 0.27, T));
    c = mix(c, vec3(1.00, 0.280, 0.040), smoothstep(0.27, 0.45, T));
    c = mix(c, vec3(1.00, 0.580, 0.140), smoothstep(0.45, 0.63, T));
    c = mix(c, vec3(1.00, 0.900, 0.620), smoothstep(0.63, 0.85, T));
    c = mix(c, vec3(0.84, 0.920, 1.000), smoothstep(0.85, 1.12, T));
    return c;
  }
`;

/* ------------------------------------------------------------------ */
/* Doku üretimi (yalnız flaş/kıvılcım için tek radyal CanvasTexture)   */
/* ------------------------------------------------------------------ */

function rgba(renk, a) {
  const c = renk.isColor ? renk : new THREE.Color(renk);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
}

// Radyal parlama (ateşleme flaşı sprite'ı + kıvılcım noktaları).
// Plüm renk gradyanı ARTIK DOKUDAN GELMEZ — sıcaklıktan analitik türetilir.
function radyalDoku(merkezRenk) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, rgba(merkezRenk, 0.85));
  g.addColorStop(0.6, rgba(merkezRenk, 0.22));
  g.addColorStop(1.0, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ */
/* Plüm geometrisi: iç içe kabuklar, TEK BufferGeometry                */
/* ------------------------------------------------------------------ */
// position = (u, cosA, sinA) — gerçek konum vertex shader'da kurulur
//   (parametrik geometri, sözleşme §2: görünür geometri yeniden İNŞA EDİLMEZ,
//    her kare yalnız uniform'lar güncellenir).
// aKabuk  = (q, faz, agirlik, aciParam)  — aciParam 0..1, dikişte tam 1.0
function plumGeometrisi() {
  const K = KABUKLAR.length;
  const nu1 = NU + 1, nv1 = NV + 1;
  const vSay = K * nu1 * nv1;
  const poz = new Float32Array(vSay * 3);
  const kab = new Float32Array(vSay * 4);
  const kal = new Float32Array(vSay);
  const idx = new Uint32Array(K * NU * NV * 6);
  let vi = 0, ii = 0;
  for (let k = 0; k < K; k++) {
    const q = KABUKLAR[k][0], faz = KABUKLAR[k][1], w = KABUKLAR[k][2];
    const dK = KABUKLAR[k][3];
    const taban = k * nu1 * nv1;
    for (let i = 0; i <= NU; i++) {
      // Boğaza doğru sıklaştır: gradyanın en dik olduğu yer orası.
      const u = Math.pow(i / NU, 1.15);
      for (let j = 0; j <= NV; j++) {
        const p = j / NV;
        const a = p * Math.PI * 2;
        poz[vi * 3] = u; poz[vi * 3 + 1] = Math.cos(a); poz[vi * 3 + 2] = Math.sin(a);
        kab[vi * 4] = q; kab[vi * 4 + 1] = faz; kab[vi * 4 + 2] = w; kab[vi * 4 + 3] = p;
        kal[vi] = dK;
        vi++;
      }
    }
    for (let i = 0; i < NU; i++) {
      for (let j = 0; j < NV; j++) {
        const a = taban + i * nv1 + j;
        const b = a + nv1;
        idx[ii++] = a; idx[ii++] = b; idx[ii++] = a + 1;
        idx[ii++] = a + 1; idx[ii++] = b; idx[ii++] = b + 1;
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(poz, 3));
  geo.setAttribute('aKabuk', new THREE.BufferAttribute(kab, 4));
  geo.setAttribute('aKal', new THREE.BufferAttribute(kal, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  // Konum shader'da kurulduğu için otomatik sınır kutusu anlamsızdır.
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 8);
  return geo;
}

// Zemin duvar jeti diski: position = (r, cosA, sinA), aDisk = (aciParam, 0,0,0)
function jetGeometrisi(NR = 26, NA = 64) {
  const nr1 = NR + 1, na1 = NA + 1;
  const poz = new Float32Array(nr1 * na1 * 3);
  const dsk = new Float32Array(nr1 * na1);
  const idx = new Uint32Array(NR * NA * 6);
  let vi = 0, ii = 0;
  for (let i = 0; i <= NR; i++) {
    const r = i / NR;
    for (let j = 0; j <= NA; j++) {
      const p = j / NA, a = p * Math.PI * 2;
      poz[vi * 3] = r; poz[vi * 3 + 1] = Math.cos(a); poz[vi * 3 + 2] = Math.sin(a);
      dsk[vi] = p;
      vi++;
    }
  }
  for (let i = 0; i < NR; i++) {
    for (let j = 0; j < NA; j++) {
      const a = i * na1 + j, b = a + na1;
      idx[ii++] = a; idx[ii++] = b; idx[ii++] = a + 1;
      idx[ii++] = a + 1; idx[ii++] = b; idx[ii++] = b + 1;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(poz, 3));
  geo.setAttribute('aAci', new THREE.BufferAttribute(dsk, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 8);
  return geo;
}

/* ------------------------------------------------------------------ */
/* buildEngineFX                                                       */
/* ------------------------------------------------------------------ */

export function buildEngineFX({ scale = 1, tip = 'vakum', seed = 1, palette } = {}) {
  const T = TIPLER[tip] || TIPLER.vakum;
  const rng = mulberry32((seed | 0) || 1);
  const s = scale;

  // Renk ailesi. Plüm gövdesi ARTIK sıcaklıktan gelir; palet yalnız hafif bir
  // imza katar (uAccent) — ışık ve kıvılcım/flaş renkleri palete bağlı kalır.
  const sicak  = new THREE.Color();
  const isikRenk = new THREE.Color();
  const accentRenk = new THREE.Color();
  const korSoguk = new THREE.Color(0x8f1e08);                    // çan: derin kızıl
  const korSicak = new THREE.Color(0xffc27a);                    // çan: sarı-ak

  function renkleriKur(pal) {
    const p = { ...CRAFT_PALETTE, ...(pal || {}) };
    const accent = new THREE.Color(p.accent);
    accentRenk.copy(accent);
    sicak.set(0xfff0d2).lerp(accent, 0.20);
    isikRenk.set(0xffb46b).lerp(accent, 0.25);
  }
  renkleriKur(palette);

  const group = new THREE.Group();
  group.name = `craft-fx:${tip}`;
  group.userData = { preset: 'craft-effects', tip, seed };
  group.visible = false;

  const kaynaklar = [];                       // dispose listesi
  const iz = (x) => { if (x) kaynaklar.push(x); return x; };

  const seedOfs = rng() * 97.0 + (seed | 0) * 0.137;   // gürültü alanı kayması

  /* --- 1) Plüm: iç içe kabuklar, tek mesh, tek ShaderMaterial ------- */
  const plumUni = {
    uT:        { value: 0 },
    uBoy:      { value: T.boy * s },
    uAgiz:     { value: T.agiz * s },
    uCikis:    { value: T.cikis * s },
    uKavis:    { value: T.kavis },
    uKesme:    { value: T.kesme },
    uKesmeHiz: { value: T.kesmeHiz },
    uNAci:     { value: T.nAci },
    uNEks:     { value: T.nEks },
    uSeed:     { value: seedOfs },
    uOpak:     { value: 0 },
    uParla:    { value: 1 },
    uSigma0:   { value: T.sigma0 },
    uSigmaU:   { value: T.sigmaU },
    uParlaBoy: { value: T.parlaBoy },
    uT0:       { value: T.T0 },
    uSogu:     { value: T.sogu },
    uSok:      { value: T.sok },
    uSokLam:   { value: 0.12 },
    uSokSonum: { value: 0.19 },
    uSokKuv:   { value: T.sokKuv || 0.0 },
    uYol:      { value: 2.1 },
    uZeminU:   { value: 9.0 },     // ≥1.45 → zemin etkisi kapalı
    uZeminKab: { value: 0.0 },
    uAccent:   { value: accentRenk },
  };

  const plumMat = iz(new THREE.ShaderMaterial({
    uniforms: plumUni,
    vertexShader: /* glsl */`
      uniform float uT, uBoy, uAgiz, uCikis, uKavis;
      uniform float uKesme, uKesmeHiz, uSeed, uZeminU, uZeminKab, uNAci, uNEks;
      attribute vec4 aKabuk;
      attribute float aKal;
      varying float vU, vQ, vW, vTurb, vFacing, vKal;
      ${GLSL_ORTAK}
      void main() {
        float u = clamp(position.x, 0.0, 1.0);
        vec2 dir = position.yz;                 // birim radyal yön
        float q = aKabuk.x;

        // Ortalama huzme yarıçapı ve eğimi (türbülanssız → normal SAKİN kalır).
        float R  = uAgiz + (uCikis - uAgiz) * pow(u, uKavis);
        float Rp = (uCikis - uAgiz) * uKavis * pow(max(u, 0.004), uKavis - 1.0);
        Rp = clamp(Rp, -4.0, 4.0);

        // Kesme katmanı: aşağı akışta kalınlaşır, dış kabuklarda güçlüdür;
        // yapı alanı zamanla aşağı AKAR (u·kx − t·v).
        float ampl = uKesme * smoothstep(0.02, 0.42, u) * (0.18 + 0.82 * q * q);

        // Gürültü İKİ ölçekten kurulur:
        //  nO — büyük burgaçlar: kabuktan BAĞIMSIZ, tüm plümü BİRLİKTE savurur.
        //       Ortak olduğu için kabuklar birbirini KESMEZ; kesişen kabuklar
        //       moiré benzeri dikey "lif demeti" bandı üretiyordu (2. tur kanıtı).
        //  nK — kabuğa özgü ince yapı: küçük genlikli, katmanları ayrıştırır.
        // Burgaç frekansları tipe göre gelir (uNAci/uNEks); oktav açıda ×1.5,
        // eksende ×2 büyür — ince oktav açısal ızgaranın altına düşmesin.
        float ileri = uT * uKesmeHiz;
        float nO = 0.62 * vnoise(vec2(aKabuk.w * uNAci,
                                      u * uNEks - ileri + uSeed), uNAci)
                 + 0.38 * vnoise(vec2(aKabuk.w * uNAci * 1.5,
                                      u * uNEks * 2.0 - ileri * 2.0 + uSeed), uNAci * 1.5);
        // Kabuğa özgü ince yapı: katmanları ayrıştırır, genliği küçüktür.
        float nK = vnoise(vec2(aKabuk.w * uNAci * 2.0 + aKabuk.y,
                               u * uNEks * 3.0 - ileri * 3.0 + aKabuk.y * 3.1 + uSeed),
                          uNAci * 2.0);
        float n = nO + 0.22 * nK;

        float Rq = R * q * (1.0 + ampl * n);

        // Zemin etkisi: durma bölgesinde plüm yanlara kabarır.
        float g = smoothstep(uZeminU - 0.34, uZeminU + 0.03, u);
        Rq *= 1.0 + uZeminKab * g * g;

        vec3 pos = vec3(-u * uBoy, dir.x * Rq, dir.y * Rq);
        vec3 nrm = normalize(vec3(Rp * max(q, 0.05), uBoy * dir.x, uBoy * dir.y));

        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        vec3 N = normalize(normalMatrix * nrm);
        vec3 V = normalize(-mv.xyz);
        vFacing = abs(dot(N, V));
        vU = u; vQ = q; vW = aKabuk.z; vTurb = nO; vKal = aKal;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uOpak, uParla, uSigma0, uSigmaU, uParlaBoy, uT0, uSogu;
      uniform float uSok, uSokLam, uSokSonum, uSokKuv, uYol, uZeminU;
      uniform vec3 uAccent;
      varying float vU, vQ, vW, vTurb, vFacing, vKal;
      ${GLSL_SICAKLIK}
      void main() {
        float u = vU, q = vQ;

        // Radyal emisyon profili: karışım tabakası aşağı akışta genişler.
        float sig = uSigma0 + uSigmaU * u;
        float rho = exp(-(q * q) / (sig * sig));

        // Şok hücreleri — yalnız 'atmosfer'. Hücre içi faz p ile şok cephesi
        // yarıçapı rf = |1−2p| kenardan eksene ve geri salınır: (u,q)
        // düzleminde X, dönel süpürmede ELMAS kesit.
        float sok = 0.0;
        if (uSok > 0.001) {
          float c  = u / (1.0 + 0.85 * u);        // aralık aşağıda GENİŞLER
          float cn = c / uSokLam;                 // hücre indeksi (sürekli)
          float p  = fract(cn);
          float rf = abs(1.0 - 2.0 * p);
          float d  = q - rf;
          float elmas = exp(-(d * d) * 30.0);     // çapraz şok cepheleri (X kolları)
          // Parlak bölgenin RADYAL GENİŞLİĞİ hücre içinde şişip söner: p=0 ve
          // p=1'de eksende ince bir iplik, p=0.5'te huzme genişliğinde. Dönel
          // süpürmede bu, ELMAS/BAKLAVA siluetidir — sabit genişlik yalnız
          // yatay bant veriyordu (5. tur kanıtı).
          float genis = 0.11 + 1.00 * sin(3.14159265 * p);
          float eksen = exp(-(q * q) / (genis * genis)) * (0.30 + 0.70 * sin(3.14159265 * p));
          sok = (0.45 * elmas + 1.0 * eksen) * exp(-cn * uSokSonum) * uSok;
        }
        // Hücreler ORTALAMA ETRAFINDA ZITLIK yaratır (sadece parlaklık eklemez):
        // hücre dışı taban söner, hücre içi doyar → gerçek egzozdaki gibi
        // koyu huzme üstünde parlak elmas dizisi okunur.
        float sokMod = max(0.25, 1.0 + uSokKuv * (sok - 0.32));

        // Zemin çarpması: durma bölgesinde sıkışma → sıcaklık ve yoğunluk artar.
        // (uZeminU zemin yokken 9.0'dır → u≤1 aralığında cak kendiliğinden 0.)
        float cak = smoothstep(uZeminU - 0.26, uZeminU + 0.02, u);

        // Sıcaklık: boğazda en sıcak, aşağı akış ve radyal karışımla soğur.
        float Tk = uT0 * exp(-u * uSogu) * (1.0 - 0.40 * clamp(q, 0.0, 1.2));
        Tk += sok * 0.30 + cak * 0.16;
        Tk *= 1.0 + 0.11 * vTurb;

        vec3 col = sicaklikRengi(Tk);
        col = mix(col, col * uAccent * 1.35, 0.13);   // palet imzası (hafif)

        // Optik yol. Işının SONLU kalınlıktaki kabuktan geçtiği uzunluk,
        // ∫ q dq/√(q²−b²) kapalı formundan ANALİTİK olarak alınır:
        //   b = q·√(1−f²)  ⇒  q±² − b² = q²(f² ± 2δ + δ²)
        // Noktasal 1/|N·V| çekirdeği b=q'de ıraksar ve her kabuğun kenarına
        // birer parlak dikey çizgi basardı; bu form sınırlı ve düzgündür.
        float f2 = vFacing * vFacing;
        float dd = vKal;
        float A = sqrt(max(0.0, f2 + 2.0 * dd + dd * dd));
        float B = sqrt(max(0.0, f2 - 2.0 * dd + dd * dd));
        float yol = min(uYol, mix(1.0, (A - B) / (2.0 * dd), 0.70));

        // Eksenel sönüm: emisyon biter; u=1'de TAM sıfır (geometri ucu görünmez).
        float sonum = exp(-u / uParlaBoy) * (1.0 - smoothstep(0.70, 1.0, u));

        float yog = rho * sokMod * (1.0 + 0.45 * cak) * (1.0 + 0.16 * vTurb);
        float a = yog * yol * vW * sonum * uOpak * uParla;
        a = clamp(a, 0.0, 1.0);

        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, depthTest: true, side: THREE.DoubleSide,
  }));
  const plumGeo = iz(plumGeometrisi());
  const plum = new THREE.Mesh(plumGeo, plumMat);
  plum.userData.fx = true;
  plum.frustumCulled = false;
  plum.renderOrder = 9;
  group.add(plum);

  /* --- 2) Zemin duvar jeti ('hover' / zeminMesafe) ------------------- */
  // Çarpma düzleminde dışa akan tabaka: durma çekirdeği + ışınsal saçaklar,
  // dışa doğru hafifçe yükselir (duvar jeti ayrılması).
  let jet = null, jetMat = null;
  if (T.zemin) {
    jetMat = iz(new THREE.ShaderMaterial({
      uniforms: {
        uT: { value: 0 }, uYaricap: { value: T.zeminYaricap * s },
        uOpak: { value: 0 }, uParla: { value: 1 }, uSeed: { value: seedOfs },
        uAccent: { value: accentRenk },
      },
      vertexShader: /* glsl */`
        uniform float uYaricap;
        attribute float aAci;
        varying float vR, vA;
        void main() {
          float r = position.x;
          vR = r; vA = aAci;
          // Dışa doğru hafif yükselme: duvar jeti zeminden ayrılır.
          vec3 pos = vec3(r * r * 0.14 * uYaricap,
                          position.y * r * uYaricap,
                          position.z * r * uYaricap);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform float uT, uOpak, uParla, uSeed;
        uniform vec3 uAccent;
        varying float vR, vA;
        ${GLSL_ORTAK}
        ${GLSL_SICAKLIK}
        void main() {
          float r = vR;
          // Işınsal saçaklar DIŞA akar (r·k − t·v).
          // Saçaklar IŞINSAL olmalı: açısal frekans yüksek, radyal frekans
          // düşük → eş-değer eğrileri merkezden dışa uzanır. Karşılaştırılabilir
          // frekanslar çizik benzeri YAYLAR üretiyordu (7. tur kanıtı).
          float sac = 1.0 + 0.24 * (
              0.68 * vnoise(vec2(vA * 26.0, r * 2.2 - uT * 1.5 + uSeed), 26.0)
            + 0.32 * vnoise(vec2(vA * 52.0, r * 4.4 - uT * 3.0 + uSeed), 52.0));
          // r→0'da açısal koordinat tekil: saçak orada düzleşmezse merkezde
          // yıldız patlaması artefaktı doğar (8. tur kanıtı).
          sac = mix(1.0, sac, smoothstep(0.03, 0.32, r));
          float durma = exp(-(r * r) / 0.045);          // durma noktası çekirdeği
          float jet   = exp(-r * 2.4) * sac;            // radyal duvar jeti
          float kenar = 1.0 - smoothstep(0.80, 1.0, r); // dış kenar yumuşak biter
          float a = (0.85 * durma + 0.80 * jet) * kenar * uOpak * uParla;
          vec3 col = sicaklikRengi(0.66 * exp(-r * 1.7) + 0.06);
          col = mix(col, col * uAccent * 1.35, 0.13);
          gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, depthTest: true, side: THREE.DoubleSide,
    }));
    jet = new THREE.Mesh(iz(jetGeometrisi()), jetMat);
    jet.userData.fx = true;
    jet.frustumCulled = false;
    jet.visible = false;
    jet.renderOrder = 7;                       // plümün ALTINDA kalsın
    group.add(jet);
  }

  /* --- 3) Ateşleme geçici rejimi: flaş + halka + kıvılcım ----------- */
  let flasTex = radyalDoku(sicak);
  const flasMat = iz(new THREE.SpriteMaterial({
    map: flasTex, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  const flas = new THREE.Sprite(flasMat);
  flas.userData.fx = true;
  flas.position.x = -0.06 * s;
  flas.visible = false;
  flas.renderOrder = 13;
  group.add(flas);

  const halkaGeo = iz(new THREE.RingGeometry(0.72, 1, 40));
  halkaGeo.rotateY(Math.PI / 2);              // halka normali X eksenine
  const halkaMat = iz(new THREE.MeshBasicMaterial({
    color: sicak, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  const halka = new THREE.Mesh(halkaGeo, halkaMat);
  halka.userData.fx = true;
  halka.frustumCulled = false;
  halka.position.x = -0.04 * s;
  halka.visible = false;
  halka.renderOrder = 12;
  group.add(halka);

  // Kıvılcım patlaması: tek BufferGeometry + Points; yönler seed'li,
  // hareket yalnız mesh ölçeğiyle (öznitelik güncellemesi yok → ucuz).
  const KIV_N = 56;
  const kivPoz = new Float32Array(KIV_N * 3);
  for (let i = 0; i < KIV_N; i++) {
    const v = new THREE.Vector3(
      -(0.35 + rng() * 0.9),                  // −X yarıküresine eğimli
      (rng() * 2 - 1) * 0.75,
      (rng() * 2 - 1) * 0.75,
    ).normalize().multiplyScalar(0.45 + 0.55 * rng());
    kivPoz.set([v.x, v.y, v.z], i * 3);
  }
  const kivGeo = iz(new THREE.BufferGeometry());
  kivGeo.setAttribute('position', new THREE.BufferAttribute(kivPoz, 3));
  const kivMat = iz(new THREE.PointsMaterial({
    color: 0xffd9a6, size: 0.05 * s, sizeAttenuation: true,
    map: flasTex,                             // radyal doku: kare piksel değil yumuşak nokta
    transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  const kivilcim = new THREE.Points(kivGeo, kivMat);
  kivilcim.userData.fx = true;
  kivilcim.frustumCulled = false;
  kivilcim.visible = false;
  kivilcim.renderOrder = 12;
  group.add(kivilcim);

  /* --- 4) Çan kızarması: motor çanının iç ağzına oturan emissive koni */
  // craft-blocks malzemelerine dokunmaz; bu grup içinde ayrı mesh'tir.
  const korDerinlik = T.agiz * 0.9 * s;
  const korGeo = iz(new THREE.CylinderGeometry(
    T.agiz * 0.5 * s, T.agiz * 0.96 * s, korDerinlik, 20, 1, true));
  korGeo.rotateZ(-Math.PI / 2);               // dar uç +X'e (çanın boğazına doğru)
  // Ağız dudağından hafif taşar: kor, yandan bakışta da ince bir halka olarak okunur.
  korGeo.translate(korDerinlik / 2 - 0.014 * s, 0, 0);
  const korMat = iz(new THREE.MeshStandardMaterial({
    color: 0x0a0503, emissive: korSoguk.clone(), emissiveIntensity: 0,
    roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide,
  }));
  const canKor = new THREE.Mesh(korGeo, korMat);
  canKor.userData.fx = true;
  canKor.visible = false;
  group.add(canKor);

  /* --- 5) Işık: tek PointLight, alev rengi, decay 2 ------------------ */
  // Erim, huzme boyunun birkaç katı: zemine/araca DÜŞEN ışık okunmalı.
  const isik = new THREE.PointLight(isikRenk, 0, 16 * s, 2);
  isik.position.x = -T.isikX * T.boy * s;
  group.add(isik);

  /* ------------------------------------------------------------------ */
  /* Durum ve titreşim (12–30 Hz bandı, seed'li; parlaklık ±%15)         */
  /* ------------------------------------------------------------------ */

  let t = 0;                                  // yalnız update(dt) toplamı
  let basinc = 0;                             // düzgünleştirilmiş throttle
  let isi = 0;                                // çan ısısı (gecikmeli)
  let oncekiAtes = false;
  let igT = Infinity;                         // ateşlemeden bu yana geçen süre

  const f1 = 12 + rng() * 6;                  // 12–18 Hz
  const f2 = 22 + rng() * 8;                  // 22–30 Hz
  const faz1 = rng() * Math.PI * 2;
  const faz2 = rng() * Math.PI * 2;
  const gur = Array.from({ length: 64 }, () => rng() * 2 - 1);
  const gurultu = (x) => {                    // seed'li düzgün değer gürültüsü
    const i0 = Math.floor(x);
    const f = x - i0;
    const a = gur[((i0 % 64) + 64) % 64];
    const b = gur[(((i0 + 1) % 64) + 64) % 64];
    const u = f * f * (3 - 2 * f);
    return a + (b - a) * u;
  };

  function update(dt, durum = {}) {
    dt = Math.max(0, Math.min(dt || 0, 0.1));
    const gaz = clamp01(durum.gaz ?? 0);
    const ates = !!durum.atesle;
    t += dt;
    if (ates && !oncekiAtes) igT = 0;         // ateşleme kenarı
    oncekiAtes = ates;
    if (igT !== Infinity) igT += dt;

    // Basınç dinamiği: ön-akımda yalnız cılız torç, flaştan sonra hızlı basma
    // (~70 ms); sönümde ~0.5 sn görünür kuyruk.
    const onAkimda = ates && igT < ON_AKIM;
    const hedef = ates ? (onAkimda ? gaz * 0.05 : gaz) : 0;
    const tau = hedef > basinc ? 0.07 : 0.16;
    basinc += (hedef - basinc) * (1 - Math.exp(-dt / tau));

    // Ateşleme geçici rejimi: flaş ZARFI — tepe ON_AKIM ânında; öncesi keskin
    // yükseliş, sonrası sert düşüş + kısa kor kuyruğu (C0-sürekli, tepe 1.12).
    const dF = igT - ON_AKIM;
    const flasEnv = !ates || igT > 1.2 ? 0
      : dF < 0 ? 1.12 * Math.exp(-((dF / 0.028) ** 2))
               : 0.82 * Math.exp(-((dF / 0.055) ** 2)) + 0.30 * Math.exp(-dF / 0.19);
    // Basınçlanma aşımı: sıfırdan doğar (pop yok), ~40 ms sonra tepe yapar.
    const asim = ates && dF > 0 && dF < 0.6
      ? 0.34 * gaz * Math.exp(-dF / 0.13) * (1 - Math.exp(-dF / 0.03)) : 0;
    const pG = Math.min(basinc + asim, 1.25); // görsel basınç (aşım payıyla)
    const pN = Math.min(pG, 1);

    // Çan ısısı: yavaş ısınır (~0.9 sn), daha yavaş soğur (~2.4 sn).
    const isiHedef = ates ? gaz : 0;
    isi += (isiHedef - isi) * (1 - Math.exp(-dt / (isiHedef > isi ? 0.9 : 2.4)));

    // Titreşim: iki sinüs (12–30 Hz) + gürültü; parlaklık salınımı ±%15.
    // Plüm, zemin jeti ve ışık AYNI değeri kullanır → hepsi birlikte titrer.
    const flick =
      0.55 * Math.sin(2 * Math.PI * f1 * t + faz1) +
      0.30 * Math.sin(2 * Math.PI * f2 * t + faz2) +
      0.15 * gurultu(t * 9);
    const parla = 1 + 0.15 * Math.max(-1, Math.min(1, flick));

    const canli = pG > 0.004 || flasEnv > 0.004 || isi > 0.02;
    group.visible = canli;
    if (!canli) { isik.intensity = 0; return; }

    // Huzme ölçeği: gaz ile boy/çap, seed'li boy titremesi. Ölçek MESH'e
    // uygulanmaz (normaller bozulur) — uniform olarak shader'a girer.
    const boyF = (0.32 + 0.78 * pN) * (1 + 0.05 * gurultu(t * 7 + 17));
    const radF = 0.55 + 0.45 * pN;
    const boy = T.boy * s * boyF;

    plumUni.uT.value = t;
    plumUni.uBoy.value = boy;
    plumUni.uAgiz.value = T.agiz * s * radF;
    plumUni.uCikis.value = T.cikis * s * radF;
    plumUni.uParla.value = parla;
    // Ateşleme flaşı plümü de bir ân için doyurur.
    plumUni.uOpak.value = T.opak * pN + 0.35 * T.opak * flasEnv;
    plumUni.uKesme.value = T.kesme * (0.72 + 0.34 * pN);

    // Şok hücreleri: aralık gazla UZAR (basınç oranı ↑ → Mj ↑ → L ↑),
    // dolayısıyla görünen hücre SAYISI azalır.
    if (T.sok > 0) {
      const nHucre = 7.6 - 2.4 * pN;                  // c∈[0,0.541] üzerinde
      plumUni.uSokLam.value = 0.541 / Math.max(1.2, nHucre);
      plumUni.uSok.value = T.sok * (0.35 + 0.65 * pN);
    }

    // Zemin etkisi: mesafe verilmezse 'hover' plüm ucunu çarpma düzlemi sayar
    // (eski davranış), diğer tiplerde zemin etkisi yoktur.
    const zVar = Number.isFinite(durum.zeminMesafe);
    let zeminU = T.zemin ? 0.92 : 9.0;
    if (zVar) zeminU = Math.max(0.18, durum.zeminMesafe / Math.max(1e-4, boy));
    // Etki, zemin plüme göre uzaklaştıkça sıfıra RAMPALANIR (eşik yok).
    const zEtki = 1 - clamp01((zeminU - 0.95) / 0.50);
    plumUni.uZeminU.value = Math.min(zeminU, 9.0);
    plumUni.uZeminKab.value = 1.55 * zEtki;

    // Zemin duvar jeti (yalnız 'hover' mesh'i vardır).
    if (jet) {
      const ju = jetMat.uniforms;
      ju.uT.value = t;
      ju.uParla.value = parla;
      ju.uYaricap.value = T.zeminYaricap * s * (0.45 + 0.85 * pN)
                        * (1 + 0.04 * gurultu(t * 5 + 3));
      ju.uOpak.value = clamp01((T.zeminOp * pN + 0.30 * flasEnv) * zEtki);
      jet.position.x = -Math.min(zeminU, 1.45) * boy;
      jet.visible = ju.uOpak.value > 0.004;
    }

    // Ateşleme olayı: (a) ön-akım kıvılcım tacı, (b) sert flaş,
    // (c) açılan basınç halkası, (d) dışa patlayan kıvılcımlar.
    if (flasEnv > 0.004) {
      flas.visible = true;
      const acilim = 1 - Math.exp(-Math.max(0, igT) / 0.055);
      flas.scale.setScalar(s * (0.55 + 3.1 * acilim));
      flasMat.opacity = clamp01(1.15 * flasEnv);
    } else flas.visible = false;

    if (ates && dF > 0 && dF < 0.8) {          // halka yalnız flaştan SONRA
      halka.visible = true;
      halka.scale.setScalar(s * (0.16 + 3.2 * dF));
      halkaMat.opacity = 0.9 * Math.exp(-dF / 0.14);
    } else halka.visible = false;

    if (ates && igT < 0.85) {
      kivilcim.visible = true;
      // Ön-akımda ağızda kıpırdayan ufak taç; flaştan sonra dışa savrulma.
      const yay = onAkimda ? 0.10 + 0.55 * igT : 0.13 + 2.1 * dF;
      kivilcim.scale.setScalar(s * 1.9 * yay);
      kivMat.opacity = onAkimda
        ? 0.45 + 0.55 * (igT / ON_AKIM)
        : Math.exp(-dF / 0.26);
      kivMat.size = 0.055 * s * Math.max(0.18, 1 - igT * 1.1);
    } else kivilcim.visible = false;

    // Çan kızarması: ısıyla derin kızıldan sarı-aka; hafif titreşimli.
    canKor.visible = isi > 0.02 || pG > 0.02;
    korMat.emissive.copy(korSoguk).lerp(korSicak, clamp01(isi * 1.15));
    korMat.emissiveIntensity = 3.2 * isi * (1 + 0.1 * flick * Math.min(1, pN * 2));

    // Işık: gaz + titreşim + flaş; decay 2 ile makul mesafe sönümü.
    // Şiddet ölçekle DOĞRUSAL (s² değil): küçük motorlarda ışık yok olmasın —
    // ateşleme flaşı bir ân için ortamı gerçekten yıkasın.
    isik.position.x = -T.isikX * boy;
    isik.intensity = s * (T.isik * 5.4 * pN * parla + 34 * flasEnv);
  }

  // Palet değişiminde renk ailesini ve flaş dokusunu yerinde tazeler.
  // (Donmuş üçlünün dışında EK kolaylık; plüm geometrisi yeniden kurulmaz.)
  function setPalette(pal) {
    renkleriKur(pal);
    plumUni.uAccent.value.copy(accentRenk);
    if (jetMat) jetMat.uniforms.uAccent.value.copy(accentRenk);
    const eskiFlas = flasTex;
    flasTex = radyalDoku(sicak);
    for (const mat of [flasMat, kivMat]) if (mat) { mat.map = flasTex; mat.needsUpdate = true; }
    halkaMat.color.copy(sicak);
    isik.color.copy(isikRenk);
    if (eskiFlas) eskiFlas.dispose();
  }

  function dispose() {
    if (group.parent) group.parent.remove(group);
    for (const k of kaynaklar) if (k && k.dispose) k.dispose();
    if (flasTex) flasTex.dispose();
    isik.dispose();
  }

  return { group, update, dispose, setPalette };
}
