/* Kayıp fonksiyonları preseti — "hangi kaybı neden seçersin" filmi.

   2B tuval + HTML. WebGL yok, bağımlılık yok, ağ isteği yok. Bütün sayılar
   çalışma anında GERÇEK hesaptan gelir: kayıp değerleri kapalı formüllerden,
   eğitilmiş modeller kapalı biçim türevleriyle koşturulan TAM YIĞIN gradyan
   inişinden. Rastgelelik yalnızca sınıflandırma veri kümesinin bir kerelik
   üretiminde (sabit tohumlu LCG) kullanılır; çalışma zamanında Math.random yok.

   Kullanım:
     import { mountLossFunctions } from './loss-functions.mjs';
     const lf = mountLossFunctions(host, { adim: 1 });
     const anlati = lf.anlati();            // deste ok tuşlarına BAĞLANABİLİR
     anlati.ileri(); anlati.geri(); anlati.git(3);

   Preset GLOBAL keydown EKLEMEZ; klavye yalnız kendi kök öğesi üzerinde
   (tabindex=0) dinlenir. Deste isterse döndürülen denetleyiciyi kendi
   navigasyonuna bağlar.

   Palet: --color-canvas/-surface/-ink/-muted/-accent/-rule/-data-1..6 ve
   --ramp-seq-* mount anında CSS'ten okunur. Veri işaretlerinde glow yoktur.   */

/* ══════════════════════════════════════════════════════════════════════
   1. Mini TeX → MathML dizgisi
   Deste'nin typeset-tex-equations profilinden "native MathML" seçeneği:
   çevrimdışı, deterministik, ekran okuyucuya açık. Desteklenen altküme
   bu presetin formülleri için yeterlidir (bkz. references belgesi):
   ^ _ {} \frac \tfrac \dfrac \sqrt \left \right \lvert \rvert \hat \bar
   \text \mathrm \mathbf \operatorname \sum \begin{cases} \begin{aligned}
   Yunan harfleri, karşılaştırma/ikili operatörler, adlandırılmış işlevler.
   ══════════════════════════════════════════════════════════════════════ */

const TEX_HARF = {
  alpha: 'α', beta: 'β', gamma: 'γ', Gamma: 'Γ', delta: 'δ', Delta: 'Δ',
  epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', kappa: 'κ',
  lambda: 'λ', Lambda: 'Λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ',
  sigma: 'σ', Sigma: 'Σ', tau: 'τ', phi: 'φ', varphi: 'φ', chi: 'χ',
  psi: 'ψ', omega: 'ω', Omega: 'Ω', ell: 'ℓ', infty: '∞',
};

const TEX_OP = {
  cdot: '⋅', times: '×', div: '÷', pm: '±', mp: '∓',
  le: '≤', leq: '≤', ge: '≥', geq: '≥', neq: '≠', ne: '≠', equiv: '≡',
  approx: '≈', sim: '∼', simeq: '≃', propto: '∝',
  to: '→', rightarrow: '→', mapsto: '↦', Rightarrow: '⇒', leftarrow: '←',
  in: '∈', notin: '∉', subset: '⊂', cup: '∪', cap: '∩',
  partial: '∂', nabla: '∇', forall: '∀', exists: '∃', cdots: '⋯', dots: '…',
  ldots: '…', gg: '≫', ll: '≪', circ: '∘', ast: '∗', star: '⋆',
};

const TEX_ISLEV = new Set([
  'log', 'ln', 'lg', 'exp', 'max', 'min', 'sup', 'inf', 'sin', 'cos', 'tan',
  'sinh', 'cosh', 'tanh', 'arg', 'det', 'dim', 'sign', 'sgn', 'softmax',
  'sigma_fn', 'relu', 'clip',
]);

const TEX_BOSLUK = { ',': '0.17em', ':': '0.22em', ';': '0.28em', '!': '-0.17em', quad: '1em', qquad: '2em', ' ': '0.25em' };

function texKacis(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

class TexAyristirici {
  constructor(src) { this.s = src; this.i = 0; this.buyukOp = false; }

  /** Kaynağın tamamını (ya da `dur()` doğrulanana dek) MathML'e çevirir. */
  liste(dur) {
    const out = [];
    for (;;) {
      this.bosluk();
      if (this.i >= this.s.length) break;
      if (dur && dur()) break;
      const atom = this.atomVeScript();
      if (atom === null) break;
      out.push(atom);
    }
    return out.join('');
  }

  bosluk() { while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++; }

  /** Bir atom + ardından gelen ^ / _ eklerini birleştirir. */
  atomVeScript() {
    const taban = this.atom();
    if (taban === null) return null;
    const buyuk = this.buyukOp;
    let alt = null; let ust = null;
    for (;;) {
      this.bosluk();
      const c = this.s[this.i];
      if (c !== '^' && c !== '_') break;
      this.i++;
      this.buyukOp = false;
      const arg = this.atom();
      if (arg === null) break;
      if (c === '_') alt = arg; else ust = arg;
    }
    this.buyukOp = false;
    if (alt !== null && ust !== null) return `<m${buyuk ? 'underover' : 'subsup'}>${taban}${alt}${ust}</m${buyuk ? 'underover' : 'subsup'}>`;
    if (alt !== null) return `<m${buyuk ? 'under' : 'sub'}>${taban}${alt}</m${buyuk ? 'under' : 'sub'}>`;
    if (ust !== null) return `<m${buyuk ? 'over' : 'sup'}>${taban}${ust}</m${buyuk ? 'over' : 'sup'}>`;
    return taban;
  }

  atom() {
    this.bosluk();
    this.buyukOp = false;
    if (this.i >= this.s.length) return null;
    const c = this.s[this.i];

    if (c === '}' || c === '&') return null;

    if (c === '{') {
      this.i++;
      const ic = this.liste(() => this.s[this.i] === '}');
      if (this.s[this.i] === '}') this.i++;
      return `<mrow>${ic}</mrow>`;
    }

    if (c === '\\') return this.komut();

    if (/[0-9]/.test(c)) {
      let j = this.i;
      while (j < this.s.length && /[0-9]/.test(this.s[j])) j++;
      if (this.s[j] === '.' && /[0-9]/.test(this.s[j + 1] || '')) {
        j++;
        while (j < this.s.length && /[0-9]/.test(this.s[j])) j++;
      }
      const sayi = this.s.slice(this.i, j);
      this.i = j;
      return `<mn>${sayi}</mn>`;
    }

    if (/[A-Za-z]/.test(c)) { this.i++; return `<mi>${c}</mi>`; }

    this.i++;
    if (c === '-') return '<mo>−</mo>';
    if (c === '|') return '<mo stretchy="false">|</mo>';
    if (c === '(' || c === '[') return `<mo stretchy="false">${c}</mo>`;
    if (c === ')' || c === ']') return `<mo stretchy="false">${c}</mo>`;
    if (c === "'") return '<mo>′</mo>';
    if (c === '~') return '<mspace width="0.25em"/>';
    return `<mo>${texKacis(c)}</mo>`;
  }

  /** `{...}` argümanını ham metin olarak okur (\text, \mathrm için). */
  hamGrup() {
    this.bosluk();
    if (this.s[this.i] !== '{') { const ch = this.s[this.i] || ''; this.i++; return ch; }
    this.i++;
    let derinlik = 1; let out = '';
    while (this.i < this.s.length && derinlik > 0) {
      const c = this.s[this.i];
      if (c === '{') derinlik++;
      else if (c === '}') { derinlik--; if (derinlik === 0) { this.i++; break; } }
      out += c; this.i++;
    }
    return out;
  }

  komut() {
    this.i++; // '\'
    let ad = '';
    if (/[A-Za-z]/.test(this.s[this.i] || '')) {
      while (this.i < this.s.length && /[A-Za-z]/.test(this.s[this.i])) ad += this.s[this.i++];
    } else {
      ad = this.s[this.i] || ''; this.i++;
    }

    if (ad === '\\') return '<mspace linebreak="newline"/>';
    if (ad in TEX_BOSLUK) return `<mspace width="${TEX_BOSLUK[ad]}"/>`;
    if (ad === 'quad' || ad === 'qquad') return `<mspace width="${TEX_BOSLUK[ad]}"/>`;

    if (ad === 'frac' || ad === 'tfrac' || ad === 'dfrac') {
      const a = this.atom() ?? '<mrow/>';
      const b = this.atom() ?? '<mrow/>';
      const stil = ad === 'dfrac' ? ' displaystyle="true"' : (ad === 'tfrac' ? ' displaystyle="false"' : '');
      return `<mfrac${stil}>${a}${b}</mfrac>`;
    }
    if (ad === 'sqrt') return `<msqrt>${this.atom() ?? '<mrow/>'}</msqrt>`;
    if (ad === 'hat') return `<mover accent="true">${this.atom() ?? '<mrow/>'}<mo stretchy="false">^</mo></mover>`;
    if (ad === 'bar' || ad === 'overline') return `<mover accent="true">${this.atom() ?? '<mrow/>'}<mo stretchy="true">‾</mo></mover>`;
    if (ad === 'tilde') return `<mover accent="true">${this.atom() ?? '<mrow/>'}<mo stretchy="false">~</mo></mover>`;
    if (ad === 'text') return `<mtext>${texKacis(this.hamGrup())}</mtext>`;
    if (ad === 'mathrm' || ad === 'operatorname') return `<mi mathvariant="normal">${texKacis(this.hamGrup())}</mi>`;
    if (ad === 'mathbf' || ad === 'boldsymbol') return `<mi mathvariant="bold">${texKacis(this.hamGrup())}</mi>`;
    if (ad === 'mathbb') return `<mi mathvariant="double-struck">${texKacis(this.hamGrup())}</mi>`;

    if (ad === 'left' || ad === 'right') {
      this.bosluk();
      let d = this.s[this.i] || '';
      this.i++;
      if (d === '\\') { // \left\lvert gibi
        let sub = '';
        while (this.i < this.s.length && /[A-Za-z]/.test(this.s[this.i])) sub += this.s[this.i++];
        d = sub === 'lvert' || sub === 'rvert' || sub === 'vert' ? '|'
          : sub === 'lVert' || sub === 'rVert' ? '‖'
            : sub === 'langle' ? '⟨' : sub === 'rangle' ? '⟩' : sub === '.' ? '' : '';
      }
      if (d === '.') d = '';
      if (ad === 'right') return d ? `<mo stretchy="true" fence="true">${texKacis(d)}</mo>` : '<mrow/>';
      const ic = this.liste(() => this.s.startsWith('\\right', this.i));
      const kapa = this.i < this.s.length ? this.atom() : '<mrow/>';
      const ac = d ? `<mo stretchy="true" fence="true">${texKacis(d)}</mo>` : '';
      return `<mrow>${ac}${ic}${kapa}</mrow>`;
    }

    if (ad === 'lvert' || ad === 'rvert' || ad === 'vert') return '<mo stretchy="false">|</mo>';
    if (ad === 'lVert' || ad === 'rVert') return '<mo stretchy="false">‖</mo>';
    if (ad === 'langle') return '<mo stretchy="false">⟨</mo>';
    if (ad === 'rangle') return '<mo stretchy="false">⟩</mo>';
    if (ad === '{' || ad === '}') return `<mo stretchy="false">${ad}</mo>`;

    if (ad === 'sum' || ad === 'prod' || ad === 'int') {
      this.buyukOp = true;
      const ch = ad === 'sum' ? '∑' : ad === 'prod' ? '∏' : '∫';
      return `<mo largeop="true" movablelimits="false" stretchy="false">${ch}</mo>`;
    }

    if (ad === 'begin') return this.ortam(this.hamGrup());
    if (ad === 'end') { this.hamGrup(); return '<mrow/>'; }

    if (ad in TEX_HARF) return `<mi>${TEX_HARF[ad]}</mi>`;
    if (ad in TEX_OP) return `<mo>${TEX_OP[ad]}</mo>`;
    if (TEX_ISLEV.has(ad)) return `<mi mathvariant="normal">${ad}</mi><mspace width="0.12em"/>`;

    return `<mtext>${texKacis(ad)}</mtext>`;
  }

  /** cases / aligned / array ortamları. */
  ortam(ad) {
    const bitis = `\\end{${ad}}`;
    const son = this.s.indexOf(bitis, this.i);
    const govde = son < 0 ? this.s.slice(this.i) : this.s.slice(this.i, son);
    this.i = son < 0 ? this.s.length : son + bitis.length;

    const satirlar = texBol(govde, '\\\\');
    const mtr = satirlar.map((satir) => {
      const hucreler = texBol(satir, '&');
      const mtd = hucreler.map((h) => `<mtd>${new TexAyristirici(h).liste()}</mtd>`).join('');
      return `<mtr>${mtd}</mtr>`;
    }).join('');

    if (ad === 'cases') {
      return `<mrow><mo stretchy="true" fence="true">{</mo><mtable columnalign="left left" columnspacing="1.1em" rowspacing="0.28em">${mtr}</mtable></mrow>`;
    }
    if (ad === 'aligned' || ad === 'align') {
      return `<mtable columnalign="right left" columnspacing="0.16em" rowspacing="0.28em">${mtr}</mtable>`;
    }
    return `<mtable columnalign="center" rowspacing="0.28em">${mtr}</mtable>`;
  }
}

/** Küme parantezi derinliğine saygılı ayraç bölmesi. */
function texBol(src, ayrac) {
  const parcalar = []; let derinlik = 0; let bas = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '{') derinlik++;
    else if (c === '}') derinlik--;
    else if (derinlik === 0 && src.startsWith(ayrac, i)) {
      parcalar.push(src.slice(bas, i));
      i += ayrac.length - 1;
      bas = i + 1;
    }
  }
  parcalar.push(src.slice(bas));
  return parcalar.map((p) => p.trim()).filter((p, k) => p.length > 0 || k < parcalar.length - 1);
}

/**
 * TeX kaynağını MathML'e çevirir. Kaynak TeX her zaman `data-tex` içinde
 * saklanır; `okunus` erişilebilir metin olarak `aria-label`'a yazılır.
 */
export function texToMathML(tex, { display = false, okunus = '' } = {}) {
  const govde = new TexAyristirici(String(tex)).liste();
  const etiket = okunus ? ` role="math" aria-label="${texKacis(okunus)}"` : '';
  return `<math xmlns="http://www.w3.org/1998/Math/MathML" display="${display ? 'block' : 'inline'}"`
    + `${etiket} data-tex="${texKacis(tex)}"><mrow>${govde}</mrow></math>`;
}

/* ══════════════════════════════════════════════════════════════════════
   2. Kayıp fonksiyonları — formül, türev, iddia
   Regresyon kayıpları artığın (r = ŷ − y) fonksiyonudur.
   Sınıflandırma kayıpları DOĞRU sınıfın olasılığının (p) ya da marjın
   (m = y·f(x), y ∈ {−1,+1}) fonksiyonudur. Logaritma tabanı e'dir (nat).
   ══════════════════════════════════════════════════════════════════════ */

const EPS = 1e-9;
const kis = (v, a, b) => (v < a ? a : v > b ? b : v);
const isaret = (r) => (r > 0 ? 1 : r < 0 ? -1 : 0);

