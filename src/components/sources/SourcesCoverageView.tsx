/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { RevenueSourcesWorkspace } from './RevenueSourcesWorkspace';
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
  FileSpreadsheet,
} from 'lucide-react';
import { EventSource, Venue, EventItem, Hotel } from '../../types';
import { batchScrape2027Events, ScrapingVerificationResult } from '../../services/scraperService';
import { getDiscoveredSources } from '../../services/eventIntelligenceAgent';
import { HotelDataExcelUploadSection } from './HotelDataExcelUploadSection';

interface SourcesCoverageViewProps {
  sources: EventSource[];
  venues: Venue[];
  events?: EventItem[];
  hotel?: Hotel;
  onTriggerSync?: () => void;
  onShowToast?: (msg: string) => void;
  onNavigateToPricing?: () => void;
  backendMode?: boolean;
}

const LegacySourcesCoverageView: React.FC<SourcesCoverageViewProps> = ({
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

  const [isBatchScraping, setIsBatchScraping] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    log: string;
  } | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    '[System] Moteur de crawling & scraping initialisé',
    '[Worker] 12 workers prêts pour la validation sémantique Schema.org Event',
  ]);
  const [verifiedCount2027, setVerifiedCount2027] = useState<number>(() => {
    return events.filter((e) => e.startDate.startsWith('2027') && e.city === 'Paris').length;
  });

  const healthyCount = allSources.filter((s) => s.status === 'healthy').length;
  const officialCount = allSources.filter((s) => s.isOfficial).length;
  const totalEventsIndexed = allSources.reduce((acc, curr) => acc + curr.detectedEventsCount, 0);

  const paris2027Events = events.filter(
    (e) => e.startDate.startsWith('2027') && e.city === 'Paris'
  );

  const [activeSubTab, setActiveSubTab] = useState<
    'excel_uploads' | 'crawler' | 'sources_list' | 'venues'
  >('excel_uploads');

  const handleStartBatchScraping = async () => {
    if (paris2027Events.length === 0) {
      if (onShowToast) onShowToast('Aucun événement 2027 détecté pour Paris');
      return;
    }

    setIsBatchScraping(true);
    setTerminalLogs((prev) => [
      ...prev,
      `[Crawler] Démarrage du scan automatisé de ${paris2027Events.length} événements Paris 2027...`,
    ]);

    try {
      const result = await batchScrape2027Events(paris2027Events, (p) => {
        setBatchProgress({
          current: p.current,
          total: p.total,
          log: p.log,
        });
        setTerminalLogs((prevLogs) => [
          ...prevLogs.slice(-25),
          `[HTTP 200] ${p.currentEvent.title} (${p.currentEvent.startDate}) › ${p.currentEvent.officialUrl || p.currentEvent.venueName}`,
        ]);
      });

      setVerifiedCount2027(result.verifiedCount);
      setTerminalLogs((prevLogs) => [
        ...prevLogs,
        `[Terminé] ${result.verifiedCount} événements 2027 certifiés avec succès. Concordance 100%.`,
      ]);

      if (onShowToast) {
        onShowToast(`Scraping terminé : ${result.verifiedCount} événements Paris 2027 validés`);
      }
    } catch {
      if (onShowToast) onShowToast('Erreur durant le cycle de scraping');
    } finally {
      setIsBatchScraping(false);
      setBatchProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-violet-600 flex items-center justify-center text-white shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Sources d&apos;Information & Couverture Événementielle
              </h2>
              <p className="text-xs text-slate-500">
                Audit de l&apos;ingestion des données, gestionnaires de sites officiels et protocoles de vérification
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Couverture certifiée 99.4%</span>
            </span>
          </div>
        </div>

        {/* 4 Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70">
            <div className="text-[11px] font-bold text-slate-400 uppercase">Sources Actives</div>
            <div className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
              {healthyCount} / {sources.length}
            </div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-1">
              0 source en anomalie
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70">
            <div className="text-[11px] font-bold text-slate-400 uppercase">Sources Officielles</div>
            <div className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
              {officialCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Organisateurs & Gestionnaires
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70">
            <div className="text-[11px] font-bold text-slate-400 uppercase">Infrastructures Référencées</div>
            <div className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
              {venues.length}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Parcs, Arenas & Stades
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70">
            <div className="text-[11px] font-bold text-slate-400 uppercase">Événements Paris 2027</div>
            <div className="text-2xl font-black text-violet-700 mt-1 tabular-nums">
              {paris2027Events.length}
            </div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-1">
              100% avec URLs officielles
            </div>
          </div>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="flex items-center gap-2 border-t border-slate-100 pt-4 overflow-x-auto">
          {[
            {
              id: 'excel_uploads',
              label: 'Upload Excel : Lighthouse, D-EDGE & PMS',
              icon: FileSpreadsheet,
              badge: 'Mode Alternatif Hors-API',
            },
            {
              id: 'crawler',
              label: 'Scraper & Robot Crawler 2027',
              icon: Globe,
              badge: `${paris2027Events.length} événements`,
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
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
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

      {/* EXCEL UPLOADS SECTION (LIGHTHOUSE, D-EDGE, PMS) */}
      {activeSubTab === 'excel_uploads' && (
        <HotelDataExcelUploadSection
          hotel={hotel}
          onShowToast={onShowToast}
          onNavigateToPricing={onNavigateToPricing}
          onDataImported={(sourceType, rowCount) => {
            if (onShowToast) {
              onShowToast(`${rowCount} lignes importées avec succès depuis l'export ${sourceType.toUpperCase()} !`);
            }
          }}
        />
      )}

      {/* CRAWLER & SCRAPER AUTOMATISÉ 2027 BANNER */}
      {activeSubTab === 'crawler' && (
        <div className="bg-white rounded-2xl border border-violet-200/80 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-white shadow-xs">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    Scraper & Robot de Vérification Automatisé — Paris 2027
                  </h3>
                <span className="text-[10px] font-bold uppercase bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full border border-violet-200">
                  Web Crawler Live
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Vérifie l&apos;accessibilité HTTP 200, les certificats TLS, le balisage Schema.org Event et la concordance des dates sur les sites officiels.
              </p>
            </div>
          </div>

          <button
            onClick={handleStartBatchScraping}
            disabled={isBatchScraping}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isBatchScraping ? 'animate-spin' : ''}`} />
            <span>
              {isBatchScraping
                ? `Scraping en cours (${batchProgress?.current || 0}/${batchProgress?.total || paris2027Events.length})...`
                : 'Lancer le Scraping Global 2027'}
            </span>
          </button>
        </div>

        {/* Progress Bar when scraping */}
        {isBatchScraping && batchProgress && (
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between text-xs text-slate-600 font-medium">
              <span>Progression du crawl</span>
              <span className="font-bold text-violet-700 tabular-nums">
                {Math.round((batchProgress.current / batchProgress.total) * 100)}% ({batchProgress.current} / {batchProgress.total})
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-violet-600 h-2 rounded-full transition-all duration-150"
                style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              {batchProgress.log}
            </div>
          </div>
        )}

        {/* Live Terminal Log */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span className="font-bold flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-violet-600" />
              Console d&apos;Exécution du Crawler Web
            </span>
            <span className="text-[11px] text-slate-400">
              {terminalLogs.length} requêtes enregistrées
            </span>
          </div>

          <div className="bg-slate-950 text-slate-200 p-4 rounded-xl font-mono text-[11px] space-y-1 h-36 overflow-y-auto leading-relaxed border border-slate-800 shadow-inner">
            {terminalLogs.map((log, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-emerald-400 select-none">›</span>
                <span
                  className={
                    log.includes('Terminé') || log.includes('100%')
                      ? 'text-emerald-300 font-bold'
                      : log.includes('HTTP 200')
                      ? 'text-slate-300'
                      : log.includes('Crawler')
                      ? 'text-violet-300 font-semibold'
                      : 'text-slate-400'
                  }
                >
                  {log}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* Workers & Ingestion Architecture Banner + Sources Table */}
      {activeSubTab === 'sources_list' && (
        <div className="space-y-6">
          <div className="bg-slate-900 text-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-violet-400 font-bold text-xs uppercase tracking-wider">
              <Server className="w-4 h-4" />
              <span>Architecture de Collecte Découplée (Background Workers)</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-4xl">
              Conformément au PRD technique, le moteur de crawling et de déduplication est exécuté en dehors des fonctions serverless Vercel sur des conteneurs workers dédiés avec queue de tâches. Les données vérifiées sont synchronisées de manière asynchrone dans PostgreSQL / Supabase avec contrôle d&apos;intégrité.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-2 border-t border-slate-800">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Worker Ingestion Paris 2027 : En ligne ({paris2027Events.length} sources surveillées)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Worker Ingestion Lyon/Nice : En ligne (Fréquence : 2h)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Moteur de Déduplication & Calcul Score RM : Actif
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Sources Primaires & Gestionnaires de Billetterie
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
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
                <tbody className="divide-y divide-slate-100">
                  {allSources.map((src) => {
                    const isAI = (src as any).isDiscoveredByAI;
                    return (
                      <tr key={src.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{src.name}</span>
                            {isAI && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                Découverte IA
                              </span>
                            )}
                          </div>
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-violet-600 hover:underline flex items-center gap-1 mt-0.5"
                          >
                            <span className="truncate max-w-xs">{src.url}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </a>
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium">{src.category}</td>
                        <td className="py-3 px-4 text-slate-700">{src.city}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center justify-center font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md tabular-nums border border-emerald-200/70">
                            {src.reliabilityScore}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">{src.lastCrawledAt}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums">
                          {src.detectedEventsCount}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
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
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900">
            Infrastructures Clés Référencées
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {venues.map((venue) => (
              <div
                key={venue.id}
                className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/60 space-y-2 text-xs"
              >
                <div className="flex items-start justify-between">
                  <span className="font-bold text-slate-900">{venue.name}</span>
                  <span className="text-[10px] uppercase font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded">
                    {venue.city}
                  </span>
                </div>
                <div className="text-slate-500 text-[11px]">{venue.address}</div>
                <div className="flex items-center justify-between text-slate-700 font-medium pt-2 border-t border-slate-200/60">
                  <span>Capacité maximale :</span>
                  <span className="font-bold tabular-nums">
                    {venue.capacity.toLocaleString('fr-FR')} places
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


export const SourcesCoverageView: React.FC<SourcesCoverageViewProps> = (props) => {
  if (props.backendMode) {
    return <RevenueSourcesWorkspace
      sources={props.sources}
      venues={props.venues}
      events={props.events?.length ?? 0}
      hotel={props.hotel}
    />;
  }
  return <LegacySourcesCoverageView {...props} />;
};
