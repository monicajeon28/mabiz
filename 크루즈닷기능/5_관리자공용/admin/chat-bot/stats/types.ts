export interface SessionSummary {
  totalSessions: number;
  completedSessions: number;
  abandonedSessions: number;
  ongoingSessions: number;
  conversionRate: number; // percentage 0-100
  avgDurationMs: number | null;
}

export interface QuestionStat {
  questionId: number;
  questionOrder: number | null;
  questionText: string;
  totalResponses: number;
  abandonedResponses: number;
  dropOffRate: number; // percentage 0-100
  avgResponseTime: number | null; // milliseconds
}

export interface OptionStat {
  questionId: number;
  optionLabel: string | null;
  count: number;
  percentage: number; // percentage 0-100
}

export interface HourlySessionStat {
  hour: number; // 0-23
  total: number;
  completed: number;
  abandoned: number;
  ongoing: number;
}

export interface SessionPathStep {
  questionId: number;
  questionOrder: number | null;
  questionText: string;
}

export interface SessionPathStat {
  path: SessionPathStep[];
  sessions: number;
  completedSessions: number;
  conversionRate: number; // percentage 0-100
}

export interface PaymentStats {
  attemptedSessions: number;
  successSessions: number;
  failedSessions: number;
  successRate: number; // percentage 0-100
}

export interface ChatBotStats {
  sessionSummary: SessionSummary;
  questionStats: QuestionStat[];
  optionStats: OptionStat[];
  hourlyStats: HourlySessionStat[];
  topSessionPaths: SessionPathStat[];
  paymentStats: PaymentStats;
}

