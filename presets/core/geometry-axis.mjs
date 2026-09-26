// geometry-axis.mjs — EKSEN YARDIMCILARI: çeviriyi TEK YERE hapseder.
//
// three.js'te CylinderGeometry, LatheGeometry ve ConeGeometry'nin ekseni
// HER ZAMAN +Y'dir. Blok sözleşmesi ise "+X ileri, +Z yukarı" der
// (references/scene-blocks.md). Bu çeviriyi her çağrı yerinde elle yazmak
// tek bir oturumda BEŞ ayrı hataya yol açtı (uçak kuyrukları, Starship
// burnu, helikopter mili, sonda çanağı, gezgin tekerlekleri) ve hepsini
// kullanıcı ekran görüntüsüyle buldu.
//
// Bu modül önce craft-blocks.mjs ve aircraft-blocks.mjs içinde İKİ kopya
// olarak yaşadı; kopyaların zamanla ayrışmaması için tek kaynağa taşındı.
// presets/core/ paylaşılan ALTYAPIDIR (moon_advanced/vendor/ gibi): bloklar
// birbirine sert bağımlı olamaz ama altyapıya olabilir.
//
// Kural: çıplak `new THREE.CylinderGeometry/LatheGeometry/ConeGeometry`
// KULLANILMAZ; aşağıdaki adlandırılmış yardımcılar kullanılır. Adında hangi
// eksen yazıyorsa geometrinin ekseni odur — okuyanın işaret hesabı yapması
// gerekmez. `scripts/eksen-denetimi.py` kuralı denetler (bu dosyanın kendi
// gövdeleri muaftır: çeviriyi yapan yer burasıdır).
//
// Kontroller:  R_z(−90°)·(0,1,0) = (1,0,0)   ⇒ eksenX
//              R_x(+90°)·(0,1,0) = (0,0,1)   ⇒ eksenZ

import * as THREE from 'three';

export const eksenX = (geo) => { geo.rotateZ(-Math.PI / 2); return geo; };   // +Y → +X
export const eksenY = (geo) => geo;                                          // +Y (dokunma)
export const eksenZ = (geo) => { geo.rotateX(Math.PI / 2); return geo; };    // +Y → +Z

/* Silindir — ilk yarıçap eksenin POZİTİF ucundadır. */
export function cylX(rPoz, rNeg, h, seg, mat, open = false) {
  return new THREE.Mesh(eksenX(new THREE.CylinderGeometry(rPoz, rNeg, h, seg, 1, open)), mat);
}
export function cylY(rPoz, rNeg, h, seg, mat, open = false) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rPoz, rNeg, h, seg, 1, open), mat);
}
export function cylZ(rPoz, rNeg, h, seg, mat, open = false) {
  return new THREE.Mesh(eksenZ(new THREE.CylinderGeometry(rPoz, rNeg, h, seg, 1, open)), mat);
}

/* GEOMETRİ düzeyinde yardımcılar (InstancedMesh gibi Mesh istemeyen tüketiciler için):
   aynı eksen çevirisi, Mesh yerine BufferGeometry döner. Tepe/pozitif uç kuralı aynıdır. */
export function coneGeoX(r, h, seg, open = false) { return eksenX(new THREE.ConeGeometry(r, h, seg, 1, open)); }
export function coneGeoZ(r, h, seg, open = false) { return eksenZ(new THREE.ConeGeometry(r, h, seg, 1, open)); }
export function cylGeoX(rPoz, rNeg, h, seg, open = false) { return eksenX(new THREE.CylinderGeometry(rPoz, rNeg, h, seg, 1, open)); }
export function cylGeoY(rPoz, rNeg, h, seg, open = false) { return new THREE.CylinderGeometry(rPoz, rNeg, h, seg, 1, open); }
/* thetaStart/thetaLength: a PARTIAL wall - a housing opened so its insides
   can be seen, a shell segment. Default is a full turn, so existing calls
   are untouched. Added here rather than reached for with a bare
   CylinderGeometry, which is what the axis ratchet exists to prevent. */
export function cylGeoZ(rPoz, rNeg, h, seg, open = false, thetaStart = 0, thetaLength = Math.PI * 2) {
  return eksenZ(new THREE.CylinderGeometry(rPoz, rNeg, h, seg, 1, open, thetaStart, thetaLength));
}

/* KISMİ KÜRE — kutup da bir yöndür.
 *
 * `SphereGeometry(r, w, h, phiBas, phiUz, thetaBas, thetaUz)` kısmi verilince
 * bir KUTUP kazanır ve three'de o kutup +Y'dedir. Blok sözleşmesinde yukarı
 * +Z'dir, yani çevrilmeyen her kısmi küre yan yatar. Haberleşme beresi tam
 * bunu yaptı: kafatasını örtmesi gereken kapak, başın SOL yanına oturdu ve
 * takke merkez çizgisinden 33 mm kaydı. Tam küre bu tuzağı taşımaz - kutbu
 * yoktur - o yüzden yalnız kısmi olanlar buradan geçer. */
