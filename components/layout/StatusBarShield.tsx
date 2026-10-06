/**
 * Bande opaque, de la couleur du fond, sous la barre d'état du téléphone
 * (heure, réseau, batterie) et, dans l'appli installée sur iPhone, sous le
 * fondu flou qu'iOS 26 y ajoute (--safe-top, lib/ios-top.ts). Le contenu qui
 * défile disparaît derrière elle au lieu d'être flouté. Hauteur nulle quand le
 * téléphone n'a pas de zone réservée en haut.
 */
export default function StatusBarShield() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[var(--safe-top,env(safe-area-inset-top))] bg-canvas"
    />
  )
}
