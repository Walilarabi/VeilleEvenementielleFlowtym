/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * FLOWTYM REVENUE — TYPES DES DONNÉES HISTORIQUES, SNAPSHOTS, PRÉDICTION & BACKTESTING
 * Dictionnaire complet des données historiques d'établissement (3 onglets officiels)
 */

// -------------------------------------------------------------
// ONGLET 1 : HISTORIQUE QUOTIDIEN (Colonnes A à BZ)
// -------------------------------------------------------------

export interface HistoricalDailyRecord {
  // A. Identification et calendrier
  id: string;
  hotelId: string;
  dateStr: string; // A : YYYY-MM-DD
  dayOfWeek: string; // B : Lundi, Mardi...
  weekOfYear: number; // C : 1 - 53
  month: number; // D : 1 - 12
  year: number; // E : 2023, 2024, 2025...
  isHoliday?: boolean; // F : absent si non renseigné dans la source
  isSchoolHoliday?: boolean; // G : absent si non renseigné dans la source
  schoolHolidayZone?: string; // H : absent si non renseigné dans la source
  isHolidayEve?: boolean; // I : absent si non renseigné dans la source
  season?: 'Haute' | 'Moyenne' | 'Basse'; // J
  dayType?: 'Semaine' | 'Weekend' | 'Pont'; // K

  // B. Événement et attractivité de la destination
  eventName?: string; // L
  eventCategory?: string; // M : Congrès, Concert, Sport, Salon...
  eventStartDate?: string; // N
  eventEndDate?: string; // O
  eventDurationDays?: number; // P
  eventImportance?: 'Faible' | 'Moyen' | 'Majeur' | 'Critique'; // Q
  eventEstimatedVisitors?: number; // R
  eventVenueCapacity?: number; // S
  eventDistanceKm?: number; // T
  eventIsInternational?: boolean; // U
  hasMultipleEvents?: boolean; // V

  // C. Capacité et occupation de l'hôtel
  totalMarketableRooms: number; // W : Nombre total de chambres commercialisables (ex: 45)
  availableRoomsForSale?: number; // X : absent si non renseigné (ex: 43 si 2 OOO)
  roomsSold: number; // Y : Chambres vendues payantes
  complimentaryRooms?: number; // Z : absent si non renseigné
  outOfOrderRooms?: number; // AA : absent si non renseigné
  occupancyPercent: number; // AB : taux réel ou calculé depuis les chambres déclarées
  turnawaysCount?: number; // AC : absent si non renseigné
  reservationsCount?: number; // AD : absent si non renseigné
  guestsCount?: number; // AE : absent si non renseigné

  // D. Performance financière
  adrNetEur: number; // AF : réel ou calculé depuis CA hébergement / chambres vendues
  revparEur: number; // AG : calculé depuis CA hébergement / stock commercialisable
  accommodationRevenueEur: number; // AH : réel ou calculé depuis ADR net / chambres vendues
  avgSoldRoomPrice?: number; // AI : absent si non renseigné
  totalHotelRevenueEur?: number; // AJ : CA total hôtel HT (avec extras, PDJ...)
  trevparEur?: number; // AK : TRevPAR
  avgDistributionCostEur?: number; // AL : Coût moyen de distribution
  avgCommissionPercent?: number; // AM : Commission moyenne (%)
  avgNetRateAfterCommissionsEur?: number; // AN : absent si non renseigné

  // E. Historique de la demande et du pickup (Snapshots passés connus)
  otbJ90?: number; // AO
  otbJ60?: number; // AP
  otbJ30?: number; // AQ
  otbJ14?: number; // AR
  otbJ7?: number; // AS
  otbJ3?: number; // AT
  otbJ1?: number; // AU
  pickupJ90toJ60?: number; // AV
  pickupJ60toJ30?: number; // AW
  pickupJ30toJ14?: number; // AX
  pickupJ14toJ7?: number; // AY
  pickupJ7toJ3?: number; // AZ
  pickupJ3toJ1?: number; // BA
  pickupJ1toArrival?: number; // BB
  avgLeadTimeDays?: number; // BC : Lead time moyen (jours)
  cancellationsCount?: number; // BD : Annulations enregistrées
  cancellationRatePercent?: number; // BE : Taux d'annulation (%)
  noShowCount?: number; // BF : No-shows

