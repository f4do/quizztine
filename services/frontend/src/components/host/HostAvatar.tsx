import { mediaUrl } from "../../lib/api";
import AvatarRenderer, {
  type HostExpression,
  type AvatarConfig,
  DEFAULT_AVATAR_CONFIG,
} from "./AvatarRenderer";

interface HostAvatarProps {
  expression?: HostExpression;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  avatarType?: "BUILTIN" | "UPLOAD" | "URL";
  avatarConfig?: AvatarConfig;
  avatarUrl?: string | null;
}

const sizes = {
  sm: "w-12 h-12",
  md: "w-16 h-16",
  lg: "w-24 h-24",
  xl: "w-40 h-40",
};

const sizePxMap = { sm: 48, md: 64, lg: 96, xl: 160 };

export default function HostAvatar({
  expression = "smile",
  size = "md",
  className = "",
  avatarType = "BUILTIN",
  avatarConfig,
  avatarUrl,
}: HostAvatarProps) {
  const px = sizePxMap[size] || 64;
  const spot = avatarConfig?.spotColor;

  function renderSpotBg(className = "") {
      if (spot) {
        return (
          <div
            className={`absolute inset-0 rounded-full animate-float ${className}`}
            style={{
              background: `linear-gradient(135deg, ${spot}, ${spot}dd, ${spot})`,
              boxShadow: `0 4px 20px ${spot}66`,
            }}
          />
        );
      }
    return <div className={`absolute inset-0 rounded-full bg-gradient-to-br from-tv-gold via-yellow-300 to-tv-gold-dark shadow-lg animate-float ${className}`} />;
  }

  // Non-builtin avatars: static image, expressions don't apply
  if (avatarType === "UPLOAD" || avatarType === "URL") {
    const src = mediaUrl(avatarUrl) ?? avatarUrl ?? "";
    return (
      <div
        className={`relative shrink-0 ${sizes[size]} ${className}`}
        aria-label="Host avatar"
      >
        {renderSpotBg()}
        {src ? (
          <img
            src={src}
            alt="Host"
            className="relative z-10 w-full h-full rounded-full object-cover border-2 border-white/40 drop-shadow-md"
          />
        ) : (
          <div className="relative z-10 w-full h-full rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center text-gray-500 text-xs">
            ?
          </div>
        )}
        {/* TV sparkle */}
        <div
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full blur-[2px] opacity-80"
          style={{ backgroundColor: spot ? spot : "#FFD700" }}
        />
      </div>
    );
  }

  return (
    <div className={`relative shrink-0 ${sizes[size]} ${className}`}>
      {renderSpotBg()}
      <AvatarRenderer
        config={avatarConfig}
        expression={expression}
        size={px}
      />
      {/* TV sparkle */}
      <div
        className="absolute -top-1 -right-1 w-4 h-4 rounded-full blur-[2px] opacity-80"
        style={{ backgroundColor: spot ? spot : "#FFD700" }}
      />
    </div>
  );
}
