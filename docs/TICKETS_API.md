# Tickets API — Documentation

Base URL : `https://costo-test.vercel.app` (adapter selon votre déploiement).

---

## Authentification

| Endpoint | Auth requise |
|---|---|
| `GET /api/tickets` | Session cookie (tout utilisateur connecté) |
| `POST /api/tickets` | Session cookie (tout utilisateur connecté) |
| `PATCH /api/tickets/:id` | Session cookie (tout utilisateur connecté) |
| `DELETE /api/tickets/:id` | Session cookie (tout utilisateur connecté) |
| `POST /api/tickets/move` | Session cookie (tout utilisateur connecté) |
| `POST /api/tickets/ingest` | **Bearer token** (pas de session, token API) |
| `GET/POST /api/tickets/tokens` | Session cookie (super admin uniquement) |

---

## 1. GET — Récupérer tous les tickets

### Requête

```bash
curl -X GET https://costo-test.vercel.app/api/tickets \
  -H "Cookie: session=<VOTRE_SESSION_COOKIE>"
```

### Réponse (200)

```json
{
  "board": {
    "id": "board_xxxxxx",
    "name": "Tickets",
    "columns": [
      { "key": "nouveau",    "labelFr": "Nouveau",    "labelEn": "New",         "color": "#6366f1" },
      { "key": "en_cours",   "labelFr": "En cours",   "labelEn": "In progress", "color": "#f59e0b" },
      { "key": "en_attente", "labelFr": "En attente", "labelEn": "Pending",     "color": "#8b5cf6" },
      { "key": "resolu",     "labelFr": "Résolu",     "labelEn": "Resolved",    "color": "#22c55e" },
      { "key": "ferme",      "labelFr": "Fermé",      "labelEn": "Closed",      "color": "#6b7280" }
    ]
  },
  "cards": [
    {
      "id": "card_xxxxxx",
      "boardId": "board_xxxxxx",
      "columnKey": "nouveau",
      "position": 0,
      "title": "Bug critique page d'accueil",
      "description": "<p>La page d'accueil ne charge plus depuis ce matin.</p>",
      "variables": [
        { "key": "Priorité",  "value": "Haute",              "type": "badge",    "color": "red" },
        { "key": "Échéance",  "value": "2026-03-20",         "type": "date" },
        { "key": "Lien JIRA", "value": "https://jira.example.com/TICKET-42", "type": "link" },
        { "key": "Avancement","value": "25",                 "type": "progress" },
        { "key": "Module",    "value": "Frontend",           "type": "text" }
      ],
      "assigneeId": "acc_xxxxxx",
      "followerIds": ["acc_yyyyyy"],
      "source": "manual",
      "createdBy": "acc_zzzzzz",
      "createdAt": "2026-03-14T10:00:00.000Z",
      "updatedAt": "2026-03-14T10:00:00.000Z"
    }
  ],
  "users": [
    {
      "id": "acc_xxxxxx",
      "firstName": "Jean",
      "fullName": "Jean Dupont",
      "profileImage": null,
      "isActive": true
    }
  ]
}
```

> **Tip Flowise** : utilisez la réponse `cards` pour proposer une liste de tickets existants à l'utilisateur. Le champ `columns` vous donne les colonnes disponibles pour filtrer ou déplacer.

---

## 2. POST — Créer un ticket (via session)

### Requête

```bash
curl -X POST https://costo-test.vercel.app/api/tickets \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<VOTRE_SESSION_COOKIE>" \
  -d '{
    "title": "Bug critique page d accueil",
    "description": "<p>La page ne charge plus depuis <strong>ce matin</strong>.</p>",
    "columnKey": "nouveau",
    "assigneeId": "acc_xxxxxx",
    "followerIds": ["acc_yyyyyy", "acc_zzzzzz"],
    "variables": [
      { "key": "Priorité",   "value": "Haute",    "type": "badge",    "color": "red"    },
      { "key": "Catégorie",  "value": "Frontend",  "type": "badge",    "color": "blue"   },
      { "key": "Statut",     "value": "Ouvert",    "type": "badge",    "color": "green"  },
      { "key": "Client",     "value": "Acme Corp", "type": "badge",    "color": "orange" },
      { "key": "Échéance",   "value": "2026-03-20","type": "date"                        },
      { "key": "Lien JIRA",  "value": "https://jira.example.com/TICKET-42", "type": "link" },
      { "key": "Lien Doc",   "value": "https://docs.example.com/guide",     "type": "link" },
      { "key": "Avancement", "value": "25",        "type": "progress"                    },
      { "key": "Module",     "value": "Frontend",  "type": "text"                        },
      { "key": "Version",    "value": "v2.4.1",    "type": "text"                        }
    ]
  }'
```

