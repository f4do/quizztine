import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, API_BASE } from "../lib/api";
import { useHost } from "../lib/HostProvider";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import CycleSelect from "../components/ui/CycleSelect";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import {
  HostAvatar,
  type AvatarConfig,
  DEFAULT_AVATAR_CONFIG,
} from "../components/host";

interface Host {
  id: string;
  name: string;
  avatarType: "BUILTIN" | "URL";
  avatarConfig: AvatarConfig;
  avatarUrl: string | null;
  isActive: boolean;
}

interface HostFormState {
  name: string;
  avatarType: "BUILTIN" | "URL";
  avatarConfig: AvatarConfig;
  avatarUrl: string;
}

const EMPTY_FORM: HostFormState = {
  name: "",
  avatarType: "BUILTIN",
  avatarConfig: { ...DEFAULT_AVATAR_CONFIG },
  avatarUrl: "",
};

const TOP_TYPES = [
  "NoHair",
  "Eyepatch",
  "Hat",
  "Hijab",
  "Turban",
  "WinterHat1",
  "WinterHat2",
  "WinterHat3",
  "WinterHat4",
  "LongHairBigHair",
  "LongHairBob",
  "LongHairBun",
  "LongHairCurly",
  "LongHairCurvy",
  "LongHairDreads",
  "LongHairFrida",
  "LongHairFro",
  "LongHairFroBand",
  "LongHairMiaWallace",
  "LongHairNotTooLong",
  "LongHairShavedSides",
  "LongHairStraight",
  "LongHairStraight2",
  "LongHairStraightStrand",
  "ShortHairDreads01",
  "ShortHairDreads02",
  "ShortHairFrizzle",
  "ShortHairShaggyMullet",
  "ShortHairShortCurly",
  "ShortHairShortFlat",
  "ShortHairShortRound",
  "ShortHairShortWaved",
  "ShortHairSides",
  "ShortHairTheCaesar",
  "ShortHairTheCaesarSidePart",
];

const HAIR_COLORS = [
  "Auburn",
  "Black",
  "Blonde",
  "BlondeGolden",
  "Brown",
  "BrownDark",
  "PastelPink",
  "Platinum",
  "Red",
  "SilverGray",
];

const ACCESSORIES_TYPES = [
  "Blank",
  "Kurt",
  "Prescription01",
  "Prescription02",
  "Round",
  "Sunglasses",
  "Wayfarers",
];

const FACIAL_HAIR_TYPES = [
  "Blank",
  "BeardLight",
  "BeardMajestic",
  "BeardMedium",
  "MoustacheFancy",
  "MoustacheMagnum",
];

const FACIAL_HAIR_COLORS = [
  "Auburn",
  "Black",
  "Blonde",
  "BlondeGolden",
  "Brown",
  "BrownDark",
  "Platinum",
  "Red",
  "SilverGray",
];

const CLOTHE_TYPES = [
  "BlazerShirt",
  "BlazerSweater",
  "CollarSweater",
  "GraphicShirt",
  "Hoodie",
  "Overall",
  "ShirtCrewNeck",
  "ShirtScoopNeck",
  "ShirtVNeck",
];

const CLOTHE_COLORS = [
  "Black",
  "Blue01",
  "Blue02",
  "Blue03",
  "Gray01",
  "Gray02",
  "Heather",
  "PastelBlue",
  "PastelGreen",
  "PastelOrange",
  "PastelRed",
  "PastelYellow",
  "Pink",
  "Red",
  "White",
];

const SKIN_COLORS = [
  "Tanned",
  "Yellow",
  "Pale",
  "Light",
  "Brown",
  "DarkBrown",
  "Black",
];

