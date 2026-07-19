import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { ScoreboardEntry } from "../../lib/useRoomGameTypes";

interface RoomScoreboardProps {
  scoreboard: ScoreboardEntry[];
  roomMode: string;
  creatorPid: string | null;
  playerId: string | null;
  isReplaying: boolean;
  onPlayAgain: () => void;
  onHome: () => void;
}

export default function RoomScoreboard({
  scoreboard,
  roomMode,
  creatorPid,
  playerId,
  isReplaying,
  onPlayAgain,
  onHome,
}: RoomScoreboardProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 mt-4 text-center animate-fade-in-up">
      <div className="inline-block">
        <h2 className="font-display text-5xl sm:text-6xl text-tv-red dark:text-tv-gold uppercase tracking-wide mb-2 animate-bounce-in">
          {t("room.game_over")}
        </h2>
        <div className="h-1 w-full bg-gradient-to-r from-tv-gold via-tv-red to-tv-purple rounded-full" />
      </div>

      <div className="tv-card rounded-3xl border-2 border-tv-gold/50 shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-tv-gold/20 to-tv-red/20 dark:from-tv-gold/10 dark:to-tv-red/10 p-4 border-b border-tv-gold/30">
          <div className="flex justify-center gap-12 text-sm font-bold uppercase tracking-wider text-tv-purple dark:text-tv-gold">
            <span>{t("room.player_col")}</span>
            <span>{t("room.score")}</span>
            <span>{t("room.time")}</span>
          </div>
        </div>
        <div className="divide-y divide-rose-100 dark:divide-gray-800">
          {scoreboard.map((s, i) => (
            <div
              key={s.player_id}
              className={`flex items-center justify-between px-6 py-4 animate-fade-in-up ${i === 0 ? "bg-gradient-to-r from-tv-gold/20 to-transparent" : ""}`}
              style={{ animationDelay: `${i * 0.12}s` }}
            >
              <div className="flex items-center gap-3 w-1/3">
                <span
                  className="animate-bounce-in inline-block text-2xl"
                  style={{ animationDelay: `${i * 0.12 + 0.2}s` }}
                >
                  {i === 0
                    ? "🥇"
                    : i === 1
                      ? "🥈"
                      : i === 2
                        ? "🥉"
                        : `#${i + 1}`}
                </span>
                <span className="font-bold text-gray-900 dark:text-gray-100 truncate">
                  {s.nickname}
                </span>
              </div>
              <span className="w-1/3 text-center font-display text-2xl text-tv-red dark:text-tv-gold">
                {s.score}
              </span>
              <span className="w-1/3 text-right text-gray-500 dark:text-gray-400 font-medium">
                {s.cumulative_time.toFixed(1)}s
              </span>
            </div>
          ))}
        </div>
      </div>

      {roomMode !== "solo" &&
        scoreboard.length > 0 &&
        scoreboard.every((s) => s.score === 0) && (
          <div className="animate-fade-in-up rounded-2xl p-6 bg-tv-purple/10 dark:bg-tv-purple/20 border-2 border-tv-purple/30 dark:border-tv-purple/50 text-tv-purple dark:text-tv-gold">
            <p className="text-3xl mb-2">🤝</p>
            <p className="font-display text-xl uppercase tracking-wide">
              {t("room.easter_egg")}
            </p>
          </div>
        )}

      <div className="flex gap-3 justify-center">
        {(roomMode === "solo" || creatorPid === playerId) && (
          <button
            onClick={onPlayAgain}
            disabled={isReplaying}
            className="buzzer-btn px-8 py-3 rounded-2xl bg-gradient-to-r from-tv-red to-tv-red-dark text-white font-bold uppercase tracking-wider hover:shadow-lg disabled:opacity-50 cursor-pointer"
          >
            {isReplaying ? t("common.loading") : t("room.play_again")}
          </button>
        )}
        <button
          onClick={onHome}
          className="buzzer-btn px-8 py-3 rounded-2xl bg-tv-gold text-tv-purple font-bold uppercase tracking-wider hover:bg-tv-gold-dark cursor-pointer"
        >
          {t("room.home")}
        </button>
      </div>
    </div>
  );
}
