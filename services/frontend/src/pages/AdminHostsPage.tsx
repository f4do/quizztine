import { useEffect, useMemo, useState } from "react";
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

// ── Phrase management types ──

interface Phrase {
  id: string;
  context: string;
  scope: string;
  lang: string;
  text: string;
  priority: number;
}

interface PhraseDisplayEntry {
  id: string;
  context: string;
  lang: string;
  text: string;
  priority: number;
  scope: string;
  isDefault: boolean;
}

interface ContextGroup {
  category: string;
  contexts: string[];
}

interface PhraseFormState {
  context: string;
  lang: "fr" | "en";
  text: string;
}

const EMPTY_PHRASE_FORM: PhraseFormState = {
  context: "",
  lang: "fr",
  text: "",
};

const LANGUAGES = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
];

const SCOPES = [
  { value: "game", label: "game" },
  { value: "site", label: "site" },
];

const PHRASE_PAGE_SIZE = 10;

/** Natural language labels for context categories */
const CATEGORY_LABELS: Record<string, string> = {
  pre: "Avant la partie",
  game: "Pendant la partie",
  question: "Question",
  feedback: "Résultat",
  end: "Fin de partie",
  ready: "Replay",
  site: "Pages du site",
  home: "Accueil",
  login: "Connexion",
  register: "Inscription",
  room_create: "Création de salon",
  profile: "Profil",
  train: "Entraînement",
  admin: "Administration",
  error: "Erreur",
};

/** Natural language labels for each context (French) */
const CONTEXT_LABELS: Record<string, string> = {
  "pre.solo": "Avant une partie solo",
  "pre.welcome": "Avant une partie multi (attente des joueurs)",
  "ready.replay": "Phase prêt (replay)",
  "game.first": "Première question de la partie",
  "game.last": "Dernière question de la partie",
  "game.media_audio": "Question avec audio",
  "game.media_video": "Question avec vidéo",
  "question.default": "Question de difficulté moyenne",
  "question.easy": "Question facile",
  "question.hard": "Question difficile",
  "feedback.correct": "Bonne réponse (générique)",
  "feedback.correct_hard": "Bonne réponse sur une question difficile",
  "feedback.first_correct": "Premier à répondre correctement",
  "feedback.only_correct": "Seul à avoir répondu correctement",
  "feedback.correct_first_only": "Premier ET seul à avoir correctement répondu",
  "feedback.wrong": "Mauvaise réponse (générique)",
  "feedback.only_wrong": "Seul à s'être trompé",
  "feedback.timeout": "Temps écoulé",
  "feedback.streak_3": "Série de 3 bonnes réponses",
  "feedback.streak_5": "Série de 5 bonnes réponses",
  "feedback.streak_10": "Série de 10 bonnes réponses",
  "feedback.last_second": "Réponse in extremis",
  "feedback.streak_lost": "Série interrompue par une erreur",
  "end.winner": "Vainqueur de la partie",
  "end.second": "Deuxième place",
  "end.third": "Troisième place",
  "end.last": "Dernière place",
  "end.low": "Score nul",
  "end.default": "Fin de partie (générique)",
  "end.perfect": "Sans-faute (100% bonnes réponses)",
  "end.tie": "Ex-aequo",
  "home.welcome": "Accueil",
  "home.new_candidate": "Accueil (inutilisé)",
  "login.welcome": "Connexion",
  "register.welcome": "Inscription",
  "room_create.welcome": "Création de salon",
  "profile.prompt": "Profil",
  "train.prompt": "Entraînement",
  "admin.dashboard": "Dashboard admin",
  "admin.question_form": "Formulaire question admin (inutilisé)",
  "error.message": "Page d'erreur",
  "site.after_register": "Après une inscription réussie",
  "site.after_login": "Après une connexion réussie",
  "site.after_logout": "Après une déconnexion",
  "site.after_password_change": "Après un changement de mot de passe",
  "site.after_account_delete": "Après une suppression de compte",
  "site.room_created": "Après la création d'un salon",
  "site.admin_questions": "Page liste des questions (admin)",
  "site.admin_users": "Page liste des utilisateurs (admin)",
  "site.admin_categories": "Page gestion des catégories (admin)",
};

