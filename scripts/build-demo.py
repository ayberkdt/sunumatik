# -*- coding: utf-8 -*-
# Sunumatik CANLI KATALOG üreteci.
#
# Demo destesi elle yazılmaz: bu betik, küratörlü kart kataloğu + otomatik
# keşifle demo/index.html'i ÜRETİR. presets/ altına index.html taşıyan yeni
# bir klasör eklendiğinde katalogda kartı olmasa bile jenerik bir kartla
# "Yeni Bloklar" kategorisine kendiliğinden girer — "sonraki eklenen her
# özellik otomatik demoya eklensin" sözü burada yaşar.
#
# Kullanım:
#   python scripts/build-demo.py            → demo/index.html yazılır
#   python scripts/build-demo.py <repo_kök> → başka bir köke yazmak için
#
# Ürettikten sonra envanteri tazeleyin ve doğrulayın:
#   node scripts/build-registry.mjs && node scripts/validate-invariants.mjs
import io, os, sys, html, json, datetime

# ── Küratörlü katalog ────────────────────────────────────────────────────────
# src: keşif eşlemesi için kaynak dizin adı (None = dizin-dışı varlık).
# embed: demo/index.html'e GÖRE yol. status: cekirdek|guncel|klasik|arsiv.
KATEGORILER = [
    ("sinematik", "Sinematik Uzay Yolculuğu",
     "Sunum tek ve sürekli bir dünyada geçer: dış uzay → kokpit → bölüm seçimi → dalış."),
    ("orbital", "Yörünge Sahnesi",
     "Manim ayarında sahne blokları: bir yörünge ver, sahne onu gerçekten uçursun."),
    ("ml", "ML Sahneleri",
     "Gerçek matematik, gerçek gradyan, gerçek softmax — süs değil model."),
    ("havacilik", "Havacılık ve Akışkanlar",
     "Akım gerçekten çözülür: panel yöntemi, sınır tabakası, kafes Boltzmann."),
    ("haberlesme", "Haberleşme",
     "Anten kazancı, hüzme genişliği ve bağlantı bütçesi — hepsi aynı λ'dan."),
    ("gok", "Gök Cisimleri ve Fonlar",
     "Kapak ve kapanışların kahramanları: gerçek dokular, dürüst ışık."),
    ("anlatim", "Denklem ve Anlatım",
     "Bir elin yazdığı denklemler, adım adım türetmeler, figür üzerinde anlatım."),
    ("veri", "Veri, Grafik ve Hareket",
     "Keman grafikleri, morph geçişleri, tablo dolumu, sayfa geçişleri — deste tesisatı."),
    ("tasarim", "Tasarım Sistemi",
     "Kararı göz kararına bırakmayan katman: ölçülmüş renk, kompozisyon kılavuzu, tipografi."),
    ("ikon", "İkon Katmanları",
     "Üç katman: kahraman duotone, alan duotone, utility kontur. Katmanlar karışmaz."),
    ("arsiv", "Arşiv",
     "Yerini daha güçlü bloklara bırakanlar; eski desteler bozulmasın diye korunur."),
    ("yeni", "Yeni Bloklar",
     "Otomatik keşifle eklendi — kartı henüz yazılmadı."),
]

