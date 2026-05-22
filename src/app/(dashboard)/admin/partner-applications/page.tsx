/**
 * /admin/partner-applications — 크루즈닷 파트너스 신청 관리
 * 접근: GLOBAL_ADMIN만
 */

import { headers } from 'next/headers';
import PartnerApplicationsClient from './partner-applications-client';

export default async function PartnerApplicationsPage() {
  const headersList = await headers();
  const xUserRole = headersList.get('X-User-Role');

  return <PartnerApplicationsClient initialRole={xUserRole || 'AGENT'} />;
}
