import { describe, it, expect } from 'vitest'
import { registerSchema, loginSchema } from '../validation.js'
import { createQuestionSchema } from '../question-validation.js'

describe('registerSchema', () => {
  it('accepts valid registration', () => {
    const result = registerSchema.safeParse({
      pseudo: 'alice',
      email: 'alice@test.com',
      password: 'supersecret1234',
      confirmPassword: 'supersecret1234',
    })
    expect(result.success).toBe(true)
  })

  it('rejects mismatched confirm password', () => {
    const result = registerSchema.safeParse({
      pseudo: 'alice',
      email: 'alice@test.com',
      password: 'supersecret1234',
      confirmPassword: 'differentpassword',
    })
    expect(result.success).toBe(false)
  })

  it('rejects short password', () => {
    const result = registerSchema.safeParse({
      pseudo: 'alice',
      email: 'alice@test.com',
      password: 'short',
      confirmPassword: 'short',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = registerSchema.safeParse({
      pseudo: 'alice',
      email: 'not-an-email',
      password: 'supersecret1234',
      confirmPassword: 'supersecret1234',
    })
    expect(result.success).toBe(false)
  })

  it('rejects short pseudo', () => {
    const result = registerSchema.safeParse({
      pseudo: 'a',
      email: 'alice@test.com',
      password: 'supersecret1234',
      confirmPassword: 'supersecret1234',
    })
    expect(result.success).toBe(false)
  })
})

describe('loginSchema', () => {
  it('accepts login with email', () => {
    const result = loginSchema.safeParse({ login: 'admin1@quizztine.app', password: 'x' })
    expect(result.success).toBe(true)
  })

  it('accepts login with pseudo', () => {
    const result = loginSchema.safeParse({ login: 'admin1', password: 'x' })
    expect(result.success).toBe(true)
  })

  it('rejects empty login', () => {
    expect(loginSchema.safeParse({}).success).toBe(false)
    expect(loginSchema.safeParse({ login: '', password: 'x' }).success).toBe(false)
  })
})

describe('createQuestionSchema', () => {
  it('accepts valid question with single correct answer', () => {
    const result = createQuestionSchema.safeParse({
      text: 'What is 2+2?',
      choices: [
        { text: '3', isCorrect: false },
        { text: '4', isCorrect: true },
        { text: '5', isCorrect: false },
      ],
      category: 'Math',
      difficulty: 'EASY',
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid question with multiple correct answers', () => {
    const result = createQuestionSchema.safeParse({
      text: 'Pick primes:',
      choices: [
        { text: '17', isCorrect: true },
        { text: '21', isCorrect: false },
        { text: '29', isCorrect: true },
      ],
      category: 'Math',
      difficulty: 'HARD',
    })
    expect(result.success).toBe(true)
  })

  it('rejects question with no correct answer', () => {
    const result = createQuestionSchema.safeParse({
      text: 'What is 2+2?',
      choices: [
        { text: '3', isCorrect: false },
        { text: '5', isCorrect: false },
      ],
      category: 'Math',
      difficulty: 'EASY',
    })
    expect(result.success).toBe(false)
  })

  it('rejects question with too few choices', () => {
    const result = createQuestionSchema.safeParse({
      text: 'What is 2+2?',
      choices: [{ text: '4', isCorrect: true }],
      category: 'Math',
      difficulty: 'EASY',
    })
    expect(result.success).toBe(false)
  })

  it('rejects question with too many choices', () => {
    const result = createQuestionSchema.safeParse({
      text: 'What is 2+2?',
      choices: [
        { text: '1', isCorrect: false },
        { text: '2', isCorrect: false },
        { text: '3', isCorrect: false },
        { text: '4', isCorrect: true },
        { text: '5', isCorrect: false },
      ],
      category: 'Math',
      difficulty: 'EASY',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid difficulty', () => {
    const result = createQuestionSchema.safeParse({
      text: 'What is 2+2?',
      choices: [
        { text: '3', isCorrect: false },
        { text: '4', isCorrect: true },
      ],
      category: 'Math',
      difficulty: 'EXTREME',
    })
    expect(result.success).toBe(false)
  })

  it('accepts question with all optional fields', () => {
    const result = createQuestionSchema.safeParse({
      text: 'Complex question?',
      choices: [
        { text: 'A', isCorrect: true },
        { text: 'B', isCorrect: false },
      ],
      explanation: 'Because reasons',
      sourceUrl: 'https://example.com',
      category: 'Science',
      difficulty: 'MEDIUM',
      visibility: 'PRIVATE',
    })
    expect(result.success).toBe(true)
  })

  it('accepts question with explicit questionType MCQ', () => {
    const result = createQuestionSchema.safeParse({
      questionType: 'MCQ',
      text: 'What is 2+2?',
      choices: [
        { text: '3', isCorrect: false },
        { text: '4', isCorrect: true },
      ],
      category: 'Math',
      difficulty: 'EASY',
    })
    expect(result.success).toBe(true)
  })

  it('defaults questionType to MCQ when omitted', () => {
    const result = createQuestionSchema.safeParse({
      text: 'What is 2+2?',
      choices: [
        { text: '3', isCorrect: false },
        { text: '4', isCorrect: true },
      ],
      category: 'Math',
      difficulty: 'EASY',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.questionType).toBe('MCQ')
    }
  })

  it('rejects invalid questionType', () => {
    const result = createQuestionSchema.safeParse({
      questionType: 'TEXT',
      text: 'What is 2+2?',
      choices: [
        { text: '3', isCorrect: false },
        { text: '4', isCorrect: true },
      ],
      category: 'Math',
      difficulty: 'EASY',
    })
    expect(result.success).toBe(false)
  })

  it('rejects MCQ without choices', () => {
    const result = createQuestionSchema.safeParse({
      questionType: 'MCQ',
      text: 'What is 2+2?',
      category: 'Math',
      difficulty: 'EASY',
    })
    expect(result.success).toBe(false)
  })

  it('rejects MCQ with only one choice', () => {
    const result = createQuestionSchema.safeParse({
      questionType: 'MCQ',
      text: 'What is 2+2?',
      choices: [{ text: '4', isCorrect: true }],
      category: 'Math',
      difficulty: 'EASY',
    })
    expect(result.success).toBe(false)
  })
})
