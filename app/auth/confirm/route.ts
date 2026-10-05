import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { safeInternalPath } from '@/lib/utils'

/**
 * Cible du lien de confirmation d'inscription envoyé par /api/auth/register
 * (repris de neighborshare). `verifyOtp` côté serveur confirme l'email et pose
 * les cookies : l'utilisateur arrive connecté sur `next`.
 *
 * ⛔ Le renouvellement de mot de passe ne passe JAMAIS par ici (voir
 * /api/auth/forgot-password) : d'où l'absence de `recovery` dans la liste.
 */

const ALLOWED_TYPES: EmailOtpType[] = ['signup', 'email', 'invite', 'magiclink', 'email_change']

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeInternalPath(searchParams.get('next'))

  const supabase = await createClient()

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (!error) {
      return NextResponse.redirect(new URL(next, origin))
    }
    console.error('[Confirm] verifyOtp failed:', error.code, error.message)
  }

  // Lien déjà consommé (second clic, pré-visite d'un antispam) alors qu'une
  // session existe : l'email est déjà confirmé, on continue.
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    return NextResponse.redirect(new URL(next, origin))
  }

  return NextResponse.redirect(new URL('/auth/login?erreur=confirmation', origin))
}
