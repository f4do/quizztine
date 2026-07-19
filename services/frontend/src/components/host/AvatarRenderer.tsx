import Avatar from "@vierweb/avataaars";

export type HostExpression =
  | "smile"
  | "focused"
  | "surprised"
  | "applause"
  | "console";

export interface AvatarConfig {
  topType: string;
  hairColor: string;
  accessoriesType: string;
  facialHairType: string;
  facialHairColor: string;
  clotheType: string;
  clotheColor: string;
  skinColor: string;
  spotColor?: string;
}

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  topType: "LongHairStraight2",
  hairColor: "Red",
  accessoriesType: "Blank",
  facialHairType: "Blank",
  facialHairColor: "Blank",
  clotheType: "ShirtVNeck",
  clotheColor: "Pink",
  skinColor: "Brown",
};

const EXPRESSION_CONFIG: Record<
  HostExpression,
  { eyeType: string; eyebrowType: string; mouthType: string }
> = {
  smile: {
    eyeType: "Happy",
    eyebrowType: "DefaultNatural",
    mouthType: "Smile",
  },
  focused: {
    eyeType: "Squint",
    eyebrowType: "DefaultNatural",
    mouthType: "Serious",
  },
  surprised: {
    eyeType: "Surprised",
    eyebrowType: "RaisedExcited",
    mouthType: "Twinkle",
  },
  applause: {
    eyeType: "Happy",
    eyebrowType: "RaisedExcited",
    mouthType: "Smile",
  },
  console: {
    eyeType: "Default",
    eyebrowType: "SadConcerned",
    mouthType: "Concerned",
  },
};

export default function AvatarRenderer({
  config,
  expression,
  size,
}: {
  config?: AvatarConfig;
  expression?: HostExpression;
  size?: number;
}) {
  const c = config ?? DEFAULT_AVATAR_CONFIG;
  const expr = EXPRESSION_CONFIG[expression ?? "smile"];
  const px = size ?? 64;

  return (
    <Avatar
      avatarStyle="Transparent"
      style={{ width: px, height: px }}
      topType={c.topType}
      hairColor={c.hairColor}
      accessoriesType={c.accessoriesType}
      facialHairType={c.facialHairType}
      facialHairColor={c.facialHairColor}
      clotheType={c.clotheType}
      clotheColor={c.clotheColor}
      skinColor={c.skinColor}
      eyeType={expr.eyeType}
      eyebrowType={expr.eyebrowType}
      mouthType={expr.mouthType}
    />
  );
}
