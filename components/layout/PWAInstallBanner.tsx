'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Download, Share, X } from 'lucide-react'
import { APP_NAME } from '@/lib/app'
import { cn } from '@/lib/utils'
import { GLASS } from '@/components/ui/glass'

/**
 * Invite à installer l'appli sur l'écran d'accueil (reprise de neighborshare).
 * Sur iPhone c'est indispensable : les notifications web n'y fonctionnent que
 * pour une appli installée, et un lien ouvert depuis l'appareil photo part dans
 * Safari, pas dans l'appli.
 */

const DISMISSED_KEY = 'pwa_install_dismissed_until'
const DISMISS_DAYS = 7

type Platform = 'ios' | 'android' | 'none'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const noopSubscribe = () => () => {}

function detectPlatform(): Platform {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (standalone) return 'none'
  try {
    const until = localStorage.getItem(DISMISSED_KEY)
    if (until && Date.now() < Number(until)) return 'none'
  } catch {}
  const ua = navigator.userAgent
  if (/iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua)) return 'ios'
  if (/android/i.test(ua) && /chrome/i.test(ua) && !/edg/i.test(ua)) return 'android'
  return 'none'
}

export default function PWAInstallBanner() {
  const platform = useSyncExternalStore(noopSubscribe, detectPlatform, (): Platform => 'none')
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [iosHint, setIosHint] = useState(false)

  useEffect(() => {
    if (platform !== 'android') return
    // Chrome ne propose l'installation que s'il émet cet événement
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [platform])

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000))
    } catch {}
    setDismissed(true)
  }

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setDismissed(true)
    else dismiss()
    setDeferredPrompt(null)
  }

  const visible = !dismissed && (platform === 'ios' || (platform === 'android' && deferredPrompt !== null))
  if (!visible) return null

  return (
    <div className="pb-safe pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4">
      <div className={cn('pointer-events-auto w-full max-w-sm rounded-[28px] p-4', GLASS)}>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-subhead font-semibold">Installer {APP_NAME}</p>
            <p className="text-footnote text-ink-muted">Sur l&apos;écran d&apos;accueil, comme une vraie appli.</p>
          </div>
          <button
            onClick={dismiss}
            aria-label="Fermer"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-muted"
          >
            <X size={18} />
          </button>
        </div>

        {platform === 'android' && (
          <button
            onClick={handleInstall}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-accent-fill text-body font-semibold text-white"
          >
            <Download size={18} /> Installer
          </button>
        )}

        {platform === 'ios' && (
          iosHint ? (
            <ol className="mt-3 flex flex-col gap-1 rounded-[14px] bg-accent-soft p-3 text-subhead text-ink">
              <li>
                1. Touchez <Share size={14} className="inline align-[-2px] text-accent" /> <strong>Partager</strong> dans Safari
              </li>
              <li>2. Puis <strong>« Sur l&apos;écran d&apos;accueil »</strong></li>
            </ol>
          ) : (
            <button
              onClick={() => setIosHint(true)}
              className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-accent-fill text-body font-semibold text-white"
            >
              <Share size={18} /> Voir comment faire
            </button>
          )
        )}
      </div>
    </div>
  )
}
