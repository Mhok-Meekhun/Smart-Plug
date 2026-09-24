import { Plus, Zap } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "../i18n/navigation";
import { AppNavigation } from "./app-navigation";
import { LanguageSwitcher } from "./language-switcher";

export async function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const common = await getTranslations("Common");
  const devices = await getTranslations("Devices");

  return (
    <div className="app-shell min-h-screen lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <aside className="workspace-sidebar hidden lg:flex lg:flex-col">
        <Link href="/dashboard" className="brand-lockup" aria-label={common("appName")}>
          <span className="brand-mark"><Zap size={22} fill="currentColor" aria-hidden="true" /></span>
          <span>
            <strong className="block text-[1.02rem] leading-tight">{common("appName")}</strong>
            <small className="mt-1 block text-[.62rem] font-bold tracking-[.19em] text-[#9db6a4]">SMART ENERGY</small>
          </span>
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
            <span className="brand-mark"><Zap size={19} fill="currentColor" aria-hidden="true" /></span>
            <span className="text-sm font-black">{common("appName")}</span>
          </Link>
          <div className="hidden lg:block">
            <p className="text-[.65rem] font-bold tracking-[.2em] text-[#6a9575]">SMART HOME</p>
            <p className="mt-1 text-sm font-semibold text-[#5d6e64]">Asia/Bangkok · THB</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/devices/add" className="header-add" aria-label={devices("add")}>
              <Plus size={18} aria-hidden="true" />
              <span className="hidden sm:inline">{devices("add")}</span>
            </Link>
            <LanguageSwitcher />
          </div>
        </header>
        <div className="page-enter">{children}</div>
      </div>

      <AppNavigation variant="mobile" />
    </div>
  );
}
