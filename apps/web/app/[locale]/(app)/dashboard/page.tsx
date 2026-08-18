import { ConnectedDashboard } from "../../../../components/connected-dashboard";
import { demoMode } from "../../../../lib/supabase/config";

export default function DashboardPage() {
  return <ConnectedDashboard demo={demoMode()} />;
}
