import fibegsLogo from "@/assets/brand/fibegs-logo-ice.png";

interface BrandLogoProps {
  className?: string;
  alt?: string;
  /** Forces a specific variant (kept for backwards compatibility — FIBeGS logo works on any bg) */
  variant?: "auto" | "dark" | "light";
}

/**
 * FIBeGS brand logo (transparent PNG, ships from /public).
 * Single asset that works on dark or light themes — no variant swap needed.
 */
export const BrandLogo = ({ className, alt = "FIBeGS - FIBeGS" }: BrandLogoProps) => {
  return <img src={fibegsLogo} alt={alt} className={className} loading="lazy" decoding="async" />;
};

export const fibLogoDarkUrl = fibegsLogo;
export const fibLogoLightUrl = fibegsLogo;
