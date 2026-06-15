import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { RiskAlertView } from "./RiskAlertView";

export default async function RiskAlertsPage() {
  const session = await getSession();
  if (!session?.organizationId) {
    redirect("/login");
  }

  return (
    <div>
      <RiskAlertView />
    </div>
  );
}
