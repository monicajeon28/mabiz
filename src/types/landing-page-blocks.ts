/**
 * Landing Page Block System - TypeScript Types & Zod Schemas
 *
 * 블록 커스터마이징 시스템의 모든 타입 정의
 * - Block types (Hero, Problem, Solution, etc.)
 * - FormField types
 * - Config interfaces
 * - Zod validation schemas
 *
 * @author Claude Code
 * @version 1.0
 * @date 2026-06-15
 */

import { z } from 'zod'

/**
 * ────────────────────────────────────────────
 * 1. BLOCK TYPE DEFINITIONS
 * ────────────────────────────────────────────
 */

export type BlockType =
  | 'hero'
  | 'problem'
  | 'solution'
  | 'offer'
  | 'social_proof'
  | 'faq'
  | 'cta'
  | 'countdown'
  | 'testimonial'
  | 'form'
  | 'rich_text'

/**
 * Base interface for all blocks
 */
export interface BlockBase {
  id: string
  type: BlockType
  order: number
  enabled: boolean
}

/**
 * ────────────────────────────────────────────
 * 2. BLOCK CONFIG SCHEMAS & TYPES (Zod-based)
 * ────────────────────────────────────────────
 */
// Note: Interfaces are now generated from Zod schemas at the bottom of the file
// to avoid duplication and ensure validation consistency

/**
 * ────────────────────────────────────────────
 * 3. FORM FIELD TYPES
 * ────────────────────────────────────────────
 */

export type FormFieldType =
  | 'text'
  | 'number'
  | 'email'
  | 'tel'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'date'
  | 'time'
  | 'password'
  | 'hidden'
  | 'file'
  | 'button'

// Note: SelectOption, FormFieldValidation, FormFieldConditional, FormField interfaces
// will be inferred from Zod schemas at the bottom of this file

/**
 * ────────────────────────────────────────────
 * 4. COMPOSITE BLOCK TYPE (will be inferred from BlockSchema)
 * ────────────────────────────────────────────
 */

// Note: Block type will be inferred from BlockSchema at the bottom

/**
 * ────────────────────────────────────────────
 * 5. PAGE LEVEL CONFIG (will be inferred from Zod schemas)
 * ────────────────────────────────────────────
 */

// Note: LandingPageTheme, AnalyticsConfig, LandingPageFormConfig interfaces
// will be inferred from Zod schemas at the bottom

/**
 * ────────────────────────────────────────────
 * 6. RESPONSE DATA TYPES (will be inferred from Zod schemas)
 * ────────────────────────────────────────────
 */

// Note: BlockResponse, LandingPageRegistration interfaces
// will be inferred from Zod schemas at the bottom

// Note: FormSubmission interface will be inferred from FormSubmissionSchema below

/**
 * ────────────────────────────────────────────
 * 7. ZOD VALIDATION SCHEMAS
 * ────────────────────────────────────────────
 */

// ─── Helper Schemas ───
const ColorHexSchema = z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color')
const UrlSchema = z.string().url('Invalid URL')
const LayoutSchema = z.enum(['list', 'grid'])
const ButtonStyleSchema = z.enum(['solid', 'outline', 'ghost'])

// ─── Base Block Schema ───
export const BlockBaseSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    'hero',
    'problem',
    'solution',
    'offer',
    'social_proof',
    'faq',
    'cta',
    'countdown',
    'testimonial',
    'form',
    'rich_text'
  ] as const),
  order: z.number().int().nonnegative(),
  enabled: z.boolean().default(true)
})

// ─── Block Config Schemas ───
export const HeroBlockConfigSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  backgroundImage: z.object({
    url: UrlSchema,
    altText: z.string().optional(),
    position: z.enum(['cover', 'contain', 'center'])
  }).optional(),
  backgroundVideo: z.object({
    url: UrlSchema,
    autoplay: z.boolean(),
    muted: z.boolean()
  }).optional(),
  cta: z.object({
    text: z.string().min(1).max(50),
    color: ColorHexSchema,
    link: UrlSchema.optional(),
    scrollTo: z.string().optional()
  }).optional(),
  textColor: ColorHexSchema.optional(),
  minHeight: z.number().int().positive().default(400)
})

export const ProblemBlockConfigSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  problems: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    icon: z.string().optional(),
    order: z.number()
  })),
  layout: LayoutSchema
})

export const SolutionBlockConfigSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  solutions: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    icon: z.string().optional(),
    image: z.object({
      url: UrlSchema,
      altText: z.string().optional()
    }).optional(),
    order: z.number()
  })),
  layout: LayoutSchema,
  processSteps: z.boolean().optional()
})