  // F. Distribution et comportement commercial
  directReservations?: number; // BG
  bookingReservations?: number; // BH
  expediaReservations?: number; // BI
  gdsReservations?: number; // BJ
  groupReservations?: number; // BK
  corporateReservations?: number; // BL
  otherOtaReservations?: number; // BM
  directSharePercent?: number; // BN : Part direct (%)
  otaSharePercent?: number; // BO : Part OTA (%)
  restrictionsApplied?: string; // BP : MinStay, CTA, Non-annulable...
  appliedMinStay?: number; // BQ
  isClosedToArrival?: boolean; // BR : CTA
  isClosedToDeparture?: boolean; // BS : CTD

  // G. Prix et concurrence (Lighthouse / Rate Shopping)
  publicBarEur?: number; // BT : Tarif public moyen de l'hôtel
  compsetAvgEur?: number; // BU : Tarif moyen compset
  compsetMinEur?: number; // BV : Tarif min compset
  compsetMaxEur?: number; // BW : Tarif max compset
  ratePositionIndex?: number; // BX : Indice de positionnement tarifaire (ex: 95 = 5% sous le compset)
  compsetAvailabilityAvg?: number; // BY : Dispo moyenne (%)
  compsetAvailableHotelsCount?: number; // BZ : Nombre d'hôtels dispo (sur compset de 5 ou 6)
}

// -------------------------------------------------------------
// ONGLET 2 : HISTORIQUE DES SNAPSHOTS DE DEMANDE
// -------------------------------------------------------------

export interface HistoricalDemandSnapshot {
  id: string;
  hotelId: string;
  observationDate: string; // Date du relevé / snapshot
  arrivalDate: string; // Date d'arrivée concernée
  daysBeforeArrival: number; // Lead time restant en jours (arrivalDate - observationDate)
  roomsBookedOtb: number; // Chambres déjà réservées
  roomsAvailable: number; // Chambres disponibles
  projectedOccupancyPercent: number; // Taux d'occupation à cet instant
  bookedAdrEur?: number; // ADR du portefeuille acquis, absent si non renseigné
  bookedRevenueEur?: number; // CA hébergement déjà acquis, absent si non renseigné
  pickupSincePrevSnapshot?: number; // absent si non renseigné
  cancellationsSincePrevSnapshot?: number; // absent si non renseigné
  publicRateAtSnapshotEur?: number; // Tarif public affiché à cet instant
  compsetRateAtSnapshotEur?: number; // Tarif compset à cet instant
  turnawaysAtSnapshot?: number; // Refus enregistrés
  dataSource: 'D-EDGE CRS' | 'PMS Night Audit' | 'Lighthouse' | 'Import Excel';
}

// -------------------------------------------------------------
// ONGLET 3 : PARAMÈTRES DE L'ÉTABLISSEMENT
// -------------------------------------------------------------

export interface HotelParametersProfile {
  hotelId: string;
  hotelName: string;
  city: string;
  categoryStars: number;
  totalRooms: number;
  marketableRooms: number;
  roomTypesBreakdown: {
    categoryName: string;
    roomCount: number;
    baseRateEur: number;
  }[];
  usualClosedDays: string[]; // e.g. [] or ['Dimanche']
  hotelPositioning: 'Luxe' | 'Boutique Hôtel' | 'Affaires Premium' | 'Économique Chic';
  primarySegment: 'Loisirs Individuels' | 'Affaires / Corporate' | 'Groupes / MICE' | 'Mixte';
  primaryMarket: 'France' | 'USA' | 'Royaume-Uni' | 'Europe' | 'International';
  currency: 'EUR' | 'USD' | 'GBP';
  timezone: string;
  targetAdrEur: number;
  targetOccupancyPercent: number;
  targetRevparEur: number;
  floorRateEur: number; // Plancher strict
  ceilingRateEur: number; // Plafond autorisé
  avgDistributionCostEur: number;
  compsetReferenceHotels: string[];
}

// -------------------------------------------------------------
// MOTEUR PRÉDICTIF & SUGGESTION TARIFAIRE CROISÉE
// -------------------------------------------------------------

export interface DemandScoreFactors {
  historicalDemandScore: number; // 0-100 (basé sur 3 années N-1, N-2, N-3)
  currentOtbPaceScore: number; // 0-100 (remplissage actuel et accélération pickup)
  marketDemandScore: number; // 0-100 (Lighthouse + calendrier événementiel)
  eventsTensionScore: number; // 0-100 (événements, proximité, affluence, pondération)
  calendarPressureScore: number; // 0-100 (jours fériés, vacances scolaires, ponts)
  compsetPositionScore: number; // 0-100 (taux de saturation du compset et prix concurrents)
}

export interface DemandScoreResult {
  score: number; // 0 à 100
  category: 'tres_faible' | 'faible' | 'moderee' | 'elevee' | 'exceptionnelle';
  categoryLabel: string;
  colorClass: string;
  factors: DemandScoreFactors;
  explanation: string;
}

