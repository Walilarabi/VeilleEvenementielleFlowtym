import React, { useMemo, useState } from 'react';
import { Activity, ArrowDownToLine, ArrowLeftRight, CalendarDays, CheckCircle2, Database, FileSpreadsheet, Info, Link2, LockKeyhole, Plug, RefreshCw, Search, ShieldAlert, UploadCloud, Workflow } from 'lucide-react';
import * as XLSX from 'xlsx';
import { importHoptymFile, HoptymImportDataset } from '../../services/hoptymImportService';
import { Hotel } from '../../types';

type ProviderCategory = 'rate_shopper' | 'channel_manager' | 'pms' | 'events';

interface Provider {
  id: string;
  name: string;
  category: ProviderCategory;
  docs: string;
  apiSummary: string;
  readCapabilities: string[];
  writeCapabilities: string[];
  access: 'public_docs' | 'partner_required' | 'to_qualify';
  note: string;
}

const PROVIDERS: Provider[] = [
  { id: 'lighthouse', name: 'Lighthouse (OTA Insight)', category: 'rate_shopper', docs: 'https://api.mylighthouse.com/', apiSummary: 'API v3 de reporting et de collecte de données tarifaires ; Live Rate Shopping et Raw Rates selon droits.', readCapabilities: ['Hôtels & compsets', 'Tarifs observés', 'Parity / demande selon abonnement'], writeCapabilities: [], access: 'public_docs', note: 'API orientée reporting. Quotas et droits de visualisation commerciale à vérifier par contrat.' },
  { id: 'rategain-ri', name: 'RateGain Rate Intelligence', category: 'rate_shopper', docs: 'https://rategain.com/solutions-for-rms-companies/', apiSummary: 'API REST entrante/sortante pour RMS : historique des prix, hôtels, calendrier de shopping et push de changements.', readCapabilities: ['Hôtels & compsets', 'Historique tarifaire', 'Calendriers de shopping'], writeCapabilities: ['Réception de changements tarifaires côté RMS'], access: 'partner_required', note: 'Spécification technique détaillée et accès partenaire à demander.' },
  { id: 'ratetiger', name: 'RateTiger Shopper', category: 'rate_shopper', docs: 'https://www.ratetiger.com/', apiSummary: 'Solution à qualifier pour la veille concurrentielle.', readCapabilities: ['À confirmer avec le fournisseur'], writeCapabilities: [], access: 'to_qualify', note: 'Ne pas supposer l’existence d’une API publique.' },
  { id: 'dedge-ratescreener', name: 'D-EDGE RateScreener / Rate Shopping', category: 'rate_shopper', docs: 'https://developers.portal.d-edge.com/', apiSummary: 'Offre Rate Shopper et API exactes à confirmer auprès de D-EDGE.', readCapabilities: ['À confirmer'], writeCapabilities: [], access: 'to_qualify', note: 'Ne pas confondre le CRS/Channel Manager D-EDGE avec un rate shopper.' },
  { id: 'beonx', name: 'BEONx / BEONPRICE', category: 'rate_shopper', docs: 'https://www.beonx.com/', apiSummary: 'Plateforme de revenue management et pricing à qualifier comme source/partenaire.', readCapabilities: ['Données et métriques selon contrat'], writeCapabilities: [], access: 'to_qualify', note: 'Demander le catalogue API, les scopes et les droits de réutilisation.' },
  { id: 'siteminder-insights', name: 'SiteMinder Insights', category: 'rate_shopper', docs: 'https://developer.siteminder.com/', apiSummary: 'Rate shopping, parity et intelligence marché dans l’écosystème SiteMinder.', readCapabilities: ['Tarifs concurrents', 'Parity / visibilité selon produit'], writeCapabilities: [], access: 'to_qualify', note: 'API Insights dédiée et droits d’accès à confirmer ; ne pas confondre avec pmsXchange.' },
  { id: 'fornova', name: 'Fornova Competitive Intelligence', category: 'rate_shopper', docs: 'https://www.fornova.com/competitive-intelligence', apiSummary: 'Veille concurrentielle et rate shopping par compset, canaux et points de vente.', readCapabilities: ['Tarifs concurrents', 'Compset', 'Positionnement et visibilité'], writeCapabilities: [], access: 'partner_required', note: 'API/exports et droits de redistribution à obtenir auprès du fournisseur.' },
  { id: 'optimand', name: 'Optimand Rate Shopper', category: 'rate_shopper', docs: 'https://www.optimand.com/rate-shopper-en-landing/', apiSummary: 'Rate shopper hôtelier avec compset et collecte concurrentielle.', readCapabilities: ['Tarifs concurrents', 'Compset'], writeCapabilities: [], access: 'to_qualify', note: 'Documentation API partenaire non confirmée ; demander un flux ou export structuré.' },
  { id: 'hotellistat', name: 'Hotellistat', category: 'rate_shopper', docs: 'https://www.hotellistat.com/en/pricing', apiSummary: 'Suite hôtelière comprenant un rate shopper, du market intelligence et du revenue management.', readCapabilities: ['Rate shopping', 'Historique tarifaire', 'Compset'], writeCapabilities: [], access: 'to_qualify', note: 'Clarifier le périmètre API et les options d’export / rate feed.' },
  { id: 'price-seeker', name: 'Price Seeker (Paraty Tech)', category: 'rate_shopper', docs: 'https://priceseeker.paratytech.com/en/', apiSummary: 'Rate shopper avec monitoring concurrentiel, parité et alertes.', readCapabilities: ['Tarifs concurrents', 'Parité', 'Compset'], writeCapabilities: [], access: 'to_qualify', note: 'Demander le contrat d’API/export et les conditions de réutilisation des observations.' },
  { id: 'sightprice', name: 'SightPrice', category: 'rate_shopper', docs: 'https://sightprice.com/', apiSummary: 'Surveillance quotidienne des prix publics et disponibilité concurrente pour hôtels indépendants.', readCapabilities: ['Prix publics observés', 'Disponibilité concurrente', 'Historique selon abonnement'], writeCapabilities: [], access: 'to_qualify', note: 'Produit orienté rapports ; vérifier la disponibilité d’une API ou d’un export structuré avant intégration.' },
  { id: 'amadeus-rate360', name: 'Amadeus Rate360 / PricePosition', category: 'rate_shopper', docs: 'https://ideas.com/wp-content/uploads/2025/12/IDeaS_Integration_Partners_Snapshot.pdf', apiSummary: 'Solutions de rate shopping Amadeus référencées dans le catalogue d’intégrations IDeaS.', readCapabilities: ['Tarifs concurrents / benchmarking selon produit'], writeCapabilities: [], access: 'partner_required', note: 'Lien fourni comme référence de catalogue, pas comme documentation API. Demander le guide d’intégration Amadeus.' },
  { id: 'hotel-compete', name: 'Hotel Compete', category: 'rate_shopper', docs: 'https://ideas.com/wp-content/uploads/2025/12/IDeaS_Integration_Partners_Snapshot.pdf', apiSummary: 'Solution de benchmarking / rate shopping référencée dans le catalogue d’intégrations IDeaS.', readCapabilities: ['Compset et benchmarking selon produit'], writeCapabilities: [], access: 'to_qualify', note: 'Référence de catalogue uniquement ; fournisseur et API à qualifier.' },
  { id: 'ratemate', name: 'RateMate', category: 'rate_shopper', docs: 'https://ideas.com/wp-content/uploads/2025/12/IDeaS_Integration_Partners_Snapshot.pdf', apiSummary: 'Solution rate-shopping référencée dans le catalogue d’intégrations IDeaS.', readCapabilities: ['Tarifs concurrents selon produit'], writeCapabilities: [], access: 'to_qualify', note: 'Référence de catalogue uniquement ; demander la documentation API officielle.' },
  { id: 'scignus-irexplorer', name: 'Scignus iRateExplorer', category: 'rate_shopper', docs: 'https://ideas.com/wp-content/uploads/2025/12/IDeaS_Integration_Partners_Snapshot.pdf', apiSummary: 'Solution de rate shopping référencée dans le catalogue d’intégrations IDeaS.', readCapabilities: ['Tarifs concurrents selon produit'], writeCapabilities: [], access: 'to_qualify', note: 'Référence de catalogue uniquement ; demander la documentation API officielle.' },
  { id: 'binocle', name: 'Binocle Rate Shopper', category: 'rate_shopper', docs: 'https://ideas.com/wp-content/uploads/2025/12/IDeaS_Integration_Partners_Snapshot.pdf', apiSummary: 'Solution de rate shopping référencée dans le catalogue d’intégrations IDeaS.', readCapabilities: ['Tarifs concurrents selon produit'], writeCapabilities: [], access: 'to_qualify', note: 'Référence de catalogue uniquement ; demander la documentation API officielle.' },
  { id: 'siteminder', name: 'SiteMinder', category: 'channel_manager', docs: 'https://www.siteminder.com/developer-guide/', apiSummary: 'SiteConnect, pmsXchange, SiteMinder Exchange API et Channels Plus.', readCapabilities: ['Réservations', 'Disponibilités', 'Tarifs', 'Restrictions'], writeCapabilities: ['Push ARI', 'Push restrictions', 'Synchronisation réservations selon produit'], access: 'partner_required', note: 'pmsXchange est présenté comme une API 2-Way PMS/RMS ; certification et scopes requis.' },
  { id: 'dedge', name: 'D-EDGE CRS / Channel Manager', category: 'channel_manager', docs: 'https://developers.portal.d-edge.com/', apiSummary: 'Portail partenaire ; CRS Planning Services et CRS Description Services, plus interfaces contractuelles.', readCapabilities: ['Contenu hôtel/chambres/tarifs', 'Réservations selon interface', 'Disponibilité selon droits'], writeCapabilities: ['ARI / restrictions selon interface certifiée'], access: 'partner_required', note: 'Obtenir le contrat OpenAPI/WSDL et le mapping exact. Les noms d’endpoints ne sont pas inventés.' },
  { id: 'vertical-booking', name: 'Vertical Booking', category: 'channel_manager', docs: 'https://online.verticalbooking.ovosodo.net/en/connectivity/api-xml/', apiSummary: 'API-XML, interfaces réplicatives et transactionnelles, API PMS.', readCapabilities: ['Réservations', 'Disponibilités', 'Tarifs', 'Restrictions'], writeCapabilities: ['ARI répliqué', 'Get Availability / Make Reservation selon interface'], access: 'partner_required', note: 'Les flux exacts et le sens des échanges dépendent du type d’interface.' },
  { id: 'cloudbeds-cm', name: 'Cloudbeds Distribution', category: 'channel_manager', docs: 'https://developers.cloudbeds.com/', apiSummary: 'APIs de distribution, plans tarifaires, disponibilités, restrictions et événements.', readCapabilities: ['Réservations', 'Tarifs', 'Disponibilités', 'Restrictions'], writeCapabilities: ['Tarifs / disponibilité / restrictions selon scopes'], access: 'partner_required', note: 'Sandbox disponible ; scopes et accès partenaire à confirmer.' },
  { id: 'mews', name: 'Mews PMS', category: 'pms', docs: 'https://docs.mews.com/', apiSummary: 'Connector API, Channel Manager API et Booking Engine API.', readCapabilities: ['Réservations', 'Ressources & inventaire', 'Tarifs & services', 'Événements'], writeCapabilities: ['Ajout / mise à jour réservations et disponibilité selon opérations autorisées'], access: 'partner_required', note: 'Partner ID et processus de certification ; utiliser le sandbox Mews.' },
  { id: 'apaleo', name: 'Apaleo PMS', category: 'pms', docs: 'https://apaleo.dev/', apiSummary: 'Core APIs, Booking, Distribution, Inventory, Rate Plan, Identity et Webhooks.', readCapabilities: ['Réservations', 'Inventaire', 'Tarifs', 'Profils'], writeCapabilities: ['Réservations', 'Tarifs / restrictions selon scopes'], access: 'public_docs', note: 'OAuth 2.0 ; scopes détaillés dans Swagger.' },
  { id: 'opera', name: 'Oracle OPERA Cloud (OHIP)', category: 'pms', docs: 'https://www.oracle.com/hospitality/integration-platform/', apiSummary: 'Reservation, Rate, Price Availability Rate, Inventory, Distribution, Business Events et Data APIs.', readCapabilities: ['Réservations', 'Tarifs', 'Inventaire', 'Profils', 'Business Events'], writeCapabilities: ['Réservations', 'Tarifs', 'Sell limits / restrictions selon API et permissions'], access: 'partner_required', note: 'OAuth 2.0, application keys, permissions API et environnement non-production.' },
  { id: 'cloudbeds-pms', name: 'Cloudbeds PMS', category: 'pms', docs: 'https://developers.cloudbeds.com/', apiSummary: 'PMS API, Data Insights, Distribution, Webhooks & Events.', readCapabilities: ['Réservations', 'Clients', 'Chambres', 'Folios', 'Inventaire'], writeCapabilities: ['Réservations / distribution selon scopes'], access: 'public_docs', note: 'OAuth/API keys selon le programme ; sandbox api.cloudbeds-stage.com.' },
  { id: 'stayntouch', name: 'Stayntouch PMS', category: 'pms', docs: 'https://api-specs.stayntouch.com/v2/index.html', apiSummary: 'Connect API v2 avec accès lecture/écriture, OAuth 2.0 et webhooks.', readCapabilities: ['Réservations', 'Tarifs', 'Inventaire', 'Revenus', 'Événements webhook'], writeCapabilities: ['Réservations', 'Tarifs et restrictions selon scopes'], access: 'partner_required', note: 'NDA, autorisation de l’hôtel, sandbox/UAT et certification nécessaires.' },
  { id: 'clock', name: 'Clock PMS+', category: 'pms', docs: 'https://api-docs.clock-software.com/', apiSummary: 'PMS API REST, Base API, Yield Management API, OTA Channel Connect et Message Channels.', readCapabilities: ['Réservations', 'Chambres', 'Tarifs', 'Disponibilités', 'Événements push/pull'], writeCapabilities: ['Réservations et yield management selon API'], access: 'partner_required', note: 'Digest authentication et compte sandbox/partenaire ; vérifier chaque famille d’API.' },
  { id: 'guestline', name: 'Guestline Rezlynx', category: 'pms', docs: 'https://developers.guestline.com/', apiSummary: 'Portail API REST du PMS Rezlynx avec processus d’onboarding partenaire.', readCapabilities: ['Données PMS selon endpoints activés'], writeCapabilities: ['Opérations documentées dans le portail partenaire'], access: 'partner_required', note: 'Suivre l’onboarding et obtenir les credentials avant de figer le mapping.' },
  { id: 'protel', name: 'Protel / Planet', category: 'pms', docs: 'https://www.protel.net/', apiSummary: 'Écosystème PMS à qualifier selon la version Protel installée et l’interface partenaire disponible.', readCapabilities: ['Réservations et inventaire selon connecteur'], writeCapabilities: ['Tarifs / restrictions selon interface certifiée'], access: 'to_qualify', note: 'Obtenir le guide d’interface exact, la version du PMS et le mapping du client.' },
  { id: 'roomraccoon', name: 'RoomRaccoon PMS', category: 'pms', docs: 'https://roomraccoon.com/', apiSummary: 'PMS hôtelier à qualifier pour accès API partenaire et webhooks.', readCapabilities: ['Réservations et inventaire à confirmer'], writeCapabilities: ['Tarifs / restrictions à confirmer'], access: 'to_qualify', note: 'Demander documentation API, scopes, sandbox et statut du programme partenaire.' },
  { id: 'openagenda', name: 'OpenAgenda', category: 'events', docs: 'https://developers.openagenda.com/en/', apiSummary: 'REST API v2 : agendas, événements et lieux.', readCapabilities: ['Agendas', 'Événements', 'Lieux'], writeCapabilities: [], access: 'public_docs', note: 'Authentification requise ; respecter la licence de chaque agenda.' },
  { id: 'ticketmaster', name: 'Ticketmaster Discovery API', category: 'events', docs: 'https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/', apiSummary: 'REST API v2 pour événements, attractions et lieux.', readCapabilities: ['Événements', 'Attractions', 'Venues'], writeCapabilities: [], access: 'public_docs', note: 'API key et quotas du compte.' },
  { id: 'eventbrite', name: 'Eventbrite', category: 'events', docs: 'https://www.eventbrite.com/platform/docs/app-oauth-flow', apiSummary: 'API REST avec authentification OAuth.', readCapabilities: ['Événements accessibles au compte', 'Organisateurs selon scopes'], writeCapabilities: [], access: 'partner_required', note: 'Accès et périmètre des données selon application et autorisations.' },
  { id: 'datatourisme', name: 'DATAtourisme', category: 'events', docs: 'https://www.datatourisme.fr/', apiSummary: 'Source nationale de données touristiques et événements à intégrer après validation de l’API et des licences.', readCapabilities: ['Offre touristique et événements selon API/dataset'], writeCapabilities: [], access: 'to_qualify', note: 'Vérifier les modalités API, licences, champs géographiques et fréquence de mise à jour.' },
];

