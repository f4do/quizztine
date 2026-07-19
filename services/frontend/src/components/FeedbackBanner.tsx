import { useTranslation } from "react-i18next";

export interface FeedbackBannerProps {
  correct: boolean;
  points: number;
  bonus: number;
  streak: number;
  countdown: number;
  onlyCorrect?: boolean;
  firstCorrect?: boolean;
  onlyWrong?: boolean;
  className?: string;
}

export default function FeedbackBanner({
  correct,
  points,
  bonus,
  streak,
  countdown,
  onlyCorrect = false,
  firstCorrect = false,
  onlyWrong = false,
  className = "",
}: FeedbackBannerProps) {
  const { t } = useTranslation();

  const isCorrect = correct;
  const containerClass = isCorrect
    ? "bg-gradient-to-r from-tv-gold to-amber-400 border-b-tv-gold/50 text-tv-purple"
    : "bg-gradient-to-r from-tv-red to-tv-purple border-b-white/20 text-white";

  return (
    <div
      className={`relative rounded-t-3xl shadow-2xl overflow-hidden animate-feedback-slide-in ${containerClass} ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-3 py-2 sm:px-6 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="flex items-center justify-center w-9 h-9 rounded-full bg-white/20 text-lg sm:text-xl shadow-sm backdrop-blur-sm">
            {isCorrect ? "✓" : "✗"}
          </span>
          <div>
            <p className="font-display text-xl sm:text-2xl uppercase tracking-wide leading-none">
              {isCorrect ? t("room.correct") : t("room.wrong")}
            </p>
            <p className="text-xs font-semibold opacity-90">
              {isCorrect
                ? onlyCorrect
                  ? t("christine.feedback.only_correct")
                  : firstCorrect
                    ? t("christine.feedback.first_correct")
                    : `${t("room.points")}${points}`
                : onlyWrong
                  ? t("christine.feedback.only_wrong")
                  : `${t("room.points")}${points}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm font-bold">
          <div className="flex flex-col items-center leading-tight">
            <span className="font-display text-lg sm:text-xl">{points}</span>
            <span className="text-[10px] uppercase tracking-wider opacity-90">
              {t("room.points")}
            </span>
          </div>

          {bonus > 0 && (
            <div className="flex flex-col items-center leading-tight">
              <span className="font-display text-lg sm:text-xl text-tv-gold">
                +{bonus}
              </span>
              <span className="text-[10px] uppercase tracking-wider opacity-90">
                {t("room.bonus")}
              </span>
            </div>
          )}

          {streak > 0 && (
            <div className="flex flex-col items-center leading-tight">
              <span className="font-display text-lg sm:text-xl">{streak}</span>
              <span className="text-[10px] uppercase tracking-wider opacity-90">
                {t("room.streak")}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
