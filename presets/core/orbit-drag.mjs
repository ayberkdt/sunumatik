/* orbit-drag.mjs — ORBIT BY POINTER, AND BY FINGER.
 *
 * Five preset pages roll their own camera drag and not one of them declared
 * `touch-action`, so on a touchscreen the browser claims the gesture first:
 * a one-finger drag scrolls the page instead of turning the model, and
 * there is no way to zoom at all because the only zoom is a wheel event.
 * The other defects were the same everywhere:
 *
 *   · no pointer capture, so a drag that leaves the element sticks
 *   · no `pointercancel`, which is exactly what a browser fires when it
 *     takes a touch gesture away - the drag then never ends
 *   · a second finger starts a second drag and the two fight
 *   · sensitivity in raw pixels, so the same swipe turns the model much
 *     further on a phone than on a desktop
 *
 * This holds the orbit STATE (azimuth, elevation, distance) and nothing
 * else: no three, no camera. The caller reads the state and places its own
 * camera, which is why the same module works for a page that uses
 * OrbitControls' conventions and one that does not.
 *
 *   const d = createOrbitDrag(el, { az: -0.9, el: 0.42, dist: 9.5,
 *                                   onChange, onTap });
 */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Distance between two active pointers. */
function aralik(noktalar) {
  const [a, b] = [...noktalar.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Midpoint of two active pointers. */
function orta(noktalar) {
  const [a, b] = [...noktalar.values()];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function createOrbitDrag(host, {
  az = 0, el = 0.4, dist = 10,
  minEl = -1.35, maxEl = 1.35, minDist = 3, maxDist = 30,
  /* A full swipe across the element turns this far. Expressed as a
     FRACTION of the element, so a phone and a monitor feel the same;
     pixels do not. */
  turPerWidth = Math.PI * 1.6, turPerHeight = Math.PI * 0.9,
  sonumleme = 0.82, tapPx = 6,
  onChange = null, onTap = null,
} = {}) {
  const state = { az, el, dist };
  const hiz = { az: 0, el: 0 };
  const noktalar = new Map();
  let surukle = null, pinch = null, kaydi = 0, capraz = false;

  /* The browser must not claim the gesture. Set in JS rather than asked of
     every page's stylesheet, so a page cannot forget it. */
  host.style.touchAction = 'none';

  const bildir = () => { if (onChange) onChange(state); };

  /* Pointer capture throws NotFoundError when the pointer is already gone -
     which happens for the second finger of a pinch, and on the cancel path.
     Unguarded, that throw aborted the rest of the handler, so the flags
     that END a drag never ran and the view stayed stuck to the finger.
     The guard is the whole fix; the capture itself is what keeps a drag
     alive when it leaves the element. */
  const yakala = (id) => {
    try { if (!host.hasPointerCapture?.(id)) host.setPointerCapture?.(id); } catch { /* pointer gitti */ }
  };
  const birak = (id) => {
    try { if (host.hasPointerCapture?.(id)) host.releasePointerCapture?.(id); } catch { /* pointer gitti */ }
  };

  function down(ev) {
    noktalar.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (noktalar.size === 1) {
      yakala(ev.pointerId);
      surukle = { x: ev.clientX, y: ev.clientY, az: state.az, el: state.el };
      kaydi = 0; capraz = false;
      hiz.az = 0; hiz.el = 0;
      host.classList.add('suruklu');
    } else if (noktalar.size === 2) {
      /* Two fingers: pinch to zoom. The one-finger rotation stops rather
         than continuing from whichever finger happens to move. */
      surukle = null;
      pinch = { d0: aralik(noktalar), dist0: state.dist, m0: orta(noktalar) };
      capraz = true;
    }
    ev.preventDefault();
  }

  function move(ev) {
    if (!noktalar.has(ev.pointerId)) return;
    noktalar.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    const kutu = host.getBoundingClientRect();

    if (pinch && noktalar.size === 2) {
      const d = aralik(noktalar);
      if (pinch.d0 > 1) state.dist = clamp(pinch.dist0 * (pinch.d0 / d), minDist, maxDist);
      bildir();
      ev.preventDefault();
      return;
    }
    if (!surukle) return;
    const dx = ev.clientX - surukle.x, dy = ev.clientY - surukle.y;
    kaydi = Math.max(kaydi, Math.abs(dx) + Math.abs(dy));
    const yeniAz = surukle.az - (dx / Math.max(1, kutu.width)) * turPerWidth;
    const yeniEl = clamp(surukle.el + (dy / Math.max(1, kutu.height)) * turPerHeight, minEl, maxEl);
    hiz.az = yeniAz - state.az;
    hiz.el = yeniEl - state.el;
    state.az = yeniAz; state.el = yeniEl;
    bildir();
    ev.preventDefault();
  }

  function up(ev) {
    noktalar.delete(ev.pointerId);
    birak(ev.pointerId);
    if (noktalar.size < 2) pinch = null;
    if (noktalar.size === 0) {
      host.classList.remove('suruklu');
      /* A tap is a press that did not travel. `capraz` blocks the tap that
         would otherwise fire when the second finger of a pinch lifts. */
      if (surukle && kaydi < tapPx && !capraz && ev.type === 'pointerup' && onTap) onTap(ev);
      surukle = null;
    }
  }

  function wheel(ev) {
    ev.preventDefault();
    /* Proportional, so one notch feels the same at every distance. */
    const k = Math.exp(Math.sign(ev.deltaY) * 0.12);
    state.dist = clamp(state.dist * k, minDist, maxDist);
    bildir();
  }

  host.addEventListener('pointerdown', down);
  host.addEventListener('pointermove', move);
  host.addEventListener('pointerup', up);
  /* The one every hand-rolled version forgot. A browser that decides to
     take over a touch gesture fires this and no pointerup ever arrives. */
  host.addEventListener('pointercancel', up);
  host.addEventListener('lostpointercapture', up);
  host.addEventListener('wheel', wheel, { passive: false });
  /* A long press on a touchscreen otherwise pops the selection callout. */
  host.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    state,
    /** Let go of the pointer and coast. Called from the frame loop. */
    update() {
      if (surukle || pinch) return false;
      if (Math.abs(hiz.az) < 1e-5 && Math.abs(hiz.el) < 1e-5) return false;
      state.az += hiz.az;
      state.el = clamp(state.el + hiz.el, minEl, maxEl);
      hiz.az *= sonumleme; hiz.el *= sonumleme;
      bildir();
      return true;
    },
    set(next) { Object.assign(state, next); bildir(); },
    dispose() {
      host.removeEventListener('pointerdown', down);
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerup', up);
      host.removeEventListener('pointercancel', up);
      host.removeEventListener('lostpointercapture', up);
      host.removeEventListener('wheel', wheel);
      noktalar.clear();
    },
  };
}

/** Camera position for an orbit state, so every caller places it the same
    way. Y is up here, matching the pages that use this. */
/**
 * Yörünge durumundan kamera konumu.
 *
 * `yukari` HANGİ EKSENİN yukarı olduğunu söyler ve varsayılanı yoktur diye
 * düşünülmeliydi: bu dosya sessizce Y-yukarı üretiyordu, depodaki blok
 * sözleşmesi ise "+X ileri, +Z yukarı" diyor ve aircraft_blocks,
 * comms_antenna, exploded_view, habitat_blocks hepsi `camera.up.set(0,0,1)`
 * yazıyor. Uydu sayfası bunu yazmayan tek sayfaydı ve sonuç, bütün aracın
 * YAN YATMIŞ çizilmesiydi: ölçülen açı, kamera yukarısı (0,1,0) ile gövde
 * yukarısı (0,0,1) arasında tam 90°. Parçaların hiçbiri yanlış değildi;
 * anten gerçekten gövde nadirine bakıyordu, ama gövde nadiri ekranda yana
 * düşüyordu ve anten ters görünüyordu.
 *
 * Kamerayı kuran yer ayrıca `camera.up`'ı aynı eksene ayarlamalıdır: konum
 * ile up ayrı ayrı yazıldığında ikisi yine ayrışır.
 */
export function orbitPosition({ az, el, dist }, { yukari = 'y' } = {}) {
  const d = Math.cos(el) * dist;
  const x = Math.cos(az) * d;
  const yatay = Math.sin(az) * d;
  const dikey = Math.sin(el) * dist;
  return yukari === 'z' ? [x, yatay, dikey] : [x, dikey, yatay];
}

export { clamp };
