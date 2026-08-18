"use client";

import { Check, Languages, LoaderCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { usePathname, useRouter } from "../i18n/navigation";
import { apiRequest } from "../lib/api-client";

type AppLocale = "th" | "en";

export function LanguageSettings() {
  const currentLocale = useLocale() as AppLocale;
  const t = useTranslations("Language");
  const pathname = usePathname();
  const router = useRouter();
  const [selected, setSelected] = useState<AppLocale>(currentLocale);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function save() {
    setError(undefined);
    startTransition(async () => {
      try {
        await apiRequest("/v1/me", {
          method: "PATCH",
          body: JSON.stringify({ locale: selected })
        });
        document.cookie = `NEXT_LOCALE=${selected}; Path=/; Max-Age=31536000; SameSite=Lax`;
        router.replace(pathname, { locale: selected });
        router.refresh();
      } catch {
        setError(t("saveFailed"));
      }
    });
  }

  return (
    <section className="panel p-6 md:p-8">
      <div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#eaf7ed] text-[#228d40]"><Languages size={23}/></span><div><h2 className="text-xl font-black">{t("choose")}</h2><p className="mt-1 text-sm leading-6 text-[#68736a]">{t("help")}</p></div></div>
      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        {(["th", "en"] as const).map((locale) => {
          const active = selected === locale;
          return <button key={locale} type="button" onClick={() => setSelected(locale)} aria-pressed={active} className={`flex min-h-28 items-center justify-between rounded-3xl border p-5 text-left transition ${active ? "border-[#249c45] bg-[#eff9f1] shadow-sm" : "border-[#dce5dd] bg-white hover:border-[#a7cab0]"}`}><span><span className="block text-lg font-black">{t(`${locale}Name`)}</span><span className="mt-1 block text-sm text-[#68736a]">{t(`${locale}Example`)}</span></span>{active ? <span className="grid size-8 place-items-center rounded-full bg-[#249c45] text-white"><Check size={18}/></span> : null}</button>;
        })}
      </div>
      {error ? <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
      <button type="button" onClick={save} disabled={pending} className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#209842] font-bold text-white disabled:opacity-50">{pending ? <LoaderCircle className="animate-spin" size={18}/> : null}{t("save")}</button>
    </section>
  );
}
