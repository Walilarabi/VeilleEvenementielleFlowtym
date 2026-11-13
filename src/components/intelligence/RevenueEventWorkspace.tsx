import React,{useState} from "react";
import type {SupabaseClient} from "@supabase/supabase-js";
import {CalendarDays,MapPin,ShieldCheck,Database,RefreshCw,AlertTriangle} from "lucide-react";
import type {EventItem,Hotel} from "../../types";
import {decideHotelEventImpact,scoreHotelEventImpact} from "../../services/revenueApiClient";
type Props={hotel:Hotel;events:EventItem[];supabase:SupabaseClient|null;loading:boolean;error:string|null;onRefresh:()=>void;onShowToast:(message:string)=>void;onSelectEvent:(event:EventItem)=>void};
export const RevenueEventWorkspace:React.FC<Props>=({hotel,events,supabase,loading,error,onRefresh,onShowToast,onSelectEvent})=>{
 const [busy,setBusy]=useState<string|null>(null);
 const act=async(event:EventItem,action:"score"|"validate"|"dismiss")=>{
  if(!supabase||!event.occurrenceId){onShowToast("Occurrence événementielle indisponible : action impossible.");return;}
  setBusy(event.occurrenceId);
  try{
   if(action==="score"){const result=await scoreHotelEventImpact(supabase,hotel.id,event.occurrenceId);onShowToast("Score calculé par le backend. Validation humaine toujours requise.");}
   else{await decideHotelEventImpact(supabase,hotel.id,event.occurrenceId,action,"revenue_manager_review",action==="validate"?"Impact validé depuis Event Intelligence":"Impact écarté depuis Event Intelligence");onShowToast(action==="validate"?"Impact événementiel validé et audité.":"Impact événementiel écarté et audité.");}
   onRefresh();
  }catch(e){onShowToast(e instanceof Error?e.message:"Action événementielle impossible.");}
  finally{setBusy(null);}
 };
 return <section className="space-y-5">
  <header className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Event Intelligence · Supabase</p><h2 className="mt-1 text-xl font-bold">Impacts événementiels par hôtel</h2><p className="mt-1 text-sm text-slate-500">{hotel.name} · Événements associés à cet hôtel uniquement</p><div className="mt-3 flex gap-3 text-xs text-slate-600"><span>{events.length} impact(s) persisté(s)</span><span>{events.filter(e=>e.impactStatus==="to_review").length} à vérifier</span><span>{events.filter(e=>e.impactStatus==="validated").length} validé(s)</span></div></header>
  {error&&<p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
  {events.length===0?<div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><Database className="mx-auto h-8 w-8 text-slate-400"/><h3 className="mt-3 font-semibold">Aucun impact événementiel persisté</h3><p className="mt-1 text-sm text-slate-500">Aucun événement n’est actuellement associé à cet hôtel dans le backend. Le catalogue d’événements fictifs a été écarté.</p><button onClick={onRefresh} disabled={loading} className="mt-4 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"><RefreshCw className="h-4 w-4"/>Actualiser</button></div>:
  <div className="space-y-3">{events.map(event=><article key={event.occurrenceId??event.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap justify-between gap-3"><div><button onClick={()=>onSelectEvent(event)} className="text-left font-semibold text-slate-900 hover:text-violet-700">{event.title}</button><p className="mt-1 flex items-center gap-2 text-xs text-slate-500"><CalendarDays className="h-3.5 w-3.5"/>{event.startDate} → {event.endDate}<MapPin className="ml-2 h-3.5 w-3.5"/>{event.venueName}, {event.city}</p></div><div className="text-right"><p className="text-lg font-bold">{event.scoreBreakdown.finalRMScore}/100</p><p className="text-xs text-slate-500">Score RM calculé</p></div></div><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><div className="text-xs text-slate-600">Statut : <strong>{event.impactStatus??"non renseigné"}</strong> · Confiance : {event.scoreBreakdown.confidenceScore}% · Distance : {event.hotelImpacts[hotel.id]?.distanceKm||"—"} km</div><div className="flex flex-wrap gap-2"><button disabled={!!busy||loading} onClick={()=>void act(event,"score")} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-50">Recalculer le score</button>{event.impactStatus==="to_review"&&<><button disabled={!!busy||loading} onClick={()=>void act(event,"validate")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Valider</button><button disabled={!!busy||loading} onClick={()=>void act(event,"dismiss")} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50">Écarter</button></>}</div></div>{event.evidences.length>0&&<div className="mt-3 border-t pt-3 text-xs text-slate-500">Preuves : {event.evidences.map(e=>e.sourceName).join(" · ")}</div>}</article>)}</div>}
  <p className="flex items-start gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600"/>Les scores sont propres à l’hôtel et ne déclenchent aucune hausse tarifaire automatique. Les validations et rejets sont journalisés.</p>
 </section>;
};
