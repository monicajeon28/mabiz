import { redirect } from 'next/navigation';

export default function ScheduledEmailRedirect() {
  redirect('/sms-logs?tab=scheduled');
}
