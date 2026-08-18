"use client";

import { Languages } from "lucide-react";
import { useLocale } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "../i18n/navigation";
import { apiRequest } from "../lib/api-client";

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchLanguage() {
    const nextLocale = locale === "th" ? "en" : "th";
    startTransition(async () => {
      try {
        await apiRequest("/v1/me", {
          method: "PATCH",
          body: JSON.stringify({ locale: nextLocale })
        });
      } catch {
        // The switcher also appears before sign-in, where no profile can be updated.
      }
      document.cookie = `NEXT_LOCALE=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
      router.replace(pathname, { locale: nextLocale });
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      aria-label={locale === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}
      onClick={switchLanguage}
      className="inline-flex h-10 items-center gap-2 rounded-full border border-[#dce6dd] bg-white px-3 text-sm font-semibold text-[#3f4d42] shadow-sm hover:border-[#a9cfb0] disabled:opacity-60"
    >
      <Languages size={17} aria-hidden="true" />
      {locale === "th" ? "EN" : "ไทย"}
    </button>
  );
}
