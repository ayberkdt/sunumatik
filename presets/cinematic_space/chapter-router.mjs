/* chapter-router.mjs — bölüm hedeflerine uzamsal teslim (plan §9-10, §22).

   İlkeler:
   · Hedef preset'ler İFRAME DEĞİL, süreçte mount edilir (WebGL bağlam
     limiti) ve kokpit idle'ında GİZLİCE hazırlanır: seçim anında yalnız
     kamera yolculuğu + katman teslimi kalır.
   · PASS-THROUGH grameri ekran-uzayı pencere maskesiyle: hedef katman,
     kokpit penceresinin GERÇEK ekran dikdörtgenine kırpılmış başlar
     (clip-path), pencere "büyüyerek" tüm sahneyi kaplar. Geometri destekli
     maskenin ekran-uzayı karşılığıdır; kokpit çerçevesi geçişi saklar.
   · Dönüş = geri sarım: aynı maske tersine oynar (pull-out).
   · aktif sahne → tam render · sıradaki → hazır, duraklatılmış ·
     kapatılan → duraklatılmış (plan §21 üçlemesi).

   Hedef tipleri kayıt defterindedir; bilinmeyen tip konsola "hazırlanıyor"
   olarak düşer — veri güdümlü bölüm listesi koda kilitlenmez. */

const BEKLE = ms => new Promise(resolve => setTimeout(resolve, ms));

/* -------- hedef kurucuları: type → { mount, activate, deactivate } */
const HEDEFLER = {
  'orbital-stage': {
    async mount(host, { seed, spec = {} }) {
      const { mountOrbitalStage } = await import('../orbital_stage/orbital-stage.mjs');
      const stage = await mountOrbitalStage(host, {
        central: spec.central ?? 'moon',
        seed, active: false, autoplay: false,
        ...spec.options,
      });
      /* İçerik: spec yörünge verir; vermezse alçak Ay yörüngesi + orbiter —
         sahne boş bir küreyle teslim alınmaz. */
      const yorungeler = spec.trajectories ?? [{
        kepler: { a: 2140, e: .04, i: .48, raan: .7, argp: .3, nu0: 0, mu: 4902.800066 },
      }];
      let ilkIz = null;
      for (const trajectorySpec of yorungeler) {
        const iz = stage.addTrajectory(trajectorySpec);
        ilkIz = ilkIz || iz;
      }
      if (ilkIz) stage.setCraft(ilkIz, spec.craft ?? 'orbiter');
      return {
        stage,
        activate() {
          stage.setActive(true);
          stage.timeline.play();
          stage.camera.transitionTo(spec.cameraMode ?? 'orbit', { duration: 2.2 });
        },
        deactivate() { stage.timeline.pause(); stage.setActive(false); },
        dispose() { stage.dispose(); },
      };
    },
  },
};

export function createChapterRouter({
  stage, chapters, seed, reducedMotion, exportMode,
  windowRect,            // () => {x,y,w,h} — pencerenin sahne-içi piksel dikdörtgeni
  onOpen, onClose,       // kokpit tarafı: rAF duraklat/sürdür, konsol görünürlüğü
}) {
  const kayitli = new Map();     // id → {mounted, api, host}
  let acik = null;
  let geciste = false;

  /* Bölüm tipi bilinmiyorsa konsolda dürüstçe pasif görünür.
     internal:true bölümler cinematic-space'in kendi gramerleriyle
     (örn. dalış) açılır — yönlendiricinin kayıt defterine bakmaz. */
  for (const chapter of chapters) {
    if (!chapter.internal && !HEDEFLER[chapter.destination?.type]) {
      chapter.disabled = true;
      chapter.disabledNote = `Hedef tipi henüz yok: ${chapter.destination?.type ?? '—'}`;
    }
  }

  function katman(id) {
    let entry = kayitli.get(id);
    if (entry) return entry;
    const host = document.createElement('div');
    host.className = 'cine-bolum';
    host.style.cssText = 'position:absolute;inset:0;z-index:4;visibility:hidden;';
    stage.appendChild(host);
    entry = { host, api: null, mounting: null };
    kayitli.set(id, entry);
    return entry;
  }

  async function hazirla(id) {
    const chapter = chapters.find(c => c.id === id);
    if (!chapter || chapter.disabled || chapter.internal) return null;
    const entry = katman(id);
    if (entry.api) return entry.api;
    entry.mounting ??= HEDEFLER[chapter.destination.type]
      .mount(entry.host, { seed, spec: chapter.destination.spec ?? chapter.destination })
      .then(api => { entry.api = api; return api; })
      .catch(error => { console.warn(`Bölüm hazırlanamadı (${id}):`, error); entry.mounting = null; return null; });
    return entry.mounting;
  }

  const insetten = r => {
    const W = stage.clientWidth, H = stage.clientHeight;
    return `inset(${r.y}px ${W - r.x - r.w}px ${H - r.y - r.h}px ${r.x}px round 10px)`;
  };

  async function ac(id) {
    if (geciste || acik === id) return;
    const api = await hazirla(id);
    if (!api) return;
    geciste = true;
    const entry = kayitli.get(id);
    const host = entry.host;
    host.style.visibility = 'visible';
    acik = id;                         // durum yayını DOĞRU sırayla görsün diye önce atanır
    if (reducedMotion || exportMode) {
      host.style.clipPath = 'none';
      api.activate();
      onOpen?.(id);                    // kokpit perde/duraklatmayı kendi yapar
    } else {
      /* pencere dikdörtgeninden tam sahneye büyüyen maske */
      const r = windowRect();
      host.style.transition = 'none';
      host.style.clipPath = insetten(r);
      host.style.opacity = '0';
      api.activate();
      await BEKLE(30);                 // ilk kare otursun
      host.style.transition = 'clip-path 1.4s cubic-bezier(.55,0,.15,1), opacity .5s ease';
      host.style.opacity = '1';
      host.style.clipPath = 'inset(0px 0px 0px 0px round 0px)';
      await BEKLE(1450);
      onOpen?.(id);
    }
    geciste = false;
  }

  async function kapat() {
    if (geciste || !acik) return;
    geciste = true;
    const kapanan = acik;
    acik = null;                       // durum yayını dönüşü hemen görsün
    const entry = kayitli.get(kapanan);
    const host = entry.host;
    onClose?.(kapanan);                // kokpit render'ı geri gelsin — maske onu açar
    if (reducedMotion || exportMode) {
      host.style.visibility = 'hidden';
      entry.api.deactivate();
    } else {
      const r = windowRect();
      host.style.transition = 'clip-path 1.2s cubic-bezier(.55,0,.15,1), opacity .6s ease .5s';
      host.style.clipPath = insetten(r);
      host.style.opacity = '0';
      await BEKLE(1250);
      host.style.visibility = 'hidden';
      entry.api.deactivate();
    }
    geciste = false;
  }

  return {
    hazirla, ac, kapat,
    get acikBolum() { return acik; },
    get geciste() { return geciste; },
    dispose() {
      for (const { host, api } of kayitli.values()) { api?.dispose?.(); host.remove(); }
      kayitli.clear();
    },
  };
}
