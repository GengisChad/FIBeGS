import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const ComingSoon = ({ title, onBack }: { title: string; onBack: () => void }) => (
  <div className="space-y-4">
    <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />Indietro</Button>
    <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
      <div className="text-6xl mb-4">🚧</div>
      <h2 className="text-2xl font-bold mb-2">{title}</h2>
      <p className="text-muted-foreground">In arrivo nella prossima iterazione della BETA.</p>
    </div>
  </div>
);
