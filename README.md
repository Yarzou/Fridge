# Fridge

Le congélateur et la liste de courses du foyer, en appli web installable (PWA), pour iPhone et Android.

- **Congélateur** : ce qu'il y a dedans, tiroir par tiroir, avec ce qu'il faut consommer en premier.
- **QR code par tiroir** : collé sur la porte, il ouvre le tiroir et on sort un produit en un geste.
- **Courses** : une liste partagée, rangée par rayon dans l'ordre du magasin, reliée au congélateur.
- **Foyer** : plusieurs comptes, qui rejoignent le foyer par un lien d'invitation.

Stack : Next.js 16 (App Router) · React 19 · Supabase (Auth, PostgreSQL, Realtime) · Tailwind CSS 3 · Liquibase · Vercel.

## Démarrer

```bash
npm install
cp .env.local.example .env.local      # puis renseigner les valeurs Supabase et Gmail
cp liquibase/liquibase.properties.example liquibase/liquibase.properties
npm run db:migrate                    # applique liquibase/changelog (Java requis : JAVA_HOME)
npm run dev                           # http://localhost:3000
```

## Vérifications

```bash
npm run lint
npm run typecheck
npm run build
```

Il n'y a pas de suite de tests.

## Mise en route d'un projet Supabase

1. Créer le projet, récupérer l'URL, la clé anon, la clé service role et le mot de passe de la base.
2. `npm run db:migrate`.
3. Authentication → URL Configuration : Site URL = l'URL de l'appli, et ajouter `…/auth/confirm` aux Redirect URLs.
4. Authentication → Passkeys : activer, Relying Party ID = le domaine servi (`localhost` en local).
5. Vercel : mêmes variables que `.env.local`, plus `NEXT_PUBLIC_APP_URL` = domaine de production.
