/**
 * Multi-Channel Messaging Types
 */

export type MessageChannel = "SMS" | "KAKAO" | "EMAIL";
export type CampaignStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "ACTIVE"
  | "COMPLETED"
  | "PAUSED"
  | "FAILED";
export type RecipientStatus =
  | "PENDING"
  | "SENT"
  | "DELIVERED"
  | "FAILED"
  | "OPENED"
  | "CLICKED";

export interface MultiChannelCampaign {
  id: string;
  organizationId: string;
  name: string;
  channels: MessageChannel[];
  message: string;
  subject?: string | null;
  status: CampaignStatus;
  totalRecipients: number;
  totalSent?: number | null;
  totalFailed?: number | null;
  lensType?: string | null;
  segmentId?: string | null;
  scheduleAt?: Date | null;
  sentAt?: Date | null;
  createdAt: Date;
  updatedAt?: Date | null;
}

export interface CampaignChannelMessage {
  id: string;
  campaignId: string;
  channel: MessageChannel;
  originalMessage: string;
  convertedMessage: string;
  charCount: number;
  limitExceeded: boolean;
  createdAt?: Date;
}

export interface CampaignRecipient {
  id: string;
  campaignId: string;
  contactId: string;
  channel: MessageChannel;
  status: RecipientStatus;
  phone?: string | null;
  email?: string | null;
  scheduledAt?: Date | null;
  sentAt?: Date | null;
  openedAt?: Date | null;
  clickedAt?: Date | null;
  convertedAt?: Date | null;
  failureReason?: string | null;
  createdAt: Date;
}

export interface ChannelMetric {
  id: string;
  campaignId: string;
  channel: MessageChannel;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
  failed: number;
  cost: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
  roi: number;
  createdAt: Date;
}

export interface CampaignABTest {
  id: string;
  campaignId: string;
  channels: MessageChannel[];
  variants: Array<{
    name: string;
    message: string;
    allocation: number;
  }>;
  status: "ACTIVE" | "COMPLETED" | "PAUSED";
  winner?: string | null;
  createdAt: Date;
}

export interface ChannelRecommendation {
  channel: MessageChannel;
  score: number;
  reason: string;
  expectedOpenRate: number;
  expectedClickRate: number;
  expectedConversionRate: number;
  costPerRecipient: number;
  roi: number;
  priority: "PRIMARY" | "SECONDARY" | "TERTIARY";
}

export interface ChannelPerformance {
  channel: MessageChannel;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
  failed: number;
  cost: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
  roi: number;
  trend: "UP" | "DOWN" | "STABLE";
}

export interface MessageConversionResult {
  message: string;
  suggestions?: string[];
}

export interface ConvertMessageParams {
  message: string;
  channel: MessageChannel;
  suggestions?: boolean;
}

export interface CreateCampaignRequest {
  name: string;
  channels: MessageChannel[];
  message: string;
  subject?: string;
  recipients: Array<{
    contactId: string;
    phone?: string;
    email?: string;
  }>;
  scheduleAt?: Date | null;
  templateIds?: string[];
  lensType?: string;
  segmentId?: string;
}

export interface ExecuteCampaignRequest {
  campaignId: string;
  sendNow?: boolean;
  scheduleAt?: Date;
}

export interface CampaignMetricsResponse {
  campaign: MultiChannelCampaign;
  metrics: Array<{
    channel: MessageChannel;
    sent: number;
    opened: number;
    clicked: number;
    converted: number;
    failed: number;
    cost: number;
  }>;
  crossChannelAttribution: {
    firstTouch: Record<MessageChannel, number>;
    lastTouch: Record<MessageChannel, number>;
    assisted: Record<MessageChannel, number>;
  };
  recommendations: string[];
}

export interface ChannelRecommendationRequest {
  segmentId?: string;
  contactId?: string;
  messageType?: "PROMOTIONAL" | "TRANSACTIONAL" | "INFORMATIONAL";
  urgency?: "HIGH" | "MEDIUM" | "LOW";
  frequency?: "DAILY" | "WEEKLY" | "MONTHLY";
}

export interface ChannelMixRecommendation {
  day: string;
  allocation: Record<MessageChannel, number>;
  reasoning: string;
}

export interface ChannelPerformanceMetrics {
  channels: Record<MessageChannel, ChannelPerformance>;
  bestPerformer: MessageChannel;
  recommendations: string[];
}
