# aero_shock_waves — şok ve genleşme dalgaları

Süpersonik dalga sistemi. Hiçbir açı elle konmaz: eğik şoklar θ-β-M
bağıntısından, genleşme yelpazeleri Prandtl–Meyer fonksiyonundan, kopuk yay
şoku Billig bağıntısından çıkar.

## Doğrulama (NACA 1135 tabloları, dört hane)

| Ölçüt | Bu çözücü | Tablo |
|---|---|---|
| Normal şok M=2: M₂ / p₂p₁ / T₂T₁ / ρ₂ρ₁ / p₀₂p₀₁ | 0,5774 / 4,5000 / 1,6875 / 2,6667 / 0,7209 | aynı |
| Eğik şok M=2, θ=10°: β / M₂ / p₂p₁ | 39,31° / 1,6405 / 1,7066 | aynı |
| Eğik şok M=2, θ=20°: β / M₂ / p₂p₁ | 53,42° / 1,2102 / 2,8429 | 53,42 / 1,2104 / 2,8419 |
| θ_max(M=2) | 22,97° @ β 64,67° | aynı |
| θ_max(M=5) | 41,12° | aynı |
| ν(1,5) / ν(2) / ν(3) / ν(5) | 11,905 / 26,380 / 49,757 / 76,920° | aynı |
| ν_max | 130,45° | aynı |
| ISA: a(0) / a(11 km) / p(20 km) | 340,29 m/s / 295,07 m/s / 5,475 kPa | aynı |
| M(ν(3,7)) gidiş-dönüş | 3,700000 | 3,7 |

Şok–genleşme teorisi, Ackeret doğrusal teorisiyle **%1,3'ten %2,4'e** ayrışıyor
(α 1°→8°, M=2, %10 elmas profil) — doğrusallaştırmadan tam olarak beklenen
davranış. α=0'da dalga sürüklemesi 0,0231, kapalı form 4ε²/√(M²−1) = 0,0229.

## İşaret düzeni — bir kez yanlış kuruldu

Bir dönüşün **sıkıştırma mı genleşme mi** olduğu, akışkanın yüzeyin hangi
tarafında olduğuna bağlıdır. Aynı geometrik dönüş üst yüzeyde genleşme iken
alt yüzeyde sıkıştırmadır. Tek bir işaretli açıyla iki yüzeyi birden yönetmeye
çalışmak bu yüzden çalışmaz ve ilk sürümde Cl tam **sıfır** çıkıyordu:

```
genleşme_açısı = üst yüzeyde (φ_önceki − φ),  alt yüzeyde (φ − φ_önceki)
```

Zincir serbest akımdan başlar, akımın gövde çerçevesindeki yönü **+α**'dır.
Kontrol: α = 0'da elmasın ön üst paneli (φ = +ε) → −ε, yani ε kadar sıkıştırma;
α = 2ε'de aynı panel → +ε, yani genleşme. Alt ön panel α büyüdükçe daha çok
sıkışır — kaldırmanın süpersonikte nereden geldiği budur.

Panel normalleri de artık φ'den **türetiliyor**; dışarıdan normal almak,
işareti iki ayrı yerde tutarlı tutmayı gerektiriyordu ve hata tam oradan girdi.

## Üç çizim hatası

**1. Billig yay şoku.** Katsayılar karışınca şok neredeyse düz dikey bir çizgi
oluyordu ve cismin içinden geçiyordu. Doğru form:

```
Δ/R   = 0,143 exp(3,24/M²)
R_c/R = 1,143 exp(0,54/(M−1)^1,2)
x(y)  = x_burun − Δ − R_c(M²−1)·[√(1 + y²/(R_c²(M²−1))) − 1]
```

Asimptot kontrolü hatayı hemen yakalar: büyük y'de dx/d|y| → −√(M²−1), yani
şok uzakta eksenle **Mach açısı** yapmalıdır. Doğru bir kopuk şok, uzakta bir
Mach dalgasına dönüşmek zorundadır.

**2. Gövde ana hattı.** Yalnız panellerin `x0`'larından geçmek elmas profilde
işe yarıyor ama tek kamada dejenere üçgen üretiyordu — kama hiç görünmüyordu.
Üst panellerin uçları ileri, alt panellerinki geri gezilmeli.

**3. Küt burun yayı.** `arc` sağ yarımı çizip gövdeye bağlanınca papyon
çıkıyordu; burun **akıma bakar**, yani sol yarımdır.

## Kopma: sayfanın asıl anlattığı şey

θ, θ_max'ı aşınca yapışık çözüm yoktur. Sahne o anda kopuk yay şokuna geçer ve
uyarı belirir. Hipersonik araçların burnunun neden küt olduğu buradan okunur:
kopmuş şok bir tampon gibi önde durur, durma noktası ısı akısı
q ∝ 1/√R_n olduğu için sivri burun **sonsuz** ısı akısı demektir.

## Parçacıklar: şokun ne olduğunu gösteren tek şey

Parçacığın bölgesi, hangi dalgaların gerisinde kaldığına bakılarak bulunur
(her dalga ışınına karşı çapraz çarpım işareti). Yelpazenin İÇİNDE ise durum
açısal konuma göre ara değerlenir — genleşme sürekli bir dönüştür, sıçrama
değil. Hız: |V|/V∞ = (M/M∞)·√(T/T∞).

Böylece şoku geçen parçacık **aynı anda** döner, yavaşlar ve sıklaşır. İzler
nokta olarak çizilince bunların hiçbiri görünmüyordu; iz uzunluğu yerel hızla,
parlaklığı yerel basınçla orantılı olunca üçü birden okunur hâle geldi.

## Sayfa

`?m=2&a=4&e=5.7&h=15&c=elmas&t=3&export=1` — `c`: elmas | kama | kut.
**`t` akışı dondurur — demo kartına koyma.**

Cisimler: elmas profil (4 panel, şok–genleşme marşı), tek kama (2 panel),
küt burun (panel marşı yok, şok zaten kopuk).

## Dürüstlük sınırları (sayfa bunları kendi yazar)

- İki boyutlu, kararlı, viskoz olmayan, γ = 1,4 sabit.
- Dalgalar birbirini **kesmez ve kırmaz** — gerçekte bir yelpaze şoku geçerken
  onu zayıflatır.
- M ≳ 5'te mükemmel gaz kabulü bozulur (titreşim, ayrışma, iyonlaşma);
  nitel davranış doğru kalır, mutlak değerler sapar. Sayfa M ≥ 5'te bunu yazar.
- Kopmuş şokun ARKASINDAKİ ses altı cep modellenmez.
- Sınır tabakası yok ⇒ şok–sınır tabakası etkileşimi ve ayrılma yok.