/** Sayısal olarak kararlı log(cosh r) = |r| + log1p(e^{−2|r|}) − ln 2 */
export function logcosh(r) {
  const a = Math.abs(r);
  return a + Math.log1p(Math.exp(-2 * a)) - Math.LN2;
}

/** Huber kaybı; kırılma noktası |r| = δ, orada değer ½δ² ve eğim δ (C¹). */
export function huber(r, d) {
  const a = Math.abs(r);
  return a <= d ? 0.5 * r * r : d * (a - 0.5 * d);
}
export function huberTurev(r, d) { return kis(r, -d, d); }

/** Focal kayıp (Lin ve ark. 2017): ℓ = −(1−p)^γ ln p */
export function focal(p, g) {
  const q = kis(p, 1e-7, 1 - 1e-12);
  return -Math.pow(1 - q, g) * Math.log(q);
}
/** dℓ/dp = γ(1−p)^{γ−1} ln p − (1−p)^γ / p */
export function focalTurev(p, g) {
  const q = kis(p, 1e-7, 1 - 1e-12);
  return g * Math.pow(1 - q, g - 1) * Math.log(q) - Math.pow(1 - q, g) / q;
}

export const KAYIPLAR = [
  {
    id: 'mse', ad: 'Karesel kayıp', kisa: 'MSE', aile: 'regresyon', slot: 1,
    tex: '\\ell_{\\mathrm{MSE}}(r)=\\tfrac{1}{2}r^{2}',
    texTurev: '\\frac{\\partial\\ell}{\\partial r}=r',
    okunus: 'Karesel kayıp: r karenin yarısı; artığa göre türevi r.',
    olcekNotu: 'Toplu biçim MSE = (1/n)·Σrᵢ²; buradaki ½ Huber ile aynı eksene oturtmak içindir — gradyanı 2 kat ölçekler, biçimini değiştirmez.',
    kullanim: 'Gürültü Gauss ise ve aykırı değer yoksa: pürüzsüz, tek minimumlu, en verimli seçim.',
    l: (r) => 0.5 * r * r,
    dl: (r) => r,
  },
  {
    id: 'mae', ad: 'Mutlak kayıp', kisa: 'MAE', aile: 'regresyon', slot: 2,
    tex: '\\ell_{\\mathrm{MAE}}(r)=\\lvert r\\rvert',
    texTurev: '\\frac{\\partial\\ell}{\\partial r}=\\operatorname{sign}(r),\\quad r\\neq 0',
    okunus: 'Mutlak kayıp: r mutlak değer; türevi r sıfırdan farklıyken işaret r.',
    olcekNotu: 'r = 0’da türevlenemez; alt-gradyan kümesi [−1, +1]. Optimum, koşullu ORTANCAdır (MSE’de ortalama).',
    kullanim: 'Aykırı değerli veride ortanca davranışı istiyorsan; sabit gradyanı yüzünden adım küçültme şart.',
    l: (r) => Math.abs(r),
    dl: (r) => isaret(r),
  },
  {
    id: 'huber', ad: 'Huber kaybı', kisa: 'Huber', aile: 'regresyon', slot: 3, parametre: 'delta',
    tex: '\\ell_{\\delta}(r)=\\begin{cases}\\tfrac{1}{2}r^{2} & \\lvert r\\rvert\\le\\delta\\\\ \\delta\\left(\\lvert r\\rvert-\\tfrac{1}{2}\\delta\\right) & \\lvert r\\rvert>\\delta\\end{cases}',
    texTurev: '\\frac{\\partial\\ell}{\\partial r}=\\begin{cases}r & \\lvert r\\rvert\\le\\delta\\\\ \\delta\\operatorname{sign}(r) & \\lvert r\\rvert>\\delta\\end{cases}',
    okunus: 'Huber kaybı: r mutlak değeri delta’dan küçükse r karenin yarısı, değilse delta çarpı r mutlak değer eksi delta karenin yarısı.',
    olcekNotu: 'Kırılma noktası |r| = δ: iki kol orada hem DEĞERDE (½δ²) hem EĞİMDE (δ) buluşur — C¹ süreklidir, ikinci türev orada sıçrar.',
    kullanim: 'MSE’nin pürüzsüzlüğü + MAE’nin dayanıklılığı; δ’yı gürültünün ölçeğine ayarla.',
    l: (r, s) => huber(r, s.delta),
    dl: (r, s) => huberTurev(r, s.delta),
  },
  {
    id: 'logcosh', ad: 'Log-cosh', kisa: 'Log-cosh', aile: 'regresyon', slot: 4,
    tex: '\\ell(r)=\\ln\\cosh(r)',
    texTurev: '\\frac{\\partial\\ell}{\\partial r}=\\tanh(r)',
    okunus: 'Log-cosh kaybı: cosh r’nin doğal logaritması; türevi tanh r.',
    olcekNotu: 'Asimptotlar: küçük r’de ½r² − r⁴/12 + …, büyük |r|’de |r| − ln 2. Her yerde iki kez türevlenebilir; δ seçmez.',
    kullanim: 'Huber’in pürüzsüz hâli: kırılma noktası ayarlamak istemiyorsan.',
    l: (r) => logcosh(r),
    dl: (r) => Math.tanh(r),
  },
  {
    id: 'bce', ad: 'İkili çapraz entropi', kisa: 'BCE', aile: 'siniflandirma', slot: 1,
    tex: '\\ell(y,p)=-\\left[y\\ln p+(1-y)\\ln(1-p)\\right]',
    texTurev: '\\begin{aligned}\\frac{\\partial\\ell}{\\partial p}&=-\\frac{1}{p}\\;\\;(y=1)\\\\ \\frac{\\partial\\ell}{\\partial z}&=p-y\\end{aligned}',
    okunus: 'İkili çapraz entropi: eksi y çarpı log p artı bir eksi y çarpı log bir eksi p. Logit z’ye göre türevi p eksi y.',
    olcekNotu: 'z logit, p = σ(z). Olasılığa göre gradyan patlar (−1/p), logite göre gradyan [−1, 0] aralığında SINIRLIDIR — sigmoid+BCE bu yüzden birlikte türetilir.',
    kullanim: 'İki sınıf ve olasılık çıktısı istiyorsan; kalibrasyonu ödüllendiren düzgün (proper) bir skordur.',
    l: (p) => -Math.log(kis(p, 1e-12, 1)),
    dl: (p) => -1 / kis(p, 1e-12, 1),
  },
  {
    id: 'cce', ad: 'Kategorik çapraz entropi', kisa: 'CCE', aile: 'siniflandirma', slot: 5,
    tex: '\\ell(\\mathbf{y},\\mathbf{p})=-\\sum_{k=1}^{K}y_{k}\\ln p_{k}=-\\ln p_{c}',
    texTurev: '\\frac{\\partial\\ell}{\\partial z_{k}}=p_{k}-y_{k}',
    okunus: 'Kategorik çapraz entropi: eksi toplam k eşittir bir’den K’ya y k çarpı log p k; tek-sıcak hedefte eksi log p c.',
    olcekNotu: 'Tek-sıcak hedefte yalnız DOĞRU sınıfın olasılığı sayılır; diğer sınıflar softmax normalizasyonu üzerinden dolaylı cezalanır.',
    kullanim: 'K sınıf ve softmax çıktısı; hedef tek-sıcaksa BCE’nin doğrudan genellemesidir.',
    l: (p) => -Math.log(kis(p, 1e-12, 1)),
    dl: (p) => -1 / kis(p, 1e-12, 1),
  },
  {
    id: 'hinge', ad: 'Menteşe (hinge)', kisa: 'Hinge', aile: 'siniflandirma', slot: 6, eksen: 'marj',
    tex: '\\ell(m)=\\max(0,\\,1-m),\\quad m=y\\,f(x)',
    texTurev: '\\frac{\\partial\\ell}{\\partial m}=\\begin{cases}-1 & m<1\\\\ 0 & m>1\\end{cases}\\;,\\quad y\\in\\{-1,+1\\}',
    okunus: 'Menteşe kaybı: sıfır ile bir eksi marjın büyüğü; marj bir’den küçükken türevi eksi bir, büyükken sıfır.',
    olcekNotu: 'm = 1’de türevlenemez. Marj sağlandıktan sonra gradyan TAM SIFIRDIR: doğru sınıflanmış uzak örnek eğitime hiç katkı vermez.',
    kullanim: 'Olasılık değil karar sınırı istiyorsan (SVM); güven kalibrasyonu sunmaz.',
    l: (m) => Math.max(0, 1 - m),
    dl: (m) => (m < 1 ? -1 : 0),
  },
  {
    id: 'focal', ad: 'Focal kayıp', kisa: 'Focal', aile: 'siniflandirma', slot: 2, parametre: 'gama',
    tex: '\\ell_{\\gamma}(p)=-(1-p)^{\\gamma}\\ln p',
    texTurev: '\\frac{\\partial\\ell}{\\partial p}=\\gamma(1-p)^{\\gamma-1}\\ln p-\\frac{(1-p)^{\\gamma}}{p}',
    okunus: 'Focal kayıp: eksi bir eksi p üzeri gama çarpı log p.',
    olcekNotu: 'γ = 0’da tam olarak çapraz entropidir. (1−p)^γ bir MODÜLASYON çarpanıdır: kolay örneğin (p büyük) katkısını bastırır, zor örneğinkini (p küçük) neredeyse hiç değiştirmez.',
    kullanim: 'Aşırı dengesiz veride (nesne tespiti); kolay çoğunluğun gradyanı azınlığı boğuyorsa.',
    l: (p, s) => focal(p, s.gama),
    dl: (p, s) => focalTurev(p, s.gama),
  },
  {
    /* Galeride yer almaz: 8 temel kaybın karşılaştırmasına 8. adımda
       "γ neyi YAPMAZ" kanıtı olarak girer. */
    id: 'afocal', ad: 'α-dengeli focal', kisa: 'α-Focal', aile: 'siniflandirma', slot: 4, parametre: 'gama', galeriDisi: true,
    tex: '\\ell_{\\alpha,\\gamma}(p)=-\\alpha_{t}(1-p)^{\\gamma}\\ln p,\\qquad \\alpha_{t}=\\begin{cases}\\alpha & y=1\\\\ 1-\\alpha & y=0\\end{cases}',
    texTurev: '\\frac{\\partial\\ell}{\\partial p}=\\alpha_{t}\\left[\\gamma(1-p)^{\\gamma-1}\\ln p-\\frac{(1-p)^{\\gamma}}{p}\\right]',
    okunus: 'Alfa dengeli focal kayıp: eksi alfa t çarpı bir eksi p üzeri gama çarpı log p.',
    olcekNotu: 'α SINIF dengelemesini, γ kolay/zor dengelemesini yapar — iki ayrı iş. Bu sahnede α ters sınıf frekansına eşitlenir.',
    kullanim: 'Sınıf dengesizliğini gerçekten düzeltmek istiyorsan: γ tek başına bunu YAPMAZ.',
    l: (p, s) => focal(p, s.gama),
    dl: (p, s) => focalTurev(p, s.gama),
  },
];

const KAYIP_HARITA = Object.fromEntries(KAYIPLAR.map((k) => [k.id, k]));
const REG_IDS = KAYIPLAR.filter((k) => k.aile === 'regresyon').map((k) => k.id);

/* ══════════════════════════════════════════════════════════════════════
   3. Veri kümeleri (deterministik) ve gerçek eğitim koşuları
   ══════════════════════════════════════════════════════════════════════ */

/* Regresyon: ŷ = w·x + b, x ∈ [−1, 1] (merkezlenmiş → iyi koşullu Hessian).
   y_i = 3.0 + 2.4·x_i + gürültü_i (gürültü literal, tekrarlanabilir).      */
const REG_GURULTU = [0.35, -0.42, 0.18, -0.25, 0.51, -0.11, -0.38, 0.29, 0.05, -0.47, 0.22, -0.16];
export const REGRESYON = {
  n: REG_GURULTU.length,
  wGercek: 2.4,
  bGercek: 3.0,
  /* Aykırı değer indeksi 10 (x = 0,818): merkezden uzak = YÜKSEK KALDIRAÇ,
     böylece sapma yalnız b'yi değil EĞİMİ de büker (indeks 8'de eğim
     sapması %25'te kalıyordu, burada %40). */
  aykiriIndeks: 10,
  aykiriVarsayilan: 10.0,
  aykiriAralik: [0.5, 12.5],
  x: REG_GURULTU.map((_, i) => -1 + (2 * i) / (REG_GURULTU.length - 1)),
  yTemiz: REG_GURULTU.map((g, i) => 3.0 + 2.4 * (-1 + (2 * i) / (REG_GURULTU.length - 1)) + g),
};

/** Aykırı değersiz (temiz) en küçük kareler referansı — kapalı form. */
export function ekkTemiz() {
  const { x, yTemiz, aykiriIndeks } = REGRESYON;
  let n = 0; let sx = 0; let sy = 0; let sxx = 0; let sxy = 0;
  for (let i = 0; i < x.length; i++) {
    if (i === aykiriIndeks) continue;
    n++; sx += x[i]; sy += yTemiz[i]; sxx += x[i] * x[i]; sxy += x[i] * yTemiz[i];
  }
  const w = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  return { w, b: (sy - w * sx) / n };
}

/**
 * Regresyon eğitimi: TAM YIĞIN gradyan inişi, kapalı biçim ψ = ∂ℓ/∂r ile.
 *   r_i = w·x_i + b − y_i
 *   ∂L/∂w = (1/n)Σ ψ(r_i)·x_i     ∂L/∂b = (1/n)Σ ψ(r_i)
 * Başlangıç w = b = 0. Stokastiklik yok; aynı girdiler aynı yörüngeyi verir.
 */
export function egitRegresyon(kayipId, { aykiriY, eta = 0.25, adim = 600, durum = {} } = {}) {
  const kayip = KAYIP_HARITA[kayipId];
  const x = REGRESYON.x;
  const y = REGRESYON.yTemiz.slice();
  if (Number.isFinite(aykiriY)) y[REGRESYON.aykiriIndeks] = aykiriY;
  const n = x.length;
  let w = 0; let b = 0;
  const yol = new Float64Array((adim + 1) * 3);
  for (let t = 0; t <= adim; t++) {
    let L = 0; let gw = 0; let gb = 0;
    for (let i = 0; i < n; i++) {
      const r = w * x[i] + b - y[i];
      L += kayip.l(r, durum);
      const psi = kayip.dl(r, durum);
      gw += psi * x[i]; gb += psi;
    }
    yol[t * 3] = w; yol[t * 3 + 1] = b; yol[t * 3 + 2] = L / n;
    if (t === adim) break;
    w -= eta * (gw / n); b -= eta * (gb / n);
  }
  return { yol, adim, w: yol[adim * 3], b: yol[adim * 3 + 1], L: yol[adim * 3 + 2], y };
}

/* Sınıflandırma: 2B lojistik model z = w₁x₁ + w₂x₂ + b, p = σ(z).
   Veri bir kez sabit tohumlu LCG ile üretilir (aşağıdaki diziler modül
   yüklenirken hesaplanır ve bir daha değişmez).                            */
