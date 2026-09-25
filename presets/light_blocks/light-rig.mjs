/* light-rig.mjs — SAHNENİN IŞIK DİLİ (tek yer).
 * docs/light-physics-plan.md §5 ve §6.
 *
 * Bugüne kadar her preset kendi ışığını gözle kuruyordu: "DirectionalLight
 * 3.0 + Ambient 0.34 + Hemisphere 0.5". Bu sayıların hiçbirinin fiziksel
 * karşılığı yok ve iki sahne yan yana konunca birbirini tutmuyor.
 *
 * Rig üç şeyi birden yapar:
 *
 *   1. GÜNEŞ gerçek aydınlatmasıyla kurulur (Ay yüzeyinde 127 000 lux,
 *      Mars 55 000, Dünya 100 000) ve rengi blackbodyRGB(5772) ile gelir.
 *   2. DOLGU HESAPLANIR, seçilmez. AmbientLight YOKTUR — fiziksel
 *      karşılığı yoktur. Yerine iki gerçek kaynak: regolit sıçraması
 *      (E·ρ/π ile yatay yüzeylerin birbirini beslemesi) ve Ay'da
 *      DÜNYA IŞIĞI (~12 lux, dolunayın ~50 katı). Mars'ta gök kubbe
 *      kendisi bir kaynaktır (tereyağı rengi, 4200 lux).
 *   3. POZLAMA sahneden çıkar: EV100 → toneMappingExposure. Kokpitten
 *      yüzeye çıkınca göz uyum sağlar (ışığa hızlı, karanlığa yavaş) ve
 *      bu süre İLAN EDİLİR.
 *
 * Vakumda HUZME YOKTUR. Rig bunu kendisi bilmez; `light-math.envAllows`
 * bilir ve `addBeam` reddeder.
 */

import {
  ENVIRONMENTS, blackbodyRGB, envAllows, exposureForLux, ev100, adaptEV,
  luminanceFromLux, illuminanceAt, CONST,
} from '../core/light-math.mjs';
import { cylGeoY } from '../core/geometry-axis.mjs';

const DEG = Math.PI / 180;
const rgbHex = ([r, g, b]) => (Math.round(Math.max(0, Math.min(1, r)) * 255) << 16)
  | (Math.round(Math.max(0, Math.min(1, g)) * 255) << 8)
  | Math.round(Math.max(0, Math.min(1, b)) * 255);

/** Regolit sıçraması: yatay yüzeyler birbirini besler — E·ρ/π. */
export function bounceLux(sunLux, albedo, sunElevDeg) {
  return sunLux * albedo * Math.sin(Math.max(0, sunElevDeg) * DEG) / Math.PI;
}

/**
 * Sahne ışığını kurar.
 *
 * env: 'vacuum' | 'mars' | 'earth' | 'interior'
 * sun: { elevDeg, azDeg, lux? } — lux verilmezse ortamın değeri
 * surface: { albedo } — regolit 0,12 (Ay mare), Mars 0,25
 * earthshine: Ay'da Dünya gökteyse yönü ve lux'u
 */
