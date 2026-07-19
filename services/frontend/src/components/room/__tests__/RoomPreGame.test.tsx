import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../../../test/utils'
import RoomPreGame from '../RoomPreGame'

// Override only the hooks we need; keep the rest of the module intact
// so I18nextProvider / AuthProvider in the wrapper still work.
vi.mock('react-i18next', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-i18next')>()
  return {
    ...mod,
    useTranslation: () => ({ t: (key: string) => key }),
  }
})

vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...mod,
    useLocation: () => ({ state: null }),
  }
})

function createProps(overrides: Record<string, unknown> = {}) {
  return {
    room: {
      id: 'room-1',
      code: 'ABC123',
      mode: 'multi_public',
      timer: 30,
      status: 'waiting',
      player_count: 1,
      total_questions: 10,
      players: [
        {
          id: 'p1',
          nickname: 'Alice',
          score: 0,
          finished: false,
          disconnected: false,
        },
      ],
    },
    phase: 'pre-game',
    nickname: '',
    setNickname: vi.fn(),
    playerId: null,
    joined: false,
    joining: false,
    soloStarting: false,
    creatorPid: null,
    handleJoin: vi.fn(),
    handleStart: vi.fn(),
    handleSoloStart: vi.fn(),
    ...overrides,
  }
}

