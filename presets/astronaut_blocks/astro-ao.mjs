/* astro-ao.mjs — TEMAS KARARTMASI (ortam örtme), köşe rengine pişirilmiş.
 *
 * NEDEN VAR
 * ─────────
 * Ay'da güneş gerçekten keskin gölge verir, ama bir render'ı "oturtan" şey
 * gölge değil TEMAS KARARTMASIDIR: göğüs panelinin gövdeye değdiği yer,
 * çizmenin yere bastığı yer, bir kolun gövdeye yaklaştığı yer. Ölçüldü -
 * figürde bunların hepsi aynı parlaklıktaydı, çünkü ne AO haritası ne de bir
 * SSAO geçişi vardı. Parçalar bu yüzden birbirinin üstünde DURUYOR değil,
 * yanında UÇUYOR gibi görünüyordu.
 *
 * NEDEN VOKSEL
 * ────────────
 * İlk deneme örtücü olarak parçaların DÜNYA KUTULARINI kullandı ve ölçüm onu
 * reddetti: ortalama örtme 0,55, köşelerin %83'ü kısmen karanlık, kurulum
 * 1450 ms. Sebebi açık - bir parçanın kutusu parçanın kendisinden çok daha
 * büyüktür (`alt-govde`nin kutusu bütün alt gövdeyi kaplar), yani her şey her
 * şeyi örtüyordu.
 *
 * Bunun yerine 2 cm'lik bir DOLULUK IZGARASI: köşe konumlarından kurulur,
 * hücre başına hangi parçanın olduğu tutulur, ve ışın ızgarada adım adım
 * yürür. Izgara geometriye kutudan çok daha yakın oturur ve arama sabit
 * zamanlıdır - ışın-üçgen sınamasının maliyeti olmadan onun verdiği cevaba
 * yakın bir cevap.
 *
 * Sonuç `color` özniteliğine yazılır ve malzemelerde `vertexColors` açılır.
 * Öznitelik İSTİSNASIZ verilir: `vertexColors` açık bir malzemede özniteliği
 * olmayan geometri SİYAH çıkar ve o tuzak için ayrık durum bırakılmaz.
 */

/** Tozun ulaştığı en yüksek nokta (m) ve en koyu hâlinin gücü.
 *  0,62 m: diz (0,64) hizasının hemen altı - Apollo görüntülerinde kirlenme
 *  çizgisi orada biter, çünkü toz yürürken SAVRULUR, üste sürtünmeyle çıkar. */
export const TOZ_TAVAN_M = 0.62;
export const TOZ_GUCU = 0.30;

/** Fibonacci küresi: düzgün dağılmış `n` yön. */
function yonler(n) {
  const y = [];
  const altin = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const z = 1 - (2 * i + 1) / n;
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    const a = altin * i;
    y.push([Math.cos(a) * r, Math.sin(a) * r, z]);
  }
  return y;
}

/** Hücre boyu (m). 2 cm: giysinin en ince ayrıntısı (dikiş) 3 mm, en kalın
 *  uzvu 0,3 m; 2 cm ikisinin arasında ve ızgara 60 bin hücrenin altında kalır. */
export const HUCRE_M = 0.02;

/**
 * Figüre temas karartmasını pişirir.
 *
 * @returns { koseSayisi, ortalama, hucre } — kapı bunları ölçer
 */
