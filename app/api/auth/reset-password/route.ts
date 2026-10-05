import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Refus de mot de passe que l'utilisateur peut corriger en resoumettant.
const CORRECTABLE = new Set(['same_password', 'weak_password'])

/**
 * `verifyOtp` a consommé le token avant que `updateUser` ne refuse le mot de
 * passe : sans ça, la seconde tentative tomberait sur « lien invalide ».
 * On ne remet un token qu'à quelqu'un qui vient d'en prouver la possession.
 */
async function freshRecoveryToken(email: string): Promise<string | null> {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRole) return null
  const admin = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email })
  if (error) {
    console.error('[ResetPassword] could not regenerate recovery token:', error.code, error.message)
    return null
  }
  return data.properties?.hashed_token ?? null
}

/**
 * Soumission du nouveau mot de passe (parcours « mot de passe oublié »).
 *
 * Le lien reçu par email mène au formulaire sans rien valider : c'est ici,
 * et seulement ici, que le token est consommé (`verifyOtp`), immédiatement
 * suivi du changement de mot de passe (`updateUser`). Il n'existe donc aucune
 * session « de récupération » avant que le mot de passe soit changé : un
 * second clic sur le lien réaffiche le formulaire, un antispam qui pré-visite
 * le lien ne consomme rien, et personne n'arrive connecté sans avoir rien fait.
 *
 * `verifyOtp` réussi pose les cookies de session via le client serveur : la
 * réponse 200 laisse l'utilisateur connecté avec son nouveau mot de passe.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { token_hash?: unknown; password?: unknown } | null
  const tokenHash = typeof body?.token_hash === 'string' ? body.token_hash : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!tokenHash) {
    return NextResponse.json({ error: 'Lien invalide.', code: 'invalid_link' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Le mot de passe doit faire au moins 8 caractères.' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'recovery',
  })
  if (verifyError) {
    console.error('[ResetPassword] verifyOtp failed:', verifyError.code, verifyError.message)
    return NextResponse.json(
      { error: 'Ce lien est invalide, expiré ou déjà utilisé. Refaites une demande.', code: 'invalid_link' },
      { status: 400 }
    )
  }

  const { error: updateError } = await supabase.auth.updateUser({ password })
  if (updateError) {
    // Le token est consommé mais le mot de passe inchangé. On ne laisse pas de
    // session avec l'ancien mot de passe, et si le refus est corrigeable on
    // renvoie un token neuf pour que la resoumission du formulaire aboutisse.
    console.error('[ResetPassword] updateUser failed:', updateError.code, updateError.message)
    const code = updateError.code ?? 'update_failed'
    const email = verified.user?.email
    await supabase.auth.signOut()

    const retryToken = CORRECTABLE.has(code) && email ? await freshRecoveryToken(email) : null
    const message =
      code === 'same_password'
        ? "Le nouveau mot de passe doit être différent de l'ancien."
        : code === 'weak_password'
          ? 'Mot de passe trop faible.'
          : 'La mise à jour a échoué. Refaites une demande de renouvellement.'

    return NextResponse.json(
      retryToken ? { error: message, code, token_hash: retryToken } : { error: message, code },
      { status: 400 }
    )
  }

  return NextResponse.json({ ok: true })
}
