import { redirect } from 'next/navigation';

// /campaigns → /marketing/campaigns 로 리다이렉트
export default function CampaignsRedirectPage() {
  redirect('/marketing/campaigns');
}
