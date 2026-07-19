import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RoomGame from '../RoomGame'
import type { Phase } from '../../../lib/useRoomGameTypes'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

function createProps(overrides: Partial<ReturnType<typeof createProps>> = {}) {
  return {
    phase: 'game' as Phase,
    questionId: 1,
    questionIndex: 0,
    totalQuestions: 10,
    questionText: 'What is the capital of France?',
    questionChoices: [
      { text: 'Paris' },
      { text: 'London' },
      { text: 'Berlin' },
      { text: 'Madrid' },
    ],
    questionMediaUrl: null,
    questionMediaType: null,
    questionExplanation: null,
    questionSourceUrl: null,
    selectedChoices: [],
    choiceCorrect: [false, false, false, false],
    hasAnswered: false,
    isFeedback: false,
    feedbackCountdown: 0,
    timeLeft: 30,
    timer: 30,
    result: null,
    feedbackMeta: {
      correct: false,
      onlyCorrect: false,
      firstCorrect: false,
      onlyWrong: false,
      difficulty: null,
    },
    answeredCount: 0,
    totalActive: 1,
    roomMode: 'solo',
    handleChoice: vi.fn(),
    handleAnswerSubmit: vi.fn(),
    getChoiceStyle: vi.fn(() => ''),
    ...overrides,
  }
}

