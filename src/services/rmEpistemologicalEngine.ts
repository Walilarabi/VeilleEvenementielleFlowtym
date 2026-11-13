/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @deprecated LEGACY BROWSER / DEMO SERVICE.
 * Not the authoritative backend and not approved for live Revenue Management decisions.
 * Live persistence and decisions must use the authenticated Supabase Revenue API
 * (src/services/revenueApiClient.ts) and its RLS-protected database contracts.
 */

import {
  EventItem,
  Hotel,
  RMEpistemologicalBreakdown,
  StandardDemandLevel,
} from '../types';
import { CompsetSnapshot } from './compsetBenchmarkService';
import { DEdgeInventoryDay } from '../types';

/**
 * Moteur d'explicabilité et de justification épistémologique Revenue Management (5 Niveaux)
 * Distingue rigoureusement :
 *   1. FAIT OBSERVÉ (Donnée brute vérifiable)
 *   2. ANALYSE (Interprétation des dynamiques de marché)
 *   3. PRÉVISION (Projection chiffrée probabiliste)
 *   4. RECOMMANDATION (Action tactique ou stratégique RM)
 *   5. HYPOTHÈSE (Conditions de validité et limites)
 */
export function generateRMEpistemologicalBreakdown(
  dateStr: string,
  hotel: Hotel,
  dayEvents: EventItem[],
  compset: CompsetSnapshot,
  dedge: DEdgeInventoryDay
): RMEpistemologicalBreakdown {
  const faitObserve: string[] = [];
  const analyse: string[] = [];
  const prevision: string[] = [];
  const hypothese: string[] = [];
  const primaryDrivers: string[] = [];
  const baseADR = hotel.baseADR ?? 0;

  const totalPax = dayEvents.reduce((acc, e) => acc + (e.expectedAttendance || 0), 0);
  const maxScore = dayEvents.length > 0 ? Math.max(...dayEvents.map((e) => e.scoreBreakdown?.finalRMScore ?? 50)) : 0;

  // 1. FAITS OBSERVÉS
  if (dayEvents.length > 0) {
    faitObserve.push(
      `${dayEvents.length} événement(s) répertorié(s) cumulant ${totalPax.toLocaleString('fr-FR')} participants attendus (ex: ${dayEvents[0].title}).`
    );
    primaryDrivers.push(dayEvents[0].title);
  } else {
    faitObserve.push('Aucun événement d’envergure (>5 000 pax) identifié dans le périmètre direct.');
  }

  faitObserve.push(
    `Relevé Lighthouse Compset : ${compset.soldOutCount}/${compset.totalCompetitors} concurrents complets (sold-out). Tarif moyen du compset à ${compset.compsetAverage}€.`
  );

  faitObserve.push(
    `Données CRS D-EDGE de l’hôtel : Taux d’occupation actuel OTB de ${dedge.occupancyPercent}% (${dedge.roomsSold}/${dedge.totalRooms} chambres vendues). Stock restant : ${dedge.roomsAvailable} chambres.`
  );

  if (dedge.pickup24h > 0) {
    faitObserve.push(`Accélération de la demande interne : Pickup de +${dedge.pickup24h} chambres enregistrées lors des dernières 24 heures.`);
  }

  // 2. ANALYSE
  if (compset.soldOutCount >= 2 && dedge.roomsAvailable <= 12) {
    analyse.push('Forte tension de compression : Le marché local sature et le compset direct rejette une demande non servie vers votre établissement.');
  } else if (compset.compsetAverage > baseADR * 1.15) {
    analyse.push(`Écart de positionnement compétitif : Votre tarif de base (${baseADR}€) présente un retard de ${compset.compsetAverage - baseADR}€ face au marché.`);
  } else if (dedge.occupancyPercent < 60 && dayEvents.length === 0) {
    analyse.push('Demande atone : Rythme de réservation organique insuffisant pour garantir le remplissage de base sans stimulation commerciale.');
  } else {
    analyse.push('Équilibre offre/demande conforme aux moyennes saisonnières observées sur le quartier.');
  }

  if (dedge.bookingVelocity === 'tres_rapide') {
    analyse.push('Vitesse de réservation critique : Risque avéré d’épuisement prématuré de votre stock à tarif insuffisant (phénomène de sous-tarification).');
  }

  // 3. PRÉVISION
  let projectedOcc = Math.min(100, dedge.occupancyPercent + Math.round((100 - dedge.occupancyPercent) * 0.7));
  let demandLevel: StandardDemandLevel = compset.demandLevel;

  if (demandLevel === 'exceptionnel') {
    prevision.push(`Taux d’occupation final projeté à ${projectedOcc}% sous 72h avec saturation du quartier.`);
    prevision.push('Capacité d’absorption du marché très élevée permettant de capter une clientèle à haute contribution.');
  } else if (demandLevel === 'eleve') {
    prevision.push(`Taux d’occupation final estimé entre ${dedge.occupancyPercent + 10}% et ${Math.min(98, dedge.occupancyPercent + 25)}%.`);
  } else {
    prevision.push(`Stabilisation prévisionnelle autour de ${dedge.occupancyPercent + 10}% d’occupation.`);
  }

  // 4. RECOMMANDATION RM
  let recommandation = '';
  if (demandLevel === 'exceptionnel') {
    const targetRate = Math.round(baseADR * 1.42);
    recommandation = `Hausse vigoureuse du BAR à ${targetRate}€ (+42%), verrouillage immédiat des tarifs non annulables remisés, et application d’un Minimum Stay de 2 ou 3 nuits.`;
  } else if (demandLevel === 'eleve') {
    const targetRate = Math.round(baseADR * 1.25);
    recommandation = `Rehausser le tarif de vente à ${targetRate}€ (+25%), fermer les canaux OTA à forte commission (>20%) et protéger le stock restant pour la clientèle directe.`;
  } else if (demandLevel === 'faible' && dedge.occupancyPercent < 65) {
    recommandation = `Maintenir le BAR de base (${baseADR}€), ouvrir les packages loisirs (ex. petit-déjeuner inclus) et assouplir la politique d’annulation à J-1 sans brader le prix facial.`;
  } else {
    recommandation = `Maintenir le tarif actuel (${baseADR}€) ou tester un incrément tactique de +10€ tout en surveillant le pickup quotidien D-EDGE.`;
  }

  // 5. HYPOTHÈSES & LIMITES
  hypothese.push('Hypothèse de maintien des conditions de transport et d’accès au lieu de séjour.');
  hypothese.push('La projection suppose un taux d’annulation inférieur à 8% sur les réservations en portefeuille.');
  if (dayEvents.length > 0 && dayEvents[0].status !== 'confirmed') {
    hypothese.push(`Attention : L’événement "${dayEvents[0].title}" est au statut "${dayEvents[0].status}", nécessitant confirmation des dates officielles.`);
  }

  // Score de confiance
  const hasOfficialProof = dayEvents.some((e) => (e.evidences || []).length > 0);
  const confidenceScore = dayEvents.length === 0 ? 88 : hasOfficialProof ? 95 : 82;

  return {
    faitObserve,
    analyse,
    prevision,
    recommandation,
    hypothese,
    confidenceScore,
    primaryDrivers: primaryDrivers.length > 0 ? primaryDrivers : ['Pression de marché organique'],
  };
}
