import React,{useState} from "react";
import type {SupabaseClient} from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import {FileSpreadsheet,Upload,ShieldCheck,AlertTriangle} from "lucide-react";
import type {Hotel} from "../../types";
import {importHotelHistoricalRows} from "../../services/revenueApiClient";
type Props={hotel:Hotel;supabase:SupabaseClient|null;onImported:()=>void;onShowToast:(message:string)=>void};
const normalize=(s:string)=>s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
const pick=(row:Record<string,unknown>,aliases:string[])=>{
 const entries=Object.entries(row);
 for(const alias of aliases){const key=normalize(alias);const found=entries.find(([k])=>normalize(k)===key);if(found)return found[1];}
 return null;
};
const numberValue=(v:unknown):number|null=>{
 if(v===null||v===undefined||v==="")return null;
 const n=typeof v==="number"?v:Number(String(v).replace(/\s/g,"").replace("€","").replace("%","").replace(",","."));
 return Number.isFinite(n)?n:null;
};
const dateValue=(v:unknown):string|null=>{
 if(v instanceof Date&&!Number.isNaN(v.getTime()))return v.toISOString().slice(0,10);
 const s=String(v??"").trim();
 if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
 const m=s.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/);
 if(m)return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
 return null;
};
export const RevenueHistoricalImportPanel:React.FC<Props>=({hotel,supabase,onImported,onShowToast})=>{
 const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[preview,setPreview]=useState<Record<string,unknown>[]>([]);
 const parse=async(f:File)=>{
  const bytes=await f.arrayBuffer();const workbook=XLSX.read(bytes,{type:"array",cellDates:true});const sheet=workbook.Sheets[workbook.SheetNames[0]];
  const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(sheet,{defval:null,raw:true});setPreview(rows.slice(0,5));return rows;
 };
 const submit=async()=>{
  if(!file||!supabase)return;
  setBusy(true);
  try{
   const raw=await parse(file);
   if(raw.length<1||raw.length>5000)throw new Error("Le fichier doit contenir entre 1 et 5 000 lignes.");
   const rows=raw.map(row=>{
    const stay_date=dateValue(pick(row,["stay_date","date_sejour","date","date d'arrivee","arrival_date"]));
    if(!stay_date)throw new Error("Une ligne ne contient pas de date de séjour reconnue.");
    const occ=numberValue(pick(row,["occupancy_pct","occupation_pct","occupation","taux_occupation","occ"]));
    const occPct=occ!==null&&occ>0&&occ<=1?occ*100:occ;
    return {
     stay_date,day_of_week:numberValue(pick(row,["day_of_week","jour_semaine"])),
     total_marketable_rooms:numberValue(pick(row,["total_marketable_rooms","total_rooms","capacite","chambres_disponibles_theoriques"])),
     available_rooms:numberValue(pick(row,["available_rooms","rooms_available","chambres_disponibles"])),
     rooms_sold:numberValue(pick(row,["rooms_sold","chambres_vendues","rooms_sold_net"])),
     occupancy_pct:occPct,adr_net:numberValue(pick(row,["adr_net","adr","prix_moyen","average_daily_rate"])),
     revpar:numberValue(pick(row,["revpar","rev_par"])),
     accommodation_revenue:numberValue(pick(row,["accommodation_revenue","room_revenue","ca_hebergement","revenue"])),
     reservations_count:numberValue(pick(row,["reservations_count","reservations","nombre_reservations"])),
     currency:String(pick(row,["currency","devise"])??"EUR").slice(0,3).toUpperCase(),
     raw_record:row,
    };
   });
   const result=await importHotelHistoricalRows(supabase,hotel.id,{fileName:file.name,sourceName:`import:${file.name}`,detectedColumns:Object.keys(raw[0]??{}),rows});
   onShowToast(`Import historique enregistré : ${result.imported} ligne(s).`);setFile(null);setPreview([]);onImported();
  }catch(e){onShowToast(e instanceof Error?e.message:"Import impossible.");}
  finally{setBusy(false);}
 };
 return <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4"><div className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-violet-600"/><div><h3 className="font-semibold">Importer l’historique hôtelier</h3><p className="text-xs text-slate-500">CSV ou Excel · 5 000 lignes maximum · journal d’import serveur</p></div></div><input type="file" accept=".csv,.xlsx,.xls" onChange={e=>{const f=e.target.files?.[0]??null;setFile(f);setPreview([]);}} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-violet-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-violet-800"/>{file&&<p className="text-xs text-slate-600">Fichier sélectionné : {file.name}</p>}{preview.length>0&&<div className="overflow-x-auto"><p className="mb-2 text-xs font-semibold">Aperçu des premières lignes brutes</p><pre className="max-h-40 overflow-auto rounded-lg bg-slate-50 p-3 text-[10px]">{JSON.stringify(preview,null,2)}</pre></div>}<button disabled={!file||busy||!supabase} onClick={()=>void submit()} className="inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"><Upload className="h-4 w-4"/>{busy?"Import en cours…":"Importer dans Supabase"}</button><p className="flex items-start gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600"/>Les lignes sont horodatées et marquées « imported ». Les colonnes non reconnues restent dans raw_record. Un fichier importé n’est pas présenté comme une connexion PMS live.</p></section>;
};
