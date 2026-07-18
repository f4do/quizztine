import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/auth";
import Button from "./ui/Button";

interface Choice {
  text: string;
  isCorrect: boolean;
}

interface Question {
  id: number;
  text: string;
  category: string;
  difficulty: string;
  visibility: string;
  authorId: string | null;
  choices: Choice[];
}

interface QuestionListProps {
  questions: Question[];
  onDelete: (id: number) => void;
}

export default function QuestionList({
  questions,
  onDelete,
}: QuestionListProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isQuizadmin = user?.role === "QUIZADMIN";

  if (questions.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 italic">
        {t("admin.questions.no_questions")}
      </p>
    );
  }

  const difficultyBadge = (d: string) => {
    const colors: Record<string, string> = {
      EASY: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
      MEDIUM:
        "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
      HARD: "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    };
    return (
      colors[d] ||
      "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
    );
  };

  return (
    <div className="divide-y divide-rose-100 dark:divide-gray-800 text-sm rounded-3xl overflow-hidden tv-card border border-rose-200/60 dark:border-rose-900/40">
      {questions.map((q) => (
        <div
          key={q.id}
          className="px-4 py-4 hover:bg-rose-50 dark:hover:bg-gray-800 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 dark:text-gray-100 leading-relaxed">
              <span className="text-tv-red dark:text-tv-gold font-display text-lg mr-2">
                #{q.id}
              </span>
              {q.text.length > 80 ? `${q.text.slice(0, 80)}...` : q.text}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 flex flex-wrap gap-2">
              <span className="px-2 py-0.5 rounded-full bg-tv-purple/10 text-tv-purple dark:text-tv-gold font-bold border border-tv-purple/20">
                {q.category}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full border font-bold ${difficultyBadge(q.difficulty)}`}
              >
                {q.difficulty}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold border border-gray-200 dark:border-gray-700">
                {q.visibility}
              </span>
              {q.choices.filter((c) => c.isCorrect).length > 1 && (
                <span className="px-2 py-0.5 rounded-full bg-tv-gold/20 text-tv-gold-dark dark:text-tv-gold font-bold border border-tv-gold/30">
                  {t("admin.questions.multiple_correct")}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                window.location.href = `/admin/questions/${q.id}/edit`;
              }}
              className="rounded-xl font-bold"
            >
              {t("admin.questions.edit")}
            </Button>
            {(q.authorId === user?.id || isQuizadmin) && (
              <Button
                variant="danger"
                onClick={() => onDelete(q.id)}
                className="rounded-xl font-bold"
              >
                {t("admin.questions.delete")}
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
