/* Companion helpers for interaction-motion.css.
   CSS covers plain hover; this file adds the pieces CSS cannot express:
   linked highlighting (legend ↔ series), and keyboard operability for
   members that are not natively focusable. */

const exporting = () => document.documentElement.dataset.export === 'true';

/* Make every member of a hover group reachable by keyboard.
   Non-interactive elements receive tabindex="0" so :focus-visible
   twins in the CSS actually fire. */
export function enableFocusParity(group) {
  if (!group) return;
  group.querySelectorAll('[data-hover-member]').forEach(member => {
    if (!member.matches('a,button,input,select,textarea,[tabindex]')) {
      member.setAttribute('tabindex', '0');
    }
  });
}

/* Linked highlight: hovering or focusing a trigger (e.g. a legend entry)
   dims every member of the group whose data-series does not match the
   trigger's data-series. Works across separate DOM regions, which pure
   CSS sibling selectors cannot reach.

   Markup contract:
     <ol data-hover-group id="legend">
       <li data-hover-member data-series="obs">Observed</li> ...
     </ol>
     <svg data-hover-group data-hover-link="#legend">
       <g data-hover-member data-series="obs">…</g> ...
     </svg>
*/
export function linkHoverHighlight(scope = document) {
  if (exporting()) return () => {};
  const cleanups = [];
  scope.querySelectorAll('[data-hover-link]').forEach(follower => {
    const source = scope.querySelector(follower.dataset.hoverLink) || document.querySelector(follower.dataset.hoverLink);
    if (!source) return;
    const groups = [source, follower];
    const setDim = series => {
      groups.forEach(group => {
        group.querySelectorAll('[data-hover-member]').forEach(member => {
          const dim = series !== null && member.dataset.series !== series;
          member.dataset.dimmed = dim ? 'true' : 'false';
        });
      });
    };
    const onOver = event => {
      const member = event.target.closest('[data-hover-member]');
      if (member && member.dataset.series) setDim(member.dataset.series);
    };
    const onOut = () => setDim(null);
    groups.forEach(group => {
      enableFocusParity(group);
      group.addEventListener('pointerover', onOver);
      group.addEventListener('pointerout', onOut);
      group.addEventListener('focusin', onOver);
      group.addEventListener('focusout', onOut);
      cleanups.push(() => {
        group.removeEventListener('pointerover', onOver);
        group.removeEventListener('pointerout', onOut);
        group.removeEventListener('focusin', onOver);
        group.removeEventListener('focusout', onOut);
      });
    });
  });
  return () => cleanups.forEach(fn => fn());
}

/* Convenience initializer for a whole slide or document. */
export function initInteractions(scope = document) {
  scope.querySelectorAll('[data-hover-group]').forEach(enableFocusParity);
  return linkHoverHighlight(scope);
}
