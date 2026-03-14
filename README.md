## Admin Costockage

Admin interne pour Costockage, construit avec Next.js, React et TypeScript.

### Fonctionnalités principales

- **Fiche client** : Historique complet, communications, boxes associées et bouton d'appel direct
- **Matrice de prix** : Gestion des prix des boxes avec tendances, édition unitaire et en masse
- **Mini CMS** : Édition des textes du site front et registre des composants
- **Bookings** : Tableau des réservations avec filtres avancés
- **Live users** : Suivi en temps réel (mock) des visiteurs sur le site front
- **Dashboard** : KPIs marketplace vs Kostok avec vue d'ensemble des centres
- **Coffre-fort** : Gestionnaire de mots de passe interne (AES-256-GCM) avec TOTP, backup codes, scan QR, export JSON/CSV
- **Tickets** : Kanban de suivi de tickets avec ingestion externe via Bearer token, variables typées (badge, date, lien, progression), description HTML

### Nouvelles fonctionnalités

- **Authentification** : Système de connexion sécurisé avec session serveur
- **Intégration Aircall** : Widget d'appels téléphoniques avec ouverture automatique de la fiche client lors d'appels entrants
- **Recherche clients** : Barre de recherche dans la topbar pour trouver rapidement un client
- **Report de bugs** : Bouton pour signaler des problèmes directement depuis l'interface
- **Light mode** : Basculement entre thème sombre et clair dans les paramètres
- **Gestion utilisateurs** : Affichage du nom de l'opérateur connecté dans la topbar

### Pour exécuter le projet

1. Installer les dépendances :
   ```bash
   npm install
   ```

2. Lancer le serveur de développement :
   ```bash
   npm run dev
   ```

### Base de données (runtime PostgreSQL)

Le runtime applicatif est maintenant PostgreSQL-only, tout en gardant BigQuery inchangé pour les connecteurs/runtimes analytiques.

1. Copier la config d'environnement :
   ```bash
   cp .env.example .env.local
   ```

2. Configurer PostgreSQL :
   ```env
   DATABASE_URL=postgres://user:password@host:5432/database
   PGSSL=false
   APP_SESSION_SECRET=change-me-with-a-long-random-secret
   ALLOW_LEGACY_ACTOR_FALLBACK=false
   PASSWORD_RESET_URL_BASE=http://localhost:3000/resetlogin
   ```

3. Appliquer les migrations SQL sur PostgreSQL :
   - `data/migrations/001_postgres_connectors.sql`
   - `data/migrations/002_postgres_tabs.sql`
   - `data/migrations/003_postgres_security.sql`
   - `data/migrations/004_postgres_accounts.sql`
   - `data/migrations/005_postgres_dashboard_graphs.sql`
   - `data/migrations/006_postgres_auth_rate_limits.sql`
   - `data/migrations/007_postgres_session_version.sql`
   - `data/migrations/008_postgres_documentation.sql`
   - `data/migrations/009_postgres_documentation_crdt.sql`
   - `data/migrations/011_postgres_vault.sql`
   - `data/migrations/012_postgres_tickets.sql`

   Pour la migration 007 uniquement, vous pouvez aussi utiliser :
   ```bash
   DATABASE_URL=postgres://user:password@host:5432/database npm run db:migrate:007
   ```

4. Backfill des données SQLite historiques vers PostgreSQL :
   ```bash
   DATABASE_URL=postgres://user:password@host:5432/database npm run db:backfill:postgres
   ```
   Optionnel (si votre fichier SQLite est ailleurs) :
   ```bash
   SQLITE_PATH=./data/accounts.db DATABASE_URL=postgres://user:password@host:5432/database npm run db:backfill:postgres
   ```

5. Vérifier les volumes migrés (comparaison des counts SQLite vs PostgreSQL) :
   ```bash
   DATABASE_URL=postgres://user:password@host:5432/database npm run db:verify:postgres
   ```
   Le script retourne un code non nul si un écart est détecté.

