# HOPTYM RMS — Architecture cible du module Données & Connectivités

> Statut : spécification de conception v1 — 14 novembre 2026  
> Dépôt : `Walilarabi/VeilleEvenementielleFlowtym`  
> Périmètre : catalogue fournisseurs, connecteurs 2-Way, imports universels, normalisation, calculs Revenue Management et alimentation des moteurs de prévision/pricing.

## 1. Principes non négociables

1. **Un fournisseur sélectionné n'est pas un fournisseur connecté.** Les états sont distincts : `catalogue`, `documentation vérifiée`, `accès demandé`, `sandbox`, `configuré`, `testé`, `connecté`, `dégradé`, `désactivé`.
2. **Aucun faux succès.** Un test de connexion doit exécuter un appel réel, vérifier le code HTTP, le schéma attendu et la propriété/hôtel ciblé. Les données de démonstration sont explicitement marquées `demo` et ne sont jamais comptabilisées comme données réelles.
3. **Secrets côté serveur uniquement.** OAuth client secrets, API tokens, clés privées et credentials PMS/CM sont stockés dans un coffre serveur chiffré. Jamais dans le bundle Vite, `localStorage`, logs, analytics ou tables lisibles par le navigateur. Le frontend ne reçoit qu'un identifiant d'intégration et son statut.
4. **Multi-tenant strict.** Chaque ligne opérationnelle est liée à `organization_id` et `hotel_id`. RLS doit vérifier l'appartenance de l'utilisateur à l'organisation et l'accès à l'hôtel. Aucun `DEFAULT_ORG_ID` partagé ni création automatique d'une organisation de démonstration.
5. **Connecteurs indépendants du fournisseur.** Tous les fournisseurs alimentent un modèle canonique commun ; l'interface et les calculs RM ne dépendent pas de leur payload propriétaire.
6. **Synchronisation idempotente et traçable.** Curseurs, timestamps fournisseur, identifiants externes, idempotency keys, reprises avec backoff, déduplication, DLQ et journal d'audit.
7. **Pas de push tarifaire non autorisé.** Toute écriture externe (ARI, restriction, réservation) est soumise aux permissions du connecteur, à une validation métier, aux garde-fous et à une confirmation utilisateur tant que l'automatisation n'a pas été expressément activée.
8. **Les données manquantes restent inconnues.** Pas de zéro inventé pour une disponibilité inconnue, pas de tarif concurrent absent traité comme 0 €, pas de prévision affichée comme observée.

## 2. Catalogue des fournisseurs

Le catalogue déroulant doit être alimenté par des métadonnées versionnées. Les fournisseurs restent sélectionnables même si leur API nécessite un accord partenaire ; la fiche doit alors afficher clairement « accès partenaire requis » et la documentation vérifiée. La sélection ne crée aucune connexion.

### 2.1 Rate shoppers / intelligence tarifaire

| Fournisseur | Capacités/documentation identifiées | Accès et limites | État de préparation |
|---|---|---|---|
| Lighthouse (ex OTA Insight) | API v3 ; hôtels/compsets, tarifs observés, historiques, parity et demand selon abonnement ; header `X-Oi-Authorization` | Reporting ; 20 requêtes/API/subscription/24h et 120 requêtes/min ; Live Rate Shopping/Raw Rates avec token ; usage commercial/affichage des données aux clients soumis à consentement écrit préalable | Documentation publique ; accord commercial requis |
| RateGain Navigator / Rate Intelligence | API REST inbound/outbound pour RMS : hôtels, historique tarifaire, calendriers de shopping, push de changements et demandes de chargement | Onboarding commercial/technique et contrat partenaire ; API 2-Way selon contrat | Spécification technique à obtenir |
| RateTiger Shopper (eRevMax) | Rate shopper et intelligence concurrentielle ; API publique non confirmée | Demander API/exports, scopes et droits de réutilisation | À qualifier |
| D-EDGE RateScreener | Produit Rate Shopper identifié ; API exacte distincte des APIs CRS à confirmer | Ne pas assimiler RateScreener aux APIs Channel Manager/CRS | À qualifier |
| SiteMinder Insights | Produit de rate shopping, parity et market insights ; documentation publique du portail SiteMinder pour les autres familles d'API | API Insights dédiée et droits d'accès à confirmer ; ne pas confondre avec pmsXchange | À qualifier |
| Fornova Competitive Intelligence | Rate shopping, compset, visibilité et comparaison tarifaire multi-canaux | API/exports et droits de redistribution à obtenir | Partenaire à qualifier |
| Optimand Rate Shopper | Rate shopper hôtelier avec compset | Documentation API partenaire non confirmée ; demander export structuré | À qualifier |
| Hotellistat | Suite comprenant rate shopping, historique et market intelligence | API et rate feed à confirmer selon offre | À qualifier |
| Price Seeker (Paraty Tech) | Rate shopper, monitoring concurrentiel et parité | Demander contrat API/export et conditions de réutilisation | À qualifier |
| Amadeus Rate360 / PricePosition | Solutions de rate shopping identifiées dans le catalogue d'intégrations IDeaS | Documentation API et programme partenaire à obtenir | À qualifier |
| BEONx / BEONPRICE | Solution de rate shopping / RMS référencée dans le catalogue d'intégrations IDeaS | Valider les API, scopes et droits d'accès exacts | À qualifier |
| SightPrice | Surveillance quotidienne des prix publics et disponibilités ; rapports PDF | Le fournisseur indique ne pas proposer de connexion PMS ; aucune API publique confirmée, donc pas de connecteur direct sans export structuré | Import fichier possible ; API à qualifier |


