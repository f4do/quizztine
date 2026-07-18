import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import Select from "../components/ui/Select";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";

interface User {
  id: string;
  pseudo: string;
  email: string;
  role: string;
  totpEnabled: boolean;
  emailVerified: boolean;
  createdAt: string;
}

const ROLES = ["USER", "QUIZMASTER", "QUIZADMIN"];

export default function AdminUsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [modal, setModal] = useState<"edit" | "reset-password" | null>(null);
  const [selected, setSelected] = useState<User | null>(null);

  const [editPseudo, setEditPseudo] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("USER");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const d = (await api("/users")) as { users: User[] };
      setUsers(d.users);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    setError("");
    setSuccess("");
    try {
      await api(`/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role } : u)),
      );
      setSuccess(t("admin.users.role_updated"));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const openEdit = (u: User) => {
    setSelected(u);
    setEditPseudo(u.pseudo);
    setEditEmail(u.email);
    setEditRole(u.role);
    setModal("edit");
    setError("");
    setSuccess("");
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setError("");
    setSuccess("");
    try {
      const d = (await api(`/users/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          pseudo: editPseudo,
          email: editEmail,
          role: editRole,
        }),
      })) as { user: User };
      setUsers((prev) => prev.map((u) => (u.id === selected.id ? d.user : u)));
      setModal(null);
      setSuccess(t("admin.users.updated"));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const openResetPassword = (u: User) => {
    setSelected(u);
    setNewPassword("");
    setConfirmPassword("");
    setModal("reset-password");
    setError("");
    setSuccess("");
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setError("");
    setSuccess("");
    try {
      await api(`/users/${selected.id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password: newPassword, confirmPassword }),
      });
      setModal(null);
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(t("admin.users.password_reset"));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleResetTOTP = async (u: User) => {
    if (
      !window.confirm(t("admin.users.confirm_reset_totp", { pseudo: u.pseudo }))
    )
      return;
    setError("");
    setSuccess("");
    try {
      await api(`/users/${u.id}/reset-totp`, { method: "POST" });
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, totpEnabled: false } : x)),
      );
      setSuccess(t("admin.users.totp_reset"));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleDelete = async (u: User) => {
    if (!window.confirm(t("admin.users.confirm_delete", { pseudo: u.pseudo })))
      return;
    setError("");
    setSuccess("");
    try {
      await api(`/users/${u.id}`, { method: "DELETE" });
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      setSuccess(t("admin.users.deleted"));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl text-tv-red dark:text-tv-gold uppercase tracking-wide">
        {t("admin.users.title")}
      </h1>
      {error && (
        <div className="rounded-2xl bg-red-100 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300 px-4 py-3 text-sm font-medium animate-fade-in-up">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 border-2 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 px-4 py-3 text-sm font-medium animate-fade-in-up">
          {success}
        </div>
      )}
      {loading ? (
        <p className="text-gray-500 dark:text-gray-400">
          {t("common.loading")}
        </p>
      ) : (
        <Card className="rounded-3xl overflow-hidden">
          <div className="divide-y divide-rose-100 dark:divide-gray-800 text-sm">
            {users.map((u) => (
              <div
                key={u.id}
                className="px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <p className="font-bold text-gray-900 dark:text-gray-100 text-base">
                    {u.pseudo}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {u.email}
                  </p>
                  <div className="flex gap-2 mt-1">
                    {u.totpEnabled && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 font-bold">
                        TOTP
                      </span>
                    )}
                    {!u.emailVerified && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 font-bold">
                        {t("admin.users.not_verified")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    options={ROLES.map((r) => ({ value: r, label: r }))}
                    className="w-36"
                  />
                  <Button
                    variant="ghost"
                    onClick={() => openEdit(u)}
                    className="rounded-xl font-bold"
                  >
                    {t("admin.users.edit")}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => openResetPassword(u)}
                    className="rounded-xl font-bold"
                  >
                    {t("admin.users.reset_password")}
                  </Button>
                  {u.totpEnabled && (
                    <Button
                      variant="ghost"
                      onClick={() => handleResetTOTP(u)}
                      className="rounded-xl font-bold"
                    >
                      {t("admin.users.reset_totp")}
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    onClick={() => handleDelete(u)}
                    className="rounded-xl font-bold"
                  >
                    {t("admin.users.delete")}
                  </Button>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <p className="px-4 py-6 text-gray-500 dark:text-gray-400">
                {t("admin.users.no_users")}
              </p>
            )}
          </div>
        </Card>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="rounded-3xl p-6 w-full max-w-md shadow-2xl">
            {modal === "edit" && selected && (
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <h2 className="font-display text-2xl text-tv-red dark:text-tv-gold uppercase tracking-wide mb-2">
                  {t("admin.users.edit_title", { pseudo: selected.pseudo })}
                </h2>
                <Input
                  label={t("admin.users.pseudo")}
                  type="text"
                  value={editPseudo}
                  onChange={(e) => setEditPseudo(e.target.value)}
                  required
                />
                <Input
                  label={t("admin.users.email")}
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  required
                />
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                    {t("admin.users.role")}
                  </label>
                  <Select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    options={ROLES.map((r) => ({ value: r, label: r }))}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setModal(null)}
                    className="rounded-xl font-bold"
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" className="rounded-xl font-bold">
                    {t("admin.users.save")}
                  </Button>
                </div>
              </form>
            )}
            {modal === "reset-password" && selected && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <h2 className="font-display text-2xl text-tv-red dark:text-tv-gold uppercase tracking-wide mb-2">
                  {t("admin.users.reset_password_title", {
                    pseudo: selected.pseudo,
                  })}
                </h2>
                <Input
                  label={t("profile.password.new")}
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={12}
                />
                <Input
                  label={t("profile.password.confirm")}
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={12}
                />
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setModal(null)}
                    className="rounded-xl font-bold"
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" className="rounded-xl font-bold">
                    {t("admin.users.reset_password")}
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
