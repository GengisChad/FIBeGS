import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChildProfile } from "@/hooks/useParentRole";
import { User } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ChildProfile[];
  parentName: string;
  parentAvatarUrl: string | null;
  alreadyRegisteredUserIds: string[];
  alreadyRegisteredChildIds: string[];
  onConfirm: (registerSelf: boolean, childIds: string[]) => void;
  loading?: boolean;
}

export const ParentRegistrationDialog = ({
  open,
  onOpenChange,
  children,
  parentName,
  parentAvatarUrl,
  alreadyRegisteredUserIds,
  alreadyRegisteredChildIds,
  onConfirm,
  loading,
}: Props) => {
  const parentAlreadyRegistered = alreadyRegisteredUserIds.length > 0;
  const [registerSelf, setRegisterSelf] = useState(!parentAlreadyRegistered);
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setRegisterSelf(!parentAlreadyRegistered);
      setSelectedChildren([]);
    }
  }, [open, parentAlreadyRegistered]);

  const toggleChild = (id: string) => {
    setSelectedChildren((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleConfirm = () => {
    if (!registerSelf && selectedChildren.length === 0) return;
    onConfirm(registerSelf, selectedChildren);
  };

  const nothingSelected = !registerSelf && selectedChildren.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chi vuoi iscrivere?</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {/* Self */}
          <label className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border cursor-pointer hover:bg-secondary/80 transition-colors">
            <Checkbox
              checked={registerSelf}
              onCheckedChange={(c) => setRegisterSelf(!!c)}
              disabled={parentAlreadyRegistered}
            />
            <Avatar className="h-8 w-8">
              {parentAvatarUrl && <AvatarImage src={parentAvatarUrl} />}
              <AvatarFallback className="bg-primary/20 text-primary">
                <User size={14} />
              </AvatarFallback>
            </Avatar>
            <span className="font-medium">{parentName}</span>
            {parentAlreadyRegistered && (
              <span className="text-xs text-muted-foreground ml-auto">Già iscritto</span>
            )}
          </label>

          {/* Children */}
          {children.map((child) => {
            const alreadyRegistered = alreadyRegisteredChildIds.includes(child.id);
            return (
              <label
                key={child.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border cursor-pointer hover:bg-secondary/80 transition-colors"
              >
                <Checkbox
                  checked={selectedChildren.includes(child.id) || alreadyRegistered}
                  onCheckedChange={() => toggleChild(child.id)}
                  disabled={alreadyRegistered}
                />
                <Avatar className="h-8 w-8">
                  {child.avatar_url && <AvatarImage src={child.avatar_url} />}
                  <AvatarFallback className="bg-primary/20 text-primary font-bold text-xs">
                    {child.display_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium">{child.display_name}</span>
                {alreadyRegistered && (
                  <span className="text-xs text-muted-foreground ml-auto">Già iscritto</span>
                )}
              </label>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleConfirm} disabled={nothingSelected || loading}>
            {loading ? "Iscrizione..." : "Conferma iscrizione"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