KARTLAR = [
    # ── Sinematik Uzay Yolculuğu ──
    dict(src=None, repo="cinematic_space", kat="sinematik",
         ad="Sinematik Uzay Sahnesi", status="cekirdek",
         embed="../presets/cinematic_space/index.html",
         hook="Slayt geçişi değil uzamsal yolculuk: Ay'ın yanındaki araca yaklaş, kanopiden süz, güvertedeki konsoldan bölüm seç — yörüngeye ya da gezgin vistasına.",
         feats=["Tek dünya + kokpit kabuğu: penceredeki Ay senkron değil, sahnenin KENDİSİ",
                "φ³ ölçüşmez frekanslı 'aktif tutunma' + tohumlu RCS pufları — tümü t'nin saf fonksiyonu",
                "Bölüm konsolu veri güdümlü; pencere-maskeli pass-through orbital_stage'i teslim alır",
                "İmza dalış: küre dolu karede arazi teslimi → buildRover belgesel planı (Esc geri sarar)"]),
    # ── Yörünge Sahnesi ──
    dict(src="orbital-stage-preset", repo="orbital_stage", kat="orbital",
         ad="Yörünge Sahnesi", status="cekirdek",
         embed="../presets/orbital_stage/index.html?tab=1",
         hook="Elemanları ver, gerçek koniği çizer: Hohmann transferi, Ay'a hiperbolik varış, yanma anında okunan ΔV.",
         feats=["Üç yörünge kaynağı: Kepler elemanları · durum dizisi (veri) · RK4 itki",
                "Yanma işaretleri: alev, ΔV oku, öncesi-sonrası hayalet yörüngeler",
                "Kamera yönetmeni: chase · orbit · body · free, yumuşak geçişli",
                "Zaman çizelgesi, sarma ve telemetri HUD (t, irtifa, |v|, ΔV)"]),
    dict(src="craft-blocks-preset", repo="craft_blocks", kat="orbital",
         ad="Araç Blokları", status="cekirdek",
         # DİKKAT: buraya `&t=` EKLEME — o, headless kare yakalamak için konan
         # sabit-zaman parametresidir ve sahneyi DONDURUR (alev oynamaz,
         # tornalar dönmez, Duraklat işlevsiz görünür). Canlı kart canlı kalmalı.
         embed="../presets/craft_blocks/index.html?fx=1&arac=rocket&tip=atmosfer&gaz=0.9",
         hook="Beş parametrik uzay aracı + sinematik ateşleme sistemi: mach elmaslı alevler, ateşleme flaşı, çan kızarması.",
         feats=["buildOrbiter · buildLander · buildRocket · buildCubesat · buildCapsule",
                "buildEngineFX: vakum · atmosfer · hover alev tipleri, gaz sürgüsü, Ateşle/Kes",
                "Ateşleme geçici rejimi: flaş + açılan halka + kıvılcım; sönüm kuyruğu",
                "Eksen sözleşmesi: +X ileri, −X itki çıkışı — sahneler buna güvenir"]),
    dict(src="lunar-descent-preset", repo="lunar_descent", kat="orbital",
         ad="Ay'a Motorlu İniş", status="cekirdek",
         embed="../presets/lunar_descent/index.html",
         hook="Üç fazlı iniş gerçek Ay yerçekimine karşı entegre edilir; yüzey artık gerçek 3B arazi — kraterler kendi gölgesini düşürür.",
         feats=["~550 kraterli yer değiştirme arazisi: yükseltilmiş kenarlar, ejecta, mare sırtlı ufuk",
                "Frenleme → yaklaşma → dikey iniş; craft-effects hover alevi entegre",
                "İrtifa / dikey hız / yakıt HUD'u, temas 0,90 m/s, temas anında toz",
                "Chase · yan · yüzey kameraları — arazi yüksekliğine karşı korumalı"]),
    dict(src="launch-ascent-preset", repo="launch_ascent", kat="orbital",
         ad="Fırlatma ve Tırmanış", status="cekirdek",
         embed="../presets/launch_ascent/index.html",
         hook="Rampadan yörüngeye gerçek entegre tırmanış: Max-Q hesaplanır, MECO ve SECO yörüngeden türetilir — zaman çizelgesine elle olay yazılmaz.",
         feats=["US76 atmosferi (Dünya ile döner) + C_D(M) sürükleme + basınca bağlı Isp; RK4 0,05 s",
                "Dikey kalkış → pitch kick → yerçekimi dönüşü (α = 0) → kapalı-döngü 2. kademe → SECO",
                "q(t) grafiği ve olay rayı simülasyondan; kayıp bütçesi (yerçekimi/sürükleme/yönlendirme) entegre",
                "Kule · takip · geniş kamera yönetmeni; craft_blocks roketi + atmosfer/vakum plümü; senaryo girdisi"]),
    dict(src="rendezvous-docking-preset", repo="rendezvous_docking", kat="orbital",
         ad="Randevu ve Kenetlenme", status="cekirdek",
         embed="../presets/rendezvous_docking/index.html",
         hook="Clohessy–Wiltshire ile gerçek göreli hareket: V-bar/R-bar yaklaşması, KOS, koridor, glideslope — ve 'hedefe doğru it' hatasının neden geriye sürüklediği.",
         feats=["LVLH çerçeve, kapalı biçim CW STM; hop = Φ_rv⁻¹ hedeflemesi, ΔV sahnede okunur",
                "V-bar beklemesi doğal, R-bar beklemesi sürekli itkili (a_x = −3n²x) — HUD mm/s² gösterir",
                "Hablani glideslope: üstel kapanma 0,50 → 0,05 m/s; LOS açısı, koridor ±10°, KOS 200 m",
                "Genel · kenetlenme · takip kameraları; düzlem-içi V-bar×R-bar çizimi; özel göreli durum girişi"]),
    dict(src="ground-track-3d-preset", repo="ground_track_3d", kat="orbital",
         ad="3B Yörünge + 2B Yer İzi", status="cekirdek",
         embed="../presets/ground_track_3d/index.html",
         hook="Aynı yörünge iki görünümde: eylemsiz yörünge dönen Dünya'nın üstünde, alt-uydu noktası haritada — iz çizilmez, koordinat dönüşümünden türetilir.",
         feats=["ECI Kepler → θ = θ₀ + ω_e t ile ECEF → lat = asin(z/r), lon = atan2(y,x) − θ; sarım temiz kesilir",
                "Eğiklik · RAAN · irtifa · e kaydırıcıları izi gerçekten değiştirir; tur başına kayma −ω_e·T okunur",
                "ISS · SSO · kutupsal · Molniya · GPS · GEO · Tundra presetleri; isteğe bağlı J2 seküler düğüm/perigee kayması",
                "3B: nadir çizgisi, küre üstü iz, Greenwich işareti; 2B: eşdikdörtgen harita, uçulan iz, artı imleç"]),
    dict(src="porkchop-explorer-preset", repo="porkchop_explorer", kat="orbital",
         ad="Porkchop / Fırlatma Penceresi", status="cekirdek",
         embed="../presets/porkchop_explorer/index.html?win=mars2020",
         hook="Kalkış × varış ızgarasının her hücresi bir Lambert çözümü: C3 yüzeyi, TOF eş-eğrileri, minimum ve seçili transferin heliosantrik geometrisi — hazır ısı haritası yok.",
         feats=["JPL yaklaşık Kepler elemanları (Standish) + evrensel-değişken Lambert, kısa/uzun yol; 3.600 çözüm ~40 ms",
                "C3 · v∞ varış · ΔV toplam yüzeyleri, marching-squares konturlar, ızgara minimumu işaretli",
                "Çapraz-kıl imleç: tıkla → kalkış, varış, TOF, C3, v∞, ΔV kalkış/tutunma, tip I/II, Δθ",
                "Yanda transfer yayı Kepler yayılımıyla, v∞ okları; Mars 2020 minimumu Perseverance penceresiyle örtüşür"]),
    dict(src="constellation-coverage-preset", repo="constellation_coverage", kat="orbital",
         ad="Takımyıldızı Kapsaması", status="cekirdek",
         embed="../presets/constellation_coverage/index.html?preset=iridium",
         hook="Walker Delta/Star parametrelerinden üretilen takımyıldız: kapsama konileri, ayak izleri, katlılık boyaması, kapsanmayan bölgeler ve zaman taramasıyla en uzun boşluk.",
         feats=["i:T/P/F sözdizimi; düzlem RAAN'ları ve faz parametreden — uydu rastgele konmaz",
                "Ayak izi λ = acos(R/(R+h)·cos ε) − ε; GPS 71,2°, Iridium 19,9° doğrulanmış",
                "Anlık kapsama oranı, katlılık, kapsanmayan %; yer istasyonundan görünen uydu ve en yüksek ε",
                "Zaman taraması: ortalama/en düşük kapsama, en uzun boşluk, sürekli kapsanan alan; GPS · Galileo · Iridium · LEO kabuğu · GEO halkası"]),
    dict(src="reentry-corridor-preset", repo="reentry_corridor", kat="orbital",
         ad="Giriş Koridoru", status="cekirdek",
         embed="../presets/reentry_corridor/index.html",
         hook="Koridor iki dekoratif eğri değil: sığ girişler atmosferden sekip çıkar, dik girişler g ve ısı tavanını aşar — sınırlar γ taraması ve bisection ile BULUNUR.",
         feats=["Düzlemsel giriş denklemleri (RK4), US76 atmosferi, L/D ve yatış açısı; Sutton–Graves ısı akısı ve ∫q̇ ısı yükü",
                "(h, v) düzleminde kapalı biçim eş-yavaşlama ve eş-ısı-akısı eğrileri; aşma ve altında-kalma sınır yörüngeleri",
                "Ay dönüşü kapsülü koridoru −7,1° … −4,9° (Apollo ≈ 2,4° genişlik) — bağımsız denetimde",
                "Kapsül · LEO kapsülü · kaldırmalı gövde · balistik sonda; v_E, γ_E, σ, n_max, q̇_max kaydırıcıları; tepe q̇ tepe g'den önce"]),
    dict(src="formation-flight-preset", repo="formation_flight", kat="orbital",
         ad="Formasyon Uçuşu", status="cekirdek",
         embed="../presets/formation_flight/index.html?sc=pco",
         hook="Şef/deputy göreli yörüngeleri: PCO'nun y–z'de daire, düzlem-içi 2:1 elips çizdiği ve 5 cm/s'lik hız hatasının formasyonu nasıl dağıttığı — CW ile.",
         feats=["PCO · GCO · düzlem-içi elips · lider–takipçi (GRACE tarzı) · sürüklenmesiz koşul ihlali; özel deputy listesi",
                "Kapalı biçim başlangıç durumları (ẏ₀ = −2n x₀); sekülar sürüklenme −(6n x₀ + 3ẏ₀) tabloda",
                "3B LVLH sahnesi + üç ortogonal izdüşüm; ayrım tablosu: ρ, R/V/H, şef–deputy ve deputy–deputy min–max",
                "rendezvous_docking ile aynı paylaşılan CW çözücüsü (core/astro-relative.mjs)"]),
    dict(src="cr3bp-lagrange-preset", repo="cr3bp_lagrange", kat="orbital",
         ad="CR3BP ve Lagrange Noktaları", status="cekirdek",
         embed="../presets/cr3bp_lagrange/index.html",
         hook="L1–L5 göz kararı konmaz, ∇Ω = 0'dan çözülür; Jacobi sabiti düşerken yasak bölgeler L1 → L2 → L3 → L4/L5 sırasıyla açılır — kaydırıcıyla izlenir.",
         feats=["Dünya–Ay · Güneş–Dünya · Güneş–Jüpiter; gradyan artıkları ~1e−16 tabloda; Güneş–Dünya L1 ≈ 1,49 milyon km",
                "Sıfır-hız eğrileri 2Ω = C (marching squares) + yasak bölge boyaması; etkin potansiyel alanı",
                "L1/L2 düzlemsel Lyapunov aileleri: STM diferansiyel düzeltme + genlik sürekliliği; parçacık RK4, |C − C₀| ~ 1e−12 canlı",
                "Dönen ↔ eylemsiz çerçeve yan yana: dönen çerçevede kapalı yörünge eylemsizde kapalı değildir"]),
    dict(src="gravity-assist-preset", repo="gravity_assist", kat="orbital",
         ad="Yerçekimi Yardımı ve B-Düzlemi", status="cekirdek",
         embed="../presets/gravity_assist/index.html",
         hook="Gezegen aracı 'öne çekmez': gezegen-göreli |v∞| korunur, yön δ döner; heliosantrik |V| çerçeve değişimiyle değişir — üç görünüm, tek model.",
         feats=["Gezegen-göreli hiperbol: asimptotlar, enberi, δ = 2 asin(1/e), B-düzlemi çizgisi ve B vektörü, hareket eden araç",
                "Heliosantrik: önce/sonra yörüngeler + hız üçgeni V = V_p + v∞ (|v∞| çemberi); ΔV = 2v∞ sin(δ/2), ΔE = V_p·Δv∞",
                "B-düzlemi hedef görünümü: T̂–R̂, çarpma dairesi R√(1+2μ/(Rv∞²)), B·T / B·R; θ ile arka/ön/düzlem-dışı geçiş",
                "Venüs · Dünya · Mars · Jüpiter · Satürn; Tisserand korunumu ve enberi vis-viva bağımsız denetimde"]),
    dict(src="attitude-gnc-preset", repo="attitude_gnc", kat="orbital",
         ad="Yönelim / GNC Laboratuvarı", status="cekirdek",
         embed="../presets/attitude_gnc/index.html?mode=slew",
         hook="Dönen küp değil GNC: Euler denklemleri, kuaterniyon PD, tepki tekerleği doyması, Dzhanibekov devrilmesi ve gimbal kilidi — hepsi entegre.",
         feats=["I ω̇ = −ω×(Iω + h_w) + τ − ḣ_w; q̇ = ½ q⊗ω (RK4, |q| = 1); K_p = Iω_n², K_d = 2ζω_n I",
                "Tekerlekler: τ_max ve h_max sınırı; sabit dış torkta h_max/τ sürede doyma → kontrol kaybı (momentum boşaltma dersi)",
                "Modlar: slew · serbest dönme (ara eksen kararsızlığı, T ve |H| korunumu) · doyma · gimbal kilidi (1/cos θ) · SLERP ↔ Euler",
                "Gövde/eylemsiz eksen üçlüleri, hedef hayaleti, boresight konisi, tekerlek çubukları, ω / hata / Euler grafikleri"]),
    dict(src="orbit-perturbations-preset", repo="orbit_perturbations", kat="orbital",
         ad="Yörünge Pertürbasyonları", status="cekirdek",
         embed="../presets/orbit_perturbations/index.html?sc=j2leo",
         hook="Pertürbasyon modelden çıkar: J2 düğüm gerilemesi RK4'ten, analitik sekülar doğru üstüne; sürükleme bozunması, SRP, Ay–Güneş sürüklenmesi.",
         feats=["İki-cisim + J2 + sürükleme (üstel-tablo termosferi, dönen atmosfer) + SRP (silindirik gölge) + Ay/Güneş",
                "Ω̇ sayısal vs analitik ±0,5 %; Molniya kritik eğiklikte ω sabit; SSO +0,986°/gün; H_z korunumu HUD'da",
                "3B yörünge yelpazesi + düğüm çizgisi; Ω, ω, irtifa/a, i/e grafiklerinde oskülatör · ortalama · sekülar",
                "Eleman kaydırıcıları, kuvvet anahtarları, süre; e ≈ 0'da ω tanımsız — sahne söyler ve enlem argümanını gösterir"]),
    dict(src="eclipse-geometry-preset", repo="eclipse_geometry", kat="orbital",
         ad="Tutulma, Örtülme ve Görünürlük", status="cekirdek",
         embed="../presets/eclipse_geometry/index.html",
         hook="Umbra/penumbra girişleri, istasyon AOS/LOS ve sensör/röle örtülmeleri elle yazılmaz: sonlu Güneş diski, dönen Dünya ve çizgi-görüş geometrisinden türetilir.",
         feats=["Konik gölge fonksiyonu ν (disk örtüşmesi); β açısı ve silindirik limit β* = asin(R/r); ISS umbra ≈ 33 dk/tur",
                "Yer istasyonu ECEF'te dönen Dünya ile: yükseklik/azimut, maske açısı, AOS/LOS bisection",
                "Sensör hedefi (yıldız) ve GEO röle için doğru parçası–küre örtülmesi, atmosfer teğet eşiği",
                "3B umbra/penumbra konileri + renklenen uydu; olay bantları ve ν(t)/ε(t) grafiği; ISS · SSO · Molniya · GPS · GEO"]),
    dict(src="conjunction-covariance-preset", repo="conjunction_covariance", kat="orbital",
         ad="Yakın Geçiş ve Kovaryans", status="cekirdek",
         embed="../presets/conjunction_covariance/index.html",
         hook="İki nokta neredeyse çarpışıyor değil: TCA bulunur, kovaryanslar karşılaşma düzlemine izdüşürülür, 2B P_c hesaplanır — ve seyrelme eğrisi 'büyük belirsizlik güvenli değildir' der.",
         feats=["TCA menzil minimizasyonuyla (altın oran); karşılaşma çerçevesi v_rel'e dik; TCA'da r_rel ⊥ v_rel denetimde",
                "RTN kovaryansları ECI'ye döndürülüp toplanır, düzleme izdüşürülür: 1/2/3σ elipsleri, Mahalanobis uzaklığı",
                "P_c = ∬ N(x;0,C₂) sert-gövde dairesinde (kısa karşılaşma, Gauss); limitler denetimde: πR²/(2π√|C|), → 1, → 0",
                "Seyrelme eğrisi P_c(k); senaryolar: nominal · yakın ıska · belirsiz ikincil · kafa kafaya; eşik kararı HUD'da"]),
    # ── ML ──
    dict(src="ml-loss-landscape-preset", repo="ml_loss_landscape", kat="ml",
         ad="Kayıp Yüzeyi", status="cekirdek",
         embed="../presets/ml_loss_landscape/index.html",
         hook="SGD, momentum ve Adam aynı gerçek gradyan üzerinde yarışır — izler süs değil, entegrasyondur.",
         feats=["Analitik bileşik yüzey + kapalı biçim ∇f",
                "Üç iyileştiricinin adım adım izleri",
                "Öğrenme oranı ve momentumun görünür etkisi"]),
    dict(src="ml-attention-flow-preset", repo="ml_attention_flow", kat="ml",
         ad="Dikkat Akışı", status="cekirdek",
         embed="../presets/ml_attention_flow/index.html",
         hook="softmax(QKᵀ/√d) sahnede gerçekten hesaplanır; yayların kalınlığı ağırlığın kendisidir.",
         feats=["Jeton şeritleri üzerinde ağırlıklı dikkat yayları",
                "Katman katman ilerleme, kafa seçimi",
                "Tohumlu deterministik matrisler — her oynatım aynı"]),
    dict(src="ml-net-builder-preset", repo="ml_net_builder", kat="ml",
         ad="Mimari Kurucu", status="cekirdek",
         embed="../presets/ml_net_builder/index.html?mimari=cnn",
         hook="Mimariyi tarif et, sahne onu blok blok kursun: her katman yerine otururken şekli ve parametre sayısı belirir.",
         feats=["Gerçek şekil çıkarımı: out = ⌊(in+2p−k)/s⌋+1, stride ve dolgu dahil",
                "Parametre sayıları doğrulanmış — küçük CNN 225.034 (Keras MNIST ile birebir)",
                "Kendi mimarini yaz ve kur; geçersiz tarifte anlaşılır Türkçe hata",
                "Hazır örnekler: CNN · MLP · rezidüel · dönüştürücü; kurulum sonrası ileri geçiş"]),
    dict(src="ml-layer-blocks-preset", repo="ml_layer_blocks", kat="ml",
         ad="Katman Blokları", status="cekirdek",
         embed="../presets/ml_layer_blocks/index.html",
         hook="On katman tipi, tek elden: ne yaptıkları renk kodundan değil geometrilerinden okunur.",
         feats=["buildConv · buildPool · buildDense · buildFlatten · buildNorm · buildActivation",
                "buildAttention · buildResidual · buildInput · buildOutput — donmuş API",
                "Evrişim filtre sayısıyla derinleşen dilim destesi; havuzlama küçülten kademe",
                "Her blok kendi giriş→çıkış şeklini ve parametre sayısını taşır"]),
    dict(src="ml-conv-vision-preset", repo="ml_conv_vision", kat="ml",
         ad="Evrişimli Görü", status="cekirdek",
         embed="../presets/ml_conv_vision/index.html?sahne=kaydir&adim=120",
         hook="Çekirdek görüntü üzerinde kayarken dokuz çarpım, toplamı ve doğan çıktı pikseli ekranda — evrişim gerçekten hesaplanır.",
         feats=["Sobel · Laplace · Gauss + tohumlu çekirdekler; altı filtre altı öznitelik haritası",
                "Adım ve dolgu değiştirilebilir; çıktı boyutu formülü canlı doğrulanır",
                "Maks/ortalama havuzlama, ReLU öncesi-sonrası, alıcı alan büyümesi",
                "Karar HOG yönelim histogramından — 'eğitilmiş model yok' rozeti her karede"]),
    dict(src="ml-loss-functions-preset", repo="ml_loss_functions", kat="ml",
         ad="Kayıp Fonksiyonları", status="cekirdek",
         embed="../presets/ml_loss_functions/index.html?adim=4",
         hook="Aykırı değeri sürükleyin: MSE'nin gradyanı doğrusal büyürken MAE ve Huber tavana çarpıp orada kalır.",
         feats=["MSE · MAE · Huber(δ) · log-cosh · BCE/CCE · hinge · focal(γ) — eğri VE türev",
                "Türevler merkezî farkla doğrulandı (en kötü sapma 4,3e−6)",
                "Aynı veri farklı kayıpla eğitilir: aykırısız EKK 2,260 · MSE 3,155 · Huber 2,456",
                "Focal bölümü ölçüme dayanır: γ kolay örneği bastırır, sınıf dengesini α yapar"]),
    dict(src="neural-network-preset", repo="neural_network", kat="ml",
         ad="Sinir Ağı Yürüyüşü", status="klasik",
         embed="../presets/neural_network/index.html",
         hook="İleri besleme ağını katman katman yürüten klasik anlatım sahnesi.",
         feats=["Aktivasyonların katman sırasıyla canlanması",
                "Ağırlık vurguları ve akış okları"]),
    # ── Havacılık ──
    dict(src="aircraft-blocks-preset", repo="aircraft_blocks", kat="havacilik",
         ad="Uçak Blokları", status="cekirdek",
         embed="../presets/aircraft_blocks/index.html?arac=airliner",
         hook="Kanatlar kutu değil: gerçek NACA kesitinden loft edilir ve referans geometri meshi üreten tablodan ÖLÇÜLÜR.",
         feats=["Altı arketip: yolcu uçağı · savaş uçağı · ojiv delta · waverider · planör · uçan kanat",
                "Açıklık oranı 0,37'den 31,3'e — tek sayı uçağın ne işe yaradığını anlatır",
                "Kesit düzlemi kanadı gerçekten keser; çizilen profil meshin o istasyondaki kesiti",
                "Savaş uçağında ölçülen planform ile referans trapez %14,2 ayrışır: fark LERX alanıdır"]),
    dict(src="aero-airfoil-flow-preset", repo="aero_airfoil_flow", kat="havacilik",
         ad="Profil Etrafında Akım", status="cekirdek",
         embed="../presets/aero_airfoil_flow/index.html?naca=2412&a=6",
         hook="Doğrusal şiddetli vorteks paneli + Thwaites–Michel–Head sınır tabakası. Ekrandaki hiçbir eğri elle çizilmedi.",
         feats=["Doğrulandı: α_L0 −2,15° (lit. −2,1) · M_kritik 0,744 (lit. 0,74) · durma Cp 0,9957",
                "Kutta koşulu KAPATILABİLİR: Γ = 0, kaldırma sıfır, akım keskin firardan dolanır",
                "Eşit geçiş süresi efsanesi ÖLÇÜLÜR: üstteki parçacık %18 daha erken varır",
                "Cl iki bağımsız yoldan hesaplanır (Kutta–Jukovski ve basınç integrali), farkı ekranda"]),
    dict(src="aero-shock-waves-preset", repo="aero_shock_waves", kat="havacilik",
         ad="Şok ve Genleşme Dalgaları", status="cekirdek",
         embed="../presets/aero_shock_waves/index.html?m=2&a=4&e=5.7",
         hook="Açılar θ-β-M bağıntısından çözülür; parçacıklar şoku geçerken aynı anda döner, yavaşlar ve sıklaşır.",
         feats=["NACA 1135 tablolarıyla dört hane uyum: M=2, θ=10° → β 39,31° · M₂ 1,6405 · p₂/p₁ 1,7066",
                "θ_max aşılınca şok KOPAR: yapışık şok gider, önde Billig yay şoku durur",
                "Şok–genleşme teorisi Ackeret'le %1,3'ten %2,4'e ayrışır — doğrusallaştırmadan beklenen tam bu",
                "M ≥ 5'te sayfa mükemmel gaz kabulünün bozulduğunu kendisi söyler"]),
    dict(src="aero-vortex-street-preset", repo="aero_vortex_street", kat="havacilik",
         ad="Kármán Vorteks Caddesi", status="cekirdek",
         embed="../presets/aero_vortex_street/index.html?re=100",
         hook="Salınım hiçbir yerde programlanmadı: kafes Boltzmann denklemleri çözülüyor ve cadde kendiliğinden doğuyor.",
         feats=["ÖLÇÜLEN Strouhal 0,157 · Roshko bağıntısı 0,167 — %6,2 fark, elle konsa bu karşılaştırmanın anlamı olmazdı",
                "Re 40'ta salınım YOK (kritik Re ≈ 47'nin altı), Re 100'de tam cadde — geçiş kendiliğinden",
                "D2Q9 + TRT çarpışma: Λ = 3/16 sıçratmalı duvarı iki düğümün tam ortasına oturtur",
                "Reynolds üst sınırı 120 ölçülmüş bir sınırdır: 140'ta çözüm 9 000 adımdan önce ıraksıyor"]),
    # ── Haberleşme ──
    dict(src="comms-antenna-preset", repo="comms_antenna", kat="haberlesme",
         ad="Anten ve Yer İstasyonu", status="cekirdek",
         embed="../presets/comms_antenna/index.html?b=X&d=34",
         hook="Cassegrain çanak; hüzme konisinin açısı kazancı veren aynı λ'dan gelir — banda basınca ikisi birlikte değişir.",
         feats=["Doğrulandı: DSN 34 m X bandı 68,5 dBi (literatür ~68,3), hüzme 4,4 yay dakikası",
                "Verim tek sayı değil: gölgeleme ve Ruze yüzey terimi geometriden HESAPLANIR",
                "Ruze çöküşü ekranda: 0,5 mm yüzey hatası S'te %0,2, Ka'da %36 kayıp",
                "Azimut–elevasyon montajı, alt yansıtıcı, dört ayak, besleme boynuzu"]),
    dict(src="comms-link-budget-preset", repo="comms_link_budget", kat="haberlesme",
         ad="Bağlantı Bütçesi", status="cekirdek",
         embed="../presets/comms_link_budget/index.html?b=X&m=marsUzak&r=6.301",
         hook="Şelale, 282 dB'lik serbest uzay kaybı ile 68 dB'lik anten kazancını aynı eksende toplar; sonuç tek sayı: marj.",
         feats=["Doğrulandı: GEO 12 GHz 205,1 dB (literatür 205,2) · Mars uzak X bandı 282,5 dB",
                "Aynı bağlantı dört bantta: S −13,8 dB marj, X −2,7, Ku +1,3, Ka +6,5",
                "Yağmur ITU-R P.838 ile: 25 mm/saatte S 0,03 dB, Ka 8,8 dB",
                "Shannon sınırı, ışık gecikmesi ve Doppler aynı çözümden"]),
    # ── Gök cisimleri ──
    dict(src="sol-vanilla-preset", repo="sun_advanced", kat="gok",
         ad="Güneş", status="guncel",
         embed="../presets/sun_advanced/index.html",
         hook="Granülasyon, tayflı korona ve ışık halkası — kapanış slaytlarının kahramanı.",
         feats=["Katmanlı korona, yumuşak düşüşlü parlaklık",
                "Deste paletine uyan sıcaklık tonları"]),
    dict(src="lunaris-vanilla-preset", repo="moon_advanced", kat="gok",
         ad="Ay", status="guncel",
         embed="../presets/moon_advanced/index.html",
         hook="Gerçek albedo ve yükseklik dokularıyla dönen, sürüklenebilir Ay.",
         feats=["Gerçek NASA dokuları", "Fare ile döndürme, atalet"]),
    dict(src="terra-vanilla-preset", repo="earth_advanced", kat="gok",
         ad="Dünya", status="guncel",
         embed="../presets/earth_advanced/index.html",
         hook="Gündüz-gece dokuları ve atmosfer kenarıyla Dünya küresi.",
         feats=["Gündüz / gece doku geçişi", "Atmosfer saçılım kenarı"]),
    dict(src="planetae-vanilla-preset", repo="planets_advanced", kat="gok",
         ad="Gezegenler", status="guncel",
         embed="../presets/planets_advanced/index.html",
         hook="Gezegen aileleri tek sahnede — karşılaştırmalı anlatım için.",
         feats=["Gerçek doku seti", "Ölçek ve sıralama anlatımı"]),
    dict(src="cosmos-vanilla-preset", repo="cosmos_advanced", kat="gok",
         ad="Kozmos Fonu", status="cekirdek",
         embed="../presets/cosmos_advanced/index.html",
         hook="ESO'nun 360° Samanyolu panoraması (S. Brunier) gerçek doku olarak — fon artık süs değil, gökyüzünün kendisi.",
         feats=["ESO/S. Brunier panoraması, CC BY 4.0 — kredi zorunlu",
                "Prosedürel yıldız katmanları + derinlik paralaksı",
                "Dekor modu: başlık slaytları için sakin varyant"]),
    dict(src="aurora-preset", repo="aurora", kat="gok",
         ad="Aurora", status="cekirdek",
         embed="../presets/aurora/index.html?kp=5&yogunluk=0.4",
         hook="Renkler keyfi değil: atom yoğunluğunu artırın, 630 nm kırmızı çarpışmayla fiziksel olarak sönsün.",
         feats=["Emisyon çizgisi sürgüleri: 557,7 yeşil · 630,0 kırmızı · 427,8 mavi · N₂ pembe",
                "Sönümleme gerçek: τ≈110 s'lik O(¹D) yoğun havada ışıyamaz — kırmızı yalnız ≳200 km",
                "Aktivite Kp 0–9: homojen yay → ışınlı → katlanan perde → alt fırtına kopması",
                "Yükseklik ekseni, çökelme tepesi ve 630,0 tabanı işaretli; deste fonu olarak takılır"]),
    dict(src="jwst-explorer-preset", repo="jwst_explorer", kat="gok",
         ad="JWST Kaşifi", status="cekirdek",
         embed="../presets/jwst_explorer/index.html",
         hook="On gerçek James Webb karesi, görsel olarak doğrulanmış 35 ilgi noktası; yaylı kamera hedefe süzülür.",
         feats=["Yay-sönüm kamera (k=120, c=22), log uzayında yakınlaşma",
                "Her karede adlandırılmış ilgi noktaları ve anlatı metni",
                "STScI kaynak kayıtları ve lisans notları pakette"]),
    # ── Denklem ve anlatım ──
    dict(src="equation-writing-preset", repo="equation_pen", kat="anlatim",
         ad="Denklem Kalemi", status="guncel",
         embed="../presets/equation_pen/index.html",
         hook="Denklemi bir el yazar gibi çizer — kalem izi, gerçek yazma temposu.",
         feats=["Vuruş sırasına sadık çizim", "Desteyle aynı TeX dizgisi"]),
    dict(src="equation-steps-preset", repo="equation_steps", kat="anlatim",
         ad="Türetme Adımları", status="guncel",
         embed="../presets/equation_steps/index.html",
         hook="Terim terim türetme: her adımda ne değişti, göz kaybetmeden izler.",
         feats=["Terim vurgulama ve taşıma", "Adım adım ilerleme kontrolü"]),
    dict(src="figure-callout-preset", repo="figure_callouts", kat="anlatim",
         ad="Figür Anlatımı", status="guncel",
         embed="../presets/figure_callouts/index.html",
         hook="Bir figürün üzerinde adım adım işaretli anlatım — bakışı yöneten oklar ve maskeler.",
         feats=["Adımlı vurgu bölgeleri", "Karartma maskesi ile odak"]),
    dict(src="timeline-preset", repo="timeline_tree", kat="anlatim",
         ad="Zaman Çizelgesi", status="klasik",
         embed="../presets/timeline_tree/index.html",
         hook="Dallanan kronoloji ağacı — tarihsel akış slaytları için.",
         feats=["Dallı zaman çizgisi", "Aşamalı ortaya çıkış"]),
    # ── Veri, grafik, hareket ──
    dict(src=None, repo="charts_icons", kat="veri",
         ad="Grafik Motoru", status="cekirdek",
         embed="../presets/charts_icons/chart-preset/index.html",
         hook="Koreografili grafik motoru: eksenler süpürülür, çizgi komet başıyla çizilir, veri güncellemesi delta çipleriyle akar.",
         feats=["enter(): eksen → grid → tik → veri; komet başı + canlı odometre okuması",
                "setData(): FLIP geçişi, eksen tik'leri odometre gibi yeniden numaralanır",
                "vurgula()/sahnele(): tek nabız + iddia notu; adım adım anlatı modu",
                "Keman KDE, morphTo(), sheen(), saçılım damla yağmuru + fit süpürmesi"]),
    dict(src=None, repo="motion_core", kat="veri",
         ad="Hareket Primitifleri", status="guncel",
         embed="../presets/motion_core/primitives-preview.html",
         hook="Motion-primitives'ten uyarlanan giriş efektleri: odometre sayaçlar, harf harf başlıklar, yumuşak beliriş.",
         feats=["Odometre sayı akışı", "Kademeli harf/kelime girişi", "Reveal zinciri"]),
    dict(src=None, repo="motion_core", kat="veri",
         ad="Tablo Sahnesi", status="cekirdek",
         embed="../presets/motion_core/table-motion-preview.html",
         hook="Tablolar sahneye çıkar: odometre silindirleri, toplam satırına akan ışık izleri, FLIP sıralama, sütun düellosu.",
         feats=["Yönetmenli giriş + gerçek odometre dolumu (data-count)",
                "data-total-of: toplam hücresine süzülen akış izi — toplamın kaynağı görünür",
                "tabloSirala(): FLIP yeniden sıralama; data-duel: fark çipli sütun düellosu",
                "Satır spotlight anlatısı + hücre içi kendini çizen sparkline"]),
    dict(src=None, repo="motion_core", kat="veri",
         ad="Slayt Geçişleri", status="guncel",
         embed="../presets/motion_core/slide-transition-preview.html",
         hook="Sayfalar arası sinematik geçişler ve morph sürekliliği — kesme yok, akış var.",
         feats=["Yön duyarlı kaydırma ve perde geçişleri", "Ortak öğe morph'u"]),
    dict(src=None, repo="motion_core", kat="veri",
         ad="Etkileşim Efektleri", status="guncel",
         embed="../presets/motion_core/interaction-preview.html",
         hook="İmleç ve odak tepkileri: mıknatıs düğmeler, eğilen kartlar, iz bırakan vurgular.",
         feats=["Hover / odak mikro animasyonları", "Dokunmatik güvenli davranış"]),
    dict(src=None, repo="composition", kat="tasarim",
         ad="Kompozisyon Kılavuzu", status="cekirdek",
         embed="../presets/composition/composition-demo.html?bolum=ucler",
         hook="Üçler, çerçeve içinde çerçeve, yönlendiren çizgiler — her ilke önce/sonra ve altında canlı ölçümle.",
         feats=["olcCompozisyon(): kesişime uzaklık, optik merkez sapması, boş alan oranı",
                "Açılıp kapanan kılavuz katmanı; dışa aktarımda tek piksel çizmez",
                "Kütüphaneye özgü kural: metin sütuna, figür üçlere (640 ile 645,33 çakışmaz)",
                "Altın oran dürüstlüğü: 16:9 altın dikdörtgen değil, fark yatayda ~93 px"]),
    dict(src=None, repo="color_themes", kat="tasarim",
         ad="Tipografi Sistemi", status="cekirdek",
         embed="../presets/color_themes/typography-preview.html",
         hook="Yedi açık lisanslı aile ve altı görüntü muamelesi — kraterli Ay başlığı dahil.",
         feats=["Türkçe üç yolla doğrulandı: cmap · gerçek render · yedek-font sondası",
                "Orbitron ELENDİ: latin-ext altkümesi yok, ğ Ğ İ ş Ş taşımıyor",
                "Muameleler: ay · gravür · ısıl · yıldız · baskı · buz — 12 kombinasyon 4,5:1 üstü",
                "Tabular figures ÖLÇÜLDÜ: Fraunces ve Big Shoulders sayı sütununa girmez"]),
    dict(src=None, repo="color_themes", kat="tasarim",
         ad="Palet Galerisi", status="cekirdek",
         embed="../presets/color_themes/palette-gallery.html",
         hook="37 palet ve 8 geçiş, ölçülmüş kontrastlarıyla: ikili paletler açık ve koyu eşiyle yan yana.",
         feats=["data-palette ile tek satırda tema; --data-1..6 ve --ramp-seq/div jetonları",
                "Her kontrast WCAG ile ÖLÇÜLDÜ; eşiği geçmeyen çift 'yalnız gösterim' damgalı",
                "Geçişlerde metin güvenliği en kötü noktaya göre + gereken perde opaklığı",
                "Tıkla-kopyala hex, arama ve açık/koyu süzgeci"]),
    # ── İkonlar ──
    dict(src=None, repo="charts_icons", kat="ikon",
         ad="Alan İkonları", status="cekirdek",
         embed="../presets/charts_icons/domain-icons/preview.html",
         hook="Matematikten itkiye 276 duotone ikon, sekiz aile, tek elden: .16 dolgu + 1,8 kontur + tek dolu odak.",
         feats=["Aileler: matematik · sinyal-kontrol · fizik · astrodinamik · GNC · itki · roket-uydu · ML-kozmos",
                "Bilimsel dürüstlük: gerçek nav-ball işaretleri, açık hiperbol",
                "Arama + tıkla-kopyala önizleme"]),
    dict(src=None, repo="charts_icons", kat="ikon",
         ad="Utility İkonlar", status="guncel",
         embed="../presets/charts_icons/icon-library/preview.html",
         hook="168 ince kontur ikon — ok, durum, gezinme gibi tesisat işleri için; duotone ile aynı slaytta karışmaz.",
         feats=["Lucide/Tabler kökenli, lisansları pakette",
                "validate-icon-usage.mjs karışımı uyarır"]),
    dict(src=None, repo="charts_icons", kat="ikon",
         ad="Kahraman Bilim İkonları", status="guncel",
         embed="../presets/charts_icons/icons/icons-preview.html",
         hook="Kapak ve bölüm açılışları için 23 büyük duotone kahraman ikon.",
         feats=["Alan setiyle aynı çizim dili", "Büyük boyutta test edilmiş"]),
    # ── Arşiv ──
    dict(src="lunar-orbit-preset", repo="lunar_orbit", kat="arsiv",
         ad="Analitik Ay Yörüngesi", status="arsiv",
         embed="../presets/lunar_orbit/index.html",
         hook="Yerini Yörünge Sahnesi aldı; eski desteler bozulmasın diye repoda duruyor.",
         feats=["Yeni işler için: orbital_stage kullanın"]),
]

