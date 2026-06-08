import maleSheet from "../assets/hero_male_sheet.png";
import femaleSheet from "../assets/hero_female_sheet.png";
import mShortBrown from "../assets/hairs/m_short_brown.png.asset.json";
import shortBlonde from "../assets/hairs/short_blonde.png.asset.json";
import spikyRed from "../assets/hairs/spiky_red.png.asset.json";
import buzzWhite from "../assets/hairs/buzz_white.png.asset.json";
import mohawkCyan from "../assets/hairs/mohawk_cyan.png.asset.json";
import longDark from "../assets/hairs/long_dark.png.asset.json";
import twinPink from "../assets/hairs/twin_pink.png.asset.json";
import bobBlonde from "../assets/hairs/bob_blonde.png.asset.json";
import ponytailPurple from "../assets/hairs/ponytail_purple.png.asset.json";
import braidsSilver from "../assets/hairs/braids_silver.png.asset.json";
import { Gender } from "../data/cosmetics";

export type HeroView = "front" | "diagonal" | "back";

const POSITIONS: Record<HeroView, string> = {
  front: "100% 0%",
  diagonal: "0% 0%",
  back: "50% 0%",
};

const HAIR_SHEETS: Partial<Record<string, { url: string; gender: Gender }>> = {
  short_dark: { url: mShortBrown.url, gender: "male" },
  short_blonde: { url: shortBlonde.url, gender: "male" },
  spiky_red: { url: spikyRed.url, gender: "male" },
  buzz_white: { url: buzzWhite.url, gender: "male" },
  mohawk_cyan: { url: mohawkCyan.url, gender: "male" },
  long_dark: { url: longDark.url, gender: "female" },
  twin_pink: { url: twinPink.url, gender: "female" },
  bob_blonde: { url: bobBlonde.url, gender: "female" },
  ponytail_purple: { url: ponytailPurple.url, gender: "female" },
  braids_silver: { url: braidsSilver.url, gender: "female" },
};

interface Props {
  gender?: Gender;
  view?: HeroView;
  size?: number;
  hair?: string;
  eyes?: string;
  skin?: string;
  outfit?: string;
  animated?: boolean;
  flip?: boolean;
  className?: string;
}

export const HDAvatar = ({
  gender = "male",
  view = "front",
  size = 160,
  hair = "short_dark",
  animated = true,
  flip = false,
  className = "",
}: Props) => {
  const height = Math.round(size * (3 / 2));
  const baseSheet = gender === "male" ? maleSheet : femaleSheet;
  const hairSheet = HAIR_SHEETS[hair];
  const activeSheet = hairSheet && hairSheet.gender === gender ? hairSheet.url : baseSheet;

  return (
    <div className={`relative ${className}`} style={{ width: size, height }} aria-label={`Personaggio HD ${gender} ${view}`} role="img">
      <div
        className={`absolute inset-0 drop-shadow-[0_18px_18px_hsl(var(--background)/0.55)] ${animated ? "animate-[pulse_3s_ease-in-out_infinite]" : ""}`}
        style={{ transform: flip ? "scaleX(-1)" : undefined, transformOrigin: "center" }}
      >
        <div
          className="absolute inset-0 bg-contain bg-no-repeat"
          style={{
            backgroundImage: `url(${activeSheet})`,
            backgroundSize: "300% 200%",
            backgroundPosition: POSITIONS[view],
          }}
        />
      </div>
      <div className="absolute left-1/2 bottom-2 h-4 w-3/5 -translate-x-1/2 rounded-full bg-foreground/20 blur-md" />
    </div>
  );
};
