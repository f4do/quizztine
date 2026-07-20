import { describe, it, expect } from 'vitest'
import { loadSeedData } from '../index.js'

describe('Seed data files', () => {
  describe('fr.json', () => {
    const data = loadSeedData('fr')

    it('has 6 categories', () => {
      expect(data.categories).toHaveLength(6)
      const names = data.categories.map((c) => c.name)
      expect(names).toContain('Sciences')
      expect(names).toContain('Histoire')
      expect(names).toContain('Géographie')
      expect(names).toContain('Culture Générale')
      expect(names).toContain('Sport')
      expect(names).toContain('Divertissement')
    })

    it('has at least 15 questions per category', () => {
      const countPerCategory: Record<string, number> = {}
      for (const q of data.questions) {
        countPerCategory[q.category] = (countPerCategory[q.category] || 0) + 1
      }
      for (const [cat, count] of Object.entries(countPerCategory)) {
        expect(count, `${cat} has ${count} questions`).toBeGreaterThanOrEqual(15)
      }
    })

    it('has valid question structure for all questions', () => {
      for (const q of data.questions) {
        expect(q.seedKey).toMatch(/^fr-/)
        expect(q.text).toBeTruthy()
        expect(['EASY', 'MEDIUM', 'HARD']).toContain(q.difficulty)
        expect(q.choices.length).toBeGreaterThanOrEqual(2)
        const correctCount = q.choices.filter((c) => c.isCorrect).length
        expect(correctCount).toBeGreaterThanOrEqual(1)
        expect(q.explanation).toBeTruthy()
      }
    })

    it('has unique seedKeys', () => {
      const keys = data.questions.map((q) => q.seedKey)
      expect(new Set(keys).size).toBe(keys.length)
    })

    it('has all categories referenced by questions', () => {
      const categorySet = new Set(data.categories.map((c) => c.name))
      for (const q of data.questions) {
        expect(categorySet.has(q.category)).toBe(true)
      }
    })

    it('has some multi-correct questions', () => {
      const multiCorrect = data.questions.filter((q) => q.choices.filter((c) => c.isCorrect).length > 1)
      expect(multiCorrect.length).toBeGreaterThan(0)
    })

    it('has mixed difficulties', () => {
      const difficulties = data.questions.map((q) => q.difficulty)
      expect(difficulties.filter((d) => d === 'EASY').length).toBeGreaterThan(0)
      expect(difficulties.filter((d) => d === 'MEDIUM').length).toBeGreaterThan(0)
      expect(difficulties.filter((d) => d === 'HARD').length).toBeGreaterThan(0)
    })
  })

  describe('en.json', () => {
    const data = loadSeedData('en')

    it('has 6 categories', () => {
      expect(data.categories).toHaveLength(6)
      const names = data.categories.map((c) => c.name)
      expect(names).toContain('Science')
      expect(names).toContain('History')
      expect(names).toContain('Geography')
      expect(names).toContain('General Knowledge')
      expect(names).toContain('Sports')
      expect(names).toContain('Entertainment')
    })

    it('has at least 15 questions per category', () => {
      const countPerCategory: Record<string, number> = {}
      for (const q of data.questions) {
        countPerCategory[q.category] = (countPerCategory[q.category] || 0) + 1
      }
      for (const [cat, count] of Object.entries(countPerCategory)) {
        expect(count, `${cat} has ${count} questions`).toBeGreaterThanOrEqual(15)
      }
    })

    it('has valid question structure for all questions', () => {
      for (const q of data.questions) {
        expect(q.seedKey).toMatch(/^en-/)
        expect(q.text).toBeTruthy()
        expect(['EASY', 'MEDIUM', 'HARD']).toContain(q.difficulty)
        expect(q.choices.length).toBeGreaterThanOrEqual(2)
        const correctCount = q.choices.filter((c) => c.isCorrect).length
        expect(correctCount).toBeGreaterThanOrEqual(1)
        expect(q.explanation).toBeTruthy()
      }
    })

    it('has unique seedKeys', () => {
      const keys = data.questions.map((q) => q.seedKey)
      expect(new Set(keys).size).toBe(keys.length)
    })

    it('has all categories referenced by questions', () => {
      const categorySet = new Set(data.categories.map((c) => c.name))
      for (const q of data.questions) {
        expect(categorySet.has(q.category)).toBe(true)
      }
    })

    it('has some multi-correct questions', () => {
      const multiCorrect = data.questions.filter((q) => q.choices.filter((c) => c.isCorrect).length > 1)
      expect(multiCorrect.length).toBeGreaterThan(0)
    })

    it('has mixed difficulties', () => {
      const difficulties = data.questions.map((q) => q.difficulty)
      expect(difficulties.filter((d) => d === 'EASY').length).toBeGreaterThan(0)
      expect(difficulties.filter((d) => d === 'MEDIUM').length).toBeGreaterThan(0)
      expect(difficulties.filter((d) => d === 'HARD').length).toBeGreaterThan(0)
    })
  })

  describe('unique seedKeys across languages', () => {
    it('has no overlap between fr and en seedKeys', () => {
      const fr = loadSeedData('fr')
      const en = loadSeedData('en')
      const frKeys = new Set(fr.questions.map((q) => q.seedKey))
      const enKeys = new Set(en.questions.map((q) => q.seedKey))
      for (const key of frKeys) {
        expect(enKeys.has(key)).toBe(false)
      }
    })
  })
})
