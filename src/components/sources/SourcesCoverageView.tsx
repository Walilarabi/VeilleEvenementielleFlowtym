/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Database,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Server,
  Building,
  Layers,
  Zap,
  Globe,
  Terminal,
  Play,
  CheckCircle,
  Activity,
  Sparkles,
} from 'lucide-react';
import { EventSource, Venue, EventItem, Hotel } from '../../types';
import { getDiscoveredSources } from '../../services/eventIntelligenceAgent';
import { DataManagementWorkspace } from './DataManagementWorkspace';

interface SourcesCoverageViewProps {
  sources: EventSource[];
  venues: Venue[];
  events?: EventItem[];
  hotel?: Hotel;
  onTriggerSync?: () => void;
  onShowToast?: (msg: string) => void;
  onNavigateToPricing?: () => void;
}

export const SourcesCoverageView: React.FC<SourcesCoverageViewProps> = ({
  sources,
  venues,
  events = [],
  hotel,
  onShowToast,
  onNavigateToPricing,
}) => {
  const discoveredSources = getDiscoveredSources();

  // Combine initial sources with agent auto-discovered sources
  const allSources = React.useMemo(() => {
    const map = new Map<string, EventSource>();
    sources.forEach((s) => map.set(s.url, s));
    discoveredSources.forEach((s) => {
      if (!map.has(s.url)) {
        map.set(s.url, s);
      }
    });
    return Array.from(map.values());
  }, [sources, discoveredSources]);

  const officialCount = allSources.filter((s) => s.isOfficial).length;

  const paris2027Events = events.filter(
    (e) => e.startDate.startsWith('2027') && e.city === 'Paris'
  );

  const [activeSubTab, setActiveSubTab] = useState<
    'data_hub' | 'crawler' | 'sources_list' | 'venues'
  >('data_hub');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-violet-600 flex items-center justify-center text-white shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Données & Inventaire HOPTYM
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Connectivités, imports, qualité des données et référentiels événementiels
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/70">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Catalogue & imports</span>
            </span>
          </div>
        </div>

        {/* 4 Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/70">
            <div className="text-[11px] font-bold text-slate-400 uppercase">Sources référencées</div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
              {allSources.length}
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
              Sources du référentiel
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/70">
            <div className="text-[11px] font-bold text-slate-400 uppercase">Sources Officielles</div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
              {officialCount}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Organisateurs & Gestionnaires
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/70">
            <div className="text-[11px] font-bold text-slate-400 uppercase">Infrastructures Référencées</div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
              {venues.length}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Parcs, Arenas & Stades
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/70">
            <div className="text-[11px] font-bold text-slate-400 uppercase">Événements Paris 2027</div>
            <div className="text-2xl font-black text-violet-700 dark:text-violet-300 mt-1 tabular-nums">
              {paris2027Events.length}
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
              {paris2027Events.filter((event) => Boolean(event.officialUrl)).length} avec URL officielle
            </div>
          </div>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800/80 pt-4 overflow-x-auto">
          {[
            {
              id: 'data_hub',
              label: 'Centre de données & connectivités',
              icon: Database,
              badge: 'Catalogue API + imports',
            },
            {
              id: 'sources_list',
              label: `Répertoire des Sources (${allSources.length})`,
              icon: Database,
            },
            {
              id: 'venues',
              label: `Infrastructures (${venues.length})`,
              icon: Building,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as typeof activeSubTab)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-violet-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* CENTRE DE DONNÉES HOPTYM */}
      {activeSubTab === 'data_hub' && (
        <DataManagementWorkspace hotel={hotel} onShowToast={onShowToast} />
      )}

      {/* Workers & Ingestion Architecture Banner + Sources Table */}
      {activeSubTab === 'sources_list' && (
        <div className="space-y-6">
          <div className="bg-slate-900 dark:bg-slate-800 text-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-violet-400 font-bold text-xs uppercase tracking-wider">
              <Server className="w-4 h-4" />
              <span>Architecture cible de collecte (non déployée)</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-4xl">
              Conformément au PRD technique, le moteur de crawling et de déduplication est exécuté en dehors des fonctions serverless Vercel sur des conteneurs workers dédiés avec queue de tâches. Les données vérifiées sont synchronisées de manière asynchrone dans PostgreSQL / Supabase avec contrôle d&apos;intégrité.
            </p>
            <div className="text-[11px] text-amber-700 dark:text-amber-300 pt-2 border-t border-slate-800">
              Statut : architecture cible documentée — aucun worker actif confirmé.
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Sources Primaires & Gestionnaires de Billetterie
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Catégorie</th>
                    <th className="py-3 px-4">Territoire</th>
                    <th className="py-3 px-4 text-center">Fiabilité</th>
                    <th className="py-3 px-4">Dernier Crawl</th>
                    <th className="py-3 px-4 text-right">Événements</th>
                    <th className="py-3 px-4 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {allSources.map((src) => {
                    const isAI = (src as any).isDiscoveredByAI;
                    return (
                      <tr key={src.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">{src.name}</span>
                            {isAI && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                                Découverte IA
                              </span>
                            )}
                          </div>
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1 mt-0.5"
                          >
                            <span className="truncate max-w-xs">{src.url}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </a>
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">{src.category}</td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{src.city}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center justify-center font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md tabular-nums border border-emerald-200/70">
                            {src.reliabilityScore}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{src.lastCrawledAt}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                          {src.detectedEventsCount}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            Actif
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Venues Directory */}
      {activeSubTab === 'venues' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Infrastructures Clés Référencées
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {venues.map((venue) => (
              <div
                key={venue.id}
                className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-800/50 space-y-2 text-xs"
              >
                <div className="flex items-start justify-between">
                  <span className="font-bold text-slate-900 dark:text-slate-100">{venue.name}</span>
                  <span className="text-[10px] uppercase font-bold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40 px-2 py-0.5 rounded">
                    {venue.city}
                  </span>
                </div>
                <div className="text-slate-500 dark:text-slate-400 text-[11px]">{venue.address}</div>
                <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-medium pt-2 border-t border-slate-200/60 dark:border-slate-800/70">
                  <span>Capacité maximale :</span>
                  <span className="font-bold tabular-nums">
                    {venue.capacity?.toLocaleString('fr-FR') || 'Non renseignée'} places
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
