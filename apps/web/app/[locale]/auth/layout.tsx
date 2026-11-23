import { ArrowRight } from "lucide-react";
import { getLocale } from "next-intl/server";
import { LanguageSwitcher } from "../../../components/language-switcher";
import { Link } from "../../../i18n/navigation";
import { demoMode } from "../../../lib/supabase/config";

export default async function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!demoMode()) return children;
  const thai = (await getLocale()) === "th";

  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <section className="panel w-full max-w-lg p-6 sm:p-9">
        <div className="flex items-center justify-between gap-3">
          <span className="ruan-logo" role="img" aria-label="RUAN AI Smart Home" />
          <LanguageSwitcher />
        </div>
        <h1 className="mt-7 text-3xl font-black">{thai ? "ทดลองใช้ RUAN AI" : "Explore RUAN AI"}</h1>
        <p className="mt-3 leading-7 text-[#5d6b71]">
          {thai ? "ดูภาพรวมบ้าน ทดลองควบคุมอุปกรณ์ และตรวจค่าไฟประมาณการด้วยข้อมูลจำลอง โดยไม่ต้องสมัครบัญชี" : "Explore home energy, device controls and estimated costs with simulated data. No account is needed."}
        </p>
        <Link href="/dashboard" className="ruan-action mt-7">
          {thai ? "เปิดแดชบอร์ดเดโม" : "Open demo dashboard"}
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
