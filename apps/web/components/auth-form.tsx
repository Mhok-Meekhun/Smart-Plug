"use client";

import { ArrowRight, LoaderCircle, LockKeyhole, Mail, UserRound, Zap } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Link, useRouter } from "../i18n/navigation";
import { apiRequest } from "../lib/api-client";
import { createClient } from "../lib/supabase/client";
import { LanguageSwitcher } from "./language-switcher";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(undefined); setNotice(undefined);
    startTransition(async () => {
      try {
        const email = String(formData.get("email") ?? "");
        const password = String(formData.get("password") ?? "");
        const supabase = createClient();
        if (mode === "login") {
          const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
          if (authError) throw authError;
          await apiRequest("/v1/me", {
            method: "PATCH",
            body: JSON.stringify({ locale })
          }).catch(() => undefined);
          router.replace("/dashboard"); router.refresh();
        } else {
          const displayName = String(formData.get("displayName") ?? "");
          const { data, error: authError } = await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName }, emailRedirectTo: `${window.location.origin}/${locale}/dashboard` } });
          if (authError) throw authError;
          if (data.session) {
            await apiRequest("/v1/me", {
              method: "PATCH",
              body: JSON.stringify({ locale })
            }).catch(() => undefined);
            router.replace("/dashboard"); router.refresh();
          } else setNotice(t("checkEmail"));
        }
      } catch { setError(t("error")); }
    });
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden bg-[#123d25] p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -left-24 top-36 size-96 rounded-full border-[70px] border-white/5" />
        <div className="relative flex items-center gap-3 text-xl font-black"><span className="grid size-11 place-items-center rounded-2xl bg-[#29a84b]"><Zap size={22} fill="currentColor"/></span>{locale === "th" ? "บ้านประหยัด" : "Baan Prayat"}</div>
        <div className="relative my-auto max-w-xl"><p className="text-xs font-bold tracking-[.2em] text-[#8be0a2]">SMART ENERGY, CLEARLY</p><h1 className="mt-5 text-5xl font-black leading-[1.08] tracking-[-.05em]">{locale === "th" ? "จัดการพลังงานในบ้าน อย่างมั่นใจทุกเวลา" : "Home energy control you can trust."}</h1><p className="mt-6 max-w-lg text-lg leading-8 text-white/65">{locale === "th" ? "ดูการใช้ไฟฟ้าแบบสด ควบคุมอุปกรณ์ และลดค่าใช้จ่ายจากทุกหน้าจอ" : "Monitor live electricity use, control appliances, and reduce costs from any screen."}</p></div>
      </section>
      <section className="flex items-center justify-center px-5 py-10 md:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-between lg:justify-end"><div className="flex items-center gap-2 font-black lg:hidden"><span className="grid size-9 place-items-center rounded-xl bg-[#249c45] text-white"><Zap size={18} fill="currentColor"/></span>{locale === "th" ? "บ้านประหยัด" : "Baan Prayat"}</div><LanguageSwitcher /></div>
          <p className="text-xs font-bold tracking-[.16em] text-[#218f41]">{mode === "login" ? "WELCOME BACK" : "GET STARTED"}</p>
          <h2 className="mt-3 text-4xl font-black tracking-[-.04em]">{t(mode)}</h2>
          <form action={submit} className="mt-8 space-y-4">
            {mode === "register" ? <label className="block"><span className="mb-2 block text-sm font-bold">{t("name")}</span><span className="flex items-center gap-3 rounded-2xl border border-[#dce5dd] bg-white px-4"><UserRound size={18} className="text-[#7a857d]"/><input required name="displayName" autoComplete="name" className="h-13 min-w-0 flex-1 outline-none" /></span></label> : null}
            <label className="block"><span className="mb-2 block text-sm font-bold">{t("email")}</span><span className="flex items-center gap-3 rounded-2xl border border-[#dce5dd] bg-white px-4"><Mail size={18} className="text-[#7a857d]"/><input required type="email" name="email" autoComplete="email" className="h-13 min-w-0 flex-1 outline-none" /></span></label>
            <label className="block"><span className="mb-2 block text-sm font-bold">{t("password")}</span><span className="flex items-center gap-3 rounded-2xl border border-[#dce5dd] bg-white px-4"><LockKeyhole size={18} className="text-[#7a857d]"/><input required minLength={8} type="password" name="password" autoComplete={mode === "login" ? "current-password" : "new-password"} className="h-13 min-w-0 flex-1 outline-none" /></span></label>
            {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
            {notice ? <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{notice}</p> : null}
            <button disabled={pending} className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#209842] font-bold text-white shadow-lg shadow-green-900/15 transition hover:bg-[#167b34] disabled:opacity-60">{pending ? <LoaderCircle className="animate-spin" size={19}/> : null}{t(mode === "login" ? "submitLogin" : "submitRegister")}<ArrowRight size={18}/></button>
          </form>
          <p className="mt-6 text-center text-sm text-[#69746c]">{t(mode === "login" ? "noAccount" : "hasAccount")} <Link className="font-bold text-[#1c8b3d] underline-offset-4 hover:underline" href={mode === "login" ? "/auth/register" : "/auth/login"}>{t(mode === "login" ? "register" : "login")}</Link></p>
        </div>
      </section>
    </main>
  );
}
