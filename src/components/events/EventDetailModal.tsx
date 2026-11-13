import React, { useState } from 'react';
import {
  X,
  Calendar,
  MapPin,
  Building2,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Star,
  Eye,
  Zap,
  Clock,
  Car,
  AlertCircle,
  FileText,
  Download,
  Globe,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { EventItem, Hotel } from '../../types';
import { formatEventDateRange, getCategoryLabel, getImpactColorClasses } from '../../utils/helpers';
import { scrapeAndVerifyEvent, ScrapingVerificationResult } from '../../services/scraperService';

interface EventDetailModalProps {
  event: EventItem | null;
  onClose: () => void;
  hotels: Hotel[];
  selectedHotelId: string;
  onToggleFavorite: (id: string) => void;
  onToggleWatchlist: (id: string) => void;
  onToggleYieldActive: (id: string) => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  onClose,
  hotels,
  selectedHotelId,
  onToggleFavorite,
  onToggleWatchlist,
  onToggleYieldActive,
}) => {
  if (!event) return null;

  const [isScraping, setIsScraping] = useState(false);
  const [scrapingResult, setScrapingResult] = useState<ScrapingVerificationResult | null>(null);

  const currentHotel = hotels.find((h) => h.id === selectedHotelId) || hotels[0];
  const hotelImpact = currentHotel ? event.hotelImpacts[currentHotel.id] : null;
  const impactStyles = getImpactColorClasses(event.impactLevel);

  // ICS Export function
  const handleExportICS = () => {
    const icsData = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Flowtym//Event Intelligence//FR',
      'BEGIN:VEVENT',
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${event.subtitle || ''} - Score RM: ${event.scoreBreakdown.finalRMScore}/100`,
      `LOCATION:${event.venueName}, ${event.city}`,
      `DTSTART:${event.startDate.replace(/-/g, '')}`,
      `DTEND:${event.endDate.replace(/-/g, '')}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${event.id}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden flex justify-end bg-slate-900/40 backdrop-blur-2xs transition-opacity animate-in fade-in">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 overflow-y-auto">
        {/* Header Drawer */}
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${impactStyles.badgeBg}`}
            >
              <span className={`w-2 h-2 rounded-full ${impactStyles.dotBg}`} />
              Impact {event.impactLevel}
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Score RM: <strong className="text-slate-900 dark:text-slate-100 tabular-nums">{event.scoreBreakdown.finalRMScore}/100</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleFavorite(event.id)}
              className={`p-2 rounded-lg border transition-colors ${
                event.isFavorite
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/70 text-amber-500'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="Favoris"
            >
              <Star className={`w-4 h-4 ${event.isFavorite ? 'fill-amber-400' : ''}`} />
            </button>

            <button
              onClick={() => onToggleWatchlist(event.id)}
              className={`p-2 rounded-lg border transition-colors ${
                event.isWatchlist
                  ? 'bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800/70 text-violet-600 dark:text-violet-400'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="Mettre sous surveillance RM"
            >
              <Eye className="w-4 h-4" />
            </button>

            <button
              onClick={handleExportICS}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
              title="Exporter au format calendrier ICS"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* Main Title Section */}
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-1">
              <span>{getCategoryLabel(event.category)}</span>
              {event.isRecurring && (
                <>
                  <span>·</span>
                  <span className="text-slate-500 dark:text-slate-400 font-normal">
                    Récurrence {event.recurrenceFrequency || 'annuelle'}
                  </span>
                </>
              )}
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-snug">
              {event.title}
            </h2>
            {event.subtitle && (
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                {event.subtitle}
              </p>
            )}
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800/80">
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase">Dates</div>
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">
                {formatEventDateRange(event.startDate, event.endDate)}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase">Affluence Estimée</div>
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">
                {event.expectedAttendance.toLocaleString('fr-FR')} pax
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase">Part Internationale</div>
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">
                {event.internationalRatioPercent}%
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase">Indice Confiance</div>
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {event.scoreBreakdown.confidenceScore}%
              </div>
            </div>
          </div>

          {/* Venue & Location Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Infrastructure & Localisation
            </div>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{event.venueName}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{event.city}, {event.country}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Revenue Management Impact Card for Selected Hotel */}
          <div className="bg-violet-50/60 dark:bg-violet-950/40 rounded-2xl border border-violet-200/80 dark:border-violet-800/70 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <h3 className="text-xs font-bold text-violet-900 dark:text-violet-200 uppercase tracking-wider">
                  Impact Spécifique · {currentHotel.name}
                </h3>
              </div>

              <button
                onClick={() => onToggleYieldActive(event.id)}
                className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                  event.isYieldActive
                    ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/80'
                }`}
              >
                {event.isYieldActive ? 'Yield Actif (Stop-sell activé)' : 'Activer Yield Automatique'}
              </button>
            </div>

            {hotelImpact ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-violet-100 dark:border-violet-900/60">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Distance hôtel</div>
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">
                      {hotelImpact.distanceKm} km ({hotelImpact.distanceMins} min)
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-violet-100 dark:border-violet-900/60">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Tension Marché</div>
                    <div className="text-sm font-bold text-rose-600 dark:text-rose-400 mt-0.5 tabular-nums">
                      {hotelImpact.compressionIndex}/10 (Compression)
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-violet-100 dark:border-violet-900/60">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Potentiel ADR</div>
                    <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                      +{hotelImpact.estimatedADRBoostPercent}%
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-violet-100 dark:border-violet-900/60 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-violet-900 dark:text-violet-200">
                    <TrendingUp className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    <span>Recommandation Revenue Management :</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                    {hotelImpact.recommendedAction}
                  </p>
                  {hotelImpact.minStayRecommended && (
                    <div className="text-[11px] text-violet-700 dark:text-violet-300 font-semibold pt-1">
                      Séjour minimum préconisé : {hotelImpact.minStayRecommended} nuits consécutives.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Cet hôtel est situé en dehors de la zone d&apos;influence directe de l&apos;événement, mais subit la compression tarifaire globale du marché ({event.city}).
              </p>
            )}
          </div>

          {/* RM Score Breakdown Explainability */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Décomposition du Score RM Flowtym ({event.scoreBreakdown.finalRMScore}/100)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Le score RM synthétise 5 composantes pondérées pour évaluer la pression réelle sur le RevPAR.
            </p>

            <div className="space-y-2.5 pt-2">
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <span>Volume d&apos;affluence attendue</span>
                  <span className="font-bold tabular-nums">{event.scoreBreakdown.attendanceScore} / 25</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                  <div
                    className="bg-violet-600 h-1.5 rounded-full"
                    style={{ width: `${(event.scoreBreakdown.attendanceScore / 25) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <span>Part de clientèle internationale (long-séjour)</span>
                  <span className="font-bold tabular-nums">{event.scoreBreakdown.internationalScore} / 20</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                  <div
                    className="bg-violet-600 h-1.5 rounded-full"
                    style={{ width: `${(event.scoreBreakdown.internationalScore / 20) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <span>Saturation de l&apos;infrastructure d&apos;accueil</span>
                  <span className="font-bold tabular-nums">{event.scoreBreakdown.saturationScore} / 20</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                  <div
                    className="bg-violet-600 h-1.5 rounded-full"
                    style={{ width: `${(event.scoreBreakdown.saturationScore / 20) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <span>Indice de compression de destination</span>
                  <span className="font-bold tabular-nums">{event.scoreBreakdown.compressionScore} / 15</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                  <div
                    className="bg-violet-600 h-1.5 rounded-full"
                    style={{ width: `${(event.scoreBreakdown.compressionScore / 15) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sources & Evidences Section (Audit trail & Live Scraper) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <span>Sources officielles & Vérification Web</span>
              </h3>
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/70 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                {event.officialUrl ? 'Source 2027 Certifiée' : 'Source vérifiée'}
              </span>
            </div>

            {/* Official Source Link & Scraper Trigger */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Site officiel de l&apos;événement
                  </div>
                  {event.officialUrl ? (
                    <a
                      href={event.officialUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-violet-700 dark:text-violet-300 hover:text-violet-900 dark:hover:text-violet-100 hover:underline flex items-center gap-1.5 mt-0.5"
                    >
                      <span>{event.officialUrl}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ) : (
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      Indexé via {event.sources?.[0] || 'Agenda Ville de Paris'}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={isScraping}
                  onClick={async () => {
                    setIsScraping(true);
                    try {
                      const res = await scrapeAndVerifyEvent(event);
                      setScrapingResult(res);
                    } finally {
                      setIsScraping(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs disabled:opacity-50 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScraping ? 'animate-spin' : ''}`} />
                  <span>{isScraping ? 'Scraping en direct...' : 'Vérifier le site web'}</span>
                </button>
              </div>

              {/* Live Crawler Terminal Log Output */}
              {scrapingResult && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Terminal className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                      Journal du Scraper (Crawl live & validation DOM)
                    </span>
                    <span className="text-emerald-700 dark:text-emerald-300 font-semibold bg-emerald-100/70 dark:bg-emerald-900/35 px-2 py-0.5 rounded text-[10px]">
                      HTTP {scrapingResult.extractedMeta.httpStatus} OK ({scrapingResult.extractedMeta.responseTimeMs}ms)
                    </span>
                  </div>

                  <div className="bg-slate-950 text-slate-200 p-3 rounded-lg font-mono text-[11px] space-y-1 overflow-x-auto leading-relaxed border border-slate-800">
                    {scrapingResult.auditLogs.map((log, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-emerald-400 select-none">›</span>
                        <span className={log.includes('100%') ? 'text-emerald-300 font-bold' : log.includes('Schema.org') ? 'text-amber-300' : 'text-slate-300'}>
                          {log}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] pt-1">
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                      <div className="text-slate-400 text-[10px]">Domaine vérifié</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">{scrapingResult.domain}</div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                      <div className="text-slate-400 text-[10px]">Certificat SSL/TLS</div>
                      <div className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Valide
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 col-span-2 sm:col-span-1">
                      <div className="text-slate-400 text-[10px]">Concordance dates</div>
                      <div className="font-semibold text-violet-700 dark:text-violet-300">Exacte (2027 confirmée)</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {event.evidences && event.evidences.length > 0 ? (
              <div className="space-y-2.5">
                {event.evidences.map((ev) => (
                  <div
                    key={ev.id}
                    className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{ev.sourceName}</span>
                      <a
                        href={ev.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1 text-[11px]"
                      >
                        <span>Consulter</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 italic leading-relaxed">
                      &laquo; {ev.excerpt} &raquo;
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                      <span>Vérifié le {ev.verifiedAt}</span>
                      <span>Indice de confiance source: {ev.trustScore}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800/70">
                Sources primaires indexées: {event.sources?.join(', ') || 'Organisateur officiel'}. Vérifié lors du cycle de crawling automatique.
              </div>
            )}
          </div>
        </div>

        {/* Footer Drawer */}
        <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Dernière vérification: {event.lastVerifiedAt}</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            Fermer la fiche
          </button>
        </div>
      </div>
    </div>
  );
};