describe('RoomGame', () => {
  /* ── question text ───────────────────────────────────────────── */
  it('renders the question text', () => {
    render(<RoomGame {...createProps()} />)
    expect(
      screen.getByText('What is the capital of France?'),
    ).toBeInTheDocument()
  })

  it('renders loading placeholder when questionText is empty', () => {
    render(<RoomGame {...createProps({ questionText: '' })} />)
    expect(screen.getByText('room.loading_question')).toBeInTheDocument()
  })

  /* ── choices ─────────────────────────────────────────────────── */
  it('renders all choice buttons', () => {
    render(<RoomGame {...createProps()} />)
    expect(screen.getByText('Paris')).toBeInTheDocument()
    expect(screen.getByText('London')).toBeInTheDocument()
    expect(screen.getByText('Berlin')).toBeInTheDocument()
    expect(screen.getByText('Madrid')).toBeInTheDocument()
  })

  it('renders correct number of choice buttons', () => {
    render(<RoomGame {...createProps()} />)
    const buttons = screen.getAllByRole('button')
    // choices (4) + submit (1) = 5
    expect(buttons.length).toBe(5)
  })

  /* ── submit button ───────────────────────────────────────────── */
  it('disables submit button when no choice is selected', () => {
    render(<RoomGame {...createProps({ selectedChoices: [] })} />)
    expect(screen.getByText('room.submit_answer')).toBeDisabled()
  })

  it('enables submit button when a choice is selected', () => {
    render(<RoomGame {...createProps({ selectedChoices: [0] })} />)
    expect(screen.getByText('room.submit_answer')).toBeEnabled()
  })

  it('disables submit button after answering', () => {
    render(
      <RoomGame
        {...createProps({ selectedChoices: [0], hasAnswered: true })}
      />,
    )
    // After answering in solo, the submit area is hidden entirely.
    expect(screen.queryByText('room.submit_answer')).not.toBeInTheDocument()
    expect(screen.queryByText('room.waiting_for_answers')).not.toBeInTheDocument()
  })

  /* ── feedback banner ─────────────────────────────────────────── */
  it('renders feedback banner when isFeedback is true and result is provided', () => {
    render(
      <RoomGame
        {...createProps({
          isFeedback: true,
          result: {
            correct: true,
            points: 15,
            bonus: 0,
            streak: 1,
            cumulative_time: 3.2,
          },
          feedbackMeta: {
            correct: true,
            onlyCorrect: false,
            firstCorrect: false,
            onlyWrong: false,
            difficulty: null,
          },
        })}
      />,
    )
    // FeedbackBanner has role="status"
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('hides submit button during feedback', () => {
    render(
      <RoomGame
        {...createProps({
          phase: 'feedback',
          isFeedback: true,
          result: {
            correct: true,
            points: 15,
            bonus: 0,
            streak: 1,
            cumulative_time: 3.2,
          },
          feedbackMeta: {
            correct: true,
            onlyCorrect: false,
            firstCorrect: false,
            onlyWrong: false,
            difficulty: null,
          },
        })}
      />,
    )
    expect(
      screen.queryByText('room.submit_answer'),
    ).not.toBeInTheDocument()
  })

  /* ── explanation ─────────────────────────────────────────────── */
  it('shows explanation section when in feedback with explanation', () => {
    render(
      <RoomGame
        {...createProps({
          isFeedback: true,
          questionExplanation: 'Paris is the capital city of France.',
          result: {
            correct: true,
            points: 15,
            bonus: 0,
            streak: 1,
            cumulative_time: 3.2,
          },
          feedbackMeta: {
            correct: true,
            onlyCorrect: false,
            firstCorrect: false,
            onlyWrong: false,
            difficulty: null,
          },
        })}
      />,
    )
    expect(
      screen.getByText('Paris is the capital city of France.'),
    ).toBeInTheDocument()
    expect(screen.getByText('room.explanation')).toBeInTheDocument()
  })

  it('shows source link when questionSourceUrl is set', () => {
    render(
      <RoomGame
        {...createProps({
          isFeedback: true,
          questionExplanation: 'Some explanation.',
          questionSourceUrl: 'https://en.wikipedia.org/wiki/Paris',
          result: {
            correct: true,
            points: 15,
            bonus: 0,
            streak: 1,
            cumulative_time: 3.2,
          },
          feedbackMeta: {
            correct: true,
            onlyCorrect: false,
            firstCorrect: false,
            onlyWrong: false,
            difficulty: null,
          },
        })}
      />,
    )
    // The rendered text is "room.source →" so use a function matcher
    const link = screen.getByText((content) => content.startsWith('room.source'))
    expect(link).toBeInTheDocument()
    expect(link.closest('a')).toHaveAttribute(
      'href',
      'https://en.wikipedia.org/wiki/Paris',
    )
  })

  it('does not show source link when questionSourceUrl is null', () => {
    render(
      <RoomGame
        {...createProps({
          isFeedback: true,
          questionExplanation: 'Some explanation.',
          questionSourceUrl: null,
          result: {
            correct: true,
            points: 15,
            bonus: 0,
            streak: 1,
            cumulative_time: 3.2,
          },
          feedbackMeta: {
            correct: true,
            onlyCorrect: false,
            firstCorrect: false,
            onlyWrong: false,
            difficulty: null,
          },
        })}
      />,
    )
    expect(screen.queryByText('room.source')).not.toBeInTheDocument()
  })

  /* ── media ───────────────────────────────────────────────────── */
  it('renders image when questionMediaType is image', () => {
    render(
      <RoomGame
        {...createProps({
          questionMediaUrl: 'https://example.com/capital.jpg',
          questionMediaType: 'image',
        })}
      />,
    )
    const img = screen.getByAltText('question media')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'https://example.com/capital.jpg')
  })

  it('renders audio element when questionMediaType is audio', () => {
    render(
      <RoomGame
        {...createProps({
          questionMediaUrl: 'https://example.com/sound.mp3',
          questionMediaType: 'audio',
        })}
      />,
    )
    const audio = document.querySelector('audio')
    expect(audio).toBeInTheDocument()
    expect(audio).toHaveAttribute('src', 'https://example.com/sound.mp3')
  })

  it('renders video element when questionMediaType is video', () => {
    render(
      <RoomGame
        {...createProps({
          questionMediaUrl: 'https://example.com/clip.mp4',
          questionMediaType: 'video',
        })}
      />,
    )
    const video = document.querySelector('video')
    expect(video).toBeInTheDocument()
    expect(video).toHaveAttribute('src', 'https://example.com/clip.mp4')
  })

  /* ── player counter (multiplayer) ────────────────────────────── */
  it('shows player answered count in multiplayer before answering', () => {
    render(
      <RoomGame
        {...createProps({
          roomMode: 'multi_public',
          answeredCount: 2,
          totalActive: 5,
          hasAnswered: false,
        })}
      />,
    )
    expect(screen.getByText('room.players_answered')).toBeInTheDocument()
  })

  it('shows waiting message in multiplayer after answering', () => {
    render(
      <RoomGame
        {...createProps({
          roomMode: 'multi_public',
          answeredCount: 2,
          totalActive: 5,
          hasAnswered: true,
        })}
      />,
    )
    // Appears both in the player counter area and the submit button
    expect(screen.getAllByText('room.waiting_for_answers').length).toBe(2)
  })

  it('does not show player counter in solo mode', () => {
    render(
      <RoomGame
        {...createProps({
          roomMode: 'solo',
          answeredCount: 2,
          totalActive: 5,
        })}
      />,
    )
    expect(
      screen.queryByText('room.players_answered'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('room.waiting_for_answers'),
    ).not.toBeInTheDocument()
  })

  /* ── phase indicator ─────────────────────────────────────────── */
  it('renders the question phase indicator', () => {
    render(<RoomGame {...createProps({ questionIndex: 3 })} />)
    // The rendered text is "room.question 4" (index + 1), use a function matcher
    expect(screen.getByText((content) => content.startsWith('room.question'))).toBeInTheDocument()
  })

  /* ── timer label ─────────────────────────────────────────────── */
  it('renders timer label for answer phase', () => {
    render(<RoomGame {...createProps({ isFeedback: false })} />)
    expect(screen.getByText('room.timer_answer')).toBeInTheDocument()
  })

  it('renders timer label for feedback phase', () => {
    render(
      <RoomGame
        {...createProps({
          isFeedback: true,
          questionIndex: 8,
          totalQuestions: 10,
          result: {
            correct: true,
            points: 15,
            bonus: 0,
            streak: 1,
            cumulative_time: 3.2,
          },
          feedbackMeta: {
            correct: true,
            onlyCorrect: false,
            firstCorrect: false,
            onlyWrong: false,
            difficulty: null,
          },
        })}
      />,
    )
    expect(screen.getByText('room.timer_next')).toBeInTheDocument()
  })

  it('renders timer label for last question feedback', () => {
    render(
      <RoomGame
        {...createProps({
          isFeedback: true,
          questionIndex: 9,
          totalQuestions: 10,
          result: {
            correct: true,
            points: 15,
            bonus: 0,
            streak: 1,
            cumulative_time: 3.2,
          },
          feedbackMeta: {
            correct: true,
            onlyCorrect: false,
            firstCorrect: false,
            onlyWrong: false,
            difficulty: null,
          },
        })}
      />,
    )
    expect(screen.getByText('room.timer_results')).toBeInTheDocument()
  })

  /* ── submit handler ──────────────────────────────────────────── */
  it('calls handleChoice when a choice button is clicked', async () => {
    const handleChoice = vi.fn()
    const user = userEvent.setup()
    render(<RoomGame {...createProps({ handleChoice })} />)
    await user.click(screen.getByText('Paris'))
    expect(handleChoice).toHaveBeenCalledWith(0)
  })

  it('calls handleAnswerSubmit when submit is clicked', async () => {
    const handleAnswerSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <RoomGame
        {...createProps({
          selectedChoices: [0],
          handleAnswerSubmit,
        })}
      />,
    )
    await user.click(screen.getByText('room.submit_answer'))
    expect(handleAnswerSubmit).toHaveBeenCalledTimes(1)
  })
})
