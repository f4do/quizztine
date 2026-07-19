import { useHost } from "../../lib/HostProvider";
import HostPresenter, {
  type HostConfigProps,
  type HostPresenterProps,
} from "./HostPresenter";

type ProviderDrivenProps = Omit<HostPresenterProps, keyof HostConfigProps>;

/**
 * AppHostPresenter — HostPresenter that automatically picks up the active
 * host's name, avatar and accent color from the HostProvider context.
 *
 * Use this instead of <HostPresenter /> anywhere in the app, so that the
 * host config is data-driven from the backend.
 */
export default function AppHostPresenter(props: ProviderDrivenProps) {
  const { host } = useHost();
  return (
    <HostPresenter
      {...props}
      hostName={host.name}
      hostAvatarType={host.avatarType}
      hostAvatarConfig={host.avatarConfig}
      hostAvatarUrl={host.avatarUrl}
    />
  );
}