### Champs

| Champ | Type | Requis | Description |
|---|---|---|---|
| `title` | string | **oui** | Titre du ticket |
| `description` | string | non | Description en HTML |
| `columnKey` | string | non | Colonne cible : `nouveau`, `en_cours`, `en_attente`, `resolu`, `ferme`. Par défaut : `nouveau` |
| `assigneeId` | string | non | ID du compte assigné |
| `followerIds` | string[] | non | IDs des comptes suiveurs |
| `variables` | array | non | Variables personnalisées (voir ci-dessous) |

### Types de variables

| Type | Champs | Description |
|---|---|---|
| `badge` | key, value, color | Label coloré. Couleurs : `red`, `blue`, `green`, `orange`, `yellow`, `gray`, `purple` |
| `date` | key, value | Date au format ISO (`2026-03-20`) |
| `link` | key, value | key = texte affiché, value = URL complète (`https://...`) |
| `progress` | key, value | Barre de progression, value = pourcentage (`0`-`100`) |
| `text` | key, value | Texte simple |

### Réponse (201)

```json
{
  "id": "card_xxxxxx",
  "boardId": "board_xxxxxx",
  "columnKey": "nouveau",
  "position": 0,
  "title": "Bug critique page d accueil",
  "description": "<p>La page ne charge plus depuis <strong>ce matin</strong>.</p>",
  "variables": [ ... ],
  "assigneeId": "acc_xxxxxx",
  "followerIds": ["acc_yyyyyy", "acc_zzzzzz"],
  "source": "manual",
  "createdBy": "acc_current_user",
  "createdAt": "2026-03-14T16:00:00.000Z",
  "updatedAt": "2026-03-14T16:00:00.000Z"
}
```

---

## 3. POST — Créer un ticket via Bearer token (ingest externe / Flowise)

Cette route est **publique** (pas de session requise). Elle utilise un token API créé par un super admin.

### Requête — exemple complet avec toutes les variables

```bash
curl -X POST https://costo-test.vercel.app/api/tickets/ingest \
  -H "Authorization: Bearer <VOTRE_TOKEN_API>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Ticket créé par Flowise",
    "description": "<p>Ce ticket a été créé automatiquement par le <strong>chatbot AI</strong>.</p>",
    "column": "nouveau",
    "createdBy": "acc_xxxxxx",
    "variables": [
      { "key": "Priorité",   "value": "Critique", "type": "badge",    "color": "red"    },
      { "key": "Catégorie",  "value": "Support",  "type": "badge",    "color": "blue"   },
      { "key": "Source",     "value": "Chatbot",  "type": "badge",    "color": "purple" },
      { "key": "Client",     "value": "Acme Corp","type": "badge",    "color": "orange" },
      { "key": "Échéance",   "value": "2026-03-21",        "type": "date"               },
      { "key": "Lien CRM",   "value": "https://crm.example.com/client/42", "type": "link" },
      { "key": "Lien Doc",   "value": "https://docs.example.com/faq",      "type": "link" },
      { "key": "Avancement", "value": "0",         "type": "progress"                   },
      { "key": "Module",     "value": "Facturation", "type": "text"                     },
      { "key": "Référence",  "value": "REF-2026-0314", "type": "text"                   }
    ]
  }'
```

### Champs spécifiques ingest

| Champ | Type | Requis | Description |
|---|---|---|---|
| `title` | string | **oui** | Titre du ticket |
| `description` | string | non | Description en HTML |
| `column` | string | non | Colonne cible (défaut : `nouveau`) |
| `createdBy` | string | non | ID d'un compte existant (sera vérifié) |
| `variables` | array | non | Même format que POST /api/tickets |

### Réponse (201)

Même format que le POST classique, avec `"source": "api"`.

