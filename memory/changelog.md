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

## 2026-10-06 — Rappels sur le téléphone, feuille plein écran

Rappels réglables par chaque personne, sur le modèle des notifications de neighborshare. Le canal est le Web Push standard (VAPID) et non Firebase : pas de projet Firebase, pas de SDK côté client, et sur iPhone ça marche avec l'appli installée.

### Base
- `liquibase/changelog/003-rappels.sql` (+ master) :
  - `push_subscriptions` : un abonnement par appareil, lu et supprimé par son propriétaire, enregistré par la RPC `save_push_subscription` (SECURITY DEFINER). Sur un téléphone partagé, l'appareil change de compte ;
  - `reminder_settings` : réglages par personne et dates d'envoi, à `1970-01-01` par défaut ;
  - chaque changeset a son `--rollback` ; le contrôle `grep` ne renvoie rien. **Non appliquée.**

### Envoi
- `lib/reminders.ts` : échéances dans le fuseau de la personne, fenêtre « déjà annoncé jusqu'au », textes (« 3 produits à consommer », « Le congélateur cette semaine »), options proposées.
- `lib/push-server.ts` : envoi `web-push` (TTL 12 h) ; les abonnements expirés (404, 410) sont signalés.
- `lib/reminders-server.ts` : tournée.
  - Un rappel est réservé par un update conditionnel avant d'être envoyé : jamais deux fois, même avec des appels simultanés.
  - Les produits sont lus une fois par foyer ; les abonnements expirés sont supprimés.
- `app/api/rappels/route.ts` (`CRON_SECRET` obligatoire) et `app/api/rappels/test/route.ts` (session : les seuls appareils de la personne).
- `vercel.json` : 17 crons, un par heure de 05 à 21 h UTC (7 h → 22 h à Paris, été comme hiver), chacun une fois par jour comme l'impose le plan Hobby. Pas de workflow GitHub, à la demande de l'utilisateur.
- `package.json` : `web-push`, `@types/web-push`.

