import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../../../test/utils";
import RoomReady from "../RoomReady";

vi.mock("react-i18next", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-i18next")>();
  return {
    ...mod,
    useTranslation: () => ({ t: (key: string) => key }),
  };
});

function createProps(overrides: Record<string, unknown> = {}) {
  return {
    room: {
      id: "room-1",
      code: "ABC123",
      mode: "multi_public",
      timer: 30,
      status: "waiting",
      player_count: 3,
      total_questions: 10,
      players: [
        {
          id: "p1",
          nickname: "Alice",
          score: 0,
          finished: false,
          disconnected: false,
        },
        {
          id: "p2",
          nickname: "Bob",
          score: 0,
          finished: false,
          disconnected: false,
        },
        {
          id: "p3",
          nickname: "Charlie",
          score: 0,
          finished: false,
          disconnected: false,
        },
      ],
    },
    readyPlayers: new Set<string>(),
    isReady: false,
    creatorPid: "p1",
    playerId: "p1",
    onToggleReady: vi.fn(),
    onStart: vi.fn(),
    onHome: vi.fn(),
    ...overrides,
  };
}

describe("RoomReady", () => {
  /* ── heading ─────────────────────────────────────────────────── */
  it("shows the ready title heading", () => {
    render(<RoomReady {...createProps()} />);
    expect(screen.getByText("room.ready.title")).toBeInTheDocument();
  });

  /* ── player list ─────────────────────────────────────────────── */
  it("shows all player nicknames", () => {
    render(<RoomReady {...createProps()} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
  });

  it("shows ready status for ready players", () => {
    render(
      <RoomReady
        {...createProps({
          readyPlayers: new Set(["p1", "p3"]),
        })}
      />,
    );
    // p1 and p3 are ready → they show "room.ready.ready"
    const readyLabels = screen.getAllByText("room.ready.ready");
    expect(readyLabels).toHaveLength(2);
  });

  it("shows not_ready status for non-ready players", () => {
    render(
      <RoomReady
        {...createProps({
          readyPlayers: new Set(["p1"]),
        })}
      />,
    );
    // p2 and p3 are not ready
    const notReadyLabels = screen.getAllByText("room.ready.not_ready");
    expect(notReadyLabels).toHaveLength(2);
  });

  it("handles null room gracefully (no player list)", () => {
    render(<RoomReady {...createProps({ room: null })} />);
    expect(screen.getByText("room.ready.title")).toBeInTheDocument();
    // No player list should render
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  });

  /* ── creator view ────────────────────────────────────────────── */
  it("shows start button for creator", () => {
    render(
      <RoomReady
        {...createProps({
          creatorPid: "p1",
          playerId: "p1",
          readyPlayers: new Set(["p1", "p2", "p3"]),
        })}
      />,
    );
    // All ready → shows "room.start"
    expect(screen.getByText("room.start")).toBeInTheDocument();
  });

  it("shows toggle ready button for creator", () => {
    render(
      <RoomReady
        {...createProps({
          creatorPid: "p1",
          playerId: "p1",
        })}
      />,
    );
    expect(screen.getByText("room.ready.ready_btn")).toBeInTheDocument();
  });

  it("start button is disabled when not all players are ready", () => {
    render(
      <RoomReady
        {...createProps({
          creatorPid: "p1",
          playerId: "p1",
          readyPlayers: new Set(["p1"]),
        })}
      />,
    );
    const startBtn = screen.getByText("room.ready.waiting");
    expect(startBtn).toBeDisabled();
  });

  it("start button is enabled when all players are ready", () => {
    render(
      <RoomReady
        {...createProps({
          creatorPid: "p1",
          playerId: "p1",
          readyPlayers: new Set(["p1", "p2", "p3"]),
        })}
      />,
    );
    const startBtn = screen.getByText("room.start");
    expect(startBtn).toBeEnabled();
  });

  it("toggle ready button changes text when isReady", () => {
    render(
      <RoomReady
        {...createProps({
          creatorPid: "p1",
          playerId: "p1",
          isReady: true,
        })}
      />,
    );
    expect(screen.getByText("room.ready.not_ready_btn")).toBeInTheDocument();
  });

  it("calls onStart when start button is clicked", async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();
    render(
      <RoomReady
        {...createProps({
          creatorPid: "p1",
          playerId: "p1",
          readyPlayers: new Set(["p1", "p2", "p3"]),
          onStart,
        })}
      />,
    );
    await user.click(screen.getByText("room.start"));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  /* ── non-creator view ────────────────────────────────────────── */
  it("shows toggle ready button for non-creator", () => {
    render(
      <RoomReady
        {...createProps({
          creatorPid: "p1",
          playerId: "p2",
        })}
      />,
    );
    expect(screen.getByText("room.ready.ready_btn")).toBeInTheDocument();
  });

  it("does NOT show start button for non-creator", () => {
    render(
      <RoomReady
        {...createProps({
          creatorPid: "p1",
          playerId: "p2",
        })}
      />,
    );
    expect(screen.queryByText("room.start")).not.toBeInTheDocument();
    expect(screen.queryByText("room.ready.waiting")).not.toBeInTheDocument();
  });

  /* ── interactions ────────────────────────────────────────────── */
  it("calls onToggleReady when toggle ready button is clicked", async () => {
    const onToggleReady = vi.fn();
    const user = userEvent.setup();
    render(
      <RoomReady
        {...createProps({
          creatorPid: "p1",
          playerId: "p1",
          onToggleReady,
        })}
      />,
    );
    await user.click(screen.getByText("room.ready.ready_btn"));
    expect(onToggleReady).toHaveBeenCalledTimes(1);
  });

  it("calls onHome when home button is clicked", async () => {
    const onHome = vi.fn();
    const user = userEvent.setup();
    render(<RoomReady {...createProps({ onHome })} />);
    await user.click(screen.getByText("room.home"));
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  /* ── home button always visible ──────────────────────────────── */
  it("shows home button for all players", () => {
    render(<RoomReady {...createProps()} />);
    expect(screen.getByText("room.home")).toBeInTheDocument();
  });
});
