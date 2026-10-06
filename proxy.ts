import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware Next 16 (ex-`middleware.ts`) : rafraîchit les cookies de session
 * Supabase et renvoie vers la connexion toute page de l'appli sans session.
 *
 * Différence assumée avec neighborshare, où `protectedPaths` est vide : ici
 * tout le contenu appartient à un foyer, il n'y a rien de public à montrer.
 * Le vrai verrou reste le RLS ; cette redirection n'évite qu'un écran vide.
 */

// Pages accessibles sans session. `/invitation/` : la page présente le foyer
// avant de proposer de créer un compte ou de se connecter.
const PUBLIC_PREFIXES = ['/auth/', '/api/', '/invitation/']

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getSession() lit le JWT dans les cookies sans appel réseau : plus fiable que
  // getUser() dans le middleware, où une coupure réseau provoquerait une fausse déconnexion.
  const { data: { session } } = await supabase.auth.getSession()

  const { pathname, search } = request.nextUrl
  const isPublic = PUBLIC_PREFIXES.some(p => pathname.startsWith(p))

  if (!session && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.search = ''
    if (pathname !== '/') url.searchParams.set('redirect', pathname + search)
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value)
    })
    return redirectResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // zxing/ : moteur du scanner (.wasm), fichier public sans session à vérifier
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icon|apple-icon|zxing/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|wasm)$).*)',
  ],
}
