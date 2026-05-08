import { Users, FileText, HeartHandshake, Gift, RefreshCw } from 'lucide-react';
import { FunnelItem, FunnelStageId } from './types';

export const FUNNEL_DATA: FunnelItem[] = [
  {
    id: FunnelStageId.AWARENESS,
    title: "유입 (Inflow)",
    description: "모르는 사람들에게 크루즈닷을 알리기",
    icon: Users,
    color: "bg-blue-400",
    gradient: "from-blue-300 to-blue-500",
    widthPercentage: "w-[100%]",
  },
  {
    id: FunnelStageId.LEAD,
    title: "리드 확보 (Lead)",
    description: "AI 크루즈닷 3일 체험권 제공 및 연락처 확보",
    icon: FileText,
    color: "bg-indigo-400",
    gradient: "from-indigo-300 to-indigo-500",
    widthPercentage: "w-[80%]",
  },
  {
    id: FunnelStageId.NURTURE,
    title: "육성/설득 (Nurture)",
    description: "챗봇 크루즈닷AI로 맞춤 정보 제공",
    icon: HeartHandshake,
    color: "bg-violet-400",
    gradient: "from-violet-300 to-violet-500",
    widthPercentage: "w-[60%]",
  },
  {
    id: FunnelStageId.CONVERSION,
    title: "구매 전환 (Conversion)",
    description: "고객으로 만들기",
    icon: Gift,
    color: "bg-fuchsia-400",
    gradient: "from-fuchsia-300 to-fuchsia-500",
    widthPercentage: "w-[40%]",
  },
];

export const RETENTION_DATA: FunnelItem = {
  id: FunnelStageId.RETENTION,
  title: "재구매/추천",
  description: "팬으로 만들기",
  icon: RefreshCw,
  color: "bg-rose-400",
  gradient: "from-rose-300 to-rose-500",
  widthPercentage: "w-full",
};