# Keşif dışı tutulan preset klasörleri (bilerek demo dışı):
KESIF_DISI = {"moon_react_source",  # React kaynak paketi, canlı demosu yok
              "deck_starter",       # deste iskeleti — katalog kartı anlamsız
              "equation_theme"}     # yalnız CSS teması, gösterilecek sahnesi yok

def kesfet(repo_kok):
    """Katalogda kartı olmayan yeni preset klasörlerini bul → jenerik kart.
    Keşif deponun kendi presets/ ağacından yapılır: index.html taşıyan ve
    KARTLAR'da 'repo' adıyla geçmeyen her klasör jenerik kartla girer."""
    bilinen = {k["repo"] for k in KARTLAR} | KESIF_DISI
    yeni = []
    presets = os.path.join(repo_kok, "presets")
    if not os.path.isdir(presets):
        return yeni
    for d in sorted(os.listdir(presets)):
        if d in bilinen or not os.path.isfile(os.path.join(presets, d, "index.html")):
            continue
        yeni.append(dict(src=None, repo=d, kat="yeni", ad=d.replace("_", " ").title(),
                         status="yeni", embed=f"../presets/{d}/index.html",
                         hook="Otomatik keşifle eklendi — kartı henüz yazılmadı. "
                              "build-demo.py içindeki KARTLAR listesine küratörlü kartını ekleyin.",
                         feats=["Kaynak: presets/" + d]))
        print(f"KEŞİF: presets/{d} (jenerik kartla demoya eklendi)")
    return yeni