function lcg(tohum) {
  let s = tohum >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
function gauss(rnd) {
  const u = Math.max(1e-9, rnd());
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
/* 160 çoğunluk / 10 azınlık (%5,9) — kısmen örtüşen iki Gauss kümesi.
   Dengesizlik focal'ın tasarlandığı rejimi taklit etmek için seçildi.    */
function sinifVerisiUret() {
  const rnd = lcg(20240813);
  const nokta = [];
  for (let i = 0; i < 160; i++) nokta.push({ x1: -0.85 + 0.95 * gauss(rnd), x2: -0.65 + 0.95 * gauss(rnd), y: 0 });
  for (let i = 0; i < 10; i++) nokta.push({ x1: 1.05 + 0.45 * gauss(rnd), x2: 0.95 + 0.45 * gauss(rnd), y: 1 });
  return nokta;
}
export const SINIF = { nokta: sinifVerisiUret() };
SINIF.nPoz = SINIF.nokta.filter((d) => d.y === 1).length;
SINIF.nNeg = SINIF.nokta.length - SINIF.nPoz;
/** α = ters sınıf frekansı (azınlığa çoğunluk oranında ağırlık). */
SINIF.alfa = 1 - SINIF.nPoz / SINIF.nokta.length;

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

/** Doğru sınıfın olasılığı p_t = σ(s·z), s = 2y − 1. */
function pDogru(z, y) { return sigmoid((2 * y - 1) * z); }

/** α-dengeli focal'ın örnek ağırlığı; diğer kayıplarda 1. */
function alfaT(kayipId, y) {
  if (kayipId !== 'afocal') return 1;
  return y === 1 ? SINIF.alfa : 1 - SINIF.alfa;
}

/**
 * dℓ/dz — kapalı form:
 *   BCE     : p − y
 *   Focal   : s·[γ·p_t(1−p_t)^γ·ln p_t − (1−p_t)^{γ+1}]     (γ=0 → p − y)
 *   α-Focal : α_t · (yukarıdaki)
 *   Hinge   : −s·1[s·z < 1]
 */
export function sinifTurevZ(kayipId, z, y, gama) {
  const s = 2 * y - 1;
  if (kayipId === 'bce') return sigmoid(z) - y;
  if (kayipId === 'hinge') return s * z < 1 ? -s : 0;
  const pt = kis(pDogru(z, y), 1e-7, 1 - 1e-12);
  return alfaT(kayipId, y) * s * (gama * pt * Math.pow(1 - pt, gama) * Math.log(pt) - Math.pow(1 - pt, gama + 1));
}
function sinifKayip(kayipId, z, y, gama) {
  const s = 2 * y - 1;
  if (kayipId === 'hinge') return Math.max(0, 1 - s * z);
  const pt = kis(pDogru(z, y), 1e-12, 1);
  if (kayipId === 'bce') return -Math.log(pt);
  return -alfaT(kayipId, y) * Math.pow(1 - pt, gama) * Math.log(pt);
}

/**
 * Sınıflandırma eğitimi: tam yığın gradyan inişi, w = b = 0’dan.
 * `kolayPay`: yakınsamış modelde KOLAY örneklerin (p_t > 0,9) toplam
 * gradyan büyüklüğü içindeki payı — focal'ın asıl ölçülebilir etkisi.
 */
export function egitSiniflandirma(kayipId, { eta = 0.8, adim = 800, gama = 2 } = {}) {
  const d = SINIF.nokta;
  const n = d.length;
  let w1 = 0; let w2 = 0; let b = 0;
  for (let t = 0; t < adim; t++) {
    let g1 = 0; let g2 = 0; let gb = 0;
    for (let i = 0; i < n; i++) {
      const z = w1 * d[i].x1 + w2 * d[i].x2 + b;
      const dz = sinifTurevZ(kayipId, z, d[i].y, gama);
      g1 += dz * d[i].x1; g2 += dz * d[i].x2; gb += dz;
    }
    w1 -= eta * (g1 / n); w2 -= eta * (g2 / n); b -= eta * (gb / n);
  }
  let tp = 0; let fp = 0; let fn = 0; let tn = 0; let L = 0;
  let kolay = 0; let toplam = 0;
  for (let i = 0; i < n; i++) {
    const z = w1 * d[i].x1 + w2 * d[i].x2 + b;
    L += sinifKayip(kayipId, z, d[i].y, gama);
    const buyukluk = Math.abs(sinifTurevZ(kayipId, z, d[i].y, gama));
    toplam += buyukluk;
    if (pDogru(z, d[i].y) > 0.9) kolay += buyukluk;
    const tahmin = z >= 0 ? 1 : 0;
    if (d[i].y === 1 && tahmin === 1) tp++;
    else if (d[i].y === 0 && tahmin === 1) fp++;
    else if (d[i].y === 1 && tahmin === 0) fn++;
    else tn++;
  }
  const duyarlilik = tp + fn ? tp / (tp + fn) : 0;
  const kesinlik = tp + fp ? tp / (tp + fp) : 0;
  const f1 = duyarlilik + kesinlik ? (2 * duyarlilik * kesinlik) / (duyarlilik + kesinlik) : 0;
  return {
    w1, w2, b, L: L / n, tp, fp, fn, tn, duyarlilik, kesinlik, f1,
    kolayPay: toplam > 0 ? kolay / toplam : 0,
  };
}

/**
 * SABİT bir model üzerinde kolay örneklerin (p_t > 0,9) gradyan payını
 * γ'nın fonksiyonu olarak ölçer — modeli değiştirmeden yalnız γ'nın etkisi.
 */
export function kolayOrnekPayi(model, gama) {
  let kolay = 0; let toplam = 0;
  for (const d of SINIF.nokta) {
    const z = model.w1 * d.x1 + model.w2 * d.x2 + model.b;
    const buyukluk = Math.abs(sinifTurevZ('focal', z, d.y, gama));
    toplam += buyukluk;
    if (pDogru(z, d.y) > 0.9) kolay += buyukluk;
  }
  return toplam > 0 ? kolay / toplam : 0;
}

/* ══════════════════════════════════════════════════════════════════════
   4. Anlatı adımları
   ══════════════════════════════════════════════════════════════════════ */

export const ADIMLAR = [
  {
    id: 'galeri', panel: 'galeri',
    baslik: 'Kayıp fonksiyonu galerisi',
    iddia: 'Kayıp seçmek zevk meselesi değildir: her fonksiyon hatayı başka bir şeye çevirir ve modeli başka bir yere çeker.',
    kontrol: ['delta', 'gama'],
  },
  {
    id: 'ustuste', panel: 'egri',
    baslik: 'Aynı eksende: MSE, MAE, Huber, log-cosh',
    iddia: 'Sıfırın yakınında dördü de aynı parabole yaslanır; ayrışma kuyrukta başlar.',
    kontrol: ['delta', 'regChip'],
  },
  {
    id: 'gradyan', panel: 'egri',
    baslik: 'Gradyan büyüklüğü — eğitimi asıl bu belirler',
    iddia: 'Hata küçülürken MSE’nin gradyanı sıfıra söner, MAE’ninki ±1’de kalır: biri kendiliğinden yavaşlar, diğeri adım küçültmeden durmaz.',
    kontrol: ['delta', 'regChip'],
    vurguTurev: true,
  },
  {
    id: 'aykiri', panel: 'lab',
    baslik: 'Tek bir aykırı değer',
    iddia: 'Aykırı değeri sürükleyin: MSE’de cezası kareyle, gradyanı doğrusal büyür; MAE ve Huber’de gradyan tavana çarpar ve orada kalır.',
    kontrol: ['delta', 'eta', 'regChip', 'aykiri'],
  },
  {
    id: 'egitim', panel: 'lab',
    baslik: 'Aynı veri, farklı kayıp, farklı model',
    iddia: 'Gerçek gradyan inişi: MSE doğruyu aykırı değere doğru büker, Huber ve MAE kalabalığa sadık kalır.',
    kontrol: ['delta', 'eta', 'regChip', 'aykiri', 'kosu'],
    egitim: true,
  },
  {
    id: 'ce', panel: 'ce',
    baslik: 'Çapraz entropi: emin ve yanlış olmanın bedeli',
    iddia: 'Kare hata yanlış-ve-emin tahmini en fazla 1 ile cezalandırır; çapraz entropi cezayı sınırsız büyütür.',
    kontrol: ['p'],
  },
  {
    id: 'focal', panel: 'focal',
    baslik: 'Focal kayıp: kolay örnekleri susturmak',
    iddia: '(1−p)^γ çarpanı p = 0,9’daki kolay örneği γ = 2’de 100 kat kısar; p = 0,1’deki zor örneğe neredeyse dokunmaz.',
    kontrol: ['gama', 'p'],
  },
  {
    id: 'sinif', panel: 'sinif',
    baslik: 'Dengesiz sınıflar: γ neyi yapar, neyi YAPMAZ',
    iddia: 'γ kolay örneklerin gradyan payını düşürür ama sınırın YÖNÜNÜ değiştirmez — BCE ile focal üst üste biner. Sınıf dengelemesini yapan α’dır ve bedeli yanlış alarmdır.',
    kontrol: ['gama', 'eta'],
  },
];

/* ══════════════════════════════════════════════════════════════════════
   5. Çizim yardımcıları (2B tuval)
   ══════════════════════════════════════════════════════════════════════ */

function guzelAdim(span, hedef) {
  const ham = span / Math.max(1, hedef);
  const us = Math.pow(10, Math.floor(Math.log10(ham)));
  const oran = ham / us;
  const c = oran < 1.5 ? 1 : oran < 3 ? 2 : oran < 7 ? 5 : 10;
  return c * us;
}
function tikler(min, max, hedef = 5) {
  const adim = guzelAdim(max - min, hedef);
  const out = [];
  for (let v = Math.ceil(min / adim) * adim; v <= max + adim * 1e-6; v += adim) {
    out.push(Math.abs(v) < adim * 1e-6 ? 0 : v);
  }
  return out;
}

const nf = (v, d = 2) => (Number.isFinite(v)
  ? v.toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d })
  : '—');
const nfKisa = (v) => {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e4 || (a > 0 && a < 1e-3)) return v.toExponential(1).replace('.', ',').replace('e', '·10^');
  return nf(v, a >= 100 ? 0 : a >= 10 ? 1 : 2);
};

class Tuval {
  constructor(kap, { oran = 0.62, pad = [30, 18, 34, 58] } = {}) {
    this.kap = kap;
    this.oran = oran;
    this.pad = pad;
    this.cv = document.createElement('canvas');
    this.cv.className = 'lfp-cv';
    kap.appendChild(this.cv);
    this.ctx = this.cv.getContext('2d');
    this.w = 0; this.h = 0;
    this.dom = [-1, 1, -1, 1];
    this.boyutla();
  }

