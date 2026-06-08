import bg1 from "../assets/bg_level1.jpg";
import bg2 from "../assets/bg_level2.jpg";
import bg3 from "../assets/bg_level3.jpg";
import bg4 from "../assets/bg_level4.jpg";
import bg5 from "../assets/bg_level5.jpg";

export const LEVEL_BACKGROUNDS: Record<number, string> = {
  1: bg1,
  2: bg2,
  3: bg3,
  4: bg4,
  5: bg5,
};

export const getLevelBackground = (id: number) => LEVEL_BACKGROUNDS[id] ?? bg1;
