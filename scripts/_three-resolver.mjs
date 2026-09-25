/* _three-resolver.mjs — resolves the bare `three` specifier under Node.
 *
 * The preset pages resolve `three` with an importmap, which the browser
 * honours and Node does not. Rather than add a node_modules to a repo whose
 * whole point is having no dependencies, this registers a resolve hook that
 * points the specifier at the vendored build the pages already use - so a
 * Node-side gate measures exactly the code that ships.
 *
 * Used via module.register() from a validator; see validate-hardware.mjs.
 */
let threeUrl = null;

export async function initialize(data) {
  threeUrl = data?.threeUrl ?? null;
}

export async function resolve(specifier, context, next) {
  if (specifier === 'three' && threeUrl) {
    return { url: threeUrl, format: 'module', shortCircuit: true };
  }
  return next(specifier, context);
}
