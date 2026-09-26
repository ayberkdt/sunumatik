/**
 * DERİ — bir uzvun mafsalda KESİLMEYEN yüzeyi.
 *
 * Uzuvlar parça parça kuruluyordu: uyluk bir ağ, diz gövdesi bir küre, baldır
 * başka bir ağ. Mafsalda yüzeyin sürekli görünmesini sağlayan şey, aradaki
 * boşluğu dolduran küreydi; yüzeyin KENDİSİ sürekli değildi. Burada uzuv
 * kalçadan bileğe TEK bir süpürmedir ve mafsalda kesilmez; büküldüğünde
 * kesitler iki kemiğin arasında pay edilerek döner, yani yüzey bükülür.
 *
 * NEDEN CPU'DA. `THREE.SkinnedMesh` deformasyonu gölgelendiricide yapar ve
 * `geometry.attributes.position` BİND DURUŞUNDA kalır. Bu deponun kapılarının
 * neredeyse tamamı köşe konumu okur (zarf, kırpma, siluet, ek yeri, ritim);
 * GPU derisi onların hepsini kör ederdi - çizilen şeyle ölçülen şey ayrılırdı.
 * Burada deformasyon poz uygulanırken CPU'da yazılır, `position` her zaman
 * GERÇEKTEN çizilen yüzeydir ve bütün kapılar çalışmaya devam eder.
 * Maliyeti ölçüldü: bacak+kol için poz başına ~2.800 köşe.
 *
 * ÇERÇEVE. Bütün hesap KÖK KEMİĞİN yerel çerçevesinde yapılır, dünyada
 * değil. Bind matrisini kurulum anındaki dünya matrisinden almak, parçanın
 * sonradan başka bir düğüme eklenmesi ya da patlatma görünümünde taşınması
 * hâlinde sessizce bozulur. Kök çerçevesinde bağıntı yalnız mafsal
 * açılarına bağlıdır:
 *
 *     p = Σ wᵢ · Mᵢ(poz) · Mᵢ(bind)⁻¹ · p_bind
 *
 * `Mᵢ`, i'inci kemikten köke giden yerel matrislerin çarpımıdır. Ağ kök
 * kemiğin çocuğu olduğu için sonuç doğrudan ağın yerel koordinatıdır.
 */

