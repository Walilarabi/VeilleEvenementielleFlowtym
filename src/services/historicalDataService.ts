/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * FLOWTYM REVENUE — SERVICE DE GESTION DES DONNÉES HISTORIQUES (EXCEL, STORAGE, DICTIONNAIRE)
 * Génère le modèle officiel à 3 onglets (Colonnes A à BZ), analyse les fichiers déposés et gère le catalogue.
 */

/**
 * @deprecated LEGACY BROWSER / DEMO SERVICE.
 * Not the authoritative backend and not approved for live Revenue Management decisions.
 * Live persistence and decisions must use the authenticated Supabase Revenue API
 * (src/services/revenueApiClient.ts) and its RLS-protected database contracts.
 */

import * as XLSX from 'xlsx';
import {
  HistoricalDailyRecord,
  HistoricalDemandSnapshot,
  HotelParametersProfile,
  HistoricalImportLog,
} from '../types/historicalData';

export const HISTORICAL_STORAGE_KEY = 'flowtym_historical_daily_records';
export const SNAPSHOTS_STORAGE_KEY = 'flowtym_historical_demand_snapshots';
export const PARAMS_STORAGE_KEY = 'flowtym_hotel_parameters_profile';
export const IMPORT_LOGS_STORAGE_KEY = 'flowtym_historical_import_logs';

