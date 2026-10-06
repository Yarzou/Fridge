import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { pushConfigured } from '@/lib/push-server'
import { runReminderRound } from '@/lib/reminders-server'

/**
 * Tournée des rappels sur le téléphone (lib/reminders-server.ts).
 *
 * Appelée par les crons Vercel (vercel.json) : un par heure, de 05 à 21 h UTC.
 * Le plan Hobby n'autorise qu'un passage par jour et par cron, mais 100 crons
 * par projet : d'où une entrée par heure (`?h=…` les distingue, la route
 * l'ignore). Cela couvre 7 h → 22 h à Paris, été comme hiver, à ±59 min près.
 * Chaque personne reçoit ses rappels à l'heure qu'elle a choisie, jamais deux fois.
 *
 * Contrairement à /api/keepalive, CRON_SECRET est obligatoire : la route
 * envoie des notifications à tout le monde.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey || !pushConfigured()) {
    return NextResponse.json({ ok: true, skipped: 'configuration incomplète (Supabase ou VAPID)' })
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    const stats = await runReminderRound(admin, new Date())
    return NextResponse.json({ ok: true, ...stats })
  } catch (err) {
    console.error('[rappels] tournée interrompue :', err)
    return NextResponse.json({ ok: false, error: 'Tournée interrompue' }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
