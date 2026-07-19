import { useEffect, useState } from "react";
import HostAvatar from "./HostAvatar";
import HostBubble, { type HostVariant } from "./HostBubble";
import type { AvatarConfig, HostExpression } from "./AvatarRenderer";

export type { HostExpression, AvatarConfig };
export type { HostVariant };

export interface HostConfigProps {
  hostName?: string;
  hostAvatarType?: "BUILTIN" | "UPLOAD" | "URL";
  hostAvatarConfig?: AvatarConfig;
  hostAvatarUrl?: string | null;
}

export type HostPresenterProps = {
  message: string;
  expression?: HostExpression;
  variant?: HostVariant;
  className?: string;
  position?: "bottom-right" | "bottom-left" | "inline";
  avatarSize?: "sm" | "md" | "lg";
  typing?: boolean;
  autoHide?: number;
  onHide?: () => void;
} & HostConfigProps;

export default function HostPresenter({
  message,
  expression = "smile",
  variant = "default",
  className = "",
  position = "bottom-right",
  avatarSize = "md",
  typing = true,
  autoHide,
  onHide,
  hostName,
  hostAvatarType,
  hostAvatarConfig,
  hostAvatarUrl,
}: HostPresenterProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!autoHide) return;
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      onHide?.();
    }, autoHide);
    return () => clearTimeout(timer);
  }, [autoHide, message, onHide]);

  if (!visible) return null;

  const positionClasses = {
    "bottom-right": "fixed bottom-6 right-6 z-40 flex items-end gap-3 max-w-md",
    "bottom-left": "fixed bottom-6 left-6 z-40 flex items-end gap-3 max-w-md",
    inline: "flex items-end gap-3 w-full",
  };

  return (
    <div
      className={`${positionClasses[position]} ${className} animate-slide-in-right`}
    >
      <div className="flex flex-col items-end">
        <HostBubble
          message={message}
          variant={variant}
          typing={typing}
          name={hostName}
          className="shadow-2xl"
        />
      </div>
      <HostAvatar
        expression={expression}
        size={avatarSize}
        avatarType={hostAvatarType}
        avatarConfig={hostAvatarConfig}
        avatarUrl={hostAvatarUrl}
      />
    </div>
  );
}
