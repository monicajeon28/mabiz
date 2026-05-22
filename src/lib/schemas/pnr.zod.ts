import { z } from 'zod';

const RESIDENT_NUM_PATTERN = /^\d{6}(-?\d{7})?$/;
const PHONE_PATTERN = /^\d{3}[-]?\d{3,4}[-]?\d{4}$/;

export const TravelerInputSchema = z.object({
  id: z.number().int().positive().optional(),
  korName: z.string()
    .min(1, '이름은 필수입니다.')
    .max(50, '이름은 50자 이내여야 합니다.')
    .transform(v => v.trim()),
  residentNum: z.string()
    .nullable()
    .optional()
    .refine(
      v => !v || RESIDENT_NUM_PATTERN.test(v),
      '주민번호는 올바른 형식이어야 합니다 (예: 000000 또는 000000-0000000)'
    ),
  phone: z.string()
    .nullable()
    .optional()
    .refine(
      v => !v || PHONE_PATTERN.test(v),
      '전화번호는 올바른 형식이어야 합니다 (예: 010-1234-5678)'
    ),
  roomNumber: z.number()
    .int('방 번호는 정수여야 합니다.')
    .min(1, '방 번호는 1 이상이어야 합니다.')
    .max(20, '방 번호는 20 이하여야 합니다.'),
}).strict();

export const TravelerFormDataSchema = TravelerInputSchema.extend({
  roomColor: z.string().optional(),
}).strict();

export const PnrSubmitBodySchema = z.object({
  reservationId: z.number()
    .int('예약 번호는 정수여야 합니다.')
    .positive('예약 번호는 양수여야 합니다.'),
  travelers: z.array(TravelerInputSchema)
    .min(1, '최소 1명의 여행자가 필요합니다.')
    .max(20, '최대 20명의 여행자만 등록 가능합니다.'),
}).strict();

export const PnrCustomerResponseSchema = z.object({
  ok: z.boolean(),
  reservation: z.object({
    id: z.number().int(),
    totalPeople: z.number().int(),
    cabinType: z.string().nullable(),
    trip: z.object({
      id: z.number().int(),
      shipName: z.string().nullable(),
      departureDate: z.string().or(z.date()).nullable(),
      endDate: z.string().or(z.date()).nullable(),
      productCode: z.string().nullable(),
    }).nullable(),
    travelers: z.array(z.object({
      id: z.number().int(),
      korName: z.string(),
      roomNumber: z.number().int(),
    })),
    paymentStatus: z.string().optional(),
  }).optional(),
  message: z.string().optional(),
  error: z.string().optional(),
}).strict();

export type TravelerInput = z.infer<typeof TravelerInputSchema>;
export type TravelerFormData = z.infer<typeof TravelerFormDataSchema>;
export type PnrSubmitBody = z.infer<typeof PnrSubmitBodySchema>;
export type PnrCustomerResponse = z.infer<typeof PnrCustomerResponseSchema>;