### Téléphone
- `public/sw.js` : `push` affiche la notification, `notificationclick` ramène l'appli sur la bonne page.
- `lib/push.ts` : prise en charge (avec le cas de l'iPhone sans appli installée), activation et désactivation, réabonnement si la clé serveur a changé.
- `components/foyer/ReminderSettings.tsx`, dans l'onglet Foyer :
  - « Sur ce téléphone » ;
  - « Produits à consommer » : de la veille à 14 jours avant, et l'heure ;
  - « Récapitulatif » : jour et heure ;
  - « Envoyer un rappel de test ».

  Sans la migration 003, la section reste en « Bientôt ».
- `components/push/PushPrompt.tsx` : invitation « Être prévenu à temps » sur l'onglet Congélateur, que « Plus tard » masque 30 jours. `components/push/PushSync.tsx` rattache l'abonnement au compte à chaque ouverture.
- `components/ui/Switch.tsx` (interrupteur iOS), token `knob`.
- `.env.local.example` : `CRON_SECRET`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

### Correctif
- `components/layout/Sheet.tsx` : la feuille « Nouveau produit / Modifier » prend tout l'écran. La bande grise qui imitait la carte iOS du dessous, vue comme un « double fond », est retirée, tout comme le token `sheet-band` et l'utilitaire `.top-sheet`.

### Vérifications
- `npm run lint` : aucune remarque. `npm run typecheck` : OK. `npm run build` : OK.
- **Migration 003, compatibilité n-1**, avec le Liquibase du projet sur un PostgreSQL jetable :
  - base n-1 = `HEAD` (001 + 002) : le code n-1 marche, et le code n se replie (section « Bientôt », invitation masquée, tournée sautée) ;
  - `update` : 5 changesets appliqués, 26 reconnus sans écart de checksum ;
  - règles d'accès : chacun ne voit et ne supprime que ses appareils, aucune insertion directe, `anon` refusé, endpoint non HTTPS et réglages hors bornes refusés ; un téléphone partagé change de compte ; un rappel n'est réservé qu'une fois par jour ;
  - `rollback` vers le tag puis nouvelle `update` : propres.
- De bout en bout dans Chrome, contre un faux Supabase local :
  - activation depuis l'onglet Foyer : abonnement auprès de `fcm.googleapis.com`, enregistré, réglages sauvegardés avec le fuseau du téléphone ;
  - `/api/rappels` envoie 1 rappel, accepté par Google (201) ; la tournée suivante n'envoie rien ;
  - sans le secret, la route répond 401 ; le bouton de test envoie.
- **Non vérifié** : l'affichage d'une notification. Le Chrome de ce poste ne joint pas le service push de Google (port 5228, « WAITING FOR BACKOFF »), et le test local qui contournait ce blocage a été interrompu. À faire sur un téléphone, une fois déployé.

## 2026-10-06 — Barre d'onglets en verre et bulle, pas de flou sous la barre d'état

- `components/layout/TabBar.tsx` : barre façon « Liquid Glass » d'Apple.
  - Le verre est beaucoup plus transparent : 42 % au lieu de 88 %, flou de 40 px, saturation, reflet sur l'arête haute.
  - L'onglet choisi est une bulle de verre. Au toucher, elle part aussitôt, sans attendre la page, et s'étire comme une goutte d'eau avant de se poser.
  - En glissant le doigt sur la barre, la bulle suit en grossissant. Au lâcher, elle se pose sur l'onglet le plus proche, qui s'ouvre.
  - Avec « Réduire les animations », plus d'effet.
- `components/layout/StatusBarShield.tsx` : bande opaque sous l'heure et la batterie, pour qu'iOS n'y floute plus le contenu qui défile. Montée dans le layout des onglets, dans `AuthShell` et sur `/etiquettes`.
- `app/globals.css`, `tailwind.config.ts` : tokens `tabbar`, `tabbar-edge`, `tabbar-highlight`, `bubble`, `bubble-edge`, ombres `glass` et `bubble`, animation `bubble`.
- Vérifié dans Chrome au format iPhone, en clair et en sombre : bulle au repos, pendant un glissé, navigation vers Foyer au lâcher, transparence au-dessus du contenu. Captures supprimées.
- `npm run lint` : aucune remarque. `npm run typecheck` : OK. `npm run build` : OK.
- **Non vérifié sur iPhone** : le téléphone affichait encore une version antérieure au correctif de la feuille, alors que le dernier commit était bien déployé.

## 2026-10-06 — Haut d'écran sous iOS 26, bulle sur mesure, barre plus basse

- `lib/ios-top.ts` et `app/layout.tsx` : dans l'appli installée sur iPhone, le haut des écrans descend sous le fondu flou qu'iOS 26 ajoute sous la barre d'état.
  - Le fondu fait environ 32 px et ne peut pas être désactivé côté web.
  - Sur le téléphone de l'utilisateur, iOS déclarait une zone réservée nulle alors que la page passait sous l'heure. « Cuisine » et « + » y étaient cachés, le titre flouté.
  - Le script calcule `--safe-top` : zone déclarée, ou hauteur de barre estimée d'après la taille d'écran, + 32 px.
  - `.pt-safe` et `StatusBarShield` lisent `--safe-top`. Safari, Android et l'ordinateur ne changent pas.
- `lib/utils.ts` : `cn()` déclare l'échelle typographique à tailwind-merge. Elle était prise pour des couleurs, et la taille disparaissait dès qu'une couleur suivait : libellés de la barre à 16 px au lieu de 11, titres de lignes « accent » à 16 px au lieu de 17.
- `components/layout/TabBar.tsx` :
  - la bulle entoure l'icône et le libellé de l'onglet choisi, à sa taille (plus large pour « Congélateur » que pour « Foyer »), et change de largeur en glissant ;
  - la pastille des courses se pose sur le coin de l'icône.
- `app/globals.css` : la barre d'onglets descend, à 20 px du bas sur un iPhone à barre d'accueil (44 px avant). La marge du bas des pages, le toast et l'encart des courses suivent.
- `components/ui/Switch.tsx` : en position « on », la pastille sortait de la piste. Elle est maintenant ancrée à gauche et glisse de 20 px.
- Mesuré dans Chrome au format iPhone (393 × 852) :
  - bulle de 89, 67 et 56 px autour de contenus de 61, 39 et 28 px ;
  - interrupteurs « on » et « off » dans leur piste, avec 2 px de marge ;
  - appli installée simulée (`navigator.standalone`) : `--safe-top` = 86 px, en-tête à 94 px ; navigateur ordinaire inchangé (8 px).
- Captures supprimées.
- `npm run lint` : aucune remarque. `npm run typecheck` : OK. `npm run build` : OK.

## 2026-10-06 — Sécurité des dépendances

- `package.json` :
  - next 16.2.4 → **16.3.8** (épinglé) : corrige l'alerte critique (déni de service sur les Server Components) et les failles de `postcss` et `sharp` qu'il embarque ;
  - eslint-config-next → 16.3.8 ;
  - nodemailer 8 → **10.0.15** : corrige le contournement de `disableFileAccess` et `disableUrlAccess` par l'option `raw`. Les changements cassants (Node 20 minimum, vérification TLS des contenus distants) ne touchent pas Fridge.
- `npm audit --omit=dev` : **0 vulnérabilité** (4 avant). Restent 9 alertes d'outils de dev (Tailwind 3, plugin ESLint de Next), sans effet chez l'utilisateur ; leur vrai correctif est Tailwind 4.
- `lib/utils.ts` : `reloadTo()` pour les rechargements complets voulus. La nouvelle règle `@next/next/no-location-assign-relative-destination` signalait `window.location.href = '/…'`. Utilisé par la déconnexion (Foyer, bienvenue), la création du foyer, l'acceptation d'une invitation et le nouveau mot de passe.
- `.github/dependabot.yml` : une PR de mises à jour par semaine, mineures regroupées.
- Vérifications :
  - `npm run lint` : aucune remarque ; `npm run typecheck` : OK ; `npm run build` : OK sous Next 16.3.8 ;
  - parcours rejoués sur un faux Supabase local : sortie et « Annuler », fin de stock vers les courses, saisie libre, « Ranger », scanner (code-barres et QR), barre d'onglets, interrupteurs, haut d'écran iOS ; en-têtes de sécurité inchangés ;
  - nodemailer 10 : transport Gmail et construction d'un message vérifiés hors réseau ; **envoi réel non essayé**.

## 2026-10-06 — Premières PR de Dependabot

Cinq PR ouvertes le jour même. Chacune a été examinée sur sa branche (`git fetch`) et dans le journal des changements du paquet.
- **À fusionner** :
  - `@supabase/ssr` 0.10.3 → 0.12.7 (groupe « mineures ») : surtout des correctifs de cookies. Le nouvel encodage `cookies.encode` est optionnel, et le format par défaut ne change pas. On ne passe pas d'`auth.storage`, donc le nouvel avertissement ne s'affiche pas ;
  - `dotenv` 17 → 18 : ne sert qu'à `scripts/db-migrate.js`. Le `config({ path })` utilisé marche à l'identique (essayé sur un fichier factice), et le message « injected env » passe sur stderr. La v18 retire le préchargement et `.env.vault`, dont Fridge ne se sert pas.
- **À fermer** :
  - `tailwindcss` 3 → 4 : le build échoue, c'est une migration de configuration à faire à part ;
  - `tailwind-merge` 2 → 3 : la v3 ne gère plus Tailwind 3, selon ses propres notes de version. Elle suivra la migration ;
  - `@types/node` 20 → 26 : les types doivent suivre le Node qui fait tourner l'appli, et non la dernière version parue.
- `.github/dependabot.yml` : ces trois versions majeures sont écartées par des règles `ignore`. Les correctifs et les mineures de ces paquets restent proposés.

## 2026-10-06 — La bulle sur le contrôle segmenté et les interrupteurs

Le même geste que la bulle de la barre d'onglets, à la façon d'iOS 26, là où Apple l'emploie.
- `components/ui/Segmented.tsx` : la pastille du segment choisi est un élément à part, qui se déplace. Cela vaut pour « Catégories / Tiroirs / Dates », « Apparence » et le tiroir de la fiche produit :
  - au toucher d'un autre segment, elle y glisse en s'étirant comme une goutte (`animate-bubble`) ;
  - doigt posé sur le segment choisi, elle se soulève en verre ;
  - au glissé, elle suit le doigt, puis se pose sur le segment le plus proche, qui est choisi ;
  - un glissé vertical fait toujours défiler la page (`touch-pan-y`), sans rien choisir ;
  - au repos, elle se place en pourcentages, sans mesure ;
  - avec « Réduire les animations », elle se déplace sans effet.
- `components/ui/Switch.tsx` : doigt posé, la pastille s'allonge (27 → 37 px) et devient une lentille de verre, un peu plus grande que la piste. Un glissé choisit le côté ; un toucher bascule, comme avant.
- `app/globals.css`, `tailwind.config.ts` : couleur `lens` (verre clair, en clair et en sombre) et ombre `shadow-lifted`. Elle ne s'appelle pas `shadow-lens` : Tailwind générerait aussi la couleur d'ombre `shadow-lens`, qui l'effacerait. `shadow-bubble` est déjà dans ce cas, et on le laisse tel quel.
- `components/layout/TabBar.tsx`, `Segmented`, `Switch` : le clic qui suit un glissé est ignoré, sauf s'il vient du clavier (`e.detail === 0`). Avant, après un glissé, l'appui suivant sur Espace ou Entrée était avalé une fois.
- Vérifié dans Chrome au format iPhone, au toucher, en clair et en sombre :
  - sur le Congélateur (faux Supabase local), un glissé choisit « Dates » et un toucher choisit « Tiroirs » ; un glissé vertical fait défiler la page sans rien changer ;
  - sur une page d'essai temporaire, supprimée ensuite : interrupteur basculé au toucher, au glissé à gauche ou à droite, et à l'Espace après un glissé ;
  - captures supprimées.
- `npm run lint` : aucune remarque. `npm run typecheck` : OK. `npm run build` : OK.

## 2026-10-06 — Contrôles segmentés en capsule

- `components/ui/Segmented.tsx` : le contrôle, sa pastille et ses segments prennent la forme d'une capsule (`rounded-full`), comme sur iOS 26. Ils avaient des coins de 9 et 7 px. Cela vaut pour « Catégories / Tiroirs / Dates », « Apparence » et le tiroir de la fiche produit. La marge intérieure des segments ne change pas (`px-1`), pour que les noms courts des tiroirs (46 px par segment) tiennent toujours.
- Vérifié dans Chrome au format iPhone, sur une page d'essai temporaire, supprimée ensuite : les trois tailles, en clair et en sombre, au repos et pendant un glissé. Captures supprimées.
- `npm run lint` : aucune remarque. `npm run typecheck` : OK. `npm run build` : OK.
