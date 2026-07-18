import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";

interface Category {
  id: number;
  name: string;
}

export default function AdminCategoriesPage() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api("/categories")
      .then((d) => setCategories(d.categories))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await api("/categories", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim() }),
      });
      setNewName("");
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t("admin.categories.confirm_delete"))) return;
    try {
      await api(`/categories/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl text-tv-red dark:text-tv-gold uppercase tracking-wide">
        {t("admin.categories.title")}
      </h1>
      {error && (
        <div className="rounded-2xl bg-red-100 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300 px-4 py-3 text-sm font-medium animate-fade-in-up">
          {error}
        </div>
      )}
      <Card className="rounded-3xl p-5">
        <div className="flex gap-3">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("admin.categories.name_placeholder")}
            className="flex-1"
          />
          <Button
            onClick={handleAdd}
            className="buzzer-btn rounded-xl px-5 bg-tv-red text-white font-bold uppercase tracking-wider hover:bg-tv-red-dark shadow-md"
          >
            {t("admin.categories.add")}
          </Button>
        </div>
      </Card>
      {loading ? (
        <p className="text-gray-500 dark:text-gray-400">
          {t("common.loading")}
        </p>
      ) : (
        <Card className="rounded-3xl overflow-hidden">
          <div className="divide-y divide-rose-100 dark:divide-gray-800 text-sm">
            {categories.map((c) => (
              <div
                key={c.id}
                className="px-4 py-3 flex items-center justify-between hover:bg-rose-50 dark:hover:bg-gray-800 transition-colors"
              >
                <span className="font-bold text-gray-900 dark:text-gray-100">
                  {c.name}
                </span>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300 text-lg font-bold transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
