"use client";

import { CirclePower, LoaderCircle, Power } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, useTransition } from "react";
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
  const [waitingFor, setWaitingFor] = useState<{ id: string; desired: boolean; deadline: number }>();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setRelayState(initialState);
  }, [initialState]);

  useEffect(() => {
    if (!waitingFor) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll(command: NonNullable<typeof waitingFor>) {
      try {
        const result = await apiRequest<{ status: string; failureCode?: string | null }>(
          `/v1/devices/${deviceId}/commands/relay/${command.id}`,
          { signal: AbortSignal.timeout(4_000) },
        );
        if (cancelled) return;
        if (result.status === "ACKNOWLEDGED") {
          setWaitingFor(undefined);
          onConfirmed?.(command.desired);
          return;
        }
        if (result.status === "FAILED" || result.status === "CANCELLED" || result.status === "TIMED_OUT") {
          setWaitingFor(undefined);
          if (result.status === "TIMED_OUT") setError(t("relayUnconfirmed"));
          else if (result.failureCode === "METER_READING_STALE") setError(t("relayMeterStale"));
          else if (result.failureCode === "METER_PF_INVALID") setError(t("relayMeterPfInvalid"));
          else setError(t("failed"));
          return;
        }
      } catch {
        // A brief request failure must not be treated as device acknowledgement.
      }
      if (cancelled) return;
      if (Date.now() >= command.deadline) {
        setWaitingFor(undefined);
        setError(t("relayUnconfirmed"));
        return;
      }
      timer = setTimeout(() => void poll(command), 1_000);
    }

    timer = setTimeout(() => void poll(waitingFor), 650);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [deviceId, onConfirmed, t, waitingFor]);

  function requestState(desired: boolean) {
    if (pending || waitingFor != null || unavailable || (appearance !== "buttons" && desired === relayState)) return;
    setError(undefined);
    startTransition(async () => {
      try {
        const command = await apiRequest<{
          commandId: string;
          confirmed?: boolean;
          desiredRelayState?: boolean;
        }>(
          `/v1/devices/${deviceId}/commands/relay`,
          {
            method: "POST",
            ...(demo ? {} : { headers: { "Idempotency-Key": crypto.randomUUID() } }),
            body: JSON.stringify({ relayState: desired }),
          },
        );
        if (demo || (command.confirmed && command.desiredRelayState === desired)) {
          setRelayState(desired);
          onConfirmed?.(desired);
        } else if (appearance === "buttons") {
          setWaitingFor({ id: command.commandId, desired, deadline: Date.now() + 35_000 });
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
            onClick={() => requestState(true)} disabled={busy || unavailable}
            aria-describedby={unavailableReason ? reasonId : undefined}>
            <Power size={16} aria-hidden="true" />
            {t("relayTurnOn")}
          </button>
          <button type="button" className="relay-action relay-action-off"
            onClick={() => requestState(false)} disabled={busy || unavailable}
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
