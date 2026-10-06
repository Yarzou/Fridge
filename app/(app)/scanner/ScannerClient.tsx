'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CameraOff, Check, LoaderCircle, Minus, Plus, QrCode, Snowflake, X, Zap, ZapOff } from 'lucide-react'
import { classifyCode, readCode } from '@/lib/barcode'
import { getCategory } from '@/lib/categories'
import { lookupOpenFoodFacts } from '@/lib/openfoodfacts'
import { quantityLabel } from '@/lib/units'
import { cn, plural } from '@/lib/utils'
import type { Item } from '@/lib/types'
import { useHouseholdData } from '@/components/household/HouseholdData'
import { CategoryTile } from '@/components/inventory/CategoryTile'
import { buttonClass } from '@/components/ui/Button'

type Camera = 'starting' | 'running' | 'denied' | 'unavailable'

interface Product {
  name: string
  format: string | null
  image: string | null
  category: string
  /** Déjà vu par le foyer (pas besoin d'Open Food Facts). */
  known: boolean
}

type Result =
  | { kind: 'barcode'; code: string; loading: true }
  | { kind: 'barcode'; code: string; loading: false; product: Product | null }
  | { kind: 'drawer'; id: string }
  | { kind: 'other' }

/** Lecture d'une image toutes les 200 ms, réduite à 960 px de côté. */
const SCAN_INTERVAL = 200
const MAX_SIDE = 960

/**
 * Scanner de l'appli (maquette « Scanner »). Sur iPhone, un QR scanné par
 * l'appareil photo ouvre Safari, sans la session de l'appli installée : c'est
 * ici qu'on scanne, code-barres d'un produit comme QR d'un tiroir.
 */
