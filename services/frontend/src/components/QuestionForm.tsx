import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, API_BASE } from "../lib/api";
import Input from "./ui/Input";
import Select from "./ui/Select";
import Button from "./ui/Button";
import AudioRecorder from "./AudioRecorder";

type Difficulty = "EASY" | "MEDIUM" | "HARD";
type Visibility = "PUBLIC" | "PRIVATE";

interface Choice {
  text: string;
  isCorrect: boolean;
}

interface Question {
  id: number;
  text: string;
  choices: Choice[];
  category: string;
  difficulty: Difficulty;
  visibility: Visibility;
  explanation?: string | null;
  sourceUrl?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
}

interface QuestionFormProps {
  mode: "create" | "edit";
  questionId?: string;
}

export default function QuestionForm({ mode, questionId }: QuestionFormProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<{ id: number; name: string }[]>(
    [],
  );

  const [text, setText] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("EASY");
  const [visibility, setVisibility] = useState<Visibility>("PUBLIC");
  const [explanation, setExplanation] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [choices, setChoices] = useState<Choice[]>([
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ]);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("");
  const [mediaUploading, setMediaUploading] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const d = await api("/categories");
      setCategories(d.categories);
      if (mode === "create" && d.categories.length > 0 && !category) {
        setCategory(d.categories[0].name);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [mode, category]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (mode === "edit" && questionId) {
      api(`/questions/${questionId}`)
        .then((d) => {
          const q: Question = d.question;
          setText(q.text);
          setCategory(q.category);
          setDifficulty(q.difficulty);
          setVisibility(q.visibility);
          setExplanation(q.explanation ?? "");
          setSourceUrl(q.sourceUrl ?? "");
          setChoices(q.choices);
          setMediaUrl(q.mediaUrl ?? "");
          setMediaType(q.mediaType ?? "");
        })
        .catch((e) => setError((e as Error).message))
        .finally(() => setLoading(false));
    }
  }, [mode, questionId]);

  const handleChoiceChange = (
    i: number,
    field: "text" | "isCorrect",
    value: string | boolean,
  ) => {
    setChoices((prev) =>
      prev.map((c, j) => (j === i ? { ...c, [field]: value } : c)),
    );
  };

  const addChoice = () => {
    if (choices.length < 4)
      setChoices((prev) => [...prev, { text: "", isCorrect: false }]);
  };

  const removeChoice = (i: number) => {
    if (choices.length > 2)
      setChoices((prev) => prev.filter((_, j) => j !== i));
  };

  const handleUploadMedia = async (file: File) => {
    setMediaUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setMediaUrl(data.url);
      setMediaType(data.mediaType);
    } catch (e) {
      setError((e as Error).message);
      setMediaUrl("");
      setMediaType("");
    } finally {
      setMediaUploading(false);
    }
  };

  const handleRemoveMedia = () => {
    setMediaUrl("");
    setMediaType("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!text.trim()) {
      setError(t("admin.questions.error_text_required"));
      return;
    }
    if (choices.some((c) => !c.text.trim())) {
      setError(t("admin.questions.error_choice_text"));
      return;
    }
    if (!choices.some((c) => c.isCorrect)) {
      setError(t("admin.questions.error_no_correct"));
      return;
    }
    const body = {
      text,
      choices,
      category,
      difficulty,
      visibility,
      explanation: explanation || undefined,
      sourceUrl: sourceUrl || undefined,
      mediaUrl: mediaUrl || undefined,
      mediaType: mediaType || undefined,
    };
    try {
      setSaving(true);
      if (mode === "create") {
        await api("/questions", { method: "POST", body: JSON.stringify(body) });
      } else {
        await api(`/questions/${questionId}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      }
      navigate("/admin/questions");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <p className="text-gray-500 dark:text-gray-400">{t("common.loading")}</p>
    );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-2xl bg-red-100 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300 px-4 py-3 text-sm font-medium animate-fade-in-up">
          {error}
        </div>
      )}
      <Input
        label={t("admin.questions.text")}
        value={text}
        onChange={(e) => setText(e.target.value)}
        required
      />
      <Select
        label={t("admin.questions.category")}
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        options={categories.map((c) => ({ value: c.name, label: c.name }))}
      />
      <div className="flex gap-3">
        <Select
          label={t("admin.questions.difficulty")}
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as Difficulty)}
          options={[
            { value: "EASY", label: t("room_create.easy") },
            { value: "MEDIUM", label: t("room_create.medium") },
            { value: "HARD", label: t("room_create.hard") },
          ]}
          className="flex-1"
        />
        <Select
          label={t("admin.questions.visibility")}
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as Visibility)}
          options={[
            { value: "PUBLIC", label: t("admin.questions.public") },
            { value: "PRIVATE", label: t("admin.questions.private") },
          ]}
          className="flex-1"
        />
      </div>
      <Input
        label={t("admin.questions.explanation")}
        value={explanation}
        onChange={(e) => setExplanation(e.target.value)}
      />
      <Input
        label={t("admin.questions.source_url")}
        type="url"
        value={sourceUrl}
        onChange={(e) => setSourceUrl(e.target.value)}
      />

      <div>
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
          {t("admin.questions.media")}
        </label>
        <input
          type="file"
          accept="audio/*,image/*"
          disabled={mediaUploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUploadMedia(file);
          }}
          className="block w-full text-sm text-gray-600 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-tv-gold file:text-tv-purple hover:file:bg-tv-gold-dark disabled:opacity-50"
        />
        {mediaUploading && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t("common.loading")}
          </p>
        )}
        <div className="mt-2">
          <AudioRecorder
            onUploaded={(url) => {
              setMediaUrl(url);
              setMediaType("audio");
            }}
            onError={setError}
          />
        </div>
        {mediaUrl && (
          <div className="mt-3 space-y-2">
            {mediaType === "image" && (
              <img
                src={`${API_BASE}${mediaUrl}`}
                alt="preview"
                className="max-w-xs rounded-2xl border-2 dark:border-gray-700 shadow-sm"
              />
            )}
            {mediaType === "audio" && (
              <audio
                controls
                src={`${API_BASE}${mediaUrl}`}
                className="w-full max-w-xs rounded-xl"
              />
            )}
            <button
              type="button"
              onClick={handleRemoveMedia}
              className="text-red-500 dark:text-red-400 text-xs font-bold hover:underline"
            >
              {t("admin.questions.remove_media")}
            </button>
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
          {t("admin.questions.choices", { count: choices.length })}
        </p>
        {choices.map((c, i) => (
          <div key={i} className="flex items-center gap-2 mb-2">
            <input
              type="text"
              value={c.text}
              onChange={(e) => handleChoiceChange(i, "text", e.target.value)}
              placeholder={t("admin.questions.choice_placeholder", {
                index: i + 1,
              })}
              className="flex-1 rounded-xl border-2 border-rose-200 dark:border-rose-900/50 px-3 py-2 text-sm dark:bg-gray-800 dark:text-gray-100 focus:border-tv-gold focus:outline-none"
            />
            <label
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-xs font-bold cursor-pointer transition-colors ${c.isCorrect ? "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 text-emerald-700 dark:text-emerald-300" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"}`}
            >
              <input
                type="checkbox"
                checked={c.isCorrect}
                onChange={(e) =>
                  handleChoiceChange(i, "isCorrect", e.target.checked)
                }
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-emerald-500 focus:ring-emerald-500"
              />
              {t("admin.questions.correct")}
            </label>
            {choices.length > 2 && (
              <button
                type="button"
                onClick={() => removeChoice(i)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 text-lg font-bold transition-colors"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {choices.length < 4 && (
          <button
            type="button"
            onClick={addChoice}
            className="text-tv-red dark:text-tv-gold text-sm font-bold mt-1 hover:underline"
          >
            {t("admin.questions.add_choice")}
          </button>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          disabled={saving}
          className="buzzer-btn rounded-xl px-6 py-2.5 bg-tv-red text-white font-bold uppercase tracking-wider shadow-md hover:bg-tv-red-dark"
        >
          {mode === "create"
            ? t("admin.questions.create")
            : t("admin.questions.save")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate("/admin/questions")}
          className="rounded-xl font-bold"
        >
          {t("admin.questions.cancel")}
        </Button>
      </div>
    </form>
  );
}
