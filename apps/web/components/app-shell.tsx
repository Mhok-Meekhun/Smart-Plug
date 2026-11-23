import { Plus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "../i18n/navigation";
import { demoMode } from "../lib/supabase/config";
import { AppNavigation } from "./app-navigation";
import { LanguageSwitcher } from "./language-switcher";

export async function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const common = await getTranslations("Common");
  const devices = await getTranslations("Devices");
  const thai = (await getLocale()) === "th";

  return (
    <div className="app-shell min-h-screen lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <aside className="workspace-sidebar hidden lg:flex lg:flex-col">
        <Link href="/dashboard" className="brand-lockup" aria-label={common("appName")}>
          <span className="ruan-logo" aria-hidden="true" />
        </Link>
        <AppNavigation variant="desktop" />
        <div className="sidebar-foot">
          <span className="sidebar-foot-dot" aria-hidden="true" />
          <span>Asia/Bangkok · THB</span>
        </div>
      </aside>

      <div className="min-w-0 pb-26 lg:pb-0">
        <header className="workspace-header">
          <Link href="/dashboard" className="brand-lockup lg:hidden" aria-label={common("appName")}>
            <span className="ruan-logo ruan-logo-mobile" aria-hidden="true" />
          </Link>
          <div className="hidden lg:block">
            <p className="text-sm font-bold text-[#315f72]">RUAN AI Smart Home</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/devices/add" className="header-add" aria-label={devices("add")}>
              <Plus size={18} aria-hidden="true" />
              <span className="hidden sm:inline">{devices("add")}</span>
            </Link>
            <LanguageSwitcher />
          </div>
        </header>
        {demoMode() && <div className="ruan-demo-notice">
          <strong>{thai ? "โหมดเดโม" : "Demo mode"}</strong>
          <span>{thai ? "ข้อมูลจำลอง · การเปลี่ยนแปลงบันทึกในเบราว์เซอร์นี้" : "Simulated data · Changes are saved in this browser"}</span>
        </div>}
        <div className="page-enter">{children}</div>
      </div>

      <AppNavigation variant="mobile" />
    </div>
  );
}
