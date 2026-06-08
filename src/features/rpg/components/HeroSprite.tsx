import maleSheet from "../assets/hero_male_sheet.png";
import femaleSheet from "../assets/hero_female_sheet.png";
import { Gender } from "../data/cosmetics";

export type HeroView = "front" | "diagonal" | "back";

// Sheets are a 3x2 grid: row0 = [front 3/4, back, front], row1 = [side L, back 3/4, front 3/4 opp]
const POSITIONS: Record<HeroView, string> = {
  front: "100% 0%",
  diagonal: "0% 0%",
  back: "50% 0%",
};

interface Props {
  gender?: Gender;
  view?: HeroView;
  size?: number;
  className?: string;
  flip?: boolean;
}

export const HeroSprite = ({ gender = "male", view = "front", size = 160, className = "", flip = false }: Props) => {
  const url = gender === "male" ? maleSheet : femaleSheet;
  // Each cell ≈ 2:3 aspect
  const height = Math.round(size * (3 / 2));
  return (
    <div
      role="img"
      aria-label={`Personaggio ${gender} ${view}`}
      className={className}
      style={{
        width: size,
        height,
        backgroundImage: `url(${url})`,
        backgroundSize: "300% 200%",
        backgroundPosition: POSITIONS[view],
        backgroundRepeat: "no-repeat",
        imageRendering: "pixelated",
        transform: flip ? "scaleX(-1)" : undefined,
      }}
    />
  );
};
