// cruisedot/inquiry-survey/lib/schemas/inquirySchema.ts
// ProductInquiry, ChatBotFlow, ChatBotQuestion Zod 검증 스키마

import { z } from 'zod';

/**
 * 공개 문의 제출 (로그인 불필요)
 * POST /api/public/inquiry
 */
export const publicInquirySchema = z.object({
  productCode: z.string().min(1, '상품코드는 필수입니다.'),
  name: z.string().min(1, '성명은 필수입니다.').max(100, '성명은 100자 이내입니다.'),
  phone: z.string().min(1, '전화번호는 필수입니다.'),
  message: z.string().max(500, '메시지는 500자 이내입니다.').optional().nullable(),
  passportNumber: z.string().optional().nullable(),
  isPhoneConsultation: z.boolean().optional(),
  actualName: z.string().optional(),
  actualPhone: z.string().optional(),
  partnerId: z.string().optional(),
});

export type PublicInquiryInput = z.infer<typeof publicInquirySchema>;

/**
 * 어드민: 문의 상태 변경
 * PATCH /api/admin/inquiries/{id}/status
 */
export const inquiryStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled']),
});

export type InquiryStatusInput = z.infer<typeof inquiryStatusSchema>;

/**
 * 어드민: 구매 확정
 * POST /api/admin/inquiries/{id}/confirm
 */
export const inquiryConfirmSchema = z.object({
  startDate: z.string().datetime('유효한 ISO 날짜 형식이어야 합니다.'),
});

export type InquiryConfirmInput = z.infer<typeof inquiryConfirmSchema>;

/**
 * 어드민: 콜 로그 기록
 * POST /api/admin/inquiries/{id}/call-log
 */
export const inquiryCallLogSchema = z.object({
  result: z.enum(['REACHED', 'NOT_REACHED', 'CALLBACK', 'INVALID', 'DUPLICATE'], {
    errorMap: () => ({ message: '유효한 콜 결과를 선택해주세요.' }),
  }),
  memo: z.string().max(500, '메모는 500자 이내입니다.').optional(),
  nextContactAt: z.string().datetime().optional(),
});

export type InquiryCallLogInput = z.infer<typeof inquiryCallLogSchema>;

/**
 * 여행 피드백 제출
 * POST /api/feedback
 */
export const tripFeedbackSchema = z.object({
  tripId: z.number().int().positive('유효한 여행 ID가 필요합니다.'),
  satisfactionScore: z.number().int().min(1, '만족도는 1점 이상입니다.').max(5, '만족도는 5점 이하입니다.').optional(),
  improvementComments: z.string().max(500, '개선 의견은 500자 이내입니다.').optional(),
  detailedFeedback: z.record(z.unknown()).optional(),
});

export type TripFeedbackInput = z.infer<typeof tripFeedbackSchema>;

/**
 * 챗봇 플로우 생성/수정
 * POST /api/admin/chat-bot/flows
 * PATCH /api/admin/chat-bot/flows/{id}
 */
export const chatBotFlowSchema = z.object({
  name: z.string().min(1, '플로우명은 필수입니다.').max(100),
  category: z.string().default('AI 지니 채팅봇(구매)'),
  description: z.string().max(500).optional(),
  startQuestionId: z.number().int().positive().optional().nullable(),
  finalPageUrl: z.string().url('유효한 URL이어야 합니다.').optional().nullable(),
  productCode: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  order: z.number().int().default(0),
  isPublic: z.boolean().default(false),
  isTemplate: z.boolean().default(false),
});

export type ChatBotFlowInput = z.infer<typeof chatBotFlowSchema>;

/**
 * 챗봇 질문 생성/수정
 * POST /api/admin/chat-bot/questions
 * PATCH /api/admin/chat-bot/questions/{id}
 */
export const chatBotQuestionSchema = z.object({
  flowId: z.number().int().positive('유효한 플로우 ID가 필요합니다.'),
  questionText: z.string().min(1, '질문은 필수입니다.').max(500),
  questionType: z.enum(['choice', 'text', 'multiple']).default('choice'),
  spinType: z.string().optional().nullable(),
  information: z.string().max(500).optional(),
  optionA: z.string().max(100).optional().nullable(),
  optionB: z.string().max(100).optional().nullable(),
  options: z.array(z.string()).optional(),
  nextQuestionIdA: z.number().int().positive().optional().nullable(),
  nextQuestionIdB: z.number().int().positive().optional().nullable(),
  nextQuestionIds: z.record(z.number().int()).optional(),
  order: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export type ChatBotQuestionInput = z.infer<typeof chatBotQuestionSchema>;

/**
 * 챗봇 사용자 응답 제출
 * POST /api/chat-bot/response
 */
export const chatBotResponseSchema = z.object({
  sessionId: z.string().min(1, '세션 ID는 필수입니다.'),
  questionId: z.number().int().positive('유효한 질문 ID가 필요합니다.'),
  selectedOption: z.string().max(100).optional(),
  selectedText: z.string().max(500).optional(),
  responseTime: z.number().int().optional(),
  nextQuestionId: z.number().int().positive().optional(),
});

export type ChatBotResponseInput = z.infer<typeof chatBotResponseSchema>;

/**
 * 챗봇 세션 시작
 * POST /api/chat-bot/start
 */
export const chatBotSessionSchema = z.object({
  flowId: z.number().int().positive('유효한 플로우 ID가 필요합니다.'),
  productCode: z.string().optional(),
  userPhone: z.string().optional(),
  userEmail: z.string().email('유효한 이메일 형식이어야 합니다.').optional(),
});

export type ChatBotSessionInput = z.infer<typeof chatBotSessionSchema>;

/**
 * RAG 질문 제출
 * POST /api/admin/rag-questions
 */
export const ragQuestionSchema = z.object({
  question: z.string().min(1, '질문은 필수입니다.').max(500),
  videoId: z.string().optional(),
  source: z.string().default('youtube-comment'),
});

export type RagQuestionInput = z.infer<typeof ragQuestionSchema>;

/**
 * 봇 가이드 답변 생성/수정
 * POST /api/admin/bot-guide-answers
 */
export const botGuideAnswerSchema = z.object({
  key: z.string().min(1, '답변 키는 필수입니다.').max(100),
  question: z.string().min(1, '질문은 필수입니다.').max(500),
  answer: z.string().min(1, '답변은 필수입니다.').max(5000),
  source: z.string().default('ai-generated'),
  isActive: z.boolean().default(false),
});

export type BotGuideAnswerInput = z.infer<typeof botGuideAnswerSchema>;
