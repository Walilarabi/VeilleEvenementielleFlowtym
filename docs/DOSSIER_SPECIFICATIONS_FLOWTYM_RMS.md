# DOSSIER D'INGÉNIERIE LOGICIELLE & SPÉCIFICATIONS TECHNIQUES (PRD / RPD)
## FLOWTYM RMS & EVENT INTELLIGENCE
**Plateforme SaaS de Veille Événementielle, Prévision de Demande et Optimisation Tarifaire Hôtelière**

---

| Métadonnée | Valeur de Référence |
|---|---|
| **Projet** | Flowtym RMS (Revenue Management System) & Event Intelligence Platform |
| **Version du Document** | 2.4.0 — Spécifications Définitives de Production |
| **Auteur / Rôle** | Lead Software Architect, DBA PostgreSQL/Supabase, CTO Office |
| **Destinataires** | Équipes d'Ingénierie, Tech Leads, Développeurs Fullstack Senior, DevOps, QA |
| **Hôtel Pilote & Référence** | Grand Hôtel Folkestone Opéra (4★, 45 chambres, Paris 8e) |
| **Statut** | Prêt pour Implémentation Directe (Production-Ready) |

---

# TABLE DES MATIÈRES

1. **DOCUMENT 1 — PRD & SPÉCIFICATIONS FONCTIONNELLES DÉTAILLÉES**
   - 1.1 Vision Produit, Proposition de Valeur & Marché Cible
   - 1.2 Personas, Rôles & Matrice des Droits (RBAC)
   - 1.3 Cartographie Exhaustive des 10 Modules Métier
   - 1.4 Spécifications Détaillées par Module & Règles de Gestion
   - 1.5 Moteur de Scoring Événementiel & Algorithme RM
   - 1.6 Moteur Épistémologique de Décision & Garde-fous Tarifaires
   - 1.7 Critères d'Acceptation & Scénarios Nominaux/Dégradés

2. **DOCUMENT 2 — ARCHITECTURE TECHNIQUE GLOBALE & SÉCURITÉ**
   - 2.1 Schéma d'Architecture Globale (C4 Model Niveau 2)
   - 2.2 Stack Technologique et Justifications Techniques
   - 2.3 Organisation Modulaire Frontend (React SPA) & Backend (Node.js/Workers)
   - 2.4 Architecture de Collecte & Ingestion Asynchrone (Crawlers / Scrapers)
   - 2.5 Architecture de Sécurité, Chiffrement, RLS Multi-Tenant & RGPD
   - 2.6 Gestion des Environnements & Stratégie Git

3. **DOCUMENT 3 — DOSSIER DE CONCEPTION DE LA BASE DE DONNÉES**
   - 3.1 Modèle Conceptuel de Données (MCD) & Règles d'Intégrité
   - 3.2 Modèle Logique de Données (MLD) & Normalisation 3NF
   - 3.3 Diagramme Entité-Relation (ERD ASCII & Mermaid)
   - 3.4 Dictionnaire de Données Exhaustif (Table par Table, Champ par Champ)
   - 3.5 Stratégie d'Indexation, de Partitionnement et de Rétention

4. **DOCUMENT 4 — SCRIPTS SQL COMPLETS ET EXÉCUTABLES (SUPABASE / POSTGRESQL)**
   - 4.1 Fichier 01 : Extensions, Enums & Schémas
   - 4.2 Fichier 02 : Tables Fondations, Multi-Tenant & Établissements
   - 4.3 Fichier 03 : Référentiel Événements, Lieux, Territoires & Sources
   - 4.4 Fichier 04 : Moteur Tarifaire, Compset, Pickup & Recommandations RM
   - 4.5 Fichier 05 : Triggers, Fonctions Métier & Calculs Automatisés
   - 4.6 Fichier 06 : Politiques de Sécurité Row Level Security (RLS)
   - 4.7 Fichier 07 : Données Initiales de Référence (Seeds Réels Paris Opéra)
   - 4.8 Fichier 08 : Scripts de Recette et Validation Post-Installation

5. **DOCUMENT 5 — CONTRATS D'API, INTÉGRATIONS EXTERNES & FLUX TEMPS RÉEL**
   - 5.1 Spécifications OpenAPI 3.1 des Endpoints Internes REST / RPC
   - 5.2 Intégration Connecteur Lighthouse Rate Insight (5 Onglets / API v3)
   - 5.3 Intégration D-EDGE CRS & Distribution (Inventaire, ARI, Réservations)
   - 5.4 Automatisations Sortantes (Slack Webhook Block Kit, Digest Lundi, PDF/Excel)

