import { describe, it, expect } from 'vitest'
import i18n from '../i18n'

describe('i18n', () => {
  it('is initialized', () => {
    expect(i18n.isInitialized).toBe(true)
  })

  it('has FR and EN languages', () => {
    const languages = i18n.languages
    expect(languages).toContain('fr')
    expect(languages).toContain('en')
  })
})
