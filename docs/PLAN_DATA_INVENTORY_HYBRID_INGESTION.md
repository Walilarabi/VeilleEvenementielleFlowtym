# Chantier — Données & Inventaire : intégration hybride

Branche de travail : `feat/rms-data-inventory-hybrid-ingestion`
Branche de départ : `feat/rms-integral-cto-rebuild`

## Objectif produit

Refondre l'espace « Données & Inventaire » autour de deux rubriques distinctes :
1. **Intégration API** : trois lignes indépendantes — PMS, Channel Manager, Rate Shopper — chacune avec un catalogue fournisseur adapté, un formulaire de connexion propre au fournisseur, un état vérifié et un historique de synchronisation.
2. **Chargement manuel** : trois zones d'import indépendantes — PMS, Channel Manager, Rate Shopper — acceptant Excel et PDF, avec analyse, prévisualisation, mapping, validation et ingestion traçable.

Les trois sources ne sont pas obligatoires simultanément. Le moteur doit exploiter les données réellement disponibles et signaler les champs absents plutôt que les inventer.

## État initial observé

- La navigation « Données & Inventaire » pointe actuellement vers `SourcesCoverageView`.
- `HotelDataExcelUploadSection` contient déjà un import Excel Lighthouse et un import de planning PMS Topsys avec persistance Supabase.
- La table `integration_connections` existe déjà avec les familles `d_edge`, `lighthouse`, `pms`, `channel_manager`, `other`.
- `data_ingestion_jobs` existe pour tracer les imports.
- `HotelConnectivityHub` ne fait que lire les connexions et indique explicitement qu'aucun endpoint serveur de paramétrage des secrets / test réseau n'est déployé.
- Le serveur Express actuel ne contient pas de route d'administration des connecteurs.
- Le parsing PDF et l'import générique Channel Manager ne sont pas établis dans les services inspectés.

## Principes d'architecture

- Réutiliser `integration_connections`, `data_ingestion_jobs`, les services Lighthouse/PMS et les tables d'observations existantes avant d'ajouter un schéma.
- Ne jamais enregistrer les secrets API dans `settings`, le navigateur, les logs ou le dépôt. Stocker les secrets côté serveur dans un coffre adapté ; ne conserver en base qu'une référence opaque.
- Les statuts « connecté » et « synchronisé » exigent un vrai appel fournisseur réussi et une preuve horodatée.
- Les imports manuels sont étiquetés `imported`, avec fichier, hash, horodatage source, hôtel, provenance et métriques de rejet.
- Un PDF n'est importable automatiquement que si son texte/tableau est exploitable ; sinon proposer un mapping ou signaler le blocage.
- Normaliser les données PMS, Channel Manager et Rate Shopper dans les modèles communs sans écraser une observation plus fiable ou plus récente.
- Respecter RLS, RBAC, isolation organisation/hôtel, idempotence et audit.

## Lots de réalisation

### Lot 1 — UX et catalogue fournisseurs
- Refaire la page en deux rubriques : Intégration API / Chargement manuel.
- Trois lignes API : PMS, Channel Manager, Rate Shopper ; listes de fournisseurs filtrées par catégorie.
- Formulaires de credentials dynamiques selon le fournisseur, sans secret prérempli ni affiché après sauvegarde.
- Afficher statut réel, dernier succès, dernière erreur, fréquence et actions disponibles.
- Trois zones de dépôt Excel/PDF, avec sélection explicite de l'hôtel et de la source.

### Lot 2 — API sécurisée
- Inventorier les contrats officiels et les accès réellement disponibles pour chaque fournisseur.
- Implémenter les routes serveur authentifiées pour enregistrer/mettre à jour les connexions, tester, synchroniser et révoquer.
- Chiffrer/placer les secrets dans un coffre ; appliquer permissions minimales et rotation.
- Ne déclarer aucun connecteur prêt tant que le contrat et les identifiants de test ne sont pas validés.

### Lot 3 — Import manuel unifié
- Garder les parseurs existants Lighthouse et Topsys.
- Ajouter les formats/fournisseurs avec parseurs isolés et fixtures.
- Ajouter PDF (extraction texte/tableaux), mapping de colonnes, prévisualisation, anomalies et validation.
- Persister dans les tables normalisées existantes avec job d'ingestion, hash/idempotence et provenance.

### Lot 4 — Composition des données
- Construire une couche de disponibilité des données par hôtel/date/type de chambre/source.
- Fusionner uniquement les mesures comparables ; préserver les sources et snapshots.
- Distinguer valeur nulle, zéro, indisponible, inconnue, périmée et contradictoire.
- Exposer au RMS les données disponibles et la couverture, sans inventer de données manquantes.

## Critères d'acceptation

- L'utilisateur voit exactement les deux rubriques demandées.
- Les trois catégories API et les trois catégories de dépôt sont présentes et indépendantes.
- La liste de fournisseurs dépend du type de source.
- Aucun secret n'est lisible côté client après enregistrement.
- Aucun faux état « connecté », « testé » ou « synchronisé ».
- Les imports Excel/PDF disposent d'une prévisualisation et d'une validation avant écriture.
- Les imports sont idempotents et liés à l'hôtel / organisation.
- Les données importées conservent provenance, date de snapshot, devise/unité et statut de qualité.
- Tests unitaires des parseurs, tests d'intégration Supabase/RLS et tests de non-régression.
- Aucun changement de schéma live sans audit, migration revue et autorisation explicite.

## Points à confirmer avant activation fournisseur

- Fournisseurs réellement sous contrat et accès API disponibles pour le pilote.
- Documentation / version API et environnement sandbox de chaque fournisseur.
- Type de coffre de secrets disponible dans l'environnement de déploiement.
- Formats d'exports Excel/PDF réels à prendre en charge en priorité.