**Règle métier :** un rate shopper est généralement une source de lecture (observations concurrentes). Il ne doit pas être artificiellement présenté comme un connecteur 2-Way ARI. Les actions d'écriture de prix appartiennent au PMS ou au Channel Manager.

### 2.2 Channel Managers

| Fournisseur | API / familles identifiées | Flux attendus | Accès |
|---|---|---|---|
| D-EDGE | Partner & Developer Portal ; CRS Planning Services ; CRS Description Services ; APIs de connectivité selon contrat et certification | Lecture contenu/structure, réception réservations/notifications si autorisée ; push disponibilité, tarifs et restrictions selon interface certifiée | Portail partenaire et onboarding requis ; ne pas inventer d'URL d'endpoint ou de méthode non publiée |
| SiteMinder | SiteConnect ; pmsXchange ; SiteMinder Exchange API ; Channels Plus | pmsXchange : PMS/RMS 2-Way, push ARI/restrictions et synchronisation des réservations ; Exchange : lecture réservations, disponibilités et tarifs selon scopes | Accès partenaire, certification et contrats selon produit |
| Vertical Booking | API-XML ; Replicative Interface ; Transactional Interface ; API PMS | Flux ARI répliqués vers portails ; transaction Get Availability / Make Reservation ; intégration CRS-PMS et synchronisation temps réel selon interface | Spécifications techniques et mapping fournis dans le cadre du partenariat |
| RateGain Channel Manager / Smart Distribution | À distinguer de Smart Distribution demand-side ; interfaces distribution à confirmer | ARI et réservations selon produit souscrit | À qualifier auprès du fournisseur |
| Cloudbeds Distribution | APIs Distribution, rate plans, availability et restrictions ; webhooks/événements | Lecture et mise à jour selon scopes et produit ; événements de réservation | Developer Hub, sandbox et validation partenaire |
| STAAH ChannelConnect | APIs Property, Room Types, Rates/Availability/Restrictions, Reservations et Push Data | Pull ARI, push des deltas, réservations vers STAAH et vérification live avant confirmation selon doc | Accord de connectivité, IP whitelisting et certification ; push delta obligatoire selon la doc v1 |
| eZee Centrix | Interface Channel Manager XML/API | Synchronisation ARI et réservations selon contrat et version | Documentation officielle détaillée et provisioning par établissement à obtenir |
| Autres | Ajouter uniquement après validation de l'existence d'un produit/API pertinent | Capacités documentées individuellement | Jamais de connecteur fictif |

### 2.3 PMS

