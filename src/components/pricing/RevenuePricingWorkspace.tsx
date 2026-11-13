import React,{useMemo,useState} from "react";
import type {SupabaseClient} from "@supabase/supabase-js";
import {AlertTriangle,CheckCircle2,RefreshCw,TrendingUp,ShieldCheck,Database,CalendarDays} from "lucide-react";
import type {Hotel} from "../../types";
import type {RevenueRateRow,RevenueLighthouseRow} from "../../services/revenueWorkspace";
import {RevenueHistoricalImportPanel} from "./RevenueHistoricalImportPanel";
import {generatePricingRecommendations,submitRevenueDecision} from "../../services/revenueApiClient";

type Props={hotel:Hotel;rows:RevenueRateRow[];lighthouse:RevenueLighthouseRow[];loading:boolean;error:string|null;supabase:SupabaseClient|null;onRefresh:()=>void;onShowToast:(message:string)=>void};
const money=(v:number|null)=>v===null?"—":new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(v);
const pct=(v:number|null)=>v===null?"—":`${v>0?"+":""}${v.toFixed(1)} %`;
export const RevenuePricingWorkspace:React.FC<Props>=({hotel,rows,lighthouse,loading,error,supabase,onRefresh,onShowToast})=>{
 const [busy,setBusy]=useState<string|null>(null);
 const [editId,setEditId]=useState<string|null>(null);
 const [editRate,setEditRate]=useState("");
 const [range,setRange]=useState(30);
 const sorted=useMemo(()=>[...rows].sort((a,b)=>a.stay_date.localeCompare(b.stay_date)),[rows]);
 const runDecision=async(row:RevenueRateRow,action:"accept"|"modify"|"reject",rate?:number)=>{
  if(!supabase){onShowToast("Session Supabase indisponible.");return;}
  setBusy(row.id);
  try{
   await submitRevenueDecision(supabase,hotel.id,{rateIntelligenceId:row.id,action,appliedRate:rate,reasonCode:action==="accept"?"accepted_by_revenue_manager":action==="modify"?"modified_by_revenue_manager":"rejected_by_revenue_manager",reasonText:action==="modify"?"Tarif ajusté manuellement par le Revenue Manager":action==="reject"?"Recommandation refusée, maintien de la politique actuelle":"Recommandation acceptée par le Revenue Manager"});
   onShowToast(action==="accept"?"Décision enregistrée : recommandation acceptée.":action==="modify"?"Décision enregistrée : tarif modifié.":"Décision enregistrée : recommandation refusée.");
   setEditId(null);onRefresh();
  }catch(e){onShowToast(e instanceof Error?e.message:"Échec de l’enregistrement de la décision.");}
  finally{setBusy(null);}
 };
 const generate=async()=>{
  if(!supabase)return;
  const start=new Date();const end=new Date(start);end.setDate(end.getDate()+range);
  setBusy("generate");
  try{
   const result=await generatePricingRecommendations(supabase,hotel.id,start.toISOString().slice(0,10),end.toISOString().slice(0,10));
   onShowToast(`${result.generated} recommandation(s) générée(s). Validation humaine obligatoire ; aucune publication PMS.`);
   onRefresh();
  }catch(e){onShowToast(e instanceof Error?e.message:"Génération impossible.");}
  finally{setBusy(null);}
 };
 return <section className="space-y-5">
  <header className="rounded-2xl border border-slate-200 bg-white p-5">
   <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Pricing · données persistées</p><h2 className="mt-1 text-xl font-bold text-slate-900">Grille tarifaire Revenue Management</h2><p className="mt-1 text-sm text-slate-500">{hotel.name} · Source : Supabase Revenue API</p></div><button onClick={onRefresh} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold"><RefreshCw className="h-4 w-4"/>Actualiser</button></div>
   <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Lignes tarifaires</p><p className="text-xl font-bold">{rows.length}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">En attente</p><p className="text-xl font-bold">{rows.filter(r=>r.recommendation_status==="pending").length}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Qualité valide</p><p className="text-xl font-bold">{rows.filter(r=>r.data_quality_status==="valid").length}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Données insuffisantes</p><p className="text-xl font-bold">{rows.filter(r=>r.data_quality_status==="insufficient").length}</p></div></div>
  </header>
  <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-slate-900">Générer des recommandations</p><p className="text-xs text-slate-600">Calcul déterministe à partir des données disponibles. Toute décision reste humaine.</p></div><div className="flex items-center gap-2"><select value={range} onChange={e=>setRange(Number(e.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"><option value={7}>7 jours</option><option value={14}>14 jours</option><option value={30}>30 jours</option><option value={60}>60 jours</option><option value={90}>90 jours</option></select><button onClick={generate} disabled={!!busy||loading} className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy==="generate"?"Calcul…":"Générer"}</button></div></div></div>
  {error&&<div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
  {sorted.length===0?<div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><Database className="mx-auto h-8 w-8 text-slate-400"/><h3 className="mt-3 font-semibold text-slate-900">Aucune recommandation tarifaire persistée</h3><p className="mx-auto mt-1 max-w-xl text-sm text-slate-500">La base ne contient actuellement aucune ligne tarifaire pour cet hôtel sur la période chargée. Les tarifs de démonstration ne sont pas affichés.</p></div>:
  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="min-w-[1050px] w-full text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr>{["Date","BAR actuel","BAR suggéré","Écart","Occupation","Pickup 24h / 3j / 7j","Médiane Lighthouse","Qualité","Statut","Décision"].map(x=><th key={x} className="px-3 py-3 font-semibold">{x}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{sorted.map(row=><tr key={row.id} className="align-top"><td className="px-3 py-3 font-semibold">{new Date(row.stay_date+"T00:00:00").toLocaleDateString("fr-FR")}</td><td className="px-3 py-3">{money(row.current_bar)}</td><td className="px-3 py-3 font-semibold">{money(row.suggested_bar)}</td><td className="px-3 py-3">{pct(row.delta_pct)}</td><td className="px-3 py-3">{row.occupancy_pct===null?"—":`${row.occupancy_pct.toFixed(1)} %`}</td><td className="px-3 py-3">{[row.pickup_24h,row.pickup_3d,row.pickup_7d].map(v=>v??"—").join(" / ")}</td><td className="px-3 py-3">{money(row.lighthouse_median??row.flowtym_compset_median)}</td><td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2 py-1">{row.data_quality_status}</span></td><td className="px-3 py-3">{row.recommendation_status}</td><td className="px-3 py-3"><div className="flex flex-wrap gap-1">{row.recommendation_status==="pending"&&<><button disabled={!!busy||row.data_quality_status==="insufficient"} onClick={()=>void runDecision(row,"accept")} className="rounded-md bg-emerald-600 px-2 py-1.5 text-white disabled:opacity-40">Accepter</button><button disabled={!!busy} onClick={()=>{setEditId(row.id);setEditRate(String(row.suggested_bar??row.current_bar??""));}} className="rounded-md border border-slate-200 px-2 py-1.5">Modifier</button><button disabled={!!busy} onClick={()=>void runDecision(row,"reject")} className="rounded-md border border-rose-200 px-2 py-1.5 text-rose-700">Refuser</button></>}</div>{editId===row.id&&<div className="mt-2 flex gap-1"><input type="number" min="1" step="0.01" value={editRate} onChange={e=>setEditRate(e.target.value)} className="w-24 rounded border px-2 py-1" aria-label="Tarif modifié"/><button disabled={!!busy||!Number.isFinite(Number(editRate))||Number(editRate)<=0} onClick={()=>void runDecision(row,"modify",Number(editRate))} className="rounded bg-violet-700 px-2 py-1 text-white">Valider</button><button onClick={()=>setEditId(null)} className="rounded border px-2 py-1">×</button></div>}</td></tr>)}</tbody></table></div>}
  <p className="flex items-start gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600"/>Une décision acceptée ou modifiée est enregistrée dans le journal d’audit. Cette action ne publie aucun tarif vers D-EDGE ou un channel manager.</p>
 </section>;
};