6. Vérifier le contenu exact sur les tables critiques :
   ```bash
   DATABASE_URL=postgres://user:password@host:5432/database npm run db:verify:content:postgres
   ```
   Ce script compare les lignes (pas seulement les counts) sur `data_connectors`, `app_tabs`,
   `app_tab_group_visibility`, `accounts` et `dashboard_graphs`.
   Par défaut il valide toutes les lignes SQLite présentes dans PostgreSQL (mode backfill-safe).
   Pour forcer une égalité stricte (aucune ligne en plus côté PostgreSQL) :
   ```bash
   VERIFY_STRICT=true DATABASE_URL=postgres://user:password@host:5432/database npm run db:verify:content:postgres
   ```

### Collaboration CRDT (Documentation)

Le mode collaboratif temps réel de la Documentation utilise un serveur WebSocket dédié (Hocuspocus + Yjs).

1. Variables d'environnement (app Next + serveur collab) :
   ```env
   DOCS_CRDT_SECRET=change-me-with-a-long-random-secret
   NEXT_PUBLIC_DOCS_CRDT_WS_URL=ws://localhost:1234
   DOCS_CRDT_PORT=1234
   ```

2. Installer les dépendances du serveur collab :
   ```bash
   npm --prefix collab-server install
   ```

3. Lancer le serveur collab en dev (dans un terminal dédié) :
   ```bash
   npm run docs:collab:dev
   ```

4. Lancer ensuite l'app Next normalement :
   ```bash
   npm run dev
   ```

### Déploiement option 1 (Vercel + Supabase + Render)

Stack recommandée pour rester proche du gratuit :
- **Vercel** : app Next.js (frontend + API routes)
- **Supabase** : PostgreSQL managé
- **Render** : serveur WebSocket CRDT (`collab-server`)

1. Créer une base PostgreSQL Supabase et récupérer la chaîne de connexion.

2. Appliquer les migrations SQL sur la base Supabase (fichiers `data/migrations/*.sql`, du `001` au `009`).

3. Déployer l'app Next.js sur Vercel (import du repo), puis configurer les variables d'environnement Vercel :
   ```env
   DATABASE_URL=postgres://...
   PGSSL=true
   APP_SESSION_SECRET=<secret-long-et-random>
   APP_ENCRYPTION_KEY=<secret-long-et-random>
   DOCS_CRDT_SECRET=<secret-long-et-random>
   PASSWORD_RESET_URL_BASE=https://<ton-domaine>/resetlogin
   NEXT_PUBLIC_DOCS_CRDT_WS_URL=wss://<render-collab-domain>
   ```
   Ajouter ensuite les variables optionnelles selon vos usages (`SMTP_*`, `AIRCALL_*`, `FLOWISE_*`, etc.).

4. Déployer le serveur collab sur Render :
   - le fichier `render.yaml` à la racine contient la config de base,
   - créer le service web Render depuis le repo,
   - renseigner les variables Render :
   ```env
   DATABASE_URL=postgres://...
   PGSSL=true
   DOCS_CRDT_SECRET=<même valeur que Vercel>
   DOCS_CRDT_PORT=10000
   DOCS_CRDT_SNAPSHOT_INTERVAL_MS=10000
   ```

5. Vérifier que `NEXT_PUBLIC_DOCS_CRDT_WS_URL` (Vercel) pointe bien vers le domaine Render en `wss://...`.

6. Faire un smoke test en production :
   - login + navigation admin,
   - création/édition de contenu,
   - édition collaborative Documentation dans deux onglets (sync temps réel),
   - envoi email reset si SMTP activé.

