import { LucideIcon } from 'lucide-react';

export enum FunnelStageId {
  AWARENESS = 'awareness',
  LEAD = 'lead',
  NURTURE = 'nurture',
  CONVERSION = 'conversion',
  RETENTION = 'retention',
}

export interface FunnelItem {
  id: FunnelStageId;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  widthPercentage: string; // Tailwind width class or percentage
  gradient: string;
}