| PMS | Documentation officielle repérée | Données et opérations à étudier |
|---|---|---|
| Mews | Mews Open API : Connector API, Channel Manager API, Booking Engine API | Réservations (lecture/ajout/modification/annulation selon opérations), disponibilités, ressources, tarifs, services, événements/webhooks |
| Apaleo | Core APIs, Booking API, Distribution API, Inventory API, Rate Plan API, Webhooks API | Réservations, offres, inventaire, tarifs, restrictions, profils, webhooks ; OAuth 2.0 |
| Oracle OPERA Cloud | OHIP, Reservation API, Rate API, Price Availability Rate API, Inventory API, Distribution APIs, Business Events, Data APIs | Réservations, tarifs, inventaire, sell limits, restrictions, profils, événements et analytics ; OAuth 2.0 + application keys |
| Cloudbeds | PMS API, Data Insights API, Distribution APIs, Webhooks & Events, OAuth/API keys | Réservations, clients, chambres, folios, inventaire, tarifs, restrictions, événements temps réel ; sandbox |
| Protel / Planet | Documentation d'intégration partenaire à obtenir | Réservations, ARI, profils et événements selon version/contrat |
| Stayntouch | Connect API v2 ; documentation des endpoints et webhooks | Accès lecture/écriture, réservations, tarifs, restrictions et événements ; OAuth 2.0 | NDA, autorisation de l'hôtel, sandbox/UAT et certification |
| Clock PMS+ | PMS API REST, Base API, Yield Management API, OTA Channel Connect et Message Channels | Réservations, chambres, tarifs, disponibilités, notifications PUSH/PULL | Compte API et accès partenaire/sandbox ; Digest authentication selon doc |
| RoomRaccoon | Documentation API partenaire à obtenir | Réservations, inventaire, tarifs et webhooks à qualifier |
| Guestline / Rezlynx | Portail développeur officiel et onboarding API REST | Données PMS selon les endpoints activés ; opérations à inventorier dans le portail | Onboarding et credentials partenaire |

Pour chaque PMS, la fiche de documentation doit contenir : propriétaire de l'API, lien/version, processus d'accès, environnements sandbox/production, authentification, scopes, pagination, rate limits, webhooks, opérations GET/POST/PATCH/DELETE réellement disponibles, champs, fuseaux horaires, devises, statuts, erreurs/retry, idempotence, certification, limites contractuelles et matrice de tests. Une capacité non documentée est notée « à confirmer », jamais supposée.

### 2.4 Sources d'événements

| Source | API | Usage HOPTYM | Réserve |
|---|---|---|---|
| OpenAgenda | REST API v2 : agendas, événements, lieux | Agenda local/régional, dates, lieux, catégories, URLs, recherche et mises à jour | Authentification requise ; respecter licence de chaque agenda |
| Ticketmaster Discovery API | REST v2 : événements, attractions, lieux | Concerts, sport, spectacles, salles et dates | API key, couverture et quotas selon compte |
| Eventbrite | API REST et OAuth | Salons, conférences, événements professionnels et publics | OAuth et périmètre d'accès selon application |
| Datatourisme | API/jeux de données à qualifier | Offre touristique et événements publiés par les acteurs du tourisme | Vérifier licence, fraîcheur, champs et conditions d'accès |
| Sources officielles organisateurs/venues | APIs, flux ICS, RSS ou exports documentés | Confirmation, dates, capacité, annulation, changement de lieu | Provenance et niveau de confiance conservés |

Le moteur Event Intelligence conserve la provenance, la date de collecte, la date de dernière vérification, le niveau de confiance, le statut de validation et l'historique des modifications.

## 3. Architecture connecteur 2-Way

### Flux entrant (fournisseur vers HOPTYM)

- Réservations créées, modifiées, annulées, no-show et check-in/out si autorisé.
- Détails de séjour : date de réservation, arrivée/départ, chambre, plan tarifaire, nombre de chambres/nuitées, prix, devise, canal, segment, statut.
- Inventaire, tarifs et restrictions du PMS/CM.
- Notifications webhook en priorité ; polling incrémental comme filet de sécurité.
- Imports fichiers quand l'API n'existe pas ou n'est pas autorisée.

### Flux sortant (HOPTYM vers fournisseur)

- Prix par date / type de chambre / plan tarifaire.
- Disponibilité / inventaire selon responsabilité du système maître.
- Restrictions : MinLOS, MaxLOS, CTA, CTD, Stop Sell.
- Mise à jour avec prévisualisation, validation des garde-fous, approbation, envoi, accusé de réception et réconciliation.
- Une écriture n'est activée que si le fournisseur expose réellement l'opération, que le compte possède le scope requis et que le test sandbox est réussi.

