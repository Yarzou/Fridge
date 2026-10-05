import { NextRequest, NextResponse, after } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { isEmailConfigured, sendConfirmationEmail } from '@/lib/email'
import { safeInternalPath } from '@/lib/utils'

// L'envoi SMTP se termine après la réponse (after) : laisser à Vercel le temps
// de l'achever, y compris avec une seconde tentative.
export const maxDuration = 30

/**
 * Inscription (repris de neighborshare) — remplace `supabase.auth.signUp()`.
 *
 * Le mailer intégré de Supabase ne livre qu'aux membres de l'équipe du projet.
 * On crée donc le compte par l'API admin (`generateLink`, service role) et
 * l'app envoie elle-même l'email de confirmation par le SMTP Gmail. Le lien
 * mène à /auth/confirm, qui valide le token et redirige vers `redirect`
 * (par exemple /invitation/{id} : on rejoint le foyer juste après).
 *
 * Pour un compte existant non confirmé, `generateLink` régénère un token :
 * refaire l'inscription débloque quelqu'un dont le lien a expiré.
 *
 * Sans GMAIL_* (ou sans service role), repli sur `signUp()` classique.
 */

type RegisterBody = {
  email?: unknown
  password?: unknown
  display_name?: unknown
  redirect?: unknown
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function str(v: unknown, max = 200): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length > 0 && t.length <= max ? t : null
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as RegisterBody | null
  if (!body) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }

  const email = str(body.email)?.toLowerCase() ?? null
  const password = typeof body.password === 'string' ? body.password : ''
  const displayName = str(body.display_name, 40)
  const next = safeInternalPath(typeof body.redirect === 'string' ? body.redirect : null)

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Adresse email invalide.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Le mot de passe doit faire au moins 8 caractères.' }, { status: 400 })
  }
  if (!displayName) {
    return NextResponse.json({ error: 'Indiquez votre prénom.' }, { status: 400 })
  }

  // Lu par le trigger handle_new_user (migration 001) pour créer le profil.
  const metadata = { display_name: displayName }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin).replace(/\/$/, '')

  if (!isEmailConfigured() || !serviceRole) {
    const anon = createSupabaseClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { error } = await anon.auth.signUp({
      email,
      password,
      options: { data: metadata, emailRedirectTo: `${appUrl}${next}` },
    })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status ?? 400 })
    }
    return NextResponse.json({ ok: true, via: 'supabase' })
  }

  const admin = createSupabaseClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'signup',
    email,
    password,
    options: { data: metadata },
  })

  if (error) {
    const alreadyExists = error.code === 'email_exists' || /already been registered/i.test(error.message)
    if (alreadyExists) {
      return NextResponse.json(
        { error: 'Un compte existe déjà avec cet email. Connectez-vous ou utilisez une autre adresse.' },
        { status: 409 }
      )
    }
    if (error.code === 'weak_password') {
      return NextResponse.json({ error: 'Mot de passe trop faible.' }, { status: 400 })
    }
    console.error('[Register] generateLink failed:', error.code, error.message)
    return NextResponse.json({ error: "L'inscription a échoué. Réessayez dans un instant." }, { status: 500 })
  }

  const tokenHash = data.properties?.hashed_token
  if (!tokenHash) {
    console.error('[Register] generateLink returned no hashed_token')
    return NextResponse.json({ error: "L'inscription a échoué. Réessayez dans un instant." }, { status: 500 })
  }

  const confirmUrl =
    `${appUrl}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=signup` +
    `&next=${encodeURIComponent(next)}`

  // Réponse immédiate, envoi en arrière-plan (~2 s, jusqu'à 20 s sur un
  // décrochage réseau). En cas d'échec, refaire l'inscription renvoie un lien.
  after(async () => {
    const sent = await sendConfirmationEmail(email, displayName, confirmUrl)
    if (!sent) console.error('[Register] confirmation email not sent to', email)
  })

  return NextResponse.json({ ok: true, via: 'gmail' })
}
