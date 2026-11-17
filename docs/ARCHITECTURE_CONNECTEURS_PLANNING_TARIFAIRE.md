# Architecture d'Intégration Universelle & Planning Tarifaire — FLOWTYM REVENUE

## 1. Principe Architectural : Moteur Découplé & Modèle Interne Pivot

Le moteur de Revenue Management et le **Planning Tarifaire** de FLOWTYM REVENUE reposent sur un modèle interne normalisé (`RateCalendarCell`, `RoomCategoryConfig`, `RatePlanConfig`, `HotelTariffConfiguration`).
Aucun calcul tarifaire ne dépend directement du format d'API d'un fournisseur externe.

```
[PMS Externes]        [Channel Managers]       [Rate Shoppers]       [Import Excel / CSV]
Opera, Mews, Protel   D-EDGE (prioritaire),    Lighthouse,           D-EDGE Planning (.xlsx)
Cloudbeds, Apaleo...  SiteMinder, Channex...   OTA Insight...        CSV / Matrice générique
        │                     │                      │                       │
        └─────────────────────┴──────────────────────┴───────────────────────┘
                                         │
                             Adaptateurs Universels
                   (src/services/connectors/connectorRegistry.ts)
                                         │
                             Modèle Pivot FLOWTYM
                  (RateCalendarCell · Vérité 4 Sources · Audit)
                                         │
                        Coffre-Fort & API Serveur Express
                   (server.ts · AES-256-GCM · /api/connectors/*)
```

---

## 2. Trois Familles de Connecteurs & Matrice de Capacités

Chaque fournisseur est décrit par une définition statique dans `CONNECTOR_PROVIDERS` (`src/services/connectors/connectorRegistry.ts`) et une instance configurée par établissement (`ConnectorInstance`, `src/types/connectors.ts`) :

| Famille | Fournisseurs natifs prévus | Capacités déclarées (`ConnectorCapabilities`) |
| --- | --- | --- |
| **Channel Manager** | **D-EDGE CRS (Prioritaire)**, SiteMinder, Cubilis, Vertical Booking, RoomCloud, Channex | `readRates`, `writeRates`, `readRestrictions`, `writeRestrictions`, `readInventory`, `writeInventory`, `importRoomTypes`, `importRatePlans`, `supportsWebhooks`, `supportsPolling`, `supportsDeltaSync`, `maxDaysPerBatch`, `supportedRestrictionTypes` |
| **PMS** | Oracle Opera / OHIP, Mews Commander, Protel, Cloudbeds, RoomRaccoon, Apaleo, Clock, Medialog | Contrôle granulaire lecture/écriture tarifs, restrictions, stock physique, import catalogue chambres/plans |
| **Rate Shopper** | Lighthouse (OTA Insight), RateGain, API Custom | Lecture benchmarking & parité concurrentielle (`readRates`) |

### Connecteur prioritaire D-EDGE (`src/services/dedgeConnectivityService.ts`)
- Suivi complet du profil de connectivité D-EDGE (`hotelCode`, `engineId`, canaux OTA actifs, mapping explicite chambres/plans, historique de requêtes/réponses ARI).
- Import catalogue Chambres & Plans tarifaires (`importCatalogFromConnector`).
- Envoi ARI par lots (`pushAriToDedge`) et réception temps réel / polling.

---

## 3. Sécurité, Coffre-Fort & Modes d'Exécution Explicites

1. **Chiffrement AES-256-GCM côté serveur (`server.ts`)** :
   - Les identifiants sensibles (`apiToken`, `clientSecret`, `webhookSecret`, `apiKey`, `password`) transitent uniquement lors de la soumission vers `POST /api/connectors/:hotelId`.
   - Ils sont chiffrés côté serveur avant stockage (`encryptSecret` / `decryptSecret` avec dérivation SHA-256) et ne sont **jamais renvoyés en clair** par `GET /api/connectors/:hotelId` ni écrits dans le cache navigateur (`sanitizeConnectorForClientCache`).
   - Seuls des métadonnées masquées (`hasValue: true`, `maskedPreview: "••••abcd"`) sont exposées à l'interface.
