"use client";

import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  History,
  LoaderCircle,
  MapPin,
  PauseCircle,
  PlayCircle,
  PlugZap,
  Plus,
  ShieldAlert,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { Link } from "../i18n/navigation";
import { apiRequest } from "../lib/api-client";

type Device = {
  id: string;
  name: string;
  type: string;
  room: { name: string } | null;
};
type Execution = {
  id: string;
  scheduledFor: string;
  status: "PENDING" | "COMMAND_CREATED" | "FAILED" | "SKIPPED";
  failureMessage: string | null;
};
type Schedule = {
  id: string;
  deviceId: string;
  name: string;
  kind: "ONCE" | "REPEATING";
  desiredRelayState: boolean;
  timezone: string;
  executeAt: string | null;
  localTime: string | null;
  weekdays: number[];
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  device: Device;
  executions: Execution[];
};

const weekdayValues = [1, 2, 3, 4, 5, 6, 0] as const;
const bangkokDateTimeToIso = (value: string) => `${value}:00+07:00`;
const clockValue = (value: string | null) =>
  value ? (value.includes("T") ? value.slice(11, 16) : value.slice(0, 5)) : "";

export function ScheduleManager() {
  const t = useTranslations("Schedules");
  const locale = useLocale();
  const [devices, setDevices] = useState<Device[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [kind, setKind] = useState<Schedule["kind"]>("REPEATING");
  const [relayState, setRelayState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [formError, setFormError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [updatingId, setUpdatingId] = useState<string>();
  const [pending, startTransition] = useTransition();
  const dateTime = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Bangkok",
      }),
    [locale],
  );

  const load = useCallback(() => {
    setLoading(true);
    setLoadFailed(false);
    Promise.all([
      apiRequest<Device[]>("/v1/devices"),
      apiRequest<Schedule[]>("/v1/schedules"),
    ])
      .then(([deviceItems, scheduleItems]) => {
        setDevices(deviceItems);
        setSchedules(scheduleItems);
      })
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const weekdays = values.getAll("weekdays").map(Number);
    if (kind === "REPEATING" && weekdays.length === 0) {
      setFormError(true);
      return;
    }
    setFormError(false);
    setSaved(false);
    startTransition(async () => {
      try {
        const common = {
          kind,
          deviceId: String(values.get("deviceId") ?? ""),
          name: String(values.get("name") ?? ""),
          desiredRelayState: relayState,
          timezone: "Asia/Bangkok",
        };
        const payload =
          kind === "ONCE"
            ? {
                ...common,
                kind,
                executeAt: bangkokDateTimeToIso(
                  String(values.get("executeAt") ?? ""),
                ),
              }
            : {
                ...common,
                kind,
                localTime: String(values.get("localTime") ?? ""),
                weekdays,
              };
        const created = await apiRequest<Schedule>("/v1/schedules", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSchedules((items) => [created, ...items]);
        setSaved(true);
        form.reset();
        setRelayState(false);
      } catch {
        setFormError(true);
      }
    });
  }

  function toggle(schedule: Schedule) {
    setUpdatingId(schedule.id);
    setFormError(false);
    startTransition(async () => {
      try {
        const updated = await apiRequest<Schedule>(
          `/v1/schedules/${schedule.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({ enabled: !schedule.enabled }),
          },
        );
        setSchedules((items) =>
          items.map((item) => (item.id === updated.id ? updated : item)),
        );
      } catch {
        setFormError(true);
      } finally {
        setUpdatingId(undefined);
      }
    });
  }

  if (loading)
    return (
      <div className="panel flex min-h-72 items-center justify-center gap-3 p-8 text-sm font-bold text-[#68736a]">
        <LoaderCircle className="animate-spin" size={20} />
        {t("loading")}
      </div>
    );
  if (loadFailed)
    return (
      <div className="panel flex min-h-72 flex-col items-center justify-center gap-4 p-8 text-center">
        <ShieldAlert className="text-red-500" size={35} />
        <p className="font-bold">{t("loadFailed")}</p>
        <button
          onClick={load}
          className="rounded-2xl bg-[#edf7ef] px-5 py-2.5 font-bold text-[#187b36]"
        >
          {t("retry")}
        </button>
      </div>
    );
  if (devices.length === 0)
    return (
      <div className="panel flex min-h-80 flex-col items-center justify-center p-8 text-center">
        <PlugZap size={35} className="text-[#239443]" />
        <h2 className="mt-4 text-xl font-black">{t("deviceRequired")}</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-[#68736a]">
          {t("deviceRequiredBody")}
        </p>
        <Link
          href="/devices/add"
          className="mt-5 rounded-2xl bg-[#209842] px-5 py-3 font-bold text-white"
        >
          {t("addDevice")}
        </Link>
      </div>
    );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[.9fr_1.1fr]">
      <section className="panel p-5 md:p-7">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-[#eaf7ed] text-[#1e8e3e]">
            <Plus size={21} />
          </span>
          <div>
            <h2 className="text-xl font-black">{t("createTitle")}</h2>
            <p className="mt-1 text-xs text-[#748078]">{t("bangkokTime")}</p>
          </div>
        </div>
        {formError ? (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700"
          >
            {t("saveFailed")}
          </p>
        ) : null}
        {saved ? (
          <p
            role="status"
            className="mt-4 flex items-center gap-2 rounded-xl bg-green-50 p-3 text-sm font-bold text-green-800"
          >
            <CheckCircle2 size={17} />
            {t("saved")}
          </p>
        ) : null}
        <form onSubmit={submit} className="mt-6 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-bold">{t("device")}</span>
            <select
              required
              name="deviceId"
              className="h-12 w-full rounded-2xl border border-[#dce5dd] bg-white px-4"
            >
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name}
                  {device.room ? ` · ${device.room.name}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold">{t("name")}</span>
            <input
              required
              name="name"
              maxLength={120}
              placeholder={t("namePlaceholder")}
              className="h-12 w-full rounded-2xl border border-[#dce5dd] px-4"
            />
          </label>
          <fieldset>
            <legend className="mb-2 text-sm font-bold">{t("kind")}</legend>
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#eef4ef] p-1.5">
              {(["REPEATING", "ONCE"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={kind === value}
                  onClick={() => setKind(value)}
                  className={`h-11 rounded-xl text-sm font-bold ${kind === value ? "bg-white text-[#197c37] shadow-sm" : "text-[#69746b]"}`}
                >
                  {value === "REPEATING" ? t("repeating") : t("once")}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-bold">{t("action")}</legend>
            <div className="grid grid-cols-2 gap-2">
              {([false, true] as const).map((value) => (
                <button
                  key={String(value)}
                  type="button"
                  aria-pressed={relayState === value}
                  onClick={() => setRelayState(value)}
                  className={`flex h-12 items-center justify-center gap-2 rounded-2xl border font-bold ${relayState === value ? "border-[#2aa34b] bg-[#eaf7ed] text-[#197c37]" : "border-[#dce5dd] bg-white text-[#69746b]"}`}
                >
                  {value ? <PlayCircle size={19} /> : <PauseCircle size={19} />}{" "}
                  {value ? t("turnOn") : t("turnOff")}
                </button>
              ))}
            </div>
          </fieldset>
          {kind === "ONCE" ? (
            <label className="block">
              <span className="mb-2 block text-sm font-bold">
                {t("dateTime")}
              </span>
              <input
                required
                name="executeAt"
                type="datetime-local"
                className="h-12 w-full rounded-2xl border border-[#dce5dd] px-4"
              />
            </label>
          ) : (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-bold">
                  {t("time")}
                </span>
                <input
                  required
                  name="localTime"
                  type="time"
                  defaultValue="22:30"
                  className="h-12 w-full rounded-2xl border border-[#dce5dd] px-4"
                />
              </label>
              <fieldset>
                <legend className="mb-2 text-sm font-bold">
                  {t("weekdays")}
                </legend>
                <div className="grid grid-cols-7 gap-1.5">
                  {weekdayValues.map((day) => (
                    <label key={day} className="cursor-pointer">
                      <input
                        className="peer sr-only"
                        type="checkbox"
                        name="weekdays"
                        value={day}
                        defaultChecked={day >= 1 && day <= 5}
                      />
                      <span className="grid h-10 place-items-center rounded-xl border border-[#dce5dd] text-xs font-bold text-[#6b766d] peer-checked:border-[#2aa34b] peer-checked:bg-[#eaf7ed] peer-checked:text-[#177536]">
                        {t(`weekday${day}`)}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          )}
          <button
            disabled={pending}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#209842] font-bold text-white shadow-lg shadow-green-900/15 disabled:opacity-60"
          >
            {pending && !updatingId ? (
              <LoaderCircle className="animate-spin" size={18} />
            ) : (
              <CalendarClock size={18} />
            )}{" "}
            {t("create")}
          </button>
        </form>
      </section>

      <div className="space-y-4">
        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <ShieldAlert className="mt-0.5 shrink-0" size={19} />
          <div>
            <p className="font-black">{t("executionNoticeTitle")}</p>
            <p className="mt-1 text-xs leading-5">{t("executionNoticeBody")}</p>
          </div>
        </div>
        <div>
          <h2 className="text-xl font-black">{t("listTitle")}</h2>
          <p className="mt-1 text-xs text-[#748078]">
            {t("count", { count: schedules.length })}
          </p>
        </div>
        {schedules.length === 0 ? (
          <div className="panel flex min-h-56 flex-col items-center justify-center p-7 text-center">
            <Clock3 size={31} className="text-[#249544]" />
            <h3 className="mt-4 font-black">{t("emptyTitle")}</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-[#707b72]">
              {t("emptyBody")}
            </p>
          </div>
        ) : (
          schedules.map((schedule) => {
            const latestExecution = schedule.executions[0];
            return (
              <article
                key={schedule.id}
                className={`panel p-5 transition ${schedule.enabled ? "" : "opacity-70"}`}
              >
                <div className="flex items-start gap-4">
                  <span
                    className={`grid size-11 shrink-0 place-items-center rounded-2xl ${schedule.desiredRelayState ? "bg-[#eaf7ed] text-[#1e8e3e]" : "bg-[#eef1ee] text-[#667169]"}`}
                  >
                    {schedule.desiredRelayState ? (
                      <PlayCircle size={21} />
                    ) : (
                      <PauseCircle size={21} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-black">{schedule.name}</h3>
                      <span
                        className={`rounded-full px-2 py-1 text-[.65rem] font-bold ${schedule.enabled ? "bg-green-50 text-green-800" : "bg-slate-100 text-slate-600"}`}
                      >
                        {schedule.enabled ? t("enabled") : t("disabled")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#748078]">
                      {schedule.device.name}
                      {schedule.device.room ? (
                        <>
                          <MapPin className="mx-1 inline" size={12} />
                          {schedule.device.room.name}
                        </>
                      ) : null}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={pending && updatingId === schedule.id}
                    onClick={() => toggle(schedule)}
                    aria-label={schedule.enabled ? t("disable") : t("enable")}
                    aria-pressed={schedule.enabled}
                    className={`grid size-11 shrink-0 place-items-center rounded-full ${schedule.enabled ? "bg-[#eaf7ed] text-[#1d9140]" : "bg-[#eef1ee] text-[#727d74]"}`}
                  >
                    {pending && updatingId === schedule.id ? (
                      <LoaderCircle className="animate-spin" size={20} />
                    ) : schedule.enabled ? (
                      <ToggleRight size={27} />
                    ) : (
                      <ToggleLeft size={27} />
                    )}
                  </button>
                </div>
                <div className="mt-4 grid gap-3 rounded-2xl bg-[#f5f8f5] p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[.68rem] font-bold uppercase tracking-wider text-[#7a857c]">
                      {t("timing")}
                    </p>
                    <p className="mt-1 text-sm font-bold">
                      {schedule.kind === "ONCE"
                        ? t("onceAt", {
                            value: schedule.executeAt
                              ? dateTime.format(new Date(schedule.executeAt))
                              : "—",
                          })
                        : `${clockValue(schedule.localTime)} · ${schedule.weekdays.map((day) => t(`weekday${day}`)).join(" ")}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-[.68rem] font-bold uppercase tracking-wider text-[#7a857c]">
                      {t("nextRun")}
                    </p>
                    <p className="mt-1 text-sm font-bold">
                      {schedule.nextRunAt
                        ? dateTime.format(new Date(schedule.nextRunAt))
                        : t("notScheduled")}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span
                    className={`font-bold ${schedule.desiredRelayState ? "text-[#168039]" : "text-[#69746b]"}`}
                  >
                    {schedule.desiredRelayState
                      ? t("willTurnOn")
                      : t("willTurnOff")}
                  </span>
                  <span className="flex items-center gap-1 text-[#7a857c]">
                    <History size={13} />
                    {latestExecution
                      ? t("lastExecution", {
                          status: t(`status${latestExecution.status}`),
                        })
                      : t("noExecutions")}
                  </span>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