export const OfferBlockConfigSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  pricing: z.object({
    original: z.number().optional(),
    discounted: z.number(),
    currency: z.enum(['KRW', 'USD']),
    period: z.enum(['onetime', 'monthly', 'yearly']).optional()
  }),
  urgency: z.object({
    type: z.enum(['countdown', 'stock', 'deadline']),
    countdownEndTime: z.coerce.date().optional(),
    stockRemaining: z.number().optional(),
    deadline: z.coerce.date().optional(),
    urgencyText: z.string()
  }).optional(),
  features: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    icon: z.string().optional(),
    order: z.number()
  })),
  cta: z.object({
    text: z.string(),
    color: ColorHexSchema,
    link: UrlSchema.optional()
  }).optional()
})

export const FaqBlockConfigSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  faqs: z.array(z.object({
    id: z.string(),
    question: z.string(),
    answer: z.string(),
    category: z.string().optional(),
    order: z.number()
  })),
  layout: z.enum(['accordion', 'tabs']),
  initialExpanded: z.boolean().optional()
})

export const CtaBlockConfigSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  buttonText: z.string().min(1),
  buttonColor: ColorHexSchema,
  buttonStyle: ButtonStyleSchema,
  action: z.object({
    type: z.enum(['link', 'form', 'scroll', 'modal']),
    target: z.string().optional()
  }),
  linkedFormFields: z.string().array().optional(),
  trackingInfo: z.object({
    which_cta: z.string().optional(),
    cta_text: z.string().optional(),
    tracking_id: z.string().optional()
  }).optional()
})

export const CountdownBlockConfigSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  countdownEndTime: z.coerce.date(),
  display: z.enum(['timer', 'progress', 'text']),
  timerFormat: z.enum(['HH:MM:SS', 'DD:HH:MM']),
  urgencyText: z.string().optional(),
  backgroundColor: ColorHexSchema.optional(),
  textColor: ColorHexSchema.optional(),
  onExpire: z.object({
    type: z.enum(['hide', 'message', 'redirect']),
    redirectUrl: UrlSchema.optional(),
    expireMessage: z.string().optional()
  })
})

export const TestimonialBlockConfigSchema = z.object({
  title: z.string().optional(),
  testimonials: z.array(z.object({
    id: z.string(),
    name: z.string(),
    title: z.string().optional(),
    content: z.string(),
    image: z.object({
      url: UrlSchema,
      altText: z.string().optional()
    }).optional(),
    rating: z.number().min(1).max(5).optional(),
    order: z.number()
  })),
  layout: z.enum(['carousel', 'grid', 'single']),
  autoScroll: z.boolean().optional()
})

export const SelectOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
  disabled: z.boolean().optional(),
  order: z.number().optional(),
  emotionalAppeal: z.string().optional()
})

export const FormFieldValidationSchema = z.object({
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  pattern: z.string().optional(),
  email: z.boolean().optional(),
  customMessage: z.string().optional()
})

export const FormFieldSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  label: z.string().min(1).max(100),
  type: z.enum([
    'text',
    'number',
    'email',
    'tel',
    'textarea',
    'select',
    'checkbox',
    'radio',
    'date',
    'time',
    'password',
    'hidden',
    'file',
    'button'
  ] as const),
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  options: z.array(SelectOptionSchema).optional(),
  validation: FormFieldValidationSchema.optional(),
  width: z.enum(['full', 'half', 'third']).optional(),
  className: z.string().optional(),
  disabled: z.boolean().optional(),
  conditional: z.object({
    fieldId: z.string(),
    operator: z.enum(['equals', 'contains', 'gt', 'lt']),
    value: z.union([z.string(), z.number()])
  }).optional(),
  emotionalContext: z.string().optional()
})

export const FormBlockConfigSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  fields: z.array(FormFieldSchema),
  submitButtonText: z.string().min(1),
  submitButtonColor: ColorHexSchema,
  theme: z.enum(['light', 'dark']),
  onSubmit: z.object({
    type: z.enum(['redirect', 'message', 'webhook']),
    redirectUrl: UrlSchema.optional(),
    successMessage: z.string().optional(),
    webhookUrl: UrlSchema.optional()
  }),
  storeResponses: z.boolean(),
  sendConfirmationEmail: z.boolean().optional(),
  confirmationEmailTemplate: z.string().optional()
})

export const RichTextBlockConfigSchema = z.object({
  content: z.string().min(1),
  backgroundColor: ColorHexSchema.optional(),
  textColor: ColorHexSchema.optional(),
  maxWidth: z.number().int().positive().optional()
})

