/* mechanism-index.mjs — AKSAM DİZİNİ (three'siz, veri).
 *
 * craft-blocks kurucuları hareketli parçalarını `userData.rig.joints` ile
 * ilan eder; orada her eklemin DÜĞÜMÜ, EKSENİ, SINIRI ve HIZI vardır ama
 * eklemlerin hangi MEKANİZMAYI kurduğu yazmaz. Bu dosya o kümeleri adlandırır
 * ve her birine üç şey ekler:
 *
 *   · tür      — bağlantı (linkage), gimbal, menteşe, prizmatik, döner…
 *   · ilişki   — mekanizmayı yöneten BAĞINTI (formül), tek cümlede
 *   · neden    — o biçimin mühendislik gerekçesi (kurucudaki notun kardeşi)
 *   · kanıt    — bağıntıyı sınayan doğrulama adımı
 *
 * Serbestlik derecesi (DOF) burada ELLE yazılmaz: rig haritasından türetilir
 * (tek eksenli eklem 1, iki eksenli gimbal 2). Elle yazılan bir sayı, kurucu
 * değişince sessizce yanlışa döner.
 *
 * API:
 *   MECHANISMS            — { id: tanım }
 *   MECHANISM_IDS         — sıralı kimlikler
 *   mechanismDof(def, rig)          → sayı (rig haritasından)
 *   resolveMechanism(def, rig)      → { joints:[{ad, spec, bulundu}], dof, eksik:[] }
 */

