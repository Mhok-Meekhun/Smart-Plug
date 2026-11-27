"use client";

import { CirclePower, LoaderCircle, Power } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, useTransition } from "react";
import { createClient } from "../lib/supabase/client";
import { apiRequest } from "../lib/api-client";

export function PowerToggle({
  deviceId,
  initialState,
  demo,
  onConfirmed,
  unavailable = false,
  unavailableReason,
  appearance = "switch",
}: {
  deviceId: string;
  initialState: boolean | null;
  demo: boolean;
  onConfirmed?: (relayState: boolean) => void;
  unavailable?: boolean;
  unavailableReason?: string | undefined;
  appearance?: "switch" | "buttons";
}) {
  const t = useTranslations("Device");
  const headingId = useId();
  const reasonId = useId();
  const [relayState, setRelayState] = useState(initialState);
  const [error, setError] = useState<string>();
  const [waitingFor, setWaitingFor] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setRelayState(initialState);
  }, [initialState]);

  useEffect(() => {
    if (waitingFor == null) return;
    if (initialState === waitingFor) {
      setWaitingFor(null);
      return;
    }
    // The device detail refreshes its reported state over Realtime or polling.
    // Leave room for a final refresh after the API command's 30-second expiry.
    const timer = setTimeout(() => {
      setWaitingFor(null);
      setError(t("relayUnconfirmed"));
    }, 47_000);
    return () => clearTimeout(timer);
  }, [initialState, waitingFor, t]);

  function requestState(desired: boolean) {
    if (pending || waitingFor != null || unavailable || desired === relayState) return;
    setError(undefined);
    startTransition(async () => {
      try {
        if (demo) {
          await apiRequest(`/v1/devices/${deviceId}/commands/relay`, {
            method: "POST", body: JSON.stringify({ relayState: desired }),
          });
          setRelayState(desired);
          onConfirmed?.(desired);
          return;
        }
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
        } else if (appearance === "buttons") {
          setWaitingFor(desired);
        }
      } catch {
        setError(t("failed"));
      }
    });
  }

  if (appearance === "buttons") {
    const busy = pending || waitingFor != null;

    return (
      <section aria-labelledby={headingId} className="relay-controls">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={headingId} className="flex items-center gap-2 text-sm font-bold">
            <CirclePower size={17} aria-hidden="true" />
            {t("relayControls")}
          </h2>
          <p role="status" className="text-xs font-semibold text-white/85">
            {relayState == null ? t("relayUnknown") : t(relayState ? "relayOn" : "relayOff")}
          </p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" className="relay-action relay-action-on"
            onClick={() => requestState(true)} disabled={busy || unavailable || relayState === true}
            aria-describedby={unavailableReason ? reasonId : undefined}>
            <Power size={16} aria-hidden="true" />
            {t("relayTurnOn")}
          </button>
          <button type="button" className="relay-action relay-action-off"
            onClick={() => requestState(false)} disabled={busy || unavailable || relayState === false}
            aria-describedby={unavailableReason ? reasonId : undefined}>
            <Power size={16} aria-hidden="true" />
            {t("relayTurnOff")}
          </button>
        </div>
        {unavailableReason ? <p id={reasonId} className="mt-3 text-sm leading-relaxed text-white/85">{unavailableReason}</p> : null}
        {busy ? <p role="status" className="mt-3 flex items-center gap-2 text-sm text-white/85">
          <LoaderCircle size={16} aria-hidden="true" className="animate-spin" />
          {pending ? t("pending") : t("relayWaiting")}
        </p> : null}
        {error ? <p role="alert" className="mt-3 text-sm font-semibold text-red-100">{error}</p> : null}
      </section>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => requestState(!relayState)}
        disabled={pending || unavailable}
        role="switch"
        aria-checked={relayState ?? false}
        aria-label={`${relayState ? t("on") : t("off")}: ${pending ? t("pending") : ""}`}
        className={`relative h-8 w-13 rounded-full transition-colors duration-300 ${relayState ? "bg-[#259d48]" : "bg-[#dce3de]"} disabled:opacity-60`}
      >
        <span className={`absolute top-1 grid size-6 place-items-center rounded-full bg-white shadow-sm transition-[left] duration-300 ${relayState ? "left-6" : "left-1"}`}>
          {pending ? <LoaderCircle size={13} className="animate-spin text-[#249b47]" aria-hidden="true" /> : null}
        </span>
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
