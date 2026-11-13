export type PriceExperimentObservation = {
  experiment_id: string;
  stay_date: string;
  room_type_id: string | null;
  rate_plan_id: string | null;
  channel: string;
  currency: string;
  group_type: "control" | "treatment";
  assigned_price: number;
  exposure_count: number;
  rooms_sold: number;
  source_status: string;
};

export type ElasticityEstimate = {
  status: "insufficient_data" | "non_monotonic" | "unstable" | "estimated";
  elasticity: number | null;
  rSquared: number | null;
  samplePairs: number;
  standardError: number | null;
  confidenceInterval95: [number,number] | null;
  reason: string | null;
};

export function estimatePairedPriceElasticity(
  rows: PriceExperimentObservation[],
  config: { minPairs: number; minRSquared: number; maxAbsElasticity: number },
): ElasticityEstimate {
  const groups=new Map<string,{control?:{priceExposure:number;exposure:number;sold:number};treatment?:{priceExposure:number;exposure:number;sold:number}}>();
  for (const row of rows) {
    if (!["live","imported"].includes(row.source_status) ||
        !Number.isFinite(row.assigned_price)||row.assigned_price<=0||
        !Number.isInteger(row.exposure_count)||row.exposure_count<=0||
        !Number.isInteger(row.rooms_sold)||row.rooms_sold<0) continue;
    const key=[row.experiment_id,row.stay_date,row.room_type_id??"",row.rate_plan_id??"",row.channel,row.currency].join("|");
    const bucket=groups.get(key)??{};
    const group=bucket[row.group_type]??{priceExposure:0,exposure:0,sold:0};
    group.priceExposure+=row.assigned_price*row.exposure_count;
    group.exposure+=row.exposure_count;
    group.sold+=row.rooms_sold;
    bucket[row.group_type]=group;
    groups.set(key,bucket);
  }
  const pairs:{x:number;y:number}[]=[];
  for (const bucket of groups.values()) {
    if (!bucket.control||!bucket.treatment||bucket.control.sold<=0||bucket.treatment.sold<=0) continue;
    const controlPrice=bucket.control.priceExposure/bucket.control.exposure;
    const treatmentPrice=bucket.treatment.priceExposure/bucket.treatment.exposure;
    const controlConversion=bucket.control.sold/bucket.control.exposure;
    const treatmentConversion=bucket.treatment.sold/bucket.treatment.exposure;
    if (controlPrice<=0||treatmentPrice<=0||controlConversion<=0||treatmentConversion<=0||controlPrice===treatmentPrice) continue;
    pairs.push({x:Math.log(treatmentPrice/controlPrice),y:Math.log(treatmentConversion/controlConversion)});
  }
  if (pairs.length<config.minPairs) return {
    status:"insufficient_data",elasticity:null,rSquared:null,samplePairs:pairs.length,standardError:null,confidenceInterval95:null,
    reason:`At least ${config.minPairs} valid randomized control/treatment pairs are required.`,
  };
  const sumXX=pairs.reduce((s,p)=>s+p.x*p.x,0);
  if (sumXX===0) return {status:"insufficient_data",elasticity:null,rSquared:null,samplePairs:pairs.length,standardError:null,confidenceInterval95:null,reason:"No usable price variation."};
  const beta=pairs.reduce((s,p)=>s+p.x*p.y,0)/sumXX;
  const meanY=pairs.reduce((s,p)=>s+p.y,0)/pairs.length;
  const sse=pairs.reduce((s,p)=>s+(p.y-beta*p.x)**2,0);
  const sst=pairs.reduce((s,p)=>s+(p.y-meanY)**2,0);
  const rSquared=sst>0?1-sse/sst:null;
  const standardError=pairs.length>1?Math.sqrt((sse/(pairs.length-1))/sumXX):null;
  const ci=standardError===null?null:[beta-1.96*standardError,beta+1.96*standardError] as [number,number];
  if (beta>=0) return {status:"non_monotonic",elasticity:beta,rSquared,samplePairs:pairs.length,standardError,confidenceInterval95:ci,reason:"Estimated response is non-negative; do not use as price elasticity."};
  if (rSquared===null||rSquared<config.minRSquared||Math.abs(beta)>config.maxAbsElasticity) {
    return {status:"unstable",elasticity:beta,rSquared,samplePairs:pairs.length,standardError,confidenceInterval95:ci,reason:"Fit quality or elasticity magnitude is outside the hotel's calibration limits."};
  }
  return {status:"estimated",elasticity:beta,rSquared,samplePairs:pairs.length,standardError,confidenceInterval95:ci,reason:null};
}
