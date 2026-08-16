/* camera-director.mjs — keyframe raylı kamera yönetmeni.

   orbital_stage'in kamera yönetmeni deseninin genelleştirilmiş hâli
   (cinematic-space-plan.md §4): kamera durumu, ilerleme p'nin SAF
   fonksiyonudur. Scroll, klavye ve goTo() aynı rayı sürer; hiçbir geçiş
   kamera konumunda adım üretmez (C0 süreklilik) çünkü ray zaten sürekli
   bir eğridir — "geçiş" diye ayrı bir mod yoktur.

   Katman sırası her karede:
     taban(p)  →  ikincil offsetler (idle nefesi, paralaks)  →  lookAt
   İkincil katmanlar TOPLANIR; rayı asla süremezler. Export/reduced modda
   ikincil katmanlar kapatılınca kamera p'nin saf fonksiyonu olarak kalır. */

import * as THREE from 'three';

const smoothstep = t => t * t * (3 - 2 * t);
/* 'cinematic' = smoothstep² — kalkış ve varış daha da nazik (yaklaşma için). */
const EASE = { linear: t => t, smooth: smoothstep, cinematic: t => smoothstep(smoothstep(t)) };

/** keyframes: [{ p, pos:[x,y,z], look:[x,y,z], fov, ease? }] — p artan sırada.
    ease, BU kareden bir SONRAKİNE giden segmentin eğrisidir. */
export function createCameraDirector(camera, { keyframes }) {
  if (!keyframes?.length) throw new Error('createCameraDirector requires keyframes');
  const ks = keyframes.map(k => ({
    p: k.p,
    pos: new THREE.Vector3(...k.pos),
    look: new THREE.Vector3(...k.look),
    fov: k.fov ?? camera.fov,
    ease: EASE[k.ease || 'smooth'] || EASE.smooth,
  })).sort((a, b) => a.p - b.p);

  const secondaries = [];
  const _pos = new THREE.Vector3();
  const _look = new THREE.Vector3();
  const out = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: camera.fov };

  /* p → taban durumu (saf; yan etkisiz) */
  function sample(p, target = out) {
    const pc = Math.min(ks[ks.length - 1].p, Math.max(ks[0].p, p));
    let i = 0;
    while (i < ks.length - 2 && pc > ks[i + 1].p) i++;
    const a = ks[i], b = ks[i + 1] ?? ks[i];
    const span = Math.max(1e-9, b.p - a.p);
    const f = a.ease(Math.min(1, Math.max(0, (pc - a.p) / span)));
    target.pos.lerpVectors(a.pos, b.pos, f);
    target.look.lerpVectors(a.look, b.look, f);
    target.fov = a.fov + (b.fov - a.fov) * f;
    return target;
  }

  return {
    /** İkincil offset katmanı ekler: fn(state, t) — state.pos/look/fov'u
        YERİNDE değiştirir (toplamsal küçük katkılar; ray dokunulmaz). */
    addSecondary(fn) { secondaries.push(fn); return () => {
      const at = secondaries.indexOf(fn); if (at >= 0) secondaries.splice(at, 1);
    }; },

    /** Kamerayı p ve t'den kur. secondariesOn=false → taban ray (export). */
    apply(p, t, secondariesOn = true) {
      sample(p, out);
      _pos.copy(out.pos); _look.copy(out.look);
      let fov = out.fov;
      if (secondariesOn) {
        const state = { pos: _pos, look: _look, fov };
        for (const fn of secondaries) fn(state, t);
        fov = state.fov;
      }
      camera.position.copy(_pos);
      camera.lookAt(_look);
      if (Math.abs(camera.fov - fov) > 1e-4) { camera.fov = fov; camera.updateProjectionMatrix(); }
    },

    sample,
    get range() { return [ks[0].p, ks[ks.length - 1].p]; },
  };
}