const CATEGORY_LABELS: Record<ProviderCategory, string> = {
  rate_shopper: 'Rate Shopper',
  channel_manager: 'Channel Manager',
  pms: 'PMS',
  events: 'Événements',
};

const ACCESS_LABELS = {
  public_docs: 'Documentation publique',
  partner_required: 'Accès partenaire requis',
  to_qualify: 'À qualifier',
};

const HEADER_HINTS: Record<string, string[]> = {
  reservations: ['reservation', 'booking', 'confirmation', 'checkin', 'check-out', 'arrival', 'departure', 'date_resa', 'date_arrivee', 'date_depart'],
  inventory: ['availability', 'available', 'stock', 'inventory', 'chambres_disponibles', 'rooms_available', 'otb', 'occupancy', 'occupation'],
  rates: ['rate', 'price', 'tarif', 'adr', 'bar', 'amount', 'prix', 'currency', 'devise'],
  competitors: ['competitor', 'concurrent', 'compset', 'hotel_name', 'hotelname', 'shop', 'room_type'],
  events: ['event', 'evenement', 'événement', 'venue', 'lieu', 'attendance', 'frequentation', 'start_date', 'date_debut'],
  restrictions: ['minlos', 'maxlos', 'cta', 'ctd', 'stop_sell', 'restriction', 'min_stay', 'max_stay'],
};