export default function ScannerClient() {
  const router = useRouter()
  const data = useHouseholdData()
  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const onCodeRef = useRef<(text: string) => void>(() => {})
  const lastCodeRef = useRef<string | null>(null)

  const [camera, setCamera] = useState<Camera>('starting')
  const [torch, setTorch] = useState<'none' | 'off' | 'on'>('none')
  const [result, setResult] = useState<Result | null>(null)
  const [typed, setTyped] = useState('')

  const handleCode = async (text: string) => {
    if (text === lastCodeRef.current) return
    lastCodeRef.current = text
    navigator.vibrate?.(40)
    const scanned = classifyCode(text)
    if (scanned.kind !== 'barcode') {
      setResult(scanned)
      return
    }
    const { code } = scanned
    // Déjà rangé un jour par le foyer : on connaît son nom, sa catégorie, son tiroir.
    const known = data.items
      .filter(i => i.barcode === code)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]
    if (known) {
      setResult({
        kind: 'barcode',
        code,
        loading: false,
        product: { name: known.name, format: null, image: known.image_url, category: known.category_slug, known: true },
      })
      return
    }
    setResult({ kind: 'barcode', code, loading: true })
    const off = await lookupOpenFoodFacts(code)
    if (lastCodeRef.current !== text) return
    setResult({ kind: 'barcode', code, loading: false, product: off && { ...off, known: false } })
  }

  useEffect(() => {
    onCodeRef.current = text => {
      void handleCode(text)
    }
  })

  useEffect(() => {
    let stopped = false
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })

    const scan = async () => {
      const video = videoRef.current
      if (stopped || !video || !context) return
      if (video.readyState >= 2 && video.videoWidth > 0 && document.visibilityState === 'visible') {
        const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight))
        canvas.width = Math.round(video.videoWidth * scale)
        canvas.height = Math.round(video.videoHeight * scale)
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        try {
          const text = await readCode(context.getImageData(0, 0, canvas.width, canvas.height))
          if (text && !stopped) onCodeRef.current(text)
        } catch (err) {
          console.error('[scanner] lecture', err)
        }
      }
      if (!stopped) timer = setTimeout(scan, SCAN_INTERVAL)
    }

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        })
      } catch (err) {
        if (!stopped) setCamera((err as { name?: string })?.name === 'NotAllowedError' ? 'denied' : 'unavailable')
        return
      }
      if (stopped || !videoRef.current) {
        stream.getTracks().forEach(t => t.stop())
        return
      }
      const video = videoRef.current
      video.srcObject = stream
      await video.play().catch(() => {})
      setCamera('running')
      const track = stream.getVideoTracks()[0]
      trackRef.current = track
      const capabilities = (track.getCapabilities?.() ?? {}) as { torch?: boolean }
      if (capabilities.torch) setTorch('off')
      void scan()
    }
    void start()

    return () => {
      stopped = true
      clearTimeout(timer)
      stream?.getTracks().forEach(t => t.stop())
      trackRef.current = null
    }
  }, [])

  const toggleTorch = async () => {
    const track = trackRef.current
    if (!track || torch === 'none') return
    const next = torch === 'on' ? 'off' : 'on'
    try {
      await track.applyConstraints({ advanced: [{ torch: next === 'on' } as MediaTrackConstraintSet] })
      setTorch(next)
    } catch {
      setTorch('none')
    }
  }

  const close = () => {
    if (window.history.length > 1) router.back()
    else router.replace('/congelateur')
  }

  const submitTyped = () => {
    const code = typed.replace(/\D/g, '')
    if (code.length < 6) return
    lastCodeRef.current = null
    void handleCode(code)
  }

  // ─── Ce que le code désigne ────────────────────────────────────────────────
  const stock: Item[] =
    result?.kind === 'barcode' ? data.items.filter(i => i.barcode === result.code && i.quantity > 0) : []
  const drawerName = (id: string | null) =>
    id ? data.freezers.flatMap(f => f.compartments).find(c => c.id === id)?.name.toLowerCase() : null
  const stockText = (() => {
    if (stock.length === 0) return null
    const total = stock.reduce((sum, i) => sum + i.quantity, 0)
    const places = [...new Set(stock.map(i => drawerName(i.compartment_id)).filter(Boolean))]
    return `Déjà au congélateur : ${quantityLabel(total, stock[0].unit)}${places.length ? `, ${places.join(', ')}` : ''}`
  })()

  const drawer =
    result?.kind === 'drawer'
      ? data.freezers
          .flatMap(f => f.compartments.map(c => ({ ...c, freezerName: f.name })))
          .find(c => c.id === result.id)
      : undefined
  const drawerCount = drawer ? data.items.filter(i => i.compartment_id === drawer.id && i.quantity > 0).length : 0

  const recognized =
    result?.kind === 'drawer' && drawer
      ? 'QR du tiroir reconnu'
      : result?.kind === 'barcode' && !result.loading
        ? 'Code-barres reconnu'
        : null

  const takeOne = async () => {
    const first = [...stock].sort((a, b) => (a.best_before ?? '9999').localeCompare(b.best_before ?? '9999'))[0]
    if (!first) return
    await data.takeOut(first, 1)
    router.push('/congelateur')
  }

  const addHref = (product: Product | null, code: string) => {
    const params = new URLSearchParams({ code, retour: '/congelateur' })
    if (product) {
      params.set('nom', product.name)
      params.set('categorie', product.category)
      if (product.format) params.set('format', product.format)
      if (product.image) params.set('image', product.image)
    }
    const known = data.items.find(i => i.barcode === code)
    if (known?.compartment_id) params.set('tiroir', known.compartment_id)
    return `/ajouter?${params}`
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        aria-hidden="true"
        className={cn('absolute inset-0 h-full w-full object-cover', camera !== 'running' && 'invisible')}
      />

      <div className="pt-safe absolute inset-x-0 top-0 z-10">
        <div className="mx-auto flex max-w-md items-center justify-between px-4">
          <button
            type="button"
            onClick={close}
            aria-label="Fermer le scanner"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 backdrop-blur-md"
          >
            <X size={20} strokeWidth={2.4} aria-hidden="true" />
          </button>
          <h1 className="text-body font-semibold">Scanner</h1>
          {torch !== 'none' ? (
            <button
              type="button"
              onClick={toggleTorch}
              aria-pressed={torch === 'on'}
              aria-label={torch === 'on' ? 'Éteindre la lampe' : 'Allumer la lampe'}
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md',
                torch === 'on' ? 'bg-white text-black' : 'bg-white/20',
              )}
            >
              {torch === 'on' ? <ZapOff size={20} aria-hidden="true" /> : <Zap size={20} aria-hidden="true" />}
            </button>
          ) : (
            <span className="w-11" />
          )}
        </div>
      </div>

      {camera === 'running' && (
        <div className="pointer-events-none absolute inset-x-0 top-[22%] flex flex-col items-center gap-4">
          <p className="px-6 text-center text-subhead font-semibold [text-shadow:0_1px_6px_rgba(0,0,0,0.6)]">
            Visez un code-barres ou le QR d’un tiroir
          </p>
          <div className="relative h-[210px] w-[290px]" aria-hidden="true">
            <span className="absolute left-0 top-0 h-[34px] w-[34px] rounded-tl-[18px] border-l-4 border-t-4 border-white" />
            <span className="absolute right-0 top-0 h-[34px] w-[34px] rounded-tr-[18px] border-r-4 border-t-4 border-white" />
            <span className="absolute bottom-0 left-0 h-[34px] w-[34px] rounded-bl-[18px] border-b-4 border-l-4 border-white" />
            <span className="absolute bottom-0 right-0 h-[34px] w-[34px] rounded-br-[18px] border-b-4 border-r-4 border-white" />
          </div>
          {recognized && (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/20 px-3.5 text-subhead font-semibold backdrop-blur-md">
              <Check size={16} strokeWidth={2.8} aria-hidden="true" />
              {recognized}
            </span>
          )}
        </div>
      )}

      {camera === 'starting' && (
        <div className="absolute inset-x-0 top-[30%] flex justify-center text-white/70">
          <LoaderCircle size={28} className="animate-spin" aria-label="Ouverture de la caméra" />
        </div>
      )}
      {(camera === 'denied' || camera === 'unavailable') && (
        <div className="absolute inset-x-0 top-[22%] mx-auto flex max-w-xs flex-col items-center gap-3 px-6 text-center">
          <CameraOff size={36} className="text-white/70" aria-hidden="true" />
          <p className="text-body font-semibold">
            {camera === 'denied' ? 'Accès à la caméra refusé' : 'Pas de caméra disponible'}
          </p>
          <p className="text-subhead text-white/75">
            {camera === 'denied'
              ? 'Autorisez la caméra pour Fridge dans les réglages du téléphone, ou tapez le code-barres ci-dessous.'
              : 'Tapez le code-barres ci-dessous, ou ajoutez le produit à la main.'}
          </p>
        </div>
      )}

      <div className="pb-safe absolute inset-x-0 bottom-0 z-10 mx-auto flex max-w-md flex-col gap-4 rounded-t-[28px] bg-card px-5 pt-2 text-ink">
        <div className="mx-auto h-[5px] w-9 rounded-full bg-grabber" aria-hidden="true" />

        <div role="status" aria-live="polite" className="flex flex-col gap-4">
          {result?.kind === 'barcode' && result.loading && (
            <div className="flex items-center gap-3 py-3 text-subhead text-ink-muted">
              <LoaderCircle size={20} className="animate-spin" aria-hidden="true" />
              Recherche du produit {result.code}…
            </div>
          )}

          {result?.kind === 'barcode' && !result.loading && (
            <>
              <div className="flex items-center gap-3.5">
                {result.product?.image ? (
                  <Image
                    src={result.product.image}
                    alt=""
                    width={56}
                    height={56}
                    unoptimized
                    className="h-14 w-14 shrink-0 rounded-[14px] bg-fill-soft object-contain"
                  />
                ) : (
                  <CategoryTile slug={result.product?.category ?? 'autres'} size="xl" soft />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-title font-semibold">{result.product?.name ?? 'Produit inconnu'}</span>
                  <span className="text-subhead text-ink-muted">
                    {result.product
                      ? [result.product.format, getCategory(result.product.category).label].filter(Boolean).join(' · ')
                      : `Code-barres ${result.code} : il faudra lui donner un nom.`}
                  </span>
                </div>
              </div>
              {stockText && (
                <div className="flex items-center gap-2 rounded-xl bg-accent-soft px-3 py-2.5 text-subhead text-accent">
                  <Snowflake size={18} className="shrink-0" aria-hidden="true" />
                  <span>{stockText}</span>
                </div>
              )}
              <div className={cn('grid gap-2.5', stock.length > 0 ? 'grid-cols-2' : 'grid-cols-1')}>
                {stock.length > 0 && (
                  <button type="button" onClick={takeOne} className={buttonClass('secondary')}>
                    <Minus size={18} strokeWidth={2.6} aria-hidden="true" />
                    Sortir 1
                  </button>
                )}
                <Link href={addHref(result.product, result.code)} className={buttonClass('primary')}>
                  <Plus size={18} strokeWidth={2.6} aria-hidden="true" />
                  Ajouter
                </Link>
              </div>
            </>
          )}

          {result?.kind === 'drawer' && (
            <>
              <div className="flex items-center gap-3.5">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-accent-soft text-accent">
                  <QrCode size={28} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-title font-semibold">{drawer?.name ?? 'Tiroir inconnu'}</span>
                  <span className="text-subhead text-ink-muted">
                    {drawer
                      ? `Congélateur ${drawer.freezerName} · ${drawerCount === 0 ? 'vide' : plural(drawerCount, 'produit')}`
                      : 'Ce tiroir n’appartient pas à votre foyer.'}
                  </span>
                </div>
              </div>
              {drawer && (
                <Link href={`/tiroir/${drawer.id}?qr=1`} className={buttonClass('primary')}>
                  Ouvrir le tiroir
                </Link>
              )}
            </>
          )}

          {result?.kind === 'other' && (
            <p className="py-2 text-subhead text-ink-muted">
              Ce QR code n’est pas l’étiquette d’un tiroir. Visez un code-barres ou le QR d’un tiroir.
            </p>
          )}

          {!result && (
            <form
              onSubmit={e => {
                e.preventDefault()
                submitTyped()
              }}
              className="flex items-center gap-2"
            >
              <input
                value={typed}
                onChange={e => setTyped(e.target.value)}
                inputMode="numeric"
                autoComplete="off"
                enterKeyHint="search"
                placeholder="Taper le code-barres"
                aria-label="Code-barres"
                className="h-11 min-w-0 flex-1 rounded-xl bg-fill-soft px-3 text-body text-ink outline-none"
              />
              <button
                type="submit"
                disabled={typed.replace(/\D/g, '').length < 6}
                className="h-11 rounded-xl bg-accent-soft px-4 text-subhead font-semibold text-accent disabled:opacity-50"
              >
                Chercher
              </button>
            </form>
          )}
        </div>

        <Link href="/ajouter?retour=/congelateur" className="flex h-11 items-center self-center px-2 text-subhead text-accent">
          Saisir sans scanner
        </Link>
      </div>
    </div>
  )
}