describe('RoomPreGame', () => {
  /* ── solo mode ───────────────────────────────────────────────── */
  it('shows solo start button and calls handleSoloStart on click', async () => {
    const handleSoloStart = vi.fn()
    const user = userEvent.setup()
    render(
      <RoomPreGame
        {...createProps({
          room: {
            id: 'room-solo',
            code: undefined,
            mode: 'solo',
            timer: 30,
            status: 'waiting',
            player_count: 0,
            total_questions: 10,
            players: [],
          },
          handleSoloStart,
        })}
      />,
    )
    expect(screen.getByText('room.solo_start')).toBeInTheDocument()
    await user.click(screen.getByText('room.solo_start'))
    expect(handleSoloStart).toHaveBeenCalledTimes(1)
  })

  it('disables solo start button while soloStarting', () => {
    render(
      <RoomPreGame
        {...createProps({
          room: {
            id: 'room-solo',
            code: undefined,
            mode: 'solo',
            timer: 30,
            status: 'waiting',
            player_count: 0,
            total_questions: 10,
            players: [],
          },
          soloStarting: true,
        })}
      />,
    )
    expect(screen.getByText('common.loading')).toBeDisabled()
  })

  it('shows solo title in solo mode', () => {
    render(
      <RoomPreGame
        {...createProps({
          room: {
            id: 'room-solo',
            code: undefined,
            mode: 'solo',
            timer: 30,
            status: 'waiting',
            player_count: 0,
            total_questions: 10,
            players: [],
          },
        })}
      />,
    )
    expect(screen.getByText('room.solo_title')).toBeInTheDocument()
  })

  /* ── multiplayer room code ───────────────────────────────────── */
  it('shows room code in multiplayer mode', () => {
    render(<RoomPreGame {...createProps()} />)
    expect(screen.getByText('ABC123')).toBeInTheDocument()
  })

  it('does not show room code in solo mode', () => {
    render(
      <RoomPreGame
        {...createProps({
          room: {
            id: 'room-solo',
            code: 'ABC123',
            mode: 'solo',
            timer: 30,
            status: 'waiting',
            player_count: 0,
            total_questions: 10,
            players: [],
          },
        })}
      />,
    )
    expect(screen.queryByText('ABC123')).not.toBeInTheDocument()
  })

  /* ── mode / timer badges ─────────────────────────────────────── */
  it('shows mode badge', () => {
    render(<RoomPreGame {...createProps()} />)
    expect(screen.getByText('room.mode')).toBeInTheDocument()
    expect(screen.getByText('multi_public')).toBeInTheDocument()
  })

  it('shows timer badge', () => {
    render(<RoomPreGame {...createProps()} />)
    expect(screen.getByText('room.timer')).toBeInTheDocument()
    expect(screen.getByText('30s')).toBeInTheDocument()
  })

  /* ── multiplayer: not joined (join form) ─────────────────────── */
  it('shows join button when not joined', () => {
    render(
      <RoomPreGame
        {...createProps({
          joined: false,
          playerId: null,
          nickname: 'Bob',
        })}
      />,
    )
    expect(screen.getByText('room.join_btn')).toBeInTheDocument()
  })

  it('shows nickname input for non-auth users when not joined', () => {
    render(
      <RoomPreGame
        {...createProps({
          joined: false,
          playerId: null,
          nickname: '',
        })}
      />,
    )
    expect(
      screen.getByPlaceholderText('room.nickname'),
    ).toBeInTheDocument()
  })

  it('calls handleJoin when join button is clicked', async () => {
    const handleJoin = vi.fn()
    const user = userEvent.setup()
    render(
      <RoomPreGame
        {...createProps({
          joined: false,
          playerId: null,
          nickname: 'Bob',
          handleJoin,
        })}
      />,
    )
    await user.click(screen.getByText('room.join_btn'))
    expect(handleJoin).toHaveBeenCalledTimes(1)
  })

  it('disables join button when nickname is empty', () => {
    render(
      <RoomPreGame
        {...createProps({
          joined: false,
          playerId: null,
          nickname: '',
        })}
      />,
    )
    expect(screen.getByText('room.join_btn')).toBeDisabled()
  })

  it('disables join button while joining', () => {
    render(
      <RoomPreGame
        {...createProps({
          joined: false,
          joining: true,
          nickname: 'Bob',
        })}
      />,
    )
    expect(screen.getByText('common.loading')).toBeDisabled()
  })

  /* ── multiplayer: joined as creator ──────────────────────────── */
  it('shows start button for creator when joined', () => {
    render(
      <RoomPreGame
        {...createProps({
          joined: true,
          playerId: 'p1',
          creatorPid: 'p1',
          nickname: 'Alice',
          room: {
            id: 'room-1',
            code: 'ABC123',
            mode: 'multi_public',
            timer: 30,
            status: 'waiting',
            player_count: 2,
            total_questions: 10,
            players: [
              { id: 'p1', nickname: 'Alice', score: 0, finished: false, disconnected: false },
              { id: 'p2', nickname: 'Bob', score: 0, finished: false, disconnected: false },
            ],
          },
        })}
      />,
    )
    expect(screen.getByText('room.start')).toBeInTheDocument()
  })

  it('shows share link for creator when joined', () => {
    render(
      <RoomPreGame
        {...createProps({
          joined: true,
          playerId: 'p1',
          creatorPid: 'p1',
        })}
      />,
    )
    expect(screen.getByText('room.share')).toBeInTheDocument()
    expect(screen.getByText('room.copy_link')).toBeInTheDocument()
  })

  it('disables start button when only 1 player in multiplayer', () => {
    render(
      <RoomPreGame
        {...createProps({
          joined: true,
          playerId: 'p1',
          creatorPid: 'p1',
          room: {
            id: 'room-1',
            code: 'ABC123',
            mode: 'multi_public',
            timer: 30,
            status: 'waiting',
            player_count: 1,
            total_questions: 10,
            players: [
              { id: 'p1', nickname: 'Alice', score: 0, finished: false, disconnected: false },
            ],
          },
        })}
      />,
    )
    expect(screen.getByText('room.start')).toBeDisabled()
  })

  it('shows waiting_for_players hint when only 1 player', () => {
    render(
      <RoomPreGame
        {...createProps({
          joined: true,
          playerId: 'p1',
          creatorPid: 'p1',
          room: {
            id: 'room-1',
            code: 'ABC123',
            mode: 'multi_public',
            timer: 30,
            status: 'waiting',
            player_count: 1,
            total_questions: 10,
            players: [
              { id: 'p1', nickname: 'Alice', score: 0, finished: false, disconnected: false },
            ],
          },
        })}
      />,
    )
    expect(screen.getByText('room.waiting_for_players')).toBeInTheDocument()
  })

  it('calls handleStart when start button is clicked', async () => {
    const handleStart = vi.fn()
    const user = userEvent.setup()
    render(
      <RoomPreGame
        {...createProps({
          joined: true,
          playerId: 'p1',
          creatorPid: 'p1',
          nickname: 'Alice',
          handleStart,
          room: {
            id: 'room-1',
            code: 'ABC123',
            mode: 'multi_public',
            timer: 30,
            status: 'waiting',
            player_count: 2,
            total_questions: 10,
            players: [
              { id: 'p1', nickname: 'Alice', score: 0, finished: false, disconnected: false },
              { id: 'p2', nickname: 'Bob', score: 0, finished: false, disconnected: false },
            ],
          },
        })}
      />,
    )
    await user.click(screen.getByText('room.start'))
    expect(handleStart).toHaveBeenCalledTimes(1)
  })

  /* ── multiplayer: joined as non-creator ──────────────────────── */
  it('shows waiting_for_host for non-creator when joined', () => {
    render(
      <RoomPreGame
        {...createProps({
          joined: true,
          playerId: 'p2',
          creatorPid: 'p1', // creator is p1, not p2
          nickname: 'Bob',
          room: {
            id: 'room-1',
            code: 'ABC123',
            mode: 'multi_public',
            timer: 30,
            status: 'waiting',
            player_count: 2,
            total_questions: 10,
            players: [
              { id: 'p1', nickname: 'Alice', score: 0, finished: false, disconnected: false },
              { id: 'p2', nickname: 'Bob', score: 0, finished: false, disconnected: false },
            ],
          },
        })}
      />,
    )
    expect(screen.getByText('room.waiting_for_host')).toBeInTheDocument()
    // Non-creator should NOT see the start button
    expect(screen.queryByText('room.start')).not.toBeInTheDocument()
  })

  it('shows joined_as badge for joined players', () => {
    render(
      <RoomPreGame
        {...createProps({
          joined: true,
          playerId: 'p1',
          creatorPid: 'p1',
          nickname: 'Alice',
        })}
      />,
    )
    expect(screen.getByText('room.joined_as')).toBeInTheDocument()
    // Alice appears in both the player list badge and the joined_as badge
    expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(2)
  })

  /* ── player list ─────────────────────────────────────────────── */
  it('shows player list with nicknames', () => {
    render(
      <RoomPreGame
        {...createProps({
          room: {
            id: 'room-1',
            code: 'ABC123',
            mode: 'multi_public',
            timer: 30,
            status: 'waiting',
            player_count: 2,
            total_questions: 10,
            players: [
              { id: 'p1', nickname: 'Alice', score: 0, finished: false, disconnected: false },
              { id: 'p2', nickname: 'Bob', score: 0, finished: false, disconnected: true },
            ],
          },
        })}
      />,
    )
    expect(screen.getByText('room.players')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('shows disconnected indicator for disconnected players', () => {
    render(
      <RoomPreGame
        {...createProps({
          room: {
            id: 'room-1',
            code: 'ABC123',
            mode: 'multi_public',
            timer: 30,
            status: 'waiting',
            player_count: 2,
            total_questions: 10,
            players: [
              { id: 'p1', nickname: 'Alice', score: 0, finished: false, disconnected: false },
              { id: 'p2', nickname: 'Bob', score: 0, finished: false, disconnected: true },
            ],
          },
        })}
      />,
    )
    // The disconnected indicator is a grey dot: we check that Bob's
    // parent span contains bg-gray-400 (and not bg-emerald-500).
    const bobBadge = screen
      .getByText('Bob')
      .closest('span') as HTMLSpanElement
    expect(bobBadge.querySelector('.bg-gray-400')).toBeInTheDocument()
    expect(bobBadge.querySelector('.bg-emerald-500')).toBeNull()
  })

  it('shows green dot for connected players', () => {
    render(
      <RoomPreGame
        {...createProps({
          room: {
            id: 'room-1',
            code: 'ABC123',
            mode: 'multi_public',
            timer: 30,
            status: 'waiting',
            player_count: 1,
            total_questions: 10,
            players: [
              { id: 'p1', nickname: 'Alice', score: 0, finished: false, disconnected: false },
            ],
          },
        })}
      />,
    )
    const aliceBadge = screen
      .getByText('Alice')
      .closest('span') as HTMLSpanElement
    expect(
      aliceBadge.querySelector('.bg-emerald-500'),
    ).toBeInTheDocument()
  })

  /* ── multiplayer title ───────────────────────────────────────── */
  it('shows multiplayer title when mode is not solo', () => {
    render(<RoomPreGame {...createProps()} />)
    expect(screen.getByText('room.title')).toBeInTheDocument()
  })
})