/** Variable name → French description for tooltips */
const VARIABLE_DESCRIPTIONS: Record<string, string> = {
  pseudo: "Nom du joueur",
  score: "Score total du joueur",
  points: "Points gagnés sur cette question",
  streak: "Bonnes réponses consécutives",
  index: "Numéro de la question",
  total: "Nombre total de questions",
  category: "Catégorie de la question",
  correct_count: "Bonnes réponses dans la partie",
  rank: "Position du joueur (1er, 2ème…)",
  code: "Code du salon",
  count: "Nombre d'éléments",
  answer: "Réponse correcte",
  explanation: "Texte d'explication",
};

/** Derive scope from context key */
function getScopeFromContext(ctx: string): string {
  return ctx.startsWith("site.") ||
    ctx.startsWith("home.") ||
    ctx.startsWith("login.") ||
    ctx.startsWith("register.") ||
    ctx.startsWith("room_create.") ||
    ctx.startsWith("profile.") ||
    ctx.startsWith("train.") ||
    ctx.startsWith("admin.") ||
    ctx.startsWith("error.")
    ? "site"
    : "game";
}

/** Context → template variables available for interpolation */
const CONTEXT_VARIABLES: Record<string, string[]> = {
  "pre.solo": ["pseudo"],
  "pre.welcome": ["pseudo"],
  "ready.replay": ["pseudo"],
  "question.default": ["index", "total", "category"],
  "question.easy": ["index", "total", "category"],
  "question.hard": ["index", "total", "category"],
  "game.first": ["index", "total", "pseudo"],
  "game.last": ["index", "total", "pseudo"],
  "game.media_audio": ["category", "pseudo"],
  "game.media_video": ["category", "pseudo"],
  "feedback.correct": ["pseudo", "points", "score", "streak"],
  "feedback.correct_hard": ["pseudo", "points", "score"],
  "feedback.first_correct": ["pseudo", "points", "score"],
  "feedback.only_correct": ["pseudo", "points", "score"],
  "feedback.correct_first_only": ["pseudo", "points", "score"],
  "feedback.wrong": ["pseudo", "points", "score"],
  "feedback.only_wrong": ["pseudo", "score"],
  "feedback.timeout": ["pseudo", "score"],
  "feedback.streak_3": ["pseudo", "points", "streak", "score"],
  "feedback.streak_5": ["pseudo", "points", "streak", "score"],
  "feedback.streak_10": ["pseudo", "points", "streak", "score"],
  "feedback.last_second": ["pseudo", "points", "score"],
  "feedback.streak_lost": ["pseudo", "streak", "score"],
  "end.winner": ["pseudo", "score", "total", "correct_count", "rank"],
  "end.second": ["pseudo", "score", "total", "correct_count", "rank"],
  "end.third": ["pseudo", "score", "total", "correct_count", "rank"],
  "end.last": ["pseudo", "score", "total", "correct_count", "rank"],
  "end.low": ["pseudo", "score", "total", "correct_count"],
  "end.default": ["pseudo", "score", "total", "correct_count", "rank"],
  "end.perfect": ["pseudo", "score", "total", "correct_count"],
  "end.tie": ["pseudo", "score", "rank"],
  "home.welcome": [],
  "home.new_candidate": [],
  "login.welcome": [],
  "register.welcome": [],
  "room_create.welcome": [],
  "profile.prompt": ["pseudo"],
  "train.prompt": [],
  "admin.dashboard": [],
  "admin.question_form": [],
  "error.message": [],
  "site.after_register": ["pseudo"],
  "site.after_login": ["pseudo"],
  "site.after_logout": [],
  "site.after_password_change": [],
  "site.after_account_delete": [],
  "site.room_created": ["code"],
  "site.admin_questions": ["count"],
  "site.admin_users": [],
  "site.admin_categories": [],
};

