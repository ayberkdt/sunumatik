#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
eksen-denetimi.py — ÇIPLAK geometri kurucularını yakalar.

NEDEN VAR
─────────
three.js'te CylinderGeometry, LatheGeometry ve ConeGeometry'nin ekseni HER
ZAMAN +Y'dir. Blok sözleşmesi ise "+X ileri, +Z yukarı" der. Bu çeviriyi her
çağrı yerinde elle yazmak, tek bir oturumda BEŞ ayrı hataya yol açtı:

  1. uçak dikey kuyrukları — beş araçta birden aşağı sarkıyordu
  2. Starship burnu        — yarıçap ters yönde büyüyordu, kâseye dönmüştü
  3. Mars helikopteri mili — döndürülmediği için yatay duruyordu
  4. derin uzay sondası çanağı — R_x(−90°) ile aşağı bakıyordu
  5. gezgin tekerlekleri   — aks yukarı gidip tabak gibi yatmışlardı

Hepsi ekran görüntüsüyle yakalandı, yani KULLANICI bulmak zorunda kaldı.
Ortak sebep tek: dönüşüm elle, her seferinde yeniden yazılıyordu.

Ayrıca LatheGeometry'de ikinci bir tuzak var: normaller profilin SIRASINA
bağlıdır. y azalarak giden bir profil, normalleri içe bakan bir yüzey üretir
ve yüzey ters aydınlanır — nasel kaportası, Starship burnu ve sonda çanağı
bu yüzden siyah çıkmıştı.

KURAL
─────
Çıplak `new THREE.CylinderGeometry(...)`, `LatheGeometry(...)`,
`ConeGeometry(...)` YASAK. Adlandırılmış eksen yardımcıları kullanılacak:

    cylX / cylY / cylZ      — silindir, ekseni adında yazan yönde
    coneX / coneZ           — koni
    latheZ / latheX         — lathe; profil sırası İÇERİDE düzeltilir

Yardımcıların kendi tanımları muaftır (onlar zaten çeviriyi yapan yer).

KURAL 2 — EULER SIRASI TUZAĞI
─────────────────────────────
three, Euler'i XYZ sırasında R = Rx·Ry·Rz diye kurar; yani Z terimi vektöre
ÖNCE çarpar. Bu yüzden

    nesne.rotation.set(Math.PI / 2, 0, aci);

"ayağa kaldır, sonra `aci` kadar çevir" DEMEZ. Ardından gelen Rx(π/2) bütün
örnekleri tek bir eksene yatırır. Çember üzerine dizilmiş parçalarda sonuç
görünür: bütün parçalar aynı yöne bakar.

Dört yerde ölçüldü (vendored three ile, düzeltme öncesi):

  şişme habitat şerit halkaları  12 şeridin hepsi tek normalde, 90° sapma
  reaktör şemsiye radyatörü      koni yürüdükçe düzleşiyor: +0,242 → 0,000
  reaktör ikaz levhaları         dördü de aynı yöne bakıyor, 90° sapma
  gezgin ızgara parmakları       eksen x'te aynalanmış: a'da durup π−a'ya bakıyor

Bu yüzden `rotation.set(...)` çağrısında X ve Z terimlerinin İKİSİ de sıfırdan
farklıysa YASAK. Doğrusu dönüşü tek adımda, sırasız kurmaktır:

    quaternion.setFromUnitVectors(yerelEksen, hedefYon)   — tek eksen hizala
    quaternion.setFromRotationMatrix(makeBasis(u, v, w))  — üç eksen birlikte
    rotateOnWorldAxis(eksen, aci)                          — açıkça sırala

Sıranın gerçekten önemsiz olduğu yerler var (rastgele yuvarlanmış kaya, küçük
açılı boşta salınım). Orada satıra gerekçesiyle `euler-ok:` işareti konur —
sessiz bir taban sayısı değil, okunabilir bir gerekçe.

KULLANIM
────────
    python scripts/eksen-denetimi.py             # rapor + taban karşılaştırması
    python scripts/eksen-denetimi.py --liste     # her ihlali satırıyla göster
    python scripts/eksen-denetimi.py --taban-yaz # mevcut envanteri taban yap

