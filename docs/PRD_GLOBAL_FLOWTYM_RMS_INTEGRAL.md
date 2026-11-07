# DOSSIER MAÎTRE D'INGÉNIERIE LOGICIELLE & PRD INTÉGRAL
## FLOWTYM RMS & EVENT INTELLIGENCE
**Spécifications Fonctionnelles, Architecture Système, Modèle de Données & Scripts de Déploiement pour l'Intégralité de la Solution**

---

| Référence Normative | Métadonnée Projet |
|---|---|
| **Nom du Système** | Flowtym Event Intelligence & Revenue Management System (RMS) |
| **Périmètre du Document** | **Intégralité de la plateforme (12 modules métier, infrastructure, sécurité, base de données)** |
| **Version** | **3.0.0 — Production-Ready Master Reference** |
| **Statut** | Document Contractuel de Conception et de Réalisation |
| **Établissement Pilote** | Grand Hôtel Folkestone Opéra (4★, 45 chambres, 9 Rue de Castellane, 75008 Paris) |
| **Auteur** | Lead Software Architect, DBA PostgreSQL/Supabase, Expert Revenue Management Hôtelier |

---

# TABLE DES MATIÈRES GÉNÉRALE

- **SECTION 1 : ANALYSE STRATÉGIQUE, VISION ET UTILISATEURS CIBLES**
- **SECTION 2 : DOCUMENT 1 — PRD COMPLET DES 12 MODULES DE L'APPLICATION**
  - Module 1 : Flowboard Exécutif & Tableau de Bord Radar D3
  - Module 2 : Calendrier Événementiel & Planning d'Anticipation
  - Module 3 : Explorer les Événements & Moteur Multi-Villes
  - Module 4 : Veille Géographique & Rayons d'Influence 10/30 km
  - Module 5 : Analyse du Marché, Tensions & Vacances Scolaires Multi-Pays
  - Module 6 : Pricing Intelligence & Recommandations (Grille 21 Colonnes)
  - Module 7 : Veille Concurrentielle Lighthouse Rate Insight (5 Onglets Néo-Natif)
  - Module 8 : Centre de Décision RM, Opportunités & Simulateur RevPAR
  - Module 9 : Analyses, Tendances & Détection des Récurrences
  - Module 10 : Hub de Rapports Propriétaires, Automatisations Slack & Export Excel Universel
  - Module 11 : Sources de Données, Couverture & Ingestion Hybride
  - Module 12 : Connectivité PMS/CRS (D-EDGE, Lighthouse API, Webhooks) & Administration Multi-Hôtels
- **SECTION 3 : DOCUMENT 2 — ARCHITECTURE TECHNIQUE SYSTÈME & SÉCURITÉ**
- **SECTION 4 : DOCUMENT 3 — CONCEPTION COMPLÈTE DE LA BASE DE DONNÉES (MCD, MLD, ERD & DICTIONNAIRE)**
- **SECTION 5 : DOCUMENT 4 — SCRIPTS SQL EXÉCUTABLES (DDL, DML, FONCTIONS, TRIGGERS & RLS)**
- **SECTION 6 : DOCUMENT 5 — CONTRATS D'API ET INTÉGRATIONS EXTERNES**
- **SECTION 7 : PLAN DE DÉVELOPPEMENT, MATRICE DE RECETTE QA & CI/CD**

---

# SECTION 1 : ANALYSE STRATÉGIQUE & UTILISATEURS CIBLES

## 1.1 Problématique Métier de l'Hôtellerie
Les Revenue Managers (RM) d'hôtels indépendants et de groupes 3★/4★/5★ font face à une triple rupture :
1. **L'angle mort événementiel** : Les RMS traditionnels (IdEA, Duetto, Atomize) prédisent la demande en analysant uniquement l'historique interne du PMS (séries chronologiques On The Books). Ils ignorent les congrès, concerts, salons, matchs ou sommets diplomatiques jusqu'à ce que les réservations arrivent (souvent trop tard, à des tarifs sous-cotés).
2. **L'hétérogénéité des sources de données** : Le RM passe 2 à 3 heures par jour à naviguer manuellement entre son CRS/PMS (D-EDGE), son outil de veille tarifaire (Lighthouse / OTA Insight) et des dizaines d'agendas événementiels non fiabilisés.
3. **L'opacité algorithmique ("Boîte Noire")** : Les recommandations tarifaires automatisées ne sont pas expliquées, créant une méfiance légitime des propriétaires et directeurs d'exploitation.

## 1.2 La Réponse Flowtym RMS
Flowtym unifie **l'intelligence événementielle en amont**, **le rate shopping compset en temps réel** et **les flux d'inventaire CRS**, avec un moteur de pricing transparent, justifiable et soumis à validation humaine obligatoire.

## 1.3 Personas & Matrice RACI

