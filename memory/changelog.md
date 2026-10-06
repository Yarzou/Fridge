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

## 2026-10-06 — Écrans des maquettes : inventaire, scanner, courses

Les sept écrans validés sont développés : Congélateur, Tiroir, Ajouter, Scanner, Courses, Foyer et mode sombre.

### Données
- `components/household/HouseholdData.tsx` : `HouseholdDataProvider` et `useHouseholdData()`.
  - Un seul chargement pour tout le foyer : congélateurs et tiroirs, produits (en stock, plus ceux finis depuis 30 jours), courses, membres, vocabulaire des rayons.
  - Realtime sur `items` et `shopping_items` ; les suppressions sont écoutées sans filtre. Tout est relu au retour au premier plan.
  - Actions optimistes avec toast « Annuler » : `takeOut`, `addItem` (cumule un doublon du même jour et du même tiroir), `updateItem`, `deleteItem`, `renameCompartment`, `addShopping`, `toggleShopping`, `updateShopping`, `removeShopping`, `storeFrozen`.
- `lib/categories.ts` : catégories (icône, couleur, durée), et `guessCategory()` d'après les étiquettes Open Food Facts ou le nom.
- `lib/aisles.ts` : rayons, dictionnaire des termes, `guessAisle()`, `aisleForFreezerItem()` et `parseShoppingInput()` (« 2 avocats » → Avocats ×2).
- `lib/dates.ts`, `lib/useToday.ts` : dates locales AAAA-MM-JJ, « congelé le… », « Dépassé de 5 j », « Dans 9 jours ».
- `lib/units.ts` : conditionnements (sachet, portion…) et « 2 sachets ».
- `lib/types.ts` : `ShoppingItem`, `AisleTerm`.
- `liquibase/changelog/002-vocabulaire-courses.sql` (+ master) : colonnes `label`, `times_added` et `last_added_at` sur `household_aisle_terms`, RPC `note_shopping_term`. Chaque changeset a son `--rollback` ; le contrôle `grep` ne renvoie rien. **Non appliquée.**

### Écrans
- Routes : les onglets passent dans `app/(app)/(onglets)/`, dont le layout porte `<main>`, `UndoToast` et `TabBar`. `app/(app)/layout.tsx` monte `HouseholdDataProvider`.
- `congelateur/CongelateurClient.tsx` :
  - choix du congélateur, bouton +, recherche ;
  - vues Catégories, Tiroirs et Dates ;
  - « À consommer bientôt » en cartes défilantes ;
  - ligne à glisser : « Sortir 1 », « Tout sortir ».
- `tiroir/[id]/TiroirClient.tsx` :
  - − en un tap, ligne surlignée et toast « Annuler » ;
  - un produit fini propose « Ajouter aux courses » ou « Non merci » ;
  - « Modifier » renomme le tiroir ;
  - « Ajouter dans ce tiroir ».
- `courses/CoursesClient.tsx` :
  - liste par rayon, saisie libre, « Souvent achetés » ;
  - coche, « Fini au congélateur » ;
  - feuille de correction (nom, quantité, rayon retenu pour la suite) ;
  - menu « Retirer les articles cochés » / « Tout remettre à acheter » ;
  - encart « N surgelés dans le panier → Ranger ».
- `foyer/FoyerClient.tsx` : avatars colorés, congélateurs avec tiroirs et produits, « Imprimer les QR des tiroirs », section « Rappels » (« Bientôt »), apparence en contrôle segmenté.
- `app/(app)/ajouter`, `app/(app)/produit/[id]` et `components/inventory/ItemSheet.tsx` : feuille « Nouveau produit » / « Modifier le produit ».
  - La date « À consommer avant » suit la catégorie tant qu'on ne la choisit pas à la main.
  - Quantité et conditionnement, tiroir, dates par le sélecteur natif du téléphone.
  - « Ajouter et scanner le suivant », suppression avec « Annuler ».
- `app/(app)/scanner` :
  - caméra arrière, lampe si le téléphone l'a, lecture zxing toutes les 200 ms ;
  - code connu du foyer, sinon Open Food Facts ;
  - « Déjà au congélateur : … », « Sortir 1 », « Ajouter » prérempli ;
  - QR de tiroir → « Ouvrir le tiroir » ;
  - saisie du code à la main si la caméra est refusée.
- `app/(app)/etiquettes` et `components/inventory/QrCodeSvg.tsx` : une étiquette QR par tiroir, à imprimer sur A4.
- Composants : `components/ui/{Segmented,SwipeRow,UndoToast}.tsx`, `components/inventory/CategoryTile.tsx` (`CategoryTile`, `DueBadge`), `components/layout/Sheet.tsx`. `TabBar` gagne le bouton Scanner et la pastille des courses.

### Configuration
- `package.json` : `zxing-wasm` et `uqr` ; `postinstall` lance `scripts/copy-zxing-wasm.js`, qui copie le moteur dans `public/zxing/` (gitignoré) pour ne pas dépendre de jsDelivr.
- `next.config.js` : CSP ouverte à Open Food Facts (`connect-src` pour l'API, `img-src` pour les photos).
- `proxy.ts` : `zxing/` et les `.wasm` sortent du matcher.
- `app/globals.css`, `tailwind.config.ts` : tokens `seg`, `chip-edge`, `grabber`, `accent-wash`, `swipe`, `toast`, `badge`, `sheet-band`, palette `tile-*`, utilitaires `.bottom-toast`, `.top-sheet`, `.no-scrollbar`, mise en page d'impression.

### Vérifications
- `npm run lint` : aucune remarque. `npm run typecheck` : OK. `npm run build` : OK (24 routes), avec des variables Supabase factices.
- Essais dans Chrome au format iPhone (390 × 844), contre un faux Supabase local aux données de la maquette :
  - tous les écrans, en clair et en sombre ;
  - glisser une ligne puis « Sortir 1 », toast « il en reste 3 », « Annuler » remet 4 ;
  - finir un produit du tiroir, puis « Ajouter aux courses » : il arrive en Poissonnerie ;
  - « 500 g de comté » va en Crèmerie, avec 500 g ;
  - « Ranger » : 2 produits rangés au congélateur ;
  - scanner avec une caméra simulée : code-barres Häagen-Dazs lu et fiche Open Food Facts affichée en 0,4 s, feuille d'ajout préremplie (catégorie Glaces), QR du tiroir reconnu.
- **Migration 002, compatibilité n-1**, vérifiée avec le Liquibase du projet sur un PostgreSQL jetable (PGlite), requêtes en rôle `authenticated` avec RLS :
  - base n-1 (master de `HEAD`, 001 seule) : le code n-1 marche, et le code n aussi grâce à ses replis (lecture `term, aisle_slug`, upsert du rayon si la RPC manque) ;
  - `update` vers n : 4 changesets appliqués, les 22 de 001 reconnus sans écart de checksum. Le code n-1 marche toujours ; une insertion « à l'ancienne » (`term`, `aisle_slug`) reçoit les valeurs par défaut ;
  - `note_shopping_term` : deux ajouts donnent `times_added = 2`, une correction change le rayon sans toucher au compteur. Un autre foyer est refusé par le RLS, et `anon` n'a pas le droit d'exécuter la fonction ;
  - `rollback` vers le tag : colonnes et fonction retirées, rayons retenus conservés, les deux versions du code marchent. Une nouvelle `update` réapplique 002 proprement.
- **Non vérifié** : la vraie base (lecture refusée depuis la session), le Realtime entre deux téléphones, et la caméra d'un vrai iPhone ou Android.
