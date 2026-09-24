"use client";

import { BarChart3, CalendarClock, House, PlugZap, Settings2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "../i18n/navigation";

const items = [
  { href: "/dashboard", key: "dashboard", icon: House },
  { href: "/devices", key: "devices", icon: PlugZap },
  { href: "/energy", key: "energy", icon: BarChart3 },
  { href: "/schedules", key: "schedules", icon: CalendarClock },
  { href: "/settings/profile", key: "settings", icon: Settings2 },
] as const;

export function AppNavigation({ variant }: { variant: "desktop" | "mobile" }) {
  const pathname = usePathname();
  const t = useTranslations("Nav");

  return (
    <nav
      className={variant === "desktop" ? "workspace-nav" : "mobile-nav lg:hidden"}
      aria-label={variant === "desktop" ? "Main navigation" : "Mobile navigation"}
    >
      {items.map(({ href, key, icon: Icon }) => {
        const active =
          key === "settings"
            ? pathname.startsWith("/settings") || pathname.startsWith("/home")
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`nav-item ${active ? "is-active" : ""}`}
          >
            <Icon size={variant === "mobile" ? 20 : 19} strokeWidth={active ? 2.6 : 1.9} aria-hidden="true" />
            <span>{t(key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
