"use client";

import { ArrowRight, LoaderCircle, LockKeyhole, Mail, Zap } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { Link, useRouter } from "../i18n/navigation";
import {
  authErrorMessageKey,
  buildAuthCallbackUrl,
  parseRecoverySessionFragment,
} from "../lib/auth";
import {
  createClient,
  createRecoveryRequestClient,
} from "../lib/supabase/client";
import { LanguageSwitcher } from "./language-switcher";

export function PasswordRecoveryForm({
  mode,
}: {
  mode: "request" | "update";
}) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [recoveryReady, setRecoveryReady] = useState(mode === "request");
  const [checkingRecovery, setCheckingRecovery] = useState(mode === "update");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (mode !== "update") return;

    let active = true;
    const supabase = createClient();

    async function prepareRecoverySession() {
      try {
        const fragment = parseRecoverySessionFragment(window.location.hash);
        if (fragment && "error" in fragment) {
          throw { code: "session_not_found" };
        }

        if (fragment) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: fragment.accessToken,
            refresh_token: fragment.refreshToken,
          });
          if (sessionError) throw sessionError;

          window.history.replaceState(
            window.history.state,
            "",
            `${window.location.pathname}${window.location.search}`,
          );
        }

        const { data, error: userError } = await supabase.auth.getUser();
        if (userError || !data.user) {
          throw userError ?? { code: "session_not_found" };
        }

        if (active) setRecoveryReady(true);
      } catch {
        if (active) setError(t("recoveryExpired"));
      } finally {
        if (active) setCheckingRecovery(false);
      }
    }

    void prepareRecoverySession();
    return () => {
      active = false;
    };
  }, [mode, t]);

  function submit(formData: FormData) {
    setError(undefined);
    setNotice(undefined);
    startTransition(async () => {
      try {
        if (mode === "request") {
          const supabase = createRecoveryRequestClient();
          const email = String(formData.get("email") ?? "");
          const { error: authError } =
            await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: buildAuthCallbackUrl(
                window.location.origin,
                locale,
                "recovery",
              ),
            });
          if (authError) throw authError;
          setNotice(t("recoverySent"));
          return;
        }

        if (!recoveryReady) {
          setError(t("recoveryExpired"));
          return;
        }

        const supabase = createClient();
        const password = String(formData.get("password") ?? "");
        const confirmation = String(formData.get("passwordConfirmation") ?? "");
        if (password !== confirmation) {
          setError(t("passwordMismatch"));
          return;
        }
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw authError;
        router.replace("/dashboard");
        router.refresh();
      } catch (caught) {
        setError(t(authErrorMessageKey(caught)));
      }
    });
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden bg-[#123d25] p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -left-24 top-36 size-96 rounded-full border-[70px] border-white/5" />
        <div className="relative flex items-center gap-3 text-xl font-black">
          <span className="grid size-11 place-items-center rounded-2xl bg-[#29a84b]">
            <Zap size={22} fill="currentColor" />
          </span>
          {locale === "th" ? "บ้านประหยัด" : "Baan Prayat"}
        </div>
        <div className="relative my-auto max-w-xl">
          <p className="text-xs font-bold tracking-[.2em] text-[#8be0a2]">
            ACCOUNT RECOVERY
          </p>
          <h1 className="mt-5 text-5xl font-black leading-[1.08] tracking-[-.05em]">
            {t("recoveryHero")}
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-white/65">
            {t("recoveryHeroBody")}
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-10 md:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-between lg:justify-end">
            <div className="flex items-center gap-2 font-black lg:hidden">
              <span className="grid size-9 place-items-center rounded-xl bg-[#249c45] text-white">
                <Zap size={18} fill="currentColor" />
              </span>
              {locale === "th" ? "บ้านประหยัด" : "Baan Prayat"}
            </div>
            <LanguageSwitcher />
          </div>
          <p className="text-xs font-bold tracking-[.16em] text-[#218f41]">
            {mode === "request" ? "RECOVER ACCOUNT" : "SET NEW PASSWORD"}
          </p>
          <h2 className="mt-3 text-4xl font-black tracking-[-.04em]">
            {t(mode === "request" ? "forgotPasswordTitle" : "resetPasswordTitle")}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#69746c]">
            {t(mode === "request" ? "forgotPasswordBody" : "resetPasswordBody")}
          </p>

          {checkingRecovery ? (
            <p
              role="status"
              className="mt-8 flex items-center gap-3 rounded-xl bg-green-50 p-4 text-sm text-green-800"
            >
              <LoaderCircle className="animate-spin" size={19} />
              {t("checkingRecovery")}
            </p>
          ) : null}

          {!checkingRecovery && mode === "update" && !recoveryReady ? (
            <div className="mt-8 space-y-4">
              {error ? (
                <p
                  role="alert"
                  className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </p>
              ) : null}
              <Link
                className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#209842] font-bold text-white shadow-lg shadow-green-900/15 transition hover:bg-[#167b34]"
                href="/auth/forgot-password"
              >
                {t("requestNewRecovery")}
                <ArrowRight size={18} />
              </Link>
            </div>
          ) : null}

          {!checkingRecovery && (mode === "request" || recoveryReady) ? (
            <form action={submit} className="mt-8 space-y-4">
              {mode === "request" ? (
                <label className="block">
                  <span className="mb-2 block text-sm font-bold">
                    {t("email")}
                  </span>
                  <span className="flex items-center gap-3 rounded-2xl border border-[#dce5dd] bg-white px-4">
                    <Mail size={18} className="text-[#7a857d]" />
                    <input
                      required
                      type="email"
                      name="email"
                      autoComplete="email"
                      className="h-13 min-w-0 flex-1 outline-none"
                    />
                  </span>
                </label>
              ) : (
                <>
                  <PasswordField label={t("newPassword")} name="password" />
                  <PasswordField
                    label={t("confirmPassword")}
                    name="passwordConfirmation"
                  />
                </>
              )}

              {error ? (
                <p
                  role="alert"
                  className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </p>
              ) : null}
              {notice ? (
                <p
                  role="status"
                  className="rounded-xl bg-green-50 p-3 text-sm text-green-800"
                >
                  {notice}
                </p>
              ) : null}

              <button
                disabled={pending}
                className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#209842] font-bold text-white shadow-lg shadow-green-900/15 transition hover:bg-[#167b34] disabled:opacity-60"
              >
                {pending ? (
                  <LoaderCircle className="animate-spin" size={19} />
                ) : null}
                {t(mode === "request" ? "sendRecovery" : "savePassword")}
                <ArrowRight size={18} />
              </button>
            </form>
          ) : null}

          <p className="mt-6 text-center text-sm text-[#69746c]">
            <Link className="font-bold text-[#1c8b3d] underline-offset-4 hover:underline" href="/auth/login">
              {t("backToLogin")}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

function PasswordField({ label, name }: { label: string; name: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <span className="flex items-center gap-3 rounded-2xl border border-[#dce5dd] bg-white px-4">
        <LockKeyhole size={18} className="text-[#7a857d]" />
        <input required minLength={8} type="password" name={name} autoComplete="new-password" className="h-13 min-w-0 flex-1 outline-none" />
      </span>
    </label>
  );
}
