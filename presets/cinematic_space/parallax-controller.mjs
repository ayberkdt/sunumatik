/* parallax-controller.mjs — işaretçi → küçük ikincil kamera offseti.

   Paralaks bu sistemde FİZİKTEN gelir (cinematic-space-plan.md §6): sahne
   gerçek 3B olduğundan, kameraya verilen küçük bir yaw/pitch + dolly
   offseti katmanları perspektif gereği farklı kaydırır. "Ay araçtan çok
   kayamaz" bir ayar değil, yapısal sonuçtur.

   Kurallar:
   · GİMMİCK DEĞİL: sınırlar küçüktür (varsayılan ≤0.6° yaw, ≤0.4° pitch,
     ≤0.03 birim dolly) ve hedefe kritik-sönümlü yumuşamayla gidilir —
     "öğeler fareyi takip ediyor" hissi oluşamaz.
   · İKİNCİLDİR: çıktı camera-director'a addSecondary ile eklenir; rayı
     asla süremez.
   · Export ve reduced-motion'da TAMAMEN kapalıdır (deterministik taban
     ray bozulmaz).
   · Gök kubbesi sonsuzdadır: yıldız katmanı ötelemeden etkilenmez, yalnız
     dönmeden etkilenir — skyShift() bu dönme kaymasını piksel cinsinden
     verir ki DOM'daki gök katmanı tutarlı kalsın. */

const DEG = Math.PI / 180;

export function createParallax(host, {
  maxYawDeg = 0.6, maxPitchDeg = 0.4, maxDolly = 0.03,
  easeSeconds = 1.2, enabled = true,
} = {}) {
  let hedefX = 0, hedefY = 0;        // işaretçi, [-1, 1]
  let x = 0, y = 0;                  // yumuşatılmış durum
  let acik = enabled;

  const onMove = event => {
    const box = host.getBoundingClientRect();
    if (!box.width || !box.height) return;
    hedefX = ((event.clientX - box.left) / box.width) * 2 - 1;
    hedefY = ((event.clientY - box.top) / box.height) * 2 - 1;
  };
  const onLeave = () => { hedefX = 0; hedefY = 0; };
  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerleave', onLeave);

  return {
    /** Yumuşatma adımı — canlı çevrimden çağrılır. Export/advance yolunda
        çağrılmaz; offset donuk kalır (determinizm). */
    update(dt) {
      if (!acik) { x = 0; y = 0; return; }
      const k = 1 - Math.exp(-dt / Math.max(1e-3, easeSeconds / 3));
      x += (hedefX - x) * k;
      y += (hedefY - y) * k;
    },

    /** camera-director ikincil katmanı: küçük yaw/pitch + dolly. */
    secondary: (state) => {
      if (!acik) return;
      const yaw = -x * maxYawDeg * DEG;
      const pitch = -y * maxPitchDeg * DEG;
      /* look hedefini kamera etrafında minik döndür: yaw → yatay, pitch → düşey */
      const dx = state.look.x - state.pos.x;
      const dz = state.look.z - state.pos.z;
      state.look.x += -dz * yaw;
      state.look.z += dx * yaw;
      state.look.y += Math.hypot(dx, dz) * pitch;
      /* dolly: işaretçiyle aynı yönde çok küçük öteleme — yakın katman
         uzak katmandan fazla kayar (gerçek paralaks) */
      state.pos.x += x * maxDolly;
      state.pos.y += -y * maxDolly * 0.6;
    },

    /** Gök katmanının (sonsuzdaki kubbe) dönmeden kaynaklı piksel kayması.
        fovDeg ve viewport yüksekliğiyle ölçeklenir. */
    skyShift(viewportH, fovDeg) {
      if (!acik) return { x: 0, y: 0 };
      const pxPerRad = viewportH / (2 * Math.tan((fovDeg * DEG) / 2));
      return {
        x: x * maxYawDeg * DEG * pxPerRad,
        y: y * maxPitchDeg * DEG * pxPerRad,
      };
    },

    setEnabled(v) { acik = Boolean(v); if (!acik) { x = 0; y = 0; hedefX = 0; hedefY = 0; } },
    dispose() {
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
    },
  };
}
