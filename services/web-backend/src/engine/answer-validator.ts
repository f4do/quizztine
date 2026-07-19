/* ------------------------------------------------------------------ */
/*  Answer validators — Strategy pattern for question types            */
/*  Port of answer_validator.py                                        */
/* ------------------------------------------------------------------ */

export interface AnswerValidator {
  /** Return true when the answer is considered correct. */
  isCorrect(correctData: unknown, selected: unknown): boolean
}

/**
 * Validates MCQ (multiple-choice) answers:
 * - All correct choices must be selected.
 * - No extra (wrong) choices may be selected.
 */
export class MCQValidator implements AnswerValidator {
  isCorrect(correctData: unknown, selected: unknown): boolean {
    if (!Array.isArray(correctData) || !Array.isArray(selected)) {
      return false
    }
    if (correctData.length === 0) {
      return selected.length === 0
    }
    const correctSet = new Set(correctData)
    const selectedSet = new Set(selected)
    if (correctSet.size !== selectedSet.size) return false
    for (const c of correctSet) {
      if (!selectedSet.has(c)) return false
    }
    return true
  }
}

// ── Registry ──────────────────────────────────────────────────────────

export const VALIDATORS: Record<string, AnswerValidator> = {
  MCQ: new MCQValidator(),
}

export function getValidator(questionType: string): AnswerValidator {
  const validator = VALIDATORS[questionType]
  if (!validator) {
    throw new Error(`Unknown question type: ${questionType}`)
  }
  return validator
}

/**
 * Convenience wrapper: checks whether the selected choices are correct
 * for the given question type.
 */
export function validateAnswer(
  questionType: string,
  correctChoices: number[],
  selectedChoices: number[],
): boolean {
  return getValidator(questionType).isCorrect(correctChoices, selectedChoices)
}
