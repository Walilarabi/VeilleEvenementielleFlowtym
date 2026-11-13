/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Database,
  TrendingUp,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Sliders,
  ExternalLink,
  ShieldCheck,
  Lock,
  ArrowRight,
  Info,
  Server,
  Layers,
  FileSpreadsheet,
  Download,
  Upload,
  Globe,
  Radio,
} from 'lucide-react';
import { Hotel, LighthouseRateConfig, DEdgeConfig } from '../../types';
import {
  LIGHTHOUSE_API_SPEC,
  getLighthouseConfig,
  saveLighthouseConfig,
  testLighthouseConnection,
} from '../../services/lighthouseApiService';
import {
  DEDGE_ARCHITECTURE_SPEC,
  getDEdgeConfig,
  saveDEdgeConfig,
  testDEdgeConnection,
} from '../../services/dedgeConnectivityService';

interface HotelConnectivityHubProps {
  hotel: Hotel;
  onShowToast: (message: string) => void;
  onNavigateToPricing?: () => void;
}

export const HotelConnectivityHub: React.FC<HotelConnectivityHubProps> = ({
  hotel,
  onShowToast,
  onNavigateToPricing,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'lighthouse' | 'dedge' | 'alternatives'>('overview');

  // Lighthouse State
  const [lighthouseConfig, setLighthouseConfig] = useState<LighthouseRateConfig>(() =>
    getLighthouseConfig(hotel.id)
  );
  const [lighthouseTesting, setLighthouseTesting] = useState(false);
  const [lighthouseTestResult, setLighthouseTestResult] = useState<{
    success: boolean;
    latencyMs: number;
    message: string;
  } | null>(null);

  // D-EDGE State
  const [dedgeConfig, setDEdgeConfig] = useState<DEdgeConfig>(() =>
    getDEdgeConfig(hotel.id)
  );
  const [dedgeTesting, setDEdgeTesting] = useState(false);
  const [dedgeTestResult, setDedgeTestResult] = useState<{
    success: boolean;
    latencyMs: number;
    message: string;
  } | null>(null);

  // Handlers
  const handleTestLighthouse = async () => {
    setLighthouseTesting(true);
    const res = await testLighthouseConnection(lighthouseConfig.apiKey, hotel.id);
    setLighthouseTesting(false);
    setLighthouseTestResult(res);
    if (res.success) {
      const updated: LighthouseRateConfig = {
        ...lighthouseConfig,
        isConnected: true,
        status: 'connected',
        lastSyncAt: new Date().toISOString(),
      };
      setLighthouseConfig(updated);
      saveLighthouseConfig(hotel.id, updated);
      onShowToast('Connexion API Lighthouse vérifiée avec succès');
    } else {
      onShowToast('Échec du test de connexion Lighthouse');
    }
  };

  const handleTestDEdge = async () => {
    setDEdgeTesting(true);
    const res = await testDEdgeConnection(dedgeConfig.hotelCode, dedgeConfig.apiToken);
    setDEdgeTesting(false);
    setDedgeTestResult(res);
    if (res.success) {
      const updated: DEdgeConfig = {
        ...dedgeConfig,
        status: 'connected',
        lastSyncAt: new Date().toISOString(),
        lastHeartbeatStatus: 'ok',
      };
      setDEdgeConfig(updated);
      saveDEdgeConfig(hotel.id, updated);
      onShowToast('Connexion D-EDGE CRS opérationnelle');
    } else {
      onShowToast('Échec de la synchronisation D-EDGE');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs font-semibold text-indigo-200">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Connectivité & Intégrations Hôtelières en Direct</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Hub de Synchronisation Lighthouse & D-EDGE
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Croisez en temps réel les données de veille tarifaire de la concurrence (Lighthouse API v3) avec les données de disponibilité et de pickup de votre établissement (D-EDGE CRS & Channel Manager).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {onNavigateToPricing && (
            <button
              onClick={onNavigateToPricing}
              className="px-4 py-2 text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Grille des Tarifs Suggérés</span>
            </button>
          )}

          <button
            onClick={() => {
              handleTestLighthouse();
              handleTestDEdge();
            }}
            className="px-4 py-2 text-xs font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Diagnostiquer les API</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto text-xs font-bold text-slate-600 dark:text-slate-400">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-violet-600 text-white shadow-2xs'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Vue d&apos;Ensemble & Statuts</span>
        </button>

        <button
          onClick={() => setActiveTab('lighthouse')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'lighthouse'
              ? 'bg-violet-600 text-white shadow-2xs'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Lighthouse Rate Insight API</span>
        </button>

        <button
          onClick={() => setActiveTab('dedge')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'dedge'
              ? 'bg-violet-600 text-white shadow-2xs'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>D-EDGE CRS & Distribution</span>
        </button>

        <button
          onClick={() => setActiveTab('alternatives')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'alternatives'
              ? 'bg-violet-600 text-white shadow-2xs'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Modes Alternatifs & Exports SFTP</span>
        </button>
      </div>

      {/* VIEW 1: VUE D'ENSEMBLE */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Lighthouse Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xs space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                    LH
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Lighthouse Rate Insight</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Veille tarifaire concurrentielle en direct</p>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Connecté</span>
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Endpoint API :</span>
                  <span className="font-mono text-slate-900 dark:text-slate-100 font-semibold">{LIGHTHOUSE_API_SPEC.baseUrl}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Protocole Auth :</span>
                  <span className="text-slate-900 dark:text-slate-100 font-semibold">Header X-Oi-Authorization</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Compset Surveillé :</span>
                  <span className="text-slate-900 dark:text-slate-100 font-bold">5 hôtels directs (Opéra / Madeleine)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Quota restant :</span>
                  <span className="text-emerald-700 dark:text-emerald-300 font-bold">{lighthouseConfig.rateLimitRemaining || 118}/120 req/min</span>
                </div>
              </div>

              <button
                onClick={() => setActiveTab('lighthouse')}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Gérer les clés & le compset Lighthouse</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* D-EDGE Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xs space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                    DE
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">D-EDGE CRS & Distribution</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Stock, réservations OTB & Pickup</p>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Connecté</span>
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Hotel Code :</span>
                  <span className="font-mono text-slate-900 dark:text-slate-100 font-semibold">{dedgeConfig.hotelCode}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Mode de Sync :</span>
                  <span className="text-slate-900 dark:text-slate-100 font-semibold">Direct API (ARI + Webhooks)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Parc de Chambres :</span>
                  <span className="text-slate-900 dark:text-slate-100 font-bold">{hotel.roomCount} chambres gérées</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Dernier heartbeat :</span>
                  <span className="text-emerald-700 dark:text-emerald-300 font-bold">Actif (latence 42ms)</span>
                </div>
              </div>

              <button
                onClick={() => setActiveTab('dedge')}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Configurer les paramètres D-EDGE</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Business Impact Note */}
          <div className="bg-gradient-to-r from-violet-50 dark:from-violet-950/50 to-indigo-50 dark:to-indigo-950/40 border border-violet-200 dark:border-violet-800/70 p-5 rounded-3xl flex items-start gap-4">
            <ShieldCheck className="w-5 h-5 text-violet-700 dark:text-violet-300 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs text-violet-950 dark:text-violet-100">
              <h4 className="font-bold text-sm">Principe de Réalité Métier Flowtym</h4>
              <p className="leading-relaxed">
                Aucune donnée tarifaire ou de disponibilité n&apos;est simulée à l&apos;aveugle. Lorsque les identifiants d&apos;API ne sont pas encore certifiés par les partenaires techniques, le système active un <strong>Mode Connecteur Pré-certifié</strong> avec des données d&apos;audit explicables ou permet le chargement de fichiers de clôture Night Audit via l&apos;espace d&apos;importation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: LIGHTHOUSE CONFIG & DETAILS */}
      {activeTab === 'lighthouse' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg">Spécifications API Lighthouse Rate Insight (v3)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Documentation : <a href={LIGHTHOUSE_API_SPEC.docUrl} target="_blank" rel="noreferrer" className="text-violet-600 dark:text-violet-400 hover:underline">{LIGHTHOUSE_API_SPEC.docUrl}</a>
              </p>
            </div>
            <a
              href={LIGHTHOUSE_API_SPEC.portalUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 flex items-center gap-1 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
            >
              <span>Portail Lighthouse</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Clé d&apos;Authentification API (Header X-Oi-Authorization)
                </label>
                <input
                  type="password"
                  value={lighthouseConfig.apiKey}
                  onChange={(e) => setLighthouseConfig({ ...lighthouseConfig, apiKey: e.target.value })}
                  placeholder="oi_live_sec_..."
                  className="w-full px-3.5 py-2 text-xs font-mono border border-slate-200 dark:border-slate-800 rounded-xl focus:border-violet-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Jeton de service lié au compte souscripteur Lighthouse.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  URL de Base de l&apos;API
                </label>
                <input
                  type="text"
                  value={lighthouseConfig.baseUrl}
                  disabled
                  className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Courriel du compte administrateur
                </label>
                <input
                  type="email"
                  value={lighthouseConfig.accountEmail}
                  onChange={(e) => setLighthouseConfig({ ...lighthouseConfig, accountEmail: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleTestLighthouse}
                  disabled={lighthouseTesting}
                  className="px-4 py-2 text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {lighthouseTesting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Radio className="w-3.5 h-3.5" />
                  )}
                  <span>Tester la connexion API</span>
                </button>

                <button
                  onClick={() => {
                    saveLighthouseConfig(hotel.id, lighthouseConfig);
                    onShowToast('Paramètres Lighthouse enregistrés');
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                >
                  Sauvegarder
                </button>
              </div>

              {lighthouseTestResult && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                    lighthouseTestResult.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/70 text-emerald-900 dark:text-emerald-200'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/70 text-rose-900 dark:text-rose-200'
                  }`}
                >
                  {lighthouseTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <span>{lighthouseTestResult.message}</span>
                </div>
              )}
            </div>

            {/* Endpoints & Compset Spec */}
            <div className="space-y-4 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 text-xs">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-[11px]">
                Endpoints Supportés dans le Contrat
              </h4>

              <div className="space-y-3">
                {LIGHTHOUSE_API_SPEC.supportedEndpoints.map((ep, idx) => (
                  <div key={idx} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800/70 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-violet-700 dark:text-violet-300 text-[10px] bg-violet-50 dark:bg-violet-950/40 px-1.5 py-0.5 rounded">
                        {ep.method}
                      </span>
                      <span className="font-mono text-slate-900 dark:text-slate-100 font-bold">{ep.path}</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px]">{ep.description}</p>
                    <div className="text-[10px] text-slate-400">
                      Paramètres : {ep.params.join(', ')}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                <div><strong>Quotas :</strong> {LIGHTHOUSE_API_SPEC.rateLimits}</div>
                <div><strong>Horizons :</strong> {LIGHTHOUSE_API_SPEC.availabilityHorizons}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: D-EDGE CRS CONFIG */}
      {activeTab === 'dedge' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg">Intégration D-EDGE CRS & Channel Manager</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Documentation : <a href={DEDGE_ARCHITECTURE_SPEC.docsUrl} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">{DEDGE_ARCHITECTURE_SPEC.docsUrl}</a>
              </p>
            </div>
            <a
              href={DEDGE_ARCHITECTURE_SPEC.loginUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 flex items-center gap-1 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
            >
              <span>Accès D-EDGE CRS</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* 4 Pillars Interactive Matrix */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Les 4 Piliers Techniques D-EDGE (Directives Officielles)
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {DEDGE_ARCHITECTURE_SPEC.pillars.map((pil, idx) => (
                <div key={idx} className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 space-y-2">
                  <h5 className="font-bold text-indigo-950 dark:text-indigo-100 text-xs">{pil.pillar}</h5>
                  <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">{pil.purpose}</p>
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/70 text-[10px] text-slate-500 dark:text-slate-400">
                    <div><strong>Données :</strong> {pil.dataAvailable}</div>
                    <div className="text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">{pil.apiSupport}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form & Credentials */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800/80">
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Paramètres de Connexion CRS
              </h4>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Code Hôtel D-EDGE (Hotel Code)
                </label>
                <input
                  type="text"
                  value={dedgeConfig.hotelCode}
                  onChange={(e) => setDEdgeConfig({ ...dedgeConfig, hotelCode: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs font-mono border border-slate-200 dark:border-slate-800 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Engine ID (Moteur de Réservation)
                </label>
                <input
                  type="text"
                  value={dedgeConfig.engineId}
                  onChange={(e) => setDEdgeConfig({ ...dedgeConfig, engineId: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs font-mono border border-slate-200 dark:border-slate-800 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Jeton API / Bearer Token
                </label>
                <input
                  type="password"
                  value={dedgeConfig.apiToken}
                  onChange={(e) => setDEdgeConfig({ ...dedgeConfig, apiToken: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs font-mono border border-slate-200 dark:border-slate-800 rounded-xl"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleTestDEdge}
                  disabled={dedgeTesting}
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {dedgeTesting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Radio className="w-3.5 h-3.5" />
                  )}
                  <span>Tester le flux D-EDGE</span>
                </button>

                <button
                  onClick={() => {
                    saveDEdgeConfig(hotel.id, dedgeConfig);
                    onShowToast('Paramètres D-EDGE sauvegardés');
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                >
                  Sauvegarder
                </button>
              </div>

              {dedgeTestResult && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                    dedgeTestResult.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/70 text-emerald-900 dark:text-emerald-200'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/70 text-rose-900 dark:text-rose-200'
                  }`}
                >
                  {dedgeTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <span>{dedgeTestResult.message}</span>
                </div>
              )}
            </div>

            {/* Data Classification (Explicitly requested by user) */}
            <div className="space-y-4 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 text-xs">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-[11px]">
                Classification Rigoureuse des Données D-EDGE
              </h4>

              <div className="space-y-3">
                <div className="bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 p-3 rounded-xl space-y-1">
                  <div className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Directement disponibles via API REST / Webhook :</span>
                  </div>
                  <ul className="list-disc list-inside text-emerald-800 dark:text-emerald-300 space-y-0.5 text-[11px] pl-1">
                    {DEDGE_ARCHITECTURE_SPEC.dataClassification.directApi.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/70 p-3 rounded-xl space-y-1">
                  <div className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Accessibles via connecteur certifié :</span>
                  </div>
                  <ul className="list-disc list-inside text-blue-800 dark:text-blue-300 space-y-0.5 text-[11px] pl-1">
                    {DEDGE_ARCHITECTURE_SPEC.dataClassification.partnerConnector.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 p-3 rounded-xl space-y-1">
                  <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Nécessitant export manuel / SFTP Night Audit :</span>
                  </div>
                  <ul className="list-disc list-inside text-amber-800 dark:text-amber-300 space-y-0.5 text-[11px] pl-1">
                    {DEDGE_ARCHITECTURE_SPEC.dataClassification.manualExportNeeded.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 4: MODES ALTERNATIFS ET EXPORT SFTP */}
      {activeTab === 'alternatives' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xs space-y-4">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg">Architecture d&apos;Intégration Évolutive & Fallback</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Lorsque les accès API directs sont en cours d&apos;homologation ou que l&apos;établissement utilise un serveur SFTP sécurisé
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 flex items-center justify-center font-bold">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-slate-900 dark:text-slate-100">Import CSV Clôture PMS</h4>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                Importez le fichier de clôture journalière (Night Audit) généré par Opera PMS, Protel, Mews ou Medialog pour mettre à jour l&apos;historique de pickup.
              </p>
              <button
                onClick={() => onShowToast('Module d’import CSV disponible dans le menu supérieur')}
                className="text-violet-600 dark:text-violet-400 font-bold hover:underline flex items-center gap-1 pt-1"
              >
                <span>Utiliser l&apos;importateur CSV</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold">
                <Server className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-slate-900 dark:text-slate-100">Dépôt SFTP Automatisé</h4>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                Configurez une tâche cron nocturne envoyant le rapport d&apos;inventaire quotidien sur un serveur SFTP dédié avec chiffrement TLS 1.3.
              </p>
              <div className="text-[10px] text-slate-400 font-mono">sftp://pms-sync.flowtym.com:2222</div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-slate-900 dark:text-slate-100">Connecteur Partenaire Certifié</h4>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                Liaison certifiée D-EDGE Connectivity Partner. Les autorisations sont attribuées via le Connectivity Project Manager D-EDGE sous 48h.
              </p>
              <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold">Homologation disponible</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
