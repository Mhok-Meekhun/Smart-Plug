"use client";

import { LoaderCircle, Power } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { createClient } from "../lib/supabase/client";

export function PowerToggle({
  deviceId,
  initialState,
  demo,
  onConfirmed,
  appearance = "switch",
}: {
  deviceId: string;
  initialState: boolean;
  demo: boolean;
  onConfirmed?: (relayState: boolean) => void;
  appearance?: "switch" | "hero";
}) {
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
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/v1/devices/${deviceId}/commands/relay`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              "Idempotency-Key": crypto.randomUUID(),
            },
            body: JSON.stringify({ relayState: desired }),
          },
        );
        if (!response.ok) throw new Error("Command rejected");
        const command = (await response.json()) as {
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
    <div className={`flex flex-col items-end gap-1 ${appearance === "hero" ? "power-toggle--hero" : ""}`}>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        role={appearance === "switch" ? "switch" : undefined}
        aria-checked={appearance === "switch" ? relayState : undefined}
        aria-pressed={appearance === "hero" ? relayState : undefined}
        aria-label={`${relayState ? t("on") : t("off")}: ${pending ? t("pending") : ""}`}
        className={appearance === "hero"
          ? `grid size-20 place-items-center rounded-full bg-white text-[#249b47] shadow-[0_0_0_8px_rgba(255,255,255,.07),0_16px_35px_rgba(0,0,0,.24)] transition hover:scale-105 disabled:opacity-60 ${relayState ? "" : "text-[#7c8f84]"}`
          : `relative h-8 w-13 rounded-full transition-colors duration-300 ${relayState ? "bg-[#259d48]" : "bg-[#dce3de]"} disabled:opacity-60`}
      >
        {appearance === "hero" ? (
          pending ? <LoaderCircle size={31} className="animate-spin" aria-hidden="true" /> : <Power size={32} aria-hidden="true" />
        ) : (
          <span className={`absolute top-1 grid size-6 place-items-center rounded-full bg-white shadow-sm transition-[left] duration-300 ${relayState ? "left-6" : "left-1"}`}>
            {pending ? <LoaderCircle size={13} className="animate-spin text-[#249b47]" aria-hidden="true" /> : null}
          </span>
        )}
      </button>
      <span
        className={`text-[.68rem] font-bold ${relayState ? "text-[#18813a]" : "text-[#7a847c]"}`}
      >
        {pending ? t("pending") : relayState ? t("on") : t("off")}
      </span>
      {error ? (
        <span
          role="alert"
          className="max-w-32 text-right text-[.65rem] text-red-600"
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}
