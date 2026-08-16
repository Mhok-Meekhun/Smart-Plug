import { BarChart3, CalendarClock, House, PlugZap, Settings2, Zap } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "../i18n/navigation";
import { LanguageSwitcher } from "./language-switcher";

const items = [
  { href: "/dashboard", key: "dashboard", icon: House },
  { href: "/devices", key: "devices", icon: PlugZap },
  { href: "/energy", key: "energy", icon: BarChart3 },
  { href: "/schedules", key: "schedules", icon: CalendarClock },
  { href: "/settings/profile", key: "settings", icon: Settings2 }
] as const;

export async function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const nav = await getTranslations("Nav");
  const common = await getTranslations("Common");

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="hidden border-r border-[#dfe7e0] bg-white/90 px-5 py-7 backdrop-blur lg:flex lg:flex-col">
        <Link href="/dashboard" className="flex items-center gap-3 px-2 text-lg font-black tracking-tight">
          <span className="grid size-10 place-items-center rounded-2xl bg-[#1f9d43] text-white shadow-lg shadow-green-900/15"><Zap size={21} fill="currentColor" /></span>
          {common("appName")}
        </Link>
        <nav className="mt-12 space-y-2" aria-label="Main navigation">
          {items.map(({ href, key, icon: Icon }, index) => (
            <Link key={href} href={href} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${index === 0 ? "bg-[#e9f7ec] text-[#147331]" : "text-[#657067] hover:bg-[#f2f6f2] hover:text-[#243229]"}`}>
              <Icon size={19} aria-hidden="true" />{nav(key)}
            </Link>
          ))}
        </nav>
        <div className="mt-auto"><LanguageSwitcher /></div>
      </aside>
      <div className="min-w-0 pb-24 lg:pb-0">
        <header className="flex h-20 items-center justify-between border-b border-[#e0e7e1] bg-white/70 px-5 backdrop-blur md:px-8 lg:px-10">
          <div className="flex items-center gap-3 lg:hidden">
            <span className="grid size-9 place-items-center rounded-xl bg-[#1f9d43] text-white"><Zap size={19} fill="currentColor" /></span>
            <span className="font-black">{common("appName")}</span>
          </div>
          <div className="hidden text-sm text-[#6c776e] lg:block">Asia/Bangkok · THB</div>
          <LanguageSwitcher />
        </header>
        {children}
      </div>
      <nav className="fixed inset-x-3 bottom-3 z-40 flex justify-around rounded-[1.4rem] border border-[#dbe5dc] bg-white/95 px-2 py-2 shadow-[0_18px_60px_rgba(21,50,29,.18)] backdrop-blur lg:hidden" aria-label="Mobile navigation">
        {items.map(({ href, key, icon: Icon }, index) => (
          <Link key={href} href={href} className={`flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[.68rem] font-semibold ${index === 0 ? "text-[#18823a]" : "text-[#748078]"}`}>
            <Icon size={20} aria-hidden="true" />{nav(key)}
          </Link>
        ))}
      </nav>
    </div>
  );
}
