/**
 * Bande opaque, de la couleur du fond, sous la barre d'état du téléphone
 * (heure, réseau, batterie). Sans elle, le contenu qui défile passe sous la
 * barre d'état et iOS le floute. Hauteur nulle quand le téléphone n'a pas de
 * zone réservée en haut.
 */
export default function StatusBarShield() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[env(safe-area-inset-top)] bg-canvas"
    />
  )
}
