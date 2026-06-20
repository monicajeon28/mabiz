import { redirect } from 'next/navigation';

export default function ScheduledSmsRedirect() {
  redirect('/sms-logs?tab=scheduled');
}