export function createLightRig(THREE, scene, {
  env = 'vacuum', sun = {}, surface = {}, earthshine = null,
  exposure = {}, shadows = {},
} = {}) {
  const E = ENVIRONMENTS[env];
  if (!E) throw new Error(`light-rig: bilinmeyen ortam '${env}'`);
  const elevDeg = sun.elevDeg ?? 14;
  const azDeg = sun.azDeg ?? 40;
  const sunLux = sun.lux ?? E.sunLux;
  const albedo = surface.albedo ?? (env === 'mars' ? 0.25 : 0.12);

  const group = new THREE.Group();
  group.name = 'light-rig';
  scene.add(group);

  /* ── GÜNEŞ ─────────────────────────────────────────────────────────
     three r155+ ışık şiddetleri fizikseldir: yönlü ışık LUX okur. */
  const sunColor = blackbodyRGB(5772, { normalize: 'white' });
  /* Güneş ufkun altındaysa doğrudan aydınlatma SIFIRDIR. Gece, ışığı
     kısmak değil KAYNAĞI KALDIRMAKTIR; kalan her şey (gök, sıçrama,
     Dünya ışığı, lambalar) olduğu gibi durur ve sahneyi onlar taşır. */
  const gunesCarpani = Math.max(0, Math.sin(elevDeg * DEG));
  const sunLight = new THREE.DirectionalLight(rgbHex(sunColor), sunLux * (gunesCarpani > 0 ? 1 : 0));
  const r = 60;
  const el = elevDeg * DEG, az = azDeg * DEG;
  sunLight.position.set(Math.cos(el) * Math.cos(az) * r, Math.sin(el) * r, Math.cos(el) * Math.sin(az) * r);
  sunLight.castShadow = shadows.enabled !== false;
  if (sunLight.castShadow) {
    const yari = shadows.extent ?? 40;
    sunLight.shadow.mapSize.set(shadows.mapSize ?? 2048, shadows.mapSize ?? 2048);
    const c = sunLight.shadow.camera;
    c.left = -yari; c.right = yari; c.top = yari; c.bottom = -yari;
    c.near = 1; c.far = r * 2 + yari;
    /* Güneş'in açısal çapı 0,53°: gölge kenarı YAKINDA sert, uzakta yumuşar.
       Tek haritada bunu taklit eden yarıçap mesafeyle büyümeli. */
    sunLight.shadow.radius = shadows.radius ?? 1.5;
    sunLight.shadow.bias = -0.0004;
    c.updateProjectionMatrix();
  }
  group.add(sunLight, sunLight.target);

  /* ── DOLGU: hesaplanır ─────────────────────────────────────────────
     AmbientLight yok. Gök kanalı ortamın gök ışığı, zemin kanalı regolit
     sıçraması. Vakumda gök SIFIRDIR; sahne tamamen karanlık olmaz çünkü
     sıçrama ve Dünya ışığı vardır. */
  const sicrama = bounceLux(sunLux, albedo, Math.max(0, elevDeg));
  const gokLux = E.skyLux;
  const gokRenk = env === 'mars' ? [1.0, 0.82, 0.62]          // tereyağı gökyüzü
    : env === 'earth' ? [0.55, 0.68, 1.0]                      // Rayleigh mavisi
      : [0.06, 0.07, 0.09];                                    // uzay karası (renk taşımaz)
  const zeminRenk = env === 'mars' ? [0.86, 0.62, 0.45] : [0.62, 0.60, 0.56];
  const hemi = new THREE.HemisphereLight(rgbHex(gokRenk), rgbHex(zeminRenk), (gunesCarpani > 0 ? gokLux : gokLux * 0.002) + sicrama);
  group.add(hemi);

  /* ── DÜNYA IŞIĞI (yalnız Ay) ───────────────────────────────────────
     Ay'ın yakın yüzünde Dünya ~12 lux verir: dolunayın ~50 katı, Güneş'in
     ~10⁻⁴'ü. Mavi-beyaz (Dünya albedosu + Rayleigh). Yönü GEOMETRİKTİR:
     Dünya gökte neredeyse ışık oradan gelir. */
  let earthLight = null;
  if (env === 'vacuum' && earthshine) {
    const lux = earthshine.lux ?? 12;
    earthLight = new THREE.DirectionalLight(rgbHex([0.72, 0.80, 1.0]), lux);
    const eel = (earthshine.elevDeg ?? 35) * DEG, eaz = (earthshine.azDeg ?? 200) * DEG;
    earthLight.position.set(Math.cos(eel) * Math.cos(eaz) * r, Math.sin(eel) * r, Math.cos(eel) * Math.sin(eaz) * r);
    group.add(earthLight, earthLight.target);
  }

  /* ── POZLAMA ───────────────────────────────────────────────────────
     Ortalama aydınlatma sahneden bilinir; okuma (readback) yapılmaz —
     pahalı ve deterministik değil. */
  const hedefAlbedo = exposure.albedo ?? CONST.GRAY_CARD;
  /* Sahnenin ortalama aydınlatması: doğrudan Güneş (ufkun altındaysa yok)
     + gök + sıçrama + Dünya ışığı. Gece bu toplam binde bire iner ve
     pozlama onu izler. */
  const sahneLux = () => sunLux * gunesCarpani + (gunesCarpani > 0 ? gokLux : gokLux * 0.002)
    + sicrama + (earthshine ? (earthshine.lux ?? 12) : 0);
  let evHedef = ev100(luminanceFromLux(sahneLux(), hedefAlbedo));
  let evSimdi = exposure.startEV ?? evHedef;
  const adapt = exposure.adapt ?? { up: 0.6, down: 2.5 };

  const api = {
    env: E, group, sun: sunLight, hemi, earthLight,
    /** Ortamın ışık tablosu — altyazı ve manifest buradan yazılır. */
    describe() {
      return {
        ortam: E.ad,
        gunes: { lux: Number((sunLux * gunesCarpani).toFixed(0)), tepeLux: sunLux, irtifaDeg: elevDeg,
          azimutDeg: azDeg, sicaklikK: 5772, ufkunAltinda: gunesCarpani === 0,
          renk: sunColor.map(v => Number(v.toFixed(3))) },
        dolgu: {
          gokLux, sicramaLux: Number(sicrama.toFixed(1)), albedo,
          formul: 'sıçrama = E·ρ·sin(irtifa)/π',
          ambient: 'YOK — fiziksel karşılığı yok',
        },
        dunyaIsigi: earthLight ? { lux: earthLight.intensity, not: 'Ay yakın yüzü; dolunayın ~50 katı' } : null,
        pozlama: { ev100: Number(evSimdi.toFixed(2)), toneMappingExposure: Number(exposureForLux(sahneLux(), hedefAlbedo).toExponential(3)),
          uyum: `ışığa ${adapt.up} s, karanlığa ${adapt.down} s (sinematik, ilan edilmiş)` },
        gonderim: { toplamLux: Number(sahneLux().toFixed(0)) },
      };
    },
    /** Kamera/göz uyumu + renderer pozlaması. */
    update(dt, renderer) {
      evSimdi = adaptEV(evSimdi, evHedef, dt, adapt);
      if (renderer) renderer.toneMappingExposure = 1 / (1.2 * Math.pow(2, evSimdi));
      return evSimdi;
    },
    /** Sahne değişince (kokpit → yüzey) yeni hedef. */
    setTargetLux(lux) { evHedef = ev100(luminanceFromLux(lux, hedefAlbedo)); return evHedef; },
    get ev() { return evSimdi; },
    get targetEV() { return evHedef; },

    /** Güneş yönü — bütün alt sahneler AYNI yönü alır (tek Güneş kuralı). */
    sunDirection(out = new THREE.Vector3()) { return out.copy(sunLight.position).normalize(); },

    dispose() {
      scene.remove(group);
      sunLight.dispose?.(); hemi.dispose?.(); earthLight?.dispose?.();
    },
  };
  return api;
}

