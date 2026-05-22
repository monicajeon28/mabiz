export interface CallForm {
  content: string;
  result: "INTERESTED" | "PENDING" | "REJECTED" | "RESCHEDULED";
  convictionScore: string; // "1" ~ "10"
  nextAction: string;
  scheduledAt: string; // ISO date
  objectionId: string;
  customerReaction: "positive" | "neutral" | "negative";
  recovered: boolean;
  recoveryTime: string;
}
