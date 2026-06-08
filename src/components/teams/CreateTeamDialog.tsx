import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreateTeamForm } from "./CreateTeamForm";

interface Props { open: boolean; onOpenChange: (v: boolean) => void; onCreated?: () => void; }

export const CreateTeamDialog = ({ open, onOpenChange, onCreated }: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Crea una Team</DialogTitle></DialogHeader>
      <CreateTeamForm
        onCancel={() => onOpenChange(false)}
        onDone={() => { onOpenChange(false); onCreated?.(); }}
      />
    </DialogContent>
  </Dialog>
);

export default CreateTeamDialog;