const SPOT_COLORS = [
  { value: "", label: "Or (défaut)" },
  { value: "#C41E3A", label: "Rouge TV" },
  { value: "#FFD700", label: "Or" },
  { value: "#FF6B6B", label: "Rose" },
  { value: "#4ECDC4", label: "Turquoise" },
  { value: "#45B7D1", label: "Bleu ciel" },
  { value: "#96CEB4", label: "Vert sauge" },
  { value: "#DDA0DD", label: "Prune" },
  { value: "#F0E68C", label: "Jaune" },
  { value: "#E8A87C", label: "Pêche" },
];

const AVATAR_CONFIG_FIELDS: {
  key: keyof AvatarConfig;
  label: string;
  values: string[];
}[] = [
  { key: "topType", label: "Coiffure / Chapeau", values: TOP_TYPES },
  { key: "hairColor", label: "Couleur de cheveux", values: HAIR_COLORS },
  { key: "accessoriesType", label: "Accessoires", values: ACCESSORIES_TYPES },
  {
    key: "facialHairType",
    label: "Barbe / Moustache",
    values: FACIAL_HAIR_TYPES,
  },
  {
    key: "facialHairColor",
    label: "Couleur barbe",
    values: FACIAL_HAIR_COLORS,
  },
  { key: "clotheType", label: "Vêtement", values: CLOTHE_TYPES },
  { key: "clotheColor", label: "Couleur vêtement", values: CLOTHE_COLORS },
  { key: "skinColor", label: "Teint de peau", values: SKIN_COLORS },
];

