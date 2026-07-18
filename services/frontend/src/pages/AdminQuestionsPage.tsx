import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import QuestionList from "../components/QuestionList";
import Select from "../components/ui/Select";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";

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

export default function AdminQuestionsPage() {
  const { t } = useTranslation();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [visibility, setVisibility] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (difficulty) params.set("difficulty", difficulty);
      if (visibility) params.set("visibility", visibility);
      const d = await api(`/questions?${params.toString()}`);
      setQuestions(d.questions);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [category, difficulty, visibility]);

  useEffect(() => {
    load();
    api("/categories")
      .then((d) => setCategories(d.categories))
      .catch(() => {});
  }, [load]);

  const handleDelete = async (id: number) => {
    if (!confirm(t("admin.questions.confirm_delete"))) return;
    try {
      await api(`/questions/${id}`, { method: "DELETE" });
      setQuestions((prev) => prev.filter((q) => q.id !== id));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="font-display text-4xl text-tv-red dark:text-tv-gold uppercase tracking-wide">
          {t("admin.questions.title")}
        </h1>
        <Link to="/admin/questions/new">
          <Button className="buzzer-btn rounded-2xl px-5 py-2.5 bg-tv-red text-white font-bold uppercase tracking-wider shadow-md hover:bg-tv-red-dark">
            {t("admin.questions.new_question")}
          </Button>
        </Link>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-100 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300 px-4 py-3 text-sm font-medium animate-fade-in-up">
          {error}
        </div>
      )}

      <Card className="rounded-3xl p-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <Select
            label={t("room_create.categories")}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={[
              { value: "", label: t("train.all") },
              ...categories.map((c) => ({ value: c.name, label: c.name })),
            ]}
            className="flex-1"
          />
          <Select
            label={t("room_create.difficulty")}
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            options={[
              { value: "", label: t("train.any") },
              { value: "EASY", label: t("room_create.easy") },
              { value: "MEDIUM", label: t("room_create.medium") },
              { value: "HARD", label: t("room_create.hard") },
            ]}
            className="flex-1"
          />
          <Select
            label={t("admin.questions.visibility")}
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            options={[
              { value: "", label: t("train.any") },
              { value: "PUBLIC", label: t("admin.questions.public") },
              { value: "PRIVATE", label: t("admin.questions.private") },
            ]}
            className="flex-1"
          />
        </div>
      </Card>

      {loading ? (
        <p className="text-gray-500 dark:text-gray-400">
          {t("common.loading")}
        </p>
      ) : (
        <QuestionList questions={questions} onDelete={handleDelete} />
      )}
    </div>
  );
}