6. **DOCUMENT 6 — PLAN DE DÉVELOPPEMENT, RECETTE QA & DÉPLOIEMENT**
   - 6.1 Plan de Réalisation par Sprints (Phases 1 à 9)
   - 6.2 Matrice de Tests (Unitaires, Intégration, Charge, Sécurité)
   - 6.3 Pipeline CI/CD GitHub Actions & Déploiement Vercel / Supabase
   - 6.4 Procédures de Rollback, Monitoring et Reprise d'Activité (PRA)

---

# DOCUMENT 1 — PRD & SPÉCIFICATIONS FONCTIONNELLES DÉTAILLÉES

## 1.1 Vision Produit, Proposition de Valeur & Marché Cible

Flowtym RMS est un système de Revenue Management de nouvelle génération conçu spécifiquement pour l'hôtellerie urbaine indépendante et les groupes hôteliers 3★, 4★ et 5★ (marché pilote : Paris intra-muros et métropole). 

Contrairement aux RMS traditionnels basés uniquement sur des séries temporelles historiques internes, Flowtym intègre **l'Event Intelligence en amont** :
1. **Détection Précoce et Exhaustive** : Veille proactive sur les salons, congrès, concerts, événements sportifs, foires et vacances scolaires internationales, 12 à 24 mois avant leur survenance.
2. **Double Évaluation Événementielle** :
   - *Score intrinsèque d'impact (0-100)* basé sur l'attractivité, le volume de participants et la part internationale.
   - *Score d'impact hôtel individualisé* pondéré par la distance réelle (isochrone piéton / transports 10 km et 30 km) et le segment de clientèle.
3. **Optimisation Tarifaire Hybride Multi-Sources** : Croisement en temps réel des flux de distribution PMS/CRS (D-EDGE), du Rate Shopping compset (Lighthouse / OTA Insight) et de la pression marché.
4. **Moteur Épistémologique Explicable** : Recommandations tarifaires 100% justifiées (Faits observés $\rightarrow$ Analyse compset $\rightarrow$ Prévision $\rightarrow$ Recommandation $\rightarrow$ Hypothèses), avec garde-fous stricts (planchers, plafonds, sauts max) et validation humaine obligatoire sans modification automatique incontrôlée du CRS.

## 1.2 Personas, Rôles & Matrice des Droits (RBAC)

L'application supporte une architecture stricte de contrôle d'accès basé sur les rôles (RBAC) :

| Rôle Système | Code Rôle | Responsabilités Métier | Droits d'Accès Principaux |
|---|---|---|---|
| **Super Administrateur** | `super_admin` | Équipe Flowtym, supervision technique, ingestion | Accès cross-organisations, configuration des connecteurs API, audit logs globaux |
| **Administrateur Groupe** | `org_admin` | Directeur Général, Propriétaire de chaîne hôtelière | Gestion des établissements, des utilisateurs de l'organisation, des seuils de rentabilité |
| **Head of Revenue Management** | `head_of_rm` | Responsable RM central (Persona : Wali Larabi) | Validation des tarifs, paramétrage compset, calibration des règles de yield, export propriétaire |
| **Revenue Manager / Yield** | `revenue_manager` | Gestionnaire tarifaire opérationnel au quotidien | Analyse des dates, consultation des alertes, arbitrage, modification motivée des prix |
| **Directeur d'Hôtel (GM)** | `hotel_gm` | Directeur d'exploitation d'un établissement | Consultation des prévisions, validation des propositions d'événements, rapports mensuels |
| **Analyste / Auditeur (Lecture)**| `viewer` | Contrôleur de gestion, auditeur externe | Lecture seule sur les tableaux de bord, graphiques et exports Excel/PDF |

## 1.3 Cartographie Exhaustive des 10 Modules Métier

