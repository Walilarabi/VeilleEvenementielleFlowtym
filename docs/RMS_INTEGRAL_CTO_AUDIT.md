# FLOWTYM RMS — audit CTO de reprise intégrale

Date de l'audit : 15 novembre 2026  
Dépôt : `Walilarabi/VeilleEvenementielleFlowtym`  
Branche de travail : `feat/rms-integral-cto-rebuild`  
Branche source de la reprise : `feat/google-ai-studio-recovery`  
Commit de départ : `bb52a39a18fccf7e2121956f74321d4a7f7992b8`

## 1. Gouvernance Git

- La PR #6 reste ouverte, en brouillon et non fusionnée. Sa base est `feat/revenue-ui-api-integration`.
- La branche de travail de cette mission a été créée à partir du commit `bb52a39a18fccf7e2121956f74321d4a7f7992b8`.
- Aucune modification de `main`, aucun merge, aucune migration Supabase live et aucun déploiement de production n'ont été effectués.
- Les premiers commits de cette branche restaurent uniquement les classes de thème sombre sur la page protégée « Données & Inventaire » et son composant d'import. La structure et les interactions de ces deux fichiers n'ont pas été redessinées.

## 2. Écarts d'interface constatés

### Paramètres

La version de référence `main` contient huit domaines A à H :
A. Configuration hôtel ; B. Revenue Management ; C. CompSet ; D. Veille événementielle ; E. Intégrations ; F. Utilisateurs/RBAC ; G. Alertes ; H. Système/Audit.

La version de récupération ne présente que quatre onglets : hôtel, CompSet, intégrations et apparence. Les domaines RM, veille, utilisateurs, alertes et système/audit doivent être reconstruits en réutilisant les contrats Supabase existants et sans réintroduire les persistances locales de la version historique.

### Mode sombre

Les composants suivants ont perdu une partie importante de leurs classes `dark:` dans la branche de récupération (comparaison de la version source `main` avec `feat/google-ai-studio-recovery`) :

| Fichier | Classes dark source | Classes dark récupération |
|---|---:|---:|
| Sidebar | 25 | 0 |
| CalendarView | 55 | 0 |
| TableView | 53 | 0 |
| ExplorerView | 123 | 0 |
| EventIntelligenceView | 80 | 5 |
| GeoIntelligenceView | 313 | 10 |
| FlowboardView | 136 | 23 |
| DemandForecastView | 337 | 3 |
| RMDecisionCenter | 342 | 3 |
| RevPARImpactSimulator | 105 | 3 |
| RateIntelligenceView | 581 | 0 |
| HistoricalDataImportView | 117 | 0 |
| SettingsView | 466 | 63 |
| SourcesCoverageView | 76 | 0 avant restauration |
| HotelDataExcelUploadSection | 116 | 0 avant restauration |

Ces nombres mesurent la présence de classes de thème, pas à eux seuls la complétude fonctionnelle.

### Vues fortement neutralisées

Les versions de récupération sont beaucoup plus courtes que les vues source, car plusieurs écrans ont été neutralisés pour ne pas afficher de données fictives :

| Vue | Source `main` | Récupération |
|---|---:|---:|
| FlowboardView | 27 059 caractères | 4 656 |
| EventIntelligenceView | 20 215 | 1 922 |
| GeoIntelligenceView | 79 593 | 2 650 |
| DemandForecastView | 102 406 | 1 327 |
| RMDecisionCenter | 75 274 | 1 327 |
| RevPARImpactSimulator | 37 237 | 1 478 |

La suite du travail doit restaurer l'expérience et les composants visuels, mais alimenter les écrans exclusivement avec des données persistées, calculées ou explicitement signalées comme indisponibles. Il ne faut pas réinjecter les fixtures historiques comme données opérationnelles.

## 3. Page protégée « Données & Inventaire »

Les fichiers de cette page sont :

- `src/components/sources/SourcesCoverageView.tsx`
- `src/components/sources/HotelDataExcelUploadSection.tsx`

Leur présentation originale est conservée. La restauration initiale a remis les classes du thème sombre depuis `main`.

Audit fonctionnel du composant d'import : il contient encore des éléments non conformes à la cible SaaS :
- historique initial de trois imports de démonstration ;
- historique sauvegardé dans `localStorage` ;
- prévisualisation construite avec des lignes codées en dur ;
- temporisation artificielle de 600 ms présentée comme une analyse de fichier ;
- nombre de lignes importées multiplié artificiellement ;
- modèles CSV contenant des exemples fictifs présentés comme exemples d'import.

