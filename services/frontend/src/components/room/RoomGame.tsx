import { useTranslation } from "react-i18next";
import CircularTimer from "../CircularTimer";
import FeedbackBanner from "../FeedbackBanner";
import Card from "../ui/Card";
import type {
  AnswerResult,
  FeedbackMeta,
  Phase,
} from "../../lib/useRoomGameTypes";

interface RoomGameProps {
  phase: Phase;
  questionId: number;
  questionIndex: number;
  totalQuestions: number;
  questionText: string;
  questionChoices: { text: string }[];
  questionMediaUrl: string | null;
  questionMediaType: string | null;
  questionExplanation: string | null;
  questionSourceUrl: string | null;
  selectedChoices: number[];
  choiceCorrect: boolean[];
  hasAnswered: boolean;
  isFeedback: boolean;
  feedbackCountdown: number;
  timeLeft: number;
  timer: number;
  result: AnswerResult | null;
  feedbackMeta: FeedbackMeta;
  answeredCount: number;
  totalActive: number;
  roomMode: string;
  handleChoice: (idx: number) => void;
  handleAnswerSubmit: () => void;
  getChoiceStyle: (
    idx: number,
    selected: number[],
    correct: boolean[],
  ) => string;
}

export default function RoomGame({
  questionId,
  questionIndex,
  totalQuestions,
  questionText,
  questionChoices,
  questionMediaUrl,
  questionMediaType,
  questionExplanation,
  questionSourceUrl,
  selectedChoices,
  choiceCorrect,
  hasAnswered,
  isFeedback,
  feedbackCountdown,
  timeLeft,
  timer,
  result,
  feedbackMeta,
  answeredCount,
  totalActive,
  roomMode,
  handleChoice,
  handleAnswerSubmit,
  getChoiceStyle,
}: RoomGameProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full bg-tv-purple text-white text-xs font-bold uppercase tracking-wider">
            {t("room.question")} {questionIndex + 1}
          </span>
          {roomMode !== "solo" && !isFeedback && (
            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              {hasAnswered
                ? t("room.waiting_for_answers")
                : t("room.players_answered", {
                    count: answeredCount,
                    total: totalActive,
                  })}
            </span>
          )}
        </div>
        <div className="flex flex-col items-center gap-0">
          <CircularTimer
            timeLeft={isFeedback ? feedbackCountdown : timeLeft}
            total={isFeedback ? 5 : timer}
            size={52}
            strokeWidth={5}
            warningThreshold={isFeedback ? 3 : 10}
            dangerThreshold={isFeedback ? 1 : 5}
          />
          <span className="w-[52px] inline-block text-center text-[9px] font-bold uppercase tracking-widest leading-tight text-gray-500 dark:text-gray-400">
            {isFeedback
              ? questionIndex + 1 >= totalQuestions
                ? t("room.timer_results")
                : t("room.timer_next")
              : t("room.timer_answer")}
          </span>
        </div>
      </div>

      <div className="space-y-6 mt-2 animate-question-in">
        <Card className="rounded-3xl p-6 sm:p-8 tv-stage-light min-h-[420px]">
          {isFeedback && result && (
            <FeedbackBanner
              correct={result.correct}
              points={result.points}
              bonus={result.bonus}
              streak={result.streak}
              countdown={feedbackCountdown}
              onlyCorrect={feedbackMeta.onlyCorrect}
              firstCorrect={feedbackMeta.firstCorrect}
              onlyWrong={feedbackMeta.onlyWrong}
              className="-mx-6 -mt-6 sm:-mx-8 sm:-mt-8 mb-5"
            />
          )}
          <div
            className={`transition-opacity duration-300 ${isFeedback ? "opacity-95" : "opacity-100"}`}
          >
            <p className="text-xl sm:text-2xl text-center text-gray-900 dark:text-gray-100 font-bold mb-6 leading-relaxed">
              {questionText || t("room.loading_question")}
            </p>

            {questionMediaUrl && questionMediaType === "image" && (
              <img
                src={questionMediaUrl}
                alt="question media"
                className="max-h-64 rounded-2xl mx-auto mb-6 object-contain shadow-lg"
              />
            )}
            {questionMediaUrl && questionMediaType === "audio" && (
              <audio
                controls
                preload="auto"
                className="w-full mb-6 rounded-xl"
                src={questionMediaUrl}
              />
            )}
            {questionMediaUrl && questionMediaType === "video" && (
              <video
                controls
                preload="auto"
                className="max-h-64 rounded-2xl mx-auto mb-6 w-full shadow-lg"
                src={questionMediaUrl}
              />
            )}

            {questionId > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {questionChoices.map((choice, idx) => {
                  const isSelected = selectedChoices.includes(idx);
                  const isCorrect = choiceCorrect[idx];
                  const inFeedback = isFeedback;
                  const isMulti = choiceCorrect.filter(Boolean).length > 1;
                  const containerClasses = inFeedback
                    ? getChoiceStyle(idx, selectedChoices, choiceCorrect)
                    : isSelected
                      ? "bg-tv-gold/20 border-tv-gold text-tv-purple dark:text-tv-gold shadow-md"
                      : "bg-white dark:bg-gray-800 border-rose-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-tv-gold hover:shadow-sm";
                  const iconClasses = inFeedback
                    ? isCorrect
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : isSelected
                        ? "bg-rose-500 text-white border-rose-500"
                        : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400"
                    : isSelected
                      ? "bg-tv-gold text-tv-purple border-tv-gold"
                      : "border-rose-200 dark:border-gray-600 text-gray-400 dark:text-gray-500";
                  const iconContent = inFeedback
                    ? isCorrect
                      ? "✓"
                      : isSelected
                        ? "✗"
                        : String.fromCharCode(65 + idx)
                    : isSelected
                      ? "✓"
                      : String.fromCharCode(65 + idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>
                        !inFeedback && !hasAnswered && handleChoice(idx)
                      }
                      disabled={hasAnswered || inFeedback}
                      className={`buzzer-btn answer-choice text-left px-4 py-4 rounded-xl border-2 text-sm font-bold transition-all ${containerClasses} ${hasAnswered || inFeedback ? "opacity-90 cursor-not-allowed" : "cursor-pointer hover:scale-[1.01] active:scale-[0.99]"}`}
                    >
                      <span
                        className={`inline-flex items-center justify-center w-8 h-8 ${isMulti ? "rounded-md" : "rounded-full"} border-2 text-sm font-bold mr-3 transition-colors duration-300 ${iconClasses}`}
                      >
                        {iconContent}
                      </span>
                      {choice.text}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        {!isFeedback && !(hasAnswered && roomMode === "solo") && (
          <button
            onClick={handleAnswerSubmit}
            disabled={selectedChoices.length === 0 || hasAnswered}
            className="buzzer-btn w-full px-6 py-4 rounded-2xl bg-gradient-to-r from-tv-red to-tv-red-dark text-white font-bold text-lg uppercase tracking-wider hover:shadow-xl transition-all disabled:opacity-50 cursor-pointer shadow-lg"
          >
            {hasAnswered
              ? t("room.waiting_for_answers")
              : t("room.submit_answer")}
          </button>
        )}

        {isFeedback && questionExplanation && (
          <div className="bg-tv-cream dark:bg-gray-900 rounded-2xl p-5 text-left text-sm text-gray-700 dark:text-gray-300 border-2 border-amber-200 dark:border-gray-700 shadow-sm animate-fade-in-up">
            <p className="font-display text-lg text-tv-purple dark:text-tv-gold mb-2 uppercase tracking-wide">
              {t("room.explanation")}
            </p>
            <p className="leading-relaxed">{questionExplanation}</p>
            {questionSourceUrl && (
              <a
                href={questionSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-3 text-tv-red dark:text-tv-gold hover:underline font-bold"
              >
                {t("room.source")} →
              </a>
            )}
          </div>
        )}
      </div>
    </>
  );
}