  boyutla() {
    const cw = Math.max(160, this.kap.clientWidth || this.kap.offsetWidth || 480);
    const ch = Math.max(120, Math.round(this.kap.clientHeight || cw * this.oran));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.w === cw && this.h === ch && this.dpr === dpr) return false;
    this.w = cw; this.h = ch; this.dpr = dpr;
    this.cv.width = Math.round(cw * dpr);
    this.cv.height = Math.round(ch * dpr);
    this.cv.style.width = `${cw}px`;
    this.cv.style.height = `${ch}px`;
    return true;
  }

  bas() {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    c.lineJoin = 'round';
    c.lineCap = 'round';
  }

  alan() {
    const [t, r, b, l] = this.pad;
    return { x0: l, y0: t, x1: this.w - r, y1: this.h - b, w: this.w - r - l, h: this.h - b - t };
  }

  setDom(xmin, xmax, ymin, ymax) { this.dom = [xmin, xmax, ymin, ymax]; }
  px(x) { const a = this.alan(); const [x0, x1] = this.dom; return a.x0 + ((x - x0) / (x1 - x0)) * a.w; }
  py(y) { const a = this.alan(); const [, , y0, y1] = this.dom; return a.y1 - ((y - y0) / (y1 - y0)) * a.h; }

  eksen(tema, { xEtiket = '', yEtiket = '', xTik = 5, yTik = 4, xFmt = nfKisa, yFmt = nfKisa, sifirX = true, sifirY = true, etiketsiz = false } = {}) {
    const c = this.ctx; const a = this.alan(); const [x0, x1, y0, y1] = this.dom;
    c.font = '500 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    c.strokeStyle = tema.rule; c.lineWidth = 1;
    // ızgara
    for (const v of tikler(x0, x1, xTik)) {
      const X = Math.round(this.px(v)) + 0.5;
      c.globalAlpha = 0.5; c.beginPath(); c.moveTo(X, a.y0); c.lineTo(X, a.y1); c.stroke(); c.globalAlpha = 1;
      if (etiketsiz) continue;
      c.fillStyle = tema.muted; c.textAlign = 'center'; c.textBaseline = 'top';
      c.fillText(xFmt(v), X, a.y1 + 7);
    }
    for (const v of tikler(y0, y1, yTik)) {
      const Y = Math.round(this.py(v)) + 0.5;
      c.globalAlpha = 0.5; c.beginPath(); c.moveTo(a.x0, Y); c.lineTo(a.x1, Y); c.stroke(); c.globalAlpha = 1;
      if (etiketsiz) continue;
      c.fillStyle = tema.muted; c.textAlign = 'right'; c.textBaseline = 'middle';
      c.fillText(yFmt(v), a.x0 - 8, Y);
    }
    // sıfır çizgileri
    c.strokeStyle = tema.muted; c.globalAlpha = 0.55; c.lineWidth = 1;
    if (sifirY && y0 < 0 && y1 > 0) { const Y = Math.round(this.py(0)) + 0.5; c.beginPath(); c.moveTo(a.x0, Y); c.lineTo(a.x1, Y); c.stroke(); }
    if (sifirX && x0 < 0 && x1 > 0) { const X = Math.round(this.px(0)) + 0.5; c.beginPath(); c.moveTo(X, a.y0); c.lineTo(X, a.y1); c.stroke(); }
    c.globalAlpha = 1;
    c.fillStyle = tema.muted;
    c.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    if (xEtiket) { c.textAlign = 'right'; c.textBaseline = 'bottom'; c.fillText(xEtiket, a.x1, this.h - 2); }
    if (yEtiket) { c.save(); c.translate(9, (a.y0 + a.y1) / 2); c.rotate(-Math.PI / 2); c.textAlign = 'center'; c.textBaseline = 'top'; c.fillText(yEtiket, 0, 0); c.restore(); }
  }

  /** fn(x) eğrisi; `ilerleme` ile soldan sağa çizim, sıçramalarda yol kırılır. */
  egri(fn, { renk, kalinlik = 2.4, kesik = null, alfa = 1, ilerleme = 1, ornek = 340, kopusEsigi = 0.28 } = {}) {
    const c = this.ctx; const [x0, x1, y0, y1] = this.dom;
    const yAralik = y1 - y0;
    const son = Math.max(1, Math.round(ornek * kis(ilerleme, 0, 1)));
    c.save();
    const a = this.alan();
    c.beginPath(); c.rect(a.x0 - 1, a.y0 - 1, a.w + 2, a.h + 2); c.clip();
    c.strokeStyle = renk; c.lineWidth = kalinlik; c.globalAlpha = alfa;
    if (kesik) c.setLineDash(kesik); else c.setLineDash([]);
    c.beginPath();
    let onceki = null;
    for (let i = 0; i <= son; i++) {
      const x = x0 + ((x1 - x0) * i) / ornek;
      const y = fn(x);
      if (!Number.isFinite(y)) { onceki = null; continue; }
      const kopus = onceki !== null && Math.abs(y - onceki) > kopusEsigi * yAralik;
      const X = this.px(x); const Y = this.py(kis(y, y0 - yAralik, y1 + yAralik));
      if (onceki === null || kopus) c.moveTo(X, Y); else c.lineTo(X, Y);
      onceki = y;
    }
    c.stroke();
    c.setLineDash([]);
    c.restore();
  }

  yol(nokta, { renk, kalinlik = 2, kesik = null, alfa = 1 } = {}) {
    const c = this.ctx;
    c.save();
    const a = this.alan();
    c.beginPath(); c.rect(a.x0 - 1, a.y0 - 1, a.w + 2, a.h + 2); c.clip();
    c.strokeStyle = renk; c.lineWidth = kalinlik; c.globalAlpha = alfa;
    if (kesik) c.setLineDash(kesik);
    c.beginPath();
    nokta.forEach(([x, y], i) => { const X = this.px(x); const Y = this.py(y); if (i === 0) c.moveTo(X, Y); else c.lineTo(X, Y); });
    c.stroke(); c.setLineDash([]); c.restore();
  }

  nokta(x, y, { renk, r = 4, dolgu = true, halka = null, kalinlik = 2, alfa = 1 } = {}) {
    const c = this.ctx;
    c.save(); c.globalAlpha = alfa;
    c.beginPath(); c.arc(this.px(x), this.py(y), r, 0, Math.PI * 2);
    if (dolgu) { c.fillStyle = renk; c.fill(); } else { c.strokeStyle = renk; c.lineWidth = kalinlik; c.stroke(); }
    if (halka) { c.beginPath(); c.arc(this.px(x), this.py(y), r + 4.5, 0, Math.PI * 2); c.strokeStyle = halka; c.lineWidth = 1.6; c.stroke(); }
    c.restore();
  }

  /**
   * Sağ kenar seri etiketleri: yakın geçen eğrilerin adları üst üste
   * biniyordu; piksel uzayında sıralanıp en az `bosluk` kadar itilirler.
   */
  sagEtiketler(liste, { xVeri, punto = 11.5, bosluk = 14, arka = null } = {}) {
    const hazir = liste
      .filter((d) => Number.isFinite(d.y))
      .map((d) => ({ ...d, py: this.py(d.y) }))
      .sort((a, b) => a.py - b.py);
    const alan = this.alan();
    for (let i = 1; i < hazir.length; i++) {
      if (hazir[i].py - hazir[i - 1].py < bosluk) hazir[i].py = hazir[i - 1].py + bosluk;
    }
    const tasma = hazir.length ? hazir[hazir.length - 1].py - (alan.y1 - 4) : 0;
    if (tasma > 0) for (const d of hazir) d.py -= tasma;
    for (const d of hazir) {
      this.etiket(xVeri, 0, d.metin, {
        renk: d.renk, hiza: 'right', taban: 'middle', punto,
        dy: d.py - this.py(0), alfa: d.alfa ?? 1, arka,
      });
    }
  }

  etiket(x, y, metin, { renk, hiza = 'left', taban = 'middle', dx = 0, dy = 0, punto = 12, kalin = 600, arka = null } = {}) {
    const c = this.ctx;
    c.save();
    c.font = `${kalin} ${punto}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    c.textAlign = hiza; c.textBaseline = taban;
    const X = this.px(x) + dx; const Y = this.py(y) + dy;
    if (arka) {
      const g = c.measureText(metin).width;
      const gx = hiza === 'right' ? X - g - 5 : hiza === 'center' ? X - g / 2 - 5 : X - 5;
      c.fillStyle = arka; c.globalAlpha = 0.86;
      c.fillRect(gx, Y - punto * 0.72, g + 10, punto * 1.44);
      c.globalAlpha = 1;
    }
    c.fillStyle = renk;
    c.fillText(metin, X, Y);
    c.restore();
  }
}

/* ══════════════════════════════════════════════════════════════════════
   6. Stil (modülden enjekte edilir — ayrı CSS dosyası yok)
   ══════════════════════════════════════════════════════════════════════ */

const STIL = `
.lfp {
  position: relative; display: grid; gap: 14px;
  grid-template-rows: auto 1fr auto auto;
  width: 100%; height: 100%; min-height: 520px; padding: 20px 24px 14px;
  border-radius: 18px; overflow: hidden;
  background: var(--color-canvas, #0F1013); color: var(--color-ink, #F4EEE1);
  font: 500 15px/1.4 ui-sans-serif, system-ui, -apple-system, sans-serif;
  outline: none;
}
.lfp:focus-visible { box-shadow: inset 0 0 0 2px var(--color-accent, #D3B26A); }
.lfp * { box-sizing: border-box; }
.lfp-cv { display: block; }

.lfp-head { display: grid; gap: 4px; }
.lfp-eyebrow {
  font: 600 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: .16em; text-transform: uppercase; color: var(--color-muted, #A9A296);
}
.lfp-head h1 { margin: 2px 0 0; font-size: 23px; line-height: 1.15; letter-spacing: -.012em; }
.lfp-claim { margin: 0; max-width: 96ch; font-size: 14px; line-height: 1.4; color: var(--color-muted, #A9A296); }
.lfp-claim b { color: var(--color-ink, #F4EEE1); font-weight: 600; }

.lfp-stage { position: relative; min-height: 0; }
.lfp-panel { position: absolute; inset: 0; display: none; min-height: 0; }
.lfp-panel[data-aktif="true"] { display: grid; }

/* — galeri — */
.lfp-panel[data-panel="galeri"] { grid-template-rows: auto 1fr auto 1fr; grid-template-columns: minmax(0, 1fr); gap: 10px; overflow: auto; }
.lfp-aile { font: 600 10.5px/1 ui-monospace, monospace; letter-spacing: .16em; text-transform: uppercase; color: var(--color-accent, #D3B26A); }
.lfp-kartlar { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; min-height: 0; min-width: 0; }
.lfp-kart {
  display: grid; grid-template-rows: auto auto 1fr auto;
  /* auto sütun izi max-content'e büyüyüp metni taşırıyordu — minmax(0,1fr) şart */
  grid-template-columns: minmax(0, 1fr); gap: 6px;
  min-height: 0; min-width: 0; overflow: hidden;
  padding: 10px 12px 8px; border: 1px solid var(--color-rule, #2E3037); border-radius: 12px;
  background: var(--color-surface, #1A1C21);
}
.lfp-kart[data-vurgu="true"] { border-color: var(--kart-renk); }
.lfp-kart[data-sonuk="true"] { opacity: .34; }
.lfp-kart h3 { margin: 0; display: flex; align-items: center; gap: 7px; font-size: 14px; font-weight: 600; }
.lfp-kart h3 i { width: 9px; height: 9px; border-radius: 50%; background: var(--kart-renk); flex: none; }
.lfp-kart h3 small { margin-left: auto; font: 500 10.5px/1 ui-monospace, monospace; color: var(--color-muted, #A9A296); }
.lfp-formul { display: grid; gap: 3px; justify-items: center; min-width: 0; font-size: 13px; color: var(--color-ink, #F4EEE1); overflow-x: auto; overflow-y: hidden; }
.lfp-formul math { font-size: 1em; }
.lfp-formul .lfp-turev { font-size: .82em; color: var(--color-muted, #A9A296); }
.lfp-mini { position: relative; min-height: 62px; }
.lfp-kart p { margin: 0; min-width: 0; font-size: 11.5px; line-height: 1.35; color: var(--color-muted, #A9A296); overflow-wrap: anywhere; }

/* — eğri / lab / ce / focal / sinif — */
.lfp-panel[data-panel="egri"] { grid-template-columns: 1fr 268px; gap: 14px; }
.lfp-cift { display: grid; grid-template-rows: 1fr 1fr; grid-template-columns: minmax(0, 1fr); gap: 8px; min-height: 0; min-width: 0; }
.lfp-panel[data-panel="lab"] .lfp-cift { grid-template-rows: 1.25fr 1fr; }
.lfp-panel[data-panel="lab"] { grid-template-columns: 1fr 306px; gap: 14px; }
.lfp-panel[data-panel="ce"] { grid-template-columns: 1fr 1fr 260px; gap: 12px; }
.lfp-panel[data-panel="focal"] { grid-template-columns: 1fr 1fr 260px; gap: 12px; }
.lfp-panel[data-panel="sinif"] { grid-template-columns: 1fr 300px; gap: 14px; }
.lfp-plot { position: relative; min-height: 0; min-width: 0; border: 1px solid var(--color-rule, #2E3037); border-radius: 12px; background: var(--color-surface, #1A1C21); overflow: hidden; }
.lfp-plot > figcaption {
  position: absolute; top: 8px; left: 12px; margin: 0; pointer-events: none;
  font: 600 11px/1 ui-monospace, monospace; letter-spacing: .08em;
  color: var(--color-muted, #A9A296);
}
.lfp-plot[data-surukle="true"] { cursor: ns-resize; }

.lfp-yan { display: grid; grid-template-columns: minmax(0, 1fr); align-content: start; gap: 10px; min-height: 0; min-width: 0; overflow: auto; }
.lfp-blok { min-width: 0; padding: 10px 12px; border: 1px solid var(--color-rule, #2E3037); border-radius: 12px; background: var(--color-surface, #1A1C21); }
.lfp-blok > h4 {
  margin: 0 0 8px; font: 600 11px/1 ui-monospace, monospace; letter-spacing: .08em;
  color: var(--color-muted, #A9A296);
}
.lfp-bar { display: grid; grid-template-columns: 74px 1fr auto; align-items: center; gap: 8px; margin-bottom: 6px; }
.lfp-bar span { font: 600 11.5px/1 ui-sans-serif, system-ui, sans-serif; color: var(--color-ink, #F4EEE1); }
.lfp-bar i { display: block; height: 9px; border-radius: 3px; background: var(--bar-renk); transform-origin: left center; }
.lfp-bar u { display: block; height: 9px; border-radius: 3px; background: color-mix(in srgb, var(--color-ink, #F4EEE1) 10%, transparent); overflow: hidden; }
.lfp-bar output { font: 600 12px/1 ui-monospace, monospace; font-variant-numeric: tabular-nums; color: var(--color-ink, #F4EEE1); min-width: 62px; text-align: right; }

.lfp-tablo { width: 100%; border-collapse: collapse; font: 500 12px/1.25 ui-monospace, monospace; font-variant-numeric: tabular-nums; }
.lfp-tablo th { text-align: right; font-weight: 600; color: var(--color-muted, #A9A296); padding: 3px 0 5px 10px; font-size: 10.5px; }
.lfp-tablo th:first-child { text-align: left; padding-left: 0; }
.lfp-tablo td { text-align: right; padding: 3px 0 3px 10px; border-top: 1px solid color-mix(in srgb, var(--color-rule, #2E3037) 70%, transparent); }
.lfp-tablo td:first-child { text-align: left; padding-left: 0; display: flex; align-items: center; gap: 6px; }
.lfp-tablo td i { width: 8px; height: 8px; border-radius: 50%; background: var(--sat-renk); flex: none; }
.lfp-tablo tr[data-ref="true"] td { color: var(--color-muted, #A9A296); }
.lfp-tablo tr[data-sonuk="true"] { opacity: .35; }

.lfp-not { margin: 8px 0 0; min-width: 0; font-size: 11.5px; line-height: 1.4; color: var(--color-muted, #A9A296); overflow-wrap: anywhere; }
.lfp-not b { color: var(--color-accent, #D3B26A); font-weight: 600; }

/* — kontroller — */
.lfp-kontrol { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; }
.lfp-kontrol button {
  border: 1.5px solid var(--color-rule, #2E3037); border-radius: 999px;
  background: transparent; color: var(--color-ink, #F4EEE1);
  padding: 6px 14px; font: 600 12.5px/1 inherit; cursor: pointer;
}
.lfp-kontrol button[data-birincil] { background: var(--color-ink, #F4EEE1); border-color: var(--color-ink, #F4EEE1); color: var(--color-canvas, #0F1013); }
.lfp-kontrol button:hover { border-color: var(--color-muted, #A9A296); }
.lfp-kontrol button:focus-visible { outline: 2px solid var(--color-accent, #D3B26A); outline-offset: 2px; }
.lfp-adimNo { font: 600 12px/1 ui-monospace, monospace; font-variant-numeric: tabular-nums; color: var(--color-muted, #A9A296); }
.lfp-grup { display: inline-flex; align-items: center; gap: 8px; }
.lfp-grup[hidden] { display: none; }
.lfp-grup label { font: 600 11.5px/1 ui-monospace, monospace; color: var(--color-muted, #A9A296); }
.lfp-grup output { font: 600 12px/1 ui-monospace, monospace; font-variant-numeric: tabular-nums; min-width: 44px; color: var(--color-ink, #F4EEE1); }
.lfp-grup input[type="range"] { width: 118px; accent-color: var(--color-accent, #D3B26A); }
.lfp-cip {
  display: inline-flex; align-items: center; gap: 6px;
  border: 1.5px solid var(--color-rule, #2E3037); border-radius: 999px;
  background: transparent; color: var(--color-ink, #F4EEE1);
  padding: 5px 11px; font: 600 12px/1 inherit; cursor: pointer;
}
.lfp-cip i { width: 9px; height: 9px; border-radius: 50%; background: var(--cip-renk); }
.lfp-cip[aria-pressed="false"] { opacity: .4; }
.lfp-cip[aria-pressed="false"] i { background: var(--color-muted, #A9A296); }

.lfp-truth { margin: 0; display: grid; gap: 2px; }
.lfp-truth strong {
  font: 600 10.5px/1 ui-monospace, monospace; letter-spacing: .12em;
  text-transform: uppercase; color: var(--color-accent, #D3B26A);
}
.lfp-truth small { font-size: 11.5px; line-height: 1.35; color: var(--color-muted, #A9A296); max-width: 118ch; }

.lfp[data-export="true"] [data-export-hide] { display: none !important; }
@media (prefers-reduced-motion: reduce) {
  .lfp * { transition: none !important; animation: none !important; }
}
@media (max-width: 1080px) {
  .lfp-kartlar { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .lfp-panel[data-panel="egri"], .lfp-panel[data-panel="lab"], .lfp-panel[data-panel="sinif"] { grid-template-columns: 1fr; }
  .lfp-panel[data-panel="ce"], .lfp-panel[data-panel="focal"] { grid-template-columns: 1fr 1fr; }
}
`;

function stilEnjekte() {
  if (document.getElementById('lfp-stil')) return;
  const s = document.createElement('style');
  s.id = 'lfp-stil';
  s.textContent = STIL;
  document.head.appendChild(s);
}

/* ══════════════════════════════════════════════════════════════════════
   7. Mount
   ══════════════════════════════════════════════════════════════════════ */

const azHareket = () => (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
const disaAktarim = () => document.documentElement.dataset.export === 'true'
  || new URLSearchParams(location.search).get('export') === '1';

function temaOku(el) {
  const cs = getComputedStyle(el);
  const al = (ad, yedek) => (cs.getPropertyValue(ad).trim() || yedek);
  return {
    canvas: al('--color-canvas', '#0F1013'),
    surface: al('--color-surface', '#1A1C21'),
    ink: al('--color-ink', '#F4EEE1'),
    muted: al('--color-muted', '#A9A296'),
    accent: al('--color-accent', '#D3B26A'),
    rule: al('--color-rule', '#2E3037'),
    data: [1, 2, 3, 4, 5, 6].map((i) => al(`--color-data-${i}`, ['#5590C9', '#C86A40', '#6FBF9A', '#A88BD9', '#D9C36A', '#C95F6A'][i - 1])),
  };
}

export function mountLossFunctions(host, secenek = {}) {
  stilEnjekte();

  const kok = document.createElement('div');
  kok.className = 'lfp';
  kok.tabIndex = 0;
  kok.setAttribute('role', 'group');
  kok.setAttribute('aria-label', 'Kayıp fonksiyonları — karşılaştırmalı sahne');
  host.appendChild(kok);

  const donuk = azHareket() || disaAktarim();
  if (disaAktarim()) kok.dataset.export = 'true';

  const durum = {
    adim: kis((secenek.adim ?? 1) - 1, 0, ADIMLAR.length - 1),
    delta: secenek.delta ?? 1.0,
    gama: secenek.gama ?? 2.0,
    eta: secenek.eta ?? 0.08,
    p: secenek.p ?? 0.1,
    aykiriY: secenek.aykiri ?? REGRESYON.aykiriVarsayilan,
    vurgu: secenek.kayip ?? null,
    gorunur: Object.fromEntries(KAYIPLAR.map((k) => [k.id, true])),
    kosuAdim: 200,
    kosuMax: 200,
    oynuyor: false,
    ilerleme: donuk ? 1 : 0,
  };

  const tema = temaOku(kok);
  const renk = (id) => tema.data[(KAYIP_HARITA[id]?.slot ?? 1) - 1];

  /* ---- iskelet ---- */
  kok.innerHTML = `
    <header class="lfp-head">
      <span class="lfp-eyebrow">Kayıp fonksiyonları · <span data-rol="adimNo"></span></span>
      <h1 data-rol="baslik"></h1>
      <p class="lfp-claim" data-rol="iddia"></p>
    </header>
    <div class="lfp-stage" data-rol="sahne"></div>
    <div class="lfp-kontrol" data-export-hide data-rol="kontrol"></div>
    <p class="lfp-truth">
      <strong>Doğruluk düzeyi · sayısal</strong>
      <small data-rol="truth"></small>
    </p>`;

  const sahne = kok.querySelector('[data-rol="sahne"]');
  const kontrolBar = kok.querySelector('[data-rol="kontrol"]');
  const elAdimNo = kok.querySelector('[data-rol="adimNo"]');
  const elBaslik = kok.querySelector('[data-rol="baslik"]');
  const elIddia = kok.querySelector('[data-rol="iddia"]');
  const elTruth = kok.querySelector('[data-rol="truth"]');

  /* ---- paneller ---- */
  const panelEl = {};
  for (const ad of ['galeri', 'egri', 'lab', 'ce', 'focal', 'sinif']) {
    const p = document.createElement('section');
    p.className = 'lfp-panel';
    p.dataset.panel = ad;
    p.dataset.aktif = 'false';
    sahne.appendChild(p);
    panelEl[ad] = p;
  }

  function plot(kap, baslik, ekstra = {}) {
    const f = document.createElement('figure');
    f.className = 'lfp-plot';
    f.style.margin = '0';
    if (ekstra.surukle) f.dataset.surukle = 'true';
    const cap = document.createElement('figcaption');
    cap.textContent = baslik;
    f.appendChild(cap);
    kap.appendChild(f);
    const t = new Tuval(f, ekstra);
    return { fig: f, tuval: t, cap };
  }

  /* — GALERİ — */
  const galeriKart = {};
  {
    const p = panelEl.galeri;
    const yap = (baslik, liste) => {
      const h = document.createElement('div');
      h.className = 'lfp-aile';
      h.textContent = baslik;
      p.appendChild(h);
      const g = document.createElement('div');
      g.className = 'lfp-kartlar';
      p.appendChild(g);
      for (const k of liste) {
        const kart = document.createElement('article');
        kart.className = 'lfp-kart';
        kart.style.setProperty('--kart-renk', renk(k.id));
        kart.innerHTML = `
          <h3><i></i>${k.ad}<small>${k.kisa}</small></h3>
          <div class="lfp-formul">
            ${texToMathML(k.tex, { display: true, okunus: k.okunus })}
            <div class="lfp-turev">${texToMathML(k.texTurev, { display: true, okunus: `${k.kisa} türevi` })}</div>
          </div>
          <div class="lfp-mini"></div>
          <p>${k.kullanim}</p>`;
        g.appendChild(kart);
        galeriKart[k.id] = { kart, tuval: new Tuval(kart.querySelector('.lfp-mini'), { pad: [6, 6, 6, 6] }) };
      }
    };
    const galeride = KAYIPLAR.filter((k) => !k.galeriDisi);
    yap('Regresyon — artığın r = ŷ − y fonksiyonu', galeride.filter((k) => k.aile === 'regresyon'));
    yap('Sınıflandırma — doğru sınıfın olasılığı p (hinge: marj m) fonksiyonu', galeride.filter((k) => k.aile === 'siniflandirma'));
  }

  /* — EĞRİ (üst üste + türev) — */
  const egriPlot = {};
  {
    const p = panelEl.egri;
    const cift = document.createElement('div');
    cift.className = 'lfp-cift';
    p.appendChild(cift);
    egriPlot.l = plot(cift, 'ℓ(r) — kayıp');
    egriPlot.dl = plot(cift, '∂ℓ/∂r — gradyan');
    const yan = document.createElement('div');
    yan.className = 'lfp-yan';
    yan.innerHTML = `
      <div class="lfp-blok">
        <h4>Gradyan büyüklüğü |∂ℓ/∂r|</h4>
        <table class="lfp-tablo" data-rol="gradTablo"></table>
        <p class="lfp-not" data-rol="gradNot"></p>
      </div>
      <div class="lfp-blok" data-rol="olcekBlok">
        <h4>Ölçek notu</h4>
        <p class="lfp-not" data-rol="olcekNot"></p>
      </div>`;
    p.appendChild(yan);
    egriPlot.gradTablo = yan.querySelector('[data-rol="gradTablo"]');
    egriPlot.gradNot = yan.querySelector('[data-rol="gradNot"]');
    egriPlot.olcekNot = yan.querySelector('[data-rol="olcekNot"]');
  }

  /* — LAB (aykırı değer + eğitim) — */
  const lab = {};
  {
    const p = panelEl.lab;
    const sol = document.createElement('div');
    sol.className = 'lfp-cift';
    p.appendChild(sol);
    lab.sacilim = plot(sol, 'veri + uydurulan doğrular · aykırı değeri sürükleyin', { surukle: true, pad: [30, 24, 34, 60] });
    /* Alt grafik adıma göre değişir: 4. adımda aykırı değerin y’sine göre
       kayıp/gradyan taraması, 5. adımda eğim yörüngesi. */
    lab.alt = plot(sol, '', { pad: [30, 24, 34, 60] });
    const yan = document.createElement('div');
    yan.className = 'lfp-yan';
    yan.innerHTML = `
      <div class="lfp-blok" data-rol="kayipBlok">
        <h4>Aykırı değerin kaybı ℓ(r)</h4>
        <div data-rol="kayipBarlar"></div>
      </div>
      <div class="lfp-blok" data-rol="gradBlok">
        <h4 data-rol="gradBaslik">Aykırı değerin gradyanı |∂ℓ/∂r|</h4>
        <div data-rol="gradBarlar"></div>
        <p class="lfp-not" data-rol="barNot"></p>
      </div>
      <div class="lfp-blok" data-rol="fitBlok">
        <h4>Uydurulan model · ŷ = w·x + b</h4>
        <table class="lfp-tablo" data-rol="fitTablo"></table>
        <p class="lfp-not" data-rol="fitNot"></p>
      </div>`;
    p.appendChild(yan);
    lab.kayipBlok = yan.querySelector('[data-rol="kayipBlok"]');
    lab.kayipBarlar = yan.querySelector('[data-rol="kayipBarlar"]');
    lab.gradBaslik = yan.querySelector('[data-rol="gradBaslik"]');
    lab.gradBarlar = yan.querySelector('[data-rol="gradBarlar"]');
    lab.barNot = yan.querySelector('[data-rol="barNot"]');
    lab.fitTablo = yan.querySelector('[data-rol="fitTablo"]');
    lab.fitNot = yan.querySelector('[data-rol="fitNot"]');
  }

  /* — ÇAPRAZ ENTROPİ — */
  const ce = {};
  {
    const p = panelEl.ce;
    ce.ceza = plot(p, 'ceza: −ln p ve (1−p)²');
    ce.kalib = plot(p, 'beklenen kayıp · gerçek olasılık q = 0,70');
    const yan = document.createElement('div');
    yan.className = 'lfp-yan';
    yan.innerHTML = `
      <div class="lfp-blok">
        <h4>Doğru sınıfa verilen olasılık p</h4>
        <table class="lfp-tablo" data-rol="ceTablo"></table>
      </div>
      <div class="lfp-blok">
        <h4>Kalibrasyon</h4>
        <p class="lfp-not" data-rol="kalibNot"></p>
      </div>`;
    p.appendChild(yan);
    ce.tablo = yan.querySelector('[data-rol="ceTablo"]');
    ce.kalibNot = yan.querySelector('[data-rol="kalibNot"]');
  }

  /* — FOCAL — */
  const fc = {};
  {
    const p = panelEl.focal;
    fc.egri = plot(p, 'ℓγ(p) = −(1−p)^γ · ln p');
    fc.carpan = plot(p, 'modülasyon çarpanı (1−p)^γ · log ölçek');
    const yan = document.createElement('div');
    yan.className = 'lfp-yan';
    yan.innerHTML = `
      <div class="lfp-blok">
        <h4>Bastırma oranı ℓγ / ℓCE</h4>
        <table class="lfp-tablo" data-rol="fcTablo"></table>
      </div>
      <div class="lfp-blok">
        <h4>Okuma</h4>
        <p class="lfp-not" data-rol="fcNot"></p>
      </div>`;
    p.appendChild(yan);
    fc.tablo = yan.querySelector('[data-rol="fcTablo"]');
    fc.not = yan.querySelector('[data-rol="fcNot"]');
  }

  /* — SINIFLANDIRMA — */
  const sn = {};
  {
    const p = panelEl.sinif;
    sn.sacilim = plot(p, 'karar sınırları · nokta boyu = focal ağırlığı (1−p_t)^γ', { pad: [30, 24, 34, 60] });
    const yan = document.createElement('div');
    yan.className = 'lfp-yan';
    yan.innerHTML = `
      <div class="lfp-blok">
        <h4>Azınlık sınıfı başarımı</h4>
        <table class="lfp-tablo" data-rol="snTablo"></table>
        <p class="lfp-not" data-rol="snNot"></p>
      </div>`;
    p.appendChild(yan);
    sn.tablo = yan.querySelector('[data-rol="snTablo"]');
    sn.not = yan.querySelector('[data-rol="snNot"]');
  }

  /* ---- kontroller ---- */
  kontrolBar.innerHTML = `
    <span class="lfp-grup">
      <button type="button" data-rol="geri" aria-label="Önceki adım">← Geri</button>
      <button type="button" data-birincil data-rol="ileri" aria-label="Sonraki adım">İleri →</button>
      <span class="lfp-adimNo" data-rol="adimNo2"></span>
    </span>
    <span class="lfp-grup" data-grup="delta">
      <label for="lfp-delta">δ (Huber)</label>
      <input id="lfp-delta" type="range" min="0.1" max="3" step="0.05">
      <output data-rol="deltaOut"></output>
    </span>
    <span class="lfp-grup" data-grup="gama">
      <label for="lfp-gama">γ (Focal)</label>
      <input id="lfp-gama" type="range" min="0" max="5" step="0.1">
      <output data-rol="gamaOut"></output>
    </span>
    <span class="lfp-grup" data-grup="eta">
      <label for="lfp-eta">η</label>
      <input id="lfp-eta" type="range" min="0.02" max="0.4" step="0.01">
      <output data-rol="etaOut"></output>
    </span>
    <span class="lfp-grup" data-grup="aykiri">
      <label for="lfp-aykiri">aykırı y</label>
      <input id="lfp-aykiri" type="range" min="${REGRESYON.aykiriAralik[0]}" max="${REGRESYON.aykiriAralik[1]}" step="0.1">
      <output data-rol="aykiriOut"></output>
    </span>
    <span class="lfp-grup" data-grup="p">
      <label for="lfp-p">p</label>
      <input id="lfp-p" type="range" min="0.002" max="0.998" step="0.002">
      <output data-rol="pOut"></output>
    </span>
    <span class="lfp-grup" data-grup="kosu">
      <button type="button" data-rol="kos">▶ Eğitimi koştur</button>
      <input id="lfp-kosu" type="range" min="0" max="200" step="1" aria-label="Eğitim adımı">
      <output data-rol="kosuOut"></output>
    </span>
    <span class="lfp-grup" data-grup="regChip" data-rol="regChip"></span>`;

  const bul = (s) => kontrolBar.querySelector(s);
  const inDelta = bul('#lfp-delta');
  const inGama = bul('#lfp-gama');
  const inEta = bul('#lfp-eta');
  const inAykiri = bul('#lfp-aykiri');
  const inP = bul('#lfp-p');
  const inKosu = bul('#lfp-kosu');
  const btnKos = bul('[data-rol="kos"]');
  const outDelta = bul('[data-rol="deltaOut"]');
  const outGama = bul('[data-rol="gamaOut"]');
  const outEta = bul('[data-rol="etaOut"]');
  const outAykiri = bul('[data-rol="aykiriOut"]');
  const outP = bul('[data-rol="pOut"]');
  const outKosu = bul('[data-rol="kosuOut"]');
  const elAdimNo2 = bul('[data-rol="adimNo2"]');

  const cipKap = bul('[data-rol="regChip"]');
  for (const k of KAYIPLAR.filter((x) => x.aile === 'regresyon')) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lfp-cip';
    b.style.setProperty('--cip-renk', renk(k.id));
    b.setAttribute('aria-pressed', 'true');
    b.dataset.kayip = k.id;
    b.innerHTML = `<i></i>${k.kisa}`;
    b.addEventListener('click', () => {
      durum.gorunur[k.id] = !durum.gorunur[k.id];
      b.setAttribute('aria-pressed', String(durum.gorunur[k.id]));
      kirlet();
    });
    cipKap.appendChild(b);
  }

  inDelta.value = String(durum.delta);
  inGama.value = String(durum.gama);
  inEta.value = String(durum.eta);
  inAykiri.value = String(durum.aykiriY);
  inP.value = String(durum.p);
  inKosu.value = String(durum.kosuAdim);

  inDelta.addEventListener('input', () => { durum.delta = Number(inDelta.value); egitimBayat = true; kirlet(); });
  inGama.addEventListener('input', () => { durum.gama = Number(inGama.value); sinifBayat = true; kirlet(); });
  inEta.addEventListener('input', () => { durum.eta = Number(inEta.value); egitimBayat = true; sinifBayat = true; kirlet(); });
  inAykiri.addEventListener('input', () => { durum.aykiriY = Number(inAykiri.value); egitimBayat = true; kirlet(); });
  inP.addEventListener('input', () => { durum.p = Number(inP.value); kirlet(); });
  inKosu.addEventListener('input', () => { durum.kosuAdim = Number(inKosu.value); durum.oynuyor = false; kirlet(); });
  btnKos.addEventListener('click', () => {
    if (durum.kosuAdim >= durum.kosuMax) durum.kosuAdim = 0;
    durum.oynuyor = !durum.oynuyor;
    btnKos.textContent = durum.oynuyor ? '❚❚ Duraklat' : '▶ Eğitimi koştur';
  });
  bul('[data-rol="ileri"]').addEventListener('click', () => git(durum.adim + 1));
  bul('[data-rol="geri"]').addEventListener('click', () => git(durum.adim - 1));

  /* Yerel klavye — GLOBAL DEĞİL (yalnız kök öğe odaktayken). */
  kok.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { git(durum.adim + 1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { git(durum.adim - 1); e.preventDefault(); }
    else if (e.key === ' ' && ADIMLAR[durum.adim].egitim) { btnKos.click(); e.preventDefault(); }
  });

  /* Aykırı değeri sürükleme */
  let surukluyor = false;
  function surukleY(ev) {
    const t = lab.sacilim.tuval;
    const kut = t.cv.getBoundingClientRect();
    const yPx = ev.clientY - kut.top;
    const a = t.alan();
    const [, , y0, y1] = t.dom;
    const y = y0 + ((a.y1 - yPx) / a.h) * (y1 - y0);
    durum.aykiriY = kis(y, REGRESYON.aykiriAralik[0], REGRESYON.aykiriAralik[1]);
    inAykiri.value = String(durum.aykiriY);
    egitimBayat = true;
    kirlet();
  }
  lab.sacilim.fig.addEventListener('pointerdown', (ev) => {
    surukluyor = true;
    lab.sacilim.fig.setPointerCapture(ev.pointerId);
    surukleY(ev);
  });
  lab.sacilim.fig.addEventListener('pointermove', (ev) => { if (surukluyor) surukleY(ev); });
  lab.sacilim.fig.addEventListener('pointerup', (ev) => {
    surukluyor = false;
    try { lab.sacilim.fig.releasePointerCapture(ev.pointerId); } catch { /* yoksay */ }
  });

  /* ---- hesap önbelleği ---- */
  let egitimBayat = true;
  let sinifBayat = true;
  let egitimSonuc = {};
  let sinifSonuc = {};
  let kirli = true;
  const kirlet = () => { kirli = true; };

  function egitimHesapla() {
    if (!egitimBayat) return;
    egitimSonuc = {};
    for (const id of REG_IDS) {
      egitimSonuc[id] = egitRegresyon(id, {
        aykiriY: durum.aykiriY, eta: durum.eta, adim: durum.kosuMax, durum,
      });
    }
    egitimBayat = false;
  }
  const SINIF_IDS = ['bce', 'focal', 'afocal', 'hinge'];
  function sinifHesapla() {
    if (!sinifBayat) return;
    const eta = kis(durum.eta * 3.2, 0.3, 2.0);
    sinifSonuc = Object.fromEntries(
      SINIF_IDS.map((id) => [id, egitSiniflandirma(id, { eta, adim: 800, gama: durum.gama })]),
    );
    sinifSonuc.eta = eta;
    sinifBayat = false;
  }

  /* ══════════ çizim ══════════ */

  function ciz() {
    const adim = ADIMLAR[durum.adim];
    const ilerleme = durum.ilerleme;
    for (const [ad, el] of Object.entries(panelEl)) el.dataset.aktif = String(ad === adim.panel);

    if (adim.panel === 'galeri') cizGaleri(ilerleme);
    else if (adim.panel === 'egri') cizEgri(ilerleme, adim);
    else if (adim.panel === 'lab') cizLab(ilerleme, adim);
    else if (adim.panel === 'ce') cizCE(ilerleme);
    else if (adim.panel === 'focal') cizFocal(ilerleme);
    else if (adim.panel === 'sinif') cizSinif(ilerleme);
  }

  /* — galeri — */
  function cizGaleri(ilerleme) {
    for (const k of KAYIPLAR) {
      const g = galeriKart[k.id];
      if (!g) continue;
      g.kart.dataset.vurgu = String(durum.vurgu === k.id);
      g.kart.dataset.sonuk = String(Boolean(durum.vurgu) && durum.vurgu !== k.id);
      const t = g.tuval;
      t.boyutla();
      t.bas();
      const c = renk(k.id);
      const mini = { xTik: 3, yTik: 3, etiketsiz: true };
      if (k.aile === 'regresyon') {
        t.setDom(-3, 3, -2.2, 4.8);
        t.eksen(tema, mini);
        t.egri((r) => k.l(r, durum), { renk: c, kalinlik: 2.2, ilerleme });
        t.egri((r) => k.dl(r, durum), { renk: c, kalinlik: 1.5, kesik: [4, 3], alfa: 0.7, ilerleme });
      } else if (k.eksen === 'marj') {
        t.setDom(-2, 3, -1.4, 3.2);
        t.eksen(tema, mini);
        t.egri((m) => k.l(m, durum), { renk: c, kalinlik: 2.2, ilerleme });
        t.egri((m) => k.dl(m, durum), { renk: c, kalinlik: 1.5, kesik: [4, 3], alfa: 0.7, ilerleme });
      } else {
        t.setDom(0.01, 1, -0.4, 4.2);
        t.eksen(tema, mini);
        t.egri((p) => k.l(p, durum), { renk: c, kalinlik: 2.2, ilerleme });
        t.egri((p) => kis(k.dl(p, durum), -4, 4), { renk: c, kalinlik: 1.5, kesik: [4, 3], alfa: 0.7, ilerleme });
      }
    }
  }

  /* — üst üste eğriler — */
  function cizEgri(ilerleme, adim) {
    const aktif = REG_IDS.filter((id) => durum.gorunur[id]);
    const R = 3.2;

    const t1 = egriPlot.l.tuval;
    t1.boyutla(); t1.bas();
    t1.setDom(-R, R, 0, 5.4);
    t1.eksen(tema, { xEtiket: 'artık r = ŷ − y', yEtiket: 'ℓ(r)', xTik: 6, yTik: 5 });
    for (const id of aktif) {
      const k = KAYIP_HARITA[id];
      const bas = !durum.vurgu || durum.vurgu === id;
      t1.egri((r) => k.l(r, durum), {
        renk: renk(id), kalinlik: adim.vurguTurev ? 1.8 : 2.6, alfa: bas ? (adim.vurguTurev ? 0.5 : 1) : 0.34, ilerleme,
      });
    }
    // Huber kırılma noktaları
    if (durum.gorunur.huber && durum.delta < R) {
      for (const s of [-1, 1]) {
        const rr = s * durum.delta;
        t1.nokta(rr, huber(rr, durum.delta), { renk: renk('huber'), r: 3.4, dolgu: false, kalinlik: 2, alfa: 0.9 * ilerleme });
      }
      t1.etiket(durum.delta, huber(durum.delta, durum.delta), `|r| = δ = ${nf(durum.delta, 2)}`, {
        renk: renk('huber'), dx: 8, dy: -10, punto: 11, arka: tema.surface,
      });
    }
    for (const id of aktif) {
      const k = KAYIP_HARITA[id];
      const yv = k.l(R * 0.92, durum);
      if (yv < 5.3) t1.etiket(R * 0.92, yv, k.kisa, { renk: renk(id), dx: -6, dy: -9, hiza: 'right', punto: 11.5, alfa: ilerleme });
    }

    const t2 = egriPlot.dl.tuval;
    t2.boyutla(); t2.bas();
    t2.setDom(-R, R, -3.4, 3.4);
    t2.eksen(tema, { xEtiket: 'artık r', yEtiket: '∂ℓ/∂r', xTik: 6, yTik: 5 });
    for (const id of aktif) {
      const k = KAYIP_HARITA[id];
      const bas = !durum.vurgu || durum.vurgu === id;
      t2.egri((r) => k.dl(r, durum), {
        renk: renk(id), kalinlik: adim.vurguTurev ? 3 : 2.2, alfa: bas ? 1 : 0.34, ilerleme, kopusEsigi: 0.12,
      });
    }
    if (durum.gorunur.mae) {
      t2.nokta(0, 0, { renk: tema.canvas, r: 3.2, dolgu: true, alfa: ilerleme });
      t2.nokta(0, 0, { renk: renk('mae'), r: 3.2, dolgu: false, kalinlik: 1.8, alfa: ilerleme });
      t2.etiket(0, 0, 'MAE: r = 0’da türev yok', { renk: renk('mae'), dx: 10, dy: 14, punto: 11, arka: tema.surface, alfa: ilerleme });
    }

    // yan tablo
    const noktalar = [0.1, 0.5, 1, 3, 8];
    let html = `<tr><th>kayıp</th>${noktalar.map((r) => `<th>r=${nf(r, r < 1 ? 1 : 0)}</th>`).join('')}</tr>`;
    for (const id of REG_IDS) {
      const k = KAYIP_HARITA[id];
      html += `<tr data-sonuk="${!durum.gorunur[id]}" style="--sat-renk:${renk(id)}"><td><i></i>${k.kisa}</td>`
        + noktalar.map((r) => `<td>${nf(Math.abs(k.dl(r, durum)), 2)}</td>`).join('') + '</tr>';
    }
    egriPlot.gradTablo.innerHTML = html;
    egriPlot.gradNot.innerHTML = 'MSE gradyanı artıkla birlikte <b>sönerek sıfıra</b> gider — model kendiliğinden yavaşlar. '
      + `MAE’ninki her yerde <b>1</b>’dir: optimuma varınca durmaz, η kadar salınır. Huber δ = ${nf(durum.delta, 2)}’de tavanlanır: `
      + 'küçük hatada MSE gibi söner, büyük hatada MAE gibi sabitlenir.';
    egriPlot.olcekNot.textContent = KAYIP_HARITA.mse.olcekNotu;
  }

  /* — lab: saçılım + barlar + tarama/eğitim — */
  function cizLab(ilerleme, adim) {
    egitimHesapla();
    const egitimModu = Boolean(adim.egitim);
    const x = REGRESYON.x;
    const xOut = x[REGRESYON.aykiriIndeks];
    const y = REGRESYON.yTemiz.slice();
    y[REGRESYON.aykiriIndeks] = durum.aykiriY;
    const ref = ekkTemiz();
    const aktif = REG_IDS.filter((id) => durum.gorunur[id]);
    const adimIndeks = kis(Math.round(durum.kosuAdim), 0, durum.kosuMax);

    lab.kayipBlok.hidden = egitimModu;
    lab.gradBaslik.textContent = egitimModu
      ? 'Aykırı değerin toplam gradyandaki payı'
      : 'Aykırı değerin gradyanı |∂ℓ/∂r|';

    /* ---- saçılım + uydurulan doğrular ---- */
    const t = lab.sacilim.tuval;
    const sagEtiket = [];
    t.boyutla(); t.bas();
    t.setDom(-1.18, 1.18, 0, 12.6);
    t.eksen(tema, { xEtiket: 'x', yEtiket: 'y', xTik: 5, yTik: 5 });
    for (const id of aktif) {
      const s = egitimSonuc[id];
      const w = s.yol[adimIndeks * 3];
      const b = s.yol[adimIndeks * 3 + 1];
      const one = !durum.vurgu || durum.vurgu === id;
      t.yol([[-1.18, w * -1.18 + b], [1.18, w * 1.18 + b]], {
        renk: renk(id), kalinlik: 2.4, alfa: (one ? 1 : 0.34) * ilerleme,
      });
      sagEtiket.push({ y: w * 1.15 + b, metin: KAYIP_HARITA[id].kisa, renk: renk(id), alfa: (one ? 1 : 0.34) * ilerleme });
    }
    t.sagEtiketler(sagEtiket, { xVeri: 1.15, arka: tema.surface });
    t.yol([[-1.18, ref.w * -1.18 + ref.b], [1.18, ref.w * 1.18 + ref.b]], { renk: tema.muted, kalinlik: 1.4, kesik: [6, 4], alfa: 0.8 });
    t.etiket(-0.55, ref.w * -0.55 + ref.b, 'aykırısız EKK', { renk: tema.muted, dy: 13, hiza: 'center', punto: 10.5, arka: tema.surface });
    for (let i = 0; i < x.length; i++) {
      const aykiri = i === REGRESYON.aykiriIndeks;
      t.nokta(x[i], y[i], { renk: aykiri ? tema.accent : tema.ink, r: aykiri ? 6 : 3.6, halka: aykiri ? tema.accent : null });
    }
    /* aykırı değerin ORTAK referans doğrusuna olan artığı — sürüklerken görünür */
    t.yol([[xOut, ref.w * xOut + ref.b], [xOut, durum.aykiriY]], { renk: tema.accent, kalinlik: 1.3, kesik: [3, 3], alfa: 0.75 });
    t.etiket(xOut, durum.aykiriY, 'aykırı değer ↕', { renk: tema.accent, dx: 13, punto: 11, kalin: 700, arka: tema.surface });

    /* ---- barlar ---- */
    const rRef = ref.w * xOut + ref.b - durum.aykiriY;
    const kayipSat = []; const gradSat = [];
    let kMax = 0; let gMax = 0;
    for (const id of REG_IDS) {
      const k = KAYIP_HARITA[id];
      if (egitimModu) {
        const s = egitimSonuc[id];
        const w = s.yol[adimIndeks * 3]; const b = s.yol[adimIndeks * 3 + 1];
        let toplam = 0;
        for (let i = 0; i < x.length; i++) toplam += Math.abs(k.dl(w * x[i] + b - y[i], durum));
        const pay = toplam > 0 ? Math.abs(k.dl(w * xOut + b - durum.aykiriY, durum)) / toplam : 0;
        gradSat.push({ id, k, v: pay, metin: `%${nf(pay * 100, 1)}` });
        gMax = Math.max(gMax, pay);
      } else {
        const kv = k.l(rRef, durum); const gv = Math.abs(k.dl(rRef, durum));
        kayipSat.push({ id, k, v: kv, metin: nf(kv, 2) });
        gradSat.push({ id, k, v: gv, metin: nf(gv, 2) });
        kMax = Math.max(kMax, kv); gMax = Math.max(gMax, gv);
      }
    }
    const barHtml = (satirlar, enB) => satirlar.map((s) => {
      const oran = enB > 0 ? s.v / enB : 0;
      return `<div class="lfp-bar" style="--bar-renk:${renk(s.id)}" ${durum.gorunur[s.id] ? '' : 'data-sonuk="true"'}>`
        + `<span>${s.k.kisa}</span><u><i style="width:${(oran * 100).toFixed(1)}%"></i></u><output>${s.metin}</output></div>`;
    }).join('');
    lab.kayipBarlar.innerHTML = egitimModu ? '' : barHtml(kayipSat, kMax);
    lab.gradBarlar.innerHTML = barHtml(gradSat, gMax);
    lab.barNot.innerHTML = egitimModu
      ? 'Yakınsamış modelde tek bir aykırı değerin toplam gradyan büyüklüğü içindeki payı. MSE’de bu pay '
        + '<b>ezici</b>; MAE’de bir örnek asla 1/n = %8,3’ten fazla söz sahibi olamaz.'
      : `Her iki blok da <b>ORTAK</b> referans doğrusunda (aykırısız EKK) ölçülür; artık r = ${nf(rRef, 2)}. `
        + 'MSE’nin kaybı r² ile, gradyanı |r| ile büyür; MAE ve Huber’in gradyanı <b>tavanlıdır</b> — '
        + 'aykırı değer ne kadar uzaklaşırsa uzaklaşsın çekişi artmaz.';

    /* ---- fit tablosu ---- */
    let ft = '<tr><th>kayıp</th><th>w</th><th>b</th><th>sapma</th></tr>';
    for (const id of REG_IDS) {
      const s = egitimSonuc[id];
      const w = s.yol[adimIndeks * 3]; const b = s.yol[adimIndeks * 3 + 1];
      ft += `<tr data-sonuk="${!durum.gorunur[id]}" style="--sat-renk:${renk(id)}"><td><i></i>${KAYIP_HARITA[id].kisa}</td>`
        + `<td>${nf(w, 3)}</td><td>${nf(b, 3)}</td><td>%${nf(Math.abs(w / ref.w - 1) * 100, 0)}</td></tr>`;
    }
    ft += `<tr data-ref="true" style="--sat-renk:${tema.muted}"><td><i></i>aykırısız EKK</td><td>${nf(ref.w, 3)}</td><td>${nf(ref.b, 3)}</td><td>—</td></tr>`;
    lab.fitTablo.innerHTML = ft;
    const wMse = egitimSonuc.mse.yol[adimIndeks * 3];
    const wHub = egitimSonuc.huber.yol[adimIndeks * 3];
    lab.fitNot.innerHTML = `Aykırısız en küçük kareler eğimi <b>${nf(ref.w, 3)}</b>. Aykırı değerle MSE `
      + `<b>${nf(wMse, 3)}</b>’e kayar (%${nf(Math.abs(wMse / ref.w - 1) * 100, 0)} sapma), `
      + `Huber <b>${nf(wHub, 3)}</b>’te kalır (%${nf(Math.abs(wHub / ref.w - 1) * 100, 0)}).`;

    /* ---- alt grafik ---- */
    const at = lab.alt.tuval;
    at.boyutla(); at.bas();
    if (egitimModu) {
      lab.alt.cap.textContent = 'eğim w — eğitim adımı (gerçek gradyan inişi, w = b = 0’dan)';
      let wMin = ref.w; let wMax = ref.w;
      for (const id of aktif) {
        const yol = egitimSonuc[id].yol;
        for (let st = 0; st <= durum.kosuMax; st += 2) { wMin = Math.min(wMin, yol[st * 3]); wMax = Math.max(wMax, yol[st * 3]); }
      }
      const pay = Math.max(0.15, (wMax - wMin) * 0.1);
      const wEtiket = [];
      at.setDom(0, durum.kosuMax, wMin - pay, wMax + pay);
      at.eksen(tema, { xEtiket: 'adım', yEtiket: 'w', xTik: 5, yTik: 4, sifirX: false, xFmt: (v) => nf(v, 0) });
      at.yol([[0, ref.w], [durum.kosuMax, ref.w]], { renk: tema.muted, kalinlik: 1.3, kesik: [5, 4], alfa: 0.85 });
      at.etiket(durum.kosuMax * 0.5, ref.w, 'aykırısız EKK eğimi', { renk: tema.muted, dy: -9, hiza: 'center', punto: 10.5, arka: tema.surface });
      for (const id of aktif) {
        const yol = egitimSonuc[id].yol;
        const pts = [];
        for (let st = 0; st <= adimIndeks; st++) pts.push([st, yol[st * 3]]);
        at.yol(pts, { renk: renk(id), kalinlik: 2, alfa: !durum.vurgu || durum.vurgu === id ? 1 : 0.34 });
        at.nokta(adimIndeks, yol[adimIndeks * 3], { renk: renk(id), r: 3.4 });
        wEtiket.push({ y: yol[adimIndeks * 3], metin: KAYIP_HARITA[id].kisa, renk: renk(id), alfa: !durum.vurgu || durum.vurgu === id ? 1 : 0.34 });
      }
      at.sagEtiketler(wEtiket, { xVeri: durum.kosuMax - durum.kosuMax * 0.012, arka: tema.surface });
    } else {
      /* Aykırı değerin y'si TARANIR: kayıp (düz) ve gradyan (kesik),
         hepsi ORTAK referans doğrusuna göre — elmalar elmalarla. */
      lab.alt.cap.textContent = 'aykırının y’si taranırsa · |∂ℓ/∂r| — ortak referans doğrusunda';
      const yA = REGRESYON.aykiriAralik[0]; const yB = REGRESYON.aykiriAralik[1];
      const rOf = (yy) => ref.w * xOut + ref.b - yy;
      let ust = 1.4;
      for (const id of aktif) ust = Math.max(ust, Math.abs(KAYIP_HARITA[id].dl(rOf(yB), durum)));
      at.setDom(yA, yB, 0, ust * 1.12);
      at.eksen(tema, { xEtiket: 'aykırı değerin y’si', yEtiket: '|∂ℓ/∂r|', xTik: 6, yTik: 5, sifirX: false });
      const altEtiket = [];
      for (const id of aktif) {
        const k = KAYIP_HARITA[id];
        const one = !durum.vurgu || durum.vurgu === id;
        at.egri((yy) => Math.abs(k.dl(rOf(yy), durum)), { renk: renk(id), kalinlik: 2.6, alfa: (one ? 1 : 0.34) * ilerleme, ilerleme });
        altEtiket.push({ y: Math.abs(k.dl(rOf(yB), durum)), metin: k.kisa, renk: renk(id), alfa: (one ? 1 : 0.34) * ilerleme });
      }
      at.sagEtiketler(altEtiket, { xVeri: yB - 0.1, arka: tema.surface });
      /* Yardımcı "tavan" çizgisi Huber eğrisinin TAM üstüne düşüp onu
         gizliyordu — yalnız etiket kalsın, plato eğrinin kendisinde okunur. */
      at.etiket(yA + 0.3, Math.max(1, durum.delta), `tavan: MAE 1 · Huber δ = ${nf(durum.delta, 2)}`, { renk: tema.muted, dy: -11, punto: 10.5, arka: tema.surface });
      at.yol([[durum.aykiriY, 0], [durum.aykiriY, ust * 1.2]], { renk: tema.accent, kalinlik: 1.5, kesik: [4, 4], alfa: 0.95 });
      const sag = durum.aykiriY > (yA + yB) / 2;
      at.etiket(durum.aykiriY, ust * 1.05, `şu an y = ${nf(durum.aykiriY, 1)}`, {
        renk: tema.accent, dx: sag ? -9 : 9, hiza: sag ? 'right' : 'left', punto: 11, kalin: 700, arka: tema.surface,
      });
      for (const id of aktif) {
        at.nokta(durum.aykiriY, Math.abs(KAYIP_HARITA[id].dl(rOf(durum.aykiriY), durum)), { renk: renk(id), r: 4.2 });
      }
    }

    outKosu.textContent = `${adimIndeks}/${durum.kosuMax}`;
  }

  /* — çapraz entropi — */
  function cizCE(ilerleme) {
    const p = kis(durum.p, 0.002, 0.998);
    const t = ce.ceza.tuval;
    t.boyutla(); t.bas();
    t.setDom(0, 1, 0, 7);
    t.eksen(tema, { xEtiket: 'doğru sınıfa verilen olasılık p', yEtiket: 'kayıp (nat)', xTik: 5, yTik: 6, sifirX: false });
    t.egri((q) => -Math.log(Math.max(1e-4, q)), { renk: renk('bce'), kalinlik: 2.8, ilerleme });
    t.egri((q) => (1 - q) * (1 - q), { renk: tema.data[3], kalinlik: 2.2, kesik: [6, 4], ilerleme });
    t.etiket(0.22, -Math.log(0.22), 'çapraz entropi −ln p', { renk: renk('bce'), dx: 10, dy: -10, punto: 11.5, arka: tema.surface });
    t.etiket(0.55, (1 - 0.55) * (1 - 0.55), 'kare hata (1−p)² · tavan 1', { renk: tema.data[3], dx: 10, dy: 14, punto: 11.5, arka: tema.surface });
    t.yol([[p, 0], [p, 7]], { renk: tema.accent, kalinlik: 1.4, kesik: [4, 4], alfa: 0.9 });
    t.nokta(p, Math.min(7, -Math.log(p)), { renk: tema.accent, r: 4.6 });
    t.etiket(p, Math.min(6.8, -Math.log(p)), `p = ${nf(p, 3)}`, { renk: tema.accent, dx: p > 0.5 ? -10 : 10, dy: -12, hiza: p > 0.5 ? 'right' : 'left', punto: 11.5, arka: tema.surface });

    const t2 = ce.kalib.tuval;
    const q = 0.7;
    t2.boyutla(); t2.bas();
    t2.setDom(0.01, 0.99, 0, 3);
    t2.eksen(tema, { xEtiket: 'raporlanan olasılık p', yEtiket: 'E[ℓ]', xTik: 5, yTik: 4, sifirX: false });
    const bekCE = (pp) => -(q * Math.log(pp) + (1 - q) * Math.log(1 - pp));
    t2.egri(bekCE, { renk: renk('bce'), kalinlik: 2.6, ilerleme });
    t2.yol([[q, 0], [q, 3]], { renk: tema.accent, kalinlik: 1.4, kesik: [4, 4], alfa: 0.9 });
    t2.nokta(q, bekCE(q), { renk: tema.accent, r: 4.6 });
    t2.etiket(q, bekCE(q), `en küçük: p = q = 0,70`, { renk: tema.accent, dx: 10, dy: -12, punto: 11.5, arka: tema.surface });

    const satir = [0.99, 0.9, 0.5, 0.1, 0.01, 0.001];
    let html = '<tr><th>p</th><th>−ln p</th><th>bit</th><th>(1−p)²</th></tr>';
    for (const v of satir) {
      html += `<tr><td>${nf(v, 3)}</td><td>${nf(-Math.log(v), 2)}</td><td>${nf(-Math.log2(v), 2)}</td><td>${nf((1 - v) * (1 - v), 3)}</td></tr>`;
    }
    html += `<tr data-ref="true"><td>${nf(p, 3)}</td><td>${nf(-Math.log(p), 2)}</td><td>${nf(-Math.log2(p), 2)}</td><td>${nf((1 - p) * (1 - p), 3)}</td></tr>`;
    ce.tablo.innerHTML = html;
    ce.kalibNot.innerHTML = 'Çapraz entropi <b>düzgün (proper) bir skordur</b>: gerçek olasılık q iken beklenen kayıp '
      + 'yalnız p = q’da en küçüktür. Modelin kazanmak için tek yolu <b>dürüst olasılık</b> raporlamaktır — '
      + 'kare hatanın (Brier) da düzgün olduğunu, ama yanlış-ve-emin tahmini 1 ile sınırladığını unutma.';
  }

  /* — focal — */
  function cizFocal(ilerleme) {
    const g = durum.gama;
    const p = kis(durum.p, 0.002, 0.998);
    const aile = [0, 0.5, 1, 2, 5];
    const t = fc.egri.tuval;
    t.boyutla(); t.bas();
    t.setDom(0, 1, 0, 5);
    t.eksen(tema, { xEtiket: 'doğru sınıfın olasılığı p', yEtiket: 'ℓγ(p) (nat)', xTik: 5, yTik: 5, sifirX: false });
    const aileEtiket = [];
    for (const gg of aile) {
      t.egri((q) => focal(q, gg), { renk: tema.muted, kalinlik: 1.2, alfa: 0.42, ilerleme });
      aileEtiket.push({ y: focal(0.42, gg), metin: `γ=${nf(gg, gg % 1 ? 1 : 0)}`, renk: tema.muted, alfa: 0.8 });
    }
    t.sagEtiketler(aileEtiket, { xVeri: 0.42, punto: 10.5, bosluk: 13, arka: tema.surface });
    t.egri((q) => focal(q, 0), { renk: renk('bce'), kalinlik: 2.2, kesik: [6, 4], ilerleme });
    t.egri((q) => focal(q, g), { renk: renk('focal'), kalinlik: 3, ilerleme });
    t.etiket(0.5, focal(0.5, g), `canlı γ = ${nf(g, 1)}`, { renk: renk('focal'), dx: 10, dy: -12, punto: 12, arka: tema.surface });
    t.nokta(p, focal(p, g), { renk: renk('focal'), r: 4.6 });
    t.nokta(p, focal(p, 0), { renk: renk('bce'), r: 4.2 });

    const t2 = fc.carpan.tuval;
    t2.boyutla(); t2.bas();
    t2.setDom(0, 1, -4, 0.2);
    t2.eksen(tema, {
      xEtiket: 'p', yEtiket: 'log₁₀ (1−p)^γ', xTik: 5, yTik: 5, sifirX: false,
      yFmt: (v) => (v === 0 ? '1' : `10${['⁻⁴', '⁻³', '⁻²', '⁻¹'][v + 4] ?? nf(v, 0)}`),
    });
    for (const gg of aile) {
      t2.egri((q) => Math.max(-4.2, Math.log10(Math.pow(1 - q, gg))), { renk: tema.muted, kalinlik: 1.2, alfa: 0.42, ilerleme });
    }
    t2.egri((q) => Math.max(-4.2, Math.log10(Math.pow(1 - q, g))), { renk: renk('focal'), kalinlik: 3, ilerleme });
    for (const pv of [0.6, 0.9, 0.99]) {
      const yv = Math.max(-4.2, Math.log10(Math.pow(1 - pv, g)));
      t2.nokta(pv, yv, { renk: renk('focal'), r: 4 });
      t2.etiket(pv, yv, `p=${nf(pv, 2)}`, { renk: renk('focal'), dx: -8, dy: 13, hiza: 'right', punto: 10.5, arka: tema.surface });
    }

    let html = '<tr><th>p</th><th>ℓCE</th><th>ℓγ</th><th>oran</th></tr>';
    for (const pv of [0.99, 0.9, 0.6, 0.3, 0.1, 0.01]) {
      const oran = Math.pow(1 - pv, g);
      html += `<tr><td>${nf(pv, 2)}</td><td>${nf(focal(pv, 0), 3)}</td><td>${nf(focal(pv, g), 3)}</td>`
        + `<td>${oran < 0.001 ? oran.toExponential(1).replace('.', ',') : nf(oran, 3)}</td></tr>`;
    }
    html += `<tr data-ref="true"><td>${nf(p, 3)}</td><td>${nf(focal(p, 0), 3)}</td><td>${nf(focal(p, g), 3)}</td><td>${nf(Math.pow(1 - p, g), 4)}</td></tr>`;
    fc.tablo.innerHTML = html;
    const kolay = Math.pow(1 - 0.9, g);
    const zor = Math.pow(1 - 0.1, g);
    /* Gerçek eğitilmiş model üzerinde ölçüm: model SABİT tutulur, yalnız γ
       değişir — böylece sayı sadece γ'nın etkisini gösterir. */
    sinifHesapla();
    const payCE = kolayOrnekPayi(sinifSonuc.bce, 0);
    const payG = kolayOrnekPayi(sinifSonuc.bce, g);
    fc.not.innerHTML = `γ = ${nf(g, 1)}: kolay örnek (p = 0,9) <b>${kolay > 0 ? nf(1 / kolay, 0) : '∞'} kat</b> kısılır, `
      + `zor örnek (p = 0,1) yalnız <b>${nf(1 / zor, 2)} kat</b> — fark <b>${nf(zor / kolay, 0)} kat</b>. `
      + `Gerçek bir eğitilmiş model üzerinde ölçüldüğünde: p<sub>t</sub> &gt; 0,9 olan kolay örnekler toplam gradyanın `
      + `çapraz entropide <b>%${nf(payCE * 100, 1)}</b>’ini, γ = ${nf(g, 1)} focal’da <b>%${nf(payG * 100, 1)}</b>’ini üretir. `
      + 'Focal örnekleri silmez, ağırlıklarını yeniden dağıtır; γ = 0’da tam olarak çapraz entropidir.';
  }

  /* — sınıflandırma — */
  function cizSinif(ilerleme) {
    sinifHesapla();
    const t = sn.sacilim.tuval;
    t.boyutla(); t.bas();
    /* Eşit en-boy: özellik uzayında açılar ve kümelerin biçimi anlamlıdır,
       eksenleri bağımsız ölçeklemek karar sınırının eğimini yalan söyletir. */
    const alanSn = t.alan();
    const yYari = 3.0;
    const xYari = yYari * (alanSn.w / Math.max(1, alanSn.h));
    t.setDom(-xYari, xYari, -yYari, yYari);
    t.eksen(tema, { xEtiket: 'x₁', yEtiket: 'x₂', xTik: Math.round(xYari * 1.6), yTik: 5 });

    /* Nokta boyu = focal’ın o örneğe verdiği ağırlık (1−p_t)^γ, BCE’nin
       yakınsadığı ORTAK model üzerinde ölçülür (ağırlıkları kıyaslanabilir
       kılmak için tek bir referans model kullanılır). */
    const referans = sinifSonuc.bce;
    for (const d of SINIF.nokta) {
      const z = referans.w1 * d.x1 + referans.w2 * d.x2 + referans.b;
      const pt = kis(pDogru(z, d.y), 1e-7, 1 - 1e-12);
      const agirlik = Math.pow(1 - pt, durum.gama);
      const r = 1.9 + 5.4 * Math.sqrt(kis(agirlik, 0, 1));
      t.nokta(d.x1, d.x2, {
        renk: d.y === 1 ? tema.accent : tema.data[0],
        r: d.y === 1 ? r + 1.4 : r,
        dolgu: d.y === 1,
        kalinlik: 1.6,
        alfa: d.y === 1 ? 0.95 : 0.7,
      });
    }
    const sinirEtiket = [];
    for (const id of SINIF_IDS) {
      const s = sinifSonuc[id];
      if (!s || Math.abs(s.w2) < 1e-9) continue;
      const f = (x1) => -(s.w1 * x1 + s.b) / s.w2;
      const alfa = (!durum.vurgu || durum.vurgu === id ? 1 : 0.34) * ilerleme;
      t.yol([[-xYari, f(-xYari)], [xYari, f(xYari)]], { renk: renk(id), kalinlik: 2.6, alfa });
      sinirEtiket.push({ y: f(xYari * 0.93), metin: KAYIP_HARITA[id].kisa, renk: renk(id), alfa });
    }
    t.sagEtiketler(sinirEtiket, { xVeri: xYari * 0.95, arka: tema.surface });
    /* gösterge: dolu = azınlık, içi boş = çoğunluk */
    t.nokta(-xYari * 0.93, yYari * 0.90, { renk: tema.accent, r: 5 });
    t.etiket(-xYari * 0.93, yYari * 0.90, `azınlık (${SINIF.nPoz})`, { renk: tema.muted, dx: 11, punto: 11 });
    t.nokta(-xYari * 0.93, yYari * 0.78, { renk: tema.data[0], r: 5, dolgu: false, kalinlik: 1.7 });
    t.etiket(-xYari * 0.93, yYari * 0.78, `çoğunluk (${SINIF.nNeg})`, { renk: tema.muted, dx: 11, punto: 11 });

    let html = '<tr><th>kayıp</th><th>TP</th><th>FP</th><th>duy.</th><th>F1</th><th>kolay%</th></tr>';
    for (const id of SINIF_IDS) {
      const s = sinifSonuc[id];
      html += `<tr style="--sat-renk:${renk(id)}"><td><i></i>${KAYIP_HARITA[id].kisa}</td>`
        + `<td>${s.tp}</td><td>${s.fp}</td><td>${nf(s.duyarlilik, 2)}</td><td>${nf(s.f1, 2)}</td>`
        + `<td>${nf(s.kolayPay * 100, 1)}</td></tr>`;
    }
    sn.tablo.innerHTML = html;
    const yonBce = sinifSonuc.bce.w1 / sinifSonuc.bce.w2;
    const yonFocal = sinifSonuc.focal.w1 / sinifSonuc.focal.w2;
    sn.not.innerHTML = `Veri: <b>${SINIF.nNeg}</b> çoğunluk, <b>${SINIF.nPoz}</b> azınlık (%${nf((SINIF.nPoz / SINIF.nokta.length) * 100, 1)}). `
      + `Aynı model, η = ${nf(sinifSonuc.eta, 2)}, 800 adım. Nokta boyu = (1−p_t)^γ ağırlığı. `
      + `<b>γ = ${nf(durum.gama, 1)}</b>: BCE ile focal’ın sınır YÖNÜ neredeyse aynı (w₁/w₂ = ${nf(yonBce, 2)} ve ${nf(yonFocal, 2)}) — `
      + `γ örnekleri yeniden ağırlıklandırır, sınıfları dengelemez. Sınırı asıl kaydıran <b>α = ${nf(SINIF.alfa, 3)}</b>: `
      + `α-Focal bütün azınlığı yakalar ama yanlış alarmı ${sinifSonuc.afocal.fp}’e çıkarır. "kolay%" sütunu, o kaybın `
      + 'kendi optimumunda p_t > 0,9 olan örneklerin toplam gradyandaki payıdır.';
  }

  /* ---- adım / anlatı ---- */
  function kontrolGuncelle() {
    const adim = ADIMLAR[durum.adim];
    for (const g of kontrolBar.querySelectorAll('[data-grup]')) {
      g.hidden = !adim.kontrol.includes(g.dataset.grup);
    }
    elAdimNo.textContent = `adım ${durum.adim + 1}/${ADIMLAR.length}`;
    elAdimNo2.textContent = `${durum.adim + 1}/${ADIMLAR.length}`;
    elBaslik.textContent = adim.baslik;
    elIddia.textContent = adim.iddia;
    outDelta.textContent = nf(durum.delta, 2);
    outGama.textContent = nf(durum.gama, 1);
    outEta.textContent = nf(durum.eta, 2);
    outAykiri.textContent = nf(durum.aykiriY, 1);
    outP.textContent = nf(durum.p, 3);
    elTruth.textContent = TRUTH[adim.panel];
  }

  const TRUTH = {
    galeri: 'Formüller ve türevler kapalı formda kodlanmıştır; eğriler çalışma anında bu fonksiyonlardan örneklenir. Kayıplar örnek başınadır (toplu biçim ortalamadır).',
    egri: 'Eğriler ve gradyan değerleri kapalı formüllerden anlık hesaplanır. MSE ½r² ölçeğiyle çizilir (Huber’in içteki koluyla aynı eksene otursun diye) — sabit çarpan gradyanı ölçekler, biçimini değiştirmez.',
    lab: 'Gerçek tam yığın gradyan inişi: w = b = 0’dan, kapalı biçim türevlerle, 200 adım, stokastik gürültü yok — tüm sayılar bu koşudan gelir. Oyuncak veri (12 nokta, 1 boyutlu); gerçek bir veri kümesi değildir. Sabit η ile MAE optimumun çevresinde salınır: kuyruktaki titreme gerçektir, çizim gürültüsü değildir.',
    ce: 'Değerler doğal logaritmadan (nat) hesaplanır; bit sütunu log₂ dönüşümüdür. Kalibrasyon eğrisi q = 0,70 için beklenen kaybın kapalı formudur.',
    focal: 'Focal kayıp Lin ve ark. (2017) biçimindedir. Bastırma oranları (1−p)^γ’dan doğrudan; gradyan payları gerçekten eğitilmiş bir lojistik model üzerinde, model sabit tutulup yalnız γ değiştirilerek hesaplanır.',
    sinif: 'Gerçek lojistik regresyon eğitimi (2 özellik, tam yığın, 800 adım, w = b = 0’dan). Veri sabit tohumlu (20240813) sentetik Gauss kümeleridir — ölçülmüş bir veri kümesi değildir. Doğrusal modelde γ’nın sınırı kaydırmaması bu kurulumun bulgusudur; derin bir dedektörde γ’nın katkısı buradan okunamaz.',
  };

  function git(hedef) {
    const yeni = kis(hedef, 0, ADIMLAR.length - 1);
    if (yeni === durum.adim) { kirlet(); return; }
    durum.adim = yeni;
    durum.ilerleme = donuk ? 1 : 0;
    girisT0 = performance.now();
    kontrolGuncelle();
    kirlet();
  }

  /* ---- animasyon ---- */
  let sonZaman = 0;
  let rafId = 0;
  let girisT0 = (typeof performance === 'object' ? performance.now() : 0);
  let aktif = secenek.aktif !== false;

  /* Giriş taraması BİRİKEN dt'den değil GEÇEN SÜREDEN sürülür: kare
     aralığı kırpıldığı için (dt ≤ 50 ms) seyrek kare gelen bağlamlarda
     (gizli sekme, başsız sanal zaman) tarama yarıda kalıyordu. */
  const GIRIS_SURE = 720;
  function adimla(dt) {
    if (durum.ilerleme < 1) {
      durum.ilerleme = kis((performance.now() - girisT0) / GIRIS_SURE, 0, 1);
    }
    if (durum.oynuyor) {
      durum.kosuAdim = Math.min(durum.kosuMax, durum.kosuAdim + dt * 70);
      inKosu.value = String(Math.round(durum.kosuAdim));
      if (durum.kosuAdim >= durum.kosuMax) { durum.oynuyor = false; btnKos.textContent = '▶ Eğitimi koştur'; }
    }
    kirli = true;
  }

  function kare(zaman) {
    rafId = requestAnimationFrame(kare);
    if (!aktif) return;
    /* Duraklama/geri gelme sıçramasını yutmak için kırpma korunur; giriş
       taraması buna bağlı DEĞİLDİR (yukarıya bak). */
    const dt = sonZaman ? Math.min(0.05, (zaman - sonZaman) / 1000) : 0;
    sonZaman = zaman;
    if (durum.ilerleme < 1 || durum.oynuyor) adimla(dt);
    if (kirli) { kirli = false; ciz(); }
  }

  const ro = new ResizeObserver(() => kirlet());
  ro.observe(kok);

  /* ---- açılış ---- */
  kontrolGuncelle();
  if (donuk) {
    durum.ilerleme = 1;
    durum.kosuAdim = durum.kosuMax;
  }
  girisT0 = (typeof performance === 'object' ? performance.now() : 0);
  ciz();
  if (!donuk) rafId = requestAnimationFrame(kare);

  /** Deste'ye verilen anlatı denetleyicisi (global keydown eklemez). */
  function anlati() {
    return {
      ileri: () => git(durum.adim + 1),
      geri: () => git(durum.adim - 1),
      git: (i) => git(i - 1),
      get adim() { return durum.adim + 1; },
      get uzunluk() { return ADIMLAR.length; },
      get basliklar() { return ADIMLAR.map((a) => a.baslik); },
      sifirla: () => git(0),
    };
  }

  return {
    el: kok,
    durum,
    anlati,
    git: (i) => git(i - 1),
    ileri: () => git(durum.adim + 1),
    geri: () => git(durum.adim - 1),
    setDelta(v) { durum.delta = kis(v, 0.1, 3); inDelta.value = String(durum.delta); egitimBayat = true; kontrolGuncelle(); kirlet(); },
    setGama(v) { durum.gama = kis(v, 0, 5); inGama.value = String(durum.gama); sinifBayat = true; kontrolGuncelle(); kirlet(); },
    setEta(v) { durum.eta = kis(v, 0.02, 0.4); inEta.value = String(durum.eta); egitimBayat = true; sinifBayat = true; kontrolGuncelle(); kirlet(); },
    setAykiri(v) { durum.aykiriY = kis(v, REGRESYON.aykiriAralik[0], REGRESYON.aykiriAralik[1]); inAykiri.value = String(durum.aykiriY); egitimBayat = true; kontrolGuncelle(); kirlet(); },
    setP(v) { durum.p = kis(v, 0.002, 0.998); inP.value = String(durum.p); kontrolGuncelle(); kirlet(); },
    setKosu(v) { durum.kosuAdim = kis(v, 0, durum.kosuMax); inKosu.value = String(durum.kosuAdim); durum.oynuyor = false; kirlet(); },
    setVurgu(id) { durum.vurgu = id && KAYIP_HARITA[id] ? id : null; kirlet(); },
    setGorunur(id, v) { if (id in durum.gorunur) { durum.gorunur[id] = Boolean(v); const b = cipKap.querySelector(`[data-kayip="${id}"]`); if (b) b.setAttribute('aria-pressed', String(v)); kirlet(); } },
    /** Deterministik ilerletme (başsız doğrulama / dışarıdan sürüş). */
    advance(dt) { adimla(dt); ciz(); },
    /** Bütün girişleri anında son karesine oturt. */
    finish() { durum.ilerleme = 1; durum.oynuyor = false; durum.kosuAdim = durum.kosuMax; inKosu.value = String(durum.kosuMax); ciz(); },
    renderNow() { ciz(); },
    setActive(v) { aktif = Boolean(v); if (aktif) sonZaman = 0; },
    dispose() { cancelAnimationFrame(rafId); ro.disconnect(); kok.remove(); },
  };
}

export default mountLossFunctions;
