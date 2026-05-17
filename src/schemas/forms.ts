import { z } from 'zod';

export const GroupFormSchema = z.object({
  name: z.string()
    .min(1, "그룹 이름은 필수입니다.")
    .max(100, "100자 이하여야 합니다."),
  description: z.string()
    .max(500, "500자 이하여야 합니다.")
    .optional()
    .nullable(),
  color: z.string()
    .regex(/^#[0-9a-fA-F]{6}$/, "#RRGGBB 형식이어야 합니다.")
    .optional()
    .nullable(),
  funnelId: z.string().optional().nullable(),
});

export type GroupFormData = z.infer<typeof GroupFormSchema>;
