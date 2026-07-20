import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import logger from '../lib/logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface SeedChoice {
  text: string
  isCorrect: boolean
}

export interface SeedQuestion {
  seedKey: string
  text: string
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
  category: string
  choices: SeedChoice[]
  explanation: string
}

export interface SeedCategory {
  name: string
}

export interface SeedDataFile {
  language: 'fr' | 'en'
  categories: SeedCategory[]
  questions: SeedQuestion[]
}

export function loadSeedData(language: 'fr' | 'en'): SeedDataFile {
  const filePath = path.join(__dirname, `${language}.json`)
  const raw = fs.readFileSync(filePath, 'utf-8')
  const data = JSON.parse(raw) as SeedDataFile

  // Validate categories exist
  const categoryNames = new Set(data.categories.map((c) => c.name))
  for (const q of data.questions) {
    if (!categoryNames.has(q.category)) {
      throw new Error(
        `Question "${q.seedKey}" references unknown category "${q.category}"`,
      )
    }
  }

  logger.info(
    { language, categories: data.categories.length, questions: data.questions.length },
    'Seed data loaded',
  )

  return data
}