export function kureGeoZ(r, wseg, hseg, phiBas = 0, phiUz = Math.PI * 2,
                         thetaBas = 0, thetaUz = Math.PI) {
  return eksenZ(new THREE.SphereGeometry(r, wseg, hseg, phiBas, phiUz, thetaBas, thetaUz));
}

/* Koni — tepe eksenin POZİTİF ucunda. */
export function coneX(r, h, seg, mat, open = false) {
  return new THREE.Mesh(eksenX(new THREE.ConeGeometry(r, h, seg, 1, open)), mat);
}
export function coneZ(r, h, seg, mat, open = false) {
  return new THREE.Mesh(eksenZ(new THREE.ConeGeometry(r, h, seg, 1, open)), mat);
}

/**
 * Lathe — İKİNCİ tuzağı da kapatır.
 *
 * Lathe normalleri profilin SIRASINA bağlıdır: y azalarak giden bir profil,
 * normalleri İÇE bakan bir yüzey üretir ve yüzey ters aydınlanır. Nasel
 * kaportası, Starship burnu ve sonda çanağı tam bu yüzden siyah çıkmıştı;
 * üçünde de palet açık renkti ama yüzey kendi gölgesindeydi.
 *
 * Burada artık imkânsız: sıra kontrol edilir, gerekirse ÇEVRİLİR. Çağıran
 * profili hangi sırada verdiğini düşünmek zorunda değil.
 */
/* phiStart/phiLength: KISMİ lathe (yarım başlık, kabuk dilimi).
 *
 * ÖLÇÜLDÜ, türetilmedi. Her iki yardımcı da tek noktalı bir profille
 * kurulup ilk köşenin dünya koordinatı okundu:
 *
 *            phi = 0        phi = +π/2      phi = π        phi = −π/2
 *   latheZ   (0,−1,0) SAĞ   (1,0,0) ÖN      (0,1,0) SOL    (−1,0,0) ARKA
 *   latheX   (0,0,1) ÜST    (0,−1,0) SAĞ    (0,0,−1) ALT    (0,1,0) SOL
 *
 * İKİSİ AYNI DEĞİL ve tek bir ortak tablo yapmak, kapatmaya çalıştığımız
 * tuzağın ikincisini kurardı: "ön" yazan bir ad, geometriyi başka yere
 * götürür. O yüzden iki ayrı tablo.
 *
 * Bu sayı bir kez yanlış BİLİNDİ ve astronotta beş yerde birden patladı:
 * altın vizör başın yanına, beyaz miğferin ön açıklığı sağa, göğüs dolgusu
 * sağ omzun altına düştü. Kodda "phi = 0 öne bakıyor" yazıyordu; ölçüm 90°
 * yanında olduğunu söyledi. O yüzden çağıran artık AÇI yazmaz, YÖN yazar. */
export const PHI_Z = Object.freeze({
  sag: 0, on: Math.PI / 2, sol: Math.PI, arka: -Math.PI / 2,
});
export const PHI_X = Object.freeze({
  ust: 0, sag: Math.PI / 2, alt: Math.PI, sol: -Math.PI / 2,
});
export function latheX(noktalar, seg, mat, phiStart = 0, phiLength = Math.PI * 2) {
  const p = noktalar.slice();
  if (p.length > 1 && p[p.length - 1].y < p[0].y) p.reverse();
  return new THREE.Mesh(eksenX(new THREE.LatheGeometry(p, seg, phiStart, phiLength)), mat);
}
export function latheZ(noktalar, seg, mat, phiStart = 0, phiLength = Math.PI * 2) {
  const p = noktalar.slice();
  if (p.length > 1 && p[p.length - 1].y < p[0].y) p.reverse();
  return new THREE.Mesh(eksenZ(new THREE.LatheGeometry(p, seg, phiStart, phiLength)), mat);
}

/**
 * KISMİ lathe, YÖNÜYLE. `merkezYon` kaplanan yayın ORTASININ baktığı yön
 * (`latheZYonlu` için `PHI_Z.*`, `latheXYonlu` için `PHI_X.*` — ikisi aynı
 * tablo DEĞİLDİR), `acikligi` yayın radyan cinsinden uzunluğu.
 *
 * phiStart/phiLength ile aynı şeyi yapar ama okunabilir: "önü kapla, 1,9
 * radyan genişliğinde" cümlesi, "−0,95'ten başla 1,9 git"ten farklı olarak
 * yanlış yazıldığında GÖZLE görülür. Bir kabuğun hangi yöne baktığı, o
 * kabuğu kuran satırda yazmak zorunda.
 */
export function latheZYonlu(noktalar, seg, mat, merkezYon, acikligi) {
  return latheZ(noktalar, seg, mat, merkezYon - acikligi / 2, acikligi);   // phi-ok: çeviriyi yapan yer
}
export function latheXYonlu(noktalar, seg, mat, merkezYon, acikligi) {
  return latheX(noktalar, seg, mat, merkezYon - acikligi / 2, acikligi);   // phi-ok: çeviriyi yapan yer
}