STATUS_ETIKET = {"cekirdek": "ÇEKİRDEK", "guncel": "GÜNCEL", "klasik": "KLASİK",
                 "arsiv": "ARŞİV", "yeni": "YENİ"}

def esc(s): return html.escape(s, quote=True)

def uret(repo_kok):
    kartlar = KARTLAR + kesfet(repo_kok)
    gruplar = []           # (kat_id, başlık, açıklama, [kart...])
    for kid, baslik, aciklama in KATEGORILER:
        icerik = [k for k in kartlar if k["kat"] == kid]
        if icerik:
            gruplar.append((kid, baslik, aciklama, icerik))

    bugun = datetime.date.today().strftime("%d.%m.%Y")
    n_preset = len(kartlar)
    n_kat = len([g for g in gruplar if g[0] not in ("arsiv", "yeni")])

    slaytlar = []

    # ── kapak ──
    slaytlar.append(f"""
<section class="slide cover" data-tur="kapak">
  <div class="stars" aria-hidden="true"></div>
  <p class="eyebrow">SUNUMATİK</p>
  <h1>Canlı Katalog</h1>
  <p class="sub">{n_preset} preset · {n_kat} kategori · her kart canlı çalışır</p>
  <p class="not">Bu deste <b>otomatik üretilir</b> — kütüphaneye eklenen her yeni preset,
     bir sonraki aktarımda kendiliğinden burada belirir.</p>
  <p class="hint">→ ile ilerleyin · <kbd>G</kbd> dizin · <kbd>Esc</kbd> kapat</p>
  <p class="tarih">{bugun}</p>
</section>""")

    no = 0
    for kid, baslik, aciklama, icerik in gruplar:
        no += 1
        adlar = " · ".join(k["ad"] for k in icerik)
        slaytlar.append(f"""
<section class="slide divider" data-tur="bolum" data-kat="{kid}">
  <p class="num">{no:02d}</p>
  <h2>{esc(baslik)}</h2>
  <p class="sub">{esc(aciklama)}</p>
  <p class="uyeler">{esc(adlar)}</p>
</section>""")
        for k in icerik:
            st = k["status"]
            feats = "\n".join(f"      <li>{esc(f)}</li>" for f in k["feats"])
            url = k["embed"]
            slaytlar.append(f"""
<section class="slide card" data-tur="kart" data-kat="{kid}" data-embed="{esc(url)}">
  <div class="bilgi">
    <p class="eyebrow">{esc(baslik)} <span class="badge {st}">{STATUS_ETIKET[st]}</span></p>
    <h2>{esc(k["ad"])}</h2>
    <p class="hook">{esc(k["hook"])}</p>
    <ul class="feats">
{feats}
    </ul>
    <p class="yol"><code>{esc(url.replace("../", ""))}</code></p>
    <a class="ac" href="{esc(url)}" target="_blank" rel="noopener">Yeni sekmede aç ↗</a>
  </div>
  <div class="sahne">
    <div class="yukleniyor">canlı önizleme —<br>slayt açılınca yüklenir</div>
    <iframe title="{esc(k["ad"])} önizleme" loading="lazy" data-src="{esc(url)}"></iframe>
  </div>
</section>""")

    # ── kapanış ──
    slaytlar.append(f"""
<section class="slide closing" data-tur="kapanis">
  <div class="stars" aria-hidden="true"></div>
  <h2>Blok blok bir deste kurun</h2>
  <p class="sub">Bütün bu parçaların birlikte çalıştığı 20 slaytlık örnek deste:</p>
  <a class="buyuk-link" href="ornek-deste.html">ornek-deste.html →</a>
  <p class="not">Yolda olanlar (2. dalga): fırlatma-tırmanış · buluşma-kenetlenme · yer izi 3B ·
     porkchop · takım uydu kapsaması · atmosfere giriş koridoru · formasyon uçuşu ·
     gömme projektörü · evrişim görüsü · çizge mesajlaşması</p>
  <p class="tarih">build-demo.py · {bugun}</p>
</section>""")

    govde = "\n".join(slaytlar)
    toplam = govde.count('<section')

    # ── dizin (TOC) verisi ──
    toc = []
    i = 0
    for m_ad, m_tur, m_kat in _slayt_meta(gruplar):
        toc.append(dict(i=i, ad=m_ad, tur=m_tur, kat=m_kat))
        i += 1
    toc_json = json.dumps(toc, ensure_ascii=False)

    sayfa = SABLON.replace("{GOVDE}", govde).replace("{TOC}", toc_json) \
                  .replace("{TOPLAM}", str(toplam))
    hedef = os.path.join(repo_kok, "demo", "index.html")
    os.makedirs(os.path.dirname(hedef), exist_ok=True)
    io.open(hedef, "w", encoding="utf-8", newline="").write(sayfa)
    print(f"demo üretildi: {hedef} · {toplam} slayt · {n_preset} kart")
    return hedef