/** Yumuşak geçiş: -1'de 0, +1'de 1, iki uçta da türevi sıfır. */
function yumusakAdim(x) {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

/**
 * Bir kemikten köke giden yerel matrislerin çarpımı.
 *
 * Kemiğin kendi `matrix`i KULLANILIR, `matrixWorld` değil: aradaki fark,
 * kökün üstündeki her şeyin (patlatma kayması, gövde eğimi, figürün yeri)
 * hesaba karışıp karışmadığıdır ve karışmamalıdır.
 */
function zincir(THREE, kemik, kokKemik, cikti) {
  cikti.identity();
  const yol = [];
  let n = kemik;
  while (n && n !== kokKemik) { yol.push(n); n = n.parent; }
  if (n !== kokKemik) {
    throw new Error('deri: kemik kök kemiğin altında değil');
  }
  for (let i = yol.length - 1; i >= 0; i--) {
    yol[i].updateMatrix();
    cikti.multiply(yol[i].matrix);
  }
  return cikti;
}

/**
 * DERİLİ UZUV.
 *
 * `kemikler`: köktten başlayarak [{ node, z }] - `z`, o kemiğin kök
 * çerçevesindeki eksenel yeri (uzuvlar -z'ye doğru iner, yani diz negatif).
 * İlk kemik kök olmalı ve `z = 0` vermelidir.
 *
 * `gecis`: mafsalın iki yanında ağırlığın 0'dan 1'e geçtiği yarı bant
 * (metre). Yumuşaklığın kendisi budur ve KATALOGDA beyan edilir - burada
 * uydurulmaz.
 *
 * Dönen: { mesh, guncelle } — `guncelle()` poz uygulandıktan sonra çağrılır.
 */
export function deriliUzuv(THREE, geo, mat, { kemikler, gecis }) {
  if (!Array.isArray(kemikler) || kemikler.length < 2) {
    throw new Error('deri: en az iki kemik gerekir');
  }
  if (kemikler[0].z !== 0) throw new Error('deri: kök kemiğin z değeri 0 olmalı');
  if (!(gecis > 0)) throw new Error('deri: geçiş yarıçapı beyan edilmeli');

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const pos = geo.attributes.position;
  const n = pos.count;
  /* Bind konumları ayrı tutulur: `position` her pozda ÜSTÜNE yazılır ve
     kaynak olarak kullanılamaz. */
  const bind = new Float32Array(n * 3);
  bind.set(pos.array.subarray(0, n * 3));

  /* AĞIRLIKLAR ÖLÇÜLMEZ, TÜRETİLİR. Süpürmede her köşenin eksenel yeri
     ZATEN bilinir; boyama ya da en yakın kemiği arama gerekmez. Bir köşe iki
     kemiğin arasında, mafsaldan olan eksenel uzaklığına göre pay edilir. */
  const K = kemikler.length;
  const agirlik = new Float32Array(n * K);
  for (let i = 0; i < n; i++) {
    const z = bind[i * 3 + 2];
    /* Her mafsal için: mafsalın ALTINDA kalan kemiğe geçiş. */
    const w = new Array(K).fill(0);
    w[0] = 1;
    for (let k = 1; k < K; k++) {
      const zm = kemikler[k].z;
      const gec = yumusakAdim((zm + gecis - z) / (2 * gecis));
      /* `gec` = 1 ise köşe tamamen alt kemiğe ait. Üstteki bütün pay alt
         kemiğe AKTARILIR, yoksa üç kemikte toplam 1'i aşar. */
      for (let j = 0; j < k; j++) { w[k] += w[j] * gec; w[j] *= (1 - gec); }
    }
    for (let k = 0; k < K; k++) agirlik[i * K + k] = w[k];
  }

  /* Bind zincirlerinin tersi: kurulum anında bütün mafsal açıları sıfırdır,
     yani bunlar saf ötelemelerdir - ama zincirden OKUNUR, elle yazılmaz. */
  const gecici = new THREE.Matrix4();
  const bindTers = kemikler.map((k) => zincir(THREE, k.node, kemikler[0].node,
    new THREE.Matrix4()).invert());
  const pozM = kemikler.map(() => new THREE.Matrix4());
  const kar = kemikler.map(() => new THREE.Matrix4());
  const v = new THREE.Vector3();
  const top = new THREE.Vector3();

  /* NORMALLER IZGARADAN. `computeVertexNormals` 15.224 üçgeni dolaşıp her
     köşede toplama yapıyor ve ölçüldü: poz başına 3,19 ms'lik derinin
     3,01 ms'si oradaydı - köşeleri TAŞIMAK 0,2 ms sürerken.
     Süpürmenin köşeleri zaten bir ızgara: çevrede `halka`, eksende `dilim`.
     Bir ızgara noktasının normali, içinden geçen iki teğetin vektörel
     çarpımıdır ve iki teğet de birer çıkarma uzaklıkta. */
  const iz = geo.userData.izgara;
  const nor = geo.attributes.normal;
  const ta = new THREE.Vector3(), tb = new THREE.Vector3(), nn = new THREE.Vector3();
  let normalIsaret = 0;                       // kurulumda ölçülür
  const koseAl = (dizi, i, hedef) => hedef.set(dizi[i * 3], dizi[i * 3 + 1], dizi[i * 3 + 2]);
  function normalGuncelle(dizi) {
    if (!iz || !nor) { geo.computeVertexNormals(); return; }
    const H = iz.halka, D = iz.dilim;
    const nd = nor.array;
    for (let i = 0; i <= D; i++) {
      for (let j = 0; j < H; j++) {
        const k = i * H + j;
        /* Çevre teğeti: komşu iki köşe. Eksen teğeti: alt ve üst halka;
           uçlarda tek yönlü fark. */
        koseAl(dizi, i * H + (j + 1) % H, ta);
        koseAl(dizi, i * H + (j + H - 1) % H, nn);
        ta.sub(nn);
        koseAl(dizi, Math.min(D, i + 1) * H + j, tb);
        koseAl(dizi, Math.max(0, i - 1) * H + j, nn);
        tb.sub(nn);
        nn.crossVectors(ta, tb);
        const uz = nn.length() || 1;
        nd[k * 3] = normalIsaret * nn.x / uz;
        nd[k * 3 + 1] = normalIsaret * nn.y / uz;
        nd[k * 3 + 2] = normalIsaret * nn.z / uz;
      }
    }
    /* Kapak merkezleri: uç halkanın eksen yönü. Kapaklar her zaman başka bir
       parçanın içinde kalıyor ama yanlış yöne bakan bir normal, o parça bir
       gün kalkarsa sessizce siyah bir yüzey bırakır. */
    const kapak = (D + 1) * H;
    if (nor.count > kapak) {
      nd[kapak * 3] = 0; nd[kapak * 3 + 1] = 0; nd[kapak * 3 + 2] = 1;
      if (nor.count > kapak + 1) {
        nd[(kapak + 1) * 3] = 0; nd[(kapak + 1) * 3 + 1] = 0; nd[(kapak + 1) * 3 + 2] = -1;
      }
    }
    nor.needsUpdate = true;
  }

  function guncelle() {
    for (let k = 0; k < K; k++) {
      zincir(THREE, kemikler[k].node, kemikler[0].node, pozM[k]);
      kar[k].multiplyMatrices(pozM[k], bindTers[k]);
    }
    const dizi = pos.array;
    /* SINIRLAR BU DÖNGÜDE ÇIKAR. `computeBoundingSphere` ile
       `computeBoundingBox` köşelerin üstünden birer tur daha atıyor ve
       ölçüldü: poz başına 6,64 ms'nin çoğu oradaydı. Köşeleri yazan döngü
       sınırları zaten görüyor. */
    let ax = Infinity, ay = Infinity, az = Infinity;
    let bx = -Infinity, by = -Infinity, bz = -Infinity;
    for (let i = 0; i < n; i++) {
      top.set(0, 0, 0);
      for (let k = 0; k < K; k++) {
        const w = agirlik[i * K + k];
        if (w === 0) continue;
        v.set(bind[i * 3], bind[i * 3 + 1], bind[i * 3 + 2]).applyMatrix4(kar[k]);
        top.addScaledVector(v, w);
      }
      dizi[i * 3] = top.x; dizi[i * 3 + 1] = top.y; dizi[i * 3 + 2] = top.z;
      if (top.x < ax) ax = top.x; if (top.x > bx) bx = top.x;
      if (top.y < ay) ay = top.y; if (top.y > by) by = top.y;
      if (top.z < az) az = top.z; if (top.z > bz) bz = top.z;
    }
    pos.needsUpdate = true;
    /* Normaller yeniden hesaplanır: bükülen bir yüzeyin eski normalleri,
       ışığı bükülmemiş yüzeyin normalleriyle hesaplar ve mafsal düz
       görünür. */
    normalGuncelle(dizi);
    if (!geo.boundingBox) geo.boundingBox = new THREE.Box3();
    geo.boundingBox.min.set(ax, ay, az);
    geo.boundingBox.max.set(bx, by, bz);
    if (!geo.boundingSphere) geo.boundingSphere = new THREE.Sphere();
    geo.boundingBox.getCenter(geo.boundingSphere.center);
    geo.boundingSphere.radius = 0.5 * Math.hypot(bx - ax, by - ay, bz - az);
  }

  /* NORMALİN YÖNÜ ÖLÇÜLÜR, VARSAYILMAZ. Izgaradan çıkan çarpım, sarım
     yönüne göre içeri de dışarı da bakabilir; hangisi olduğu bir kez, bind
     duruşunda, YARIÇAP yönüyle karşılaştırılarak bulunur. Varsaymak, bir gün
     ters sarılmış bir süpürmenin sessizce içeriden aydınlanması demekti -
     kapakların yıllarca içe bakması tam olarak böyle fark edilmemişti. */
  {
    normalIsaret = 1;
    normalGuncelle(bind);
    const i0 = Math.floor((iz?.dilim ?? 2) / 2) * (iz?.halka ?? 1);
    v.set(bind[i0 * 3], bind[i0 * 3 + 1], 0);
    const n0 = new THREE.Vector3(nor.getX(i0), nor.getY(i0), 0);
    if (v.lengthSq() > 1e-12 && n0.dot(v) < 0) normalIsaret = -1;
    normalGuncelle(bind);
  }

  void gecici;
  /* Kapılar için: hangi köşe hangi kemiğe ne kadar ait. */
  geo.userData.deri = { kemikSayisi: K, agirlik, gecis, bind };
  return { mesh, guncelle };
}
