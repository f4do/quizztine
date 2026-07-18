type Expression = "smile" | "focused" | "surprised" | "applause" | "console";

interface ChristineAvatarProps {
  expression?: Expression;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "w-12 h-12",
  md: "w-16 h-16",
  lg: "w-24 h-24",
};

export default function ChristineAvatar({
  expression = "smile",
  size = "md",
  className = "",
}: ChristineAvatarProps) {
  const eyes = {
    smile: (
      <>
        <ellipse cx="26" cy="38" rx="4" ry="5" fill="#1a0b1a" />
        <ellipse cx="54" cy="38" rx="4" ry="5" fill="#1a0b1a" />
        <path
          d="M22 34 Q26 30 30 34"
          stroke="#1a0b1a"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M50 34 Q54 30 58 34"
          stroke="#1a0b1a"
          strokeWidth="2"
          fill="none"
        />
      </>
    ),
    focused: (
      <>
        <ellipse cx="26" cy="38" rx="4" ry="5" fill="#1a0b1a" />
        <ellipse cx="54" cy="38" rx="4" ry="5" fill="#1a0b1a" />
        <path d="M20 34 L32 34" stroke="#1a0b1a" strokeWidth="2" />
        <path d="M48 34 L60 34" stroke="#1a0b1a" strokeWidth="2" />
      </>
    ),
    surprised: (
      <>
        <circle cx="26" cy="38" r="5" fill="#1a0b1a" />
        <circle cx="54" cy="38" r="5" fill="#1a0b1a" />
        <circle cx="27" cy="37" r="1.5" fill="white" />
        <circle cx="55" cy="37" r="1.5" fill="white" />
      </>
    ),
    applause: (
      <>
        <path
          d="M22 38 Q26 32 30 38"
          stroke="#1a0b1a"
          strokeWidth="2.5"
          fill="none"
        />
        <path
          d="M50 38 Q54 32 58 38"
          stroke="#1a0b1a"
          strokeWidth="2.5"
          fill="none"
        />
      </>
    ),
    console: (
      <>
        <ellipse cx="26" cy="40" rx="4" ry="5" fill="#1a0b1a" />
        <ellipse cx="54" cy="40" rx="4" ry="5" fill="#1a0b1a" />
        <path
          d="M22 48 Q40 55 58 48"
          stroke="#1a0b1a"
          strokeWidth="2"
          fill="none"
        />
      </>
    ),
  };

  const mouths = {
    smile: (
      <path
        d="M32 52 Q40 60 48 52"
        stroke="#1a0b1a"
        strokeWidth="2.5"
        fill="none"
      />
    ),
    focused: (
      <path
        d="M34 56 Q40 54 46 56"
        stroke="#1a0b1a"
        strokeWidth="2.5"
        fill="none"
      />
    ),
    surprised: <ellipse cx="40" cy="55" rx="5" ry="6" fill="#1a0b1a" />,
    applause: (
      <path
        d="M34 54 Q40 62 46 54"
        stroke="#1a0b1a"
        strokeWidth="2.5"
        fill="none"
      />
    ),
    console: (
      <path
        d="M35 58 Q40 55 45 58"
        stroke="#1a0b1a"
        strokeWidth="2.5"
        fill="none"
      />
    ),
  };

  return (
    <div className={`relative shrink-0 ${sizes[size]} ${className}`}>
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-tv-gold via-yellow-300 to-tv-gold-dark shadow-lg animate-float" />
      <svg
        viewBox="0 0 80 80"
        className="relative z-10 w-full h-full drop-shadow-md"
      >
        {/* Hair */}
        <path
          d="M12 36 C8 18, 24 6, 40 6 C56 6, 72 18, 68 36 C74 30, 74 48, 68 58 C72 64, 62 70, 40 70 C18 70, 8 64, 12 58 C6 48, 6 30, 12 36"
          fill="#8B4513"
        />
        <path
          d="M16 28 C20 16, 30 10, 40 10 C50 10, 60 16, 64 28"
          fill="#A0522D"
        />
        {/* Face */}
        <ellipse cx="40" cy="42" rx="23" ry="25" fill="#F5D0B0" />
        {eyes[expression]}
        {mouths[expression]}
        {/* Blush */}
        <ellipse
          cx="24"
          cy="52"
          rx="4"
          ry="2.5"
          fill="rgba(255, 100, 100, 0.2)"
        />
        <ellipse
          cx="56"
          cy="52"
          rx="4"
          ry="2.5"
          fill="rgba(255, 100, 100, 0.2)"
        />
        {/* Headset microphone */}
        <path
          d="M63 44 C70 44, 70 58, 58 60"
          stroke="#444"
          strokeWidth="2.5"
          fill="none"
        />
        <circle cx="57" cy="60" r="4.5" fill="#333" />
        <circle cx="57" cy="60" r="2" fill="#777" />
      </svg>
      {/* TV sparkle */}
      <div className="absolute -top-1 -right-1 w-4 h-4 bg-tv-gold rounded-full blur-[2px] opacity-80" />
    </div>
  );
}
