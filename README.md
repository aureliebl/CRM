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