Ces comportements doivent être remplacés par une lecture réelle du fichier, une prévisualisation issue de ses lignes, une validation, une persistance Supabase idempotente et un journal d'ingestion réel. La présentation, les sous-onglets et l'ergonomie de la page doivent rester la référence.

## 4. Fichiers réellement reçus et première cartographie

### Planning hôtelier Folkestone Opéra

Fichier : `H2258 - FOLKESTONE OPERA - Planning (1).xlsx`

- 1 onglet : `Planning`.
- 444 lignes et 416 colonnes.
- 413 dates, du 14/11/2026 au 31/12/2027.
- 8 typologies affichées.
- Environ 52 à 57 lignes de plans tarifaires par typologie.
- Ligne d'inventaire identifiée par `Left for sale`.
- Plans et codes tarifaires présents : RACK, OTA, MOBILE, VIP, BEST RATE, HB, TO-HB, TRAVCO, EXP, PKG, corporate et promotions.
- Les valeurs `X` sont conservées comme marqueurs bruts ; leur signification métier n'est pas inférée.
- Le classeur fournit de l'inventaire restant et des prix par plan/date. Il ne fournit pas à lui seul les réservations, annulations, pickup, lead time, chiffre d'affaires, ADR observé ou RevPAR observé.

### Benchmark Lighthouse / Booking.com

Fichier : `folkestone-opéra_bookingdotcom_lowest_los1_2guests (16).xlsx`

- 5 onglets : Aperçu, Tarifs, vs. Hier, vs. 3 jours, vs. 7 jours.
- 366 dates, du 14/11/2026 au 14/11/2027.
- Contexte affiché : Booking.com, EUR, LOS 1 nuit, 2 clients, Primary Compset.
- 10 hôtels concurrents listés dans l'onglet Tarifs.
- Statuts tels que `Épuisé` doivent rester des statuts, jamais devenir 0 €.
- L'indicateur « Demande du marché » est renseigné sur 61 dates seulement dans le fichier Aperçu et ses valeurs observées sont dans l'intervalle 0,10–0,98. Son échelle source doit être conservée et documentée avant toute normalisation.
- Le classeur ne fournit pas le taux d'occupation de Folkestone ni les réservations OTB.

### Conséquence sur l'ingestion Lighthouse existante

Le parseur `parseLighthouseExcelFile` dans `src/services/lighthouseAnalysisEngine.ts` traite actuellement la première ligne de chaque feuille comme en-tête. Dans le classeur reçu, les en-têtes sont à la ligne Excel 5. Il suppose également que la demande est renseignée et comprise entre 0 et 100. Le classeur réel a des valeurs décimales entre 0 et 1 et de nombreuses dates sans demande renseignée. Le parseur doit donc être corrigé et testé avec la structure réelle avant d'accepter ce fichier.

Le service `persistLighthouseExtraction` exige actuellement que tous les concurrents importés soient déjà configurés et actifs dans le CompSet. Il enregistre les observations sans room type ni rate plan confirmés. Ces observations ne doivent pas être utilisées comme comparables tarifaires exacts tant que leurs dimensions de comparabilité ne sont pas confirmées.

Les fichiers D-EDGE Réservations et TARIFS sont encore attendus. Aucun contenu ne doit être inventé en leur absence.

## 5. Architecture de données existante et écarts

La migration `supabase/migrations/20261113000100_hoptym_revenue_backend.sql` contient déjà notamment :
- `hotel_room_types`
- `hotel_rate_plans`
- `lighthouse_extractions`
- `lighthouse_rate_observations`
- `hotel_inventory_snapshots`
- `hotel_reservation_snapshots`
- `daily_rate_intelligence`
- `hotel_historical_daily`
- `hotel_historical_demand_snapshots`
- `hotel_parameters_profiles`
- `hotel_historical_import_logs`
- `revenue_forecast_runs`
- `daily_demand_forecasts`
- `integration_connections`
- `data_ingestion_jobs`

Écart à traiter : `hotel_rate_plans` décrit les plans, mais le schéma inspecté ne fournit pas de table normalisée dédiée aux prix quotidiens de chaque plan tarifaire. `hotel_inventory_snapshots.raw_payload` peut préserver le brut, mais ne doit pas devenir le substitut permanent d'un modèle relationnel interrogeable. Concevoir une table d'observations tarifaires par hôtel, typologie, plan, date de séjour, source et horodatage, avec contraintes d'idempotence et provenance.