export interface PredictivePricingScenario {
  scenarioName: 'prudent' | 'equilibre' | 'agressif';
  scenarioLabel: string;
  suggestedBarEur: number;
  deltaVsCurrentEur: number;
  deltaVsCurrentPercent: number;
  expectedOccupancyPercent: number;
  expectedAdrEur: number;
  projectedRevParEur: number;
  projectedRevenueEur: number;
  riskDescription: string;
}

export interface CommercialActionRecommendation {
  primaryAction:
    | 'maintenir'
    | 'augmenter_fort'
    | 'augmenter_modere'
    | 'reduire_tactique'
    | 'fermer_promos'
    | 'fermer_canaux_couteux'
    | 'appliquer_min_stay'
    | 'appliquer_cta'
    | 'surveiller';
  actionLabel: string;
  minStaySuggested?: number;
  ctaSuggested?: boolean;
  stopSellPromos?: boolean;
  channelsToRestrict?: string[];
  justificationSummary: string;
}

export interface FullPredictivePricingRecommendation {
  dateStr: string;
  dayOfWeek: string;
  currentBarEur: number;
  historicalComparableRateEur: number;
  projectedAdrEur: number;
  projectedOccupancyPercent: number;
  projectedRevParEur: number;
  demandScore: DemandScoreResult;
  optimalRecommendedBarEur: number;
  deltaVsCurrentEur: number;
  deltaVsCurrentPercent: number;
  confidenceScore: number; // 0-100 %
  recommendedAction: CommercialActionRecommendation;
  scenarios: {
    prudent: PredictivePricingScenario;
    equilibre: PredictivePricingScenario;
    agressif: PredictivePricingScenario;
  };
  comparableHistory: {
    n1?: { date: string; occ: number; adr: number; revpar: number; bar: number };
    n2?: { date: string; occ: number; adr: number; revpar: number; bar: number };
    n3?: { date: string; occ: number; adr: number; revpar: number; bar: number };
    weightedAvgOcc: number;
    weightedAvgAdr: number;
    weightedAvgRevpar: number;
  };
  justificationNotes: {
    faits: string[];
    analyse: string[];
    prevision: string[];
    recommandation: string[];
    limitesEtHypotheses: string[];
  };
}

// -------------------------------------------------------------
// BACKTESTING & VALIDATION HISTORIQUE
// -------------------------------------------------------------

export type BacktestHorizon = 'J-90' | 'J-60' | 'J-30' | 'J-14' | 'J-7';

export interface BacktestEvaluationPoint {
  dateStr: string;
  horizon: BacktestHorizon;
  actualOccPercent: number;
  predictedOccPercent: number;
  actualAdrEur: number;
  predictedAdrEur: number;
  actualRevParEur: number;
  predictedRevParEur: number;
  actualPickup: number;
  predictedPickup: number;
  occError: number;
  adrError: number;
  revParError: number;
}

export interface BacktestHorizonMetrics {
  horizon: BacktestHorizon;
  sampleSize: number;
  maeOcc: number; // Mean Absolute Error (%)
  rmseOcc: number;
  wapeOcc: number;
  maeAdr: number; // (€)
  rmseAdr: number;
  wapeAdr: number;
  maeRevPar: number; // (€)
  rmseRevPar: number;
  wapeRevPar: number; // (%)
  biasRevPar: number; // Tendance à sur-estimer ou sous-estimer
  accuracyScorePercent: number;
}

export interface BacktestReport {
  hotelId: string;
  evaluatedPeriod: string; // e.g. "01/01/2025 — 31/12/2025"
  totalDaysEvaluated: number;
  generatedAt: string;
  metricsByHorizon: Record<BacktestHorizon, BacktestHorizonMetrics>;
  overallAccuracyPercent: number;
  strengths: string[];
  recommendedModelAdjustments: string[];
  detailedPoints: BacktestEvaluationPoint[];
}

// -------------------------------------------------------------
// HISTORIQUE D'IMPORT & LOGGING
// -------------------------------------------------------------

export interface HistoricalImportLog {
  id: string;
  hotelId: string;
  fileName: string;
  importedAt: string;
  recordsCount: number;
  snapshotsCount: number;
  dateRange: string;
  status: 'valid' | 'warning' | 'error';
  warningsCount: number;
  errorsCount: number;
  errorsList: { rowNumber: number; column: string; value: any; message: string }[];
  detectedColumns: string[];
  fileSizeKb: number;
  importedBy: string;
}
