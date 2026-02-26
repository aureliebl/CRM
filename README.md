## Admin Costockage

Admin interne pour Costockage, construit avec Next.js, React et TypeScript.

### Fonctionnalités principales

- **Fiche client** : Historique complet, communications, boxes associées et bouton d'appel direct
- **Matrice de prix** : Gestion des prix des boxes avec tendances, édition unitaire et en masse
- **Mini CMS** : Édition des textes du site front et registre des composants
- **Bookings** : Tableau des réservations avec filtres avancés
- **Live users** : Suivi en temps réel (mock) des visiteurs sur le site front
- **Dashboard** : KPIs marketplace vs Kostok avec vue d'ensemble des centres

### Nouvelles fonctionnalités

- **Authentification** : Système de connexion avec authentification à deux facteurs (2FA/TOTP)
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
   ```

3. Appliquer les migrations SQL sur PostgreSQL :
   - `data/migrations/001_postgres_connectors.sql`
   - `data/migrations/002_postgres_tabs.sql`
   - `data/migrations/003_postgres_security.sql`
   - `data/migrations/004_postgres_accounts.sql`
   - `data/migrations/005_postgres_dashboard_graphs.sql`

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

Remarque :
- phase 1 migre le stockage des connecteurs (`data_connectors`) vers PostgreSQL
- phase 2 migre le stockage des onglets dynamiques (`app_tabs`, `app_tab_group_visibility`)
- phase 3 migre sécurité/IAM (`user_groups`, `account_group_memberships`, `security_settings`, `ip_allowlist_entries`)
- phase 4 migre les comptes opérateurs (`accounts`, `logs`)
- phase 5 migre la bibliothèque dashboard (`dashboard_graphs`)
- le flux BigQuery reste identique côté application
- le script de backfill est idempotent (UPSERT), donc relançable sans doublons

3. Se connecter :
   - L'application redirige automatiquement vers `/login`
   - **Comptes de test** :
     - `paul.sales@costockage.fr` / `demo123` (Sales)
     - `camille.support@costockage.fr` / `demo123` (Support)
   - **Code TOTP de test** : `123456` (pour tous les comptes avec 2FA activé)

### Pages disponibles

- `/login` - Page de connexion avec 2FA
- `/dashboard` - Dashboard principal avec KPIs
- `/clients` - Liste des clients
- `/clients/[id]` - Fiche client détaillée avec bouton d'appel
- `/pricing` - Matrice de prix des boxes
- `/content` - Édition des textes du site front
- `/components-registry` - Registre des composants
- `/bookings` - Tableau des bookings
- `/live-users` - Utilisateurs en ligne (mock)
- `/settings` - Paramètres (thème, compte, déconnexion)

### Test de l'intégration Aircall (mock)

Pour simuler un appel entrant depuis la console du navigateur :
```javascript
// Simuler un appel entrant pour un client existant
import { simulateIncomingCall } from '@/lib/mock/aircall';
simulateIncomingCall('+33 6 12 34 56 78'); // Numéro d'Alice Martin
```

L'appel entrant ouvrira automatiquement la fiche client correspondante.