Les imports d'inventaire doivent aussi distinguer l'inventaire total, commercialisable, vendu, restant, hors service et les valeurs inconnues. Le planning reçu ne permet pas de déduire le TO réel.

## 6. Moteurs Revenue Management — constats initiaux

- `src/domain/revenueMetrics.ts` contient des fonctions déterministes utiles pour TO, ADR, RevPAR, pickup net et métriques d'erreur. Les tests correspondants existent.
- `supabase/functions/revenue-api/_shared/forecast.ts` et l'endpoint de prévision utilisent des baselines explicites (saisonnalité, même jour de semaine, moyenne saisonnière, pickup comparable). C'est une base, pas encore un moteur prédictif avancé ; il ne doit pas produire de prévision en l'absence d'échantillons suffisants.
- `src/services/predictiveRevenueEngine.ts` contient une logique historique à hypothèses codées en dur (poids 50/30/20, seuils, taux d'ADR projeté, confiance fixe). Elle ne doit pas être considérée comme un moteur de production sans audit et remplacement par des calculs calibrés sur des données vérifiées.
- L'endpoint `recommendations-v2-generate` impose une configuration `pricing_v1`, des bornes de prix, la fraîcheur des sources, une couverture minimale et une validation humaine avant publication. C'est un socle de sécurité à préserver.
- Défaut de granularité identifié dans cet endpoint : les snapshots d'inventaire sont indexés par date seule dans la map `latestInventory`, puis une seule ligne est retenue par date. La génération ne traite donc pas correctement plusieurs typologies/plans tarifaires pour une même date. Les lignes de recommandation ne renseignent pas non plus `room_type_id` et `rate_plan_id`, bien que le schéma les prévoie.
- Le score de couverture des sources est stocké dans `confidence_score` ; son libellé doit être distingué d'une vraie confiance prédictive.
- L'impact événementiel est actuellement ramené au score maximal par date ; la combinaison d'événements concomitants reste à concevoir et tester.

## 7. État des validations et limites de l'environnement

- Le commit de départ `bb52a39a18fccf7e2121956f74321d4a7f7992b8` disposait d'un workflow GitHub réussi (19 tests métier, TypeScript, Deno et build Vite).
- Ce succès antérieur ne valide pas les nouveaux commits de cette branche.
- Le clone local du dépôt n'a pas pu être effectué dans cet environnement : résolution DNS de `github.com` indisponible. Aucun build local n'est donc déclaré.
- Aucun déploiement Vercel n'a été trouvé pour `feat/rms-integral-cto-rebuild`. Le dernier déploiement connu du projet `mon-flowtym-rms` est antérieur à cette branche et protégé par SSO.
- Aucune modification live de Supabase n'a été effectuée.

## 8. Ordre d'exécution

1. Compléter la matrice de comparaison des 84 fichiers entre la source Google AI Studio et la branche sécurisée : UI à restaurer, logique métier à préserver, code fictif à exclure.
2. Rétablir le thème sombre global, page par page, sans régression du thème clair.
3. Restaurer les 8 domaines de Paramètres, avec persistance réelle, RBAC et audit.
4. Remplacer l'import simulé de la page Données & Inventaire par une ingestion réelle, en préservant sa structure.
5. Corriger le parseur Lighthouse sur le classeur reçu et créer l'import planning PMS multi-typologie/multi-plan.
6. Concevoir le schéma d'observations tarifaires et l'idempotence des imports avant migration.
7. Reprendre les vues neutralisées avec les vrais contrats de données, des états vides explicites et les interactions opérationnelles.
8. Corriger la granularité du moteur par date × typologie × plan, puis enrichir les prévisions, pickup, comparabilité compset et backtesting.
9. Compléter l'audit RLS/API, les tests d'intégration, les tests de calcul et le parcours navigateur.
10. Obtenir CI et Preview sur le commit final de la branche ; ne déclarer la livraison que sur preuves.

## 9. Règle de preuve

Chaque fonctionnalité livrée devra être classée : récupérée, reconstruite, corrigée, testée, bloquée ou non commencée. Un build vert seul ne constitue pas une preuve de fonctionnement métier.


## 10. Vérification Supabase live — lecture seule (15/11/2026)

Projet RMS vérifié : `aliploqizujgovnlgjvg`.

### Données observées

- 1 organisation, 1 hôtel : Folkestone Opéra, Paris, France, 45 chambres, EUR, Europe/Paris.
- Latitude et longitude de l'hôtel : NULL.
- 2 comptes : `walilarabi@gmail.com` (super_admin) et `direction.commerciale.bh@gmail.com` (revenue_manager).
- 1 membership explicite pour le compte revenue_manager sur Folkestone Opéra.
- 10 concurrents actifs déjà enregistrés.
- 24 migrations appliquées.
- RLS activé sur toutes les tables consultées dans le périmètre RMS.

### Données RMS absentes dans la base live

- 0 typologie de chambre ; 0 plan tarifaire.
- 0 snapshot inventaire ; 0 snapshot réservation/OTB.
- 0 extraction Lighthouse ; 0 observation concurrentielle.
- 0 historique journalier ; 0 snapshot de demande historique.
- 0 profil de paramètres RM ; 0 run de prévision ; 0 prévision journalière.
- 0 intégration ; 0 job d'ingestion.

La liste des 10 concurrents et leurs identifiants est dans l'historique de l'audit live ; les noms doivent être rapprochés du fichier Lighthouse sans fuzzy-match automatique. Les correspondances exactes peuvent être utilisées ; les autres restent non rapprochées et exclues des calculs CompSet jusqu'à validation.

### RLS — contrôle des politiques

Les tables contrôlées (`hotel_inventory_snapshots`, `hotel_reservation_snapshots`, `hotel_rate_plans`, `hotel_room_types`, `lighthouse_rate_observations`, `hotel_parameters_profiles`, `data_ingestion_jobs`, `daily_rate_intelligence`) ont chacune des politiques SELECT liées à `flowtym_private.can_access_hotel` et des politiques d'écriture liées à `flowtym_private.can_manage_hotel`. Cela constitue un signal positif, pas une preuve complète de non-contournement ; les tests multi-utilisateurs restent à exécuter.

### Advisors Supabase

- Sécurité : 1 avertissement `Leaked Password Protection Disabled`. Remédiation officielle : https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Performance : 1 information relative à des index non encore utilisés. Ne pas supprimer automatiquement des index sur la seule base de cette observation : la base est encore peu alimentée.
- Santé : aucun lint remonté.

Aucune modification live n'a été réalisée pendant cette inspection.


## 11. Contraintes SQL live utiles à l'import PMS

Inspection complémentaire des index et colonnes Supabase :

- `hotel_room_types` possède une unicité `(hotel_id, code)` : création idempotente des 8 typologies possible.
- `hotel_rate_plans` possède une unicité `(hotel_id, code)`, et non `(hotel_id, room_type_id, code)`. Dans le planning Topsys, les mêmes codes de plan tarifaire se répètent pour plusieurs typologies. Il faut donc stocker les plans comme définitions globales par hôtel (room_type_id NULL) et porter la typologie au niveau de chaque observation tarifaire.
- `data_ingestion_jobs` possède une unicité `(organization_id, idempotency_key)` : elle peut empêcher un même fichier de créer plusieurs jobs.
- `hotel_inventory_snapshots` ne possède actuellement aucune unicité métier sur hôtel/typologie/date/instant/source. Un import répété pourrait donc créer des doublons.
- Il n'existe pas de table normalisée de prix quotidiens par `hotel_rate_plan` × `room_type` × `stay_date`.

Conception cible avant import complet :
1. Ajouter `ingestion_job_id` aux snapshots d'inventaire.
2. Ajouter un index unique métier sur `(hotel_id, room_type_id, stay_date, snapshot_at, source_system)` pour les snapshots avec room_type_id non NULL.
3. Créer `hotel_rate_plan_observations` avec hotel_id, organization_id, room_type_id, rate_plan_id, stay_date, snapshot_at, rate_amount nullable, currency, availability_status, source_system, source_status, ingestion_job_id et raw_payload.
4. Ajouter l'unicité `(hotel_id, room_type_id, rate_plan_id, stay_date, snapshot_at, source_system)` et les politiques RLS `can_access_hotel` / `can_manage_hotel`.
5. Modifier l'API d'ingestion pour utiliser un upsert sur ces clés et des lots bornés.

Cette migration n'est pas encore appliquée à la base live. Aucun import des deux classeurs n'a été exécuté.
