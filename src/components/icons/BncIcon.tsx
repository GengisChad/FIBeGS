import { cn } from "@/lib/utils";

/**
 * BncIcon — le 40 icone custom FIBeGS, monocromatiche e theme-adaptive.
 * Renderizza via <use> dallo sprite in /public/icons.svg, fill="currentColor"
 * → eredita il colore dal contesto (segue i 27 temi, niente colore cablato).
 *
 *   <BncIcon name="elo" />
 *   <BncIcon name="crown" size={20} className="text-primary" />
 *
 * Per usarla come fallback di <CustomIcon> (che chiama <Fallback size className/>):
 *   <CustomIcon iconKey="arena.wins" fallback={bncFallback("crown")} size={56} />
 */

export type BncIconName =
  | "profile" | "edit" | "settings" | "bell" | "mail" | "logout"
  | "arena" | "versus" | "bracket" | "registration" | "medal" | "target"
  | "stats" | "ladder" | "elo" | "podium" | "points" | "crown"
  | "deck" | "add" | "vortex" | "element" | "comet" | "customize"
  | "club" | "friends" | "rank-crown" | "community" | "star-hex" | "gavel"
  | "rank-insignia" | "verified" | "support" | "news" | "calendar" | "chat"
  | "ranking" | "italy" | "federation" | "cards"
  | "bolt" | "trophy" | "search" | "video";

type Props = {
  name: BncIconName;
  size?: number;
  className?: string;
  strokeWidth?: number; // accettato per compat con LucideIcon, ignorato (icone fill)
};

export const BncIcon = ({ name, size = 24, className }: Props) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 600 600"
    fill="currentColor"
    aria-hidden="true"
    className={cn("inline-block shrink-0", className)}
  >
    {/* lo sprite va in /public/icons.svg — se il sito è deployato in un subpath,
        usa import.meta.env.BASE_URL invece di "/" */}
    <use href={`/icons.svg#ic-${name}`} />
  </svg>
);

/** Adapter: produce un componente compatibile con il prop `fallback` di CustomIcon. */
export const bncFallback =
  (name: BncIconName) =>
  ({ size, className }: { size?: number; className?: string }) =>
    <BncIcon name={name} size={size} className={className} />;

export default BncIcon;