// ─── Composite Block Schema ───
export const BlockSchema = z.discriminatedUnion('type', [
  BlockBaseSchema.extend({ type: z.literal('hero'), config: HeroBlockConfigSchema }),
  BlockBaseSchema.extend({ type: z.literal('problem'), config: ProblemBlockConfigSchema }),
  BlockBaseSchema.extend({ type: z.literal('solution'), config: SolutionBlockConfigSchema }),
  BlockBaseSchema.extend({ type: z.literal('offer'), config: OfferBlockConfigSchema }),
  BlockBaseSchema.extend({ type: z.literal('faq'), config: FaqBlockConfigSchema }),
  BlockBaseSchema.extend({ type: z.literal('cta'), config: CtaBlockConfigSchema }),
  BlockBaseSchema.extend({ type: z.literal('countdown'), config: CountdownBlockConfigSchema }),
  BlockBaseSchema.extend({ type: z.literal('testimonial'), config: TestimonialBlockConfigSchema }),
  BlockBaseSchema.extend({ type: z.literal('form'), config: FormBlockConfigSchema }),
  BlockBaseSchema.extend({ type: z.literal('rich_text'), config: RichTextBlockConfigSchema })
])

// ─── Page Level Schemas ───
export const LandingPageThemeSchema = z.object({
  primaryColor: ColorHexSchema,
  secondaryColor: ColorHexSchema.optional(),
  backgroundColor: ColorHexSchema.optional(),
  fontFamily: z.enum(['sans', 'serif']),
  fontSize: z.enum(['small', 'normal', 'large']),
  mobileWidth: z.number().int().positive().optional(),
  containerMaxWidth: z.number().int().positive().optional()
})

export const AnalyticsConfigSchema = z.object({
  googleAnalyticsId: z.string().optional(),
  pixelId: z.string().optional(),
  customEvents: z.array(z.object({
    name: z.string(),
    trigger: z.enum(['page_load', 'button_click', 'form_submit']),
    blockId: z.string().optional()
  })).optional()
})

export const LandingPageFormConfigSchema = z.object({
  version: z.literal('1.0'),
  blocks: z.array(BlockSchema),
  theme: LandingPageThemeSchema.optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  ogImage: UrlSchema.optional(),
  analyticsConfig: AnalyticsConfigSchema.optional()
})

// ─── Response Schemas ───
export const BlockResponseSchema = z.object({
  blockId: z.string(),
  blockType: z.enum(['form', 'cta']),
  responses: z.record(z.string(), z.any()),
  submittedAt: z.coerce.date()
})

export const LandingPageRegistrationSchema = z.object({
  id: z.string(),
  landingPageId: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string().email().optional(),
  blockResponses: z.array(BlockResponseSchema).optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  emotionalRating: z.number().min(1).max(5).optional(),
  conversionPath: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  funnelStarted: z.boolean().default(false),
  createdAt: z.coerce.date()
})

export const FormSubmissionSchema = z.object({
  blockId: z.string(),
  responses: z.record(z.string(), z.union([z.string(), z.array(z.string()), z.boolean()])),
  metadata: z.object({
    pageUrl: z.string(),
    userAgent: z.string(),
    timestamp: z.coerce.date(),
    clientIp: z.string().optional()
  }).optional()
})

/**
 * ────────────────────────────────────────────
 * 8. TYPE INFERENCE
 * ────────────────────────────────────────────
 */

export type HeroBlockConfig = z.infer<typeof HeroBlockConfigSchema>
export type ProblemBlockConfig = z.infer<typeof ProblemBlockConfigSchema>
export type SolutionBlockConfig = z.infer<typeof SolutionBlockConfigSchema>
export type OfferBlockConfig = z.infer<typeof OfferBlockConfigSchema>
export type FaqBlockConfig = z.infer<typeof FaqBlockConfigSchema>
export type CtaBlockConfig = z.infer<typeof CtaBlockConfigSchema>
export type CountdownBlockConfig = z.infer<typeof CountdownBlockConfigSchema>
export type TestimonialBlockConfig = z.infer<typeof TestimonialBlockConfigSchema>
export type FormBlockConfig = z.infer<typeof FormBlockConfigSchema>
export type RichTextBlockConfig = z.infer<typeof RichTextBlockConfigSchema>

export type LandingPageFormConfig = z.infer<typeof LandingPageFormConfigSchema>
export type FormField = z.infer<typeof FormFieldSchema>
export type Block = z.infer<typeof BlockSchema>
export type BlockResponse = z.infer<typeof BlockResponseSchema>
export type LandingPageRegistration = z.infer<typeof LandingPageRegistrationSchema>
export type FormSubmission = z.infer<typeof FormSubmissionSchema>