// Colonnes officielles de l'onglet 1 (A à BZ)
export const OFFICIAL_DAILY_COLUMNS = [
  // A. Identification et calendrier
  { id: 'dateStr', letter: 'A', name: 'Date', importance: 'Obligatoire', type: 'date', example: '2025-10-15' },
  { id: 'dayOfWeek', letter: 'B', name: 'Jour de la semaine', importance: 'Obligatoire', type: 'string', example: 'Mercredi' },
  { id: 'weekOfYear', letter: 'C', name: 'Semaine de l\'année', importance: 'Important', type: 'number', example: 42 },
  { id: 'month', letter: 'D', name: 'Mois', importance: 'Obligatoire', type: 'number', example: 10 },
  { id: 'year', letter: 'E', name: 'Année', importance: 'Obligatoire', type: 'number', example: 2025 },
  { id: 'isHoliday', letter: 'F', name: 'Jour férié (Oui/Non)', importance: 'Important', type: 'boolean', example: 'Non' },
  { id: 'isSchoolHoliday', letter: 'G', name: 'Vacances scolaires (Oui/Non)', importance: 'Important', type: 'boolean', example: 'Non' },
  { id: 'schoolHolidayZone', letter: 'H', name: 'Zone de vacances scolaires', importance: 'Important', type: 'string', example: 'Zone C' },
  { id: 'isHolidayEve', letter: 'I', name: 'Veille de jour férié (Oui/Non)', importance: 'Important', type: 'boolean', example: 'Non' },
  { id: 'season', letter: 'J', name: 'Saison (Haute/Moyenne/Basse)', importance: 'Important', type: 'string', example: 'Haute' },
  { id: 'dayType', letter: 'K', name: 'Type de journée (Semaine/Weekend/Pont)', importance: 'Important', type: 'string', example: 'Semaine' },

  // B. Événement et attractivité
  { id: 'eventName', letter: 'L', name: 'Nom de l\'événement', importance: 'Très important', type: 'string', example: 'SIAL Paris 2025' },
  { id: 'eventCategory', letter: 'M', name: 'Catégorie d\'événement', importance: 'Très important', type: 'string', example: 'Salon Professionnel' },
  { id: 'eventStartDate', letter: 'N', name: 'Date de début de l\'événement', importance: 'Important', type: 'date', example: '2025-10-14' },
  { id: 'eventEndDate', letter: 'O', name: 'Date de fin de l\'événement', importance: 'Important', type: 'date', example: '2025-10-18' },
  { id: 'eventDurationDays', letter: 'P', name: 'Nombre de jours de l\'événement', importance: 'Important', type: 'number', example: 5 },
  { id: 'eventImportance', letter: 'Q', name: 'Niveau d\'importance de l\'événement', importance: 'Important', type: 'string', example: 'Critique' },
  { id: 'eventEstimatedVisitors', letter: 'R', name: 'Nombre de visiteurs estimés', importance: 'Très important', type: 'number', example: 120000 },
  { id: 'eventVenueCapacity', letter: 'S', name: 'Capacité d\'accueil de l\'événement', importance: 'Important', type: 'number', example: 60000 },
  { id: 'eventDistanceKm', letter: 'T', name: 'Distance hôtel/événement en km', importance: 'Très important', type: 'number', example: 4.2 },
  { id: 'eventIsInternational', letter: 'U', name: 'Événement international (Oui/Non)', importance: 'Important', type: 'boolean', example: 'Oui' },
  { id: 'hasMultipleEvents', letter: 'V', name: 'Plusieurs événements simultanés (Oui/Non)', importance: 'Très important', type: 'boolean', example: 'Oui' },

  // C. Capacité et occupation de l'hôtel
  { id: 'totalMarketableRooms', letter: 'W', name: 'Nombre total de chambres commercialisables', importance: 'Obligatoire', type: 'number', example: 45 },
  { id: 'availableRoomsForSale', letter: 'X', name: 'Chambres disponibles à la vente', importance: 'Très important', type: 'number', example: 45 },
  { id: 'roomsSold', letter: 'Y', name: 'Chambres vendues', importance: 'Obligatoire', type: 'number', example: 44 },
  { id: 'complimentaryRooms', letter: 'Z', name: 'Chambres offertes / gratuites', importance: 'Important', type: 'number', example: 0 },
  { id: 'outOfOrderRooms', letter: 'AA', name: 'Chambres hors service (OOO)', importance: 'Important', type: 'number', example: 0 },
  { id: 'occupancyPercent', letter: 'AB', name: 'Taux d\'occupation (%)', importance: 'Obligatoire', type: 'number', example: 97.8 },
  { id: 'turnawaysCount', letter: 'AC', name: 'Chambres refusées (Turnaways)', importance: 'Important', type: 'number', example: 14 },
  { id: 'reservationsCount', letter: 'AD', name: 'Nombre de réservations', importance: 'Important', type: 'number', example: 38 },
  { id: 'guestsCount', letter: 'AE', name: 'Nombre de clients', importance: 'Secondaire', type: 'number', example: 76 },

  // D. Performance financière
  { id: 'adrNetEur', letter: 'AF', name: 'ADR HT', importance: 'Obligatoire', type: 'number', example: 365.50 },
  { id: 'revparEur', letter: 'AG', name: 'RevPAR HT', importance: 'Obligatoire', type: 'number', example: 357.38 },
  { id: 'accommodationRevenueEur', letter: 'AH', name: 'Chiffre d\'affaires hébergement HT', importance: 'Obligatoire', type: 'number', example: 16082.00 },
  { id: 'avgSoldRoomPrice', letter: 'AI', name: 'Prix moyen des chambres vendues', importance: 'Obligatoire', type: 'number', example: 365.50 },
  { id: 'totalHotelRevenueEur', letter: 'AJ', name: 'CA total hôtelier HT', importance: 'Secondaire', type: 'number', example: 17450.00 },
  { id: 'trevparEur', letter: 'AK', name: 'TRevPAR', importance: 'Secondaire', type: 'number', example: 387.78 },
  { id: 'avgDistributionCostEur', letter: 'AL', name: 'Coût moyen de distribution', importance: 'Important', type: 'number', example: 34.20 },
  { id: 'avgCommissionPercent', letter: 'AM', name: 'Commission moyenne (%)', importance: 'Important', type: 'number', example: 12.5 },
  { id: 'avgNetRateAfterCommissionsEur', letter: 'AN', name: 'Prix moyen net après commissions', importance: 'Très important', type: 'number', example: 319.81 },

  // E. Historique de la demande et du pickup
  { id: 'otbJ90', letter: 'AO', name: 'Réservations enregistrées à J-90', importance: 'Très important', type: 'number', example: 8 },
  { id: 'otbJ60', letter: 'AP', name: 'Réservations enregistrées à J-60', importance: 'Très important', type: 'number', example: 18 },
  { id: 'otbJ30', letter: 'AQ', name: 'Réservations enregistrées à J-30', importance: 'Très important', type: 'number', example: 31 },
  { id: 'otbJ14', letter: 'AR', name: 'Réservations enregistrées à J-14', importance: 'Très important', type: 'number', example: 38 },
  { id: 'otbJ7', letter: 'AS', name: 'Réservations enregistrées à J-7', importance: 'Très important', type: 'number', example: 41 },
  { id: 'otbJ3', letter: 'AT', name: 'Réservations enregistrées à J-3', importance: 'Très important', type: 'number', example: 43 },
  { id: 'otbJ1', letter: 'AU', name: 'Réservations enregistrées à J-1', importance: 'Très important', type: 'number', example: 44 },
  { id: 'pickupJ90toJ60', letter: 'AV', name: 'Pickup J-90 à J-60', importance: 'Très important', type: 'number', example: 10 },
  { id: 'pickupJ60toJ30', letter: 'AW', name: 'Pickup J-60 à J-30', importance: 'Très important', type: 'number', example: 13 },
  { id: 'pickupJ30toJ14', letter: 'AX', name: 'Pickup J-30 à J-14', importance: 'Très important', type: 'number', example: 7 },
  { id: 'pickupJ14toJ7', letter: 'AY', name: 'Pickup J-14 à J-7', importance: 'Très important', type: 'number', example: 3 },
  { id: 'pickupJ7toJ3', letter: 'AZ', name: 'Pickup J-7 à J-3', importance: 'Très important', type: 'number', example: 2 },
  { id: 'pickupJ3toJ1', letter: 'BA', name: 'Pickup J-3 à J-1', importance: 'Très important', type: 'number', example: 1 },
  { id: 'pickupJ1toArrival', letter: 'BB', name: 'Pickup J-1 à l\'arrivée', importance: 'Très important', type: 'number', example: 0 },
  { id: 'avgLeadTimeDays', letter: 'BC', name: 'Lead time moyen', importance: 'Important', type: 'number', example: 38 },
  { id: 'cancellationsCount', letter: 'BD', name: 'Annulations enregistrées', importance: 'Important', type: 'number', example: 2 },
  { id: 'cancellationRatePercent', letter: 'BE', name: 'Taux d\'annulation (%)', importance: 'Important', type: 'number', example: 4.8 },
  { id: 'noShowCount', letter: 'BF', name: 'No-show', importance: 'Secondaire', type: 'number', example: 0 },

  // F. Distribution et comportement commercial
  { id: 'directReservations', letter: 'BG', name: 'Réservations directes', importance: 'Important', type: 'number', example: 18 },
  { id: 'bookingReservations', letter: 'BH', name: 'Réservations Booking.com', importance: 'Important', type: 'number', example: 14 },
  { id: 'expediaReservations', letter: 'BI', name: 'Réservations Expedia', importance: 'Important', type: 'number', example: 6 },
  { id: 'gdsReservations', letter: 'BJ', name: 'Réservations GDS', importance: 'Important', type: 'number', example: 4 },
  { id: 'groupReservations', letter: 'BK', name: 'Réservations groupes', importance: 'Important', type: 'number', example: 0 },
  { id: 'corporateReservations', letter: 'BL', name: 'Réservations corporate', importance: 'Important', type: 'number', example: 12 },
  { id: 'otherOtaReservations', letter: 'BM', name: 'Réservations OTA autres', importance: 'Important', type: 'number', example: 2 },
  { id: 'directSharePercent', letter: 'BN', name: 'Part des réservations directes (%)', importance: 'Important', type: 'number', example: 40.9 },
  { id: 'otaSharePercent', letter: 'BO', name: 'Part des réservations OTA (%)', importance: 'Important', type: 'number', example: 50.0 },
  { id: 'restrictionsApplied', letter: 'BP', name: 'Restrictions tarifaires appliquées', importance: 'Important', type: 'string', example: 'MinStay 2, Non-annulable' },
  { id: 'appliedMinStay', letter: 'BQ', name: 'Minimum Stay appliqué', importance: 'Important', type: 'number', example: 2 },
  { id: 'isClosedToArrival', letter: 'BR', name: 'Fermeture à l\'arrivée (CTA)', importance: 'Important', type: 'boolean', example: 'Non' },
  { id: 'isClosedToDeparture', letter: 'BS', name: 'Fermeture au départ (CTD)', importance: 'Important', type: 'boolean', example: 'Non' },

  // G. Prix et concurrence
  { id: 'publicBarEur', letter: 'BT', name: 'Tarif public moyen de l\'hôtel', importance: 'Très important', type: 'number', example: 375.00 },
  { id: 'compsetAvgEur', letter: 'BU', name: 'Tarif moyen du compset', importance: 'Très important', type: 'number', example: 382.00 },
  { id: 'compsetMinEur', letter: 'BV', name: 'Tarif minimum du compset', importance: 'Important', type: 'number', example: 330.00 },
  { id: 'compsetMaxEur', letter: 'BW', name: 'Tarif maximum du compset', importance: 'Important', type: 'number', example: 445.00 },
  { id: 'ratePositionIndex', letter: 'BX', name: 'Indice de positionnement tarifaire', importance: 'Très important', type: 'number', example: 98.2 },
  { id: 'compsetAvailabilityAvg', letter: 'BY', name: 'Disponibilité moyenne du compset', importance: 'Important', type: 'number', example: 12.0 },
  { id: 'compsetAvailableHotelsCount', letter: 'BZ', name: 'Nombre d\'hôtels concurrents disponibles', importance: 'Important', type: 'number', example: 1 },
];