export default function AdminHostsPage() {
  const { t } = useTranslation();
  const { refetch } = useHost();
  const [hosts, setHosts] = useState<Host[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<Host | null>(null);
  const [form, setForm] = useState<HostFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // URL-type specific state
  const [uploading, setUploading] = useState(false);
  const [fetchUrl, setFetchUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const d = (await api("/host")) as { hosts: Host[] };
      setHosts(d.hosts);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFetchUrl("");
    setError("");
    setSuccess("");
    setModal("create");
  };

  const openEdit = (h: Host) => {
    setEditing(h);
    setForm({
      name: h.name,
      avatarType: h.avatarType,
      avatarConfig: { ...h.avatarConfig },
      avatarUrl: h.avatarUrl ?? "",
    });
    setFetchUrl(h.avatarUrl ?? "");
    setError("");
    setSuccess("");
    setModal("edit");
  };

  const closeModal = () => {
    setModal(null);
    setEditing(null);
    setFetchUrl("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        avatarType: form.avatarType,
        avatarConfig: form.avatarConfig,
      };
      if (form.avatarType === "URL") {
        body.avatarUrl = form.avatarUrl.trim() || null;
      } else {
        body.avatarUrl = null;
      }

      if (editing) {
        const d = (await api(`/host/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        })) as { host: Host };
        setHosts((prev) => prev.map((h) => (h.id === editing.id ? d.host : h)));
      } else {
        const d = (await api("/host", {
          method: "POST",
          body: JSON.stringify(body),
        })) as { host: Host };
        setHosts((prev) => [...prev, d.host]);
      }
      await refetch();
      setSuccess(t("admin.hosts.saved"));
      closeModal();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (key: keyof AvatarConfig, value: string) => {
    setForm((prev) => ({
      ...prev,
      avatarConfig: { ...prev.avatarConfig, [key]: value },
    }));
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(t("admin.hosts.upload_invalid_type"));
      return;
    }
    setError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? t("admin.hosts.upload_failed"));
      }
      const uploadedUrl: string | undefined =
        data.avatarUrl ?? data.url ?? data.fileUrl;
      if (!uploadedUrl) {
        throw new Error(t("admin.hosts.upload_failed"));
      }
      setForm((prev) => ({ ...prev, avatarUrl: uploadedUrl }));
      setFetchUrl(uploadedUrl);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleFetchUrl = async () => {
    const url = fetchUrl.trim();
    if (!url) return;
    setError("");
    setFetching(true);
    try {
      const d = (await api("/host/fetch-avatar", {
        method: "POST",
        body: JSON.stringify({ url }),
      })) as { avatarUrl?: string; url?: string };
      const fetchedUrl: string | undefined = d.avatarUrl ?? d.url;
      if (!fetchedUrl) {
        throw new Error(t("admin.hosts.fetch_failed"));
      }
      setForm((prev) => ({ ...prev, avatarUrl: fetchedUrl }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFetching(false);
    }
  };

  const handleActivate = async (h: Host) => {
    if (h.isActive) return; // already active, no-op
    setError("");
    setSuccess("");
    try {
      const d = (await api(`/host/${h.id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: true }),
      })) as { host: Host };
      setHosts((prev) =>
        prev.map((x) => ({ ...x, isActive: x.id === d.host.id })),
      );
      setSuccess(t("admin.hosts.activated"));
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleConfirmDelete = async () => {
    if (!editing) return;
    if (!window.confirm(t("admin.hosts.confirm_delete"))) return;
    setError("");
    setSuccess("");
    try {
      await api(`/host/${editing.id}`, { method: "DELETE" });
      setHosts((prev) => prev.filter((x) => x.id !== editing.id));
      setSuccess(t("admin.hosts.deleted"));
      await refetch();
      closeModal();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl text-tv-red dark:text-tv-gold uppercase tracking-wide">
          {t("admin.hosts.title")}
        </h1>
        <Button
          onClick={openCreate}
          className="buzzer-btn rounded-xl px-5 bg-tv-red text-white font-bold uppercase tracking-wider hover:bg-tv-red-dark shadow-md"
        >
          {t("admin.hosts.add")}
        </Button>
      </div>

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
      ) : hosts.length === 0 ? (
        <Card className="rounded-3xl p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            {t("admin.hosts.no_hosts")}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {hosts.map((h) => (
            <Card
              key={h.id}
              className="rounded-3xl p-5 flex flex-col gap-4 hover:shadow-lg transition-shadow overflow-hidden"
            >
              <div className="flex items-center gap-4">
                <HostAvatar
                  expression="smile"
                  size="md"
                  avatarType={h.avatarType}
                  avatarConfig={h.avatarConfig}
                  avatarUrl={h.avatarUrl}
                />
                <p className="font-display text-2xl text-tv-red dark:text-tv-gold uppercase tracking-wide truncate flex-1 min-w-0">
                  {h.name}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <label
                  className="flex items-center gap-2 cursor-pointer select-none"
                  onClick={() => handleActivate(h)}
                >
                  <span
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      h.isActive
                        ? "border-emerald-500 bg-emerald-500"
                        : "border-gray-400 dark:border-gray-500"
                    }`}
                  >
                    {h.isActive && (
                      <span className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </span>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {t("admin.hosts.active")}
                  </span>
                </label>
                <Button
                  variant="ghost"
                  onClick={() => openEdit(h)}
                  className="rounded-xl font-bold"
                >
                  {t("admin.hosts.edit")}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="font-display text-2xl text-tv-red dark:text-tv-gold uppercase tracking-wide">
                {editing ? t("admin.hosts.edit") : t("admin.hosts.add")}
              </h2>

              {error && (
                <div className="rounded-xl bg-red-100 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300 px-3 py-2 text-sm font-medium">
                  {error}
                </div>
              )}

              <div className="flex justify-center py-2">
                <HostAvatar
                  expression="smile"
                  size="xl"
                  avatarType={form.avatarType}
                  avatarConfig={form.avatarConfig}
                  avatarUrl={form.avatarUrl || null}
                />
              </div>

              <Input
                label={t("admin.hosts.name")}
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="Christine"
              />
              <Select
                label={t("admin.hosts.avatar_type")}
                value={form.avatarType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    avatarType: e.target.value as HostFormState["avatarType"],
                  })
                }
                options={[
                  { value: "BUILTIN", label: t("admin.hosts.avatar_builtin") },
                  { value: "URL", label: t("admin.hosts.avatar_url_label") },
                ]}
              />

              {/* BUILTIN: avataaars config */}
              {form.avatarType === "BUILTIN" && (
                <>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Avatar Configuration
                  </p>
                  <div className="space-y-3 max-h-72 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
                    {AVATAR_CONFIG_FIELDS.map((field) => (
                      <CycleSelect
                        key={field.key}
                        label={field.label}
                        value={form.avatarConfig[field.key]}
                        options={field.values.map((v) => ({
                          value: v,
                          label: v,
                        }))}
                        onChange={(v) => updateConfig(field.key, v)}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* URL: file upload zone + URL input + preview */}
              {form.avatarType === "URL" && (
                <div className="space-y-3">
                  {/* File drop zone */}
                  <div
                    className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${
                      dragOver
                        ? "border-tv-red bg-rose-50 dark:bg-rose-900/20"
                        : "border-gray-300 dark:border-gray-600 hover:border-tv-red"
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) void handleFileUpload(file);
                    }}
                    onClick={() =>
                      document.getElementById("host-file-input")?.click()
                    }
                  >
                    <input
                      id="host-file-input"
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleFileUpload(file);
                        e.target.value = "";
                      }}
                    />
                    {uploading ? (
                      <p className="text-sm font-medium text-tv-red dark:text-tv-gold">
                        {t("admin.hosts.uploading")}
                      </p>
                    ) : (
                      <>
                        <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                          {t("admin.hosts.upload_dropzone_title")}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {t("admin.hosts.upload_dropzone_hint")}
                        </p>
                      </>
                    )}
                  </div>

                  {/* URL input + Fetch */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                      {t("admin.hosts.avatar_url")}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={fetchUrl}
                        onChange={(e) => {
                          setFetchUrl(e.target.value);
                          setForm((prev) => ({
                            ...prev,
                            avatarUrl: e.target.value,
                          }));
                        }}
                        placeholder="https://example.com/avatar.png"
                        className="flex-1 rounded-xl border-2 border-rose-200 dark:border-rose-900/50 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm shadow-sm focus:border-tv-gold focus:outline-none dark:text-gray-100 transition-colors"
                      />
                      <Button
                        type="button"
                        onClick={handleFetchUrl}
                        disabled={fetching || !fetchUrl.trim()}
                        className="rounded-xl font-bold whitespace-nowrap"
                      >
                        {fetching
                          ? t("admin.hosts.fetching")
                          : t("admin.hosts.fetch")}
                      </Button>
                    </div>
                  </div>

                  {form.avatarUrl && (
                    <div className="flex items-center gap-3 p-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-white dark:bg-gray-700 shrink-0 flex items-center justify-center">
                        <img
                          src={
                            form.avatarUrl.startsWith("http")
                              ? form.avatarUrl
                              : `${API_BASE}${form.avatarUrl}`
                          }
                          alt="avatar preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (
                              e.currentTarget as HTMLImageElement
                            ).style.display = "none";
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                          {t("admin.hosts.current_avatar")}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate font-mono">
                          {form.avatarUrl}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Spot color — visible for ALL avatar types */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <CycleSelect
                  label="Couleur du spot"
                  value={form.avatarConfig.spotColor ?? ""}
                  options={SPOT_COLORS}
                  onChange={(v) => updateConfig("spotColor", v || undefined)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={closeModal}
                  className="rounded-xl font-bold"
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl font-bold"
                >
                  {t("admin.users.save")}
                </Button>
              </div>

              {editing && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                  <Button
                    type="button"
                    variant="danger"
                    onClick={handleConfirmDelete}
                    disabled={editing.isActive}
                    className="w-full rounded-xl font-bold"
                    title={
                      editing.isActive
                        ? t("admin.hosts.cannot_delete_active")
                        : undefined
                    }
                  >
                    {t("admin.hosts.delete")}
                  </Button>
                </div>
              )}
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
