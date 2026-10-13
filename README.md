# REMIS.

**La preuve de remise restaurant ↔ livreur.** Au moment où le livreur récupère la commande, le restaurant prend 1 à 3 photos, note la commande et le livreur, le fait signer au doigt, puis **scelle** la remise : elle devient horodatée côté serveur, verrouillée et vérifiable par une empreinte SHA-256. En cas de réclamation (« non reçu », « article manquant », « sac ouvert »), le dossier de contestation se génère en un clic. Le livreur reçoit son propre reçu par QR code, sans compte.

> **Remise express, un seul écran :** plateforme mémorisée → n° de commande → photo du sac → un tap sur le livreur → maintenir pour sceller. **4 à 5 taps, ~2 s** en automatisé (test Playwright). Montant, articles, code et signature restent disponibles, repliés.

---

## Démarrage rapide (mode démo, sans Supabase)

```bash
npm install
npm run dev            # http://localhost:3000
```

Sans variables Supabase, l'app tourne en **mode démo** : données en mémoire, restaurant « La Cantine du Passage » avec 6 remises (dont 1 en litige, 1 résolue), 2 membres (PIN **Camille 1234**, **Yanis 2580**). Reçu livreur de démo : `/r/demo01xxxxxxxxxxxxxxxxxxxxxxxxxx`.

| Écran | URL |
| --- | --- |
| Landing de vente (hero 3D) | `/` |
| Registre | `/app` |
| Nouvelle remise (écran express) | `/app/nouvelle` |
| Fiche · Vérifier · Litige | `/app/remises/[id]`, `/app/remises/[id]/verifier` |
| Litiges | `/app/litiges` |
| Réglages (équipe, PIN, rétention, thème) | `/app/reglages` |
| Connexion comptoir (PIN) | `/comptoir` |
| Reçu livreur public | `/r/[token]` |

## Stack

Next.js 15 (App Router) · TypeScript strict · Tailwind CSS 4 + variables CSS · Supabase (Auth, Postgres, Storage privé, RLS) · Framer Motion · React Three Fiber + drei · Serwist (PWA, hors ligne) · `@react-pdf/renderer` · `qrcode` · Vitest · Playwright.

## Architecture

```
app/                 Routes (landing, /app, /r/[token], API)
  api/handovers/seal   ← scellé serveur (recalcul SHA-256, heure serveur, transaction)
  api/uploads          ← dépôt des photos AVANT scellé (chemin imposé par le serveur)
  api/handovers/[id]/{verify,events,pdf}
  api/r/[token]/{photo,pdf}   ← reçu livreur (sans compte)
  api/cron/purge       ← purge RGPD planifiée (Vercel Cron)
components/          wizard/, ticket/, registry/, handover/, landing/ (3D), ui/
lib/
  seal/canonical.ts    chaîne canonique + SHA-256 (WebCrypto, partagé serveur/navigateur)
  seal/server.ts       scellé + vérification (relit les fichiers réellement stockés)
  seal/timestamp.ts    TimestampProvider (serveur en V1, RFC 3161/eIDAS prévu)
  data/                DataStore : SupabaseStore (prod) · MemoryStore (démo/E2E) · seed partagé
  offline/             brouillon IndexedDB, file d'attente, envoi/scellé
  image/stamp.ts       redimensionnement 1600 px, JPEG 0,8, bandeau incrusté, miniature
supabase/migrations/   schéma, immutabilité, RLS, fonctions, storage, rétention
tests/unit · tests/db · e2e/
```

### Le scellé (cœur du produit)

