import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import Card from "../ui/Card";
import type { RoomInfo, Phase } from "../../lib/useRoomGameTypes";

interface RoomPreGameProps {
  room: RoomInfo;
  phase: Phase;
  nickname: string;
  setNickname: (n: string) => void;
  playerId: string | null;
  joined: boolean;
  joining: boolean;
  soloStarting: boolean;
  creatorPid: string | null;
  handleJoin: () => void;
  handleStart: () => void;
  handleSoloStart: () => void;
  error?: string;
}

export default function RoomPreGame({
  room,
  nickname,
  setNickname,
  playerId,
  joined,
  joining,
  soloStarting,
  creatorPid,
  handleJoin,
  handleStart,
  handleSoloStart,
}: RoomPreGameProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const { user } = useAuth();

  const roomCode =
    room?.code || (location.state as { code?: string } | null)?.code || "";
  const shareUrl = `${window.location.origin}/?code=${room?.code ?? ""}`;

  return (
    <div className="text-center space-y-6 mt-4 animate-fade-in-up">
      <div className="inline-block">
        <h1 className="font-display text-5xl sm:text-6xl text-tv-red dark:text-tv-gold uppercase tracking-wide mb-2">
          {room.mode === "solo" ? t("room.solo_title") : t("room.title")}
        </h1>
        <div className="h-1 w-full bg-gradient-to-r from-tv-gold via-tv-red to-tv-purple rounded-full" />
      </div>

      {room.mode !== "solo" && (
        <div className="inline-block bg-gray-900 dark:bg-gray-800 text-tv-gold font-display text-4xl sm:text-5xl tracking-[0.5em] px-8 py-4 rounded-2xl shadow-2xl border-2 border-tv-gold animate-pulse-glow">
          {roomCode}
        </div>
      )}

      <div className="flex justify-center gap-6 text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        <span className="px-3 py-1 rounded-full bg-white/60 dark:bg-gray-800/60 border border-rose-200 dark:border-rose-900/50">
          {t("room.mode")}{" "}
          <span className="text-tv-red dark:text-tv-gold">{room.mode}</span>
        </span>
        <span className="px-3 py-1 rounded-full bg-white/60 dark:bg-gray-800/60 border border-rose-200 dark:border-rose-900/50">
          {t("room.timer")}{" "}
          <span className="text-tv-red dark:text-tv-gold">{room.timer}s</span>
        </span>
      </div>

      {room.mode !== "solo" && creatorPid && (
        <Card className="rounded-2xl p-4 text-sm max-w-md mx-auto">
          <p className="text-gray-600 dark:text-gray-400 mb-2 font-medium">
            {t("room.share")}
          </p>
          <div className="flex items-stretch gap-2">
            <code className="flex-1 bg-rose-50 dark:bg-gray-900 px-3 py-2 rounded-xl border border-rose-200 dark:border-gray-700 text-tv-red dark:text-tv-gold break-all text-xs font-mono select-all flex items-center">
              {shareUrl}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(shareUrl);
              }}
              className="px-3 py-2 rounded-xl bg-tv-gold/20 hover:bg-tv-gold/30 text-tv-purple dark:text-tv-gold font-bold text-xs uppercase tracking-wider transition-colors border border-tv-gold/30 shrink-0 cursor-pointer"
              title={t("room.copy_link")}
            >
              {t("room.copy_link")}
            </button>
          </div>
        </Card>
      )}

      {room.mode !== "solo" && (
        <div>
          <p className="text-sm font-bold text-gray-600 dark:text-gray-400 mb-3 uppercase tracking-wider">
            {t("room.players")}{" "}
            <span className="text-tv-red dark:text-tv-gold">
              {room.player_count}
            </span>
          </p>
          {room.players.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {room.players.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-white dark:bg-gray-900 rounded-full border border-rose-200 dark:border-gray-700 text-sm font-medium shadow-sm"
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${p.disconnected ? "bg-gray-400" : "bg-emerald-500 animate-pulse"}`}
                  />
                  {p.nickname}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {room.mode === "solo" ? (
        <Card className="rounded-2xl p-6 max-w-sm mx-auto space-y-4">
          <button
            onClick={handleSoloStart}
            disabled={soloStarting}
            className="buzzer-btn w-full px-8 py-4 rounded-2xl bg-gradient-to-r from-tv-red to-tv-red-dark text-white font-bold text-lg uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-lg"
          >
            {soloStarting ? t("common.loading") : t("room.solo_start")}
          </button>
        </Card>
      ) : !joined ? (
        <Card className="rounded-2xl p-6 max-w-sm mx-auto space-y-4">
          {!user && (
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t("room.nickname")}
              maxLength={50}
              className="block w-full rounded-xl border-2 border-rose-200 dark:border-rose-900/50 px-4 py-3 text-sm text-center dark:bg-gray-800 dark:text-gray-100 focus:border-tv-gold focus:outline-none"
            />
          )}
          <button
            onClick={handleJoin}
            disabled={!nickname.trim() || joining}
            className="buzzer-btn w-full px-6 py-3 rounded-2xl bg-tv-gold text-tv-purple font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-lg"
          >
            {joining ? t("common.loading") : t("room.join_btn")}
          </button>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 rounded-full text-emerald-700 dark:text-emerald-300 text-sm font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            {t("room.joined_as")} <strong>{nickname}</strong>
          </div>
          {playerId === creatorPid ? (
            <div className="space-y-3">
              <button
                onClick={handleStart}
                disabled={room.mode !== "solo" && room.player_count < 2}
                className="buzzer-btn px-10 py-4 rounded-2xl bg-gradient-to-r from-tv-red to-tv-purple text-white font-bold text-lg uppercase tracking-wider shadow-lg hover:shadow-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {t("room.start")}
              </button>
              {room.mode !== "solo" && room.player_count < 2 && (
                <p className="text-sm text-amber-600 dark:text-amber-400 font-medium animate-fade-in">
                  {t("room.waiting_for_players")}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              {t("room.waiting_for_host")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
