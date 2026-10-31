# INSTRUCTIONS DE DÉVELOPPEMENT — FLOWTYM EVENT INTELLIGENCE

Tu dois concevoir et développer une véritable application SaaS professionnelle nommée Flowtym Event Intelligence, destinée à devenir une référence en matière de recherche et d'intelligence événementielle pour l'hôtellerie.

Le PRD complet constitue la spécification fonctionnelle de référence.

## 1. Compréhension du projet

Il ne s'agit pas de créer un simple calendrier événementiel.

Il s'agit de créer une plateforme capable de rechercher, découvrir, vérifier, qualifier, analyser et anticiper les événements susceptibles d'influencer la demande hôtelière dans n'importe quelle ville ou pays.

L'application doit être conçue pour fonctionner à l'échelle internationale et évoluer vers une véritable plateforme d'Event Intelligence.

## 2. Design et frontend

Le frontend est une priorité absolue.

Utilise la capture d'écran fournie comme référence pour la vue calendrier.

Je veux une interface :

- Moderne.
- Élégante.
- Premium.
- Minimaliste.
- Professionnelle.
- Intuitive.
- Fluide.
- Responsive.

Respecte l'identité visuelle Flowtym.

Utilise un fond gris très clair, des cartes blanches, des bordures discrètes, des coins arrondis, des ombres légères, une typographie moderne et une palette pastel.

Le violet Flowtym doit être utilisé pour les actions principales et les éléments de navigation actifs.

Le vert, l'orange et le rouge pastel doivent être utilisés pour les niveaux d'impact.

Ne surcharge pas les écrans.

L'interface doit permettre à un Revenue Manager de comprendre rapidement les événements prioritaires.

Le design doit être soigné jusque dans les détails : espacements, alignements, typographie, états hover, focus, chargement, erreurs, filtres, menus, tableaux et panneaux latéraux.

Ne te contente pas de créer une maquette statique.

## 3. Architecture technique

Utilise :

- React.
- TypeScript.
- Vite.
- Tailwind CSS.
- shadcn/ui.
- Supabase.
- PostgreSQL.
- Supabase Auth.
- Supabase RLS.
- Vercel.
- GitHub.

L'application doit être conçue pour être maintenable et évolutive.

Le frontend, la base de données et le moteur de collecte doivent être séparés.

Ne fais pas tourner un moteur de scraping permanent dans les fonctions serverless Vercel.

Prévois une architecture de workers pour les recherches, la collecte, la vérification et la déduplication.

## 4. Données

Toutes les données métier doivent être enregistrées dans Supabase.

Ne remplace pas la base de données par localStorage.

Ne crée pas de faux boutons.

Ne présente pas des données fictives comme des données réelles.

Ne simule pas le fonctionnement du moteur de recherche.

Les données de démonstration doivent être identifiées comme telles.

## 5. Intelligence événementielle

Le moteur doit pouvoir rechercher les événements dans une ville donnée, découvrir les sources locales, détecter les nouveaux événements, vérifier les informations et analyser leur pertinence hôtelière.

Chaque événement doit posséder ses sources, ses preuves, son niveau de confirmation, son historique et son score de confiance.

Les événements estimés doivent être clairement identifiés.

Le système ne doit jamais inventer des événements ou des dates pour remplir le calendrier.

## 6. Revenue Management

Le score RM doit être calculé à partir de critères explicites.

Il doit être propre à chaque hôtel.

Le score RM doit être distinct du score de confiance.

Chaque recommandation doit être justifiée.

Ne modifie jamais automatiquement les tarifs hôteliers.

## 7. Développement

Procède de manière structurée :

1. Analyse le PRD.
2. Définis l'architecture.
3. Construis le design system.
4. Développe les écrans.
5. Développe la base de données.
6. Implémente les fonctionnalités.
7. Connecte le frontend à Supabase.
8. Développe le moteur de recherche.
9. Ajoute les tests.
10. Déploie sur Vercel.

Ne supprime pas les exigences du PRD sans justification.

Si une fonctionnalité est trop complexe pour la première version, identifie-la clairement et propose une architecture permettant de l'intégrer ultérieurement.

## 8. Résultat attendu

Je veux une application réelle, élégante, fonctionnelle et prête à évoluer vers un SaaS commercialisable.

Le résultat doit être supérieur à un simple prototype visuel.

La qualité du frontend, la fiabilité des données, l'architecture technique et la pertinence des analyses sont des priorités.

L'objectif est de construire le moteur d'intelligence événementielle de Flowtym, et non une simple application de calendrier.
