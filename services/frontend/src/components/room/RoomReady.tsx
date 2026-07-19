import { useTranslation } from "react-i18next";
import type { RoomInfo } from "../../lib/useRoomGameTypes";

interface RoomReadyProps {
  room: RoomInfo | null;
  readyPlayers: Set<string>;
  isReady: boolean;
  creatorPid: string | null;
  playerId: string | null;
  onToggleReady: () => void;
  onStart: () => void;
  onHome: () => void;
}

export default function RoomReady({
  room,
  readyPlayers,
  isReady,
  creatorPid,
  playerId,
  onToggleReady,
  onStart,
  onHome,
}: RoomReadyProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 mt-4 text-center animate-fade-in-up">
      <div className="inline-block">
        <h2 className="font-display text-4xl sm:text-5xl text-tv-red dark:text-tv-gold uppercase tracking-wide mb-2">
          {t("room.ready.title")}
        </h2>
        <div className="h-1 w-full bg-gradient-to-r from-tv-gold via-tv-red to-tv-purple rounded-full" />
      </div>

      <div className="tv-card rounded-3xl border-2 border-tv-gold/50 shadow-2xl overflow-hidden max-w-md mx-auto">
        <div className="divide-y divide-rose-100 dark:divide-gray-800">
          {room?.players.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between px-6 py-4"
            >
              <span className="font-bold text-gray-900 dark:text-gray-100">
                {p.nickname}
              </span>
              <span className="text-sm font-bold">
                {readyPlayers.has(p.id) ? (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {t("room.ready.ready")}
                  </span>
                ) : (
                  <span className="text-gray-400">
                    {t("room.ready.not_ready")}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 justify-center">
        {creatorPid === playerId ? (
          <>
            <button
              onClick={onToggleReady}
              className={`buzzer-btn px-6 py-3 rounded-2xl font-bold uppercase tracking-wider cursor-pointer transition-all ${
                isReady
                  ? "bg-emerald-600 text-white"
                  : "bg-tv-gold text-tv-purple"
              }`}
            >
              {isReady
                ? t("room.ready.not_ready_btn")
                : t("room.ready.ready_btn")}
            </button>
            <button
              onClick={onStart}
              disabled={readyPlayers.size !== room?.players.length}
              className="buzzer-btn px-8 py-3 rounded-2xl bg-gradient-to-r from-tv-red to-tv-red-dark text-white font-bold uppercase tracking-wider hover:shadow-lg disabled:opacity-50 cursor-pointer"
            >
              {readyPlayers.size === room?.players.length
                ? t("room.start")
                : t("room.ready.waiting", {
                    count: readyPlayers.size,
                    total: room?.players.length ?? 0,
                  })}
            </button>
          </>
        ) : (
          <button
            onClick={onToggleReady}
            className={`buzzer-btn px-8 py-3 rounded-2xl font-bold uppercase tracking-wider cursor-pointer transition-all ${
              isReady
                ? "bg-emerald-600 text-white"
                : "bg-tv-gold text-tv-purple"
            }`}
          >
            {isReady
              ? t("room.ready.not_ready_btn")
              : t("room.ready.ready_btn")}
          </button>
        )}
        <button
          onClick={onHome}
          className="buzzer-btn px-8 py-3 rounded-2xl bg-gray-500 text-white font-bold uppercase tracking-wider hover:bg-gray-600 cursor-pointer"
        >
          {t("room.home")}
        </button>
      </div>
    </div>
  );
}