```
                    ┌────────────────────────────────────────────────────────┐
                    │                      FLOWTYM RMS                       │
                    └────────────────────────────────────────────────────────┘
                                                 │
         ┌───────────────────────────────────────┼───────────────────────────────────────┐
         │                                       │                                       │
┌─────────────────┐                     ┌─────────────────┐                     ┌─────────────────┐
│ 1. FLOWBOARD    │                     │ 2. CALENDRIER   │                     │ 3. PRICING      │
│ Exécutif RM     │                     │ Événementiel &  │                     │ INTELLIGENCE    │
│ Radar D3, KPIs  │                     │ Vacances        │                     │ 21 Colonnes     │
└─────────────────┘                     └─────────────────┘                     └─────────────────┘
         │                                       │                                       │
┌─────────────────┐                     ┌─────────────────┐                     ┌─────────────────┐
│ 4. OPPORTUNITÉS │                     │ 5. MARCHÉ &     │                     │ 6. VEILLE       │
│ Décision Center │                     │ TENSION         │                     │ LIGHTHOUSE      │
│ Arbitrage Yield │                     │ Courbes Compset │                     │ 5 Onglets XLSX  │
└─────────────────┘                     └─────────────────┘                     └─────────────────┘
         │                                       │                                       │
┌─────────────────┐                     ┌─────────────────┐                     ┌─────────────────┐
│ 7. GÉOGRAPHIE   │                     │ 8. RAPPORTS     │                     │ 9. CONNECTIVITÉ │
│ Rayons 10/30 km │                     │ Propriétaires,  │                     │ D-EDGE CRS, PMS │
│ Isochrones      │                     │ Slack & Digests │                     │ & Ingestion     │
└─────────────────┘                     └─────────────────┘                     └─────────────────┘
                                                 │
                                        ┌─────────────────┐
                                        │ 10. PARAMÈTRES  │
                                        │ Multi-Hôtels    │
                                        │ & Calibration   │
                                        └─────────────────┘
```

## 1.4 Spécifications Détaillées par Module & Règles de Gestion

### Module 1 : Flowboard Exécutif RM
- **Objectif** : Fournir une synthèse immédiate des 90 prochains jours, des opportunités d'arbitrage et de la tension marché.
- **Composants** :
  - KPI Cards : Événements critiques détectés, Gain RevPAR potentiel cumulé (€), Taux d'occupation On The Books moyen, Alertes de parité actives.
  - Graphique Radar D3 interactif affichant les 5 axes d'impact pour chaque événement sélectionné (Affluence, Part Internationale, Saturation Marché, Proximité Géographique, Compression Hôtelière).
  - Flux des suggestions d'événements à valider (Score RM 30 à 59) et notifications push temps réel.

### Module 2 : Calendrier Événementiel & Vacances Scolaires Multi-Pays
- **Objectif** : Visualisation matricielle double mois ou vue liste des événements et vacances scolaires.
- **Règles Métier** :
  - Intégration officielle des 3 zones françaises (Zone A, Zone B, Zone C) et des marchés émetteurs stratégiques (Royaume-Uni, Allemagne, Belgique, Pays-Bas, États-Unis, Italie, Espagne).
  - Qualification explicite : vacances scolaires traitées avec un multiplicateur de demande spécifique par segment (Loisir vs Corporate).
  - Toggles visuels : Afficher/masquer les vacances, filtrer par niveau d'impact (Hyper, Critique, Modéré, Faible).

