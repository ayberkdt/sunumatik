/* budget.mjs — SAHNE DİKKAT BÜTÇESİ (three'siz, saf).
 * docs/breathing-motion-plan.md §3.3 ve §4.
 *
 * Bir sahnede her şey nefes alırsa sahne akvaryuma döner: göz nereye
 * bakacağını bilemez ve hiçbir hareket ANLAM taşımaz. Bütçe iki şeyi
 * zorlar:
 *
 *   1. YASAK SINIFLAR (§3.3). Fizik nefes almaz. Arazi, alan çizgileri,
 *      yörünge izleri, sabit ışıkta gölge ve değeri değişmeyen HUD sayısı
 *      bir davranışa BAĞLANAMAZ. `add` bunu reddeder — sessizce düşürmez,
 *      hata döndürür, çünkü sessiz düşüş sahneyi yanlış gösterir.
 *   2. SALIENCE TOPLAMI ≤ 1,0 ve aynı anda en çok 3 FARK EDİLİR davranış
 *      (1 birincil + 2 ikincil). Geri kalanı eşik altında kalmak zorunda.
 *
 * Salience kameraya UZAKLIKLA ölçeklenir: yakın plandaki gezginde kafa
 * bakışı birincildir, aynı davranış uzak planda eşik altına iner.
 */

const YASAK = Object.freeze({
  terrain: 'Arazi nefes almaz: yüzey bir olgudur, canlı değil (sözleşme §1).',
  field: 'Alan çizgileri veriyi gösterir; kıpırdatmak veriyi yalanlar.',
  orbit: 'Yörünge izi bir çözümdür; "canlılık" eklemek yolu bozar.',
  shadow: 'Işık sabitse gölge de sabittir; oynayan gölge ışığın yalanıdır.',
  hud: 'HUD sayısı yalnız GERÇEK değer değiştiğinde oynar (hudSettle); boşta sabittir.',
});

export const FORBIDDEN_CLASSES = Object.freeze(Object.keys(YASAK));

export const ESIK = 0.15;          // bunun üstü "fark edilir" sayılır
export const MAX_FARKEDILIR = 3;   // 1 birincil + 2 ikincil
export const MAX_TOPLAM = 1.0;

/** Kameraya uzaklığa göre salience çarpanı: yakın plan büyütür, uzak plan küçültür. */
export function proximityGain(distance, { near = 2, far = 40 } = {}) {
  if (!Number.isFinite(distance)) return 1;
  const u = Math.min(1, Math.max(0, (distance - near) / (far - near)));
  return 1.45 - 0.95 * u;          // near → 1,45 · far → 0,50
}

export function createBudget({ maxTotal = MAX_TOPLAM, maxNoticeable = MAX_FARKEDILIR, strict = false } = {}) {
  const girdiler = [];
  const api = {
    maxTotal, maxNoticeable, strict,
    get entries() { return girdiler.slice(); },
    /** Toplam etkin salience. */
    total() { return girdiler.reduce((s, e) => s + e.effective, 0); },
    /** Eşik üstü davranış sayısı. */
    noticeable() { return girdiler.filter(e => e.effective >= ESIK).length; },

    /** Davranışı bütçeye sok. Kabul edilmezse NEDENİYLE döner. */
    add(behaviour, { sinif = null, distance = NaN, salience = null } = {}) {
      const cls = sinif ?? behaviour.sinif;
      if (YASAK[cls]) {
        const red = { kabul: false, id: behaviour.id, neden: YASAK[cls], kod: 'yasak-sinif' };
        if (strict) throw new Error(`life-signs bütçe: '${behaviour.id}' ${cls} sınıfına bağlanamaz — ${YASAK[cls]}`);
        return red;
      }
      if (behaviour.durum && behaviour.durum !== 'uygulandı') {
        const red = { kabul: false, id: behaviour.id, neden: `Davranış '${behaviour.durum}' durumunda; sahneye bağlanamaz.`, kod: 'durum' };
        if (strict) throw new Error(red.neden);
        return red;
      }
      const taban = salience ?? behaviour.salience ?? 0;
      const effective = Math.min(1, taban * proximityGain(distance));
      const girdi = { id: behaviour.id, sinif: cls, base: taban, effective, distance, behaviour };
      /* sıfır salience (hudSettle) bütçeyi tüketmez */
      const yeniToplam = api.total() + effective;
      const yeniFark = api.noticeable() + (effective >= ESIK ? 1 : 0);
      if (effective > 0 && yeniToplam > maxTotal + 1e-9) {
        const red = { kabul: false, id: behaviour.id, kod: 'toplam',
          neden: `Salience toplamı ${yeniToplam.toFixed(2)} > ${maxTotal}. Sahne akvaryuma döner; başka bir davranışı kıs ya da uzaklaştır.` };
        if (strict) throw new Error(red.neden);
        return red;
      }
      if (yeniFark > maxNoticeable) {
        const red = { kabul: false, id: behaviour.id, kod: 'farkedilir',
          neden: `Aynı anda ${yeniFark} fark edilir davranış olur (sınır ${maxNoticeable}). Göz birini seçemez.` };
        if (strict) throw new Error(red.neden);
        return red;
      }
      girdiler.push(girdi);
      return { kabul: true, id: behaviour.id, effective, girdi };
    },

    /** Reduced motion: her davranış DONAR (tablo t), olaylar yok (§7). */
    reduced: false,
    freezeAt: 0,
    setReduced(v, t = 0) { api.reduced = !!v; api.freezeAt = t; return api; },
    /** Sahnenin o anki örneklemesi — reduced altında tek kare. */
    sample(t) {
      const tt = api.reduced ? api.freezeAt : t;
      const out = {};
      for (const e of girdiler) out[e.id] = e.behaviour.sample(tt);
      return out;
    },
    /** Denetim ve vitrin için rapor. */
    report() {
      return {
        toplam: Number(api.total().toFixed(4)),
        farkedilir: api.noticeable(),
        sinir: { toplam: maxTotal, farkedilir: maxNoticeable, esik: ESIK },
        gecti: api.total() <= maxTotal + 1e-9 && api.noticeable() <= maxNoticeable,
        girdiler: girdiler.map(e => ({ id: e.id, sinif: e.sinif, base: e.base, effective: Number(e.effective.toFixed(3)), farkedilir: e.effective >= ESIK })),
      };
    },
  };
  return api;
}

export { YASAK };
