import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import {
  type AvatarConfig,
  DEFAULT_AVATAR_CONFIG,
} from "../components/host/AvatarRenderer";

export interface HostConfig {
  id: string;
  name: string;
  avatarType: "BUILTIN" | "UPLOAD" | "URL";
  avatarConfig: AvatarConfig;
  avatarUrl: string | null;
}

interface HostContextValue {
  host: HostConfig;
  loading: boolean;
  refetch: () => Promise<void>;
}

const DEFAULT_HOST: HostConfig = {
  id: "default-host",
  name: "Christine",
  avatarType: "BUILTIN",
  avatarConfig: DEFAULT_AVATAR_CONFIG,
  avatarUrl: null,
};

const HostContext = createContext<HostContextValue | null>(null);

export function HostProvider({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HostConfig>(DEFAULT_HOST);
  const [loading, setLoading] = useState(true);

  const fetchHost = useCallback(async () => {
    setLoading(true);
    try {
      const d = (await api("/host/active")) as { host: HostConfig };
      if (d?.host) {
        setHost({
          id: d.host.id,
          name: d.host.name ?? DEFAULT_HOST.name,
          avatarType: d.host.avatarType ?? "BUILTIN",
          avatarConfig: d.host.avatarConfig ?? DEFAULT_HOST.avatarConfig,
          avatarUrl: d.host.avatarUrl ?? null,
        });
      }
    } catch {
      // Fallback to default host on failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHost();
  }, [fetchHost]);

  return (
    <HostContext.Provider value={{ host, loading, refetch: fetchHost }}>
      {children}
    </HostContext.Provider>
  );
}

export function useHost(): HostContextValue {
  const ctx = useContext(HostContext);
  if (!ctx) throw new Error("useHost must be used within HostProvider");
  return ctx;
}
