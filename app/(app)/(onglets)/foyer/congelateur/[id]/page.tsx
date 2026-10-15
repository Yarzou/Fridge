import ReglagesCongelateurClient from './ReglagesCongelateurClient'

/**
 * Réglages d'un congélateur, ouverts depuis l'onglet Foyer : nom, tiroirs,
 * étiquettes QR. ?nouveau=1 : il vient d'être créé.
 */
export default async function ReglagesCongelateurPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ nouveau?: string }>
}) {
  const { id } = await params
  const { nouveau } = await searchParams
  return <ReglagesCongelateurClient key={id} id={id} created={nouveau === '1'} />
}