2. **Séparation stricte `sandbox_simulation` vs `live_api`** :
   - Chaque connecteur, test (`connection`, `read`, `write`, `webhook`) et journal technique (`ConnectorSyncLog`) indique explicitement son `executionMode`.
   - Aucune confirmation n'est présentée comme un appel partenaire réel lorsqu'elle s'exécute en Sandbox contrôlée.
3. **Validation anti-doublon des mappings externes (`RoomMappingEditor` + `POST /api/tariff-config/:hotelId`)** :
   - Rejet HTTP `409 Conflict` côté serveur et blocage en temps réel côté UI si un même code externe est affecté à deux catégories ou deux plans tarifaires sur un même connecteur.

---

## 4. Synchronisation Bidirectionnelle (Sens 1 & Sens 2), Anti-Boucle & Vérité à 4 Sources

Chaque cellule `RateCalendarCell` stocke explicitement quatre niveaux de comparaison :
1. **`flowtymSavedRateEur`** : dernière valeur enregistrée dans FLOWTYM (édition manuelle, acceptation IA ou import).
2. **`transmittedRateEur`** (+ `lastSentAt`) : dernière valeur transmise vers le connecteur externe (Sens 1).
3. **`cmReturnedRateEur`** (+ `cmUpdatedAt`) : dernière valeur confirmée ou reçue depuis le Channel Manager (Sens 2).
4. **`pmsReturnedRateEur`** (+ `pmsUpdatedAt`) : dernière valeur confirmée ou reçue depuis le PMS (Sens 2).

### Mécanisme Anti-Boucle
- **Idempotency Key** unique (`X-Flowtym-Idempotency-Key`) sur chaque poussée sortante et chaque accusé de réception (`POST /api/rate-planning/ack-inbound`).
- **Origine tracée** (`flowtym_auto`, `flowtym_manual`, `pms`, `channel_manager`) : une mise à jour entrante depuis PMS/CM applique les règles de priorité et **ne déclenche jamais de réémission sortante en boucle**.
- **Versionnement optimiste** (`version` vs `externalVersion`) et file de résolution des conflits (`RateSyncConflict`).

---

## 5. Moteur d'Import Excel / CSV Intelligent D-EDGE Planning

Implémenté dans `src/services/connectors/dedgeExcelImportEngine.ts` et piloté par `SmartExcelImportModal.tsx` (6 étapes) :
1. **Détection automatique de structure** (`.xlsx`, `.xls`, `.csv` multi-délimiteurs `,` `;` `\t`) :
   - Identification des colonnes *Chambre*, *Plan tarifaire*, *Type de donnée*, et des colonnes *Dates* (ISO, FR `DD/MM/YYYY`, numéros de série Excel).
   - Héritage automatique de la ligne supérieure lorsque la cellule *Chambre* est vide ou fusionnée (format natif D-EDGE Planning).
   - Distinction stricte entre **`Price (EUR)`** (tarif) et **`Left for sale`** (stock disponible par chambre/date propagé sur tous les plans de la catégorie).
2. **Détection d'anomalies** : valeurs non numériques, négatives, manquantes, lignes en double, dates invalides.
3. **Modèles de mapping réutilisables (`ImportTemplateMapping`)** par établissement.
4. **Prévisualisation Diff non destructive** (`new`, `modified`, `unchanged`, `rejected`) avant toute écriture.
5. **Exécution transactionnelle** après confirmation explicite + rapport CSV téléchargeable + entrée dans `ConnectorSyncLog`.

---

## 6. Modèle Relationnel PostgreSQL / Supabase

La migration `src/supabase/migrations/05_universal_connectors_and_planning.sql` définit les tables SQL et politiques RLS multi-tenant par `hotel_id` :
- `hotel_connectors` & `connector_secrets_vault`
- `external_room_mappings` & `external_rate_plan_mappings` (contraintes d'unicité anti-doublons)
- `connector_sync_logs`
- `scheduled_rate_changes`
- `import_mapping_templates` & `import_job_reports`
- Extension des colonnes de vérité 4 sources sur `rate_calendar_cells`
