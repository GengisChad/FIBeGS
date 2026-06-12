import { Sparkles } from "lucide-react";
import fibLogo from "@/assets/fib-logo.png";

export function FooterB() {
  return (
    <footer className="relative mt-10 border-t border-white/[0.06] px-6 py-7">
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm text-muted-foreground"><a className="cursor-pointer hover:text-foreground">Contacts</a><a className="cursor-pointer hover:text-foreground">Legal</a><a className="cursor-pointer hover:text-foreground">Info</a></div>
        <img src={fibLogo} alt="FIBeGS" className="h-9 w-auto" />
        <Sparkles className="absolute right-6 top-1 h-5 w-5 text-foreground/60" />
        <div className="flex gap-3 text-muted-foreground">
          {["D", "f", "○", "▶"].map((s, i) => <span key={i} className="text-sm">{s}</span>)}
        </div>
      </div>
      <div className="mt-6 flex h-1 overflow-hidden rounded">
        <span className="flex-1 bg-[#1a8a3a]" /><span className="flex-1 bg-white" /><span className="flex-1 bg-[#c8312b]" />
      </div>
    </footer>
  );
}
