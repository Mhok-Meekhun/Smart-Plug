"use client";

import { Languages } from "lucide-react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "../i18n/navigation";

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <button
      type="button"
      aria-label={locale === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}
      onClick={() => router.replace(pathname, { locale: locale === "th" ? "en" : "th" })}
      className="inline-flex h-10 items-center gap-2 rounded-full border border-[#dce6dd] bg-white px-3 text-sm font-semibold text-[#3f4d42] shadow-sm hover:border-[#a9cfb0]"
    >
      <Languages size={17} aria-hidden="true" />
      {locale === "th" ? "EN" : "ไทย"}
    </button>
  );
}