function normalizeHeaderForImport(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function classifyHeaders(headers: string[]): { type: string; score: number } {
  const normalized = headers.map((h) => String(h || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_ -]/g, ''));
  const scores = Object.entries(HEADER_HINTS).map(([type, hints]) => ({
    type,
    score: hints.reduce((sum, hint) => sum + (normalized.some((h) => h.includes(hint)) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score);
  const top = scores[0];
  return top && top.score > 0 ? top : { type: 'unknown', score: 0 };
}

interface DataManagementWorkspaceProps {
  hotel?: Hotel;
  onShowToast?: (message: string) => void;
}

export const DataManagementWorkspace: React.FC<DataManagementWorkspaceProps> = ({ hotel, onShowToast }) => {
  const [category, setCategory] = useState<ProviderCategory>('rate_shopper');
  const [providerId, setProviderId] = useState('lighthouse');
  const [query, setQuery] = useState('');
  const [fileResult, setFileResult] = useState<{ name: string; sheet: string; headers: string[]; rows: unknown[][]; records: Record<string, unknown>[]; rowCount: number; detectedType: string; confidence: string } | null>(null);
  const [importDataset, setImportDataset] = useState<HoptymImportDataset>('historical');
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [fileError, setFileError] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  const providers = useMemo(() => PROVIDERS.filter((p) => p.category === category && p.name.toLowerCase().includes(query.toLowerCase())), [category, query]);
  const selectedProvider = PROVIDERS.find((p) => p.id === providerId) || PROVIDERS.find((p) => p.category === category)!;

  const selectCategory = (next: ProviderCategory) => {
    setCategory(next);
    const first = PROVIDERS.find((p) => p.category === next);
    setProviderId(first?.id || '');
    setQuery('');
  };

  const parseFile = async (file?: File) => {
    if (!file) return;
    setFileError('');
    setFileResult(null);
    const ext = file.name.toLowerCase().split('.').pop();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      setFileError('Format non pris en charge. Utilisez XLSX, XLS ou CSV.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setFileError('Fichier trop volumineux (limite de pré-analyse : 20 Mo).');
      return;
    }
    setIsParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, raw: false });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error('Aucune feuille exploitable.');
      const sheet = workbook.Sheets[sheetName];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false });
      const nonEmpty = matrix.filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''));
      if (nonEmpty.length < 2) throw new Error('Le fichier doit contenir une ligne d’en-têtes et au moins une ligne de données.');
      const headers = nonEmpty[0].map((v) => String(v ?? '').trim());
      const dataRows = nonEmpty.slice(1);
      const detection = classifyHeaders(headers);
      const normalizedHeaders = headers.map((header) => normalizeHeaderForImport(header));
      const records = dataRows.map((row) => Object.fromEntries(normalizedHeaders.map((header, index) => [header || ('column_' + (index + 1)), row[index] ?? null])));
      const headerText = normalizedHeaders.join(' ');
      const suggestedDataset: HoptymImportDataset = detection.type === 'events' ? 'events' : detection.type === 'competitors' || headerText.includes('competitor') || headerText.includes('concurrent') || headerText.includes('hotel_name') ? 'rates' : detection.type === 'inventory' ? 'inventory' : detection.type === 'reservations' ? 'reservations' : 'historical';
      setImportDataset(suggestedDataset);
      setImportMessage(null);
      setFileResult({
        name: file.name,
        sheet: sheetName,
        headers,
        rows: dataRows.slice(0, 8),
        records,
        rowCount: dataRows.length,
        detectedType: detection.type,
        confidence: detection.score >= 4 ? 'Élevée' : detection.score >= 2 ? 'Moyenne' : detection.score === 1 ? 'Faible' : 'À déterminer',
      });
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Impossible de lire ce fichier.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleImport = async () => {
    if (!fileResult || !hotel?.name) return;
    setIsImporting(true);
    setImportMessage(null);
    try {
      const result = await importHoptymFile({
        dataset: importDataset,
        hotelName: hotel.name,
        fileName: fileResult.name,
        providerName: selectedProvider.name,
        records: fileResult.records,
      });
      setImportMessage(result.message);
      onShowToast?.(result.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "L'import a échoué.";
      setImportMessage(message);
      onShowToast?.(message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300 text-xs font-bold uppercase tracking-wide"><Database className="w-4 h-4" /> Centre de données HOPTYM</div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">Connectivités & alimentation du Revenue Management</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Catalogue des fournisseurs, documentation technique, imports et préparation des flux de données.</p>
          </div>
          <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 max-w-sm">
            <div className="font-bold flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> État honnête des intégrations</div>
            <p className="mt-1">Les fournisseurs affichés sont un catalogue. Aucun n'est déclaré connecté sans test réel et accès fournisseur validé.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {([
            ['rate_shopper', 'Rate Shopper', 'Comparaison concurrentielle', Activity],
            ['channel_manager', 'Channel Manager', 'ARI & réservations 2-Way', ArrowLeftRight],
            ['pms', 'PMS', 'Réservations & inventaire', Database],
            ['events', 'Événements', 'Agendas & lieux', CalendarDays],
          ] as const).map(([id, label, sub, Icon]) => (
            <button key={id} onClick={() => selectCategory(id)} className={`text-left rounded-xl border p-3 transition-colors ${category === id ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-700' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
              <Icon className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 mt-2">{label}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{sub}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-5">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2"><h3 className="font-bold text-slate-900 dark:text-slate-100">Catalogue {CATEGORY_LABELS[category]}</h3><span className="text-xs text-slate-500">{PROVIDERS.filter((p) => p.category === category).length} fournisseurs</span></div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Rechercher un fournisseur</label>
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom du fournisseur..." className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-slate-100" /></div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Sélectionner le fournisseur</label>
          <select value={selectedProvider?.id || ''} onChange={(e) => setProviderId(e.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100">
            {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {selectedProvider && (
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2"><h4 className="font-bold text-slate-900 dark:text-slate-100">{selectedProvider.name}</h4><span className="text-[10px] rounded-full px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{ACCESS_LABELS[selectedProvider.access]}</span></div>
              <p className="text-sm text-slate-600 dark:text-slate-300">{selectedProvider.apiSummary}</p>
              <div><div className="text-xs font-bold text-slate-500 uppercase mb-1">Lecture / réception</div><ul className="list-disc pl-5 text-xs text-slate-600 dark:text-slate-300 space-y-1">{selectedProvider.readCapabilities.map((x) => <li key={x}>{x}</li>)}</ul></div>
              <div><div className="text-xs font-bold text-slate-500 uppercase mb-1">Écriture / émission</div>{selectedProvider.writeCapabilities.length ? <ul className="list-disc pl-5 text-xs text-slate-600 dark:text-slate-300 space-y-1">{selectedProvider.writeCapabilities.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="text-xs text-slate-500">Lecture seule ou écriture non documentée.</p>}</div>
              <p className="text-xs text-amber-700 dark:text-amber-300 flex gap-2"><Info className="w-4 h-4 shrink-0" />{selectedProvider.note}</p>
              <a href={selectedProvider.docs} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700 dark:text-violet-300 hover:underline"><Link2 className="w-4 h-4" /> Fiche / documentation fournisseur <span aria-hidden="true">↗</span></a>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/70 p-3 text-xs text-slate-500 dark:text-slate-400 flex gap-2"><LockKeyhole className="w-4 h-4 shrink-0" />Les identifiants seront saisis dans un coffre serveur sécurisé lors de l'activation. Aucun secret ne doit être stocké dans le navigateur.</div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between"><h3 className="font-bold text-slate-900 dark:text-slate-100">Connectivité bidirectionnelle</h3><ArrowLeftRight className="w-5 h-5 text-violet-600" /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-4"><div className="text-xs font-bold text-slate-700 dark:text-slate-200">Entrant vers HOPTYM</div><p className="text-xs text-slate-500 mt-1">Réservations, annulations, modifications, OTB, inventaire, tarifs et restrictions reçus depuis les systèmes autorisés.</p></div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-4"><div className="text-xs font-bold text-slate-700 dark:text-slate-200">Sortant depuis HOPTYM</div><p className="text-xs text-slate-500 mt-1">Tarifs, disponibilités et restrictions envoyés au PMS/Channel Manager uniquement si l'API et les droits le permettent.</p></div>
          </div>
          <div className="space-y-2">
            {['Découverte & authentification', 'Lecture initiale et mapping des identifiants', 'Webhooks + synchronisation incrémentale', 'Prévisualisation des écritures ARI', 'Validation humaine et publication', 'Réconciliation et journal d’audit'].map((s, i) => <div key={s} className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300"><span className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 flex items-center justify-center font-bold">{i + 1}</span>{s}</div>)}
          </div>
          <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">Aucune écriture externe n'est activée depuis ce catalogue. Les tests sandbox, scopes, garde-fous et autorisations doivent précéder toute publication.</div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div><h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-emerald-600" /> Import universel & détection automatique</h3><p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Hôtel : {hotel?.name || 'Aucun hôtel sélectionné'} · XLSX, XLS et CSV · pré-analyse réelle du fichier</p></div>
          <label className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 text-xs font-bold cursor-pointer"><UploadCloud className="w-4 h-4" />Choisir un fichier<input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => parseFile(e.target.files?.[0])} /></label>
        </div>
        <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void parseFile(e.dataTransfer.files?.[0]); }} className="rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 p-6 text-center text-xs text-slate-500 dark:text-slate-400">Déposez ici un export de réservations, disponibilité, pickup, tarifs concurrents, restrictions ou événements.</div>
        {isParsing && <p className="text-xs text-violet-600 flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" />Lecture et analyse du classeur…</p>}
        {fileError && <p role="alert" className="text-xs text-rose-600">{fileError}</p>}
        {fileResult && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <label className="flex-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Type de données à importer
                <select value={importDataset} onChange={(event) => setImportDataset(event.target.value as HoptymImportDataset)} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100">
                  <option value="historical">Historique hôtelier / tarifs / ADR / RevPAR</option>
                  <option value="inventory">Disponibilités & inventaire</option>
                  <option value="reservations">Réservations / OTB / Pickup</option>
                  <option value="rates">Tarifs concurrents / Rate Shopper</option>
                  <option value="events">Événements à valider</option>
                </select>
              </label>
              <button type="button" onClick={() => void handleImport()} disabled={isImporting || !hotel?.name || !fileResult.records.length} className="rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2.5 text-xs font-bold">
                {isImporting ? 'Import sécurisé en cours…' : 'Valider et importer'}
              </button>
            </div>
            {importMessage && <p role="status" className="text-xs text-slate-600 dark:text-slate-300">{importMessage}</p>}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[['Fichier', fileResult.name], ['Feuille', fileResult.sheet], ['Lignes détectées', String(fileResult.rowCount)], ['Type probable', fileResult.detectedType]].map(([k, v]) => <div key={k} className="rounded-lg bg-slate-50 dark:bg-slate-800/70 p-3"><div className="text-[10px] uppercase font-bold text-slate-400">{k}</div><div className="text-xs font-semibold text-slate-800 dark:text-slate-100 mt-1 break-words">{v}</div></div>)}
            </div>
            <p className="text-xs text-slate-500">Confiance de détection : <strong>{fileResult.confidence}</strong> · {fileResult.headers.length} colonnes identifiées · aperçu des 8 premières lignes.</p>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800"><table className="min-w-full text-xs"><thead className="bg-slate-100 dark:bg-slate-800"><tr>{fileResult.headers.map((h, i) => <th key={i} className="text-left px-3 py-2 whitespace-nowrap">{h || `Colonne ${i + 1}`}</th>)}</tr></thead><tbody>{fileResult.rows.map((row, i) => <tr key={i} className="border-t border-slate-100 dark:border-slate-800">{fileResult.headers.map((_, j) => <td key={j} className="px-3 py-2 whitespace-nowrap text-slate-600 dark:text-slate-300">{String(row[j] ?? '')}</td>)}</tr>)}</tbody></table></div>
            <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200 flex gap-2"><ShieldAlert className="w-4 h-4 shrink-0" />Pré-analyse uniquement : aucune ligne n'est encore écrite en base. La persistance sera activée via un endpoint serveur tenant-safe après audit des schémas et des RLS.</div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/70 p-3"><div className="font-semibold text-xs text-slate-800 dark:text-slate-100">1. Détecter</div><p className="text-xs text-slate-500 mt-1">Type, feuille, en-têtes, dates, devises et formats.</p></div>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/70 p-3"><div className="font-semibold text-xs text-slate-800 dark:text-slate-100">2. Mapper & contrôler</div><p className="text-xs text-slate-500 mt-1">Colonnes canoniques, doublons, anomalies et aperçu.</p></div>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/70 p-3"><div className="font-semibold text-xs text-slate-800 dark:text-slate-100">3. Injecter & calculer</div><p className="text-xs text-slate-500 mt-1">Staging, validation, persistance, pickup et indicateurs RM.</p></div>
        </div>
      </section>
    </div>
  );
};
