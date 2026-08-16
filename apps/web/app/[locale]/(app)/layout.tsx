import { AppShell } from "../../../components/app-shell";
import { redirect } from "../../../i18n/navigation";
import { createClient } from "../../../lib/supabase/server";
import { demoMode, hasSupabaseConfig } from "../../../lib/supabase/config";

export default async function ApplicationLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{locale:string}> }>) {
  const {locale}=await params;
  if (!demoMode()) {
    if (!hasSupabaseConfig()) {
      redirect({href:"/auth/login",locale});
    } else {
      const {data}=await (await createClient()).auth.getClaims();
      if (!data?.claims) redirect({href:"/auth/login",locale});
    }
  }
  return <AppShell>{children}</AppShell>;
}
