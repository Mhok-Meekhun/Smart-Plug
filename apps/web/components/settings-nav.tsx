"use client";

import { CircleDollarSign, Languages, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "../i18n/navigation";

const items = [
  { href: "/settings/profile", key: "profile", icon: UserRound },
  { href: "/settings/language", key: "language", icon: Languages },
  { href: "/settings/electricity", key: "electricity", icon: CircleDollarSign }
] as const;

export function SettingsNav() {
  const pathname = usePathname();
  const t = useTranslations("SettingsNav");

  return (
    <nav aria-label={t("label")} className="mb-7 flex gap-2 overflow-x-auto pb-1">
      {items.map(({ href, key, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-2xl border px-4 text-sm font-bold transition ${active ? "border-[#249c45] bg-[#eaf7ed] text-[#177534]" : "border-[#dce5dd] bg-white text-[#667269] hover:border-[#a8cdb0]"}`}
          >
            <Icon size={17} aria-hidden="true" />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
