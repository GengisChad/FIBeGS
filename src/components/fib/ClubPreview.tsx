import { Plus } from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import { ClubCard } from "./ClubCard";
import type { Club } from "@/lib/fib-data";

export function ClubPreview({ clubs }: { clubs: Club[] }) {
  return (
    <section>
      <SectionHeader title="Club in evidenza" action="Vedi tutti" />
      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-4 lg:overflow-visible">
        {clubs.map((c) => <ClubCard key={c.id} club={c} />)}
        <button className="grid w-36 shrink-0 place-items-center rounded-2xl border border-dashed border-violet/40 bg-violet/[0.05] p-3 text-center text-xs font-semibold text-violet transition hover:bg-violet/10 lg:w-auto">
          <span><Plus className="mx-auto mb-1 h-5 w-5" />Scopri altri club</span>
        </button>
      </div>
    </section>
  );
}
