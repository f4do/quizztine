import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../../../test/utils'
import RoomScoreboard from '../RoomScoreboard'

vi.mock('react-i18next', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-i18next')>()
  return {
    ...mod,
    useTranslation: () => ({ t: (key: string) => key }),
  }
})

function scoreboardEntry(
  playerId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    player_id: playerId,
    nickname: playerId,
    score: 0,
    streak: 0,
    cumulative_time: 0,
    ...overrides,
  }
}

function createProps(overrides: Record<string, unknown> = {}) {
  return {
    scoreboard: [
      scoreboardEntry('p1', { nickname: 'Alice', score: 120, cumulative_time: 15.3 }),
      scoreboardEntry('p2', { nickname: 'Bob', score: 80, cumulative_time: 22.7 }),
      scoreboardEntry('p3', { nickname: 'Charlie', score: 45, cumulative_time: 18.1 }),
    ],
    roomMode: 'solo',
    creatorPid: null,
    playerId: 'p1',
    isReplaying: false,
    onPlayAgain: vi.fn(),
    onHome: vi.fn(),
    ...overrides,
  }
}

describe('RoomScoreboard', () => {
  /* ── heading ─────────────────────────────────────────────────── */
  it('shows game over heading', () => {
    render(<RoomScoreboard {...createProps()} />)
    expect(screen.getByText('room.game_over')).toBeInTheDocument()
  })

  /* ── player list / scores ────────────────────────────────────── */
  it('shows all player nicknames and scores', () => {
    render(<RoomScoreboard {...createProps()} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Charlie')).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.getByText('80')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()
  })

  it('shows cumulative time for each player', () => {
    render(<RoomScoreboard {...createProps()} />)
    expect(screen.getByText('15.3s')).toBeInTheDocument()
    expect(screen.getByText('22.7s')).toBeInTheDocument()
    expect(screen.getByText('18.1s')).toBeInTheDocument()
  })

  it('shows column headers', () => {
    render(<RoomScoreboard {...createProps()} />)
    expect(screen.getByText('room.player_col')).toBeInTheDocument()
    expect(screen.getByText('room.score')).toBeInTheDocument()
    expect(screen.getByText('room.time')).toBeInTheDocument()
  })

  /* ── medals / rank ───────────────────────────────────────────── */
  it('shows gold medal emoji for 1st place', () => {
    render(<RoomScoreboard {...createProps()} />)
    expect(screen.getByText('🥇')).toBeInTheDocument()
  })

  it('shows silver medal emoji for 2nd place', () => {
    render(<RoomScoreboard {...createProps()} />)
    expect(screen.getByText('🥈')).toBeInTheDocument()
  })

  it('shows bronze medal emoji for 3rd place', () => {
    render(<RoomScoreboard {...createProps()} />)
    expect(screen.getByText('🥉')).toBeInTheDocument()
  })

  it('shows rank number for 4th place and beyond', () => {
    render(
      <RoomScoreboard
        {...createProps({
          scoreboard: [
            scoreboardEntry('p1', { nickname: 'Alice', score: 100 }),
            scoreboardEntry('p2', { nickname: 'Bob', score: 80 }),
            scoreboardEntry('p3', { nickname: 'Charlie', score: 60 }),
            scoreboardEntry('p4', { nickname: 'Diana', score: 40 }),
          ],
        })}
      />,
    )
    expect(screen.getByText('#4')).toBeInTheDocument()
  })

  /* ── play again button ───────────────────────────────────────── */
  it('shows play again button in solo mode', () => {
    render(
      <RoomScoreboard
        {...createProps({ roomMode: 'solo', creatorPid: null })}
      />,
    )
    expect(screen.getByText('room.play_again')).toBeInTheDocument()
  })

  it('shows play again button for creator in multiplayer', () => {
    render(
      <RoomScoreboard
        {...createProps({
          roomMode: 'multi_public',
          creatorPid: 'p1',
          playerId: 'p1',
        })}
      />,
    )
    expect(screen.getByText('room.play_again')).toBeInTheDocument()
  })

  it('hides play again button for non-creator in multiplayer', () => {
    render(
      <RoomScoreboard
        {...createProps({
          roomMode: 'multi_public',
          creatorPid: 'p1',
          playerId: 'p2',
        })}
      />,
    )
    expect(
      screen.queryByText('room.play_again'),
    ).not.toBeInTheDocument()
  })

  it('disables play again button while replaying', () => {
    render(
      <RoomScoreboard
        {...createProps({
          roomMode: 'solo',
          isReplaying: true,
        })}
      />,
    )
    expect(screen.getByText('common.loading')).toBeDisabled()
  })

  it('calls onPlayAgain when play again is clicked', async () => {
    const onPlayAgain = vi.fn()
    const user = userEvent.setup()
    render(
      <RoomScoreboard
        {...createProps({
          roomMode: 'solo',
          onPlayAgain,
        })}
      />,
    )
    await user.click(screen.getByText('room.play_again'))
    expect(onPlayAgain).toHaveBeenCalledTimes(1)
  })

  /* ── home button ─────────────────────────────────────────────── */
  it('shows home button for all players', () => {
    render(<RoomScoreboard {...createProps()} />)
    expect(screen.getByText('room.home')).toBeInTheDocument()
  })

  it('calls onHome when home button is clicked', async () => {
    const onHome = vi.fn()
    const user = userEvent.setup()
    render(<RoomScoreboard {...createProps({ onHome })} />)
    await user.click(screen.getByText('room.home'))
    expect(onHome).toHaveBeenCalledTimes(1)
  })

  /* ── easter egg ──────────────────────────────────────────────── */
  it('shows easter egg when all scores are 0 in multiplayer', () => {
    render(
      <RoomScoreboard
        {...createProps({
          roomMode: 'multi_public',
          scoreboard: [
            scoreboardEntry('p1', { nickname: 'Alice', score: 0 }),
            scoreboardEntry('p2', { nickname: 'Bob', score: 0 }),
          ],
        })}
      />,
    )
    expect(screen.getByText('room.easter_egg')).toBeInTheDocument()
  })

  it('hides easter egg in solo mode even when all scores are 0', () => {
    render(
      <RoomScoreboard
        {...createProps({
          roomMode: 'solo',
          scoreboard: [
            scoreboardEntry('p1', { nickname: 'Alice', score: 0 }),
          ],
        })}
      />,
    )
    expect(
      screen.queryByText('room.easter_egg'),
    ).not.toBeInTheDocument()
  })

  it('hides easter egg when not all scores are 0', () => {
    render(
      <RoomScoreboard
        {...createProps({
          roomMode: 'multi_public',
          scoreboard: [
            scoreboardEntry('p1', { nickname: 'Alice', score: 10 }),
            scoreboardEntry('p2', { nickname: 'Bob', score: 0 }),
          ],
        })}
      />,
    )
    expect(
      screen.queryByText('room.easter_egg'),
    ).not.toBeInTheDocument()
  })

  /* ── edge cases ──────────────────────────────────────────────── */
  it('handles empty scoreboard', () => {
    render(<RoomScoreboard {...createProps({ scoreboard: [] })} />)
    expect(screen.getByText('room.game_over')).toBeInTheDocument()
    // No player rows, just heading and home button
    expect(screen.getByText('room.home')).toBeInTheDocument()
  })

  it('handles single player scoreboard', () => {
    render(
      <RoomScoreboard
        {...createProps({
          scoreboard: [
            scoreboardEntry('p1', { nickname: 'Alice', score: 50 }),
          ],
        })}
      />,
    )
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('🥇')).toBeInTheDocument()
  })
})