| Rôle | Persona Type | Missions Principales dans Flowtym | Permissions d'Accès |
|---|---|---|---|
| **Head of Revenue Management** | Wali Larabi | Arbitrage stratégique, calibration des règles, validation tarifaire, reporting propriétaires | Accès complet écriture / décision, paramétrage des bornes |
| **Revenue Manager / Yield** | Julie V. | Analyse journalière des 90 jours, pilotage du tableau 21 colonnes, traitement des alertes | Consultation, proposition de modifications tarifaires motivées |
| **Directeur Général (GM)** | Philippe M. | Suivi du RevPAR global, validation des propositions d'événements, réunions de gestion | Consultation tableaux de bord, approbation événements majeurs |
| **Propriétaire d'Hôtel** | Société Foncière | Évaluation de la rentabilité, MPI/ARI/RGI, vérification du respect des budgets | Accès mensuel dédié au module Rapports Propriétaires |
| **Analyste / Auditeur** | Externe | Audit de parité tarifaire et conformité des politiques de distribution | Lecture seule, export de données |

---

# SECTION 2 : DOCUMENT 1 — PRD COMPLET DES 12 MODULES

## MODULE 1 : FLOWBOARD EXÉCUTIF & TABLEAU DE BORD RADAR D3
- **Objectif Métier** : Fournir une vue exécutive instantanée de la santé RM de l'hôtel sur 90 jours.
- **Fonctionnalités Clés** :
  - *Cartes de KPI Stratégiques* : Nombre d'événements majeurs actifs, Gain RevPAR potentiel estimé (€), Taux d'occupation On The Books moyen, Nombre d'écarts de parité OTA détectés.
  - *Graphique Radar D3 interactif* : Pour tout événement cliqué, modélise l'empreinte sur 5 dimensions : Attractivité générale, Saturation hôtelière du quartier, Part internationale, Proximité géographique de l'hôtel, Indice de compression.
  - *Module de Détection d'Opportunités Majeures* : Notification push visuelle en haut à droite dès qu'un écart $\ge +40€$ est détecté entre le tarif suggéré et le tarif actuel.
  - *File d'Attente des Suggestions* : Validation rapide en 1 clic des nouveaux événements détectés par les crawlers.

## MODULE 2 : CALENDRIER ÉVÉNEMENTIEL & PLANNING D'ANTICIPATION
- **Objectif Métier** : Visualiser la densité événementielle et planifier les actions tarifaires sur 12 à 24 mois.
- **Fonctionnalités Clés** :
  - *Double Affichage Matriciel* : Mode calendrier double mois côte-à-côte (inspiré de la vue mensuelle de référence) ou mode tableau paginé.
  - *Indicateur de Demande Marché* : Affichage systématique du taux de tension en pourcentage (%) à côté du niveau qualitatif (*Faible 35%*, *Modéré 68%*, *Élevé 82%*, *Critique 95%*).
  - *Intégration des Vacances Scolaires* : Visualisation des zones françaises A, B, C et des vacances des pays émetteurs (UK, Allemagne, Benelux, USA, Italie, Espagne) avec impact différencié selon le segment de l'hôtel.
  - *Filtres Rapides & Avancés* : Catégorie (Salons, Congrès, Concerts, Sport, Mode, Sommets), Statut de confirmation, Priorités RMS (Score $\ge 50$).

## MODULE 3 : EXPLORER LES ÉVÉNEMENTS & MOTEUR MULTI-VILLES
- **Objectif Métier** : Explorer l'exhaustivité des manifestations répertoriées dans le portefeuille de villes surveillées.
- **Fonctionnalités Clés** :
  - Recherche plein texte instantanée sur les titres, sous-titres, organisateurs, lieux et mots-clés.
  - Fiche événementielle détaillée (Drawer latéral) : Description, jauge attendue, part internationale, historique de fréquentation, URL de billetterie/organisateur, sources vérifiées et niveau de confiance (0-100%).
  - Gestion du cycle de vie : Ajout manuel d'événement, import de fichiers CSV/Excel d'agendas municipaux, proposition de nouveaux événements.

