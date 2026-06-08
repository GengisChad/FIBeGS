import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FindTeamPanel } from "./FindTeamPanel";

interface Props { open: boolean; onOpenChange: (v: boolean) => void; }

export const FindTeamDialog = ({ open, onOpenChange }: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
      <DialogHeader><DialogTitle>Trova una Team</DialogTitle></DialogHeader>
      <div className="flex-1 min-h-0">
        <FindTeamPanel scrollClassName="max-h-[60vh]" />
      </div>
    </DialogContent>
  </Dialog>
);

export default FindTeamDialog;