/* ── FAR / KASK LAMBASI (§5.4) ─────────────────────────────────────────
   Kandela ile kurulur, decay = 2, distance = 0 (kesme yok — eşik atlaması
   sözleşme §2'ye aykırı). IES benzeri profil: merkez düz, kenar düşüşlü;
   `cos^n` yerine 1B tablo dokusu.

   HUZME AYRI BİR ŞEYDİR: `addBeam` yalnız saçan ortamda çalışır. */
export function createHeadlamp(THREE, {
  candela = 2000, angleDeg = 30, penumbra = 0.4, colorK = 4200, env = 'vacuum',
} = {}) {
  const renk = blackbodyRGB(colorK, { normalize: 'white' });
  const spot = new THREE.SpotLight(rgbHex(renk), candela, 0, angleDeg * DEG, penumbra, 2);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0006;

  /* IES tablosu: gerçek bir far merkezde düz, sonra hızla düşer. */
  const N = 64, veri = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);                       // 0 merkez, 1 kenar
    const v = u < 0.55 ? 1 - 0.12 * (u / 0.55) ** 2 : Math.max(0, 1 - ((u - 0.55) / 0.45) ** 1.6) * 0.88;
    const b = Math.round(255 * v);
    veri[i * 4] = veri[i * 4 + 1] = veri[i * 4 + 2] = b; veri[i * 4 + 3] = 255;
  }
  const ies = new THREE.DataTexture(veri, N, 1);
  ies.needsUpdate = true;

  return {
    light: spot, ies, candela, env,
    /** d metre uzaklıkta zemindeki aydınlatma (lux) — ölçülebilir iddia. */
    illuminanceAt(d) { return illuminanceAt(candela, d); },
    describe() {
      return { tur: 'far', kandela: candela, aciDeg: angleDeg, sicaklikK: colorK,
        huzme: envAllows('beam', env).ok ? 'görünür (saçan ortam)' : 'GÖRÜNMEZ — ' + envAllows('beam', env).neden,
        profil: 'IES benzeri 1B tablo (merkez düz, kenar düşüşlü)',
        zemin: `1 m'de ${illuminanceAt(candela, 1).toFixed(0)} lux, 3 m'de ${illuminanceAt(candela, 3).toFixed(0)} lux (E = I/d²)` };
    },
    dispose() { ies.dispose(); spot.dispose?.(); },
  };
}