Remarque :
- phase 1 migre le stockage des connecteurs (`data_connectors`) vers PostgreSQL
- phase 2 migre le stockage des onglets dynamiques (`app_tabs`, `app_tab_group_visibility`)
- phase 3 migre sécurité/IAM (`user_groups`, `account_group_memberships`, `security_settings`, `ip_allowlist_entries`)
- phase 4 migre les comptes opérateurs (`accounts`, `logs`, `account_password_reset_tokens`)
- phase 5 migre la bibliothèque dashboard (`dashboard_graphs`)
- phase 6 ajoute le throttling auth (`auth_rate_limits`)
- phase 7 ajoute l'invalidation de sessions par compte (`accounts.sessionVersion`)
- le flux BigQuery reste identique côté application
- le script de backfill est idempotent (UPSERT), donc relançable sans doublons

### Auth serveur (session signée + middleware)

- L'app utilise désormais une session serveur signée en cookie HTTP-only (`costockage_session`).
- Les routes API utilisent cette session pour identifier l'acteur serveur, au lieu de faire confiance aux query params client.
- Un middleware protège les pages admin et les routes API (hors login/public) et redirige vers `/login` si non authentifié.
- Le fallback `userId` via query/header est désactivé par défaut et ne doit être activé que temporairement (`ALLOW_LEGACY_ACTOR_FALLBACK=true`) pendant une transition.
- Le login utilise `email + mot de passe` côté serveur (`/api/auth/password-login`) avec session signée.
- Une création de compte admin est disponible dans la page Sécurité (email, nom, rôle, mot de passe).
- La page Sécurité permet aussi l'envoi d'un email de reset de mot de passe (lien vers `/resetlogin`).
- Si SMTP n'est pas configuré, le lien de reset est loggé côté serveur (mode dev fallback).
- Les endpoints de login/reset sont protégés par un rate limiting serveur (retours `429` + header `Retry-After`).
- Les resets de mot de passe invalident toutes les sessions existantes du compte visé.
- Un endpoint de logout global est disponible (`POST /api/auth/logout-all`).
- Les mises à jour critiques (accounts/connectors/tabs/dashboard graphs) supportent un contrôle de concurrence optimiste (si `expectedUpdatedAt` est fourni) avec retour `409 Conflict` en cas d'écrasement.
- Les admins peuvent consulter les logs d'activité via `GET /api/security/logs` (et dans l'écran Sécurité, rafraîchi automatiquement).
- Le mode démo peut être conservé temporairement via `DEMO_AUTH=true`, puis coupé progressivement.

### Mode super admin (split perso / équipe)

- L'app supporte un mode "super admin" pour séparer une version personnelle (lab) du reste de l'équipe.
- Variables d'environnement disponibles :
   - `SUPER_ADMIN_EMAILS=email1@domaine.tld,email2@domaine.tld`
   - `SUPER_ADMIN_EMAIL=email@domaine.tld` (alias simple)
   - `SUPER_ADMIN_IDS=id_compte_1,id_compte_2`
- Si aucune variable `SUPER_ADMIN_*` n'est définie, tous les comptes `admin` restent super admin (mode compatibilité).
- Les super admins seuls peuvent accéder à `/security`, créer/éditer/supprimer des onglets dynamiques, et marquer un onglet en `super admin only`.
- Un onglet dynamique `super admin only` reste visible pour le super admin et devient invisible (et non accessible par URL/API) pour les autres admins/opérateurs.

Variables SMTP optionnelles :
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

Exemple Brevo (SMTP relay) :
```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<BREVO_SMTP_LOGIN>
SMTP_PASS=<BREVO_SMTP_KEY>
SMTP_FROM=no-reply@votre-domaine.tld
APP_NAME=Costockage
```

Note : ne jamais commiter `SMTP_PASS` (garder la clé uniquement dans `.env.local` / secrets de déploiement).

Le changement de mot de passe authentifié est disponible dans `/settings` et via `POST /api/auth/change-password`.

### Coffre-fort (Vault)

Gestionnaire de mots de passe interne chiffré côté serveur (AES-256-GCM).

**Variable d'environnement requise :**
```env
VAULT_MASTER_KEY=<clé hex 64 chars = 32 bytes>
```

