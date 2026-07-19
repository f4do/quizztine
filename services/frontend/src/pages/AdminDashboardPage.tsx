import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { AppHostPresenter } from "../components/host";
import { usePhrases } from "../lib/PhrasesProvider";

export default function AdminDashboardPage() {
  const { t } = useTranslation();
  const { getPhrase } = usePhrases();
  const { user } = useAuth();
  const isQuizadmin = user?.role === "QUIZADMIN";
  const [counts, setCounts] = useState({
    questions: 0,
    users: 0,
    categories: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [q, u, c] = await Promise.all([
          api("/questions").then(
            (d: { questions: unknown[] }) => d.questions.length,
          ),
          isQuizadmin
            ? api("/users").then((d: { users: unknown[] }) => d.users.length)
            : Promise.resolve(0),
          api("/categories").then(
            (d: { categories: unknown[] }) => d.categories.length,
          ),
        ]);
        setCounts({ questions: q, users: u, categories: c });
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isQuizadmin]);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl text-tv-red dark:text-tv-gold uppercase tracking-wide">
        {t("admin.dashboard.title")}
      </h1>
      {loading ? (
        <p className="text-gray-500 dark:text-gray-400">
          {t("common.loading")}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="rounded-3xl p-6 hover:shadow-lg transition-shadow">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {t("admin.dashboard.questions")}
            </p>
            <p className="text-5xl font-display text-tv-red dark:text-tv-gold">
              {counts.questions}
            </p>
            <Link
              to="/admin/questions"
              className="text-tv-red dark:text-tv-gold text-sm hover:underline font-bold mt-2 inline-block"
            >
              {t("admin.dashboard.manage_questions")} →
            </Link>
          </Card>
          {isQuizadmin && (
            <Card className="rounded-3xl p-6 hover:shadow-lg transition-shadow">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {t("admin.dashboard.users")}
              </p>
              <p className="text-5xl font-display text-tv-purple dark:text-tv-gold">
                {counts.users}
              </p>
              <Link
                to="/admin/users"
                className="text-tv-purple dark:text-tv-gold text-sm hover:underline font-bold mt-2 inline-block"
              >
                {t("admin.dashboard.manage_users")} →
              </Link>
            </Card>
          )}
          <Card className="rounded-3xl p-6 hover:shadow-lg transition-shadow">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {t("admin.dashboard.categories")}
            </p>
            <p className="text-5xl font-display text-tv-gold">
              {counts.categories}
            </p>
            {isQuizadmin && (
              <Link
                to="/admin/categories"
                className="text-tv-gold text-sm hover:underline font-bold mt-2 inline-block"
              >
                {t("admin.dashboard.manage_categories")} →
              </Link>
            )}
          </Card>
        </div>
      )}
      <div>
        <Link to="/admin/questions/new">
          <Button className="buzzer-btn rounded-2xl px-6 py-3 bg-tv-red text-white font-bold uppercase tracking-wider shadow-lg hover:bg-tv-red-dark">
            {t("admin.questions.new_question")}
          </Button>
        </Link>
      </div>

      <AppHostPresenter
        message={getPhrase("admin.dashboard")}
        expression="smile"
        position="bottom-right"
        avatarSize="sm"
        typing={true}
      />
    </div>
  );
}
