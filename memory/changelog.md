# Journal des changements

## 2026-10-05 — Initialisation du projet

Cadrage confirmé :
- iPhone et Android ;
- plusieurs utilisateurs par foyer ;
- nouveau compte Supabase (test + prod) ;
- Liquibase ;
- réseau toujours disponible, donc pas de mode hors ligne ;
- Gmail : mêmes variables et même compte que neighborshare.

### Configuration
- `package.json` : stack de neighborshare, sans Leaflet, Firebase, pdf.js ni Geist. Le champ `packageManager` n'est pas repris : on utilise npm.
- `tsconfig.json`, `eslint.config.mjs`, `postcss.config.js` : repris de neighborshare.
- `tailwind.config.ts` : tokens « Givre » sur variables CSS, échelle typographique iOS, police système.
- `next.config.js` : en-têtes de sécurité et CSP réduite à Supabase. La caméra est autorisée (`camera=(self)`) pour le scanner, et `sw.js` est servi en `no-cache`.
- `proxy.ts` : rafraîchit la session et redirige vers `/auth/login` sans session, sauf sur `/auth/`, `/api/` et `/invitation/`.
- `.gitignore` : repris de neighborshare. Les fichiers d'outillage local sont exclus par `.git/info/exclude`, qui n'est pas versionné.
- `.env.local.example` : modèle de configuration.
- `vercel.json` : cron keepalive.
- `.github/workflows/supabase-keepalive.yml` : `KEEPALIVE_URL` passe en variable du dépôt, sans domaine par défaut.

### Base de données
- `liquibase/changelog/001-schema-initial.sql` :
  - tables `profiles`, `households`, `household_members`, `household_invitations`, `categories`, `aisles`, `freezers`, `compartments`, `items`, `shopping_items`, `household_aisle_terms` ;
  - RLS par foyer ;
  - RPC `create_household`, `invitation_preview`, `accept_invitation`, `adjust_item_quantity` ;
  - Realtime sur `items` et `shopping_items`.

  Chaque changeset a son `--rollback`, et le contrôle `grep` des mots-clés en tête de commentaire ne renvoie rien.
- `liquibase/changelog/db.changelog-master.xml`, `liquibase/liquibase.properties.example`, `scripts/db-migrate.js` (copie de neighborshare).

### Application
- `app/layout.tsx` : métadonnées PWA, viewport `cover`, `theme-color` clair et sombre, script anti-flash, bannière d'installation, service worker.
- `app/manifest.ts`, `app/icon.tsx`, `app/apple-icon.tsx`, `lib/app-icon.tsx` : manifeste et icônes PNG générées (flocon blanc sur bleu).
- `public/sw.js` et `components/layout/ServiceWorkerRegister.tsx` : service worker minimal, enregistré en production seulement.
- Authentification, reprise de neighborshare :
  - `app/auth/{login,register,forgot-password,reset-password}` et `app/auth/confirm/route.ts` ;
  - `app/api/auth/{register,forgot-password,reset-password}`.

  L'inscription demande un prénom (`display_name`) et accepte un `redirect`, ce qui ramène à l'invitation après confirmation.
- `lib/email.ts` : SMTP Gmail, expéditeur `Fridge`, templates de confirmation et de mot de passe.
- `lib/passkeys.ts` : repris de neighborshare.
- `app/(app)/layout.tsx` : garde de session et de foyer, `HouseholdProvider`, `TabBar`.
- `app/(app)/congelateur` : les congélateurs et leurs tiroirs, avec le nombre de produits de chacun.
- `app/(app)/tiroir/[id]` : cible du QR code, contenu du tiroir en lecture seule.
- `app/(app)/courses` : état vide.
- `app/(app)/foyer` : membres, création et partage d'un lien d'invitation (admin), congélateurs, passkeys (`components/foyer/PasskeyRows.tsx`), apparence, déconnexion.
- `app/bienvenue` : création du foyer avec nom, congélateur et nombre de tiroirs.
- `app/invitation/[id]` : aperçu de l'invitation, puis « Rejoindre », « Créer un compte » ou « J'ai déjà un compte ».
- `app/api/keepalive/route.ts` : lecture d'une ligne de `categories`.
- Composants :
  - `components/ui/{PageHeader,List,Button,Notice,FieldGroup}.tsx` ;
  - `components/auth/AuthShell.tsx` ;
  - `components/theme/theme.ts` ;
  - `components/layout/{TabBar,PWAInstallBanner}.tsx`.

### Vérifications
- `npm run lint` : aucune remarque.
- `npm run typecheck` : OK.
- `npm run build` : OK (19 routes), avec des variables Supabase factices.
- Serveur de production local sur le port 3123, avec ces mêmes variables factices :
  - redirections vers la connexion (307) vérifiées ;
  - manifeste et icônes PNG servis ;
  - `Permissions-Policy` correcte ;
  - lien d'invitation invalide → « Lien expiré ».
- **Non vérifié** : tout ce qui touche une vraie base, puisque le projet Supabase n'existe pas encore et que la migration n'est pas appliquée. Pas d'essai non plus sur un téléphone.
