import TiroirClient from './TiroirClient'

/**
 * Cible du QR code collé sur un tiroir : /tiroir/{id}?qr=1.
 * L'id du tiroir n'est pas un secret : sans appartenance au foyer, le RLS ne
 * renvoie rien et la page affiche « Tiroir introuvable ».
 */
export default async function TiroirPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ qr?: string }>
}) {
  const { id } = await params
  const { qr } = await searchParams
  // key : passer d'un tiroir à l'autre repart d'un état neuf
  return <TiroirClient key={id} id={id} fromQr={qr === '1'} />
}
