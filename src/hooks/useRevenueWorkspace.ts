import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadRevenueWorkspace, type RevenueWorkspace } from "../services/revenueWorkspace";

export function useRevenueWorkspace(supabase:SupabaseClient|null,selectedHotelId?:string){
 const [workspace,setWorkspace]=useState<RevenueWorkspace|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const [refreshIndex,setRefreshIndex]=useState(0);
 const refresh=useCallback(()=>setRefreshIndex(v=>v+1),[]);
 useEffect(()=>{
  if(!supabase){setWorkspace(null);setError("Client Supabase non disponible.");return;}
  let active=true;setLoading(true);setError(null);
  void loadRevenueWorkspace(supabase,selectedHotelId).then(data=>{
   if(active)setWorkspace(data);
  }).catch(err=>{
   if(active){setError(err instanceof Error?err.message:"Erreur inconnue de chargement Revenue.");setWorkspace(null);}
  }).finally(()=>{if(active)setLoading(false);});
  return ()=>{active=false;};
 },[supabase,selectedHotelId,refreshIndex]);
 return {workspace,loading,error,refresh};
}
