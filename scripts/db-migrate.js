#!/usr/bin/env node
/**
 * scripts/db-migrate.js
 * Pilote Liquibase pour la base de données Supabase/PostgreSQL.
 *
 * Usage :
 *   node scripts/db-migrate.js update          → applique toutes les migrations manquantes
 *   node scripts/db-migrate.js status          → liste l'état des changelogs
 *   node scripts/db-migrate.js rollback <tag>  → rollback jusqu'au tag donné
 *   node scripts/db-migrate.js tag <nom>       → pose un tag (point de rollback)
 *   node scripts/db-migrate.js validate        → valide les fichiers changelog
 *
 * Configuration — via .env.local, jamais en dur dans ce fichier :
 *   SUPABASE_DB_PASSWORD      (obligatoire) mot de passe de la base
 *   NEXT_PUBLIC_SUPABASE_URL  sert à déduire la référence du projet (utilisateur du pooler)
 *   SUPABASE_DB_URL           (optionnel) URL JDBC complète, court-circuite la déduction
 *   SUPABASE_DB_USER          (optionnel) utilisateur, court-circuite la déduction
 *   SUPABASE_POOLER_HOST      (optionnel) hôte du pooler si la région change
 */

const path = require('path')
const { Liquibase, LiquibaseConfig } = require('liquibase')

// Charge .env.local (non versionné) : Next.js le fait pour l'app, pas pour ce script
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })

const dbPassword = process.env.SUPABASE_DB_PASSWORD
if (!dbPassword) {
  console.error('\n❌  Variable SUPABASE_DB_PASSWORD manquante.')
  console.error('    Ajoutez-la dans .env.local ou exportez-la dans votre shell :\n')
  console.error('    export SUPABASE_DB_PASSWORD="votre-mot-de-passe"\n')
  process.exit(1)
}

/**
 * Déduit la référence du projet Supabase depuis NEXT_PUBLIC_SUPABASE_URL
 * (ex. https://abcdefgh.supabase.co → "abcdefgh").
 */
function getProjectRef() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return null
  const match = url.match(/^https?:\/\/([a-z0-9]+)\.supabase\./i)
  return match ? match[1] : null
}

const projectRef = getProjectRef()

// Connexion via le pooler Supabase (port 6543, mode transaction)
const poolerHost = process.env.SUPABASE_POOLER_HOST ?? 'aws-0-eu-west-1.pooler.supabase.com'
const dbUrl = process.env.SUPABASE_DB_URL ?? `jdbc:postgresql://${poolerHost}:6543/postgres`
const dbUser = process.env.SUPABASE_DB_USER ?? (projectRef ? `postgres.${projectRef}` : null)

if (!dbUser) {
  console.error('\n❌  Impossible de déterminer l\'utilisateur de la base.')
  console.error('    Renseignez NEXT_PUBLIC_SUPABASE_URL (pour déduire la référence du projet)')
  console.error('    ou SUPABASE_DB_USER directement dans .env.local.\n')
  process.exit(1)
}

/** @type {LiquibaseConfig} */
const config = {
  url: dbUrl,
  username: dbUser,
  password: dbPassword,
  changeLogFile: 'liquibase/changelog/db.changelog-master.xml',
  // Le fichier .properties fournit driver / outputDefaultSchema.
  // url, username et password ci-dessus sont passés en arguments CLI :
  // ils ont la priorité sur d'éventuelles valeurs du fichier.
  liquibasePropertiesFile: path.resolve(__dirname, '../liquibase/liquibase.properties'),
}

const instance = new Liquibase(config)

const [,, command, ...args] = process.argv

const commands = {
  update:   () => instance.update({}),
  status:   () => instance.status({}),
  validate: () => instance.validate(),
  rollback: () => {
    const tag = args[0]
    if (!tag) { console.error('Usage: rollback <tag>'); process.exit(1) }
    return instance.rollback({ rollbackTag: tag })
  },
  tag: () => {
    const tag = args[0]
    if (!tag) { console.error('Usage: tag <nom>'); process.exit(1) }
    return instance.tag({ tag })
  },
}

if (!commands[command]) {
  console.error(`\n❌  Commande inconnue : "${command}"`)
  console.error('    Commandes disponibles : update | status | validate | rollback <tag> | tag <nom>\n')
  process.exit(1)
}

console.log(`\n🚀  Liquibase → ${command}  (${dbUser}@${poolerHost})\n`)

/** node-liquibase inclut la commande complète — donc le mot de passe — dans ses erreurs. */
function redact(text) {
  return String(text).split(dbPassword).join('******')
}

commands[command]()
  .then(() => console.log(`\n✅  ${command} terminé avec succès.\n`))
  .catch(err => {
    console.error(`\n❌  Erreur lors de "${command}" :`, redact(err.message || err))
    process.exit(1)
  })
