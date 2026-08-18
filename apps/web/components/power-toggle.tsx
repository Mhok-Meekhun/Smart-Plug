"use client";

import { Power } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { createClient } from "../lib/supabase/client";

export function PowerToggle({ deviceId, initialState, demo, onConfirmed }: { deviceId: string; initialState: boolean; demo: boolean; onConfirmed?: (relayState: boolean) => void }) {
  const t = useTranslations("Device");
  const [relayState, setRelayState] = useState(initialState);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setRelayState(initialState);
  }, [initialState]);

  function toggle() {
    setError(undefined);
    startTransition(async () => {
      const desired = !relayState;
      if (demo) {
        await new Promise((resolve) => setTimeout(resolve, 450));
        setRelayState(desired);
        onConfirmed?.(desired);
        return;
      }
      try {
        const { data } = await createClient().auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Missing session");
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/devices/${deviceId}/commands/relay`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
          body: JSON.stringify({ relayState: desired })
        });
        if (!response.ok) throw new Error("Command rejected");
        const command = await response.json() as {
          confirmed?: boolean;
          desiredRelayState?: boolean;
        };
        if (command.confirmed && command.desiredRelayState === desired) {
          setRelayState(desired);
          onConfirmed?.(desired);
        }
      } catch {
        setError(t("failed"));
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={toggle} disabled={pending} aria-pressed={relayState} aria-label={`${relayState ? t("on") : t("off")}: ${pending ? t("pending") : ""}`} className={`grid size-11 place-items-center rounded-full transition ${relayState ? "bg-[#25a548] text-white shadow-lg shadow-green-800/20" : "bg-[#edf1ed] text-[#879188]"} disabled:opacity-60`}>
        <Power size={21} aria-hidden="true" />
      </button>
      <span className={`text-[.68rem] font-bold ${relayState ? "text-[#18813a]" : "text-[#7a847c]"}`}>{pending ? t("pending") : relayState ? t("on") : t("off")}</span>
      {error ? <span role="alert" className="max-w-32 text-right text-[.65rem] text-red-600">{error}</span> : null}
    </div>
  );
}