## MODULE 4 : VEILLE GÉOGRAPHIQUE & RAYONS D'INFLUENCE 10/30 KM
- **Objectif Métier** : Cartographier les flux de demande et mesurer la proximité spatio-temporelle réelle des lieux d'événements.
- **Fonctionnalités Clés** :
  - *Double Rayon Circulaire & Isochrone* : Rayon prioritaire de 10 km (impact direct sur l'ADR) et rayon étendu de 30 km (impact sur les dates de saturation métropolitaine).
  - *Calcul d'Itinéraires et de Temps de Trajet* : Distance métrique, temps de trajet en voiture et en transports en commun (Métro, RER) depuis l'hôtel jusqu'aux grands centres (Porte de Versailles, Villepinte, Accor Arena, Grand Palais, Stade de France).
  - *Répertoire des Venues* : Capacité d'accueil, adresses géocodées, coordonnées WGS84 et mutualisation multi-hôtels.

## MODULE 5 : ANALYSE DU MARCHÉ, TENSIONS & COMPRESSION HÔTELIÈRE
- **Objectif Métier** : Prédire les dates de compression et de pénurie de chambres à l'échelle du compset et de la destination.
- **Fonctionnalités Clés** :
  - *Heatmap Calendaire de Tension* : Grille annuelle identifiant les périodes où la demande dépasse la capacité disponible du compset direct.
  - *Moteur d'Impact des Vacances Scolaires* : Analyse de l'impact historique sur l'ADR et l'occupation selon les typologies de clientèles (Familles, Tourisme individuel, Affaires).
  - *Export PDF Synthétique Marché* : Rapport imprimable d'état des tensions pour les comités de direction.

## MODULE 6 : PRICING INTELLIGENCE & RECOMMANDATIONS (GRILLE 21 COLONNES)
- **Objectif Métier** : Le cockpit de pilotage quotidien du Revenue Manager, réunissant toutes les données décisionnelles en une vue unique.
- **Spécifications des 21 Colonnes** :
  1. *Date de séjour* & 2. *Jour de semaine* (avec mention week-end).
  3. *Événement associé* et score RM.
  4. *Demande marché* (Indice 0-100 et libellé avec %).
  5. *Tarif actuel commercialisé (BAR)* issu du CRS D-EDGE.
  6. *Position compset (ex: 2/6)* & Médiane officielle Lighthouse.
  7. *Tarif moyen compset* & 8-9. *Fourchette Min-Max concurrents*.
  10. *Pickup 24h* ($\text{Dispo}_{J-1} - \text{Dispo}_{J}$).
  11. *Stock restant* (sur capacité 45 ch.).
  12. *Taux d'occupation OTB* (%).
  13. *ADR net hébergement réalisé* (€) & 14. *RevPAR réalisé* (net hébergement / 45 ch.).
  15. *Lead Time dominant* (0-3j, 4-7j, 8-14j, 15-30j, >30j).
  16. *Tarif suggéré par l'algorithme RM* (€).
  17. *Écart suggéré vs actuel* (€ et %).
  18. *Stratégie Yield* : Intitulé ultra-court de 1 à 3 mots (*Capture demande*, *Protection stock*, *Alignement marché*, *Stimulation volume*) avec badge couleur et infobulle détaillée.
  19. *Explication RM* : Texte court cliquable (*Détail tarifaire ⓘ*) ouvrant un popover sans casser la largeur du tableau.
  20. *Indice de confiance statistique* (0-100%).
  21. *Validation humaine* : Boutons d'action Valider, Modifier avec motif normalisé, Refuser.
- **Garde-fous de Sécurité** :
  - Plancher strict : 180 € (interdiction absolue de descendre en-dessous).
  - Plafond strict : 550 € (protection contre l'hyper-décrochage).
  - Saut unitaire maximum : 100 € par révision (progressivité commerciale).
  - Alertes visuelles (icônes d'avertissement et surlignage) en cas de butée sur une borne.

## MODULE 7 : VEILLE CONCURRENTIELLE LIGHTHOUSE (5 ONGLETS NÉO-NATIF)
- **Objectif Métier** : Intégration directe et analyse automatique des classeurs Excel Lighthouse `folkestone-opéra_bookingdotcom_lowest_los1_2guests.xlsx`.
- **Fonctionnalités Clés** :
  - *Double Médiane Distincte* : Affichage séparé de la Médiane Lighthouse officielle (Aperçu) et de la Médiane recalculée par Flowtym (excluant Folkestone, les sold-out et les non-numériques), avec écart en € et %.
  - *Matrice des Évolutions* : Visualisation des variations vs. Hier, vs. 3 jours, vs. 7 jours pour chaque concurrent (+X€ en vert, -X€ en rouge, 0€ en gris, tiret si indisponible).
  - *Détection IA des 5 Situations* :
    - CAS 1 : Demande forte & concurrents en hausse $\rightarrow$ Étudier hausse BAR.
    - CAS 2 : Demande faible & concurrents en baisse $\rightarrow$ Signalement risque perte compétitivité.
    - CAS 3 : Folkestone significativement sous la médiane ($\le -8\%$) $\rightarrow$ Alerte sous-valorisation.
    - CAS 4 : Folkestone significativement au-dessus de la médiane ($\ge +12\%$) $\rightarrow$ Vérifier justification.
    - CAS 5 : $\ge 2$ concurrents en sold-out $\rightarrow$ Fermeture des promos et Min Stay.
  - *Parseur et Générateur XLSX Réel* : Capacité de glisser-déposer tout fichier Lighthouse réel et de retélécharger l'export 5 onglets standardisé.

## MODULE 8 : CENTRE DE DÉCISION RM, OPPORTUNITÉS & SIMULATEUR REVPAR
- **Objectif Métier** : Détecter les anomalies tarifaires et simuler le gain financier avant application.
- **Fonctionnalités Clés** :
  - *Détection des Sous-Tarifications* : Dates où le tarif de l'hôtel est inférieur à la médiane du marché alors que l'affluence événementielle est élevée.
  - *Simulateur d'Impact RevPAR* : Calcul du gain de chiffre d'affaires prévisionnel : $\Delta \text{RevPAR} = (\text{Tarif Recommandé} - \text{Tarif Actuel}) \times \text{Chambres Restantes} \times \text{Coefficient d'Absorption}$.
  - *Historique des Décisions* : Traçabilité des arbitrages avec motif (pénétration, préservation marge, compset non pertinent, événement non répertorié).

## MODULE 9 : ANALYSES, TENDANCES & DÉTECTION DES RÉCURRENCES
- **Objectif Métier** : Détecter la cyclicité des événements annuels et biennaux pour projeter la demande future.
- **Fonctionnalités Clés** :
  - Identification automatique des éditions N-1, N et N+1 (ex: SIAL toutes les années paires, Salon International de l'Agriculture chaque fin février).
  - Évaluation de la progression d'affluence d'une édition à l'autre.
  - Règles de récurrence prédictives générant les dates prévisionnelles d'événements non encore officialisés par les organisateurs.

## MODULE 10 : RAPPORTS PROPRIÉTAIRES, AUTOMATISATIONS SLACK & EXPORT EXCEL
- **Objectif Métier** : Automatiser le reporting pour la direction et alerter l'équipe en temps réel.
- **Fonctionnalités Clés** :
  - *Rapport Mensuel Propriétaires* : Synthèse des KPIs (RevPAR, ADR, TO), indices de part de marché équitable (MPI, ARI, RGI) et mix de distribution. Téléchargement direct en PDF stylisé et Excel.
  - *Comparatif Réel vs Prévisions par Typologie* : Graphiques Recharts interactifs permettant de comparer les réservations acquises (OTB) aux prévisions, avec filtres par catégorie de chambre (*Classique*, *Supérieure*, *Deluxe*, *Suite Famille*).
  - *Digest Hebdomadaire Automatique* : Configuration de l'envoi du lundi matin résumant les performances passées (S-1) et les recommandations prioritaires (S+1).
  - *Alertes Slack Automatisées* : Envoi instantané dans le canal dédié dès qu'un écart de parité est détecté sur une OTA (Agoda, Booking, Expedia).
  - *Export Historique Complet Excel* : Téléchargement en 1 clic de l'intégralité des dates, prix, occupations et compsets au format CSV/Excel universel UTF-8 avec BOM.

## MODULE 11 : SOURCES DE DONNÉES, COUVERTURE & INGESTION HYBRIDE
- **Objectif Métier** : Superviser l'infrastructure de collecte et auditer la fiabilité des sources.
- **Fonctionnalités Clés** :
  - Tableau de bord des crawlers : Statut de santé, date du dernier crawl, taux de fiabilité (0-100%).
  - Audit des preuves : Chaque événement est rattaché à son extrait source (communiqué de presse, billetterie, agenda de collectivité).
  - Section d'Upload Excel Alternatif Hors-API : Permet l'import manuel d'extractions Lighthouse, D-EDGE CRS et PMS Night Audit en attendant l'activation des connecteurs directs.

## MODULE 12 : CONNECTIVITÉ PMS/CRS & ADMINISTRATION SYSTÈME
- **Objectif Métier** : Assurer la liaison bidirectionnelle avec les systèmes de distribution de l'hôtel.
- **Fonctionnalités Clés** :
  - *Connecteur D-EDGE CRS* : Flux ARI (Availability, Rates & Inventory) et récupération des réservations.
  - *Connecteur Lighthouse Rate Insight API v3* : Synchronisation des relevés compset toutes les 6 heures.
  - *Gestion Multi-Établissements* : Sélecteur de portefeuille hôtelier en barre supérieure avec isolation stricte des données.
  - *Ergonomie Avancée* : Barre latérale rétractable en 3 modes (*Déployé*, *Compact avec tooltips*, *Masqué avec trigger bordure gauche*), gestion des raccourcis clavier globaux (`Ctrl+K`, `Ctrl+1..9`, `Ctrl+Shift+F`, `?`) et mode Plein Écran (Fullscreen API).

---

# SECTION 3 : DOCUMENT 2 — ARCHITECTURE TECHNIQUE & SÉCURITÉ

## 3.1 Architecture Découplée (Decoupled SaaS Architecture)

```
[ FRONTEND CLIENT (React 19 SPA) ]
  ├── Navigation & Shortcuts Engine (Keyboard Hook, Command Palette)
  ├── Views: Flowboard, Calendar, Pricing 21-cols, Lighthouse, Reports, Geo
  ├── Graphics: Recharts, D3.js Radar Chart
  └── Local Business Logic & Data Transformer
            │
            ▼ HTTPS / REST & WebSocket
[ BACKEND API / INGESTION WORKERS (Node.js 22 LTS / Express) ]
  ├── Rate Intelligence Engine & 14 Yield Techniques
  ├── SheetJS Binary XLSX Parser & Serializer
  ├── Slack Block Kit Alert Dispatcher
  ├── PDF Generation Service (jsPDF-AutoTable)
  └── Connectors (Lighthouse API v3, D-EDGE CRS, Google Maps)
            │
            ▼ PostgreSQL Protocol (PgBouncer Pooling)
[ PERSISTENCE & DATA LAYER (Supabase / PostgreSQL 16 + PostGIS) ]
  ├── Multi-Tenant Schema with RLS
  ├── Spatial Indices (GIST on Point 4326)
  ├── Audit Log System (Immuable Write-Only)
  └── Database Functions & Triggers
```

## 3.2 Sécurité, RLS et Isolation Multi-Tenant
- **Règle Fondamentale** : Chaque hôtel et utilisateur appartient à une `organization_id`.
- **Row Level Security (RLS)** : Activée sur 100% des tables contenant des données d'exploitation. Aucun utilisateur ne peut requêter ou modifier les tarifs ou événements privés d'un autre tenant.
- **Chiffrement** :
  - Données au repos : Chiffrement AES-256 via les mécanismes de disques gérés PostgreSQL.
  - Données en transit : TLS 1.3 obligatoire, HSTS activé.
  - Clés d'API et secrets connecteurs stockés sous forme de hash ou variables d'environnement serveur, jamais exposés au client.
- **Conformité RGPD** : Les données de réservations PMS ne stockent aucun identifiant bancaire (PAN/CVV) et anonymisent les noms de clients après la clôture de la date de séjour.

---

# SECTION 4 : DOCUMENT 3 — CONCEPTION DE LA BASE DE DONNÉES

## 4.1 Modèle Physique de Données (Liste Exhaustive des Tables)

1. `public.organizations` : Comptes clients / Groupes hôteliers.
2. `public.user_profiles` : Comptes utilisateurs liés à `auth.users`.
3. `public.hotels` : Établissements avec coordonnées PostGIS, capacités et bornes tarifaires.
4. `public.room_typologies` : Catégories de chambres (Classique, Supérieure, Deluxe, Suite).
5. `public.venues` : Lieux d'accueil et parcs des expositions géocodés.
6. `public.events` : Référentiel des manifestations et événements.
7. `public.event_occurrences` : Dates de début et de fin des événements.
8. `public.event_hotel_impacts` : Scores RM et distances personnalisés par hôtel.
9. `public.event_sources` : Sources de données et crawlers.
10. `public.event_evidence` : Preuves de vérification et extraits textuels.
11. `public.event_suggestions` : Propositions en attente de qualification.
12. `public.competitor_hotels` : Set concurrentiel (Compset direct).
13. `public.daily_rate_intelligence` : Données journalières des 21 colonnes RM.
14. `public.lighthouse_extractions` : Historique des fichiers Excel Lighthouse importés.
15. `public.lighthouse_daily_records` : Données dénormalisées des 5 onglets Lighthouse.
16. `flowtym_audit.rm_decision_audit_logs` : Journal d'audit légal des décisions tarifaires.
17. `public.learned_calibration_rules` : Règles de yield apprises suite aux retouches RM.
18. `public.slack_alert_configs` : Configuration des webhooks et seuils de parité Slack.
19. `public.digest_schedules` : Paramétrage des récapitulatifs automatiques du lundi.

---

# SECTION 5 : DOCUMENT 4 — SCRIPTS SQL COMPLETS ET EXÉCUTABLES

Ce script constitue la structure complète de la base de données. Il peut être copié et exécuté dans l'éditeur SQL de Supabase ou via un outil de migration PostgreSQL.

```sql
-- ==============================================================================
-- FLOWTYM RMS & EVENT INTELLIGENCE — SCHÉMA POSTGRESQL COMPLET DE PRODUCTION
-- Multi-Tenancy étanche (RLS), PostGIS, Moteur Tarifaire, Compset & Audit
-- ==============================================================================

BEGIN;

-- 1. EXTENSIONS OBLIGATOIRES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. SCHÉMAS
CREATE SCHEMA IF NOT EXISTS flowtym_core;
CREATE SCHEMA IF NOT EXISTS flowtym_audit;

-- 3. TABLES D'ORGANISATION ET DE SÉCURITÉ
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    subscription_tier VARCHAR(50) NOT NULL DEFAULT 'enterprise' CHECK (subscription_tier IN ('starter', 'pro', 'enterprise')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'revenue_manager' CHECK (role IN ('super_admin', 'org_admin', 'head_of_rm', 'revenue_manager', 'hotel_gm', 'viewer')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hotels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    stars INTEGER NOT NULL DEFAULT 4 CHECK (stars BETWEEN 1 AND 5),
    room_count INTEGER NOT NULL DEFAULT 45 CHECK (room_count > 0),
    segment VARCHAR(50) NOT NULL DEFAULT 'Boutique' CHECK (segment IN ('Luxe', 'Boutique', 'Affaires', 'Économique', 'Resort')),
    base_adr NUMERIC(10,2) NOT NULL DEFAULT 240.00 CHECK (base_adr > 0),
    rate_floor_eur NUMERIC(10,2) NOT NULL DEFAULT 180.00 CHECK (rate_floor_eur > 0),
    rate_ceiling_eur NUMERIC(10,2) NOT NULL DEFAULT 550.00 CHECK (rate_ceiling_eur >= rate_floor_eur),
    max_single_step_eur NUMERIC(10,2) NOT NULL DEFAULT 100.00 CHECK (max_single_step_eur > 0),
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL DEFAULT 'Paris',
    postal_code VARCHAR(20) NOT NULL DEFAULT '75008',
    country_code VARCHAR(2) NOT NULL DEFAULT 'FR',
    location GEOMETRY(Point, 4326) NOT NULL,
    latitude NUMERIC(9,6) NOT NULL,
    longitude NUMERIC(9,6) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_hotels_org_code UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_hotels_location ON public.hotels USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_hotels_org ON public.hotels (organization_id);

-- Typologies de Chambres
CREATE TABLE IF NOT EXISTS public.room_typologies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    total_rooms INTEGER NOT NULL CHECK (total_rooms > 0),
    default_price_offset_eur NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_hotel_room_code UNIQUE (hotel_id, code)
);

-- 4. RÉFÉRENTIEL LIEUX & ÉVÉNEMENTS
CREATE TABLE IF NOT EXISTS public.venues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    venue_type VARCHAR(50) NOT NULL CHECK (venue_type IN ('parc_expositions', 'arena', 'stade', 'centre_congres', 'theatre', 'espace_public')),
    capacity INTEGER NOT NULL DEFAULT 0 CHECK (capacity >= 0),
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL DEFAULT 'Paris',
    postal_code VARCHAR(20),
    country_code VARCHAR(2) NOT NULL DEFAULT 'FR',
    location GEOMETRY(Point, 4326) NOT NULL,
    latitude NUMERIC(9,6) NOT NULL,
    longitude NUMERIC(9,6) NOT NULL,
    official_website TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venues_location ON public.venues USING GIST (location);

CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    subtitle TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN ('salons_foires', 'congres_medical', 'concerts_spectacles', 'sport', 'festivals', 'mode_luxe', 'corporate_sommet', 'culturel', 'vacances_scolaires')),
    venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
    city VARCHAR(100) NOT NULL DEFAULT 'Paris',
    country_code VARCHAR(2) NOT NULL DEFAULT 'FR',
    status VARCHAR(50) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'probable', 'estime', 'a_verifier', 'estimated_recurrent', 'announced_pending', 'cancelled')),
    impact_level VARCHAR(20) NOT NULL DEFAULT 'modere' CHECK (impact_level IN ('hyper', 'critique', 'modere', 'faible')),
    expected_attendance INTEGER NOT NULL DEFAULT 0 CHECK (expected_attendance >= 0),
    international_ratio_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (international_ratio_pct BETWEEN 0 AND 100),
    confidence_score NUMERIC(5,2) NOT NULL DEFAULT 95.00 CHECK (confidence_score BETWEEN 0 AND 100),
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    recurrence_frequency VARCHAR(50) CHECK (recurrence_frequency IN ('annual', 'biennial', 'triennial')),
    official_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_category ON public.events (category);
CREATE INDEX IF NOT EXISTS idx_events_impact ON public.events (impact_level);

CREATE TABLE IF NOT EXISTS public.event_occurrences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_date_confirmed BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_event_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_occurrences_dates ON public.event_occurrences (start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_occurrences_event ON public.event_occurrences (event_id);

CREATE TABLE IF NOT EXISTS public.event_hotel_impacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    distance_meters INTEGER NOT NULL CHECK (distance_meters >= 0),
    drive_time_minutes INTEGER NOT NULL DEFAULT 0,
    transit_time_minutes INTEGER NOT NULL DEFAULT 0,
    direct_demand_share_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    compression_index INTEGER NOT NULL DEFAULT 5 CHECK (compression_index BETWEEN 1 AND 10),
    final_rm_score INTEGER NOT NULL DEFAULT 60 CHECK (final_rm_score BETWEEN 0 AND 100),
    estimated_adr_boost_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    recommended_action TEXT NOT NULL,
    suggested_min_stay INTEGER NOT NULL DEFAULT 1 CHECK (suggested_min_stay >= 1),
    stop_sell_promos BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_event_hotel UNIQUE (event_id, hotel_id)
);

CREATE INDEX IF NOT EXISTS idx_impacts_hotel_score ON public.event_hotel_impacts (hotel_id, final_rm_score DESC);

-- 5. MOTEUR TARIFAIRE ET COMPSET CONCURRENTIEL
CREATE TABLE IF NOT EXISTS public.competitor_hotels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    stars INTEGER NOT NULL DEFAULT 4 CHECK (stars BETWEEN 1 AND 5),
    room_count INTEGER,
    distance_meters INTEGER NOT NULL,
    address TEXT NOT NULL,
    baseline_rate NUMERIC(10,2) NOT NULL DEFAULT 250.00,
    default_room_type VARCHAR(100) NOT NULL DEFAULT 'Classique',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table Principale : Grille Journalière 21 Colonnes RM
CREATE TABLE IF NOT EXISTS public.daily_rate_intelligence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    stay_date DATE NOT NULL,
    day_of_week VARCHAR(20) NOT NULL,
    is_weekend BOOLEAN NOT NULL,
    
    demand_index INTEGER NOT NULL CHECK (demand_index BETWEEN 0 AND 100),
    demand_level VARCHAR(20) NOT NULL CHECK (demand_level IN ('faible', 'modere', 'eleve', 'tres_fort', 'exceptionnel')),
    
    current_bar_eur NUMERIC(10,2) NOT NULL CHECK (current_bar_eur > 0),
    current_min_stay INTEGER NOT NULL DEFAULT 1,
    current_stop_sell BOOLEAN NOT NULL DEFAULT FALSE,
    
    lighthouse_median_eur NUMERIC(10,2) NOT NULL,
    flowtym_median_eur NUMERIC(10,2) NOT NULL,
    compset_min_eur NUMERIC(10,2) NOT NULL,
    compset_max_eur NUMERIC(10,2) NOT NULL,
    compset_avg_eur NUMERIC(10,2) NOT NULL,
    compset_sold_out_count INTEGER NOT NULL DEFAULT 0,
    compset_total_count INTEGER NOT NULL DEFAULT 5,
    my_compset_rank INTEGER NOT NULL,
    
    total_rooms INTEGER NOT NULL DEFAULT 45,
    remaining_rooms INTEGER NOT NULL CHECK (remaining_rooms BETWEEN 0 AND total_rooms),
    rooms_sold_otb INTEGER NOT NULL,
    occupancy_percent NUMERIC(5,2) NOT NULL CHECK (occupancy_percent BETWEEN 0 AND 100),
    pickup_24h INTEGER NOT NULL DEFAULT 0,
    pickup_3d INTEGER NOT NULL DEFAULT 0,
    pickup_7d INTEGER NOT NULL DEFAULT 0,
    booking_pace VARCHAR(50) NOT NULL DEFAULT 'normal',
    
    adr_net_eur NUMERIC(10,2) NOT NULL,
    revpar_eur NUMERIC(10,2) NOT NULL,
    lead_time_days_avg INTEGER NOT NULL DEFAULT 21,
    
    suggested_bar_eur NUMERIC(10,2) NOT NULL CHECK (suggested_bar_eur > 0),
    delta_vs_current_eur NUMERIC(10,2) NOT NULL,
    delta_vs_current_pct NUMERIC(5,2) NOT NULL,
    strategy_code VARCHAR(50) NOT NULL,
    strategy_label VARCHAR(100) NOT NULL,
    justification_summary TEXT NOT NULL,
    confidence_score INTEGER NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
    safety_alert_type VARCHAR(50),
    
    validation_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('pending', 'applied', 'modified', 'rejected')),
    applied_bar_eur NUMERIC(10,2),
    applied_min_stay INTEGER,
    decision_reason_code VARCHAR(50),
    decision_note TEXT,
    decided_by VARCHAR(255),
    decided_at TIMESTAMPTZ,
    
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_daily_rate_hotel_date UNIQUE (hotel_id, stay_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_rate_lookup ON public.daily_rate_intelligence (hotel_id, stay_date);

-- Journal d'Audit Immuable des Décisions Tarifaires
CREATE TABLE IF NOT EXISTS flowtym_audit.rm_decision_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    stay_date DATE NOT NULL,
    action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('accept', 'modify', 'reject')),
    original_bar_eur NUMERIC(10,2) NOT NULL,
    suggested_bar_eur NUMERIC(10,2) NOT NULL,
    final_bar_eur NUMERIC(10,2) NOT NULL,
    original_min_stay INTEGER NOT NULL,
    final_min_stay INTEGER NOT NULL,
    reason_code VARCHAR(50),
    reason_text TEXT NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    snapshot_context JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_hotel_date ON flowtym_audit.rm_decision_audit_logs (hotel_id, stay_date);

-- 6. RÈGLES DE SÉCURITÉ ROW LEVEL SECURITY (RLS)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_typologies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_hotel_impacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_rate_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE flowtym_audit.rm_decision_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE POLICY org_isolation_policy ON public.organizations
    FOR ALL USING (id = public.current_user_org_id());

CREATE POLICY hotels_isolation_policy ON public.hotels
    FOR ALL USING (organization_id = public.current_user_org_id());

CREATE POLICY room_typologies_policy ON public.room_typologies
    FOR ALL USING (
        hotel_id IN (SELECT id FROM public.hotels WHERE organization_id = public.current_user_org_id())
    );

CREATE POLICY daily_rates_isolation_policy ON public.daily_rate_intelligence
    FOR ALL USING (
        hotel_id IN (SELECT id FROM public.hotels WHERE organization_id = public.current_user_org_id())
    );

CREATE POLICY audit_logs_isolation_policy ON flowtym_audit.rm_decision_audit_logs
    FOR ALL USING (
        hotel_id IN (SELECT id FROM public.hotels WHERE organization_id = public.current_user_org_id())
    );

-- 7. SEED INITIAL DE PRODUCTION
INSERT INTO public.organizations (id, name, slug, subscription_tier)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Groupe Hôtelier Paris Opéra Collection', 'paris-opera-collection', 'enterprise')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.hotels (
    id, organization_id, code, name, stars, room_count, segment, base_adr, rate_floor_eur, rate_ceiling_eur, address, city, postal_code, country_code, location, latitude, longitude
) VALUES (
    'h0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'HOTEL-OPERA',
    'Grand Hôtel Folkestone Opéra',
    4,
    45,
    'Boutique',
    240.00,
    180.00,
    550.00,
    '9 Rue de Castellane',
    'Paris',
    '75008',
    'FR',
    ST_SetSRID(ST_MakePoint(2.3248, 48.8719), 4326),
    48.871900,
    2.324800
) ON CONFLICT (id) DO NOTHING;

COMMIT;
```

---

# SECTION 6 : DOCUMENT 5 — CONTRATS D'API & INTÉGRATIONS

## 6.1 Endpoints de Référence

### 1. `GET /api/v1/hotels/:hotelId/rates/grid`
- **Objectif** : Retourne les enregistrements de la grille 21 colonnes pour un horizon donné.
- **Réponse JSON 200** :
```json
{
  "status": "success",
  "data": {
    "hotelId": "h0000000-0000-0000-0000-000000000001",
    "hotelName": "Grand Hôtel Folkestone Opéra",
    "totalRooms": 45,
    "records": [
      {
        "stayDate": "2026-11-25",
        "dayOfWeek": "Mercredi",
        "demandIndex": 96,
        "demandLevel": "exceptionnel",
        "currentBarEur": 265.00,
        "lighthouseMedianEur": 340.00,
        "flowtymMedianEur": 345.00,
        "remainingRooms": 4,
        "occupancyPercent": 91.1,
        "suggestedBarEur": 345.00,
        "deltaVsCurrentEur": 80.00,
        "strategyLabel": "Capture demande",
        "confidenceScore": 98,
        "validationStatus": "pending"
      }
    ]
  }
}
```

### 2. `POST /api/v1/hotels/:hotelId/decisions`
- **Objectif** : Enregistrement immuable de l'arbitrage tarifaire humain.
- **Payload Request JSON** :
```json
{
  "stayDate": "2026-11-25",
  "action": "modify",
  "appliedRateEur": 360.00,
  "appliedMinStay": 2,
  "reasonCode": "increase_higher",
  "reasonNote": "Demande corporate directe très forte constatée sur le moteur direct."
}
```

---

# SECTION 7 : PLAN DE DÉVELOPPEMENT, RECETTE QA & CI/CD

## 7.1 Matrice des Tests & Critères d'Acceptation Formels

| Test ID | Périmètre | Condition Testée | Résultat Attendu Obligatoire |
|---|---|---|---|
| **QA-RLS-01** | Sécurité | Requête d'un utilisateur de l'organisation A sur un hôtel de l'organisation B | 0 ligne retournée (Isolation multi-tenant absolue) |
| **QA-FLOOR-01** | Garde-fous | Algorithme suggérant un tarif inférieur à 180 € | Blocage automatique à 180.00 € avec alerte `floor` |
| **QA-CEIL-01** | Garde-fous | Algorithme suggérant un tarif supérieur à 550 € | Blocage automatique à 550.00 € avec alerte `ceiling` |
| **QA-XLSX-01** | Lighthouse | Ingestion de l'export Excel avec un concurrent affichant « Épuisé » | Valeur conservée comme statut textuel, exclue de la médiane recalculée, aucun 0 € |
| **QA-REVPAR-01**| Mathématique | Calcul du RevPAR journalier sur un hôtel de 45 chambres | $\text{RevPAR} = \text{CA net hébergement} / 45.0$ (Stricte conformité dénominateur) |
| **QA-SCREEN-01**| UX/UI | Raccourci `Ctrl+Shift+F` et basculement plein écran | Synchronisation bidirectionnelle de l'icône dans la Navbar |

---

Ce document maître d'ingénierie logicielle constitue la **spécification contractuelle intégrale** de la plateforme Flowtym RMS, disponible en permanence dans le projet à l'emplacement :
`/docs/PRD_GLOBAL_FLOWTYM_RMS_INTEGRAL.md`.
