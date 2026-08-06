/* Sol dekor kompozitörü — gerçek Sol presetini (WebGL) herhangi bir 2B
   tuvale küçük bir "uzak Güneş" olarak basar. Amaç: hiçbir deste bir daha
   sıfırdan güneş çizmesin; elimizdeki sağlam Sol tek satırla gömülsün.

   Kullanım (2B canvas destesi, her karede):
     import { mountSolDecor } from '.../sun_advanced/sol-decor.mjs';
     const decor = await mountSolDecor();            // bir kez
     ...
     decor.draw(ctx, x, y, r, alpha);                // her karede; r = disk yarıçapı px
     ...
     decor.dispose();                                // gerekirse

   draw() false dönerse çağıran taraf kendi 2B yedeğine düşer.

   İçeride ne yapar (eski desteler bunu elle yazıyordu):
   - ekran dışı, mount'tan ÖNCE boyutlandırılmış host (gizli sekmede
     ResizeObserver teslim edilmez — ölçü stil ile baştan verilmek zorunda);
   - preset UI'ı gizlenir, preset yıldızları kapatılır (dekor zemininin
     kendi yıldızları vardır);
   - kamera `cameraDistance` ile geri çekilir: korona ışın demetleri ve
     püskürmeler kadraja tam sığar (disk oranı = 1.2071/mesafe formülüyle
     otomatik türetilir — ampirik tekerlek hack'i yok);
   - tuval köşeleri GENİŞ ve geç başlayan dairesel maskeyle tüylenir
     (dar maske koronanın sektör asimetrisini yutup "hazır radial blur"
     görünümü veriyordu — maske yalnızca köşe artıklarını temizler);
   - "screen" karışımı presetin koyu zeminini yutar, yalnız ışık kalır;
   - dekor temposu sakindir (activity .85): aynı anda tek filament kemeri,
     seyrek kısa parlamalar — dört eş zamanlı patlama dekorda ucuz durur. */

import { mountSol } from './sol-sun.mjs';

let hostCounter = 0;

export async function mountSolDecor(options = {}) {
  const size = options.size ?? 460;
  const cameraDistance = options.cameraDistance ?? 6.2;
  const activity = options.activity ?? .85;
  const featherStart = options.featherStart ?? .8;   /* maske başlangıcı (yarıçap oranı) */
  const discFrac = 1.2071 / cameraDistance;          /* fov 45°: disk yarıçapı / tuval boyu */

  /* host: mount'tan ÖNCE ölçüsü stille sabitlenmiş, ekran dışı */
  const id = 'solDecorHost' + (hostCounter++);
  const sizer = document.createElement('style');
  sizer.textContent = '#' + id + ' .lunaris-preset__canvas{width:' + size + 'px;height:' + size + 'px;display:block}'
    + '#' + id + ' figure{margin:0;width:' + size + 'px}';
  document.head.appendChild(sizer);
  const host = document.createElement('div');
  host.id = id;
  host.style.cssText = 'position:fixed;left:-9999px;top:0;width:' + size + 'px;height:' + size
    + 'px;overflow:hidden;pointer-events:none';
  document.body.appendChild(host);

  const sol = await mountSol(host, {
    active: false,               /* kendi rAF'ı yok; draw() advance ile sürer */
    activity,
    cameraDistance,
    seed: options.seed,
  });

  /* UI gizle + preset yıldızlarını kapat */
  const canvasHost = sol.figure.querySelector('.lunaris-preset__canvas');
  [...sol.figure.children].forEach(el => {
    if (el !== canvasHost && el.tagName !== 'STYLE') el.style.display = 'none';
  });
  const starToggle = sol.figure.querySelector('[data-toggle="showStars"]');
  if (starToggle) { starToggle.checked = false; starToggle.dispatchEvent(new Event('change')); }
  sol.advance(0.001);            /* ilk kareyi bas — draw() anında hazır olsun */

  const sourceCanvas = sol.figure.querySelector('.lunaris-preset__canvas canvas');
  let featherCv = null;

  const draw = (ctx, x, y, r, alpha = 1, dt = 1 / 60) => {
    if (!sourceCanvas || !sourceCanvas.width) return false;
    try { sol.advance(dt); } catch (e) { return false; }
    const S = r / discFrac;
    /* köşe tüylemesi: yalnız kenar artıklarını temizleyen GEÇ maske */
    if (!featherCv || featherCv.width !== sourceCanvas.width) {
      featherCv = document.createElement('canvas');
      featherCv.width = featherCv.height = sourceCanvas.width;
    }
    const fc = featherCv.getContext('2d');
    const Sw = featherCv.width, h2 = Sw / 2;
    fc.clearRect(0, 0, Sw, Sw);
    fc.drawImage(sourceCanvas, 0, 0, Sw, Sw);
    fc.globalCompositeOperation = 'destination-in';
    const g = fc.createRadialGradient(h2, h2, h2 * featherStart, h2, h2, h2);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    fc.fillStyle = g;
    fc.fillRect(0, 0, Sw, Sw);
    fc.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(featherCv, x - S / 2, y - S / 2, S, S);
    ctx.restore();
    return true;
  };

  return {
    draw,
    sol,                          /* gerekirse tam preset API'si (triggerFlare vb.) */
    dispose: () => { sol.dispose(); host.remove(); sizer.remove(); },
  };
}
