import { redirect } from 'next/navigation';

// /playbook → /tools/playbook-viewer 로 리다이렉트 (쿼리스트링 포함)
export default async function PlaybookRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') params.set(k, v);
  }
  const qs = params.toString();
  redirect(`/tools/playbook-viewer${qs ? `?${qs}` : ''}`);
}