1. Les photos sont traitées dans le navigateur : 1600 px max, JPEG 0,8, **bandeau incrusté** (heure, date, n° de commande, restaurant). L'original non tamponné et une miniature sont aussi déposés. Le ré-encodage supprime l'EXIF (dont la position GPS).
2. Elles partent en tâche de fond dès la prise de vue (`/api/uploads`). Le serveur impose le chemin `{restaurant}/{remise}/{emplacement}.jpg` et refuse tout dépôt sur une remise déjà scellée.
3. `POST /api/handovers/seal` relit chaque fichier, **recalcule son SHA-256**, fixe `sealed_at` avec l'horloge serveur (`TimestampProvider`), calcule `hash_sha256` sur la chaîne canonique (JSON trié : id, restaurant, n°, plateforme, montant, articles, livreur, véhicule, code, `sealed_at`, SHA-256 de chaque photo et de la signature), puis appelle `seal_handover()` : remise + photos + événement `seal` + reçu livreur + livreur récent **dans une seule transaction**.
4. La base refuse un `sealed_at` éloigné de plus de 120 s de son propre `now()` (pas d'antidatage).

**Vérifier** relit la remise et les fichiers réellement présents dans le stockage, recalcule l'empreinte côté serveur **et dans le navigateur** (WebCrypto), puis affiche « Preuve intacte » ou « Preuve modifiée ». « Simuler une fraude » ajoute 1 € sur une copie en mémoire et montre l'empreinte qui change.

### Immutabilité (testée en base)

- Trigger `BEFORE UPDATE` sur `handovers` : toute modification autre que `status` est rejetée. Les transitions autorisées sont `remis → litige → resolu`, et `resolu → litige` pour rouvrir.
- `handover_photos` et `handover_events` sont en ajout seul : ni UPDATE ni DELETE. `TRUNCATE` est bloqué.
- Toute suppression est refusée, sauf pendant la purge RGPD (`purge_expired_handovers()`) et seulement au-delà de la durée de conservation.
- Pas d'INSERT client : le scellé passe exclusivement par le serveur.

### RLS

`is_member(restaurant_id)` en `security definer` : un membre ne voit que son restaurant, y compris dans le bucket `proofs` (privé, URL signées). `pin_hash` n'est jamais lisible côté client (privilèges par colonne). Le reçu livreur n'est lisible publiquement que via `get_courier_receipt(token)`, avec un token aléatoire de 32 caractères.

## Installation avec Supabase

1. Créez un projet Supabase (région UE recommandée).
2. Appliquez les migrations :
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push          # applique supabase/migrations/*
   ```
3. Auth → URL Configuration : ajoutez `https://<votre-domaine>/auth/callback` (et `http://localhost:3000/auth/callback`) aux Redirect URLs. Activez le fournisseur Email (magic link).
4. Copiez `.env.example` en `.env.local` et renseignez les variables :

| Variable | Rôle |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client Supabase (vides = mode démo) |
| `SUPABASE_SERVICE_ROLE_KEY` | Serveur uniquement : scellé, PIN, reçus publics, purge |
| `NEXT_PUBLIC_SITE_URL` | URL publique (reçus, sitemap, OG) |
| `REMIS_SECRET` | Secret HMAC des cookies, 32 caractères minimum (`openssl rand -base64 32`) |
| `CRON_SECRET` | Protège `/api/cron/purge` |
| `TIMESTAMP_PROVIDER`, `TSA_URL` | `server` en V1 ; `rfc3161` à brancher plus tard |
| `DATABASE_URL` | Connexion directe Postgres, uniquement pour `npm run seed` |

5. Seed de démo (restaurant + 6 remises, photos dans Storage) :
   ```bash
   npm run seed
   ```
   Le seed calcule les empreintes avec le même code que l'application. Les remises datées du passé passent par le mode `remis.seeding`, accepté uniquement sur une connexion directe en `postgres`, jamais via l'API.

### Authentification et équipe

- **Propriétaire** : magic link par e-mail, puis création de l'espace en 30 s (nom, ville, prénom) et définition d'un PIN.
- **Téléphone de comptoir** : après une première connexion, l'appareil est rattaché au restaurant (cookie signé). L'équipe se connecte ensuite sur `/comptoir` : prénom, puis **PIN à 4 chiffres** (scrypt, verrouillage 5 min après 5 erreurs). Côté serveur, la session Supabase est ouverte via un lien magique généré et consommé immédiatement.
- **Invitation** : Réglages → « Inviter un équipier par lien » (lien + QR, valable 7 jours).

## Déploiement Vercel

1. Poussez le dépôt sur GitHub puis importez-le dans Vercel (framework : Next.js, réglages par défaut).
2. Renseignez les variables d'environnement ci-dessus (Production + Preview).
3. Le cron de purge est déclaré dans `vercel.json` : `GET /api/cron/purge`, chaque nuit à 03:17 UTC. Vercel envoie `Authorization: Bearer $CRON_SECRET`.
4. La PWA (manifest, icônes, service worker Serwist) est générée au build : « Ajouter à l'écran d'accueil » sur iPhone et Android.

## Hors ligne

Si le réseau tombe, la remise est enregistrée dans IndexedDB (avec photos et signature) et la confirmation l'indique clairement (« En attente de réseau »). Au retour du réseau (événement `online`, retour au premier plan ou toutes les 30 s), la file est synchronisée. Le `client_captured_at` d'origine est conservé, mais **le `sealed_at` du serveur fait foi**, et l'historique mentionne « saisie hors ligne ». Le brouillon en cours est aussi sauvegardé en continu : rouvrir l'app le restaure.

## RGPD et honnêteté

- Information du livreur affichée avant la signature. Seuls le prénom et l'initiale sont conservés. Aucune reconnaissance faciale, et l'écran conseille de photographier le sac, pas le visage.
- Durée de conservation réglable (90 jours par défaut, 30 à 365 dans l'UI), avec purge automatique des lignes et des fichiers.
- La géolocalisation du comptoir est désactivée par défaut et s'active dans les réglages. Elle est stockée comme métadonnée, hors chaîne scellée.
- Formulation imposée : « preuve horodatée et vérifiable ». L'app ne promet jamais une preuve « juridiquement incontestable » (vérifié par les tests).

## Tests

```bash
npm run lint && npm run typecheck
npm test                      # Vitest : canonique, scellé/vérification, fraude, PIN, formats, dossier
npm run db:local              # crée remis_test sur un Postgres 16 local (stub auth/storage + migrations)
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/remis_test npm test   # + tests base (immutabilité, RLS, reçu, purge)
npm run test:e2e              # Playwright (build + start en mode démo) — 360 px et 430 px
```

Les tests E2E couvrent : une remise express **< 30 s et ≤ 5 taps** (≈ 2 s mesurées), le scellé bloqué tant qu'il manque une information, le reçu ouvert sans compte via son lien, le brouillon restauré, « Vérifier » intacte puis « Simuler une fraude », le litige (dossier texte, PDF, résolution), le badge Litiges, la connexion par PIN, et le **hors ligne** (file d'attente puis scellé au retour du réseau).

Lighthouse mobile (build de production, mode démo) : landing **94 / 100 / 100 / 100** (performance, accessibilité, bonnes pratiques, SEO). Registre, fiche, parcours de remise, reçu et comptoir : performance 92 à 98, accessibilité et bonnes pratiques à 100. La 3D n'est chargée qu'au premier geste ou après 4 s ; une affiche SVG la remplace avant chargement et si l'utilisateur demande moins d'animations.

## Scripts utiles

| Commande | Effet |
| --- | --- |
| `npm run assets:demo` | Régénère les photos procédurales de démo (Pillow) et `lib/data/demo-assets.ts` |
| `node scripts/dev/tour.mjs <url> <dossier> light\|dark` | Captures de tous les écrans (dev) |
| `node scripts/dev/overflow.mjs <url>` | Détecte tout débordement horizontal à 360 px |

## À brancher ensuite

- **Horodatage qualifié eIDAS (RFC 3161)** : implémenter `Rfc3161Provider.attest()` dans `lib/seal/timestamp.ts`. Le jeton est déjà stocké dans `handovers.timestamp_token`.
- **Preuve sociale** : remplir `TESTIMONIALS` et `PARTNER_LOGOS` dans `lib/landing-content.ts` avec de vrais restaurants pilotes. Les emplacements actuels sont affichés comme tels, sans faux avis.
- **Facturation** (essai 14 jours puis 19 €/mois) : non incluse.
