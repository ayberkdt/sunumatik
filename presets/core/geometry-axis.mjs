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
export function latheX(noktalar, seg, mat) {
  const p = noktalar.slice();
  if (p.length > 1 && p[p.length - 1].y < p[0].y) p.reverse();
  return new THREE.Mesh(eksenX(new THREE.LatheGeometry(p, seg)), mat);
}
export function latheZ(noktalar, seg, mat) {
  const p = noktalar.slice();
  if (p.length > 1 && p[p.length - 1].y < p[0].y) p.reverse();
  return new THREE.Mesh(eksenZ(new THREE.LatheGeometry(p, seg)), mat);
}
