import React from "react";
import { Activity, RefreshCw, Database, CalendarDays, TrendingUp, Building2, AlertTriangle } from "lucide-react";

type Props={loading:boolean;error:string|null;loadedAt?:string;hotelCount:number;rateCount:number;eventCount:number;forecastCount:number;onRefresh:()=>void};
export const RevenueBackendStatus:React.FC<Props>=({loading,error,loadedAt,hotelCount,rateCount,eventCount,forecastCount,onRefresh})=>(
 <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs" aria-live="polite">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div className="flex items-center gap-2 min-w-0">
    <span className={`inline-flex h-2.5 w-2.5 rounded-full ${error?'bg-rose-500':loading?'bg-amber-400':'bg-emerald-500'}`}/>
    <div><p className="text-xs font-semibold text-slate-800">Backend Revenue Management · Supabase</p>
     <p className="text-[11px] text-slate-500">{error?error:loading?"Actualisation des données…":loadedAt?`Données persistées · actualisées à ${new Date(loadedAt).toLocaleTimeString("fr-FR")}`:"En attente de données"}</p></div>
   </div>
   <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
    <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5"/>{hotelCount} hôtel(s)</span>
    <span className="inline-flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5"/>{rateCount} tarifs</span>
    <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5"/>{eventCount} impacts événementiels</span>
    <span className="inline-flex items-center gap-1"><Activity className="h-3.5 w-3.5"/>{forecastCount} prévisions</span>
    <button type="button" disabled={loading} onClick={onRefresh} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading?'animate-spin':''}`}/>Actualiser</button>
   </div>
  </div>
  {error&&<div className="mt-2 flex items-center gap-2 text-xs text-rose-700"><AlertTriangle className="h-3.5 w-3.5"/>Les écrans ne basculent pas sur des données de démonstration en cas d’échec API.</div>}
 </section>
);
