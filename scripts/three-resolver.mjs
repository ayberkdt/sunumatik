/* three-resolver.mjs — çıplak `three` belirtecini satıcı dosyasına bağlar.
 *
 * Sayfalar `three`'yi importmap ile çözer; node importmap bilmez, dolayısıyla
 * gövdeyi kuran hiçbir modül node'da yüklenemiyordu ve çizilen geometriye
 * bakan bir kapı yazılamıyordu. Bu kanca tarayıcıdaki importmap'in node
 * karşılığıdır ve TEK bir eşleme yapar: başka hiçbir belirtece dokunmaz,
 * çünkü sessizce yol değiştiren bir çözücü, denetlediğin şeyin ne olduğunu
 * belirsizleştirir.
 *
 * Kayıt:
 *     import { register } from 'node:module';
 *     register('./three-resolver.mjs', import.meta.url);
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = pathToFileURL(
  path.join(kok, 'presets/moon_advanced/vendor/three.module.min.js')).href;

export async function resolve(belirtec, baglam, sonraki) {
  if (belirtec === 'three') return { url: VENDOR, shortCircuit: true };
  return sonraki(belirtec, baglam);
}