/**
 * Görünür huzme — YALNIZ saçan ortamda.
 * Tek saçılmalı Henyey-Greenstein yaklaşımı (g ≈ 0,6): ileri saçılma
 * baskın, yani kaynağa bakınca huzme parlak, yandan bakınca soluk.
 * Vakumda `envAllows` reddeder ve nedenini söyler.
 */
export function addBeam(THREE, headlamp, { env = 'vacuum', lengthM = 6, g = 0.6 } = {}) {
  const izin = envAllows('beam', env);
  if (!izin.ok) return { ok: false, neden: izin.neden, oneri: izin.oneri, mesh: null };
  const E = ENVIRONMENTS[env];
  const aci = headlamp.light.angle;
  /* Huzme KESİK koni: gerçek bir lambanın açıklığı sıfır değildir ve
     eksen yardımcısı (çıplak ConeGeometry eksen ratchet'ine takılır)
     kesik koniyi zaten verir. Dar uç lambada (+Y), geniş uç zeminde. */
  const geo = cylGeoY(0.035, Math.tan(aci) * lengthM, lengthM, 32, true);
  geo.translate(0, -lengthM / 2, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: {
      uRenk: { value: new THREE.Color(rgbHex(blackbodyRGB(4200, { normalize: 'white' }))) },
      /* Tek saçılma yaklaşımının ölçeği: gerçek bir radyatif transfer
         çözümü değil, ortamın saçılma katsayısıyla ORANTILI bir görünürlük.
         0,16 ile huzme yandan bakışta hiç okunmuyordu (ölçüldü); 0,55 ile
         Dünya'da görünür, Mars'ta üçte bir, vakumda hiç yok. */
      /* Huzmenin ışıması BİRİMSİZ olamaz: sahnenin geri kalanı lux ve
         kandela ile kurulu, pozlama da fizikselse birimsiz bir katkı
         gündüz tamamen eziliyordu (ölçüldü: 100 000 lux altında huzme
         hiç okunmuyordu). Tek saçılma yaklaşımı kaynağın kandelasıyla
         ve ortamın saçılmasıyla ORANTILI bir parlaklık verir:
             L ≈ I · β · k   [cd/m²]
         k = 0,02 görünürlük ölçeğidir ve ilan edilmiştir; radyatif
         transfer çözümü değildir. Sonuç fiziksel olarak dürüst: gündüz
         el feneri huzmesi görünmez, gece görünür. */
      uYogunluk: { value: headlamp.candela * E.scattering * 0.02 },
      uG: { value: g },
      uBoy: { value: lengthM },
    },
    vertexShader: `
      varying vec3 vPos; varying vec3 vView;
      void main() {
        vPos = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uRenk; uniform float uYogunluk; uniform float uG; uniform float uBoy;
      varying vec3 vPos; varying vec3 vView;
      void main() {
        /* Henyey-Greenstein faz fonksiyonu: tek saçılma yaklaşımı. */
        vec3 v = normalize(vView);
        float cosT = clamp(dot(v, vec3(0.0, -1.0, 0.0)), -1.0, 1.0);
        float g2 = uG * uG;
        float hg = (1.0 - g2) / pow(1.0 + g2 - 2.0 * uG * cosT, 1.5);
        /* koni boyunca ters kare zayıflaması + uçta yumuşak kapanış */
        float d = clamp(-vPos.y / uBoy, 0.0, 1.0);
        float dusum = 1.0 / (1.0 + 9.0 * d * d);
        float uc = smoothstep(1.0, 0.72, d);
        float a = uYogunluk * hg * dusum * uc;
        gl_FragColor = vec4(uRenk * a, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  return { ok: true, mesh, mat,
    describe: () => ({ tur: 'huzme', ortam: env, model: 'tek saçılma, Henyey-Greenstein g = ' + g,
      yogunluk: (headlamp.candela * E.scattering * 0.02).toFixed(1) + ' cd/m²', not: 'kamera kaynağa yaklaştıkça parlar (ileri saçılma)' }),
    dispose() { geo.dispose(); mat.dispose(); } };
}
