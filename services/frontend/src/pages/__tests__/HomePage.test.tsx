import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { render } from '../../test/utils'
import HomePage from '../HomePage'

describe('HomePage', () => {
  it('renders without crashing', () => {
    render(<HomePage />)
    expect(screen.getByRole('heading')).toBeInTheDocument()
  })
})
