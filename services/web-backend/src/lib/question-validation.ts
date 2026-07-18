import { z } from 'zod'

const choiceSchema = z.object({
  text: z.string().min(1).max(500),
  isCorrect: z.boolean(),
})

const mediaUrlSchema = z.union([
  z.string().regex(/^(\/uploads\/|https?:\/\/)/),
  z.literal(''),
])

const questionBaseSchema = z.object({
  questionType: z.enum(['MCQ']).default('MCQ'),
  text: z.string().min(1).max(2000),
  choices: z.array(choiceSchema).optional(),
  explanation: z.string().max(2000).optional(),
  sourceUrl: z.string().url().optional().or(z.literal('')),
  mediaUrl: mediaUrlSchema.optional(),
  mediaType: z.enum(['audio', 'image', 'video']).optional(),
  category: z.string().min(1).max(100),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
})

export const createQuestionSchema = questionBaseSchema.refine(
  (data) => {
    // MCQ validation: 2-4 choices with at least one correct
    if (data.questionType === 'MCQ') {
      if (!data.choices || data.choices.length < 2 || data.choices.length > 4) return false
      if (!data.choices.some((c) => c.isCorrect)) return false
    }
    return true
  },
  { message: 'MCQ requires 2 to 4 choices with at least one correct option' },
)

export const updateQuestionSchema = questionBaseSchema.partial()

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>
