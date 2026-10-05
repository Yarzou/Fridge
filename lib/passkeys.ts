'use client'

import { useSyncExternalStore } from 'react'

// Connexion par passkey (empreinte, Face ID, Windows Hello…), gérée nativement par
// Supabase Auth : `signInWithPasskey()` / `registerPasskey()` / `passkey.*`.
// Reprise de neighborshare. À activer dans le dashboard de CHAQUE projet
// (Authentication → Passkeys), Relying Party ID = domaine servi — voir README.md.

const noopSubscribe = () => () => {}

/**
 * Le navigateur sait-il faire du WebAuthn ? `false` au rendu serveur, puis la vraie
 * valeur à l'hydratation, sans `setState` dans un effet.
 */
export function usePasskeySupport(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => typeof window.PublicKeyCredential !== 'undefined',
    () => false,
  )
}

interface PasskeyErrorLike {
  code?: string
  name?: string
  cause?: unknown
}

function errorName(value: unknown): string | undefined {
  return value && typeof value === 'object' && 'name' in value ? String(value.name) : undefined
}

/** L'utilisateur a fermé l'invite biométrique : on n'affiche rien. */
export function isPasskeyCancel(error: PasskeyErrorLike): boolean {
  if (error.code === 'ERROR_CEREMONY_ABORTED') return true
  const names = [error.name, errorName(error.cause)]
  return names.includes('NotAllowedError') || names.includes('AbortError')
}

export function isPasskeyDisabled(error: PasskeyErrorLike): boolean {
  return error.code === 'passkey_disabled'
}

/** Message affiché pour un échec de passkey (hors annulation). */
export function passkeyErrorMessage(error: PasskeyErrorLike): string {
  switch (error.code) {
    case 'passkey_disabled':
      return "La connexion par empreinte n'est pas encore disponible."
    case 'too_many_passkeys':
      return "Nombre maximal d'appareils atteint : retirez-en un d'abord."
    case 'webauthn_credential_exists':
    case 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED':
      return 'Cet appareil est déjà enregistré.'
    case 'webauthn_credential_not_found':
      return "Cette clé n'est plus reconnue. Connectez-vous avec votre mot de passe, puis réactivez l'empreinte dans Foyer."
    case 'webauthn_challenge_not_found':
    case 'webauthn_challenge_expired':
      return 'Délai dépassé, réessayez.'
    case 'webauthn_verification_failed':
      return 'La vérification a échoué, réessayez.'
    case 'email_not_confirmed':
      return "Votre email n'est pas encore confirmé. Cliquez sur le lien reçu à l'inscription."
    case 'user_banned':
      return 'Ce compte est suspendu.'
    case 'ERROR_INVALID_DOMAIN':
    case 'ERROR_INVALID_RP_ID':
      return "La connexion par empreinte n'est pas disponible sur cette adresse du site."
    default:
      return "L'opération par empreinte ou Face ID a échoué, réessayez."
  }
}
