import type { SVGProps } from "react";

/**
 * ArenaMark — il "marchio arena" (riquadro + cerchio + tacca superiore).
 * SVG inline con stroke="currentColor" → eredita il colore dal contesto
 * (theme-adaptive, segue --primary). Sorgente: src/assets/arena-mark.svg.
 *
 *   <ArenaMark className="arena-mark" />
 */
export const ArenaMark = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 32 32" width="1em" height="1em" fill="none" aria-hidden="true" {...props}>
    <rect x="3.2" y="3.2" width="25.6" height="25.6" rx="6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="16" cy="16" r="9.3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12.7 7.4 L14.6 10 L17.4 10 L19.3 7.4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default ArenaMark;
