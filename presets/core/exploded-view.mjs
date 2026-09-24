/* exploded-view.mjs — montaj grafiğini SAHNEYE uygular.
 * docs/exploded-view-plan.md §4.4, §5, §6, §7.
 *
 * `core/assembly.mjs` modeli tutar (three görmez); burası onu three
 * nesnelerine yazar. Ayrım sert: patlatma mantığı ekran olmadan
 * doğrulanabilir, bu dosya yalnız uygular.
 *
 * Verdiği dört şey:
 *   1. PATLATMA — k değişimi kritik sönümle sürülür (aşımsız, kadanstan
 *      bağımsız; life-signs'taki kapalı formun aynısı).
 *   2. ETİKET — seçim bir BİLGİ kuralıdır (hepsini basmak hiçbirini
 *      okunur bırakmaz), çakışanlar dikeyde ayrıştırılır, kılavuz çizgisi
 *      etiketi parçasına bağlar.
 *   3. ÇAĞRI KUTUSU — bir alt ağacı yalnız başına patlatmak; gerisi söner.
 *   4. KESİT — birincil eksene dik/paralel bir düzlemle gövdeyi açmak.
 */

const DEG = Math.PI / 180;

/** Kritik sönümlü yaklaşma: e(τ) = e₀(1+ωτ)e^(−ωτ). Aşım yok. */
function yaklas(simdi, hedef, dt, omega = 6) {
  const e = simdi - hedef;
  if (Math.abs(e) < 1e-7) return hedef;
  return hedef + e * (1 + omega * dt) * Math.exp(-omega * dt);
}

/**
 * Montajı sahneye bağlar.
 *
 * nodes: id → THREE.Object3D (parçanın kendi grubu; konumu TABAN poz)
 * opts.labelHost: etiketlerin basılacağı DOM katmanı (yoksa etiket yok)
 */
