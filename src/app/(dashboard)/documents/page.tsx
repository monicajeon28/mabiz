import { headers } from "next/headers";
import DocumentsClient from "./documents-client";

export default async function DocumentsPage() {
  const headersList = await headers();
  const xUserRole = headersList.get("X-User-Role");

  return <DocumentsClient initialRole={xUserRole || "AGENT"} />;