Pour générer une clé :
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Si `VAULT_MASTER_KEY` n'est pas définie, une clé dérivée de `APP_ENCRYPTION_KEY` est utilisée en dev.

**Fonctionnalités :**
- Chiffrement AES-256-GCM de chaque champ sensible (login, mot de passe, notes, secrets TOTP)
- Contrôle d'accès par groupes (un opérateur ne voit que les entrées de son groupe)
- Super admin voit et exporte tout (JSON ou CSV)
- Codes TOTP temps réel avec cercle de progression (génération côté client, pas de dépendance serveur)
- Ajout TOTP via saisie manuelle ou scan QR code
- 10 backup codes par TOTP (affichés une seule fois)
- Génération de mots de passe aléatoires
- Log d'audit pour chaque consultation d'identifiants

### Tickets (Kanban)

Kanban de suivi de tickets avec ingestion externe via API Bearer token.

**Fonctionnalités :**
- 5 colonnes par défaut : Nouveau, En cours, En attente, Résolu, Fermé
- Drag-and-drop natif (HTML5, pas de librairie externe)
- Variables typées par ticket : `badge`, `date`, `text`, `link`, `progress`
- Description HTML (nettoyée côté serveur)
- Polling toutes les 5 secondes pour rafraîchissement quasi temps réel
- Gestion des tokens d'API (super admin) pour ingestion externe
- Endpoint d'ingestion : `POST /api/tickets/ingest` avec `Authorization: Bearer <TOKEN>`

**Exemple d'ingestion externe (curl) :**
```bash
curl -X POST https://<domaine>/api/tickets/ingest \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Bug critique","description":"<p>Détails ici</p>","variables":[{"key":"Priorité","value":"haute","type":"badge","color":"red"}]}'
```

### Après bascule: que faire de `data/accounts.db` ?

- Le runtime applicatif n'utilise plus SQLite : `data/accounts.db` n'est plus lu par l'app en production.
- Le fichier peut être conservé temporairement comme sauvegarde/rollback local.
- Une fois la bascule validée (smoke tests + vérifications), vous pouvez l'archiver ou le supprimer.
- Recommandation: garder une copie datée hors repo, puis supprimer le fichier local de travail.

Exemple d'archivage local :
```bash
mkdir -p data/archive
cp data/accounts.db data/archive/accounts-$(date +%Y%m%d-%H%M%S).db
```

3. Se connecter :
   - L'application redirige automatiquement vers `/login`
   - **Comptes de test** :
     - `paul.sales@costockage.fr` / `demo123` (Sales)
     - `camille.support@costockage.fr` / `demo123` (Support)
   - En cas d'oubli du mot de passe, utilisez "Mot de passe oublié ?" sur `/login`.

### Pages disponibles

- `/login` - Page de connexion + demande de reset de mot de passe
- `/dashboard` - Dashboard principal avec KPIs
- `/clients` - Liste des clients
- `/clients/[id]` - Fiche client détaillée avec bouton d'appel
- `/pricing` - Matrice de prix des boxes
- `/content` - Édition des textes du site front
- `/components-registry` - Registre des composants
- `/bookings` - Tableau des bookings
- `/live-users` - Utilisateurs en ligne (mock)
- `/settings` - Paramètres (thème, compte, déconnexion)
- `/vault` - Coffre-fort (gestionnaire de mots de passe chiffré)
- `/tickets` - Kanban de tickets avec ingestion externe
- `/resetlogin` - Réinitialisation de mot de passe via token email

### Test de l'intégration Aircall (mock)

Pour simuler un appel entrant depuis la console du navigateur :
```javascript
// Simuler un appel entrant pour un client existant
import { simulateIncomingCall } from '@/lib/mock/aircall';
simulateIncomingCall('+33 6 12 34 56 78'); // Numéro d'Alice Martin
```

L'appel entrant ouvrira automatiquement la fiche client correspondante.