export function createExplodedView(THREE, assembly, nodes, {
  labelHost = null, camera = null, renderer = null,
  labelRule = null, omega = 6,
} = {}) {
  const taban = new Map();
  for (const [id, n] of nodes) if (n) taban.set(id, n.position.clone());

  const durum = {
    k: 0, kHedef: 0, mode: 'assembly',
    adim: null,              // null = hepsi
    callout: null,           // alt ağaç kimliği
    secili: null,
    kesit: null,             // { eksen:'x'|'y'|'z', konum: m, yon: 1|-1 }
  };

  const v = new THREE.Vector3();
  const etiketler = [];
  const cizgiler = [];
  /* Kılavuz çizgileri SVG katmanındadır: tek bir <svg> içinde polyline'lar
     hem ucuz hem de ölçekten bağımsız keskin çizer. */
  let svg = null;
  if (labelHost) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'xv-kilavuzlar');
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible';
    labelHost.appendChild(svg);
  }
  const kilavuzGrup = new THREE.Group();
  kilavuzGrup.name = 'exploded-leaders';

  /* ── kesit düzlemi ─────────────────────────────────────────────────── */
  const kesitDuzlem = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  function kesitUygula() {
    if (!renderer) return;
    if (!durum.kesit) { renderer.clippingPlanes = []; return; }
    const n = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[durum.kesit.eksen] || [0, 0, 1];
    const yon = durum.kesit.yon ?? -1;
    kesitDuzlem.normal.set(n[0] * yon, n[1] * yon, n[2] * yon);
    kesitDuzlem.constant = durum.kesit.konum * (yon > 0 ? -1 : 1);
    renderer.localClippingEnabled = true;
    renderer.clippingPlanes = [kesitDuzlem];
  }

  /* ── görünürlük ────────────────────────────────────────────────────── */
  function gorunurMu(p) {
    if (durum.adim !== null && (p.step ?? 1) > durum.adim) return false;
    if (durum.callout) {
      const alt = new Set(assembly.subtree(durum.callout).map(q => q.id));
      return alt.has(p.id);
    }
    return true;
  }
  function sonukMu(p) {
    if (durum.adim !== null && (p.step ?? 1) < durum.adim) return true;
    return false;
  }

  /* ── uygulama ──────────────────────────────────────────────────────── */
  function uygula() {
    const kaynak = durum.callout ? assembly.subtree(durum.callout) : assembly.parts;
    const kume = new Set(kaynak.map(p => p.id));
    const of = assembly.explode(durum.k, { mode: durum.mode });
    for (const p of assembly.parts) {
      const n = nodes.get(p.id);
      if (!n) continue;
      const gor = gorunurMu(p) && (!durum.callout || kume.has(p.id));
      n.visible = gor;
      if (!gor) continue;
      const d = of.get(p.id) || [0, 0, 0];
      const b = taban.get(p.id);
      n.position.set(b.x + d[0], b.y + d[1], b.z + d[2]);
      const sonuk = sonukMu(p);
      n.traverse(o => {
        if (!o.isMesh || !o.material) return;
        const mm = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mm) {
          if (m.userData.__opak === undefined) m.userData.__opak = m.opacity ?? 1;
          const hedefOpak = sonuk ? m.userData.__opak * 0.28 : m.userData.__opak;
          if (m.opacity !== hedefOpak) { m.opacity = hedefOpak; m.transparent = hedefOpak < 1; m.needsUpdate = false; }
        }
      });
    }
  }

  /* ── etiketler ─────────────────────────────────────────────────────
     Etiket parçanın ÜSTÜNE basılmaz. İlk sürüm öyle yapıyordu ve sonuç
     şuydu: on dokuz etiket ekranın ortasında dikey bir sütuna yığılıp
     cismi tamamen gizledi — patlatmanın tek amacı parçaları görmekti.

     Doğrusu, teknik çizimin yüz yıldır yaptığı şey: etiketler iki KENAR
     OLUĞUNA alınır, dikeyde ayrıştırılır ve her biri kendi parçasına bir
     KILAVUZ ÇİZGİSİYLE bağlanır. Böylece gövdenin üstü boş kalır ve
     hangi etiketin hangi parçaya ait olduğu yine belli olur. */
  /* Oluk genişliği sabit DEĞİL: dar bir sahnede 116 px'lik iki oluk
     372 px'lik alanın üçte ikisini yiyordu. Oluk, alanın oranından çıkar. */
  const olukGenisligi = (w) => Math.max(76, Math.min(128, w * 0.24));

  function etiketSec() {
    if (!labelHost) return [];
    if (labelRule) return assembly.parts.filter(p => nodes.get(p.id)?.visible && labelRule(p, durum));
    /* Varsayılan kural bir BİLGİ kuralıdır: hepsini basmak hiçbirini
       okunur bırakmaz. Adım kipinde o adımın parçaları, tam görünümde
       gabarisi ya da kütlesi büyük olanlar; seçili parça her zaman. */
    const esik = assembly.gabari * 0.09;
    return assembly.parts.filter(p => {
      const n = nodes.get(p.id);
      if (!n || !n.visible) return false;
      if (p.id === durum.secili) return true;
      if (durum.adim !== null) return (p.step ?? 1) === durum.adim;
      if (durum.callout) return true;
      const buyuk = p.size ? Math.max(...p.size) >= esik : false;
      const agir = (p.massKg ?? 0) >= 12;
      return buyuk || agir;
    });
  }

  function etiketCiz() {
    if (!labelHost || !camera) return;
    if (!svg) { for (const e of etiketler) e.el.style.display = 'none'; return; }
    if (durum.k < 0.18) {
      for (const e of etiketler) e.el.style.display = 'none';
      svg.style.display = 'none';
      return;
    }
    svg.style.display = '';

    const kutu = labelHost.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${kutu.width} ${kutu.height}`);

    /* 1) Ekran konumları. */
    const aday = [];
    for (const p of etiketSec()) {
      const n = nodes.get(p.id);
      n.getWorldPosition(v).project(camera);
      if (v.z >= 1) continue;
      const x = (v.x * .5 + .5) * kutu.width, y = (-v.y * .5 + .5) * kutu.height;
      if (x < -40 || x > kutu.width + 40 || y < -40 || y > kutu.height + 40) continue;
      aday.push({ p, hx: x, hy: y });
    }

    const OLUK = olukGenisligi(kutu.width);

    /* 2) Toplam sayı sınırı. Bu bir yer sorunu değil, BİLGİ sorunudur:
          yirmi etiket hiçbir şey anlatmaz. Sığabilecek kadarı değil,
          okunabilecek kadarı basılır. Seçili parça her zaman girer;
          kalanlar gabariye göre sıralanır. */
    const sigan = Math.max(6, Math.floor((kutu.height - 24) / 34) * 2);
    const sinir = Math.min(14, sigan);
    if (aday.length > sinir) {
      const puan = (a) => (a.p.id === durum.secili ? 1e9 : 0) +
        (a.p.size ? Math.max(...a.p.size) : 0) * 1000 + (a.p.massKg ?? 0);
      aday.sort((a, b) => puan(b) - puan(a));
      aday.length = sinir;
    }

    /* 3) Olukları DENGELE. "Parça ekranın hangi yarısındaysa o yana"
          kuralı kötüydü: gövde ekranın sağına düştüğünde on altı etiket
          sağ oluğa yığılıp taştı, sol oluk boş kaldı. Doğrusu, ekran
          x'ine göre sıralayıp ortadan ikiye bölmek — her oluk en çok
          yarısını alır ve etiket yine kendi tarafında kalır. */
    aday.sort((a, b) => a.hx - b.hx);
    const kesme = Math.ceil(aday.length / 2);
    const gruplar = [
      { liste: aday.slice(0, kesme), x: 10, solda: true },
      { liste: aday.slice(kesme), x: kutu.width - OLUK - 10, solda: false },
    ];

    /* 4) DOM havuzu — dağıtımdan ÖNCE kurulur, çünkü dikey dağıtım
          etiketin gerçek yüksekliğini bilmek zorundadır: iki satıra
          saran bir etiket tek satırlık boşluğa sığmaz ve üstündekiyle
          çakışır (ilk sürümde tam bu oldu). */
    const duz = [...gruplar[0].liste, ...gruplar[1].liste];
    while (etiketler.length > duz.length) etiketler.pop().el.remove();
    while (etiketler.length < duz.length) {
      const el = document.createElement('div');
      el.className = 'xv-et';
      labelHost.appendChild(el);
      etiketler.push({ el });
    }
    while (cizgiler.length > duz.length) cizgiler.pop().remove();
    while (cizgiler.length < duz.length) {
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      l.setAttribute('class', 'xv-kilavuz');
      svg.appendChild(l);
      cizgiler.push(l);
    }
    duz.forEach((q, i) => {
      const e = etiketler[i].el;
      e.style.display = '';
      e.style.maxWidth = `${OLUK}px`;
      const metin = q.p.ad || q.p.id;
      if (e.textContent !== metin) e.textContent = metin;
      e.classList.toggle('xv-et--secili', q.p.id === durum.secili);
      q.__el = e;
      q.__h = e.offsetHeight || 17;                    // ÖLÇÜLEN yükseklik
    });

    /* 5) Dikey dağıtım: istenen y'den başla, ölçülen yüksekliklerle
          çakışmayı aşağı iterek çöz, alttan taşarsa hepsini yukarı
          kaydır, üstten taşarsa sıkıştırarak yeniden diz. */
    const ARA = 4;
    const yerler = [];
    for (const g of gruplar) {
      const n = g.liste.length;
      if (!n) continue;
      g.liste.sort((a, b) => a.hy - b.hy);
      const y = g.liste.map(a => a.hy);
      for (let i = 1; i < n; i++) {
        const enAz = y[i - 1] + (g.liste[i - 1].__h + g.liste[i].__h) / 2 + ARA;
        if (y[i] < enAz) y[i] = enAz;
      }
      const altSinir = kutu.height - g.liste[n - 1].__h / 2 - 8;
      const tasma = y[n - 1] - altSinir;
      if (tasma > 0) for (let i = 0; i < n; i++) y[i] -= tasma;
      let ust = g.liste[0].__h / 2 + 8;
      for (let i = 0; i < n; i++) {
        if (y[i] < ust) y[i] = ust;
        ust = y[i] + (g.liste[i].__h + (g.liste[i + 1]?.__h ?? 0)) / 2 + ARA;
      }
      g.liste.forEach((a, i) => yerler.push({ ...a, x: g.x, y: y[i], solda: g.solda }));
    }

    /* 6) Yerleştir ve kılavuzu çiz. */
    for (const q of yerler) {
      const e = q.__el;
      e.style.left = `${q.x}px`;
      e.style.top = `${q.y}px`;
      /* Kılavuz etiketin İÇ kenarından çıkar, kısa bir omuz yapar, sonra
         parçaya gider: omuz olmadan çizginin hangi etiketten ayrıldığı
         kesişmelerde belirsiz kalıyor. */
      const ux = q.solda ? q.x + e.offsetWidth + 2 : q.x - 2;
      const omuz = q.solda ? ux + 12 : ux - 12;
      const i = etiketler.findIndex(t => t.el === e);
      cizgiler[i].setAttribute('points', `${ux},${q.y} ${omuz},${q.y} ${q.hx},${q.hy}`);
      cizgiler[i].classList.toggle('xv-kilavuz--secili', q.p.id === durum.secili);
    }
    return yerler;
  }

  return {
    assembly, nodes, durum, leaders: kilavuzGrup,
    /** Hedef patlatma oranı (0..1). Geçiş kritik sönümle sürülür. */
    setExplode(k) { durum.kHedef = Math.max(0, Math.min(1, k)); },
    /** Anında (export/reduced yolu). */
    jumpExplode(k) { durum.k = durum.kHedef = Math.max(0, Math.min(1, k)); uygula(); },
    setMode(m) { durum.mode = m; uygula(); },
    setStep(n) { durum.adim = n; uygula(); },
    setCallout(id) { durum.callout = id; uygula(); },
    setSelected(id) { durum.secili = id; },
    setSection(kesit) { durum.kesit = kesit; kesitUygula(); },
    /** Her karede çağrılır. */
    update(dt) {
      const yeni = yaklas(durum.k, durum.kHedef, dt, omega);
      if (Math.abs(yeni - durum.k) > 1e-7) { durum.k = yeni; uygula(); }
      etiketCiz();
      return durum.k;
    },
    /** Işın ile parça seçimi. */
    pick(raycaster) {
      const hedefler = [];
      for (const [, n] of nodes) if (n?.visible) hedefler.push(n);
      const vur = raycaster.intersectObjects(hedefler, true);
      const ilk = vur.find(x => x.object.visible);
      if (!ilk) return null;
      let o = ilk.object;
      while (o && !o.userData.partId) o = o.parent;
      return o?.userData?.partId ?? null;
    },
    refresh: uygula,
    dispose() {
      for (const e of etiketler) e.el.remove(); etiketler.length = 0;
      for (const l of cizgiler) l.remove(); cizgiler.length = 0;
      svg?.remove(); svg = null;
      if (renderer) renderer.clippingPlanes = [];
    },
  };
}

/** Vitrinlerin paylaştığı etiket biçimi — her sayfa kendi CSS'ini yazmasın. */
export const EXPLODED_CSS = `
.xv-et { position: absolute; transform: translateY(-50%); font-size: 10.5px; line-height: 1.25;
  letter-spacing: .02em; color: #cdd3de; background: rgba(5,7,11,.82);
  border: 1px solid #262c39; border-radius: 4px; padding: 2px 6px; }
.xv-et--secili { border-color: #c9a35c; color: #f0e2c4; }
.xv-kilavuzlar polyline { fill: none; stroke: #39404f; stroke-width: 1; }
.xv-kilavuzlar polyline.xv-kilavuz--secili { stroke: #c9a35c; }
`;

export { DEG };