export default function AdminHostsPage() {
  const { t, i18n } = useTranslation();
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

  // ── Tab state ──
  const [activeTab, setActiveTab] = useState<"hosts" | "phrases">("hosts");

  // ── Phrase state ──
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [phraseLoading, setPhraseLoading] = useState(false);
  const [phraseError, setPhraseError] = useState("");
  const [phraseSuccess, setPhraseSuccess] = useState("");
  const [contextGroups, setContextGroups] = useState<ContextGroup[]>([]);

  const [phraseModal, setPhraseModal] = useState<"create" | "edit" | null>(
    null,
  );
  const [phraseEditing, setPhraseEditing] = useState<Phrase | null>(null);
  const [phraseForm, setPhraseForm] =
    useState<PhraseFormState>(EMPTY_PHRASE_FORM);
  const [phraseSaving, setPhraseSaving] = useState(false);

  // Filters
  const [contextFilter, setContextFilter] = useState("");
  const [langFilter, setLangFilter] = useState(i18n.language);
  const [scopeFilter, setScopeFilter] = useState("");

  // Pagination
  const [phrasePage, setPhrasePage] = useState(1);

  // Delete confirmation
  const [phraseToDelete, setPhraseToDelete] = useState<Phrase | null>(null);

  useEffect(() => {
    load();
  }, []);

  // Load phrase data when switching to phrases tab
  useEffect(() => {
    if (activeTab === "phrases") {
      loadContextGroups();
    }
  }, [activeTab]);

  // Reload phrases when filters change
  useEffect(() => {
    if (activeTab === "phrases") {
      loadPhrases();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, contextFilter, langFilter, scopeFilter]);

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

  // ── Phrase handlers ──

  const loadContextGroups = async () => {
    try {
      const d = (await api("/host/phrases/contexts")) as Record<
        string,
        unknown
      >;
      // Backend returns { contexts: { pre: [...], game: [...], ... }, variables: {...} }
      // Transform into ContextGroup[] for the dropdown
      const raw = d.contexts as Record<string, string[]>;
      const groups: ContextGroup[] = raw
        ? Object.entries(raw).map(([category, contexts]) => ({
            category,
            contexts,
          }))
        : [];
      setContextGroups(groups);
    } catch {
      // non-critical
    }
  };

  const loadPhrases = async () => {
    setPhraseLoading(true);
    setPhraseError("");
    try {
      const params = new URLSearchParams();
      if (contextFilter) params.set("context", contextFilter);
      if (langFilter) params.set("lang", langFilter);
      if (scopeFilter) params.set("scope", scopeFilter);
      const qs = params.toString();
      const d = (await api(`/host/phrases${qs ? `?${qs}` : ""}`)) as {
        phrases: Phrase[];
      };
      setPhrases(d.phrases ?? []);
      setPhrasePage(1);
    } catch (e) {
      setPhraseError((e as Error).message);
    } finally {
      setPhraseLoading(false);
    }
  };

  const openPhraseCreate = () => {
    setPhraseEditing(null);
    setPhraseForm({
      ...EMPTY_PHRASE_FORM,
      context: contextFilter || "",
    });
    setPhraseError("");
    setPhraseSuccess("");
    setPhraseModal("create");
  };

  const openPhraseEdit = (p: Phrase) => {
    setPhraseEditing(p);
    setPhraseForm({
      context: p.context,
      lang: p.lang as "fr" | "en",
      text: p.text,
      priority: p.priority,
      scope: p.scope,
    });
    setPhraseError("");
    setPhraseSuccess("");
    setPhraseModal("edit");
  };

  const closePhraseModal = () => {
    setPhraseModal(null);
    setPhraseEditing(null);
  };

  const handlePhraseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phraseForm.text.trim()) {
      setPhraseError(t("admin.hosts.phrases_empty_text"));
      return;
    }
    setPhraseSaving(true);
    setPhraseError("");
    setPhraseSuccess("");
    try {
      const body: Record<string, unknown> = {
        context: phraseForm.context,
        lang: phraseForm.lang,
        text: phraseForm.text.trim(),
        scope: getScopeFromContext(phraseForm.context),
      };

      if (phraseEditing) {
        await api(`/host/phrases/${phraseEditing.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        await api("/host/phrases", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      setPhraseSuccess(t("admin.hosts.phrases_saved"));
      closePhraseModal();
      await loadPhrases();
    } catch (e) {
      setPhraseError((e as Error).message);
    } finally {
      setPhraseSaving(false);
    }
  };

  const confirmDeletePhrase = (p: Phrase) => {
    setPhraseToDelete(p);
  };

  const handleDeletePhrase = async () => {
    if (!phraseToDelete) return;
    setPhraseError("");
    setPhraseSuccess("");
    try {
      await api(`/host/phrases/${phraseToDelete.id}`, { method: "DELETE" });
      setPhraseSuccess(t("admin.hosts.phrases_deleted"));
      setPhraseToDelete(null);
      await loadPhrases();
    } catch (e) {
      setPhraseError((e as Error).message);
      setPhraseToDelete(null);
    }
  };

  // ── Derived data ──

  // Merge custom phrases with default i18n entries for contexts without custom phrases
  const phraseDisplayEntries: PhraseDisplayEntry[] = useMemo(() => {
    // Build set of contexts that already have custom phrases for the active filters
    const contextsWithCustom = new Set(phrases.map((p) => p.context));

    // Start with all custom phrases
    const entries: PhraseDisplayEntry[] = phrases.map((p) => ({
      id: p.id,
      context: p.context,
      lang: p.lang,
      text: p.text,
      priority: p.priority,
      scope: p.scope,
      isDefault: false,
    }));

    // Determine which languages to use for defaults
    const defaultLangs = !langFilter
      ? ["fr", "en"] // no filter → show both languages
      : [langFilter]; // specific language filter

    // Add defaults for contexts without custom phrases, respecting active filters
    for (const group of contextGroups) {
      for (const ctx of group.contexts) {
        // Skip if a custom phrase already exists for this exact context+lang
        if (contextFilter && ctx !== contextFilter) continue;
        const scope =
          ctx.startsWith("site.") ||
          ctx.startsWith("home.") ||
          ctx.startsWith("login.") ||
          ctx.startsWith("register.") ||
          ctx.startsWith("room_create.") ||
          ctx.startsWith("profile.") ||
          ctx.startsWith("train.") ||
          ctx.startsWith("admin.") ||
          ctx.startsWith("error.")
            ? "site"
            : "game";
        if (scopeFilter && scope !== scopeFilter) continue;

        for (const lang of defaultLangs) {
          // Skip if a custom phrase already exists for this context+lang
          const hasCustom = phrases.some(
            (p) => p.context === ctx && p.lang === lang,
          );
          if (hasCustom) continue;

          // Also skip if we already added a default for this context+lang
          const alreadyAdded = entries.some(
            (e) => e.context === ctx && e.lang === lang,
          );
          if (alreadyAdded) continue;

          const tf =
            lang === "fr" && langFilter
              ? i18n.getFixedT("fr")
              : lang === "en" && langFilter
                ? i18n.getFixedT("en")
                : lang === "en"
                  ? i18n.getFixedT("en")
                  : t;
          const defaultText = tf(`host.${ctx}`);
          if (defaultText && !defaultText.startsWith("host.")) {
            entries.push({
              id: `default-${ctx}-${lang}`,
              context: ctx,
              lang,
              text: defaultText,
              priority: 50,
              scope,
              isDefault: true,
            });
          }
        }
      }
    }

    return entries;
  }, [phrases, contextGroups, t, contextFilter, langFilter, scopeFilter]);

  const totalPhrasePages = Math.max(
    1,
    Math.ceil(phraseDisplayEntries.length / PHRASE_PAGE_SIZE),
  );
  const paginatedPhrases = phraseDisplayEntries.slice(
    (phrasePage - 1) * PHRASE_PAGE_SIZE,
    phrasePage * PHRASE_PAGE_SIZE,
  );

  // Flatten context groups for the filter dropdown
  const filteredContextGroups = contextGroups
    .map((g) => ({
      label: CATEGORY_LABELS[g.category] ?? g.category,
      options: g.contexts
        .filter((c) => !scopeFilter || getScopeFromContext(c) === scopeFilter)
        .map((c) => ({ value: c, label: CONTEXT_LABELS[c] ?? c })),
    }))
    .filter((g) => g.options.length > 0);

  const selectedContextVars = phraseForm.context
    ? (CONTEXT_VARIABLES[phraseForm.context] ?? [])
    : [];

  return (
    <div className="space-y-4">
      {/* ── Tab navigation ── */}
      <div className="flex gap-1 border-b border-rose-200 dark:border-rose-900/50">
        <button
          onClick={() => setActiveTab("hosts")}
          className={`px-5 py-2.5 font-display text-lg uppercase tracking-wide rounded-t-xl transition-colors ${
            activeTab === "hosts"
              ? "bg-tv-red text-white dark:bg-tv-gold dark:text-gray-900"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
        >
          {t("admin.hosts.hosts_tab")}
        </button>
        <button
          onClick={() => setActiveTab("phrases")}
          className={`px-5 py-2.5 font-display text-lg uppercase tracking-wide rounded-t-xl transition-colors ${
            activeTab === "phrases"
              ? "bg-tv-red text-white dark:bg-tv-gold dark:text-gray-900"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
        >
          {t("admin.hosts.phrases_tab")}
        </button>
      </div>

      {activeTab === "hosts" ? (
        /* ════════════════════════════════════════
           HOST MANAGEMENT SECTION
           ════════════════════════════════════════ */
        <>
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
                        avatarType: e.target
                          .value as HostFormState["avatarType"],
                      })
                    }
                    options={[
                      {
                        value: "BUILTIN",
                        label: t("admin.hosts.avatar_builtin"),
                      },
                      {
                        value: "URL",
                        label: t("admin.hosts.avatar_url_label"),
                      },
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
                      onChange={(v) =>
                        updateConfig("spotColor", v || undefined)
                      }
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
        </>
      ) : (
        /* ════════════════════════════════════════
           PHRASE MANAGEMENT SECTION
           ════════════════════════════════════════ */
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-display text-4xl text-tv-red dark:text-tv-gold uppercase tracking-wide">
              {t("admin.hosts.phrases_title")}
            </h1>
            <Button
              onClick={openPhraseCreate}
              className="buzzer-btn rounded-xl px-5 bg-tv-red text-white font-bold uppercase tracking-wider hover:bg-tv-red-dark shadow-md"
            >
              {t("admin.hosts.phrases_add")}
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-48">
              <Select
                label={t("admin.hosts.phrases_context_filter")}
                placeholder={t("admin.hosts.phrases_all_contexts")}
                value={contextFilter}
                onChange={(e) => setContextFilter(e.target.value)}
                groups={filteredContextGroups}
              />
            </div>
            <div className="w-44">
              <Select
                label={t("admin.hosts.phrases_lang_filter")}
                value={langFilter}
                onChange={(e) => setLangFilter(e.target.value)}
                options={[
                  { value: "", label: t("admin.hosts.phrases_all_languages") },
                  ...LANGUAGES,
                ]}
              />
            </div>
            <div className="w-40">
              <Select
                label={t("admin.hosts.phrases_scope")}
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value)}
                options={[
                  { value: "", label: t("admin.hosts.phrases_all_scopes") },
                  ...SCOPES,
                ]}
              />
            </div>
            <div className="flex items-end pb-1">
              <Button
                type="button"
                onClick={() => {
                  setContextFilter("");
                  setLangFilter("");
                  setScopeFilter("");
                }}
                className="rounded-xl font-bold text-sm px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border-2 border-gray-300 dark:border-gray-600"
              >
                {t("admin.hosts.phrases_reset_filters")}
              </Button>
            </div>
          </div>

          {phraseError && (
            <div className="rounded-2xl bg-red-100 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300 px-4 py-3 text-sm font-medium animate-fade-in-up">
              {phraseError}
            </div>
          )}
          {phraseSuccess && (
            <div className="rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 border-2 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 px-4 py-3 text-sm font-medium animate-fade-in-up">
              {phraseSuccess}
            </div>
          )}

          {phraseLoading ? (
            <p className="text-gray-500 dark:text-gray-400">
              {t("common.loading")}
            </p>
          ) : paginatedPhrases.length === 0 ? (
            <Card className="rounded-3xl p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                {t("admin.hosts.phrases_no_phrases")}
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {paginatedPhrases.map((p) => (
                <Card
                  key={p.id}
                  className={`rounded-2xl p-4 flex items-start gap-3 transition-shadow ${
                    p.isDefault
                      ? "opacity-70 hover:opacity-90"
                      : "hover:shadow-md"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {p.isDefault && (
                        <span className="font-mono text-xs font-bold bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-md border border-dashed border-gray-400 dark:border-gray-500">
                          DÉFAUT
                        </span>
                      )}
                      <span className="font-mono text-xs font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-md">
                        {CONTEXT_LABELS[p.context] ?? p.context}
                      </span>
                      <span className="font-mono text-xs uppercase font-bold text-gray-500 dark:text-gray-400">
                        {p.lang}
                      </span>
                      {!p.isDefault && (
                        <>
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            &bull; {p.scope}
                          </span>
                        </>
                      )}
                    </div>
                    <p
                      className={`mt-1 text-sm ${p.isDefault ? "text-gray-500 dark:text-gray-400 italic" : "text-gray-800 dark:text-gray-200"}`}
                    >
                      {p.text}
                    </p>
                  </div>
                  {!p.isDefault && (
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        onClick={() => openPhraseEdit(p as unknown as Phrase)}
                        className="rounded-xl !p-2 !px-3 text-sm"
                        title={t("admin.hosts.edit")}
                      >
                        ✎
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          confirmDeletePhrase(p as unknown as Phrase)
                        }
                        className="rounded-xl !p-2 !px-3 text-sm text-red-600 hover:text-red-700"
                        title={t("admin.hosts.delete")}
                      >
                        ✕
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {phraseDisplayEntries.length > PHRASE_PAGE_SIZE && (
            <div className="flex items-center justify-center gap-4 pt-2">
              <Button
                variant="ghost"
                disabled={phrasePage <= 1}
                onClick={() => setPhrasePage((p) => Math.max(1, p - 1))}
                className="rounded-xl font-bold"
              >
                ←
              </Button>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t("admin.hosts.phrases_page")} {phrasePage} /{" "}
                {totalPhrasePages}
              </span>
              <Button
                variant="ghost"
                disabled={phrasePage >= totalPhrasePages}
                onClick={() => setPhrasePage((p) => p + 1)}
                className="rounded-xl font-bold"
              >
                →
              </Button>
            </div>
          )}

          {/* ── Phrase modal (create/edit) ── */}
          {phraseModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <Card className="rounded-3xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                <form onSubmit={handlePhraseSubmit} className="space-y-4">
                  <h2 className="font-display text-2xl text-tv-red dark:text-tv-gold uppercase tracking-wide">
                    {phraseEditing
                      ? t("admin.hosts.phrases_edit")
                      : t("admin.hosts.phrases_add")}
                  </h2>

                  {phraseError && (
                    <div className="rounded-xl bg-red-100 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300 px-3 py-2 text-sm font-medium">
                      {phraseError}
                    </div>
                  )}

                  {/* Context */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                      {t("admin.hosts.phrases_context")}
                    </label>
                    <select
                      value={phraseForm.context}
                      onChange={(e) =>
                        setPhraseForm({
                          ...phraseForm,
                          context: e.target.value,
                          scope: e.target.value
                            ? getScopeFromContext(e.target.value)
                            : "game",
                        })
                      }
                      required
                      className="mt-1 block w-full rounded-xl border-2 border-rose-200 dark:border-rose-900/50 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm shadow-sm focus:border-tv-gold focus:outline-none dark:text-gray-100 transition-colors cursor-pointer"
                    >
                      <option value="">
                        — {t("admin.hosts.phrases_context")} —
                      </option>
                      {contextGroups.map((g) => (
                        <optgroup
                          key={g.category}
                          label={CATEGORY_LABELS[g.category] ?? g.category}
                        >
                          {g.contexts.map((c) => (
                            <option key={c} value={c}>
                              {CONTEXT_LABELS[c] ?? c}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    {selectedContextVars.length > 0 && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 italic break-words">
                        {t("admin.hosts.phrases_variables_hint", {
                          vars: selectedContextVars
                            .map((v) => `{{${v}}}`)
                            .join(", "),
                        })}
                      </p>
                    )}
                  </div>

                  {/* Language */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                      {t("admin.hosts.phrases_lang")}
                    </label>
                    <div className="flex gap-4">
                      {LANGUAGES.map((l) => (
                        <label
                          key={l.value}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="phrase-lang"
                            value={l.value}
                            checked={phraseForm.lang === l.value}
                            onChange={() =>
                              setPhraseForm({
                                ...phraseForm,
                                lang: l.value as "fr" | "en",
                              })
                            }
                            className="accent-tv-red"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {l.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Text */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                      {t("admin.hosts.phrases_text")}
                    </label>
                    <textarea
                      value={phraseForm.text}
                      onChange={(e) =>
                        setPhraseForm({ ...phraseForm, text: e.target.value })
                      }
                      required
                      rows={3}
                      placeholder={
                        selectedContextVars.length > 0
                          ? `Saisissez le texte. Utilisez {{${selectedContextVars.join("}}, {{")}}}`
                          : t("admin.hosts.phrases_text")
                      }
                      className="mt-1 block w-full rounded-xl border-2 border-rose-200 dark:border-rose-900/50 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm shadow-sm focus:border-tv-gold focus:outline-none dark:text-gray-100 transition-colors resize-none"
                    />
                    {selectedContextVars.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          Variables :
                        </span>
                        {selectedContextVars.map((v) => (
                          <span
                            key={v}
                            title={VARIABLE_DESCRIPTIONS[v] ?? v}
                            className="inline-flex items-center gap-1 font-mono text-[11px] bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-700"
                          >
                            {"{{"}
                            {v}
                            {"}}"}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={closePhraseModal}
                      className="rounded-xl font-bold"
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button
                      type="submit"
                      disabled={phraseSaving || !phraseForm.text.trim()}
                      className="rounded-xl font-bold"
                    >
                      {t("admin.users.save")}
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          )}

          {/* ── Delete confirmation modal ── */}
          {phraseToDelete && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <Card className="rounded-3xl p-6 w-full max-w-sm shadow-2xl">
                <h3 className="font-display text-xl text-tv-red dark:text-tv-gold uppercase tracking-wide mb-2">
                  {t("admin.hosts.phrases_confirm_delete")}
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 italic">
                  &ldquo;{phraseToDelete.text}&rdquo;
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setPhraseToDelete(null)}
                    className="rounded-xl font-bold"
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={handleDeletePhrase}
                    className="rounded-xl font-bold"
                  >
                    {t("admin.hosts.delete")}
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
