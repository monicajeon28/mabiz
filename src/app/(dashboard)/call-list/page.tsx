import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CallListView } from "./CallListView";

export const dynamic = "force-dynamic";

export default async function CallListPage() {
  const session = await getSession();
  if (!session?.organizationId) {
    redirect("/login");
  }

  return (
    <div>
      <CallListView />
    </div>
  );
}