export const MECHANISMS = Object.freeze({
  'rover.rockerBogie': {
    craft: 'rover', ad: 'Rocker-bogie süspansiyon', tur: 'bağlantı (linkage)',
    joints: ['rocker.L', 'rocker.R', 'bogie.L', 'bogie.R', 'differential'],
    odak: 'rockerL', kapsam: ['rockerL', 'rockerR', 'differential'],
    iliski: 'β = atan2(h_arka − h_orta, L_bogie) · ρ = atan2(h_pivot − h_ön, L_rocker) · gövde yunuslaması = (ρ_sol + ρ_sağ)/2',
    neden: 'Yay YOKTUR. İki kollu mekanizma, gövdeyi iki yanın ORTALAMASINDA tutan bir diferansiyele bağlıdır: bir tekerlek kendi çapına yakın bir kayaya tırmanırken diğer beşi yerde kalır. Yaylı süspansiyon bunu yapamaz, çünkü yay yükü aktarırken tekerleği yerden keser.',
    kanit: 'validate-rigs §2 (diferansiyel eşitliği, düz arazide sıfır) ve §10 (eğimli düzlemde yunuslama = düzlem eğimi, ±0,03°)',
  },
  'rover.steering': {
    craft: 'rover', ad: 'Ackermann direksiyon ve yerinde dönüş', tur: 'döner eklem takımı',
    joints: ['steer.FL', 'steer.FR', 'steer.RL', 'steer.RR'],
    odak: 'steerFL', kapsam: ['steerFL', 'steerFR', 'steerRL', 'steerRR'],
    iliski: 'tan δ_iç = L/(R − w/2) · tan δ_dış = L/(R + w/2) · R = 0 → köşeler ±atan(L/(w/2)) (yerinde dönüş)',
    neden: 'Yalnız DÖRT KÖŞE tekerleği döner; orta ikisi sabittir. Dört köşe, tek bir dönüş merkezi tanımlamaya yeter ve yerinde dönüşte altı tekerlek aynı çember üzerinde kayar — fazladan iki aktüatör kütle ve arıza yüzeyi demektir.',
    kanit: 'validate-rigs §3 (iç/dış açıların dönüş merkezi aynı nokta, ±1e−9)',
  },
  'rover.wheel': {
    craft: 'rover', ad: 'Çıtalı tekerlek ve yuvarlanma', tur: 'döner (serbest açı)',
    joints: ['wheel.FL'],          // TEK tekerlek incelenir; altı tekerlek aynı parçadır
    odak: 'wheelFL', kapsam: ['wheelFL'],
    iliski: 'ω r = v / (1 − s) · s = s₀ + k·tan(eğim) · yuvarlanma yarıçapı r = ÇITA DIŞ KÖŞESİ',
    neden: 'Çıtalar süs değil: gevşek regolitte düz jant kayar, çıta kazır. Bu yüzden zemine basan nokta jant değil çıtanın dış köşesidir ve θ = yol/r hesabı O yarıçapla yapılır — nominal jantla %8 hata, ekranda "tekerlek kayıyor" diye okunur.',
    kanit: 'validate-rigs §1 (odometre = ∫v dt, θ = odometre/r, kayma) ve §6 (stroboskop kuralı)',
  },
  'rover.arm': {
    craft: 'rover', ad: 'Robot kol (4 eklem + turet)', tur: 'seri kinematik zincir',
    joints: ['arm.j1', 'arm.j2', 'arm.j3', 'arm.turret'],
    odak: 'armJ1', kapsam: ['armJ1'],
    iliski: 'Seri zincir: T = T₁(z) · T₂(y) · T₃(y) · T_turet(z); erişim küresi kol boylarının toplamıyla sınırlı',
    neden: 'Azimut (z) + iki düzlemsel eklem (y) + turet: üç eklem bir noktaya, dördüncüsü aletin YÖNELİMİNE hizmet eder. Örnek almak için uç, yüzey normaline dik oturmalıdır; konum yetmez.',
    kanit: 'Ters kinematik HENÜZ YOK (plan §5.2, F3); bu sayfada eklemler elle sürülür',
  },
  'rover.mast': {
    craft: 'rover', ad: 'Direk pan-tilt', tur: 'iki eksenli kardan',
    joints: ['mast.pan', 'mast.tilt'],
    odak: 'mastPan', kapsam: ['mastPan'],
    iliski: 'Hız sınırı ≈ 12°/s; panorama = satır × sütun mozaiği (3 × 5), her karede duraklama',
    neden: 'Pan ekseni DİREK boyunca, tilt ekseni başın içindedir: sıra ters olsaydı tilt açıldıkça pan ufku eğerdi ve mozaik karesi kayardı.',
    kanit: 'validate-rigs §4 (hız sınırı ve sınır açısı fuzz, 10⁴ adım)',
  },
  'rover.hga': {
    craft: 'rover', ad: 'Yüksek kazançlı çanak (az-el)', tur: 'iki eksenli kardan',
    joints: ['hga.az', 'hga.el'],
    odak: 'hgaAz', kapsam: ['hgaAz'],
    iliski: 'İki eksen bir yön için yeter; zenitte az ekseni tekilleşir (keyhole)',
    neden: 'Çanak Dünya\'yı, gövde gezegeni izler; iki istek ayrı yönlerdir. Az-el düzeni ucuzdur ama zenit yakınında azimut hızı patlar — o bölge kör bölgedir.',
    kanit: 'Takip davranışı HENÜZ YOK (plan §5.3); mekanik sınır ve hız burada sürülür',
  },
  'lander.legStroke': {
    craft: 'lander', ad: 'Bal peteği iniş bacağı (strok)', tur: 'prizmatik, TEK YÖNLÜ',
    joints: ['leg.0.stroke', 'leg.1.stroke', 'leg.2.stroke', 'leg.3.stroke'],
    odak: 'leg0Stroke', kapsam: ['leg0Stroke'],
    iliski: 'strok = min(strok_max, E_kinetik / F_ezme) · tek yönlü: geri gitmez',
    neden: 'Alüminyum bal peteği TEK YÖNLÜ ve KALICI ezilir; iniş enerjisi ısıya döner. Yay olsaydı aracı geri fırlatır, ikinci bir temas yaratırdı.',
    kanit: 'validate-rigs §5b (tek yönlü strok: hedef 0 verilince geri çıkmaz)',
  },
  'rocket.tvc': {
    craft: 'rocket', ad: 'İtki vektör kontrolü (gimbal)', tur: 'iki eksenli kardan',
    joints: ['engine.gimbal'],
    odak: 'engineGimbal', kapsam: ['engineGimbal'],
    iliski: 'Tork = F · L · sin δ (L = gimbal → ağırlık merkezi); δ ≤ 8°',
    neden: 'Kalkışta hız sıfırdır, aerodinamik yüzey iş görmez: tek yönelim aracı itki vektörüdür. Ağırlık merkezi yakıt tükendikçe kayar, gimbal onu izler.',
    kanit: 'validate-rigs §4 (iki eksenli sınır ±6..8°, hız sınırı)',
  },
  'rocket.gridFin': {
    craft: 'rocket', ad: 'Kafes kanatçık (katlanır)', tur: 'menteşe',
    joints: ['gridFin.0.fold', 'gridFin.1.fold', 'gridFin.2.fold', 'gridFin.3.fold'],
    odak: 'gridFin0', kapsam: ['gridFin0'],
    iliski: 'Katlı 85° ↔ açık 0°, hız sınırı 45°/s',
    neden: 'Kafes yapı süpersonik akımda düz kanatçıktan iyi çalışır ve KATLANINCA yer kaplamaz — tırmanışta gövdeye yatar, geri dönüşte açılır.',
    kanit: 'validate-rigs §4 (sınır ve hız), §7 (roket programı)',
  },
  'rocket.fairing': {
    craft: 'rocket', ad: 'Başlık menteşesi (iki yarım)', tur: 'menteşe çifti',
    joints: ['fairing.L.open', 'fairing.R.open'],
    odak: 'fairingL', kapsam: ['fairingL', 'fairingR'],
    iliski: 'Menteşe başlığın TABANINDADIR; iki yarım ters yönde ±60° açılır, sonra bırakılır',
    neden: 'Başlık atmosfer bitince atılır: taşımak yakıta mal olur. İki yarım, tek parça bir kapaktan daha küçük bir açılma açısıyla yükü serbest bırakır ve yükü sıyırmadan uzaklaşır.',
    kanit: 'validate-astro (kapak eşiği q ≤ 0,4 Pa), validate-rigs §7',
  },
  'rocket.srb': {
    craft: 'rocket', ad: 'Katı yakıtlı itici ayrılması', tur: 'prizmatik, TEK YÖNLÜ (atılabilir)',
    joints: ['srb.0.jettison', 'srb.1.jettison'],
    odak: 'srb0', kapsam: ['srb0', 'srb1'],
    iliski: 'Ayırma motorları dışa + geriye iter; sonrasında yalnız balistik: p = v₀Δt + ½ a Δt²',
    neden: 'Katı itici KISILAMAZ ve SÖNDÜRÜLEMEZ: profili ateşlendiği an bellidir. Erken biter ve atılır, çünkü taşınan boş kütle kalan uçuşun tamamına ceza yazar. Gövde segmentlidir (sahada birleşir); nozul dışa kanıktır ki bileşke itki ağırlık merkezinden geçsin.',
    kanit: 'validate-astro "srb" grubu (9 denetim: tükenme anı, kütle defteri, Max-Q artışı)',
  },
  'cubesat.springDeploy': {
    craft: 'cubesat', ad: 'Yaylı panel açılımı', tur: 'menteşe + yay (ζ ≈ 0,25)',
    joints: ['wing.L.deploy', 'wing.R.deploy'],
    odak: 'wingL', kapsam: ['wingL', 'wingR'],
    iliski: 'Sönümlü salınım: x(t) = A e^{−ζωt} cos(ω_d t + φ); mekanik DAYANAKTA durur',
    neden: 'Kapta katlı duran panel, yanan-tel serbest bırakınca YAYLA açılır: aktüatör yok, tek kullanımlık ve hafif. Karşılığında hedefe yumuşak oturmaz — dayanağa çarpar ve 2–3 periyot salınır.',
    kanit: 'validate-rigs §5b (yaylı açılım aşar ama dayanakta durur; tek yönlü geri gitmez)',
  },
  'capsule.hatch': {
    craft: 'capsule', ad: 'Kapak menteşesi', tur: 'menteşe',
    joints: ['hatch.open'],
    odak: 'hatch', kapsam: ['hatch'],
    iliski: 'Menteşe kapağın KENARINDADIR; 0–100°',
    neden: 'Menteşe merkezde olsaydı kapak açılırken gövdeye girerdi. Basınçlı bir gövdede her açıklık yapısal bedeldir; kapak bu yüzden küçük ve tek parçadır.',
    kanit: 'validate-rigs §4 (sınır açısı)',
  },
  'helicopter.coaxial': {
    craft: 'marshelicopter', ad: 'Eş eksenli ters dönen rotorlar', tur: 'döner çift (sense ±1)',
    joints: ['rotor.lower', 'rotor.upper'],
    odak: 'rotorAlt', kapsam: ['rotorAlt', 'rotorUst'],
    iliski: 'Tepki torkları toplamı sıfır · f_çıta = kanat·ω/2π; f > 0,4·fps ise stroboskop → bulanıklık diski',
    neden: 'Tek rotor gövdeye tepki torku uygular ve gövde ters döner. İki rotoru ters çevirmek torku sıfırlar ve kuyruk kolunun kütlesinden kurtarır. Mars\'ta ρ Dünya\'nın ~%1,2\'si olduğu için rotor devasa ve hızlıdır (~2400 dev/dk).',
    kanit: 'validate-rigs §6 (80 Hz\'de bulanıklık açık, 10 Hz\'de kapalı; rpm rampası)',
  },
  'starship.flaps': {
    craft: 'starship', ad: 'Gövde flapleri (duruş kontrolü)', tur: 'menteşe dörtlüsü',
    joints: ['flap.FL', 'flap.FR', 'flap.RL', 'flap.RR'],
    odak: 'flapFL', kapsam: ['flapFL', 'flapFR', 'flapRL', 'flapRR'],
    iliski: 'Ön/arka ters işaret: yunuslama; sol/sağ ters işaret: yalpa. ±15°',
    neden: 'Flapler KANAT DEĞİLDİR: araç karnı önde, paraşütçü gibi iner. Amaç kaldırma değil, en büyük sürüklemeyi üretip enerjiyi yüksekte harcamak ve DURUŞU tutmaktır. Arka flapler büyüktür çünkü motor kütlesi ağırlık merkezini arkaya çeker.',
    kanit: 'validate-rigs §7 (starship programı, sınır ±15°)',
  },
  'orbiter.sada': {
    craft: 'orbiter', ad: 'Güneş kanadı tamburu (SADA)', tur: 'döner (sürekli)',
    joints: ['wing.L.sada', 'wing.R.sada'],
    odak: 'wingL', kapsam: ['wingL', 'wingR'],
    iliski: 'Sürekli dönüş, ≈ 0,5°/s; kanat normali Güneş\'e, gövde ekseni gezegene',
    neden: 'Gövde aletlerini gezegene, kanat hücrelerini Güneş\'e çevirmek zorundadır; yörünge ilerledikçe iki istek ayrışır. Tek eksenli tambur bu çatışmayı çözer — iki eksen gerekmez, çünkü yörünge düzlemi Güneş\'e göre yavaş değişir.',
    kanit: 'validate-rigs §7 (orbiter programı)',
  },
});

