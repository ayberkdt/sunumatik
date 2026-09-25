/* hab-detail.mjs — thin shim over the shared kit.
 *
 * The hardware vocabulary moved to core/hardware-kit.mjs
 * (docs/exploded-system-plan.md §2.1). This file stays so existing imports
 * keep working, and so the habitat can still name its own palette.
 */
export * from '../core/hardware-kit.mjs';
import { hardwareMaterials } from '../core/hardware-kit.mjs';

/** The habitat's palette over the shared family. */
export const detailMaterials = (THREE, tokens = {}) => hardwareMaterials(THREE, tokens);