---

## 4. GET — Récupérer un ticket par ID

```bash
curl -X GET https://costo-test.vercel.app/api/tickets/<CARD_ID> \
  -H "Cookie: session=<VOTRE_SESSION_COOKIE>"
```

### Réponse (200)

Un objet ticket unique (même format que dans le tableau `cards` du GET général).

---

## 5. PATCH — Modifier un ticket

```bash
curl -X PATCH https://costo-test.vercel.app/api/tickets/<CARD_ID> \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<VOTRE_SESSION_COOKIE>" \
  -d '{
    "title": "Titre mis à jour",
    "description": "<p>Nouvelle description</p>",
    "columnKey": "en_cours",
    "assigneeId": "acc_xxxxxx",
    "followerIds": ["acc_yyyyyy"],
    "variables": [
      { "key": "Priorité", "value": "Moyenne", "type": "badge", "color": "orange" }
    ]
  }'
```

Tous les champs sont optionnels. Seuls les champs envoyés sont mis à jour.

---

## 6. POST — Déplacer un ticket

```bash
curl -X POST https://costo-test.vercel.app/api/tickets/move \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<VOTRE_SESSION_COOKIE>" \
  -d '{
    "cardId": "card_xxxxxx",
    "columnKey": "en_cours",
    "position": 0
  }'
```

---

## 7. Chat Flowise — Proxy API

Toutes les requêtes vers `/api/flowise/*` sont relayées vers l'instance Flowise configurée (`FLOWISE_API_HOST`).

> **Authentification requise** : le proxy nécessite une session utilisateur valide (cookie de session). Les requêtes non authentifiées reçoivent un `401 Unauthorized`.

### Exemple : envoyer un message au chatbot

```bash
curl -X POST https://costo-test.vercel.app/api/flowise/api/v1/prediction/<CHATFLOW_ID> \
  -H "Content-Type: application/json" \
  -H "Cookie: costockage_session=<SESSION_TOKEN>" \
  -d '{
    "question": "Crée un ticket pour le client Acme avec une priorité haute",
    "overrideConfig": {
      "createdBy": "acc_xxxxxx"
    }
  }'
```

Le `CHATFLOW_ID` du ticket bot est : `e86ba344-9e5d-4cdc-b6e5-2f55481f1c0f`

### Variables d'environnement Flowise

| Variable | Par défaut | Description |
|---|---|---|
| `FLOWISE_API_HOST` | `https://flowise.costockage.fr` | URL de l'instance Flowise |
| `FLOWISE_API_KEY` | _(vide)_ | Clé API envoyée en header `Authorization: Bearer <key>` |
| `FLOWISE_AUTHORIZATION` | _(vide)_ | Header `Authorization` brut (prioritaire sur `FLOWISE_API_KEY`) |
| `FLOWISE_TIMEOUT_MS` | `20000` | Timeout par requête (ms) |
| `FLOWISE_RETRY_ATTEMPTS` | `2` | Nombre de tentatives en cas d'erreur transitoire |

### Si Flowise est indisponible

Le proxy retourne :
```json
{
  "error": "Flowise upstream unavailable",
  "detail": "Could not reach Flowise at https://flowise.costockage.fr. Make sure the FLOWISE_API_HOST environment variable is correct and the Flowise instance is running."
}
```
**Status** : `502 Bad Gateway`

**Solutions** :
1. Vérifier que l'instance Flowise (`FLOWISE_API_HOST`) est bien en ligne
2. Vérifier les variables `FLOWISE_API_KEY` / `FLOWISE_AUTHORIZATION` si l'instance nécessite une authentification
3. Augmenter `FLOWISE_TIMEOUT_MS` si l'instance est lente à répondre

---

## Colonnes disponibles

| key | Label FR | Label EN | Couleur |
|---|---|---|---|
| `nouveau` | Nouveau | New | `#6366f1` |
| `en_cours` | En cours | In progress | `#f59e0b` |
| `en_attente` | En attente | Pending | `#8b5cf6` |
| `resolu` | Résolu | Resolved | `#22c55e` |
| `ferme` | Fermé | Closed | `#6b7280` |

## Couleurs de badges

`red`, `blue`, `green`, `orange`, `yellow`, `gray`, `purple`