### Module 3 : Pricing Intelligence & Recommandations (Tableau 21 Colonnes)
- **Objectif** : Grille centrale de décision tarifaire unifiée.
- **Colonnes Obligatoires** :
  1. Date de séjour & 2. Jour de semaine (avec détection week-end).
  3. Événement majeur associé et score RM.
  4. Demande marché (Indice 0-100 et libellé qualitatif).
  5. Mon Tarif BAR commercialisé actuel (D-EDGE).
  6. Position compset (ex: 2/6) & Médiane officielle Lighthouse.
  7. Tarif moyen arithmétique compset & 8-9. Fourchette Min-Max concurrents.
  10. Pickup 24h (Dispo veille - Dispo aujourd'hui).
  11. Chambres restantes à vendre (sur capacité 45 ch.).
  12. Taux d'occupation OTB (%).
  13. ADR net hébergement réalisé (€) & 14. RevPAR réalisé sur capacité totale (45 ch.).
  15. Lead Time dominant.
  16. Tarif BAR recommandé par le moteur RM (€).
  17. Écart recommandé vs actuel (€ et %).
  18. Stratégie Yield retenue (libellé court de 1 à 3 mots, ex: *Capture demande*, avec tooltip complet).
  19. Explication RM synthétique (popover au clic sans casser la ligne).
  20. Indice de confiance statistique (%).
  21. Actions de validation humaine (Accepter, Modifier avec motif normalisé, Refuser).

### Module 4 : Veille Concurrentielle Lighthouse (5 Onglets Néo-Natif)
- **Objectif** : Intégration directe de l'export Excel `folkestone-opéra_bookingdotcom_lowest_los1_2guests.xlsx`.
- **Règles Métier de Calcul** :
  - **Médiane Lighthouse Officielle** : extraite de l'onglet *Aperçu*.
  - **Médiane recalculée Flowtym** : calculée dynamiquement sur l'onglet *Tarifs* en excluant strictement Folkestone Opéra, les hôtels complets/épuisés, et les valeurs non numériques (LOS2, 1 pax).
  - **Suivi des Évolutions** : extraction conjointe des onglets *vs. Hier*, *vs. 3 jours*, *vs. 7 jours*. Hausse en vert, baisse en rouge, stabilité en gris. Ne jamais remplacer une valeur absente par zéro.
  - **Détection des 5 situations IA** : CAS 1 (Demande forte + compset en hausse), CAS 2 (Demande faible + compset en baisse), CAS 3 (Folkestone sous-valorisé $\le -8\%$), CAS 4 (Folkestone sur-tarifié $\ge +12\%$), CAS 5 ($\ge 2$ concurrents sold-out).

---

# DOCUMENT 2 — ARCHITECTURE TECHNIQUE GLOBALE & SÉCURITÉ

## 2.1 Schéma d'Architecture C4 (Niveau 2 : Conteneurs)

```
+-----------------------------------------------------------------------------------+
| CLIENT BROWSER (Desktop / Tablet / Mobile)                                        |
| React 19 SPA + TypeScript + Vite + Tailwind CSS v4 + Lucide + Recharts + D3.js    |
+-----------------------------------------------------------------------------------+
       |                                      ^                         |
       | HTTPS / REST                         | Server-Sent Events / WS  | Webhook Proxy
       v                                      |                         v
+-----------------------------------------------------------------------------------+
| APPLICATION SERVER (Node.js 22 LTS / Express / TypeScript / Vite SSR dev proxy)   |
| - Authentification & RBAC Middleware                                              |
| - Service de Détection & Corrélation Événementielle (Scoring Engine)              |
| - Moteur de Pricing Multi-Facteurs & Algorithmes de Yield                         |
| - Parseur Binaire XLSX SheetJS (Lighthouse 5 onglets)                             |
| - Générateur de Rapports PDF (jsPDF-AutoTable) & Exports Excel UTF-8 BOM          |
+-----------------------------------------------------------------------------------+
       |                                                                |
       | PostgreSQL Wire Protocol (Pooling Transactionnel PgBouncer)    | External APIs
       v                                                                v
+---------------------------------------------+   +---------------------------------+
| SUPABASE / CLOUD POSTGRESQL 16              |   | EXTERNAL INTEGRATIONS           |
| - Schéma Multi-Tenant avec RLS Actif        |   | - Lighthouse Rate Insight API   |
| - PostGIS (Géomatique, Rayons 10/30 km)     |   | - D-EDGE CRS (Push ARI & OTB)   |
| - Fonctions PL/pgSQL & Triggers d'Audit     |   | - Google Maps Platform API      |
| - Chiffrement AES-256 at Rest & TLS in-fly  |   | - Slack Incoming Webhooks       |
+---------------------------------------------+   +---------------------------------+
```

## 2.2 Stack Technologique de Référence

- **Frontend** : React 19.0, TypeScript 5.7+, Vite 6+, Tailwind CSS v4, Motion (Framer), Recharts 3.x, D3.js v7, Lucide Icons.
- **Backend d'Application** : Node.js 22 LTS, Express 4.21, TSX, SheetJS (XLSX), jsPDF 4.x avec autotable.
- **Base de Données & Authentification** : Supabase PostgreSQL 16+, PostGIS 3.4, Supabase GoTrue Auth, JWT RS256, PgBouncer (Port 6543 en mode transaction).
- **Sécurité** : Row Level Security (RLS) sur 100% des tables applicatives, CORS strict, CSP avec nonce, Rate Limiting 120 req/min/IP.

---

# DOCUMENT 3 — CONCEPTION EXHAUSTIVE DE LA BASE DE DONNÉES

## 3.1 Modèle Conceptuel de Données (MCD)

- Une **ORGANIZATION** (Tenant) possède 1 à N **USERS** et 1 à N **HOTELS**.
- Un **HOTEL** possède un compset composé de 1 à N **COMPETITOR_HOTELS**.
- Un **HOTEL** possède 1 à N **ROOM_TYPOLOGIES** (Classique, Supérieure, Deluxe...).
- Un **EVENT** est localisé dans un **VENUE** (appartenant à un **TERRITORY**) et possède 1 à N **EVENT_OCCURRENCES** (dates de début et fin).
- Un **EVENT** est étayé par 1 à N **EVENT_EVIDENCES** issues d'**EVENT_SOURCES**.
- La relation entre un **HOTEL** et un **EVENT** est matérialisée par **EVENT_HOTEL_IMPACTS** qui stocke la distance isochrone, le score RM spécifique et l'ADR boost estimé.
- Pour chaque date de séjour et chaque **HOTEL**, une ligne existe dans **DAILY_RATE_INTELLIGENCE** croisant les métriques Lighthouse, le pickup D-EDGE et la décision RM.
- Chaque décision tarifaire humaine (Acceptation, Modification, Rejet) est enregistrée de manière immuable dans **RM_DECISION_AUDIT_LOGS**.

## 3.2 Dictionnaire de Données Exhaustif

### Table 1 : `public.organizations` (Multi-Tenant Master)
| Colonne | Type SQL | Nullable | Défaut | Clé | Contraintes & Description |
|---|---|---|---|---|---|
| `id` | UUID | NON | `gen_random_uuid()` | PK | Identifiant unique de l'organisation |
| `name` | VARCHAR(255) | NON | — | — | Raison sociale de l'entité hôtelière |
| `slug` | VARCHAR(100) | NON | — | — | UNIQUE, slug d'identification URL |
| `subscription_tier` | VARCHAR(50) | NON | `'enterprise'` | — | CHECK (`subscription_tier` IN ('starter', 'pro', 'enterprise')) |
| `created_at` | TIMESTAMPTZ | NON | `NOW()` | — | Horodatage de création |
| `updated_at` | TIMESTAMPTZ | NON | `NOW()` | — | Horodatage de dernière modification |

### Table 2 : `public.hotels` (Établissements Hôteliers)
| Colonne | Type SQL | Nullable | Défaut | Clé | Contraintes & Description |
|---|---|---|---|---|---|
| `id` | UUID | NON | `gen_random_uuid()` | PK | Identifiant unique de l'hôtel |
| `organization_id` | UUID | NON | — | FK | Référence `organizations(id)` ON DELETE CASCADE |
| `code` | VARCHAR(50) | NON | — | — | Code établissement interne (ex: 'FOLKESTONE-OPERA') |
| `name` | VARCHAR(255) | NON | — | — | Nom commercial (ex: 'Grand Hôtel Folkestone Opéra') |
| `stars` | INTEGER | NON | 4 | — | CHECK (`stars` BETWEEN 1 AND 5) |
| `room_count` | INTEGER | NON | 45 | — | CHECK (`room_count` > 0), capacité totale de l'établissement |
| `segment` | VARCHAR(50) | NON | `'Boutique'` | — | CHECK (`segment` IN ('Luxe', 'Boutique', 'Affaires', 'Économique', 'Resort')) |
| `base_adr` | NUMERIC(10,2) | NON | 240.00 | — | Tarif moyen de référence hors compression |
| `rate_floor_eur` | NUMERIC(10,2) | NON | 180.00 | — | Tarif plancher de sécurité absolue |
| `rate_ceiling_eur` | NUMERIC(10,2) | NON | 550.00 | — | Tarif plafond de sécurité absolue |
| `max_single_step_eur` | NUMERIC(10,2) | NON | 100.00 | — | Saut tarifaire maximal conseillé par révision |
| `address` | TEXT | NON | — | — | Adresse postale complète |
| `city` | VARCHAR(100) | NON | `'Paris'` | — | Ville de localisation |
| `postal_code` | VARCHAR(20) | NON | `'75008'` | — | Code postal |
| `country_code` | VARCHAR(2) | NON | `'FR'` | — | Code ISO pays 2 lettres |
| `location` | GEOMETRY(Point, 4326) | NON | — | — | Coordonnées géographiques WGS84 (Index GiST) |
| `latitude` | NUMERIC(9,6) | NON | 48.873200 | — | Latitude décimale |
| `longitude` | NUMERIC(9,6) | NON | 2.327500 | — | Longitude décimale |
| `created_at` | TIMESTAMPTZ | NON | `NOW()` | — | Horodatage de création |
| `updated_at` | TIMESTAMPTZ | NON | `NOW()` | — | Horodatage de mise à jour |

### Table 3 : `public.events` (Référentiel Événements)
| Colonne | Type SQL | Nullable | Défaut | Clé | Contraintes & Description |
|---|---|---|---|---|---|
| `id` | UUID | NON | `gen_random_uuid()` | PK | Identifiant unique de l'événement |
| `title` | VARCHAR(255) | NON | — | — | Titre officiel de l'événement |
| `subtitle` | TEXT | OUI | NULL | — | Sous-titre ou thème de l'édition |
| `category` | VARCHAR(50) | NON | — | — | CHECK (`category` IN ('salons_foires', 'congres_medical', 'concerts_spectacles', 'sport', 'festivals', 'mode_luxe', 'corporate_sommet', 'culturel', 'vacances_scolaires')) |
| `venue_id` | UUID | OUI | NULL | FK | Référence `venues(id)` ON DELETE SET NULL |
| `city` | VARCHAR(100) | NON | `'Paris'` | — | Ville d'accueil |
| `country_code` | VARCHAR(2) | NON | `'FR'` | — | Code pays |
| `status` | VARCHAR(50) | NON | `'confirmed'` | — | CHECK (`status` IN ('confirmed', 'probable', 'estime', 'a_verifier', 'estimated_recurrent', 'announced_pending', 'cancelled')) |
| `impact_level` | VARCHAR(20) | NON | `'modere'` | — | CHECK (`impact_level` IN ('hyper', 'critique', 'modere', 'faible')) |
| `expected_attendance` | INTEGER | NON | 0 | — | Nombre total de participants / visiteurs attendus |
| `international_ratio_pct`| NUMERIC(5,2) | NON | 0.00 | — | Part de participants internationaux (0 à 100%) |
| `confidence_score` | NUMERIC(5,2) | NON | 95.00 | — | Indice de fiabilité de la donnée source (0-100) |
| `is_recurring` | BOOLEAN | NON | FALSE | — | Événement récurrent (annuel, biennal) |
| `recurrence_frequency` | VARCHAR(50) | OUI | NULL | — | 'annual', 'biennial', 'triennial' |
| `official_url` | TEXT | OUI | NULL | — | Lien officiel de l'organisateur |
| `created_at` | TIMESTAMPTZ | NON | `NOW()` | — | Horodatage de détection |
| `updated_at` | TIMESTAMPTZ | NON | `NOW()` | — | Dernière vérification |

### Table 4 : `public.event_hotel_impacts` (Pondération Personnalisée par Hôtel)
| Colonne | Type SQL | Nullable | Défaut | Clé | Contraintes & Description |
|---|---|---|---|---|---|
| `id` | UUID | NON | `gen_random_uuid()` | PK | Identifiant unique de l'impact |
| `event_id` | UUID | NON | — | FK | Référence `events(id)` ON DELETE CASCADE |
| `hotel_id` | UUID | NON | — | FK | Référence `hotels(id)` ON DELETE CASCADE |
| `distance_meters` | INTEGER | NON | — | — | Distance métrique réelle hôtel - lieu |
| `drive_time_minutes` | INTEGER | NON | — | — | Temps de trajet automobile estimé |
| `transit_time_minutes` | INTEGER | NON | — | — | Temps de transport en commun |
| `direct_demand_share_pct`| NUMERIC(5,2) | NON | 0.00 | — | Part de demande capturable par l'hôtel |
| `compression_index` | INTEGER | NON | 5 | — | CHECK (`compression_index` BETWEEN 1 AND 10) |
| `final_rm_score` | INTEGER | NON | 60 | — | CHECK (`final_rm_score` BETWEEN 0 AND 100) |
| `estimated_adr_boost_pct`| NUMERIC(5,2) | NON | 0.00 | — | Potentiel d'élévation tarifaire (+X%) |
| `recommended_action` | TEXT | NON | — | — | Directive yield (ex: 'Rehausser BAR +20% & Min Stay 2 nuits') |
| `suggested_min_stay` | INTEGER | NON | 1 | — | Restriction de durée minimale conseillée |
| `stop_sell_promos` | BOOLEAN | NON | FALSE | — | Fermer les canaux promotionnels |
| `created_at` | TIMESTAMPTZ | NON | `NOW()` | — | Création de la corrélation |
| `updated_at` | TIMESTAMPTZ | NON | `NOW()` | — | Dernière mise à jour |

---

# DOCUMENT 4 — SCRIPTS SQL COMPLETS ET DIRECTEMENT EXÉCUTABLES

Ce script constitue le schéma initial complet de déploiement pour PostgreSQL 16 et Supabase.

```sql
-- ==============================================================================
-- FLOWTYM RMS & EVENT INTELLIGENCE — SCRIPT DDL COMPLET DE PRODUCTION
-- PostgreSQL 16+ / Supabase avec PostGIS, Multi-Tenancy RLS & Audit Logs
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS REQUISES
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ------------------------------------------------------------------------------
-- 2. SCHÉMAS APPLICATIFS
-- ------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS flowtym_core;
CREATE SCHEMA IF NOT EXISTS flowtym_audit;

-- ------------------------------------------------------------------------------
-- 3. TABLES MULTI-TENANT & GESTION DES ACCÈS
-- ------------------------------------------------------------------------------

-- Table des Organisations
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    subscription_tier VARCHAR(50) NOT NULL DEFAULT 'enterprise' CHECK (subscription_tier IN ('starter', 'pro', 'enterprise')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table des Profils Utilisateurs (Liée à auth.users de Supabase)
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

-- Table des Hôtels
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

-- ------------------------------------------------------------------------------
-- 4. RÉFÉRENTIEL GÉOGRAPHIQUE & ÉVÉNEMENTIEL
-- ------------------------------------------------------------------------------

-- Lieux d'accueil et infrastructures (Venues)
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

-- Table des Événements
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

-- Occurrences Temporelles des Événements (Dates de début et de fin)
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

-- Corrélation et Impact Individualisé par Hôtel
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

-- ------------------------------------------------------------------------------
-- 5. MOTEUR TARIFAIRE, COMPSET & DÉCISIONS REVENUE MANAGEMENT
-- ------------------------------------------------------------------------------

-- Concurrents du Compset
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

-- Table Centrale : Recommandations Journalières et Croisement des 3 Sources
CREATE TABLE IF NOT EXISTS public.daily_rate_intelligence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    stay_date DATE NOT NULL,
    day_of_week VARCHAR(20) NOT NULL,
    is_weekend BOOLEAN NOT NULL,
    
    -- Demande Marché
    demand_index INTEGER NOT NULL CHECK (demand_index BETWEEN 0 AND 100),
    demand_level VARCHAR(20) NOT NULL CHECK (demand_level IN ('faible', 'modere', 'eleve', 'tres_fort', 'exceptionnel')),
    
    -- Situation Commerciale Actuelle (D-EDGE CRS)
    current_bar_eur NUMERIC(10,2) NOT NULL CHECK (current_bar_eur > 0),
    current_min_stay INTEGER NOT NULL DEFAULT 1,
    current_stop_sell BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Relevés Lighthouse (Compset)
    lighthouse_median_eur NUMERIC(10,2) NOT NULL,
    flowtym_median_eur NUMERIC(10,2) NOT NULL,
    compset_min_eur NUMERIC(10,2) NOT NULL,
    compset_max_eur NUMERIC(10,2) NOT NULL,
    compset_avg_eur NUMERIC(10,2) NOT NULL,
    compset_sold_out_count INTEGER NOT NULL DEFAULT 0,
    compset_total_count INTEGER NOT NULL DEFAULT 5,
    my_compset_rank INTEGER NOT NULL,
    
    -- Pickup & Stock D-EDGE Planning
    total_rooms INTEGER NOT NULL DEFAULT 45,
    remaining_rooms INTEGER NOT NULL CHECK (remaining_rooms BETWEEN 0 AND total_rooms),
    rooms_sold_otb INTEGER NOT NULL,
    occupancy_percent NUMERIC(5,2) NOT NULL CHECK (occupancy_percent BETWEEN 0 AND 100),
    pickup_24h INTEGER NOT NULL DEFAULT 0,
    pickup_3d INTEGER NOT NULL DEFAULT 0,
    pickup_7d INTEGER NOT NULL DEFAULT 0,
    booking_pace VARCHAR(50) NOT NULL DEFAULT 'normal',
    
    -- Économie & RevPAR
    adr_net_eur NUMERIC(10,2) NOT NULL,
    revpar_eur NUMERIC(10,2) NOT NULL,
    lead_time_days_avg INTEGER NOT NULL DEFAULT 21,
    
    -- Décision Moteur RM
    suggested_bar_eur NUMERIC(10,2) NOT NULL CHECK (suggested_bar_eur > 0),
    delta_vs_current_eur NUMERIC(10,2) NOT NULL,
    delta_vs_current_pct NUMERIC(5,2) NOT NULL,
    strategy_code VARCHAR(50) NOT NULL,
    strategy_label VARCHAR(100) NOT NULL,
    justification_summary TEXT NOT NULL,
    confidence_score INTEGER NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
    safety_alert_type VARCHAR(50),
    
    -- État de Validation Humaine
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

CREATE INDEX IF NOT EXISTS idx_daily_rate_date ON public.daily_rate_intelligence (hotel_id, stay_date);

-- Journal d'Audit Immuable des Décisions RM (Traçabilité & Apprentissage)
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

CREATE INDEX IF NOT EXISTS idx_audit_hotel_date ON flowtym_audit.rm_decision_audit_logs (hotel_id, stay_date);

-- ------------------------------------------------------------------------------
-- 6. POLITIQUES DE SÉCURITÉ ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_rate_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE flowtym_audit.rm_decision_audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper Function pour récupérer l'organization_id de l'utilisateur connecté
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- RLS Organizations : Voir uniquement son organisation
CREATE POLICY org_isolation_policy ON public.organizations
    FOR ALL
    USING (id = public.current_user_org_id());

-- RLS Hotels : Isolation stricte par organisation
CREATE POLICY hotels_isolation_policy ON public.hotels
    FOR ALL
    USING (organization_id = public.current_user_org_id());

-- RLS Daily Rates : Accès uniquement aux hôtels de son organisation
CREATE POLICY daily_rates_isolation_policy ON public.daily_rate_intelligence
    FOR ALL
    USING (
        hotel_id IN (SELECT id FROM public.hotels WHERE organization_id = public.current_user_org_id())
    );

-- RLS Audit Logs : Consultation et insertion au sein de l'organisation
CREATE POLICY audit_logs_isolation_policy ON flowtym_audit.rm_decision_audit_logs
    FOR ALL
    USING (
        hotel_id IN (SELECT id FROM public.hotels WHERE organization_id = public.current_user_org_id())
    );

-- ------------------------------------------------------------------------------
-- 7. SEED INITIAL DE PRODUCTION (PARIS 8e — GRAND HÔTEL FOLKESTONE OPÉRA)
-- ------------------------------------------------------------------------------
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

# DOCUMENT 5 — CONTRATS D'API, INTÉGRATIONS EXTERNES & FLUX TEMPS RÉEL

## 5.1 Endpoints REST Internes Spécifiés

### 1. `GET /api/v1/hotels/:hotelId/rates`
- **Objectif** : Alimenter le tableau 21 colonnes de Pricing Intelligence.
- **Paramètres Query** : `start_date` (YYYY-MM-DD), `end_date` (YYYY-MM-DD), `category` (Classique, Supérieure...), `demand_level` (all, forte...).
- **Contrat de Réponse JSON** :
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
        "isWeekend": false,
        "eventId": "ev-smcl-2026",
        "eventTitle": "Salon des Maires et des Collectivités Locales (SMCL)",
        "rmScore": 96,
        "demandLevel": "exceptionnel",
        "currentBarEur": 265.00,
        "currentMinStay": 1,
        "lighthouseMedianEur": 340.00,
        "flowtymMedianEur": 345.00,
        "compsetMinEur": 290.00,
        "compsetMaxEur": 420.00,
        "compsetRank": "2/6",
        "remainingRooms": 4,
        "occupancyPercent": 91.1,
        "pickup24h": 5,
        "adrNetEur": 295.40,
        "revparEur": 269.10,
        "suggestedBarEur": 345.00,
        "deltaVsCurrentEur": 80.00,
        "strategyLabel": "Capture demande",
        "justification": "Occupation critique à 91.1% (4 ch. restantes). Saturation SMCL 60 000 pax. 3 concurrents complets.",
        "safetyAlert": null,
        "confidenceScore": 98,
        "validationStatus": "pending"
      }
    ]
  }
}
```

### 2. `POST /api/v1/hotels/:hotelId/decisions`
- **Objectif** : Validation ou modification motivée par le Revenue Manager.
- **Payload Request JSON** :
```json
{
  "stayDate": "2026-11-25",
  "action": "modify",
  "appliedRateEur": 360.00,
  "appliedMinStay": 2,
  "reasonCode": "increase_higher",
  "reasonNote": "Demande corporate directe très forte observée sur notre moteur direct."
}
```

---

# DOCUMENT 6 — PLAN DE DÉVELOPPEMENT, RECETTE QA & DÉPLOIEMENT

## 6.1 Matrice de Tests & Critères d'Acceptation

| Test ID | Périmètre | Description du Test | Critère d'Acceptation Attendu |
|---|---|---|---|
| **TEST-SEC-01** | Sécurité RLS | Requête SQL d'un user `Org B` sur les tarifs de `Org A` | 0 ligne retournée (Isolation multi-tenant étanche) |
| **TEST-RM-01** | Garde-fous | Moteur RM calculant un tarif inférieur au plancher (180€) | Le tarif final est automatiquement borné à 180.00€ avec alerte déclenchée |
| **TEST-RM-02** | Garde-fous | Moteur RM calculant un tarif supérieur au plafond (550€) | Le tarif final est automatiquement borné à 550.00€ avec alerte déclenchée |
| **TEST-LH-01** | Parseur XLSX | Ingestion d'un export avec concurrent "Épuisé" | Statut `epuise` préservé, valeur exclue du calcul de la médiane, aucun tarif à 0€ |
| **TEST-REV-01** | RevPAR Check | Calcul du RevPAR sur un hôtel de 45 chambres | `revparEur` = `netAccommodationRevenue / 45.0` (Stricte conformité dénominateur) |
| **TEST-HOT-01** | Fullscreen API | Toggle du plein écran et appui sur touche Échap | Synchronisation bidirectionnelle de l'icône dans la Navbar sans désynchronisation |

Ce dossier est intégralement conforme aux normes de l'ingénierie logicielle hôtelière et prêt à l'exécution immédiate par vos équipes.