### Contrat TypeScript cible

Chaque adaptateur implémente les capacités disponibles, sans prétendre que tous les fournisseurs supportent toutes les méthodes :

```ts
interface IntegrationAdapter {
  provider: ProviderCode;
  capabilities: IntegrationCapability[];
  testConnection(): Promise<ConnectionTestResult>;
  fetchReservations?(cursor?: SyncCursor): Promise<SyncPage<CanonicalReservation>>;
  fetchInventory?(range: DateRange): Promise<CanonicalInventory[]>;
  fetchRates?(range: DateRange): Promise<CanonicalRate[]>;
  fetchRestrictions?(range: DateRange): Promise<CanonicalRestriction[]>;
  publishRates?(payload: RateUpdateBatch): Promise<PublishResult>;
  publishInventory?(payload: InventoryUpdateBatch): Promise<PublishResult>;
  publishRestrictions?(payload: RestrictionUpdateBatch): Promise<PublishResult>;
  subscribeWebhooks?(): Promise<WebhookRegistrationResult>;
  verifyWebhook?(request: unknown): Promise<VerifiedWebhook>;
}
```

Les méthodes optionnelles représentent une capacité réelle ou non disponible. Un adaptateur doit exposer un manifeste de capacités versionné, et non des méthodes simulées.

## 4. Modèle canonique et persistance

Les objets fournisseurs sont convertis en objets HOPTYM indépendants du fournisseur :

- `CanonicalReservation` : source, identifiant externe, hôtel, statut, created/updated timestamps, arrival/departure, booked_at, room nights, rooms, rate plan, channel, segment, revenue, currency, taxes, cancellation data.
- `CanonicalInventory` : date de séjour, chambre, inventaire total, vendu/occupé, hors service, disponible, statut de fiabilité.
- `CanonicalRate` : date, chambre, rate plan, montant, devise, conditions, occupation, taxes, source et timestamp d'observation.
- `CanonicalRestriction` : MinLOS, MaxLOS, CTA, CTD, StopSell, date, chambre, plan tarifaire.
- `CompetitorRateObservation` : concurrent, date de collecte, date de séjour, LOS, tarif, devise, chambre normalisée, occupation, repas, annulation, canal, source.
- `EventObservation` : source, événement, dates, lieu, capacité/fréquentation si sourcée, preuve, confiance, statut.

