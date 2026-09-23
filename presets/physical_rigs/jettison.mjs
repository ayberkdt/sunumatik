/* jettison.mjs — ATILAN GÖVDELER (three'siz çekirdek + ince three bağlaması).
 * docs/physical-rigs-plan.md §5.11 (kademe ayrılması) · F2.
 *
 * Kademe ayrılması bir ANİMASYON değildir. Ayrılan itici, o andan sonra
 * aracın çocuğu olmaktan çıkar ve KENDİ hareketini yaşar:
 *
 *   · Ayrılma itkisi: yaylı ya da piroteknik iticiler 1–3 m/s göreli hız
 *     verir. Bu, iki gövdenin çarpışmadan uzaklaşması için gereken asgari
 *     hızdır; daha fazlası kütle ve sarsıntı demektir.
 *   · Ayrılma torku: itki noktaları ağırlık merkezinden geçmez, ayrıca
 *     aerodinamik moment vardır — bu yüzden bırakılan kademe YAVAŞÇA TAKLA
 *     ATAR. Dümdüz geri düşen bir kademe sahte görünür.
 *   · Sonrasında gövde yalnız yerçekimi (ve varsa sürükleme) altındadır:
 *     p += v·dt,  v += (g + a_sürükleme)·dt,  açı += ω·dt.
 *
 * Aynı mekanizma başlık (fairing) yarımları için de geçerlidir: menteşede
 * açılırlar, sonra bırakılır ve kendi eksenlerinde dönerek uzaklaşırlar.
 *
 * DETERMİNİZM: durum yalnız advance(dt) toplamından akar; hız/tork değerleri
 * çağıran tarafından verilir ya da tohumlu üretilir. Math.random yoktur.
 *
 * API:
 *   createJettison({ gravity = [0,-9.81,0], drag = 0 }) → j
 *     j.release(node, { position, quaternion, velocity, omega, mass, drag })
 *        — node SAHNEYE devredilmiş olmalıdır (çağıran reparent eder;
 *          bu modül three'ye dokunmaz, yalnız durum tutar).
 *     j.advance(dt)        → saf adım
 *     j.apply(bodies)      → {node, state} çiftlerini düğümlere yazar
 *     j.bodies             → [{ id, node, p:[x,y,z], v, q:[x,y,z] (Euler), w }]
 *     j.reset()
 *   integrateBody(state, dt, { gravity, drag }) — tek gövde, saf
 */

const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

/** Tek gövde adımı. Sürükleme ivmesi a = −drag·|v|·v (kuadratik, katsayı
    çağırandan; sıfır verilirse saf balistik). Yarı-örtük Euler: hız önce
    güncellenir, sonra konum — sabit yerçekiminde enerji sapması küçük kalır. */
export function integrateBody(b, dt, { gravity = [0, -9.81, 0], drag = 0 } = {}) {
  const d = b.drag ?? drag;
  const speed = Math.hypot(b.v[0], b.v[1], b.v[2]);
  const a = [
    gravity[0] - d * speed * b.v[0],
    gravity[1] - d * speed * b.v[1],
    gravity[2] - d * speed * b.v[2],
  ];
  b.v = add3(b.v, a, dt);
  b.p = add3(b.p, b.v, dt);
  b.q = add3(b.q, b.w, dt);
  b.age += dt;
  return b;
}

export function createJettison({ gravity = [0, -9.81, 0], drag = 0 } = {}) {
  const bodies = [];
  let sayac = 0;
  return {
    gravity, drag, bodies,
    get count() { return bodies.length; },

    /** Gövdeyi serbest bırak. `node` çağıran tarafından sahneye taşınmış,
        dünya konumu/dönüşü korunmuş olmalıdır (three tarafı: attach()). */
    release(node, { position = [0, 0, 0], quaternion = null, velocity = [0, 0, 0],
      omega = [0, 0, 0], mass = 1, drag: bodyDrag = null, id = null } = {}) {
      const b = {
        id: id ?? `body${sayac++}`, node,
        p: [...position], v: [...velocity], q: [0, 0, 0], w: [...omega],
        p0: [...position], v0: [...velocity],       // kapali form icin baslangic
        q0: quaternion, mass, drag: bodyDrag, age: 0,
      };
      bodies.push(b);
      return b;
    },

    advance(dt) {
      if (!(dt > 0)) return;
      for (const b of bodies) integrateBody(b, dt, { gravity, drag });
    },

    /** Durumu three düğümlerine yaz (three import etmeden). Dönüş, bırakma
        anındaki yönelimin ÜSTÜNE eklenir: node.rotation doğrudan yazılamaz
        çünkü o an aracın yönelimini taşıyor olabilir — bu yüzden çağıran
        bırakırken `quaternion`ı verir ve biz Euler artışını uygularız. */
    apply() {
      for (const b of bodies) {
        if (!b.node) continue;
        b.node.position.set(b.p[0], b.p[1], b.p[2]);
        if (b.q0 && b.node.quaternion.copy) {
          b.node.quaternion.copy(b.q0);
          b.node.rotateX(b.q[0]); b.node.rotateY(b.q[1]); b.node.rotateZ(b.q[2]);
        } else {
          b.node.rotation.set(b.q[0], b.q[1], b.q[2]);
        }
      }
    },

    /** Belirtilen yükseklik altına düşen gövdeleri listeden çıkar (görünmez
        kılma ÇAĞIRANIN işi; burada yalnız durum temizlenir). */
    cull(minY = -1e6) {
      for (let i = bodies.length - 1; i >= 0; i--) if (bodies[i].p[1] < minY) bodies.splice(i, 1);
    },

    reset() { bodies.length = 0; sayac = 0; },

    /** KAPALI FORM poz: surukleme 0 iken balistik tam cozulur, yani
        herhangi bir t'ye ADIM ATMADAN gidilebilir. `?t=` ile kare yakalama
        ve disa aktarim bunu kullanir; adim adim integrasyon ile ayni sonucu
        verir (dogrulama: validate-rigs). */
    poseAt(b, elapsed) {
      const e = Math.max(0, elapsed), h = 0.5 * e * e;
      return {
        p: [b.p0[0] + b.v0[0] * e + gravity[0] * h,
          b.p0[1] + b.v0[1] * e + gravity[1] * h,
          b.p0[2] + b.v0[2] * e + gravity[2] * h],
        q: [b.w[0] * e, b.w[1] * e, b.w[2] * e],
      };
    },
  };
}

/** Ayrılma anında bırakılan gövdeye verilecek göreli hız ve tork için
    TOHUMLU ama deterministik küçük sapma (her koşumda aynı). Gerçek
    ayrılmada sapmanın kaynağı iticilerin eşit olmayan itkisidir. */
export function separationImpulse(seed, { push = 2.0, tumble = 0.35, axis = [0, -1, 0] } = {}) {
  let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const j = () => (rnd() - 0.5) * 2;
  const n = Math.hypot(axis[0], axis[1], axis[2]) || 1;
  return {
    velocity: [axis[0] / n * push + j() * push * 0.08,
      axis[1] / n * push + j() * push * 0.08,
      axis[2] / n * push + j() * push * 0.08],
    omega: [j() * tumble, j() * tumble * 0.4, j() * tumble],
  };
}