/**
 * Génère le modèle officiel FLOWTYM Excel à 3 onglets complets (.xlsx)
 */
export function generateOfficialFlowtymHistoricalWorkbook(): Uint8Array {
  const wb = XLSX.utils.book_new();

  // 1. ONGLET 1 : HISTORIQUE QUOTIDIEN
  const headersRow = OFFICIAL_DAILY_COLUMNS.map((c) => c.name);

  // Génération d'un jeu d'exemples réalistes (sur 3 années passées pour le Grand Hôtel Folkestone Opéra)
  const sampleDays = generateRealisticHistoricalRecords('hotel-folkestone-opera', 365 * 3); // 3 ans d'historique réaliste
  const dailyRows = sampleDays.slice(0, 45).map((r) => [
    r.dateStr,
    r.dayOfWeek,
    r.weekOfYear,
    r.month,
    r.year,
    r.isHoliday ? 'Oui' : 'Non',
    r.isSchoolHoliday ? 'Oui' : 'Non',
    r.schoolHolidayZone,
    r.isHolidayEve ? 'Oui' : 'Non',
    r.season,
    r.dayType,
    r.eventName || '',
    r.eventCategory || '',
    r.eventStartDate || '',
    r.eventEndDate || '',
    r.eventDurationDays ?? '',
    r.eventImportance ?? '',
    r.eventEstimatedVisitors ?? '',
    r.eventVenueCapacity ?? '',
    r.eventDistanceKm ?? '',
    r.eventIsInternational ? 'Oui' : 'Non',
    r.hasMultipleEvents ? 'Oui' : 'Non',
    r.totalMarketableRooms,
    r.availableRoomsForSale,
    r.roomsSold,
    r.complimentaryRooms,
    r.outOfOrderRooms,
    r.occupancyPercent,
    r.turnawaysCount,
    r.reservationsCount,
    r.guestsCount,
    r.adrNetEur,
    r.revparEur,
    r.accommodationRevenueEur,
    r.avgSoldRoomPrice,
    r.totalHotelRevenueEur ?? '',
    r.trevparEur ?? '',
    r.avgDistributionCostEur ?? '',
    r.avgCommissionPercent ?? '',
    r.avgNetRateAfterCommissionsEur,
    r.otbJ90 ?? '',
    r.otbJ60 ?? '',
    r.otbJ30 ?? '',
    r.otbJ14 ?? '',
    r.otbJ7 ?? '',
    r.otbJ3 ?? '',
    r.otbJ1 ?? '',
    r.pickupJ90toJ60 ?? '',
    r.pickupJ60toJ30 ?? '',
    r.pickupJ30toJ14 ?? '',
    r.pickupJ14toJ7 ?? '',
    r.pickupJ7toJ3 ?? '',
    r.pickupJ3toJ1 ?? '',
    r.pickupJ1toArrival ?? '',
    r.avgLeadTimeDays ?? '',
    r.cancellationsCount ?? '',
    r.cancellationRatePercent ?? '',
    r.noShowCount ?? '',
    r.directReservations ?? '',
    r.bookingReservations ?? '',
    r.expediaReservations ?? '',
    r.gdsReservations ?? '',
    r.groupReservations ?? '',
    r.corporateReservations ?? '',
    r.otherOtaReservations ?? '',
    r.directSharePercent ?? '',
    r.otaSharePercent ?? '',
    r.restrictionsApplied ?? '',
    r.appliedMinStay ?? '',
    r.isClosedToArrival ? 'Oui' : 'Non',
    r.isClosedToDeparture ? 'Oui' : 'Non',
    r.publicBarEur ?? '',
    r.compsetAvgEur ?? '',
    r.compsetMinEur ?? '',
    r.compsetMaxEur ?? '',
    r.ratePositionIndex ?? '',
    r.compsetAvailabilityAvg ?? '',
    r.compsetAvailableHotelsCount ?? '',
  ]);

  const wsDaily = XLSX.utils.aoa_to_sheet([headersRow, ...dailyRows]);
  XLSX.utils.book_append_sheet(wb, wsDaily, 'Historique Quotidien');

  // 2. ONGLET 2 : HISTORIQUE DES SNAPSHOTS DE DEMANDE
  const snapshotHeaders = [
    'Date d\'observation',
    'Date d\'arrivée concernée',
    'Nombre de chambres déjà réservées',
    'Nombre de chambres disponibles',
    'Taux d\'occupation prévisionnel à cet instant',
    'ADR réservé',
    'CA hébergement déjà acquis',
    'Pickup depuis le précédent snapshot',
    'Annulations depuis le précédent snapshot',
    'Lead time restant',
    'Tarif public affiché à cet instant',
    'Tarif du compset à cet instant',
    'Nombre de chambres refusées',
    'Source des données',
  ];

  const sampleSnapshots = generateSampleDemandSnapshots();
  const snapshotRows = sampleSnapshots.map((s) => [
    s.observationDate,
    s.arrivalDate,
    s.roomsBookedOtb,
    s.roomsAvailable,
    s.projectedOccupancyPercent,
    s.bookedAdrEur,
    s.bookedRevenueEur,
    s.pickupSincePrevSnapshot,
    s.cancellationsSincePrevSnapshot,
    s.daysBeforeArrival,
    s.publicRateAtSnapshotEur ?? '',
    s.compsetRateAtSnapshotEur ?? '',
    s.turnawaysAtSnapshot ?? '',
    s.dataSource,
  ]);

  const wsSnapshots = XLSX.utils.aoa_to_sheet([snapshotHeaders, ...snapshotRows]);
  XLSX.utils.book_append_sheet(wb, wsSnapshots, 'Snapshots de Demande');

  // 3. ONGLET 3 : PARAMÈTRES DE L'ÉTABLISSEMENT
  const paramsData = [
    ['Paramètre', 'Valeur', 'Description / Unité'],
    ['Nom de l\'établissement', 'Grand Hôtel Folkestone Opéra', 'Raison sociale officielle'],
    ['Ville', 'Paris', 'Commune d\'implantation'],
    ['Catégorie', '4 étoiles', 'Classement Atout France'],
    ['Nombre de chambres physiques', 45, 'Capacité hôtelière brute'],
    ['Chambres habituellement commercialisables', 45, 'Stock actif de vente'],
    ['Jours habituels de fermeture', 'Aucun (ouvert 365j/365)', 'Politique d\'ouverture'],
    ['Positionnement hôtelier', 'Boutique Hôtel de Charme', 'Segment marketing'],
    ['Segment principal de clientèle', 'Loisirs Individuels & Affaires', 'Mix prédominant'],
    ['Marché principal', 'France, USA, UK, Europe', 'Origine des flux'],
    ['Devise', 'EUR (€)', 'Monnaie de référence'],
    ['Fuseau horaire', 'Europe/Paris', 'Zone horaire'],
    ['ADR cible', 285.00, 'Tarif moyen visé (€ HT)'],
    ['Taux d\'occupation cible', 85.0, 'Objectif de remplissage (%)'],
    ['RevPAR cible', 242.25, 'Objectif de rentabilité (€ HT)'],
    ['Tarif minimum acceptable (Floor)', 180.00, 'Garde-fou plancher absolu'],
    ['Tarif maximum autorisé (Ceiling)', 550.00, 'Garde-fou plafond'],
    ['Coût moyen de distribution', 32.50, 'Coût moyen par résa (€)'],
    ['Compset de référence', 'St-Pétersbourg Opéra, Charing Cross, Astra Opéra, Indigo Opéra, St-Augustin', '5 concurrents primaires'],
  ];

  const wsParams = XLSX.utils.aoa_to_sheet(paramsData);
  XLSX.utils.book_append_sheet(wb, wsParams, 'Paramètres Établissement');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(out);
}

