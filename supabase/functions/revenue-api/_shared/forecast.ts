export type HistoricalRevenueRow = {
  stay_date: string;
  day_of_week?: number | null;
  occupancy_pct?: number | null;
  adr_net?: number | null;
  revpar?: number | null;
  source_status?: string;
};

export type HistoricalDemandSnapshot = {
  arrival_date: string;
  observation_date: string;
  days_before_arrival: number;
  source_status?: string;
};

export type ForecastBaselineName =
  | "seasonal_naive_same_month_weekday"
  | "same_weekday_last_year"
  | "seasonal_average_same_month"
  | "pickup_historical_comparable";

export type ForecastSampleSummary = {
  sampleCount: number;
  occupancyP10: number | null;
  occupancyP50: number;
  occupancyP90: number | null;
  adrP50: number | null;
  revparP50: number | null;
};

const validActual = (r: HistoricalRevenueRow) =>
  ["real","imported"].includes(r.source_status ?? "") &&
  typeof r.occupancy_pct === "number" &&
  Number.isFinite(r.occupancy_pct) &&
  r.occupancy_pct >= 0 && r.occupancy_pct <= 100;

const monthOf = (date: string) => new Date(date + "T00:00:00Z").getUTCMonth() + 1;
const weekdayOf = (date: string) => new Date(date + "T00:00:00Z").getUTCDay();
const addDays = (iso: string, days: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0,10);
};

export function selectForecastTrainingRows(
  model: ForecastBaselineName,
  stayDate: string,
  asOfDate: string,
  horizonDays: number,
  history: HistoricalRevenueRow[],
  demandSnapshots: HistoricalDemandSnapshot[],
  actualByDate: Map<string, HistoricalRevenueRow>,
): HistoricalRevenueRow[] {
  const targetMonth = monthOf(stayDate);
  const targetWeekday = weekdayOf(stayDate);
  const training = history.filter(r => r.stay_date < asOfDate && validActual(r));

  if (model === "seasonal_naive_same_month_weekday") {
    return training.filter(r =>
      monthOf(r.stay_date) === targetMonth &&
      (r.day_of_week ?? weekdayOf(r.stay_date)) === targetWeekday
    );
  }

  if (model === "same_weekday_last_year") {
    const reference = addDays(stayDate, -365);
    const lower = addDays(reference, -7);
    const upper = addDays(reference, 7);
    return training.filter(r =>
      r.stay_date >= lower && r.stay_date <= upper &&
      (r.day_of_week ?? weekdayOf(r.stay_date)) === targetWeekday
    );
  }

  if (model === "seasonal_average_same_month") {
    return training.filter(r => monthOf(r.stay_date) === targetMonth);
  }

  const comparableByArrival = new Map<string, HistoricalRevenueRow>();
  for (const snapshot of demandSnapshots) {
    if (
      !["real","imported"].includes(snapshot.source_status ?? "") ||
      snapshot.arrival_date >= asOfDate ||
      snapshot.observation_date > asOfDate ||
      Math.abs(Number(snapshot.days_before_arrival) - horizonDays) > 2 ||
      monthOf(snapshot.arrival_date) !== targetMonth ||
      weekdayOf(snapshot.arrival_date) !== targetWeekday
    ) continue;
    const actual = actualByDate.get(snapshot.arrival_date);
    if (actual && actual.stay_date < asOfDate && validActual(actual) && !comparableByArrival.has(snapshot.arrival_date)) {
      comparableByArrival.set(snapshot.arrival_date, actual);
    }
  }
  return [...comparableByArrival.values()];
}

export function calculateMedian(values: number[]): number | null {
  if (!values.length || !values.every(Number.isFinite)) return null;
  const sorted=[...values].sort((a,b)=>a-b);
  const middle=Math.floor(sorted.length/2);
  return sorted.length%2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2;
}

export function calculateQuantile(values: number[], q: number): number | null {
  if (!values.length || !values.every(Number.isFinite) || q<0 || q>1) return null;
  const sorted=[...values].sort((a,b)=>a-b);
  const position=(sorted.length-1)*q;
  const lower=Math.floor(position),upper=Math.ceil(position);
  return sorted[lower]+(sorted[upper]-sorted[lower])*(position-lower);
}

export function summarizeForecastSamples(rows: HistoricalRevenueRow[], minimumSamples=3): ForecastSampleSummary | null {
  const occupancy=rows.map(r=>Number(r.occupancy_pct)).filter(n=>Number.isFinite(n)&&n>=0&&n<=100);
  if (occupancy.length<minimumSamples) return null;
  const adr=rows.map(r=>Number(r.adr_net)).filter(n=>Number.isFinite(n)&&n>=0);
  const revpar=rows.map(r=>Number(r.revpar)).filter(n=>Number.isFinite(n)&&n>=0);
  return {
    sampleCount:occupancy.length,
    occupancyP10:occupancy.length>=3?calculateQuantile(occupancy,0.1):null,
    occupancyP50:calculateMedian(occupancy)!,
    occupancyP90:occupancy.length>=3?calculateQuantile(occupancy,0.9):null,
    adrP50:calculateMedian(adr),
    revparP50:calculateMedian(revpar),
  };
}

export function calculateForecastMetrics(actual: number[], forecast: number[]) {
  if (!actual.length || actual.length!==forecast.length || ![...actual,...forecast].every(Number.isFinite)) return null;
  const errors=actual.map((a,i)=>forecast[i]-a);
  const absoluteError=errors.reduce((s,e)=>s+Math.abs(e),0);
  const actualAbsTotal=actual.reduce((s,a)=>s+Math.abs(a),0);
  const actualTotal=actual.reduce((s,a)=>s+a,0);
  return {
    sampleCount:actual.length,
    wape:actualAbsTotal>0?absoluteError/actualAbsTotal:null,
    mae:absoluteError/actual.length,
    rmse:Math.sqrt(errors.reduce((s,e)=>s+e*e,0)/actual.length),
    biasPct:actualTotal!==0?errors.reduce((s,e)=>s+e,0)/actualTotal*100:null,
  };
}

export function calculateNetPickup(
  newRoomsBooked: number,
  cancelledRooms: number,
  movedInRooms=0,
  movedOutRooms=0,
): number | null {
  const values=[newRoomsBooked,cancelledRooms,movedInRooms,movedOutRooms];
  if (!values.every(v=>Number.isInteger(v)&&v>=0)) return null;
  return newRoomsBooked-cancelledRooms+movedInRooms-movedOutRooms;
}

export function calculateHaversineKm(lat1:number,lon1:number,lat2:number,lon2:number):number {
  const rad=(v:number)=>v*Math.PI/180;
  const dLat=rad(lat2-lat1),dLon=rad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