Tables cibles à auditer avant toute migration (réutiliser les tables existantes lorsqu'elles correspondent) :
- registre : `integration_providers`, `hotel_integrations`, `integration_capabilities`, `integration_sync_jobs`, `integration_webhook_events`;
- imports : `import_batches`, `import_rows_raw`, `import_field_mappings`, `data_quality_issues`;
- faits RM : réservations/snapshots, inventaire journalier, tarifs historiques, observations concurrents, snapshots OTB/pickup et métriques calculées;
- traçabilité : `source_system`, `source_record_id`, `source_updated_at`, `ingested_at`, `payload_hash`, `import_batch_id`, `quality_status`.

Toute migration commence par l'inspection du schéma réel, des clés étrangères, contraintes, index et RLS. Pas de création de tables redondantes à l'aveugle.

### 4.1 État du schéma Supabase observé le 14/11/2026

L'audit en lecture seule du projet Supabase `aliploqizujgovnlgjvg` confirme que les fondations de persistance existent déjà. Il faut les réutiliser et compléter leurs contrats plutôt que créer une deuxième famille de tables sans justification.

| Table existante | Usage | RLS | Lignes observées |
|---|---|---:|---:|
| `integration_connections` | Registre des connexions par organisation/hôtel, référence de secret et statut | Activé | 0 |
| `data_ingestion_jobs` | Historique des jobs d'ingestion, compteurs et idempotency key | Activé | 0 |
| `hotel_historical_daily` | Faits historiques RM, OTB par horizons, pickup, lead time, ADR, RevPAR, compset et provenance | Activé | 0 |
| `hotel_historical_import_logs` | Historique des imports, rejets, avertissements, colonnes détectées | Activé | 0 |
| `hotel_inventory_snapshots` | Inventaire, chambres vendues/disponibles, BAR et restrictions par date | Activé | 0 |
| `hotel_reservation_snapshots` | OTB, room nights, revenu, annulations, lead time et pickup net | Activé | 0 |
| `lighthouse_extractions` | Enveloppe d'import/extraction rate shopper | Activé | 0 |
| `lighthouse_rate_observations` | Observations concurrentielles normalisées | Activé | 0 |
| `daily_rate_intelligence` | Indicateurs et décisions tarifaires quotidiennes | Activé | 0 |

Le même contrôle a relevé le référentiel de base suivant : `organizations=1`, `users=2`, `hotels=1`, `competitor_hotels=10`, mais `hotel_room_types=0`, `hotel_rate_plans=0`, `venues=0`, `event_sources=0` et `events=0`. Il faut donc compléter le mapping chambre/plan tarifaire et l'alimentation des sources événementielles avant de prétendre calculer des indicateurs RM par typologie ou des impacts d'événements.

Les politiques lues dans `pg_policies` utilisent `flowtym_private.can_access_hotel(hotel_id, organization_id)` pour SELECT et `flowtym_private.can_manage_hotel(...)` pour INSERT/UPDATE/DELETE sur ces tables. Cela constitue une base tenant-aware ; il reste à tester les scénarios d'accès croisé avec deux organisations et deux hôtels avant d'autoriser le pipeline d'import.

**Constat important :** les tables ci-dessus sont vides au moment de l'audit. Le schéma est préparé, mais il ne prouve pas qu'un historique de réservation, d'inventaire, de prix concurrents ou de décisions RM alimente déjà le moteur.

### 4.2 Authentification et sécurité d'accès — correction engagée

Le parcours applicatif a été remplacé sur la branche de travail :
- Connexion par `supabase.auth.signInWithPassword`, sans utilisateur de démonstration ni identité locale persistée.
- Restauration de session par `auth.getUser()` (validation serveur) et abonnement `onAuthStateChange`.
- Chargement du profil `public.users` par `id = auth.uid()`, avec contrôle de présence de `organization_id` (sauf super-admin).
- Déconnexion par `auth.signOut()`.
- Récupération par `resetPasswordForEmail` et écran dédié de définition du nouveau mot de passe via `updateUser`.
- Client Vite compatible avec `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY`, en donnant priorité aux variables d'environnement.
- Les anciennes écritures de seed qui créaient une organisation fictive via `DEFAULT_ORG_ID` ont été désactivées ; elles échouent désormais de manière explicite et sûre.

Vérifications Supabase en lecture seule :
- 2 profils applicatifs existent, et les 2 correspondent à un utilisateur Auth Supabase et possèdent une organisation.
- RLS est activé sur toutes les tables de `public` examinées.
- La politique `users_read_own_profile` limite le profil à `auth.uid() = users.id`.
- Les politiques organisation/hôtel et les tables d'ingestion utilisent les fonctions `flowtym_private.can_access_hotel` et `flowtym_private.can_manage_hotel`.
- Le Security Advisor signale encore `auth_leaked_password_protection` (protection contre les mots de passe compromis désactivée).

Configuration Vercel du projet `mon-flowtym-rms` :
- `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` sont maintenant présents en development, preview et production.
- Les valeurs sont reprises des variables Supabase existantes et n'ont pas été affichées dans les logs ou le rapport.

Limites restantes avant validation de bout en bout :
- Aucun identifiant de compte de test n'a été utilisé ; les parcours connexion, reset et session invalide restent à tester dans un navigateur avec un compte de test autorisé.
- La configuration SMTP, les URL Auth autorisées et la désactivation des inscriptions publiques ne sont pas exposées par les outils de gestion disponibles dans cette session ; elles doivent être vérifiées dans le dashboard.
- La protection contre les mots de passe compromis doit être activée dans Supabase Auth.
- Le déploiement de production n'a pas été déclenché.

### 4.3 Moteur d'import universel — première implémentation

Le nouveau service `src/services/hoptymImportService.ts` traite les fichiers normalisés en cinq familles :
- Historique hôtelier : `hotel_historical_daily`, calcul des champs calendaires, occupancy, ADR et RevPAR lorsqu'ils peuvent être déduits, conservation du brut et des champs OTB/Pickup.
- Disponibilités : `hotel_inventory_snapshots`, inventaire, chambres vendues/disponibles, occupation, BAR, MinStay, CTA et CTD.
- Réservations : agrégation par date de séjour, canal, segment et devise dans `hotel_reservation_snapshots`, lead time moyen et pickup net lorsque les colonnes sont fournies.
- Rate Shopper : extraction source et observations dans `lighthouse_extractions` / `lighthouse_rate_observations`, rapprochement du concurrent par nom.
- Événements : mise en attente dans `event_suggestions` avec statut `pending` ; aucune publication automatique dans le référentiel partagé.

Chaque import vérifie l'utilisateur Auth et son profil, résout l'hôtel dans la même organisation, crée un job `data_ingestion_jobs`, utilise le client publishable sous RLS, écrit par lots et journalise les lignes rejetées. Aucun service_role n'est embarqué dans le navigateur. En cas d'erreur, le job passe à `failed` ou `partial`.

**Limites :** aucun fichier métier n'a encore été injecté en base, faute de compte de test autorisé et d'un fichier fourni pour validation. Le parcours de mapping doit être testé sur des exports réels avant d'activer les connecteurs automatiques.

## 5. Moteur universel de fichiers

Formats initiaux : XLSX, XLS, CSV UTF-8 et CSV avec séparateur détecté. Les fichiers PDF ne sont pas une source tabulaire de première intention ; leur extraction sera une phase distincte.

### Parcours utilisateur

1. Dépôt du fichier et contrôle MIME/extension/taille.
2. Détection du type probable : réservations, pickup, OTB, disponibilité/inventaire, tarifs, rate shopper/concurrents, événements, restrictions.
3. Détection feuille, en-têtes, dates, devise, séparateur, formats décimaux et fuseau horaire.
4. Score de confiance de classification ; si ambigu, demander à l'utilisateur de choisir le type.
5. Mapping assisté des colonnes vers le schéma canonique ; sauvegarde du mapping réutilisable par fournisseur/hôtel.
6. Prévisualisation des lignes, anomalies, doublons, valeurs ignorées et dates couvertes.
7. Validation des règles métier ; aucune écriture avant confirmation.
8. Ingestion en zone de staging, puis promotion transactionnelle vers les tables canoniques.
9. Calcul des métriques et rafraîchissement des vues RM.
10. Rapport d'import avec nombre réel de lignes lues/acceptées/rejetées, erreurs téléchargeables, plage de dates et provenance.

### Qualité, sécurité et idempotence

- Ne jamais multiplier artificiellement les nombres de lignes.
- Conserver le fichier source, son hash, le nom, la taille, l'utilisateur, l'hôtel, l'organisation, le mapping et l'horodatage.
- Dédupliquer avec clé métier + hash ; permettre « remplacer », « compléter » ou « annuler l'import » avec aperçu d'impact.
- Rejeter les formules non fiables, macros, fichiers chiffrés, fichiers dépassant les limites configurées et classeurs corrompus.
- Neutraliser les formules lors des exports pour éviter CSV/Excel formula injection.
- Les données brutes restent consultables selon les droits ; les lignes rejetées ne sont jamais injectées silencieusement.
- Les imports historiques ne réécrivent pas les réservations opérationnelles du PMS.

## 6. Calculs Revenue Management

### Pickup et rythme

Pour un instantané OTB comparable :

- `Pickup rooms (N jours) = OTB actuel - OTB du snapshot pris N jours auparavant`.
- `Net pickup = réservations ajoutées - réservations annulées/modifiées en diminution` sur la période.
- Calculer par date de séjour, hôtel, type de chambre, canal et segment quand les données le permettent.
- Distinguer pickup en chambres, nuitées et chiffre d'affaires ; préciser brut/net et la fenêtre temporelle.
- Si les snapshots historiques manquent, afficher « non calculable » au lieu de fabriquer une valeur.

### Lead Time

`Lead Time = date/heure d'arrivée - date/heure de création de réservation`, exprimé en jours, selon le fuseau de l'hôtel. Conserver la distribution (médiane, quartiles, percentiles) et segmenter si les volumes sont suffisants.

### ADR / Occupation / RevPAR

- `ADR = chiffre d'affaires hébergement / chambres-nuitées vendues`.
- `Occupation = chambres-nuitées vendues / chambres-nuitées disponibles`.
- `RevPAR = chiffre d'affaires hébergement / chambres-nuitées disponibles` ou `ADR × occupation` avec conventions homogènes.
- Exclure les chambres hors service de la capacité si la règle de l'hôtel le prévoit ; documenter la convention.
- Séparer revenus hébergement, taxes, extras, commissions et devises.

### Concurrence et demande marché

- Calculer minimum, médiane, moyenne, maximum, P25/P75 uniquement sur des observations comparables et valides.
- Comparabilité : même date d'arrivée, LOS, nombre de personnes, type de chambre équivalent, repas, politique d'annulation, devise, taxes et canal.
- Un concurrent « sold out » est un état de disponibilité, pas un tarif à zéro.
- Indiquer couverture du compset (ex. 6/10 hôtels), ancienneté de collecte et confiance.
- Un indice de demande marché est un indicateur calculé à partir de signaux explicitement identifiés ; ne pas le présenter comme un taux d'occupation marché observé sans source.

## 7. Prévisions et recommandations tarifaires

Les moteurs utilisent des faits persistés et versionnés : historique OTB, pickup, lead time, annulations, événements validés, prix concurrents comparables, calendrier, capacité, saisonnalité et données de marché autorisées.

Chaque recommandation contient :
- prix actuel, prix recommandé, variation absolue et relative ;
- dates, hôtel, chambre et rate plan ciblés ;
- signaux et poids utilisés, horizon de prévision ;
- niveau de confiance, données manquantes et raisons ;
- impact attendu sur ADR, occupation, RevPAR et revenu avec intervalle/incertitude ;
- restrictions proposées : MinLOS/MaxLOS, CTA, CTD, Stop Sell ;
- statut : brouillon, à valider, approuvée, envoyée, confirmée, rejetée, expirée ;
- version du modèle et référence des snapshots sources.

Aucune recommandation ne peut être poussée vers un PMS/CM si le connecteur ne supporte pas la capacité, si la donnée est périmée, si les garde-fous sont dépassés ou si l'approbation requise manque. Les prédictions doivent être évaluées par backtesting et comparées à une baseline simple.

## 8. Interface du module « Données & Inventaire »

Créer une expérience organisée en espaces cohérents :

1. **Vue d'ensemble** : état des flux, fraîcheur, couverture des hôtels, imports récents, anomalies, qualité.
2. **Connectivités** : Rate Shopper / Channel Manager / PMS / Événements ; listes déroulantes de fournisseurs, fiches API, capacités et statuts.
3. **Import universel** : glisser-déposer, classification automatique, mapping, aperçu, validation et historique.
4. **Données normalisées** : réservations, inventaire, tarifs, restrictions, observations concurrents et événements.
5. **Qualité & réconciliation** : doublons, incohérences, trous de données, écarts source/canonique et reprises.
6. **Historique & métriques** : pickup, lead time, ADR, occupation, RevPAR, demande et historique concurrentiel.
7. **Journal technique** : exécutions, latence, pagination, quotas, erreurs expurgées de tout secret et relances.

Chaque carte fournisseur doit afficher : type, nom, lien docs, accès requis, environnements, version API, capacités lecture/écriture, webhooks, dernier test réel, dernière synchronisation et statut. Les listes déroulantes doivent être recherchables, groupées par catégorie, et proposer « Autre fournisseur / demande d'ajout ».

## 9. Séquence de réalisation et critères d'acceptation

### Lot 0 — sécuriser et fiabiliser l'existant
- Retirer la session utilisateur de démonstration par défaut et utiliser l'authentification Supabase réelle.
- Supprimer tout token/secret fictif du code.
- Remplacer les faux tests API par des résultats explicites « simulation » ou par des appels réels côté serveur.
- Supprimer les statuts « connecté » par défaut.
- Sortir les secrets du localStorage et du client.
- Corriger l'organisation par défaut codée en dur dans la synchronisation ; utiliser l'organisation de la session.
- Auditer les RLS et le périmètre hôtel.

### Lot 1 — catalogue & modèle connecteur
- Catalogue versionné des rate shoppers, channel managers, PMS et sources événementielles.
- Fiches de documentation fournisseur et matrice de capacités.
- Registre de connexions par organisation/hôtel et statut vérifié.
- Contrats canoniques et services backend.

### Lot 2 — import universel
- Parser réel XLSX/XLS/CSV, détection de type, mapping, prévisualisation et staging.
- Imports événements, tarifs concurrents, réservations, disponibilité, restrictions et snapshots OTB.
- Persistance et traçabilité ; tests sur fichiers de référence réels et synthétiques étiquetés.

### Lot 3 — connecteurs pilotes
- Lighthouse en lecture après confirmation des droits commerciaux et scopes.
- D-EDGE après obtention de la documentation/accès partenaire exacts.
- Un PMS pilote à choisir selon les accès sandbox disponibles.
- Connecteur événementiel OpenAgenda, puis Ticketmaster/Eventbrite selon couverture et quotas.

### Lot 4 — moteur RM et recommandations
- Recalculs déterministes, snapshots, tests de formules et backtesting.
- Suggestions tarifaires et restrictions avec garde-fous.
- Push 2-Way seulement après tests sandbox, validation du mapping et approbation.

### Lot 5 — industrialisation
- Tests unitaires, intégration, RLS multi-tenant, charge, résilience et non-régression.
- Monitoring, alertes, réconciliation et documentation d'exploitation.
- Aucune fusion de PR ni déploiement production automatique dans le cadre de cette spécification.

**Definition of Done :** aucun bouton muet ; aucun faux statut connecté ; chaque donnée affiche sa source et sa fraîcheur ; les imports sont exacts et idempotents ; les calculs sont testés sur des jeux de référence ; les connecteurs n'écrivent que les capacités autorisées ; les tests RLS prouvent l'isolation inter-organisations et inter-hôtels ; aucun secret dans le frontend ou les logs.

## 10. Sources officielles consultées

### Rate Shopper
- Lighthouse API v3 : https://api.mylighthouse.com/
- Lighthouse API documentation mirror / latest version : https://devapi.mylighthouse.com/
- RateGain — Rate Intelligence APIs for RMS : https://rategain.com/solutions-for-rms-companies/
- BEONx : https://www.beonx.com/
- Duetto : https://www.duettocloud.com/

### Channel Managers
- D-EDGE Partner & Developer Portal : https://developers.portal.d-edge.com/
- D-EDGE documentation portal : https://docs.d-edge.com/
- SiteMinder Developer Guide : https://www.siteminder.com/developer-guide/
- SiteMinder Developer Docs : https://developer.siteminder.com/
- Vertical Booking API-XML : https://online.verticalbooking.ovosodo.net/en/connectivity/api-xml/
- STAAH ChannelConnect v1 : https://getapidoc.staah.net/v1/
- eZee Centrix : https://www.ezeecentrix.com/ycdemo/faqs.php

### PMS
- Mews Open API : https://docs.mews.com/
- Mews Connector API : https://docs.mews.com/connector-api
- Apaleo Developer Documentation : https://apaleo.dev/
- Apaleo API Swagger : https://api.apaleo.com/swagger/
- Oracle Hospitality Integration Platform : https://www.oracle.com/hospitality/integration-platform/
- Oracle OPERA Cloud Distribution APIs : https://docs.oracle.com/en/industries/hospitality/integration-platform/ohipu/c_oracle_hospitality_distribution_apis.htm
- Cloudbeds Developer Hub : https://developers.cloudbeds.com/
- Cloudbeds PMS API : https://developers.cloudbeds.com/reference/about-pms-api
- Stayntouch Connect API v2 : https://api-specs.stayntouch.com/v2/index.html
- Clock PMS+ API : https://api-docs.clock-software.com/
- Guestline Rezlynx API Portal : https://developers.guestline.com/

### Événements
- OpenAgenda API : https://developers.openagenda.com/en/
- Ticketmaster Discovery API : https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
- Eventbrite OAuth : https://www.eventbrite.com/platform/docs/app-oauth-flow

### Sécurité et données
- Supabase Security : https://supabase.com/docs/guides/security
- Supabase RLS : https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Storage : https://supabase.com/docs/guides/storage

> Les pages publiques ne garantissent pas un droit d'accès commercial ni une certification partenaire. Avant de coder un endpoint propriétaire, obtenir le contrat API/OpenAPI/SDK exact du fournisseur et consigner sa version.
