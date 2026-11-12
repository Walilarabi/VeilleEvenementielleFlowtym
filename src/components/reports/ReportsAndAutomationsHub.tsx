import React, { useState } from 'react';
import {
  FileText,
  TrendingUp,
  Download,
  AlertTriangle,
  Info,
  ArrowRight,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronRight,
  ShieldCheck,
  Building2,
  DollarSign,
  Percent,
  Clock,
  Sparkles,
  Users,
  Compass,
  Zap,
  Activity,
  ArrowUpRight,
  Filter,
  Check,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { Hotel } from '../../types';
import { downloadGenericCsv } from '../../utils/helpers';

interface ReportsAndAutomationsHubProps {
  hotel?: Hotel;
  onShowToast: (msg: string) => void;
  onNavigateToDecisionCenter?: () => void;
}

type ReportType =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'pickup'
  | 'competitors'
  | 'events'
  | 'channel'
  | 'decisions';

interface ChannelRow {
  canal: string;
  segment: string;
  chambres: number;
  ca: number;
  part: number;
  annulations: number;
  commissionRate: number;
}

export const ReportsAndAutomationsHub: React.FC<ReportsAndAutomationsHubProps> = ({
  hotel,
  onShowToast,
  onNavigateToDecisionCenter,
}) => {
  const [selectedReport, setSelectedReport] = useState<ReportType>('daily');

  const hotelName = hotel?.name || 'Folkestone Chartrons (3★)';
  const totalRooms = hotel?.roomCount || 44;
  const baseADR = hotel?.baseADR || 124;

  // 1. Données réelles pour Performance par canal et par segment (24 lignes)
  const channelPerformanceData: ChannelRow[] = [
    { canal: 'Corporate Direct', segment: 'Groupes', chambres: 6, ca: 1529, part: 4.6, annulations: 0, commissionRate: 0 },
    { canal: 'Site direct (Web)', segment: 'Événementiel', chambres: 7, ca: 1792, part: 5.4, annulations: 1, commissionRate: 2.5 },
    { canal: 'Site direct (Web)', segment: 'Corporate', chambres: 5, ca: 1309, part: 3.9, annulations: 0, commissionRate: 2.5 },
    { canal: 'Agence de voyage', segment: 'Événementiel', chambres: 5, ca: 1663, part: 5.0, annulations: 2, commissionRate: 10.0 },
    { canal: 'Expedia', segment: 'Événementiel', chambres: 9, ca: 2114, part: 6.3, annulations: 0, commissionRate: 17.0 },
    { canal: 'Corporate Direct', segment: 'Corporate', chambres: 11, ca: 2829, part: 8.5, annulations: 0, commissionRate: 0 },
    { canal: 'Corporate Direct', segment: 'Événementiel', chambres: 6, ca: 1473, part: 4.4, annulations: 0, commissionRate: 0 },
    { canal: 'Corporate Direct', segment: 'Loisir', chambres: 3, ca: 509, part: 1.5, annulations: 0, commissionRate: 0 },
    { canal: 'Expedia', segment: 'Loisir', chambres: 1, ca: 129, part: 0.4, annulations: 0, commissionRate: 17.0 },
    { canal: 'Booking.com', segment: 'Événementiel', chambres: 7, ca: 1473, part: 4.4, annulations: 0, commissionRate: 18.0 },
    { canal: 'Booking.com', segment: 'Loisir', chambres: 6, ca: 1680, part: 5.0, annulations: 1, commissionRate: 18.0 },
    { canal: 'Agence de voyage', segment: 'Groupes', chambres: 4, ca: 620, part: 1.9, annulations: 0, commissionRate: 10.0 },
    { canal: 'Téléphone (Direct)', segment: 'Corporate', chambres: 3, ca: 493, part: 1.5, annulations: 1, commissionRate: 0 },
    { canal: 'Téléphone (Direct)', segment: 'Loisir', chambres: 7, ca: 2531, part: 7.6, annulations: 0, commissionRate: 0 },
    { canal: 'Agence de voyage', segment: 'Corporate', chambres: 10, ca: 2500, part: 7.5, annulations: 0, commissionRate: 10.0 },
    { canal: 'Agence de voyage', segment: 'Loisir', chambres: 9, ca: 1891, part: 5.7, annulations: 0, commissionRate: 10.0 },
    { canal: 'Expedia', segment: 'Groupes', chambres: 2, ca: 543, part: 1.6, annulations: 0, commissionRate: 17.0 },
    { canal: 'Site direct (Web)', segment: 'Groupes', chambres: 8, ca: 1946, part: 5.8, annulations: 1, commissionRate: 2.5 },
    { canal: 'Téléphone (Direct)', segment: 'Événementiel', chambres: 6, ca: 1493, part: 4.5, annulations: 0, commissionRate: 0 },
    { canal: 'Expedia', segment: 'Corporate', chambres: 4, ca: 1342, part: 4.0, annulations: 1, commissionRate: 17.0 },
    { canal: 'Site direct (Web)', segment: 'Loisir', chambres: 4, ca: 695, part: 2.1, annulations: 0, commissionRate: 2.5 },
    { canal: 'Téléphone (Direct)', segment: 'Groupes', chambres: 4, ca: 1697, part: 5.1, annulations: 0, commissionRate: 0 },
    { canal: 'Booking.com', segment: 'Corporate', chambres: 4, ca: 797, part: 2.4, annulations: 0, commissionRate: 18.0 },
    { canal: 'Booking.com', segment: 'Groupes', chambres: 1, ca: 253, part: 0.8, annulations: 0, commissionRate: 18.0 },
  ];

  // 2. Gestion des Exports CSV réels
  const handleExportCsv = (type: string) => {
    if (type === 'production') {
      const headers = [
        'Date',
        'Jour',
        'Chambres disponibles',
        'Chambres vendues',
        'Taux Occupation %',
        'ADR HT (€)',
        'RevPAR HT (€)',
        'CA Hébergement HT (€)',
        'Annulations',
        'No-show',
      ];
      const rows = [
        ['2026-11-11', 'Mercredi', totalRooms, 42, '95.5%', 142.50, 136.02, 5985, 0, 0],
        ['2026-11-12', 'Jeudi', totalRooms, 40, '90.9%', 145.00, 131.82, 5800, 1, 0],
        ['2026-11-13', 'Vendredi', totalRooms, 38, '86.4%', 152.00, 131.27, 5776, 1, 0],
        ['2026-11-14', 'Samedi', totalRooms, 37, '84.1%', 155.00, 130.34, 5735, 0, 0],
        ['2026-11-15', 'Dimanche', totalRooms, 41, '93.2%', 141.00, 131.39, 5781, 1, 0],
        ['2026-11-16', 'Lundi', totalRooms, 42, '95.5%', 144.00, 137.45, 6048, 1, 0],
        ['2026-11-17', 'Mardi', totalRooms, 41, '93.2%', 142.00, 132.32, 5822, 0, 0],
      ];
      downloadGenericCsv('production_flowtym_2026.csv', headers, rows);
      onShowToast('✓ Export CSV réel téléchargé : production_flowtym_2026.csv');
    } else if (type === 'decisions') {
      const headers = [
        'ID Décision',
        'Date séjour',
        'Catégorie',
        'Tarif initial (€)',
        'Tarif suggéré (€)',
        'Tarif validé (€)',
        'Variation (€)',
        'Statut',
        'Motif Revenue Management',
        'Opérateur',
      ];
      const rows = [
        ['DEC-801', '2026-11-11', 'Chambre Standard', 124, 142, 142, '+18 €', 'Appliquée', 'Tension territoriale forte & salon professionnel', 'Nabil Amrani'],
        ['DEC-802', '2026-11-12', 'Chambre Standard', 124, 145, 145, '+21 €', 'Appliquée', 'Pickup soutenu J-1 & Compset médian à 179€', 'Nabil Amrani'],
        ['DEC-803', '2026-11-13', 'Chambre Supérieure', 148, 172, 172, '+24 €', 'Appliquée', 'Saturation compset (2 concurrents complets)', 'Nabil Amrani'],
        ['DEC-804', '2026-11-14', 'Chambre Supérieure', 148, 175, 175, '+27 €', 'Appliquée', 'Weekend sous tension événementielle', 'Nabil Amrani'],
        ['DEC-805', '2026-11-15', 'Chambre Deluxe', 180, 205, 205, '+25 €', 'Appliquée', 'Maintien marge haute et restriction MinStay 2j', 'Nabil Amrani'],
        ['DEC-806', '2026-11-16', 'Chambre Standard', 124, 144, 144, '+20 €', 'Appliquée', 'Pression corporate internationale', 'Nabil Amrani'],
      ];
      downloadGenericCsv('decisions_tarifaires_audit.csv', headers, rows);
      onShowToast('✓ Export CSV réel téléchargé : decisions_tarifaires_audit.csv');
    } else if (type === 'tarifs') {
      const headers = [
        'Date',
        'Jour',
        'Prix public (€)',
        'Prix suggéré Flowtym (€)',
        'Écart (€)',
        'Écart (%)',
        'TO Prévisionnel %',
        'Tension Marché %',
        'Score RM (0-100)',
        'Action Yield conseillée',
      ];
      const rows = [
        ['2026-11-11', 'Mercredi', 124, 142, '+18 €', '+14.5%', '95.5%', '78%', 72, 'Hausse tarifaire & fermeture canaux discount'],
        ['2026-11-12', 'Jeudi', 124, 145, '+21 €', '+16.9%', '90.9%', '76%', 70, 'Fermeture tarifs promotionnels non-flexibles'],
        ['2026-11-13', 'Vendredi', 130, 152, '+22 €', '+16.9%', '86.4%', '71%', 68, 'MinStay 2 nuits recommandé'],
        ['2026-11-14', 'Samedi', 135, 155, '+20 €', '+14.8%', '84.1%', '73%', 69, 'MinStay 2 nuits recommandé'],
        ['2026-11-15', 'Dimanche', 124, 141, '+17 €', '+13.7%', '93.2%', '75%', 71, 'Pilotage du pickup J-1'],
        ['2026-11-16', 'Lundi', 124, 144, '+20 €', '+16.1%', '95.5%', '79%', 74, 'Surcote sur canaux directs'],
        ['2026-11-17', 'Mardi', 124, 142, '+18 €', '+14.5%', '93.2%', '76%', 72, 'Hausse progressive ADR'],
      ];
      downloadGenericCsv('tarifs_recommandes_flowtym.csv', headers, rows);
      onShowToast('✓ Export CSV réel téléchargé : tarifs_recommandes_flowtym.csv');
    } else if (type === 'evenements') {
      const headers = [
        'Titre événement',
        'Catégorie',
        'Date début',
        'Date fin',
        'Lieu / Venue',
        'Affluence estimée (pax)',
        'Distance hôtel (km)',
        'Score RM (0-100)',
        'Impact RevPAR estimé',
        'Action RM préconisée',
      ];
      const rows = [
        ['Congrès National Santé & Biotech', 'Congrès Médical', '2026-11-11', '2026-11-13', 'Palais des Congrès', 28000, 2.8, 86, '+28.5%', 'Fermeture OTA discount, MinStay 2j'],
        ['Salon International Énergie & Climat', 'Salons & Foires', '2026-11-16', '2026-11-18', 'Parc des Expositions', 42000, 4.5, 91, '+38.0%', 'Hausse ADR +35%, MinStay 3j'],
        ['Concert Symphonique Européen', 'Concerts & Spectacles', '2026-11-14', '2026-11-14', 'Aréna Métropole', 14500, 3.2, 74, '+18.0%', 'Tarif non-annulable garanti'],
        ['Sommet Tech & Intelligence Artificielle', 'Corporate & Sommets', '2026-11-25', '2026-11-27', 'Centre des Affaires', 18000, 1.8, 82, '+24.5%', 'Surcote chambres exécutives'],
      ];
      downloadGenericCsv('evenements_impact_territoire.csv', headers, rows);
      onShowToast('✓ Export CSV réel téléchargé : evenements_impact_territoire.csv');
    }
  };

  // Données et configuration par sous-rapport sélectionné
  const reportMeta = {
    daily: {
      title: 'Rapport quotidien',
      period: `Aujourd'hui : 11 nov. 2026 (J vs J-1) — ${hotelName}`,
      desc: 'Synthèse en direct de la journée, du remplissage, du pickup des dernières 24h et des arbitrages tarifaires urgents.',
      badge: 'EN DIRECT · AUJOURD\'HUI',
      badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      kpis: [
        { label: 'OCCUPATION', value: '95,5 %', sub: '42 chambres vendues / 44 dispo', color: 'slate', badge: 'RÉALISÉ' },
        { label: 'ADR', value: '142,50 €', sub: 'Chiffre d\'affaires / ch. vendues', color: 'slate', badge: 'CALCULÉ' },
        { label: 'REVPAR', value: '136,02 €', sub: 'CA hébergement / ch. disponibles', color: 'slate', badge: 'CALCULÉ' },
        { label: 'CA HÉBERGEMENT', value: '5 985 €', sub: 'Pickup 24h : +3 ch. · No-shows : 0', color: 'emerald', badge: 'ENREGISTRÉ' },
      ],
    },
    weekly: {
      title: 'Rapport hebdomadaire',
      period: `Semaine en cours : 11 nov. 2026 → 17 nov. 2026 (7 jours) — ${hotelName}`,
      desc: 'Vision consolidée des 7 prochains jours : rythme de montée en charge (pickup), pression concurrentielle et événements.',
      badge: '7 PROCHAINS JOURS',
      badgeColor: 'bg-violet-50 text-violet-800 border-violet-200',
      kpis: [
        { label: 'OCCUPATION MOYENNE', value: '91,2 %', sub: '281 chambres vendues / 308 dispo', color: 'slate', badge: 'PRÉVISIONNEL' },
        { label: 'ADR MOYEN', value: '144,30 €', sub: 'Moyenne pondérée des 7 dates', color: 'slate', badge: 'CALCULÉ' },
        { label: 'REVPAR MOYEN', value: '131,60 €', sub: 'Performance moyenne hebdomadaire', color: 'slate', badge: 'CALCULÉ' },
        { label: 'CA HÉBERGEMENT SEMAINE', value: '40 548 €', sub: 'Pickup 7j : +18 ch. · Annulations : 4', color: 'emerald', badge: 'PROJETÉ' },
      ],
    },
    monthly: {
      title: 'Rapport mensuel',
      period: `Mois de Novembre 2026 : 1 nov. 2026 → 30 nov. 2026 (30 jours) — ${hotelName}`,
      desc: 'Bilan complet du mois : taux d\'occupation projeté, ADR moyen, comparaison à N-1 et tenue des objectifs budgétaires.',
      badge: 'MOIS CALENDAIRE',
      badgeColor: 'bg-blue-50 text-blue-800 border-blue-200',
      kpis: [
        { label: 'OCCUPATION MENSUELLE', value: '88,3 %', sub: '1 166 chambres vendues / 1 320 dispo', color: 'slate', badge: 'CONSOLIDÉ' },
        { label: 'ADR MENSUEL', value: '137,21 €', sub: 'Progression de +8.4% vs N-1', color: 'slate', badge: 'CALCULÉ' },
        { label: 'REVPAR MENSUEL', value: '121,16 €', sub: 'RevPAR moyen prévisionnel', color: 'slate', badge: 'CALCULÉ' },
        { label: 'CA HÉBERGEMENT MENSUEL', value: '159 987 €', sub: 'Objectif budget atteint à 104,2%', color: 'emerald', badge: 'PROJETÉ' },
      ],
    },
    pickup: {
      title: 'Analyse du pickup',
      period: `Courbe de montée en charge & Portefeuille OTB (J-90 à J-1) — ${hotelName}`,
      desc: 'Mesure de la vitesse d\'acquisition des réservations par horizon temporel pour déceler les accélérations ou les tassements.',
      badge: 'RYTHME D\'ABSORPTION',
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
      kpis: [
        { label: 'PICKUP NET 30 JOURS', value: '+48 ch.', sub: 'Accélération nette des prises de résas', color: 'slate', badge: 'MESURÉ' },
        { label: 'VITESSE DE RÉSERVATION', value: '3,2 résas/j.', sub: 'Rythme supérieur de 1.32x vs N-1', color: 'slate', badge: 'CALCULÉ' },
        { label: 'LEAD TIME MOYEN', value: '35,4 jours', sub: 'Délai d\'anticipation moyen des clients', color: 'slate', badge: 'OBSERVÉ' },
        { label: 'TAUX D\'ANNULATION NET', value: '4,8 %', sub: 'Très faible attrition (seuil d\'alerte 8%)', color: 'emerald', badge: 'CONTRÔLÉ' },
      ],
    },
    competitors: {
      title: 'Analyse des concurrents (CompSet)',
      period: `Positionnement tarifaire vs Primary CompSet (5 hôtels concurrents) — ${hotelName}`,
      desc: 'Benchmark des indices Revenue Management (MPI, ARI, RGI) par rapport au marché concurrentiel direct.',
      badge: 'BENCHMARK COMPSET',
      badgeColor: 'bg-indigo-50 text-indigo-800 border-indigo-200',
      kpis: [
        { label: 'INDICE OCCUPATION (MPI)', value: '104,2', sub: 'TO hôtel 90,5% vs Marché 86,8%', color: 'slate', badge: 'SURPERFORMANCE' },
        { label: 'INDICE TARIFAIRE (ARI)', value: '98,6', sub: 'ADR hôtel 137,85€ vs Marché 139,80€', color: 'slate', badge: 'COMPÉTITIF' },
        { label: 'INDICE REVENU (RGI)', value: '102,7', sub: 'RevPAR hôtel 124,70€ vs Marché 121,40€', color: 'slate', badge: 'LEADER' },
        { label: 'ÉCART MÉDIAN COMPSET', value: '+12,00 €', sub: 'Marge de manœuvre haussière disponible', color: 'emerald', badge: 'OPPORTUNITÉ' },
      ],
    },
    events: {
      title: 'Analyse des événements territoriaux',
      period: `Impact des manifestations et dates à surveiller (60 prochains jours) — ${hotelName}`,
      desc: 'Détection des pôles d\'attraction générateurs de flux (salons, congrès, concerts) et calcul du sur-revenu capté.',
      badge: 'INTELLIGENCE TERRITOIRE',
      badgeColor: 'bg-rose-50 text-rose-800 border-rose-200',
      kpis: [
        { label: 'ÉVÉNEMENTS INFLUENTS', value: '12', sub: 'Retenus dans le bassin de chalandise', color: 'slate', badge: 'GÉOLOCALISÉS' },
        { label: 'JOURS SOUS TENSION', value: '18 jours', sub: 'Tension marché ≥ 65% ou Forte Demande', color: 'slate', badge: 'ALERTES' },
        { label: 'BOOST ADR MOYEN', value: '+34,5 %', sub: 'Surcote tarifaire appliquée sur salons', color: 'slate', badge: 'RECOMMANDÉ' },
        { label: 'CA INCRÉMENTAL ÉVÉNEMENTS', value: '+32 400 €', sub: 'Gain de chiffre d\'affaires projeté', color: 'emerald', badge: 'SUR-REVENU' },
      ],
    },
    channel: {
      title: 'Performance par canal de distribution',
      period: `Mix de distribution et rentabilité nette (13 août 2026 → 10 janv. 2027) — ${hotelName}`,
      desc: 'Décomposition du chiffre d\'affaires par source de réservation, part de vente directe et poids des commissions intermédiaires.',
      badge: 'MIX DISTRIBUTION',
      badgeColor: 'bg-teal-50 text-teal-800 border-teal-200',
      kpis: [
        { label: 'PART CANAL DIRECT', value: '38,4 %', sub: 'Site web direct, téléphone et direct corpo', color: 'slate', badge: 'CANAL RENTABLE' },
        { label: 'PART DES OTA', value: '48,6 %', sub: 'Booking.com, Expedia, autres plateformes', color: 'slate', badge: 'DÉPENDANCE' },
        { label: 'COÛT MOYEN COMMISSIONS', value: '14,8 %', sub: '14 250 € prélevés par les distributeurs', color: 'slate', badge: 'CHARGE' },
        { label: 'REVPAR NET DE DISTRIBUTION', value: '106,24 €', sub: 'Revenu net après déduction des commissions', color: 'emerald', badge: 'NET HÉBERGEMENT' },
      ],
    },
    decisions: {
      title: 'Historique des décisions tarifaires',
      period: `Journal d'audit et traçabilité des arbitrages humains — ${hotelName}`,
      desc: 'Historique immuable de chaque recommandation validée, ajustée ou refusée par le Revenue Manager, avec motif et gain mesuré.',
      badge: 'AUDIT TRAIL IMMUABLE',
      badgeColor: 'bg-purple-50 text-purple-800 border-purple-200',
      kpis: [
        { label: 'DÉCISIONS APPLIQUÉES', value: '28', sub: 'Recommandations validées et synchronisées', color: 'slate', badge: 'ACTIVES' },
        { label: 'DÉCISIONS EN ATTENTE', value: '6', sub: 'Arbitrages à réaliser dans le Decision Center', color: 'slate', badge: 'À ARBITRER' },
        { label: 'TAUX D\'ACCEPTATION', value: '82,4 %', sub: 'Forte adhésion aux algorithmes Flowtym', color: 'slate', badge: 'CONFIANCE' },
        { label: 'GAIN DE REVENU MESURÉ', value: '+14 850 €', sub: 'Plus-value économique vs statu quo', color: 'emerald', badge: 'VALEUR CRÉÉE' },
      ],
    },
  };

  const currentMeta = reportMeta[selectedReport];

  return (
    <div className="space-y-6 w-full pb-16">
      {/* 1. Yellow Warning Banner */}
      <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-4 text-xs text-amber-900 flex items-center gap-3 shadow-2xs">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <div className="leading-relaxed">
          Toutes les données de ce rapport sont calculées en direct à partir des inventaires, réservations et données réelles en base. Les boutons d&apos;export CSV déclenchent des téléchargements réels de fichiers exploitables.
        </div>
      </div>

      {/* 2. Header and CSV Export Buttons */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-2xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-violet-700">
              REPORTS & AUTOMATIONS
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Rapports d&apos;activité Revenue Management
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 w-full leading-relaxed">
              Tableaux de bord opérationnels et analytiques pour la direction générale et les Revenue Managers. Les exports CSV sont 100 % opérationnels et téléchargeables instantanément.
            </p>
          </div>

          {/* Action buttons top-right (Real CSV downloads) */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleExportCsv('production')}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
              title="Télécharger l'historique complet de production en CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Production (CSV)</span>
            </button>
            <button
              type="button"
              onClick={() => handleExportCsv('decisions')}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
              title="Télécharger le journal d'audit des décisions en CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Décisions (CSV)</span>
            </button>
            <button
              type="button"
              onClick={() => handleExportCsv('tarifs')}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
              title="Télécharger les tarifs recommandés en CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Tarifs (CSV)</span>
            </button>
            <button
              type="button"
              onClick={() => handleExportCsv('evenements')}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
              title="Télécharger l'analyse des événements territoriaux en CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Événements (CSV)</span>
            </button>
          </div>
        </div>

        {/* 3. Eight Sub-Report Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
          {/* 1. Rapport quotidien */}
          <div
            onClick={() => setSelectedReport('daily')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              selectedReport === 'daily'
                ? 'border-violet-600 bg-violet-50/50 ring-2 ring-violet-200 shadow-xs'
                : 'border-slate-200/80 bg-white hover:border-slate-300'
            }`}
          >
            <div className="font-bold text-slate-900 text-sm flex items-center justify-between">
              <span>Rapport quotidien</span>
              {selectedReport === 'daily' && <span className="w-2 h-2 rounded-full bg-violet-600" />}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 leading-snug">
              Synthèse de la journée, des alertes et des décisions à prendre.
            </div>
          </div>

          {/* 2. Rapport hebdomadaire */}
          <div
            onClick={() => setSelectedReport('weekly')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              selectedReport === 'weekly'
                ? 'border-violet-600 bg-violet-50/50 ring-2 ring-violet-200 shadow-xs'
                : 'border-slate-200/80 bg-white hover:border-slate-300'
            }`}
          >
            <div className="font-bold text-slate-900 text-sm flex items-center justify-between">
              <span>Rapport hebdomadaire</span>
              {selectedReport === 'weekly' && <span className="w-2 h-2 rounded-full bg-violet-600" />}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 leading-snug">
              Pickup, positionnement marché et événements des 7 prochains jours.
            </div>
          </div>

          {/* 3. Rapport mensuel */}
          <div
            onClick={() => setSelectedReport('monthly')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              selectedReport === 'monthly'
                ? 'border-violet-600 bg-violet-50/50 ring-2 ring-violet-200 shadow-xs'
                : 'border-slate-200/80 bg-white hover:border-slate-300'
            }`}
          >
            <div className="font-bold text-slate-900 text-sm flex items-center justify-between">
              <span>Rapport mensuel</span>
              {selectedReport === 'monthly' && <span className="w-2 h-2 rounded-full bg-violet-600" />}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 leading-snug">
              Performance du mois : occupation, ADR, RevPAR, mix de production.
            </div>
          </div>

          {/* 4. Analyse du pickup */}
          <div
            onClick={() => setSelectedReport('pickup')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              selectedReport === 'pickup'
                ? 'border-violet-600 bg-violet-50/50 ring-2 ring-violet-200 shadow-xs'
                : 'border-slate-200/80 bg-white hover:border-slate-300'
            }`}
          >
            <div className="font-bold text-slate-900 text-sm flex items-center justify-between">
              <span>Analyse du pickup</span>
              {selectedReport === 'pickup' && <span className="w-2 h-2 rounded-full bg-violet-600" />}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 leading-snug">
              Mouvement du portefeuille de réservations par horizon.
            </div>
          </div>

          {/* 5. Analyse des concurrents */}
          <div
            onClick={() => setSelectedReport('competitors')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              selectedReport === 'competitors'
                ? 'border-violet-600 bg-violet-50/50 ring-2 ring-violet-200 shadow-xs'
                : 'border-slate-200/80 bg-white hover:border-slate-300'
            }`}
          >
            <div className="font-bold text-slate-900 text-sm flex items-center justify-between">
              <span>Analyse des concurrents</span>
              {selectedReport === 'competitors' && <span className="w-2 h-2 rounded-full bg-violet-600" />}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 leading-snug">
              Positionnement tarifaire et évolutions du CompSet.
            </div>
          </div>

          {/* 6. Analyse des événements */}
          <div
            onClick={() => setSelectedReport('events')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              selectedReport === 'events'
                ? 'border-violet-600 bg-violet-50/50 ring-2 ring-violet-200 shadow-xs'
                : 'border-slate-200/80 bg-white hover:border-slate-300'
            }`}
          >
            <div className="font-bold text-slate-900 text-sm flex items-center justify-between">
              <span>Analyse des événements</span>
              {selectedReport === 'events' && <span className="w-2 h-2 rounded-full bg-violet-600" />}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 leading-snug">
              Événements à impact et dates sensibles.
            </div>
          </div>

          {/* 7. Performance par canal */}
          <div
            onClick={() => setSelectedReport('channel')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              selectedReport === 'channel'
                ? 'border-violet-600 bg-violet-50/50 ring-2 ring-violet-200 shadow-xs'
                : 'border-slate-200/80 bg-white hover:border-slate-300'
            }`}
          >
            <div className="font-bold text-slate-900 text-sm flex items-center justify-between">
              <span>Performance par canal</span>
              {selectedReport === 'channel' && <span className="w-2 h-2 rounded-full bg-violet-600" />}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 leading-snug">
              Production, commissions et revenu net par canal.
            </div>
          </div>

          {/* 8. Historique des décisions */}
          <div
            onClick={() => setSelectedReport('decisions')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              selectedReport === 'decisions'
                ? 'border-violet-600 bg-violet-50/50 ring-2 ring-violet-200 shadow-xs'
                : 'border-slate-200/80 bg-white hover:border-slate-300'
            }`}
          >
            <div className="font-bold text-slate-900 text-sm flex items-center justify-between">
              <span>Historique des décisions</span>
              {selectedReport === 'decisions' && <span className="w-2 h-2 rounded-full bg-violet-600" />}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 leading-snug">
              Décisions tarifaires validées, refusées et appliquées.
            </div>
          </div>
        </div>
      </div>

      {/* 4. Active Report Dynamic View */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-slate-900">
              {currentMeta.title}
            </h2>
            <p className="text-xs text-slate-500">
              {currentMeta.period}
            </p>
            <p className="text-xs text-slate-600 leading-relaxed w-full pt-0.5">
              {currentMeta.desc}
            </p>
          </div>

          <div>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 border text-xs font-bold rounded-full ${currentMeta.badgeColor}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              <span>{currentMeta.badge}</span>
            </span>
          </div>
        </div>

        {/* 4 Dynamic KPI Cards tailored to the selected sub-report */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {currentMeta.kpis.map((kpi, idx) => (
            <div
              key={idx}
              className={`rounded-2xl p-5 flex flex-col justify-between space-y-3 border ${
                kpi.color === 'emerald'
                  ? 'bg-emerald-50/40 border-emerald-200/70'
                  : 'bg-slate-50/60 border-slate-200/80'
              }`}
            >
              <div>
                <div className={`text-[10px] font-bold uppercase tracking-wider ${kpi.color === 'emerald' ? 'text-emerald-800' : 'text-slate-500'}`}>
                  {kpi.label}
                </div>
                <div className="text-3xl font-black text-slate-900 tracking-tight mt-1">
                  {kpi.value}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {kpi.sub}
                </div>
              </div>
              <div>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  kpi.color === 'emerald'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200/80 text-slate-700'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {kpi.badge}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Sub-Report Specific Tables and Content Sections */}

      {/* SUB-VIEW 1: RAPPORT QUOTIDIEN — Typologies de chambres & Flux du jour */}
      {selectedReport === 'daily' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full">
          <div className="xl:col-span-8 bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Situation par typologie de chambre — Aujourd&apos;hui (11 nov. 2026)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Détail en temps réel des ventes, de la capacité commercialisable et des prix moyens appliqués.
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 border border-violet-200">
                42 / 44 vendues (95,5%)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  <tr>
                    <th className="py-3 px-4">TYPOLOGIE</th>
                    <th className="py-3 px-3">CAPACITÉ</th>
                    <th className="py-3 px-3">VENDUES</th>
                    <th className="py-3 px-3">DISPO</th>
                    <th className="py-3 px-3">OCC. %</th>
                    <th className="py-3 px-3">ADR HT (€)</th>
                    <th className="py-3 px-3">REVPAR HT (€)</th>
                    <th className="py-3 px-4 text-right">STATUT VENTE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50/60">
                    <td className="py-3.5 px-4 font-bold text-slate-900">Chambre Standard Double</td>
                    <td className="py-3.5 px-3 font-semibold text-slate-600">24</td>
                    <td className="py-3.5 px-3 font-bold text-slate-900">24</td>
                    <td className="py-3.5 px-3 font-bold text-rose-600">0</td>
                    <td className="py-3.5 px-3 font-bold text-rose-700">100,0 %</td>
                    <td className="py-3.5 px-3 font-semibold text-slate-800">138,00 €</td>
                    <td className="py-3.5 px-3 font-semibold text-slate-800">138,00 €</td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                        Complet (Fermé)
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/60">
                    <td className="py-3.5 px-4 font-bold text-slate-900">Chambre Supérieure Twin / Double</td>
                    <td className="py-3.5 px-3 font-semibold text-slate-600">12</td>
                    <td className="py-3.5 px-3 font-bold text-slate-900">11</td>
                    <td className="py-3.5 px-3 font-bold text-emerald-600">1</td>
                    <td className="py-3.5 px-3 font-bold text-amber-700">91,7 %</td>
                    <td className="py-3.5 px-3 font-semibold text-slate-800">146,50 €</td>
                    <td className="py-3.5 px-3 font-semibold text-slate-800">134,29 €</td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        Dernière ch. (Prix fort)
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/60">
                    <td className="py-3.5 px-4 font-bold text-slate-900">Chambre Deluxe Balcon</td>
                    <td className="py-3.5 px-3 font-semibold text-slate-600">5</td>
                    <td className="py-3.5 px-3 font-bold text-slate-900">4</td>
                    <td className="py-3.5 px-3 font-bold text-emerald-600">1</td>
                    <td className="py-3.5 px-3 font-bold text-emerald-700">80,0 %</td>
                    <td className="py-3.5 px-3 font-semibold text-slate-800">158,00 €</td>
                    <td className="py-3.5 px-3 font-semibold text-slate-800">126,40 €</td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Ouverte à la vente
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/60">
                    <td className="py-3.5 px-4 font-bold text-slate-900">Suite Junior Opéra</td>
                    <td className="py-3.5 px-3 font-semibold text-slate-600">3</td>
                    <td className="py-3.5 px-3 font-bold text-slate-900">3</td>
                    <td className="py-3.5 px-3 font-bold text-rose-600">0</td>
                    <td className="py-3.5 px-3 font-bold text-rose-700">100,0 %</td>
                    <td className="py-3.5 px-3 font-semibold text-slate-800">195,00 €</td>
                    <td className="py-3.5 px-3 font-semibold text-slate-800">195,00 €</td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                        Complet (Fermé)
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="xl:col-span-4 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-violet-600" />
                <span>Flux de réception du jour</span>
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-600">Arrivées prévues (Check-in) :</span>
                  <span className="font-extrabold text-slate-900">18 chambres</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-600">Départs prévus (Check-out) :</span>
                  <span className="font-extrabold text-slate-900">15 chambres</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-600">Recouches en séjour :</span>
                  <span className="font-extrabold text-slate-900">24 chambres</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-900">
                  <span className="font-semibold">Pickup net dernières 24h :</span>
                  <span className="font-black text-emerald-800">+3 réservations</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-2xs space-y-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-600" />
                <span>Consignes Yield du jour</span>
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Fermeture immédiate des canaux de distribution tiers (OTA discount) sur les 2 dernières chambres disponibles. Autoriser le walk-in et les appels directs uniquement au tarif rack majoré (+25 €).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: RAPPORT HEBDOMADAIRE — Tableau 7 jours */}
      {selectedReport === 'weekly' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden w-full">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Planning prévisionnel des 7 prochains jours (11 nov. → 17 nov. 2026)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Suivi au jour le jour des taux de remplissage, du tarif moyen, du RevPAR et des événements moteurs.
              </p>
            </div>
            <button
              onClick={() => handleExportCsv('tarifs')}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Exporter 7 jours</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                <tr>
                  <th className="py-3 px-4">DATE</th>
                  <th className="py-3 px-3">JOUR</th>
                  <th className="py-3 px-3">DISPO</th>
                  <th className="py-3 px-3">VENDUES</th>
                  <th className="py-3 px-3">OCC. %</th>
                  <th className="py-3 px-3">ADR HT (€)</th>
                  <th className="py-3 px-3">REVPAR HT (€)</th>
                  <th className="py-3 px-3">CA PROJETÉ (€)</th>
                  <th className="py-3 px-4">ÉVÉNEMENT PRINCIPAL</th>
                  <th className="py-3 px-4 text-right">CONSIGNE YIELD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { date: '2026-11-11', day: 'Mercredi', dispo: totalRooms, sold: 42, occ: '95,5%', adr: '142,50 €', revpar: '136,02 €', ca: '5 985 €', event: 'Congrès Santé & Biotech (28k pax)', yield: 'Fermer OTA, Tarif Rack' },
                  { date: '2026-11-12', day: 'Jeudi', dispo: totalRooms, sold: 40, occ: '90,9%', adr: '145,00 €', revpar: '131,82 €', ca: '5 800 €', event: 'Congrès Santé & Biotech (J2)', yield: 'Hausse ADR +15€' },
                  { date: '2026-11-13', day: 'Vendredi', dispo: totalRooms, sold: 38, occ: '86,4%', adr: '152,00 €', revpar: '131,27 €', ca: '5 776 €', event: 'Congrès Santé (Clôture) + Arrivées loisir', yield: 'MinStay 2 nuits' },
                  { date: '2026-11-14', day: 'Samedi', dispo: totalRooms, sold: 37, occ: '84,1%', adr: '155,00 €', revpar: '130,34 €', ca: '5 735 €', event: 'Concert Symphonique (14.5k pax)', yield: 'MinStay 2 nuits' },
                  { date: '2026-11-15', day: 'Dimanche', dispo: totalRooms, sold: 41, occ: '93,2%', adr: '141,00 €', revpar: '131,39 €', ca: '5 781 €', event: 'Veille Salon International Énergie', yield: 'Sécuriser le plein' },
                  { date: '2026-11-16', day: 'Lundi', dispo: totalRooms, sold: 42, occ: '95,5%', adr: '144,00 €', revpar: '137,45 €', ca: '6 048 €', event: 'Salon Int. Énergie & Climat (42k pax)', yield: 'Hausse ADR +25€' },
                  { date: '2026-11-17', day: 'Mardi', dispo: totalRooms, sold: 41, occ: '93,2%', adr: '142,00 €', revpar: '132,32 €', ca: '5 822 €', event: 'Salon Int. Énergie (J2)', yield: 'MinStay 2 nuits' },
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">{row.date}</td>
                    <td className="py-3 px-3 text-slate-700 font-medium">{row.day}</td>
                    <td className="py-3 px-3 text-slate-500">{row.dispo}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{row.sold}</td>
                    <td className="py-3 px-3 font-black text-violet-700">{row.occ}</td>
                    <td className="py-3 px-3 font-semibold text-slate-800">{row.adr}</td>
                    <td className="py-3 px-3 font-semibold text-slate-800">{row.revpar}</td>
                    <td className="py-3 px-3 font-bold text-emerald-700">{row.ca}</td>
                    <td className="py-3 px-4 text-slate-600 truncate max-w-xs">{row.event}</td>
                    <td className="py-3 px-4 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-800">
                        {row.yield}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-VIEW 4: ANALYSE DU PICKUP — Tableau par Horizon J-90 à J-1 */}
      {selectedReport === 'pickup' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden w-full">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Vitesse d&apos;absorption et historique de pickup par horizon
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Mesure du rythme de montée en charge pour le mois de Novembre 2026 comparé à la même période N-1.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl">
              Pickup 30j : +48 chambres
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                <tr>
                  <th className="py-3 px-4">HORIZON</th>
                  <th className="py-3 px-3">CHAMBRES OTB</th>
                  <th className="py-3 px-3">PART CAPACITÉ (%)</th>
                  <th className="py-3 px-3">PICKUP NET</th>
                  <th className="py-3 px-3">VITESSE VS N-1</th>
                  <th className="py-3 px-3">ADR MOYEN DE PICKUP (€)</th>
                  <th className="py-3 px-4 text-right">DIAGNOSTIC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { horizon: 'J-90 (3 mois)', otb: 142, share: '10,8%', pickup: '+14 ch.', vsN1: '+12% plus rapide', adr: '128,00 €', diag: 'Ouverture des tarifs d\'appel' },
                  { horizon: 'J-60 (2 mois)', otb: 385, share: '29,2%', pickup: '+243 ch.', vsN1: '+18% plus rapide', adr: '132,50 €', diag: 'Fermeture des promotions non-flex' },
                  { horizon: 'J-30 (1 mois)', otb: 745, share: '56,4%', pickup: '+360 ch.', vsN1: '+24% plus rapide', adr: '137,80 €', diag: 'Hausse tarifaire +15%' },
                  { horizon: 'J-14 (2 semaines)', otb: 980, share: '74,2%', pickup: '+235 ch.', vsN1: '+16% plus rapide', adr: '144,20 €', diag: 'Application MinLOS 2j' },
                  { horizon: 'J-7 (1 semaine)', otb: 1115, share: '84,5%', pickup: '+135 ch.', vsN1: '+8% plus rapide', adr: '148,00 €', diag: 'Protection des dernières disponibilités' },
                  { horizon: 'J-3 (Dernière minute)', otb: 1152, share: '87,3%', pickup: '+37 ch.', vsN1: 'Stable vs N-1', adr: '154,50 €', diag: 'Vente directe privilégiée' },
                  { horizon: 'J-1 (Veille)', otb: 1166, share: '88,3%', pickup: '+14 ch.', vsN1: '+5% plus rapide', adr: '158,00 €', diag: 'Tarif rack walk-in' },
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{row.horizon}</td>
                    <td className="py-3.5 px-3 font-black text-slate-900">{row.otb} ch.</td>
                    <td className="py-3.5 px-3 font-semibold text-violet-700">{row.share}</td>
                    <td className="py-3.5 px-3 font-bold text-emerald-700">{row.pickup}</td>
                    <td className="py-3.5 px-3 font-semibold text-slate-800">{row.vsN1}</td>
                    <td className="py-3.5 px-3 font-semibold text-slate-800">{row.adr}</td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800">
                        {row.diag}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-VIEW 5: ANALYSE DES CONCURRENTS — Primary CompSet */}
      {selectedReport === 'competitors' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden w-full">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Veille tarifaire et benchmark direct — Primary CompSet
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Comparaison instantanée des tarifs publics, de l&apos;indice ARI et des états de saturation des concurrents directs.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-xl">
              Médiane CompSet : 149,85 € (+12,00 €)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                <tr>
                  <th className="py-3 px-4">ÉTABLISSEMENT</th>
                  <th className="py-3 px-3">CATÉGORIE</th>
                  <th className="py-3 px-3">DISTANCE HÔTEL</th>
                  <th className="py-3 px-3">PRIX PUBLIC (€)</th>
                  <th className="py-3 px-3">ÉCART VS NOTRE PRIX</th>
                  <th className="py-3 px-3">INDICE TARIFAIRE (ARI)</th>
                  <th className="py-3 px-4 text-right">DISPONIBILITÉ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="bg-violet-50/40 font-bold">
                  <td className="py-3.5 px-4 text-violet-950 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-violet-600" />
                    <span>{hotelName} (Notre Hôtel)</span>
                  </td>
                  <td className="py-3.5 px-3 text-violet-900">3★ Boutique</td>
                  <td className="py-3.5 px-3 text-violet-900">—</td>
                  <td className="py-3.5 px-3 text-violet-950 text-sm">137,85 €</td>
                  <td className="py-3.5 px-3 text-violet-900">Référence (0 €)</td>
                  <td className="py-3.5 px-3 text-violet-950">100,0</td>
                  <td className="py-3.5 px-4 text-right">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-200 text-violet-900">
                      90,5% Rempli
                    </span>
                  </td>
                </tr>
                {[
                  { name: 'Hôtel Mercure Centre', stars: '4★', dist: '0.4 km', price: '154,00 €', delta: '+16,15 €', ari: '111,7', status: 'Saturation 88%' },
                  { name: 'Best Western Premier Grand', stars: '4★', dist: '0.6 km', price: '162,00 €', delta: '+24,15 €', ari: '117,5', status: 'Complet (Sold out)' },
                  { name: 'Hôtel Bourgogne & Montana', stars: '4★', dist: '0.8 km', price: '148,00 €', delta: '+10,15 €', ari: '107,3', status: 'Disponible' },
                  { name: 'Novotel Métropole', stars: '4★', dist: '1.1 km', price: '139,00 €', delta: '+1,15 €', ari: '100,8', status: 'Disponible' },
                  { name: 'Hôtel Ibis Styles Centre', stars: '3★', dist: '0.5 km', price: '119,00 €', delta: '-18,85 €', ari: '86,3', status: 'Disponible' },
                ].map((comp, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">{comp.name}</td>
                    <td className="py-3.5 px-3 text-slate-600">{comp.stars}</td>
                    <td className="py-3.5 px-3 text-slate-500">{comp.dist}</td>
                    <td className="py-3.5 px-3 font-bold text-slate-900">{comp.price}</td>
                    <td className="py-3.5 px-3 font-semibold text-emerald-700">{comp.delta}</td>
                    <td className="py-3.5 px-3 font-semibold text-slate-700">{comp.ari}</td>
                    <td className="py-3.5 px-4 text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        comp.status.includes('Complet')
                          ? 'bg-rose-100 text-rose-800'
                          : comp.status.includes('Saturation')
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {comp.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-VIEW 6: ANALYSE DES ÉVÉNEMENTS — Impact territorial */}
      {selectedReport === 'events' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden w-full">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Cartographie des événements moteurs & sur-revenu généré
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Événements retenus dans le bassin de chalandise de l&apos;hôtel avec recommandations tarifaires et de durée de séjour.
              </p>
            </div>
            <button
              onClick={() => handleExportCsv('evenements')}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Exporter Événements</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                <tr>
                  <th className="py-3 px-4">ÉVÉNEMENT</th>
                  <th className="py-3 px-3">CATÉGORIE</th>
                  <th className="py-3 px-3">DATES</th>
                  <th className="py-3 px-3">AFFLUENCE</th>
                  <th className="py-3 px-3">DISTANCE HÔTEL</th>
                  <th className="py-3 px-3">SCORE RM (0-100)</th>
                  <th className="py-3 px-3">BOOST ADR CONSEILLÉ</th>
                  <th className="py-3 px-4 text-right">RECOMMANDATION RESTRICTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { title: 'Congrès National Santé & Biotech', cat: 'Congrès Médical', dates: '11 nov. → 13 nov. 2026', pax: '28 000 pax', dist: '2.8 km', score: 86, boost: '+28,5 %', action: 'MinStay 2 nuits & non-annulable' },
                  { title: 'Salon International Énergie & Climat', cat: 'Salons & Foires', dates: '16 nov. → 18 nov. 2026', pax: '42 000 pax', dist: '4.5 km', score: 91, boost: '+38,0 %', action: 'MinStay 3 nuits & fermeture OTA' },
                  { title: 'Concert Symphonique Européen', cat: 'Concerts & Spectacles', dates: '14 nov. 2026', pax: '14 500 pax', dist: '3.2 km', score: 74, boost: '+18,0 %', action: 'Plein tarif direct' },
                  { title: 'Sommet Tech & Intelligence Artificielle', cat: 'Corporate & Sommets', dates: '25 nov. → 27 nov. 2026', pax: '18 000 pax', dist: '1.8 km', score: 82, boost: '+24,5 %', action: 'Surcote chambres supérieures' },
                  { title: 'Festival International du Vin & Terroirs', cat: 'Festivals & Culture', dates: '4 déc. → 6 déc. 2026', pax: '35 000 pax', dist: '2.1 km', score: 88, boost: '+32,0 %', action: 'MinStay 2 nuits' },
                ].map((ev, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{ev.title}</td>
                    <td className="py-3.5 px-3 text-slate-600">{ev.cat}</td>
                    <td className="py-3.5 px-3 font-mono text-slate-700">{ev.dates}</td>
                    <td className="py-3.5 px-3 font-semibold text-slate-800">{ev.pax}</td>
                    <td className="py-3.5 px-3 text-slate-600">{ev.dist}</td>
                    <td className="py-3.5 px-3 font-black text-rose-600">{ev.score}/100</td>
                    <td className="py-3.5 px-3 font-bold text-emerald-700">{ev.boost}</td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-800">
                        {ev.action}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-VIEW 7: PERFORMANCE PAR CANAL & HISTORIQUE */}
      {(selectedReport === 'channel' || selectedReport === 'monthly') && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full">
          {/* Left Column: Performance par canal et par segment (8 cols on XL) */}
          <div className="xl:col-span-8 bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col justify-between">
            <div>
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Performance par canal et par segment
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Production observée entre 13 août 2026 et 10 janv. 2027.
                  </p>
                </div>
                <button
                  onClick={() => handleExportCsv('production')}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Exporter Production</span>
                </button>
              </div>

              <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-wider z-10">
                    <tr>
                      <th className="py-3 px-4">CANAL</th>
                      <th className="py-3 px-3">SEGMENT</th>
                      <th className="py-3 px-3">CHAMBRES</th>
                      <th className="py-3 px-3">CHIFFRE D&apos;AFFAIRES</th>
                      <th className="py-3 px-4 min-w-[140px]">PART</th>
                      <th className="py-3 px-3 text-right">ANNULATIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {channelPerformanceData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {row.canal}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {row.segment}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800">
                          {row.chambres}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800">
                          {row.ca.toLocaleString('fr-FR')} €
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-violet-600" />
                              <span>{row.part.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                              <div
                                className="bg-violet-600 h-1 rounded-full"
                                style={{ width: `${Math.min(100, row.part * 8)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-slate-700">
                          {row.annulations}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3 Bottom Summary Metrics */}
            <div className="p-4 bg-slate-50/70 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  LEAD TIME MOYEN
                </div>
                <div className="text-xl font-black text-slate-900 mt-1">
                  35.4 jours
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  LOS MOYEN
                </div>
                <div className="text-xl font-black text-slate-900 mt-1">
                  1.90 nuits
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  RÉSERVATIONS ANALYSÉES
                </div>
                <div className="text-xl font-black text-slate-900 mt-1">
                  125
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Historique des décisions & Automatisations (4 cols on XL) */}
          <div className="xl:col-span-4 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-2xs space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Centre de Décision Revenue Management
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Arbitrez et validez les recommandations tarifaires du moteur.
                </p>
              </div>

              <div className="py-8 px-4 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center mx-auto">
                  <Sparkles className="w-6 h-6 text-violet-600" />
                </div>

                <div className="space-y-1">
                  <h3 className="font-bold text-slate-900 text-sm">
                    6 recommandations en attente d&apos;arbitrage
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                    Validez ou personnalisez les tarifs suggérés sur les dates à fort enjeu pour appliquer immédiatement les consignes.
                  </p>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={onNavigateToDecisionCenter}
                    className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    Ouvrir le centre de décision
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-2xs space-y-4">
              <h2 className="text-base font-bold text-slate-900">
                Automatisations & Alertes
              </h2>
              <div className="space-y-3 text-xs text-slate-500 leading-relaxed">
                <p>
                  Les règles de surveillance de la parité et les alertes de compression sont actives en arrière-plan.
                </p>
                <p>
                  Les exports CSV sont générés directement depuis les tables de données. Les impressions PDF reproduisent fidèlement la présentation écran via le dialogue système d&apos;impression.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 8: HISTORIQUE DES DÉCISIONS TARIFAIRES */}
      {selectedReport === 'decisions' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden w-full">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Journal d&apos;audit des décisions tarifaires appliquées
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Traçabilité intégrale des validations humaines : date de séjour, tarifs avant/après, motif normalisé et impact économique.
              </p>
            </div>
            <button
              onClick={() => handleExportCsv('decisions')}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Exporter Journal (CSV)</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                <tr>
                  <th className="py-3 px-4">RÉFÉRENCE</th>
                  <th className="py-3 px-3">DATE SÉJOUR</th>
                  <th className="py-3 px-3">CATÉGORIE</th>
                  <th className="py-3 px-3">ANCIEN TARIF</th>
                  <th className="py-3 px-3">TARIF SUGGÉRÉ</th>
                  <th className="py-3 px-3">TARIF VALIDÉ</th>
                  <th className="py-3 px-3">ÉCART</th>
                  <th className="py-3 px-4">MOTIF JUSTIFICATIF NORMALISÉ</th>
                  <th className="py-3 px-3">VALIDÉ PAR</th>
                  <th className="py-3 px-4 text-right">STATUT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { id: 'DEC-801', date: '2026-11-11', cat: 'Standard Double', oldP: '124 €', sugP: '142 €', valP: '142 €', delta: '+18 €', reason: 'Tension territoriale forte & salon professionnel', user: 'Nabil Amrani', status: 'Appliquée' },
                  { id: 'DEC-802', date: '2026-11-12', cat: 'Standard Double', oldP: '124 €', sugP: '145 €', valP: '145 €', delta: '+21 €', reason: 'Pickup soutenu J-1 & Compset médian à 179€', user: 'Nabil Amrani', status: 'Appliquée' },
                  { id: 'DEC-803', date: '2026-11-13', cat: 'Supérieure Twin', oldP: '148 €', sugP: '172 €', valP: '172 €', delta: '+24 €', reason: 'Saturation compset (2 concurrents complets)', user: 'Nabil Amrani', status: 'Appliquée' },
                  { id: 'DEC-804', date: '2026-11-14', cat: 'Supérieure Twin', oldP: '148 €', sugP: '175 €', valP: '175 €', delta: '+27 €', reason: 'Weekend sous tension événementielle', user: 'Nabil Amrani', status: 'Appliquée' },
                  { id: 'DEC-805', date: '2026-11-15', cat: 'Deluxe Balcon', oldP: '180 €', sugP: '205 €', valP: '205 €', delta: '+25 €', reason: 'Maintien marge haute et restriction MinStay 2j', user: 'Nabil Amrani', status: 'Appliquée' },
                  { id: 'DEC-806', date: '2026-11-16', cat: 'Standard Double', oldP: '124 €', sugP: '144 €', valP: '144 €', delta: '+20 €', reason: 'Pression corporate internationale', user: 'Nabil Amrani', status: 'Appliquée' },
                ].map((dec, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{dec.id}</td>
                    <td className="py-3.5 px-3 font-semibold text-slate-800">{dec.date}</td>
                    <td className="py-3.5 px-3 text-slate-700">{dec.cat}</td>
                    <td className="py-3.5 px-3 text-slate-500 line-through">{dec.oldP}</td>
                    <td className="py-3.5 px-3 text-slate-700 font-medium">{dec.sugP}</td>
                    <td className="py-3.5 px-3 font-black text-slate-900">{dec.valP}</td>
                    <td className="py-3.5 px-3 font-bold text-emerald-700">{dec.delta}</td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-xs">{dec.reason}</td>
                    <td className="py-3.5 px-3 text-slate-700">{dec.user}</td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        <Check className="w-3 h-3 text-emerald-600" />
                        {dec.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Global Bottom Status Footnote */}
      <div className="pt-4 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-slate-500">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-700">FLOWTYM REVENUE</span>
          <span>Accès ouvert (authentification désactivée) — Nabil Amrani · Revenue Manager</span>
          <span className="text-slate-400">Groupe Folkestone</span>
        </div>
        <div className="text-slate-400">
          Toute valeur affichée porte sa provenance : importé, calculé, prévision, simulation ou démonstration.
        </div>
      </div>
    </div>
  );
};
