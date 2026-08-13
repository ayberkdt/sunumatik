/* Cosmos dekor kompozitörü — gerçek Cosmos presetini (WebGL) herhangi bir
   2B tuvale DİKDÖRTGEN fon olarak basar. Sol-decor deseninin fon hâli:
   disk değil zemin olduğundan blit dairesel değil dikdörtgendir ve
   tüyleme kenarlardan içeri doğru çalışır.

   Kullanım (2B canvas destesi, her karede):
     import { mountCosmosDecor } from '.../cosmos_advanced/cosmos-decor.mjs';
     const decor = await mountCosmosDecor();          // bir kez
     ...
     decor.draw(ctx, x, y, w, h, alpha, dt);          // her karede
     ...
     decor.dispose();                                 // gerekirse

   draw() false dönerse çağıran taraf kendi 2B yedeğine düşer (düz koyu
   degrade + birkaç nokta yeterlidir).

   İçeride ne yapar (sol-decor ile aynı sözleşme):
   - ekran dışı, mount'tan ÖNCE stille boyutlandırılmış host (gizli
     sekmede ResizeObserver teslim edilmez — ölçü baştan sabitlenir);
   - preset UI'ı gizlenir; active:false → preset kendi rAF'ını kurmaz,
     her kare draw() içindeki advance(dt) sürer;
   - "screen" karışımı presetin koyu zeminini yutar, yalnız ışık kalır —
     desteğin kendi zemin rengi fonun altından görünmeye devam eder;
   - kenar tüylemesi İSTEĞE BAĞLI (featherPx, 0 = kapalı): iki geçişli
     destination-in (önce yatay, sonra dikey lineer gradyan) — alfa
     çarpımı dört kenarı da yumuşatır;
   - dekor temposu sakindir (activity .7: seyrek göktaşı, kısık parıldama);
     drift kapalı gelir — 2B destenin kendi kamera dili bozulmasın. */

import { mountCosmos } from './cosmos-sky.mjs';

let hostCounter = 0;

export async function mountCosmosDecor(options = {}) {
  const width = options.width ?? 720;
  const height = options.height ?? 405;
  const activity = options.activity ?? .7;
  const featherPx = options.featherPx ?? 26;   /* 0 → tüyleme yok */

  /* host: mount'tan ÖNCE ölçüsü stille sabitlenmiş, ekran dışı */
  const id = 'cosmosDecorHost' + (hostCounter++);
  const sizer = document.createElement('style');
  sizer.textContent = '#' + id + ' .lunaris-preset__canvas{width:' + width + 'px;height:' + height + 'px;display:block}'
    + '#' + id + ' figure{margin:0;width:' + width + 'px}';
  document.head.appendChild(sizer);
  const host = document.createElement('div');
  host.id = id;
  host.style.cssText = 'position:fixed;left:-9999px;top:0;width:' + width + 'px;height:' + height
    + 'px;overflow:hidden;pointer-events:none';
  document.body.appendChild(host);

  const cosmos = await mountCosmos(host, {
    active: false,               /* kendi rAF'ı yok; draw() advance ile sürer */
    activity,
    drift: options.drift ?? 0,
    seed: options.seed,
    density: options.density,
    milkyWayIntensity: options.milkyWayIntensity,
    nebulae: options.nebulae,
    galaxyTexture: options.galaxyTexture,   /* fotoğrafik Samanyolu (ESO) —
                                               kredi zorunluluğu desteye geçer */
  });

  /* UI gizle — yalnız tuval kalsın */
  const canvasHost = cosmos.figure.querySelector('.lunaris-preset__canvas');
  [...cosmos.figure.children].forEach(el => {
    if (el !== canvasHost && el.tagName !== 'STYLE') el.style.display = 'none';
  });
  cosmos.advance(0.001);         /* ilk kareyi bas — draw() anında hazır olsun */

  const sourceCanvas = cosmos.figure.querySelector('.lunaris-preset__canvas canvas');
  let featherCv = null;

  const draw = (ctx, x, y, w, h, alpha = 1, dt = 1 / 60) => {
    if (!sourceCanvas || !sourceCanvas.width) return false;
    try { cosmos.advance(dt); } catch (e) { return false; }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'screen';
    if (featherPx > 0) {
      /* kaynak çözünürlüğünde tüyleme maskesi; hedef ölçüye oranlanır */
      const sw = sourceCanvas.width, sh = sourceCanvas.height;
      if (!featherCv || featherCv.width !== sw || featherCv.height !== sh) {
        featherCv = document.createElement('canvas');
        featherCv.width = sw;
        featherCv.height = sh;
      }
      const fc = featherCv.getContext('2d');
      const fx = featherPx * (sw / w);       /* hedef px → kaynak px */
      const fy = featherPx * (sh / h);
      fc.clearRect(0, 0, sw, sh);
      fc.drawImage(sourceCanvas, 0, 0, sw, sh);
      /* iki geçişli destination-in: alfalar çarpılır, dört kenar tüylenir */
      fc.globalCompositeOperation = 'destination-in';
      const gx = fc.createLinearGradient(0, 0, sw, 0);
      gx.addColorStop(0, 'rgba(0,0,0,0)');
      gx.addColorStop(Math.min(.5, fx / sw), 'rgba(0,0,0,1)');
      gx.addColorStop(Math.max(.5, 1 - fx / sw), 'rgba(0,0,0,1)');
      gx.addColorStop(1, 'rgba(0,0,0,0)');
      fc.fillStyle = gx;
      fc.fillRect(0, 0, sw, sh);
      const gy = fc.createLinearGradient(0, 0, 0, sh);
      gy.addColorStop(0, 'rgba(0,0,0,0)');
      gy.addColorStop(Math.min(.5, fy / sh), 'rgba(0,0,0,1)');
      gy.addColorStop(Math.max(.5, 1 - fy / sh), 'rgba(0,0,0,1)');
      fc.fillStyle = gy;
      fc.fillRect(0, 0, sw, sh);
      fc.globalCompositeOperation = 'source-over';
      ctx.drawImage(featherCv, x, y, w, h);
    } else {
      ctx.drawImage(sourceCanvas, x, y, w, h);
    }
    ctx.restore();
    return true;
  };

  return {
    draw,
    cosmos,                      /* gerekirse tam preset API'si (triggerMeteor vb.) */
    dispose: () => { cosmos.dispose(); host.remove(); sizer.remove(); },
  };
}