/**
 * Analyse et valide le fichier Excel déposé par le Revenue Manager
 */
export function parseAndValidateHistoricalExcel(
  buffer: ArrayBuffer,
  fileName: string,
  hotelId: string
): {
  isValid: boolean;
  records: HistoricalDailyRecord[];
  snapshots: HistoricalDemandSnapshot[];
  profile?: Partial<HotelParametersProfile>;
  log: HistoricalImportLog;
} {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetNames = wb.SheetNames;

  const errorsList: { rowNumber: number; column: string; value: any; message: string }[] = [];
  const detectedColumns: string[] = [];
  let warningsCount = 0;

  // 1. Détection de l'onglet Historique Quotidien
  const dailySheetName = sheetNames.find((s) =>
    s.toLowerCase().includes('quotidien') || s.toLowerCase().includes('historique') || s.toLowerCase().includes('daily')
  ) || sheetNames[0];

  const wsDaily = wb.Sheets[dailySheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(wsDaily, { header: 1 });

  const records: HistoricalDailyRecord[] = [];
  if (rawRows.length > 1) {
    const headerRow = rawRows[0].map((h) => String(h || '').trim());
    detectedColumns.push(...headerRow);

    // Dictionnaire de mapping souple des en-têtes
    const colIndexMap: Record<string, number> = {};
    OFFICIAL_DAILY_COLUMNS.forEach((col) => {
      const idx = headerRow.findIndex(
        (h) =>
          h.toLowerCase() === col.name.toLowerCase() ||
          h.toLowerCase().includes(col.id.toLowerCase()) ||
          h.toLowerCase().includes(col.name.toLowerCase().slice(0, 10))
      );
      if (idx !== -1) {
        colIndexMap[col.id] = idx;
      }
    });

    for (let r = 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || row.length === 0 || !row[0]) continue;

      const rowNumber = r + 1;
      const getVal = (id: string, def: any = null) => {
        const idx = colIndexMap[id];
        return idx !== undefined && row[idx] !== undefined && row[idx] !== '' ? row[idx] : def;
      };

      // Contrôle de la date
      let rawDate = getVal('dateStr', row[0]);
      let dateStr = '';
      if (rawDate instanceof Date) {
        dateStr = rawDate.toISOString().slice(0, 10);
      } else if (typeof rawDate === 'string') {
        const parsedDate = new Date(rawDate);
        if (!isNaN(parsedDate.getTime())) {
          dateStr = parsedDate.toISOString().slice(0, 10);
        } else if (rawDate.includes('/')) {
          const parts = rawDate.split('/');
          if (parts.length === 3) {
            dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
      }

      if (!dateStr || dateStr.length !== 10) {
        errorsList.push({
          rowNumber,
          column: 'Date (A)',
          value: rawDate,
          message: 'Format de date invalide. Attendu YYYY-MM-DD ou DD/MM/YYYY.',
        });
        continue;
      }

      // Les métriques absentes restent inconnues : aucune capacité, ADR ou recette fictive.
      const totalRoomsRaw = getVal('totalMarketableRooms');
      const roomsSoldRaw = getVal('roomsSold');
      const totalRooms = Number(totalRoomsRaw);
      const roomsSold = Number(roomsSoldRaw);
      if (totalRoomsRaw == null || !Number.isFinite(totalRooms) || totalRooms <= 0 ||
          roomsSoldRaw == null || !Number.isInteger(roomsSold) || roomsSold < 0) {
        errorsList.push({
          rowNumber,
          column: 'Capacité / chambres vendues',
          value: { totalRooms: totalRoomsRaw, roomsSold: roomsSoldRaw },
          message: 'Données de capacité ou de chambres vendues invalides ou absentes ; ligne non importée.',
        });
        continue;
      }

      const compRoomsRaw = getVal('complimentaryRooms');
      const oooRoomsRaw = getVal('outOfOrderRooms');
      const compRooms = compRoomsRaw == null ? undefined : Number(compRoomsRaw);
      const oooRooms = oooRoomsRaw == null ? undefined : Number(oooRoomsRaw);
      if ((compRooms !== undefined && (!Number.isInteger(compRooms) || compRooms < 0)) ||
          (oooRooms !== undefined && (!Number.isInteger(oooRooms) || oooRooms < 0))) {
        errorsList.push({
          rowNumber,
          column: 'Chambres offertes / hors service',
          value: { complimentaryRooms: compRoomsRaw, outOfOrderRooms: oooRoomsRaw },
          message: 'Valeur de chambres offertes ou hors service invalide.',
        });
        continue;
      }

      const revenueRaw = getVal('accommodationRevenueEur');
      const adrRaw = getVal('adrNetEur');
      let caHeberg = revenueRaw == null ? null : Number(revenueRaw);
      let adrNet = adrRaw == null ? null : Number(adrRaw);
      if (caHeberg !== null && (!Number.isFinite(caHeberg) || caHeberg < 0)) caHeberg = null;
      if (adrNet !== null && (!Number.isFinite(adrNet) || adrNet < 0)) adrNet = null;

      if (caHeberg === null && adrNet !== null) caHeberg = roomsSold * adrNet;
      if (adrNet === null && caHeberg !== null && roomsSold > 0) adrNet = caHeberg / roomsSold;
      if (caHeberg === null && roomsSold === 0) caHeberg = 0;
      if (caHeberg === null) {
        errorsList.push({
          rowNumber,
          column: 'ADR net / CA hébergement',
          value: { adrNet: adrRaw, accommodationRevenue: revenueRaw },
          message: 'ADR net et CA hébergement absents ou invalides ; ligne non importée.',
        });
        continue;
      }

      if (roomsSold + (compRooms ?? 0) > totalRooms) {
        errorsList.push({
          rowNumber,
          column: 'Occupation / capacité',
          value: { roomsSold, complimentaryRooms: compRooms, totalRooms },
          message: 'Occupation supérieure à la capacité commercialisable : ligne invalide.',
        });
        continue;
      }

      const calculatedRevpar = Math.round((caHeberg / totalRooms) * 100) / 100;
      const declaredRevparRaw = getVal('revparEur');
      const declaredRevpar = declaredRevparRaw == null ? null : Number(declaredRevparRaw);
      if (declaredRevpar !== null && Number.isFinite(declaredRevpar) && Math.abs(calculatedRevpar - declaredRevpar) > 2.5) {
        warningsCount++;
        errorsList.push({
          rowNumber,
          column: 'RevPAR HT (AG)',
          value: declaredRevpar,
          message: `RevPAR déclaré (${declaredRevpar}€) différent du RevPAR recalculé (${calculatedRevpar}€) à partir du CA et du stock fournis.`,
        });
      }

      const occupancyRaw = getVal('occupancyPercent');
      const occPercent = occupancyRaw == null
        ? compRooms !== undefined ? ((roomsSold + compRooms) / totalRooms) * 100 : null
        : Number(occupancyRaw);
      if (occPercent === null || !Number.isFinite(occPercent) || occPercent < 0 || occPercent > 100) {
        errorsList.push({
          rowNumber,
          column: 'Taux d’occupation',
          value: occupancyRaw,
          message: 'Taux d’occupation absent ou invalide ; impossible de le calculer sans chambres offertes renseignées.',
        });
        continue;
      }

      const record: HistoricalDailyRecord = {
        id: `hist-${hotelId}-${dateStr}`,
        hotelId,
        dateStr,
        dayOfWeek: String(getVal('dayOfWeek', getDayOfWeekFr(dateStr))),
        weekOfYear: Number(getVal('weekOfYear', getWeekNumber(dateStr))),
        month: Number(getVal('month', Number(dateStr.slice(5, 7)))),
        year: Number(getVal('year', Number(dateStr.slice(0, 4)))),
        isHoliday: String(getVal('isHoliday', 'non')).toLowerCase().includes('oui'),
        isSchoolHoliday: String(getVal('isSchoolHoliday', 'non')).toLowerCase().includes('oui'),
        schoolHolidayZone: String(getVal('schoolHolidayZone', 'Zone C')),
        isHolidayEve: String(getVal('isHolidayEve', 'non')).toLowerCase().includes('oui'),
        season: (getVal('season', 'Moyenne') as any),
        dayType: (getVal('dayType', 'Semaine') as any),

        eventName: getVal('eventName') ? String(getVal('eventName')) : undefined,
        eventCategory: getVal('eventCategory') ? String(getVal('eventCategory')) : undefined,
        eventStartDate: getVal('eventStartDate') ? String(getVal('eventStartDate')) : undefined,
        eventEndDate: getVal('eventEndDate') ? String(getVal('eventEndDate')) : undefined,
        eventDurationDays: getVal('eventDurationDays') ? Number(getVal('eventDurationDays')) : undefined,
        eventImportance: getVal('eventImportance') ? (getVal('eventImportance') as any) : undefined,
        eventEstimatedVisitors: getVal('eventEstimatedVisitors') ? Number(getVal('eventEstimatedVisitors')) : undefined,
        eventVenueCapacity: getVal('eventVenueCapacity') ? Number(getVal('eventVenueCapacity')) : undefined,
        eventDistanceKm: getVal('eventDistanceKm') ? Number(getVal('eventDistanceKm')) : undefined,
        eventIsInternational: String(getVal('eventIsInternational', 'non')).toLowerCase().includes('oui'),
        hasMultipleEvents: String(getVal('hasMultipleEvents', 'non')).toLowerCase().includes('oui'),

        totalMarketableRooms: totalRooms,
        availableRoomsForSale: Number(getVal('availableRoomsForSale', totalRooms - oooRooms)),
        roomsSold,
        complimentaryRooms: compRooms,
        outOfOrderRooms: oooRooms,
        occupancyPercent: Math.round(occPercent * 10) / 10,
        turnawaysCount: Number(getVal('turnawaysCount', 0)),
        reservationsCount: Number(getVal('reservationsCount', roomsSold)),
        guestsCount: Number(getVal('guestsCount', roomsSold * 1.8)),

        adrNetEur: adrNet,
        revparEur: calculatedRevpar,
        accommodationRevenueEur: caHeberg,
        avgSoldRoomPrice: Number(getVal('avgSoldRoomPrice', adrNet)),
        totalHotelRevenueEur: getVal('totalHotelRevenueEur') ? Number(getVal('totalHotelRevenueEur')) : undefined,
        trevparEur: getVal('trevparEur') ? Number(getVal('trevparEur')) : undefined,
        avgDistributionCostEur: getVal('avgDistributionCostEur') ? Number(getVal('avgDistributionCostEur')) : undefined,
        avgCommissionPercent: getVal('avgCommissionPercent') ? Number(getVal('avgCommissionPercent')) : undefined,
        avgNetRateAfterCommissionsEur: Number(getVal('avgNetRateAfterCommissionsEur', Math.round(adrNet * 0.88))),

        otbJ90: getVal('otbJ90') ? Number(getVal('otbJ90')) : undefined,
        otbJ60: getVal('otbJ60') ? Number(getVal('otbJ60')) : undefined,
        otbJ30: getVal('otbJ30') ? Number(getVal('otbJ30')) : undefined,
        otbJ14: getVal('otbJ14') ? Number(getVal('otbJ14')) : undefined,
        otbJ7: getVal('otbJ7') ? Number(getVal('otbJ7')) : undefined,
        otbJ3: getVal('otbJ3') ? Number(getVal('otbJ3')) : undefined,
        otbJ1: getVal('otbJ1') ? Number(getVal('otbJ1')) : undefined,
        pickupJ90toJ60: getVal('pickupJ90toJ60') ? Number(getVal('pickupJ90toJ60')) : undefined,
        pickupJ60toJ30: getVal('pickupJ60toJ30') ? Number(getVal('pickupJ60toJ30')) : undefined,
        pickupJ30toJ14: getVal('pickupJ30toJ14') ? Number(getVal('pickupJ30toJ14')) : undefined,
        pickupJ14toJ7: getVal('pickupJ14toJ7') ? Number(getVal('pickupJ14toJ7')) : undefined,
        pickupJ7toJ3: getVal('pickupJ7toJ3') ? Number(getVal('pickupJ7toJ3')) : undefined,
        pickupJ3toJ1: getVal('pickupJ3toJ1') ? Number(getVal('pickupJ3toJ1')) : undefined,
        pickupJ1toArrival: getVal('pickupJ1toArrival') ? Number(getVal('pickupJ1toArrival')) : undefined,
        avgLeadTimeDays: getVal('avgLeadTimeDays') ? Number(getVal('avgLeadTimeDays')) : undefined,
        cancellationsCount: Number(getVal('cancellationsCount', 0)),
        cancellationRatePercent: Number(getVal('cancellationRatePercent', 0)),
        noShowCount: Number(getVal('noShowCount', 0)),

        directReservations: getVal('directReservations') ? Number(getVal('directReservations')) : undefined,
        bookingReservations: getVal('bookingReservations') ? Number(getVal('bookingReservations')) : undefined,
        expediaReservations: getVal('expediaReservations') ? Number(getVal('expediaReservations')) : undefined,
        gdsReservations: getVal('gdsReservations') ? Number(getVal('gdsReservations')) : undefined,
        groupReservations: getVal('groupReservations') ? Number(getVal('groupReservations')) : undefined,
        corporateReservations: getVal('corporateReservations') ? Number(getVal('corporateReservations')) : undefined,
        otherOtaReservations: getVal('otherOtaReservations') ? Number(getVal('otherOtaReservations')) : undefined,
        directSharePercent: getVal('directSharePercent') ? Number(getVal('directSharePercent')) : undefined,
        otaSharePercent: getVal('otaSharePercent') ? Number(getVal('otaSharePercent')) : undefined,
        restrictionsApplied: getVal('restrictionsApplied') ? String(getVal('restrictionsApplied')) : undefined,
        appliedMinStay: getVal('appliedMinStay') ? Number(getVal('appliedMinStay')) : 1,
        isClosedToArrival: String(getVal('isClosedToArrival', 'non')).toLowerCase().includes('oui'),
        isClosedToDeparture: String(getVal('isClosedToDeparture', 'non')).toLowerCase().includes('oui'),

        publicBarEur: getVal('publicBarEur') ? Number(getVal('publicBarEur')) : undefined,
        compsetAvgEur: getVal('compsetAvgEur') ? Number(getVal('compsetAvgEur')) : undefined,
        compsetMinEur: getVal('compsetMinEur') ? Number(getVal('compsetMinEur')) : undefined,
        compsetMaxEur: getVal('compsetMaxEur') ? Number(getVal('compsetMaxEur')) : undefined,
        ratePositionIndex: getVal('ratePositionIndex') ? Number(getVal('ratePositionIndex')) : undefined,
        compsetAvailabilityAvg: getVal('compsetAvailabilityAvg') ? Number(getVal('compsetAvailabilityAvg')) : undefined,
        compsetAvailableHotelsCount: getVal('compsetAvailableHotelsCount') ? Number(getVal('compsetAvailableHotelsCount')) : undefined,
      };

      records.push(record);
    }
  }

  // 2. Détection de l'onglet Snapshots de Demande
  const snapshotSheetName = sheetNames.find(
    (s) => s.toLowerCase().includes('snapshot') || s.toLowerCase().includes('otb')
  );
  const snapshots: HistoricalDemandSnapshot[] = [];
  if (snapshotSheetName) {
    const wsSnap = wb.Sheets[snapshotSheetName];
    const snapRows: any[][] = XLSX.utils.sheet_to_json(wsSnap, { header: 1 });
    for (let i = 1; i < snapRows.length; i++) {
      const row = snapRows[i];
      if (!row || !row[0] || !row[1]) continue;
      const obsDate = String(row[0]).slice(0, 10);
      const arrDate = String(row[1]).slice(0, 10);
      const bookedRooms = Number(row[2]) || 0;
      const availRooms = Number(row[3]) || 45 - bookedRooms;
      const occ = Number(row[4]) || Math.round((bookedRooms / 45) * 100);
      const bookedAdr = Number(row[5]) || 250;
      const bookedRev = Number(row[6]) || bookedRooms * bookedAdr;

      snapshots.push({
        id: `snap-${hotelId}-${obsDate}-${arrDate}`,
        hotelId,
        observationDate: obsDate,
        arrivalDate: arrDate,
        daysBeforeArrival: Number(row[9]) || Math.max(0, Math.round((new Date(arrDate).getTime() - new Date(obsDate).getTime()) / (1000 * 3600 * 24))),
        roomsBookedOtb: bookedRooms,
        roomsAvailable: availRooms,
        projectedOccupancyPercent: occ,
        bookedAdrEur: bookedAdr,
        bookedRevenueEur: bookedRev,
        pickupSincePrevSnapshot: Number(row[7]) || 0,
        cancellationsSincePrevSnapshot: Number(row[8]) || 0,
        publicRateAtSnapshotEur: row[10] ? Number(row[10]) : undefined,
        compsetRateAtSnapshotEur: row[11] ? Number(row[11]) : undefined,
        turnawaysAtSnapshot: row[12] ? Number(row[12]) : 0,
        dataSource: (row[13] as any) || 'Import Excel',
      });
    }
  }

  // Tri par date chronologique
  records.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

  const dateRange = records.length > 0 ? `${records[0].dateStr} — ${records[records.length - 1].dateStr}` : 'Aucune date';
  const hasErrors = errorsList.some((e) => e.message.includes('invalide'));

  const log: HistoricalImportLog = {
    id: `log-${Date.now()}`,
    hotelId,
    fileName,
    fileSizeKb: Math.round(buffer.byteLength / 1024),
    recordsCount: records.length,
    snapshotsCount: snapshots.length,
    dateRange,
    status: hasErrors ? 'error' : warningsCount > 0 ? 'warning' : 'valid',
    warningsCount,
    errorsCount: errorsList.length,
    errorsList,
    detectedColumns,
    importedBy: 'Wali Larabi',
    importedAt: new Date().toISOString(),
  };

  return {
    isValid: !hasErrors && records.length > 0,
    records,
    snapshots,
    log,
  };
}

/**
 * Persiste les données historiques en localStorage (ou Supabase)
 */
export function saveHistoricalRecords(hotelId: string, newRecords: HistoricalDailyRecord[]): void {
  try {
    const existingRaw = localStorage.getItem(HISTORICAL_STORAGE_KEY);
    let allRecords: HistoricalDailyRecord[] = existingRaw ? JSON.parse(existingRaw) : [];

    // Remplacement ou insertion sans doublon (clé composite hotelId + dateStr)
    const map = new Map<string, HistoricalDailyRecord>();
    allRecords.forEach((r) => map.set(`${r.hotelId}_${r.dateStr}`, r));
    newRecords.forEach((r) => map.set(`${r.hotelId}_${r.dateStr}`, r));

    const merged = Array.from(map.values()).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    localStorage.setItem(HISTORICAL_STORAGE_KEY, JSON.stringify(merged));
  } catch (err) {
    console.error('Erreur lors de la sauvegarde des historiques', err);
  }
}

/**
 * Récupère les données historiques stockées pour un hôtel (avec fallback sur un jeu N-1, N-2, N-3 complet)
 */
export function getHistoricalDailyRecords(_hotelId: string): HistoricalDailyRecord[] {
  // Historical data must come from the authenticated Supabase source.
  // No generated N-1/N-2/N-3 fixture is returned when the database is empty.
  return [];
}

/**
 * Générateur d'historique réaliste et calibré pour 3 années (N-1, N-2, N-3)
 */
function generateRealisticHistoricalRecords(hotelId: string, daysCount: number): HistoricalDailyRecord[] {
  const records: HistoricalDailyRecord[] = [];
  const totalRooms = 45;

  // Départ : 1er Janvier 2023
  const startDate = new Date('2023-01-01');

  for (let i = 0; i < daysCount; i++) {
    const curDate = new Date(startDate.getTime() + i * 24 * 3600 * 1000);
    const dateStr = curDate.toISOString().slice(0, 10);
    const dayOfWeekIdx = curDate.getDay();
    const dayOfWeek = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][dayOfWeekIdx];
    const month = curDate.getMonth() + 1;
    const year = curDate.getFullYear();
    const isWeekend = dayOfWeekIdx === 5 || dayOfWeekIdx === 6;

    // Saisons parisiennes
    const isHighSeason = month >= 4 && month <= 10;
    const season: 'Haute' | 'Moyenne' | 'Basse' = isHighSeason ? 'Haute' : month === 12 ? 'Moyenne' : 'Basse';

    // Remplissage de base selon la saison et le jour
    let baseOcc = isHighSeason ? (isWeekend ? 94 : 88) : isWeekend ? 82 : 72;
    let baseAdr = isHighSeason ? (isWeekend ? 340 : 310) : isWeekend ? 260 : 230;

    // Simulation d'événements majeurs (Fashion Week, Roland Garros, SIAL, Salons Le Bourget)
    let eventName: string | undefined = undefined;
    let eventCategory: string | undefined = undefined;
    let eventImportance: HistoricalDailyRecord['eventImportance'] = undefined;
    let turnaways = 0;

    if (month === 6 && curDate.getDate() >= 10 && curDate.getDate() <= 16) {
      eventName = 'Salon International de l\'Aéronautique - Le Bourget';
      eventCategory = 'Salon Professionnel';
      eventImportance = 'Critique';
      baseOcc = 98;
      baseAdr += 95;
      turnaways = 18;
    } else if (month === 9 && curDate.getDate() >= 22 && curDate.getDate() <= 29) {
      eventName = 'Paris Fashion Week Prêt-à-Porter';
      eventCategory = 'Mode & Luxe';
      eventImportance = 'Majeur';
      baseOcc = 97;
      baseAdr += 80;
      turnaways = 12;
    }

    const roomsSold = Math.min(totalRooms, Math.round((baseOcc / 100) * totalRooms));
    const complimentaryRooms = Math.random() < 0.2 ? 1 : 0;
    const outOfOrderRooms = Math.random() < 0.1 ? 1 : 0;
    const occPercent = Math.round(((roomsSold + complimentaryRooms) / totalRooms) * 1000) / 10;

    const adrNetEur = Math.round(baseAdr);
    const caHebergement = roomsSold * adrNetEur;
    const revparEur = Math.round((caHebergement / totalRooms) * 100) / 100;

    // Simulation des snapshots OTB passés (J-90 à J-1)
    const otbJ90 = Math.round(roomsSold * 0.22);
    const otbJ60 = Math.round(roomsSold * 0.45);
    const otbJ30 = Math.round(roomsSold * 0.72);
    const otbJ14 = Math.round(roomsSold * 0.88);
    const otbJ7 = Math.round(roomsSold * 0.94);
    const otbJ3 = Math.round(roomsSold * 0.97);
    const otbJ1 = roomsSold;

    records.push({
      id: `hist-${hotelId}-${dateStr}`,
      hotelId,
      dateStr,
      dayOfWeek,
      weekOfYear: getWeekNumber(dateStr),
      month,
      year,
      isHoliday: isFrenchHoliday(dateStr),
      isSchoolHoliday: isFrenchSchoolHoliday(dateStr),
      schoolHolidayZone: 'Zone C',
      isHolidayEve: false,
      season,
      dayType: isWeekend ? 'Weekend' : 'Semaine',

      eventName,
      eventCategory,
      eventImportance,
      eventDistanceKm: eventName ? 4.5 : undefined,
      eventIsInternational: !!eventName,
      hasMultipleEvents: false,

      totalMarketableRooms: totalRooms,
      availableRoomsForSale: totalRooms - outOfOrderRooms,
      roomsSold,
      complimentaryRooms,
      outOfOrderRooms,
      occupancyPercent: occPercent,
      turnawaysCount: turnaways,
      reservationsCount: Math.round(roomsSold * 0.9),
      guestsCount: Math.round(roomsSold * 1.8),

      adrNetEur,
      revparEur,
      accommodationRevenueEur: caHebergement,
      avgSoldRoomPrice: adrNetEur,
      totalHotelRevenueEur: Math.round(caHebergement * 1.08),
      trevparEur: Math.round((caHebergement * 1.08) / totalRooms),
      avgDistributionCostEur: 32.5,
      avgCommissionPercent: 12.0,
      avgNetRateAfterCommissionsEur: Math.round(adrNetEur * 0.88),

      otbJ90,
      otbJ60,
      otbJ30,
      otbJ14,
      otbJ7,
      otbJ3,
      otbJ1,
      pickupJ90toJ60: otbJ60 - otbJ90,
      pickupJ60toJ30: otbJ30 - otbJ60,
      pickupJ30toJ14: otbJ14 - otbJ30,
      pickupJ14toJ7: otbJ7 - otbJ14,
      pickupJ7toJ3: otbJ3 - otbJ7,
      pickupJ3toJ1: otbJ1 - otbJ3,
      pickupJ1toArrival: 0,
      avgLeadTimeDays: isWeekend ? 32 : 18,
      cancellationsCount: Math.round(roomsSold * 0.08),
      cancellationRatePercent: 8.0,
      noShowCount: 0,

      directReservations: Math.round(roomsSold * 0.42),
      bookingReservations: Math.round(roomsSold * 0.38),
      expediaReservations: Math.round(roomsSold * 0.12),
      gdsReservations: Math.round(roomsSold * 0.08),
      directSharePercent: 42.0,
      otaSharePercent: 50.0,
      appliedMinStay: isWeekend && occPercent > 90 ? 2 : 1,
      isClosedToArrival: false,
      isClosedToDeparture: false,

      publicBarEur: adrNetEur + 15,
      compsetAvgEur: adrNetEur + 18,
      compsetMinEur: adrNetEur - 25,
      compsetMaxEur: adrNetEur + 55,
      ratePositionIndex: 96.5,
      compsetAvailabilityAvg: 100 - occPercent,
      compsetAvailableHotelsCount: occPercent > 92 ? 1 : 5,
    });
  }

  return records;
}

function generateSampleDemandSnapshots(): HistoricalDemandSnapshot[] {
  const snaps: HistoricalDemandSnapshot[] = [];
  const baseArrival = '2025-10-15';
  const obsPoints = [
    { days: 90, obs: '2025-07-17', booked: 8, adr: 295 },
    { days: 60, obs: '2025-08-16', booked: 18, adr: 320 },
    { days: 30, obs: '2025-09-15', booked: 31, adr: 350 },
    { days: 14, obs: '2025-10-01', booked: 38, adr: 365 },
    { days: 7, obs: '2025-10-08', booked: 41, adr: 375 },
    { days: 3, obs: '2025-10-12', booked: 43, adr: 385 },
    { days: 1, obs: '2025-10-14', booked: 44, adr: 395 },
  ];

  for (let i = 0; i < obsPoints.length; i++) {
    const p = obsPoints[i];
    const prevBooked = i > 0 ? obsPoints[i - 1].booked : 0;
    snaps.push({
      id: `snap-sample-${i}`,
      hotelId: 'hotel-folkestone-opera',
      observationDate: p.obs,
      arrivalDate: baseArrival,
      daysBeforeArrival: p.days,
      roomsBookedOtb: p.booked,
      roomsAvailable: 45 - p.booked,
      projectedOccupancyPercent: Math.round((p.booked / 45) * 100),
      bookedAdrEur: p.adr,
      bookedRevenueEur: p.booked * p.adr,
      pickupSincePrevSnapshot: p.booked - prevBooked,
      cancellationsSincePrevSnapshot: Math.round(p.booked * 0.05),
      publicRateAtSnapshotEur: p.adr + 20,
      compsetRateAtSnapshotEur: p.adr + 25,
      turnawaysAtSnapshot: p.days <= 7 ? 6 : 0,
      dataSource: 'D-EDGE CRS',
    });
  }

  return snaps;
}

function getDayOfWeekFr(dateStr: string): string {
  const d = new Date(dateStr);
  return ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][d.getDay()];
}

function getWeekNumber(dateStr: string): number {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function isFrenchHoliday(dateStr: string): boolean {
  const md = dateStr.slice(5);
  return ['01-01', '05-01', '05-08', '07-14', '08-15', '11-01', '11-11', '12-25'].includes(md);
}

function isFrenchSchoolHoliday(dateStr: string): boolean {
  const m = Number(dateStr.slice(5, 7));
  const d = Number(dateStr.slice(8, 10));
  return (m === 2 && d >= 10 && d <= 25) || (m === 4 && d >= 12 && d <= 28) || m === 7 || m === 8 || (m === 10 && d >= 20);
}
