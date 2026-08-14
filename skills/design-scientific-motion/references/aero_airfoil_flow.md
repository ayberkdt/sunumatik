# aero_airfoil_flow — kanat profili etrafında akım

Bir profilin etrafındaki akımı ÇÖZER. Ekrandaki hiçbir eğri elle çizilmedi;
Cp dağılımı da, Cl–α poları da, ayrılma noktası da tek bir doğrusal sistemin
ve ondan beslenen bir sınır tabakası marşının çıktısı.

## Üç katman

| Katman | Yöntem | Verdiği |
|---|---|---|
| Potansiyel akım | Doğrusal şiddetli vorteks paneli (Kuethe & Chow), 160 panel + Kutta | Cp, Cl, Cm, Γ, hız alanı |
| Sınır tabakası | Thwaites → Michel → Head + Ludwieg–Tillmann | geçiş, ayrılma, Cd (Squire–Young) |
| Sıkıştırılabilirlik | Prandtl–Glauert + izentropik Cp* | kritik Mach, geçerlilik sınırı |

## Doğrulama (hepsi ölçüldü, hiçbiri varsayılmadı)

| Ölçüt | Bu çözücü | Beklenen |
|---|---|---|
| NACA 0012 Cl eğimi | 1,10 × 2π | 2π + kalınlık düzeltmesi (%12 için ~1,09) |
| NACA 2412 α_L0 | −2,149° | literatür −2,1°; sayfanın kendi ince profil integrali −2,08° |
| NACA 2412 Cm_c/4 | −0,055 | literatür ≈ −0,05 |
| Durma noktası Cp | 0,9957 | tam 1 |
| NACA 0012 M_kritik (α=0) | 0,744 | literatür ≈ 0,74 |
| İki Cl yolu arası fark | %0,6 | ayrıklaştırma hatası |
| Alan hızı ↔ yüzey hızı | %0,02 | aynı çözüm |
| Kutta kapalı → Γ | 0,000000 | tam sıfır |

## Üç bulunmuş hata (her biri bir ders)

**1. Eksik 2π.** Kuethe & Chow katsayıları γ'yı 1/2π çarpanı içinde taşır.
Bu unutulunca Cl altı kat küçük çıkıyor — ama **Cp eğrisi doğru kalıyor**,
yani ekran ikna edici görünmeye devam ediyor. İki bağımsız Cl yolunun
(Kutta–Jukovski ve basınç integrali) sürekli karşılaştırılması bunun için var.

**2. Ters normal.** Düğüm sırası saat yönü olduğu için dış normal
(−sinθ, +cosθ)'dır. Ters kullanınca Cl doğru büyüklükte ama NEGATİF çıktı ve
alan hızı sorgusu **cismin içini** örnekleyip 0,0005 döndürdü — ki bu aslında
çözümün DOĞRU olduğunun kanıtıydı: iç hız gerçekten sıfırdır.

**3. Kritik Mach bisection'ı ters yönde.** Düşük M'de Cp* çok negatiftir
(M=0,05'te −269), yüksek M'de sıfıra tırmanır; kök f'in **artıdan eksiye**
geçtiği yerdedir. Ters koşulla hep `null` dönüyordu.

## İki performans hatası (biri görünmez ekran görüntüsüne yol açtı)

Alan resmi HER KAREDE ~1 milyon piksellik ara değerle, akım çizgileri de
her karede 26 × 1400 RK4 adımıyla yeniden üretiliyordu. Sayfa canlıyken zar
zor dönüyordu; `&t=` ile dondurulmuş kipte ise kare hiç tamamlanamıyor ve
**headless ekran görüntüsü tamamen boş çıkıyordu**. İkisi de zamanın değil
ÇÖZÜMÜN fonksiyonu — artık çözüm başına bir kez hesaplanıp saklanıyor; alan,
ızgara çözünürlüğünde bir ara tuvale çizilip iki doğrusal büyütmeyle basılıyor.

Ayrıca `velocityGrid` genel `velocityAt` yerine panel sabitlerini dışarı alan
özel bir rutin kullanıyor: 220×150 ızgara, 160 panel için **1103 ms → 357 ms**.

## Sayfanın üç öğretici anahtarı

**Kutta koşulu KAPALI** — Γ = 0 dayatılır. Arka durma noktası üst yüzeye
tırmanır, akım keskin firar kenarının etrafından dolanır (Cp_min ≈ −66, yani
yerel hız serbest akımın 8 katı — dolaşım yokken keskin kenarın ürettiği
matematiksel tekillik). Kaldırma tam sıfır.

**Eşit geçiş süresi efsanesi** — ayırıcı akım çizgisi bisection'la bulunur,
iki yanından birer parçacık bırakılır, x = 1,25'e varış süreleri ölçülür.
NACA 2412, α = 6°: üst 1,80 s, alt 2,20 s → üstteki **%18 daha erken**.
Ve en güzeli: **Kutta kapalıyken aynı ölçüm ≈ %0 verir.** Yani "eşit geçiş
süresi" tam olarak DOLAŞIMSIZ akımın tarifidir — ve dolaşımsız akımda
kaldırma yoktur. Efsane kendi kendini çürütür.

**Ayrılmanın yürüyüşü** — polar grafikte Cl eğrisiyle birlikte ayrılma
noktası da çizilir. α büyüdükçe ayrılma öne yürür; sayfa bir C_l,max
İDDİA ETMEZ, çünkü bu zincir (kabarcık modeli olmadan) yapışmayı fazla
tahmin eder: ayrılma %50 veteri 21°'de geçiyor, gerçek 2412 ise 16°'de
stall'a giriyor. Bu fark açıkça yazılıdır.

## Sayfa

`?naca=2412&a=6&re=6.477&mach=0&mod=cp&kutta=0&tarak=0&t=3&export=1`
(`re` = log₁₀Re). **`t` akımı dondurur — demo kartına koyma.**

Kaydırıcılar iki hızda çalışır: panel çözümü + sınır tabakası + grafikler
anında (14 ms), pahalı alan ızgarası ise kaydırıcı durunca (90 ms gecikmeli).

## Paylaşılan geometri

`nacaNodes` ile `aircraft-blocks.mjs`'in `nacaSection`'ı **aynı denklemi ve
aynı kosinüs aralığını** kullanır. Bir sahnede kanadı kesip bu çözücüye
vermek istediğinizde geometri değişmez.
