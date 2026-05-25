import { getMabizSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Menu48AnxietyDashboard } from '@/components/menu-48-anxiety-dashboard';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Menu #48: L2 렌즈 - 준비 불안도 관리',
  description: '크루즈 고객의 비자, 여권, 건강 준비 불안감을 해소하는 SPIN 기반 자동화 시스템',
};

export default async function Menu48Page() {
  const session = await getMabizSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <main className="container mx-auto py-10">
      <Menu48AnxietyDashboard />
    </main>
  );
}
