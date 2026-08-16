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
    r"(cylX|cylY|cylZ|coneX|coneZ|latheZ|latheX|eksenX|eksenY|eksenZ)\b")

# Bu dosyalar tarama dışı: satıcı (vendor) kodu bize ait değil.
DISARIDA = ("vendor", "node_modules", ".git", "moon_react_source")


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
    if dusen:
        print(f"\nSayı tabana göre {dusen} düştü — ilerlemeyi kilitlemek için "
              "`--taban-yaz` çalıştırıp eksen-taban.json'u commit edin.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
