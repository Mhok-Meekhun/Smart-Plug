"use client";

import { useRouter } from "../i18n/navigation";
import { createClient } from "../lib/supabase/client";
import { useEffect } from "react";

export function RealtimeRefresh({ homeId }: { homeId: string | undefined }) {
  const router=useRouter();
  useEffect(()=>{
    if(!homeId)return;
    const client=createClient();
    let timer:ReturnType<typeof setTimeout>|undefined;
    const refresh=()=>{if(timer)return;timer=setTimeout(()=>{timer=undefined;router.refresh();},1_500);};
    const channel=client.channel(`home:${homeId}`,{config:{private:true}})
      .on("broadcast",{event:"telemetry.updated"},refresh)
      .on("broadcast",{event:"device.state"},refresh)
      .on("broadcast",{event:"device.availability"},refresh)
      .on("broadcast",{event:"command.updated"},refresh)
      .subscribe();
    return()=>{if(timer)clearTimeout(timer);void client.removeChannel(channel);};
  },[homeId,router]);
  return null;
}