export function ortamOrtme(THREE, kok, nodes, {
  isin = 8, menzil = 0.16, guc = 0.42, zemin = true, hucre = HUCRE_M,
} = {}) {
  kok.updateMatrixWorld(true);

  /* Hangi mesh hangi parçaya ait? Bir parça kendini karartmaz - kıvrım içi
     karartmayı kapitone zaten yapıyor, aranan şey parçalar ARASI temas. */
  const parcaNo = new Map();
  let no = 0;
  for (const [, n] of nodes) {
    const i = no++;
    n.traverse((o) => { if (o.isMesh && !parcaNo.has(o)) parcaNo.set(o, i); });
  }

  /* DOLULUK IZGARASI. Hücrede tek parça varsa numarası, birden çok parça
     varsa -2 (herkesi örter). */
  const izgara = new Map();
  /* ANAHTAR TAM SAYI. Dizgi anahtarıyla ("x,y,z") kurulum 1792 ms sürüyordu:
     66 bin köşe x 12 ışın x 8 adım = 6,4 milyon dizgi birleştirme. Üç
     koordinat 10'ar bite paketlenir (2 cm hücrede +/-512 hücre = +/-10 m,
     figür için fazlasıyla yeterli) ve arama sayısal olur. */
  const anahtar = (x, y, z) => (((x + 512) << 20) | ((y + 512) << 10) | (z + 512));
  const v = new THREE.Vector3();
  kok.traverse((o) => {
    if (!o.isMesh || !o.geometry.attributes.position) return;
    const p = o.geometry.attributes.position;
    const benim = parcaNo.get(o) ?? -1;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
      const k = anahtar(Math.floor(v.x / hucre), Math.floor(v.y / hucre), Math.floor(v.z / hucre));
      const e = izgara.get(k);
      if (e === undefined) izgara.set(k, benim);
      else if (e !== benim) izgara.set(k, -2);
    }
  });

  const yon = yonler(isin);
  const adim = hucre * 0.9;
  const enCokAdim = Math.ceil(menzil / adim);
  const nn = new THREE.Vector3();
  const nmat = new THREE.Matrix3();
  let koseSayisi = 0, toplam = 0;

  kok.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    const poz = g.attributes.position, nrm = g.attributes.normal;
    if (!poz || !nrm) return;
    const benim = parcaNo.get(o) ?? -1;
    nmat.getNormalMatrix(o.matrixWorld);
    const renk = new Float32Array(poz.count * 3);
    for (let i = 0; i < poz.count; i++) {
      v.fromBufferAttribute(poz, i).applyMatrix4(o.matrixWorld);
      nn.fromBufferAttribute(nrm, i).applyMatrix3(nmat).normalize();
      const px = v.x + nn.x * hucre, py = v.y + nn.y * hucre, pz = v.z + nn.z * hucre;
      let kapali = 0;
      for (const d of yon) {
        /* Yarım küre NORMALİN etrafında: yüzeyin arkasına atılan ışın her
           yüzeyi kendi gövdesiyle karartırdı. */
        let dx = d[0], dy = d[1], dz = d[2];
        if (dx * nn.x + dy * nn.y + dz * nn.z < 0) { dx = -dx; dy = -dy; dz = -dz; }
        let vuru = false;
        for (let s = 1; s <= enCokAdim; s++) {
          const x = px + dx * adim * s, y = py + dy * adim * s, z = pz + dz * adim * s;
          if (zemin && z < 0) { vuru = true; break; }
          const e = izgara.get(anahtar(Math.floor(x / hucre), Math.floor(y / hucre), Math.floor(z / hucre)));
          if (e !== undefined && e !== benim) { vuru = true; break; }
        }
        if (vuru) kapali++;
      }
      const ao = 1 - guc * (kapali / isin);
      /* TOZ. Giysinin hiçbir yerinde kullanım izi yoktu: dizde ve çizmede
         toz yok, tüm beyazlar aynı beyaz. Apollo fotoğraflarında tanınırlığın
         büyük kısmı buradan gelir - dizden aşağısı GRİDİR, çünkü regolit
         statik yüklüdür ve dokunduğu yere yapışır, silinmez.
         Aynı öznitelikte taşınır: bir renk kanalı iki işi birden yapar,
         ikinci bir malzeme kümesi gerekmez. */
      const h = Math.max(0, Math.min(1, (TOZ_TAVAN_M - v.z) / TOZ_TAVAN_M));
      const leke = 0.55 + 0.45 * ((Math.sin(v.x * 37.1 + v.y * 21.7 + v.z * 13.3) + 1) * 0.5);
      const toz = h * h * TOZ_GUCU * leke;
      renk[i * 3] = ao * (1 - toz * 0.85);
      renk[i * 3 + 1] = ao * (1 - toz * 0.88);
      renk[i * 3 + 2] = ao * (1 - toz * 1.00);
      koseSayisi++; toplam += ao;
    }
    g.setAttribute('color', new THREE.BufferAttribute(renk, 3));
  });
  return { koseSayisi, ortalama: koseSayisi ? toplam / koseSayisi : 1, hucre: izgara.size };
}