TABAN (RATCHET)
───────────────
Kural konduğunda 65 çıplak kurucu vardı ve BİLEREK sıfırlanmadı: çalıştığı
doğrulanmış geometriyi toplu yeniden yazmak, kapatmaya çalıştığımız hatanın
ta kendisini üretir. Bu yüzden çıkış kodu mutlak sayıya değil, kayıtlı
tabana (eksen-taban.json) göre verilir:

    dosya başına sayı TABANI AŞARSA  → çıkış 1 (yeni kod kuralı atladı)
    tabanda olmayan dosyada kurucu   → çıkış 1
    sayı düşerse                     → çıkış 0 + --taban-yaz hatırlatması

Çıkış kodu 1 ⇒ ratchet ihlali: yeni yazılmış kod çıplak kurucu kullanıyor.
"""
import os, re, sys, io, json

# Windows konsolu cp1254; ok ve tire gibi karakterler patlatıyor.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

DEPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
KOKLER = [os.path.join(DEPO, "presets"), os.path.join(DEPO, "skills")]
TABAN_DOSYA = os.path.join(DEPO, "scripts", "eksen-taban.json")

# Denetlenen kurucular ve önerilen yardımcı.
KURUCULAR = {
    "CylinderGeometry": "cylX / cylY / cylZ",
    "LatheGeometry":    "latheZ / latheX",
    "ConeGeometry":     "coneX / coneZ",
}

# Yardımcıların KENDİ gövdeleri muaf: çeviriyi yapan yer orası.
# (`export function` biçimi de eşleşir — yardımcılar artık
#  presets/core/geometry-axis.mjs içinden dışa açılıyor.)
YARDIMCI_IMZA = re.compile(
    r"^\s*(?:export\s+)?(?:function|const)\s+"
    r"(cylX|cylY|cylZ|coneX|coneZ|coneGeoX|coneGeoZ|cylGeoX|cylGeoY|cylGeoZ|latheZ|latheX|eksenX|eksenY|eksenZ)\b")

# Bu dosyalar tarama dışı: satıcı (vendor) kodu bize ait değil.
DISARIDA = ("vendor", "node_modules", ".git", "moon_react_source")

# ── KURAL 2: Euler sırası tuzağı ──────────────────────────────────────
# Üç argümanlı `rotation.set(x, y, z)` çağrısında x ve z'nin İKİSİ de
# sıfırdan farklıysa, bu "eğ ve çevir"i tek Euler çağrısında söyleme
# denemesidir ve three'nin sırası onu hiçbir zaman o anlama getirmez.
EULER_CAGRI = re.compile(r"\.rotation\.set\(([^;]*?)\)\s*;")
EULER_SIFIR = re.compile(r"^\s*(?:-\s*)?0(?:\.0+)?\s*$")
# Sıranın gerçekten önemsiz olduğu yer: satıra gerekçesiyle işaret konur.
EULER_KACIS = re.compile(r"euler-ok\s*:")

# -- KURAL 3: kismi lathe'in YONU ------------------------------------
# `latheZ(pts, seg, mat, phiStart, phiLength)` bir yarim kabuk kurar ama
# phiStart'in dunyada nereye baktigi ANLASILMAZ. Olculdu: phi = 0 blok
# -Y'sine (figurun SAGINA), phi = +pi/2 +X'e (ONE) bakar. Kodda tersi
# yaziyordu ve astronotta BES kabuk birden 90 derece yan duruyordu: altin
# vizor basin yaninda, beyaz migferin on acikligi sagda, gogus dolgusu sag
# omzun altinda. Hicbir kapi gormedi, cunku aci bir sayidir ve sayinin
# yonu yoktur.
#
# Bundan sonra kismi lathe yalniz `latheZYonlu(..., PHI_Z.on, ...)` gibi
# YONUYLE yazilir. Kacis: satirin ustunde `phi-ok:` isareti.
PHI_CAGRI = re.compile(r'\blathe[XZ]\s*\(')
PHI_KACIS = re.compile(r"phi-ok\s*:")


def phi_argumanlari(metin, konum):
    """lathe cagrisinin ust duzey arguman sayisi (parantez dengesiyle)."""
    i = metin.index("(", konum)
    derin, arg, j = 0, 1, i
    while j < len(metin):
        c = metin[j]
        if c in "([{":
            derin += 1
        elif c in ")]}":
            derin -= 1
            if derin == 0:
                return arg
        elif c == "," and derin == 1:
            arg += 1
        j += 1
    return arg


def phi_denetle(yol):
    """(satir no, satir) listesi - yonu soylenmemis kismi lathe cagrilari."""
    try:
        metin = io.open(yol, encoding="utf-8").read()
    except (UnicodeDecodeError, OSError):
        return []
    # Ceviriyi yapan dosya muaf: sarmalayicilar orada yasiyor.
    if os.path.basename(yol) == "geometry-axis.mjs":
        return []
    bulgular = []
    satirlar = metin.splitlines()
    for m in PHI_CAGRI.finditer(metin):
        if phi_argumanlari(metin, m.start()) <= 3:
            continue                      # tam tur - yonu yok, sorun da yok
        satir_no = metin.count(chr(10), 0, m.start()) + 1
        pencere = chr(10).join(satirlar[max(0, satir_no - 9):satir_no])
        if PHI_KACIS.search(pencere):
            continue
        bulgular.append((satir_no, satirlar[satir_no - 1].strip()[:96]))
    return bulgular


def euler_denetle(yol):
    """(satır no, satır) listesi — X ve Z birlikte sıfırdan farklı olanlar."""
    try:
        metin = io.open(yol, encoding="utf-8").read()
    except (UnicodeDecodeError, OSError):
        return []
    bulgular = []
    satirlar = metin.splitlines()
    for i, s in enumerate(satirlar, 1):
        # Gerekcesi cagrinin USTUNDEKI yorum blogunda olabilir; isareti
        # kucuk bir pencerede ara, yoksa gerekce yazmak icin tek satira
        # sigdirmak gerekir ve gerekce kisalir.
        pencere = chr(10).join(satirlar[max(0, i - 6):i])
        if EULER_KACIS.search(pencere):
            continue
        m = EULER_CAGRI.search(s)
        if not m:
            continue
        args = [a.strip() for a in m.group(1).split(",")]
        if len(args) != 3:
            continue
        if EULER_SIFIR.match(args[0]) or EULER_SIFIR.match(args[2]):
            continue
        bulgular.append((i, s.strip()[:96]))
    return bulgular


def dosyalar():
    for kok_dizin in KOKLER:
        if not os.path.isdir(kok_dizin):
            continue
        for kok, dizinler, adlar in os.walk(kok_dizin):
            dizinler[:] = [d for d in dizinler if d not in DISARIDA]
            for a in adlar:
                if a.endswith((".mjs", ".html", ".js")):
                    yield os.path.join(kok, a)


def denetle(yol):
    """(satır no, kurucu, satır) listesi — yardımcı gövdeleri hariç."""
    try:
        metin = io.open(yol, encoding="utf-8").read()
    except (UnicodeDecodeError, OSError):
        return []
    satirlar = metin.splitlines()
    bulgular = []
    # Basit kapsam takibi: bir yardımcı imzası görülünce, süslü parantez
    # dengesi sıfıra dönene kadar o gövde muaftır.
    muaf_derinlik = None
    derinlik = 0
    for i, s in enumerate(satirlar, 1):
        if muaf_derinlik is None and YARDIMCI_IMZA.match(s):
            muaf_derinlik = derinlik
        derinlik += s.count("{") - s.count("}")
        if muaf_derinlik is not None and derinlik <= muaf_derinlik:
            muaf_derinlik = None
            continue
        if muaf_derinlik is not None:
            continue
        for ad in KURUCULAR:
            if re.search(r"new\s+THREE\." + ad + r"\s*\(", s):
                bulgular.append((i, ad, s.strip()[:96]))
    return bulgular


def main():
    liste = "--liste" in sys.argv
    taban_yaz = "--taban-yaz" in sys.argv
    toplam = 0
    dosya_sayisi = 0
    ozet = {}
    for yol in sorted(dosyalar()):
        b = denetle(yol)
        if not b:
            continue
        dosya_sayisi += 1
        toplam += len(b)
        goreli = os.path.relpath(yol, DEPO).replace(os.sep, "/")
        ozet[goreli] = len(b)
        if liste:
            print(f"\n{goreli}")
            for n, ad, s in b:
                print(f"  {n:5d}  {ad:18s} {s}")
    if not liste:
        for k in sorted(ozet, key=lambda x: -ozet[x]):
            print(f"{ozet[k]:5d}  {k}")
    print(f"\nÇIPLAK KURUCU: {toplam} adet, {dosya_sayisi} dosyada.")

    # ── KURAL 2: Euler sırası ──
    euler = []
    for yol in sorted(dosyalar()):
        for n, satir in euler_denetle(yol):
            euler.append((os.path.relpath(yol, DEPO).replace(os.sep, "/"), n, satir))
    if euler:
        print("\nEULER SIRASI TUZAĞI — X ve Z birlikte veriliyor:")
        for d, n, satir in euler:
            print(f"  {d}:{n}  {satir}")
        print("three Euler'i Rx·Ry·Rz kurar, yani Z ÖNCE uygulanır: bu çağrı"
              "\n\"eğ, sonra çevir\" demez. setFromUnitVectors /"
              "\nmakeBasis / rotateOnWorldAxis kullanın. Sıra gerçekten"
              "\nönemsizse satıra gerekçesiyle `euler-ok:` işaretini koyun.")
    else:
        print("EULER SIRASI: temiz — X ve Z birlikte verilen çağrı yok.")

    # ── KURAL 3: kısmi lathe'in yönü ──
    phi = []
    for yol in sorted(dosyalar()):
        for n, satir in phi_denetle(yol):
            phi.append((os.path.relpath(yol, DEPO).replace(os.sep, "/"), n, satir))
    if phi:
        print("\nKISMI LATHE'IN YÖNÜ SÖYLENMEMİŞ — çıplak açı verilmiş:")
        for d, n, satir in phi:
            print(f"  {d}:{n}  {satir}")
        print("ÖLÇÜLDÜ: latheZ'de phi = 0 blok −Y'sine, phi = +π/2 +X'e bakar."
              "\nBir açının yönü yoktur; `latheZYonlu(..., PHI_Z.on, açıklık)` yazın."
              "\nGerçekten açı gerekiyorsa satıra gerekçesiyle `phi-ok:` işaretini koyun.")
    else:
        print("KISMI LATHE: temiz — her kısmi kabuk yönünü söylüyor.")

    if taban_yaz:
        with io.open(TABAN_DOSYA, "w", encoding="utf-8", newline="\n") as f:
            json.dump(ozet, f, ensure_ascii=False, indent=2, sort_keys=True)
            f.write("\n")
        print(f"Taban yazıldı: {os.path.relpath(TABAN_DOSYA, DEPO)}")
        return 0

    # ── ratchet: kayıtlı tabana karşı ──
    if not os.path.isfile(TABAN_DOSYA):
        print("Taban dosyası yok — `--taban-yaz` ile oluşturun.")
        return 1
    taban = json.load(io.open(TABAN_DOSYA, encoding="utf-8"))
    ihlal = []
    for dosya, sayi in ozet.items():
        izin = taban.get(dosya, 0)
        if sayi > izin:
            ihlal.append((dosya, izin, sayi))
    dusen = sum(max(0, taban.get(d, 0) - ozet.get(d, 0)) for d in set(taban) | set(ozet))
    if ihlal:
        print("\nRATCHET İHLALİ — yeni kod çıplak kurucu kullanıyor:")
        for dosya, izin, sayi in ihlal:
            print(f"  {dosya}: taban {izin} → şimdi {sayi}")
        print("Önerilen yardımcılar:")
        for ad, y in KURUCULAR.items():
            print(f"  {ad:18s} → {y}")
        print("\nYENİ yazılan her blok yardımcıları kullanmalı. Mevcut ve"
              "\nÇALIŞTIĞI DOĞRULANMIŞ kod, yalnız o dosyaya dokunulduğunda"
              "\ntaşınır — çalışan geometriyi toplu hâlde yeniden yazmak,"
              "\nkapatmaya çalıştığımız hatanın ta kendisini üretir.")
        return 1
    if euler or phi:
        return 1
    if dusen:
        print(f"\nSayı tabana göre {dusen} düştü — ilerlemeyi kilitlemek için "
              "`--taban-yaz` çalıştırıp eksen-taban.json'u commit edin.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
