# Guide Utilisateur & Configuration des Connecteurs — FLOWTYM REVENUE

## 1. Accès au Centre de Connectivité Universelle

Vous pouvez gérer les connecteurs PMS, Channel Manager et Rate Shopper depuis trois points d'entrée cohérents :
- **Planning Tarifaire** → onglet **`B. Paramètres du Planning (12 Domaines)`** → **`02. Connecteurs & API`**.
- **Module Connectivité** → sous-onglet **`Connecteurs Universels (PMS / CM / API)`**.
- **Paramètres** → section **`Intégrations & Connectivité`**.

---

## 2. Configurer un Connecteur D-EDGE CRS (Prioritaire)

1. Sélectionnez ou ajoutez le connecteur **D-EDGE CRS & Channel Manager**.
2. Renseignez :
   - **Code Hôtel D-EDGE** (ex. `H2258`).
   - **Engine ID** (optionnel selon l'environnement D-EDGE).
   - **Bearer Token / Clé API D-EDGE** et **Secret Signature Webhook (HMAC)** pour la vérification des notifications entrantes.
3. Choisissez le mode d'exécution :
   - **`sandbox_simulation`** : pour valider le mapping, les tests de lecture/écriture et les conflits sans impacter la distribution en production.
   - **`live_api`** : pour communiquer avec l'API ARI active de l'établissement (nécessite une URL d'endpoint et un jeton valide).
4. Enregistrez : les secrets sont chiffrés côté serveur (`AES-256-GCM`) et remplacés visuellement par `••••` + les 4 derniers caractères.
5. Exécutez les tests dédiés directement depuis la fiche connecteur :
   - **Test Connexion**
   - **Test Lecture (Pull)**
   - **Test Écriture (Push ARI)**
   - **Test Webhook (Sens 2)**

---

## 3. Configurer un PMS ou un autre Channel Manager

FLOWTYM supporte nativement :
- **PMS** : Opera / Opera Cloud (OHIP), Mews Commander, Protel, Cloudbeds, RoomRaccoon, Apaleo, Clock PMS, Medialog, API REST personnalisée.
- **Channel Managers** : D-EDGE CRS, SiteMinder, Cubilis, Vertical Booking, RoomCloud, Channex.io, Availpro, RateGain.
- **Rate Shoppers** : Lighthouse (OTA Insight), API Custom.

### Webhooks vs Polling périodique
- **Webhooks entrants (`POST /api/webhooks/external-ari`)** : recommandés pour les mises à jour quasi temps réel depuis D-EDGE, Opera OHIP, Mews ou Channex.
- **Polling périodique** : configurable sur `5`, `15`, `30` ou `60` minutes (`activeSyncMode`: `bidirectional`, `push_only`, `pull_only`, `webhook_plus_polling`). Utilisez le bouton **« Actualiser (Pull) »** dans le Planning pour déclencher un rapatriement immédiat.

---

## 4. Matrice de Mapping Chambres & Plans Tarifaires (Anti-Doublons)

1. Ouvrez **`B. Paramètres du Planning (12 Domaines)`** → **`04. Chambres & Mapping`**.
2. Dans l'éditeur **`RoomMappingEditor`**, associez chaque catégorie interne FLOWTYM à un ou plusieurs IDs externes sur chaque connecteur actif (ex. D-EDGE `DBL_STD` + Opera `STD`).
3. Marquez un mapping comme **Principal** par connecteur ; le système synchronise automatiquement `pmsRoomId` / `cmRoomId`.
4. **Protection anti-doublon** : l'interface et le serveur refusent d'attribuer le même code externe à deux chambres ou deux plans tarifaires distincts sur un même connecteur.

---

## 5. Importer un Fichier Excel / CSV D-EDGE Planning (Assistant 6 Étapes)

Depuis la barre d'outils du Planning Tarifaire (bouton **`Import Excel D-EDGE`**) ou depuis **`Paramètres du Planning` → `Import Excel D-EDGE`** :

1. **Étape 1 — Chargement** : déposez un fichier `.xlsx`, `.xls` ou `.csv` (ou téléchargez le modèle exemple D-EDGE contenant `Price (EUR)` et `Left for sale`).
2. **Étape 2 — Analyse structurelle** : vérification des colonnes détectées, plage de dates, onglets et liste des anomalies éventuelles (valeurs négatives, cellules non numériques, doublons).
3. **Étape 3 — Mapping & Modèles** : associez chaque libellé chambre/plan externe à une catégorie/plan interne ou activez la création automatique. Enregistrez vos règles sous forme de **modèle réutilisable**.
4. **Étape 4 — Prévisualisation Diff** : inspectez chaque changement (`Nouveau`, `Modifié`, `Inchangé`, `Rejeté`) avant toute modification de la base.
5. **Étape 5 — Confirmation explicite** : choisissez d'écraser ou non les tarifs existants et validez l'import transactionnel.
6. **Étape 6 — Rapport & Export** : consultez le bilan exact (tarifs mis à jour, stocks *Left for sale* appliqués, anomalies) et exportez le rapport CSV d'audit.

---

## 6. Exploitation Quotidienne du Planning Tarifaire

- **Horizons dynamiques** : `7j`, `15j`, `30j`, `90j`, `365j` et plage **Personnalisée** démarrant par défaut sur la date du jour, avec pagination par fenêtre de 31 colonnes pour préserver la fluidité sur 90/365 jours.
- **13 Vues métier** : *Par catégorie*, *Par plan*, *Par référence*, *Par canal*, *Chambre × Plan*, *Comparative*, *FLEX / NRF*, *Avec / Sans PDJ*, *Dérivés*, *Indépendants*, *Stock (Left for sale)*, *Restrictions*, *Statut Sync*.
- **Édition rapide inline** : double-cliquez sur un tarif ou un stock *Left for sale* dans la grille :
  - **`Entrée`** : enregistre et transmet vers le connecteur actif.
  - **`Shift + Entrée`** : enregistre localement dans FLOWTYM (`saved_local`) sans envoi immédiat.
  - **`Échap`** : annule l'édition.
- **Modification en masse avancée** : filtrez par **jours de la semaine** (`Lun`..`Dim`), ajustez un tarif (`%`, `€`, fixe) ou le **stock Left for sale**, ou **planifiez l'exécution** à une date/heure future.
- **Duplication chambre → chambre** : copiez les tarifs et restrictions d'une catégorie source vers une ou plusieurs catégories cibles avec un écart fixe en `€`.
- **Centre Sync, Planifications & Journaux Techniques** : contrôlez les modifications en attente (`saved_local`, `queued`, `failed`), relancez les erreurs, résolvez les conflits et filtrez les logs techniques par fournisseur, statut, date, chambre ou plan.
