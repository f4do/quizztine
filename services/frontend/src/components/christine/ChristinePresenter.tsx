import { useEffect, useState } from "react";
import ChristineAvatar from "./ChristineAvatar";
import ChristineBubble from "./ChristineBubble";

export type ChristineExpression =
  "smile" | "focused" | "surprised" | "applause" | "console";
export type ChristineVariant = "default" | "success" | "error" | "warning";

interface ChristinePresenterProps {
  message: string;
  expression?: ChristineExpression;
  variant?: ChristineVariant;
  className?: string;
  position?: "bottom-right" | "bottom-left" | "inline";
  avatarSize?: "sm" | "md" | "lg";
  typing?: boolean;
  autoHide?: number;
  onHide?: () => void;
}

export default function ChristinePresenter({
  message,
  expression = "smile",
  variant = "default",
  className = "",
  position = "bottom-right",
  avatarSize = "md",
  typing = true,
  autoHide,
  onHide,
}: ChristinePresenterProps) {
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
        <ChristineBubble
          text={message}
          variant={variant}
          typing={typing}
          className="shadow-2xl"
        />
      </div>
      <ChristineAvatar expression={expression} size={avatarSize} />
    </div>
  );
}
