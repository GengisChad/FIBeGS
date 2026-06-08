export const BetaBadge = ({ className = "" }: { className?: string }) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-primary/15 text-primary border border-primary/40 ${className}`}
  >
    ● Beta
  </span>
);