export const MECHANISM_IDS = Object.freeze(Object.keys(MECHANISMS));

/** Serbestlik derecesi rig haritasından TÜRETİLİR: iki eksenli gimbal 2,
    diğer her eklem 1. Bulunamayan eklem sayılmaz (ve `eksik`te bildirilir). */
export function resolveMechanism(def, rig) {
  const harita = (rig && rig.joints) || {};
  const joints = def.joints.map(ad => ({ ad, spec: harita[ad] || null, bulundu: !!harita[ad] }));
  const eksik = joints.filter(j => !j.bulundu).map(j => j.ad);
  const dof = joints.reduce((n, j) => n + (j.spec ? (Array.isArray(j.spec.axis) ? 2 : 1) : 0), 0);
  return { joints, dof, eksik };
}

/** Bir eklemin okunur sınır metni (derece / birim / serbest). */
export function limitText(spec) {
  if (!spec) return '—';
  if (spec.spin) return `serbest dönüş${spec.rpm ? ` · ${spec.rpm} dev/dk` : ''}${spec.spokes ? ` · ${spec.spokes} çıta` : ''}`;
  const [lo, hi] = spec.range || [0, 0];
  if (spec.mode === 'translate') return `${(lo * 100).toFixed(1)}–${(hi * 100).toFixed(1)} cm${spec.oneWay ? ' · tek yönlü' : ''}`;
  return `${lo}°…${hi}°${Array.isArray(spec.axis) ? ' (iki eksen)' : ''}${spec.spring ? ' · yay' : ''}${spec.oneWay ? ' · tek yönlü' : ''}`
    + `${spec.rateDegS ? ` · ${spec.rateDegS}°/s` : ''}`;
}
