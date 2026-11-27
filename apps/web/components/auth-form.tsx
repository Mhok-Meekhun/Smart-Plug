"use client";

import { ArrowRight, LoaderCircle, LockKeyhole, Mail, UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Link, useRouter } from "../i18n/navigation";
import { apiRequest } from "../lib/api-client";
import { authErrorMessageKey, buildAuthCallbackUrl } from "../lib/auth";
import { createClient } from "../lib/supabase/client";
import { LanguageSwitcher } from "./language-switcher";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const t = useTranslations("Auth");
  const common = useTranslations("Common");
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
          const { data, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { display_name: displayName },
              emailRedirectTo: buildAuthCallbackUrl(
                window.location.origin,
                locale,
                "confirmation",
              ),
            },
          });
          if (authError) throw authError;
          if (data.session) {
            await apiRequest("/v1/me", {
              method: "PATCH",
              body: JSON.stringify({ locale })
            }).catch(() => undefined);
            router.replace("/dashboard"); router.refresh();
          } else setNotice(t("checkEmail"));
        }
      } catch (caught) {
        setError(t(authErrorMessageKey(caught)));
      }
    });
  }

  return (
    <main className="auth-layout grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_.95fr]">
      <section className="auth-hero relative hidden overflow-hidden px-[clamp(2.5rem,5vw,6rem)] py-12 text-white lg:flex lg:flex-col">
        <span className="ruan-logo relative shrink-0" role="img" aria-label={common("appName")} />
        <div className="auth-hero-copy relative z-10 my-auto max-w-xl py-12">
          <p className="auth-hero-title text-balance">{t("brandTitle")}</p>
          <p className="mt-5 max-w-sm text-pretty text-base leading-relaxed text-[#d9ebf2] xl:text-lg">{t("brandDescription")}</p>
        </div>
      </section>
      <section className="auth-content flex items-center justify-center px-4 py-6 sm:px-8 sm:py-10 lg:px-10">
        <div className="w-full max-w-lg">
          <div className="auth-topbar mb-5 flex items-center justify-between gap-3 lg:justify-end">
            <div className="lg:hidden">
              <span className="ruan-logo ruan-logo-mobile" role="img" aria-label={common("appName")} />
            </div>
            <LanguageSwitcher />
          </div>
          <div className="auth-card p-6 sm:p-9">
            <h1 className="auth-heading text-3xl font-black sm:text-4xl">{t(mode)}</h1>
            <p className="mt-2.5 text-sm leading-relaxed text-[#4d6875]">{t(mode === "login" ? "loginHelp" : "registerHelp")}</p>
            <form action={submit} className="mt-7 space-y-4">
              {mode === "register" ? (
                <label className="block">
                  <span className="auth-label">{t("name")}</span>
                  <span className="auth-field">
                    <UserRound size={18} aria-hidden="true" />
                    <input required name="displayName" autoComplete="name" />
                  </span>
                </label>
              ) : null}
              <label className="block">
                <span className="auth-label">{t("email")}</span>
                <span className="auth-field">
                  <Mail size={18} aria-hidden="true" />
                  <input required type="email" name="email" autoComplete="email" />
                </span>
              </label>
              <label className="block">
                <span className="auth-label">{t("password")}</span>
                <span className="auth-field">
                  <LockKeyhole size={18} aria-hidden="true" />
                  <input required minLength={8} type="password" name="password" autoComplete={mode === "login" ? "current-password" : "new-password"} />
                </span>
              </label>
              {mode === "login" ? (
                <div className="text-right">
                  <Link className="auth-link text-sm" href="/auth/forgot-password">
                    {t("forgotPassword")}
                  </Link>
                </div>
              ) : null}
              {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
              {notice ? <p role="status" className="rounded-xl bg-[#e2f0f5] p-3 text-sm text-[#245b70]">{notice}</p> : null}
              <button disabled={pending} className="auth-submit">
                {t(mode === "login" ? "submitLogin" : "submitRegister")}
                <span className="auth-submit-icon" aria-hidden="true">
                  {pending ? <LoaderCircle className="animate-spin" size={17} /> : <ArrowRight size={17} />}
                </span>
              </button>
            </form>
            <p className="mt-6 border-t border-[#d7e5eb] pt-5 text-center text-sm leading-relaxed text-[#4d6875]">
              {t(mode === "login" ? "noAccount" : "hasAccount")}{" "}
              <Link className="auth-link" href={mode === "login" ? "/auth/register" : "/auth/login"}>{t(mode === "login" ? "register" : "login")}</Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
