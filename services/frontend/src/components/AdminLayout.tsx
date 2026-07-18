import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/auth";
import Layout from "./Layout";
import Card from "./ui/Card";

interface NavItemProps {
  to: string;
  label: string;
  icon?: string;
}

function NavItem({ to, label, icon }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
          isActive
            ? "bg-tv-red text-white shadow-md"
            : "text-gray-700 dark:text-gray-300 hover:bg-rose-50 dark:hover:bg-gray-800"
        }`
      }
    >
      {icon && <span>{icon}</span>}
      {label}
    </NavLink>
  );
}

export default function AdminLayout() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isQuizadmin = user?.role === "QUIZADMIN";

  return (
    <Layout>
      <div className="flex flex-col md:flex-row gap-6">
        <aside className="w-full md:w-64 shrink-0">
          <Card className="rounded-3xl p-4">
            <h2 className="px-4 py-2 font-display text-2xl text-tv-red dark:text-tv-gold uppercase tracking-wide">
              {t("admin.title")}
            </h2>
            <nav className="space-y-1 mt-3">
              <NavItem to="/admin" label={t("admin.nav.dashboard")} icon="📊" />
              <NavItem
                to="/admin/questions"
                label={t("admin.nav.questions")}
                icon="📝"
              />
              <NavItem
                to="/admin/questions/new"
                label={t("admin.nav.new_question")}
                icon="➕"
              />
              {isQuizadmin && (
                <>
                  <NavItem
                    to="/admin/users"
                    label={t("admin.nav.users")}
                    icon="👥"
                  />
                  <NavItem
                    to="/admin/categories"
                    label={t("admin.nav.categories")}
                    icon="🏷️"
                  />
                </>
              )}
            </nav>
          </Card>
        </aside>
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </Layout>
  );
}