def _slayt_meta(gruplar):
    yield ("Kapak", "kapak", "")
    for kid, baslik, _, icerik in gruplar:
        yield (baslik, "bolum", kid)
        for k in icerik:
            yield (k["ad"], "kart", kid)
    yield ("Kapanış", "kapanis", "")

# ── sayfa şablonu ────────────────────────────────────────────────────────────
SABLON = r"""<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sunumatik — Canlı Katalog</title>
<style>
:root {
  --bg:#0F1013; --sf:#1A1C21; --sf2:#22242B; --ink:#F4EEE1; --mut:#A9A296;
  --acc:#D3B26A; --acc-ink:#191307; --rule:#2E3037; --ok:#8FBF8F;
  --font: Bahnschrift, 'Segoe UI Semibold', 'Segoe UI', system-ui, sans-serif;
  --mono: 'Cascadia Mono', Consolas, monospace;
}
* { box-sizing: border-box; margin: 0; }
html, body { height: 100%; background: var(--bg); color: var(--ink);
  font-family: var(--font); overflow: hidden; }
#viewport { position: fixed; inset: 0; }
#stage { position: absolute; left: 50%; top: 50%; width: 1920px; height: 1080px;
  transform-origin: center center; }

.slide { position: absolute; inset: 0; padding: 72px 96px; visibility: hidden;
  opacity: 0; transition: opacity .45s ease; }
.slide.gecerli { visibility: visible; opacity: 1; }

/* ── kapak / kapanış ── */
.cover, .closing { display: flex; flex-direction: column; justify-content: center;
  align-items: flex-start; padding-left: 160px;
  background: radial-gradient(1200px 700px at 70% 20%, #171a24 0%, var(--bg) 60%); }
.stars { position: absolute; inset: 0; pointer-events: none; opacity: .8;
  background-image:
    radial-gradient(1.4px 1.4px at 12% 22%, #cfd6e4 50%, transparent 51%),
    radial-gradient(1px 1px at 28% 68%, #8d94a5 50%, transparent 51%),
    radial-gradient(1.8px 1.8px at 44% 14%, #e8e2d2 50%, transparent 51%),
    radial-gradient(1px 1px at 57% 44%, #aab1c2 50%, transparent 51%),
    radial-gradient(1.5px 1.5px at 66% 78%, #cfd6e4 50%, transparent 51%),
    radial-gradient(1px 1px at 74% 26%, #8d94a5 50%, transparent 51%),
    radial-gradient(2px 2px at 83% 58%, #efe9da 50%, transparent 51%),
    radial-gradient(1px 1px at 91% 12%, #aab1c2 50%, transparent 51%),
    radial-gradient(1.2px 1.2px at 8% 84%, #cfd6e4 50%, transparent 51%),
    radial-gradient(1px 1px at 38% 90%, #8d94a5 50%, transparent 51%);
}
.eyebrow { font-size: 22px; letter-spacing: .42em; color: var(--acc);
  text-transform: uppercase; }
.cover h1 { font-size: 148px; line-height: 1.02; margin: 18px 0 26px;
  letter-spacing: -.01em; }
.cover .sub, .closing .sub { font-size: 34px; color: var(--mut); }
.cover .not { margin-top: 34px; font-size: 26px; max-width: 900px; line-height: 1.5;
  color: var(--ink); }
.cover .not b { color: var(--acc); }
.hint { margin-top: 56px; font-size: 22px; color: var(--mut); }
kbd { font-family: var(--mono); background: var(--sf); border: 1px solid var(--rule);
  border-radius: 6px; padding: 2px 9px; font-size: 19px; }
.tarih { position: absolute; right: 96px; bottom: 64px; color: var(--mut);
  font-size: 20px; font-family: var(--mono); }

/* ── bölüm ayracı ── */
.divider { display: flex; flex-direction: column; justify-content: center;
  padding-left: 160px; }
.divider .num { font-family: var(--mono); font-size: 30px; color: var(--acc);
  letter-spacing: .3em; }
.divider h2 { font-size: 110px; margin: 12px 0 24px; letter-spacing: -.01em; }
.divider .sub { font-size: 32px; color: var(--mut); max-width: 1100px; line-height: 1.5; }
.divider .uyeler { margin-top: 54px; font-size: 24px; color: var(--acc);
  max-width: 1300px; line-height: 1.7; }

/* ── preset kartı ── */
.card { display: grid; grid-template-columns: 460px 1210px; gap: 48px;
  align-items: center; justify-content: center; }
.bilgi .eyebrow { display: flex; align-items: center; gap: 16px; font-size: 18px; }
.badge { font-size: 15px; letter-spacing: .18em; padding: 4px 12px;
  border-radius: 999px; border: 1px solid var(--rule); color: var(--mut); }
.badge.cekirdek { border-color: var(--acc); color: var(--acc); }
.badge.guncel { border-color: var(--ok); color: var(--ok); }
.badge.yeni { background: var(--acc); color: var(--acc-ink); border-color: var(--acc); }
.bilgi h2 { font-size: 64px; margin: 16px 0 20px; letter-spacing: -.01em; }
.hook { font-size: 26px; line-height: 1.5; color: var(--ink); }
.feats { margin: 30px 0 0; padding: 0; list-style: none; }
.feats li { position: relative; padding-left: 30px; margin-bottom: 15px;
  font-size: 21px; line-height: 1.45; color: var(--mut); }
.feats li::before { content: ""; position: absolute; left: 0; top: 11px;
  width: 12px; height: 12px; border: 2px solid var(--acc); border-radius: 3px;
  transform: rotate(45deg); }
.yol { margin-top: 30px; }
.yol code { font-family: var(--mono); font-size: 16px; color: var(--mut);
  background: var(--sf); border: 1px solid var(--rule); border-radius: 8px;
  padding: 8px 12px; display: inline-block; max-width: 440px;
  overflow-wrap: break-word; line-height: 1.45; }
.ac { display: inline-block; margin-top: 20px; color: var(--acc);
  text-decoration: none; font-size: 21px; border-bottom: 1px solid transparent; }
.ac:hover { border-bottom-color: var(--acc); }

.sahne { position: relative; width: 1210px; height: 681px; border-radius: 18px;
  border: 1px solid var(--rule); background: #000; overflow: hidden;
  box-shadow: 0 30px 80px rgba(0,0,0,.45); }
.sahne iframe { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px;
  border: 0; transform: scale(.6302); transform-origin: 0 0; background: #000; }
.yukleniyor { position: absolute; inset: 0; display: grid; place-items: center;
  text-align: center; color: var(--mut); font-size: 24px; line-height: 1.6; }

/* ── kapanış ── */
.closing h2 { font-size: 96px; margin-bottom: 24px; }
.buyuk-link { display: inline-block; margin-top: 26px; font-size: 40px;
  color: var(--acc); text-decoration: none; border: 1px solid var(--acc);
  border-radius: 14px; padding: 18px 36px; }
.buyuk-link:hover { background: var(--acc); color: var(--acc-ink); }
.closing .not { margin-top: 60px; font-size: 22px; color: var(--mut);
  max-width: 1200px; line-height: 1.7; }

/* ── tesisat ── */
#sayac { position: fixed; right: 28px; bottom: 22px; font-family: var(--mono);
  font-size: 15px; color: var(--mut); background: rgba(26,28,33,.82);
  border: 1px solid var(--rule); border-radius: 999px; padding: 7px 16px;
  cursor: pointer; z-index: 40; }
#sayac:hover { color: var(--acc); border-color: var(--acc); }
#oklar { position: fixed; left: 28px; bottom: 22px; display: flex; gap: 8px; z-index: 40; }
#oklar button { background: rgba(26,28,33,.82); color: var(--mut);
  border: 1px solid var(--rule); border-radius: 999px; width: 40px; height: 34px;
  font-size: 16px; cursor: pointer; }
#oklar button:hover { color: var(--acc); border-color: var(--acc); }

#dizin { position: fixed; inset: 0; background: rgba(9,10,12,.94); z-index: 60;
  display: none; overflow-y: auto; padding: 60px 80px; }
#dizin.acik { display: block; }
#dizin h3 { color: var(--acc); letter-spacing: .3em; font-size: 15px;
  text-transform: uppercase; margin: 34px 0 14px; }
#dizin .grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(240px,1fr));
  gap: 10px; }
#dizin button { text-align: left; background: var(--sf); color: var(--ink);
  border: 1px solid var(--rule); border-radius: 10px; padding: 12px 16px;
  font: 16px var(--font); cursor: pointer; }
#dizin button:hover { border-color: var(--acc); color: var(--acc); }
#dizin button .no { font-family: var(--mono); color: var(--mut); font-size: 12px;
  display: block; margin-bottom: 3px; }
</style>
</head>
<body>
<div id="viewport"><div id="stage">
{GOVDE}
</div></div>
<div id="oklar">
  <button id="geri" aria-label="Önceki">←</button>
  <button id="ileri" aria-label="Sonraki">→</button>
</div>
<button id="sayac" title="Dizin (G)">1 / {TOPLAM}</button>
<div id="dizin" role="dialog" aria-label="Dizin"></div>
<script>
const TOC = {TOC};
const slaytlar = [...document.querySelectorAll('.slide')];
const sayac = document.getElementById('sayac');
const dizin = document.getElementById('dizin');
let i = 0;

/* ölçek: 1920x1080 sahneyi pencereye sığdır */
function olcekle() {
  const s = Math.min(innerWidth / 1920, innerHeight / 1080);
  document.getElementById('stage').style.transform =
    `translate(-50%, -50%) scale(${s})`;
}
addEventListener('resize', olcekle); olcekle();

/* iframe yaşam döngüsü: yalnız etkin kart yüklü kalır, 2+ uzaktakiler boşaltılır
   (her kart bir WebGL bağlamı — hepsi birden açık kalamaz).

   KIRIK GRİ KUTU YASAK: src atamadan önce yol HEAD ile yoklanır. Sunucu
   ölmüşse ya da yol yoksa tarayıcının anlamsız kırık-sayfa ikonu yerine
   NE OLDUĞUNU ve NASIL DÜZELECEĞİNİ söyleyen bir kart basılır. */
function hataKarti(sl, mesaj) {
  let e = sl.querySelector('.sahne-hata');
  if (!e) {
    e = document.createElement('div');
    e.className = 'sahne-hata';
    e.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;' +
      'justify-content:center;text-align:center;padding:40px;background:#0d1017;' +
      'color:#c8cfdd;font-size:20px;line-height:1.65;z-index:3;';
    sl.querySelector('.sahne').appendChild(e);
  }
  e.innerHTML = mesaj;
  e.hidden = false;
}
function iframeYonet() {
  slaytlar.forEach((sl, k) => {
    const f = sl.querySelector('iframe');
    if (!f) return;
    const uzak = Math.abs(k - i);
    if (k === i && !f.src && !f.dataset.deneniyor) {
      if (location.protocol === 'file:') {
        hataKarti(sl, 'Canlı önizleme <b>file://</b> altında çalışmaz (tarayıcı ' +
          'modülleri engeller).<br>Desteyi <b>demo\\sunumu-baslat.cmd</b> ile açın.');
        return;
      }
      f.dataset.deneniyor = '1';
      fetch(f.dataset.src, { method: 'HEAD' })
        .then(r => {
          if (r.ok) { f.src = f.dataset.src; sl.querySelector('.sahne-hata')?.remove(); }
          else hataKarti(sl, 'Sunucu bu yolu bulamadı (HTTP ' + r.status + '):<br><code>' +
            f.dataset.src + '</code><br>Sunucuyu depo kökünden başlatın: <b>demo\\sunumu-baslat.cmd</b>.');
        })
        .catch(() => hataKarti(sl, 'Sunucuya ulaşılamıyor — kapanmış olabilir.<br>' +
          '<b>demo\\sunumu-baslat.cmd</b> dosyasını yeniden çalıştırıp ' +
          'tarayıcıda AÇILAN adresi kullanın.'))
        .finally(() => { delete f.dataset.deneniyor; });
    }
    else if (uzak > 1 && f.src) f.removeAttribute('src');
  });
}

function git(y, pushHash = true) {
  i = Math.max(0, Math.min(slaytlar.length - 1, y));
  slaytlar.forEach((sl, k) => sl.classList.toggle('gecerli', k === i));
  sayac.textContent = (i + 1) + ' / ' + slaytlar.length;
  if (pushHash) history.replaceState(null, '', '#' + (i + 1));
  iframeYonet();
}

addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); git(i + 1); }
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); git(i - 1); }
  else if (e.key === 'Home') git(0);
  else if (e.key === 'End') git(slaytlar.length - 1);
  else if (e.key.toLowerCase() === 'g') dizin.classList.toggle('acik');
  else if (e.key === 'Escape') dizin.classList.remove('acik');
});
document.getElementById('ileri').onclick = () => git(i + 1);
document.getElementById('geri').onclick = () => git(i - 1);
sayac.onclick = () => dizin.classList.toggle('acik');

/* dizin */
{
  const kategoriler = new Map();
  TOC.forEach(t => {
    const grup = t.tur === 'kart' ? t.kat : '_' + t.tur;
    if (!kategoriler.has(grup)) kategoriler.set(grup, []);
    kategoriler.get(grup).push(t);
  });
  let h = '';
  const bolumAdi = {};
  TOC.filter(t => t.tur === 'bolum').forEach(t => bolumAdi[t.kat] = t.ad);
  for (const [grup, list] of kategoriler) {
    if (grup.startsWith('_')) continue;
    h += `<h3>${bolumAdi[grup] || grup}</h3><div class="grid">` +
      list.filter(t => t.tur === 'kart')
          .map(t => `<button data-i="${t.i}"><span class="no">${t.i + 1}</span>${t.ad}</button>`)
          .join('') + '</div>';
  }
  dizin.innerHTML = '<h3>Dizin — kapatmak için Esc</h3>' + h;
  dizin.addEventListener('click', e => {
    const b = e.target.closest('button[data-i]');
    if (b) { dizin.classList.remove('acik'); git(+b.dataset.i); }
  });
}

/* hash ile doğrudan slayt */
const h0 = parseInt(location.hash.slice(1), 10);
git(isNaN(h0) ? 0 : h0 - 1, false);
</script>
</body>
</html>
"""

if __name__ == "__main__":
    varsayilan = os.path.normpath(
        os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    kok = sys.argv[1] if len(sys.argv) > 1 else varsayilan
    uret(kok)
