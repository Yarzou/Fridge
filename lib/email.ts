import nodemailer from 'nodemailer'
import { ACCENT_COLOR, APP_NAME } from '@/lib/app'

/**
 * Envoi d'emails par le SMTP Gmail de l'app — mêmes variables (`GMAIL_USER`,
 * `GMAIL_APP_PASSWORD`) et même compte que neighborshare.
 *
 * Pourquoi pas le mailer de Supabase : il ne livre qu'aux membres de l'équipe
 * du projet. Sans les deux variables, tout envoi est un no-op silencieux et
 * l'inscription retombe sur `signUp()` (voir app/api/auth/register).
 */

const transporter =
  process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
        // Défauts nodemailer : 2 min. Un paquet perdu vers Gmail se traduit par
        // un décrochage TCP de ~21 s ; on coupe court et on retente une fois.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 30_000,
      })
    : null

/** True quand GMAIL_USER / GMAIL_APP_PASSWORD sont définis. */
export function isEmailConfigured(): boolean {
  return transporter !== null
}

// Erreurs de transport : une seconde tentative a du sens. Un refus SMTP
// (adresse invalide, quota) n'en a pas.
const RETRYABLE = new Set(['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'ECONNRESET', 'EPIPE'])

/**
 * Renvoie true seulement si le serveur SMTP a accepté le message.
 * Un envoi met ~2 s : les routes qui répondent à un utilisateur l'appellent
 * dans `after()` plutôt que de le faire attendre.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!transporter) return false
  const message = { from: `${APP_NAME} <${process.env.GMAIL_USER}>`, to, subject, html }
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await transporter.sendMail(message)
      return true
    } catch (err) {
      const code = (err as { code?: string })?.code
      const retry = attempt === 1 && code !== undefined && RETRYABLE.has(code)
      console.error(`[Email] Error sending (attempt ${attempt}${retry ? ', retrying' : ''}):`, err)
      if (!retry) return false
    }
  }
  return false
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Les templates email ne passent pas par Tailwind : hex en dur assumés ici.
function baseTemplate(content: string, footer: string) {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f2f2f7;margin:0;padding:24px">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden">
    <div style="padding:24px 28px 0">
      <span style="display:inline-block;padding:6px 12px;border-radius:10px;background:${ACCENT_COLOR};color:#ffffff;font-size:15px;font-weight:600">❄ ${APP_NAME}</span>
    </div>
    <div style="padding:20px 28px 28px">
      ${content}
      <hr style="border:none;border-top:1px solid #e3e3e8;margin:24px 0">
      <p style="color:#6c6c70;font-size:12px;margin:0">${footer}</p>
    </div>
  </div>
</body>
</html>`
}

function ctaButton(url: string, label: string) {
  return `<a href="${url}" style="display:inline-block;margin-top:16px;padding:14px 24px;background:${ACCENT_COLOR};color:#ffffff;border-radius:14px;text-decoration:none;font-weight:600;font-size:15px">${label}</a>`
}

function fallbackLink(url: string) {
  return `<p style="color:#6c6c70;font-size:13px;line-height:1.6;margin-top:20px">
      Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
      <a href="${url}" style="color:${ACCENT_COLOR};word-break:break-all">${url}</a>
    </p>`
}

/** Confirmation d'inscription ; `confirmUrl` pointe vers /auth/confirm. */
export async function sendConfirmationEmail(to: string, displayName: string, confirmUrl: string): Promise<boolean> {
  const name = escapeHtml(displayName.trim()) || 'bonjour'
  const html = baseTemplate(
    `
    <h2 style="margin:0 0 8px;font-size:20px;color:#1c1c1e">Bienvenue sur ${APP_NAME}</h2>
    <p style="color:#3a3a3c;line-height:1.6">Bonjour ${name},</p>
    <p style="color:#3a3a3c;line-height:1.6">
      Confirmez votre adresse email pour activer votre compte.
    </p>
    <p style="color:#3a3a3c;line-height:1.6">
      Ce lien est <strong>valable une heure</strong> et <strong>à usage unique</strong>.
      Passé ce délai, réinscrivez-vous avec les mêmes identifiants pour en recevoir un nouveau.
    </p>
    ${ctaButton(confirmUrl, 'Confirmer mon adresse email')}
    ${fallbackLink(confirmUrl)}
  `,
    "Vous n'êtes pas à l'origine de cette inscription ? Ignorez simplement cet email."
  )
  return sendEmail(to, `Confirmez votre inscription à ${APP_NAME}`, html)
}

/** Mot de passe oublié ; `resetUrl` mène au formulaire /auth/reset-password. */
export async function sendPasswordResetEmail(to: string, displayName: string | null, resetUrl: string): Promise<boolean> {
  const name = escapeHtml((displayName ?? '').trim()) || 'bonjour'
  const html = baseTemplate(
    `
    <h2 style="margin:0 0 8px;font-size:20px;color:#1c1c1e">Renouveler votre mot de passe</h2>
    <p style="color:#3a3a3c;line-height:1.6">Bonjour ${name},</p>
    <p style="color:#3a3a3c;line-height:1.6">
      Vous avez demandé à renouveler le mot de passe de votre compte ${APP_NAME}.
    </p>
    <p style="color:#3a3a3c;line-height:1.6">
      Ce lien est <strong>valable une heure</strong> et ne permet <strong>qu'un seul changement</strong>.
      Passé ce délai, refaites simplement une demande depuis la page de connexion.
    </p>
    ${ctaButton(resetUrl, 'Choisir un nouveau mot de passe')}
    ${fallbackLink(resetUrl)}
  `,
    "Vous n'avez rien demandé ? Ignorez cet email, votre mot de passe actuel reste valable."
  )
  return sendEmail(to, `Renouvellement de votre mot de passe — ${APP_NAME}`, html)
}
