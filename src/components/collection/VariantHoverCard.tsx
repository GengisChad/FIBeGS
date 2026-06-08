import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Image, Palette } from "lucide-react";
import { ReactNode, useState, useEffect } from "react";

interface LinkedItem {
  id: string;
  name: string;
  image_url: string | null;
}

interface VariantHoverCardProps {
  variant: {
    id: string;
    variant_name: string;
    image_url: string | null;
    component_id: string;
  };
  parentComponent: LinkedItem | null;
  linkedComponents: LinkedItem[];
  children: ReactNode;
}

const VariantHoverCard = ({ variant, parentComponent, linkedComponents, children }: VariantHoverCardProps) => {
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setIsTouchDevice(window.matchMedia("(hover: none)").matches);
  }, []);

  // On touch devices (tablet/mobile), skip hover card entirely to prevent scroll issues
  if (isTouchDevice) {
    return <>{children}</>;
  }

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent className="w-56 p-3 space-y-2" side="top">
        {/* Variant info */}
        <div className="flex items-center gap-2">
          {variant.image_url ? (
            <img src={variant.image_url} alt={variant.variant_name} className="w-10 h-10 rounded object-cover" />
          ) : (
            <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
              <Palette size={14} className="text-muted-foreground" />
            </div>
          )}
          <div>
            <p className="text-xs font-semibold">{variant.variant_name}</p>
            {parentComponent && <p className="text-[10px] text-muted-foreground">{parentComponent.name}</p>}
          </div>
        </div>

        {/* Linked components */}
        {linkedComponents.length > 0 && (
          <div className="border-t border-border pt-2 space-y-1.5">
            <p className="text-[10px] text-muted-foreground uppercase font-medium">Componenti collegati</p>
            {linkedComponents.map(lc => (
              <div key={lc.id} className="flex items-center gap-2">
                {lc.image_url ? (
                  <img src={lc.image_url} alt={lc.name} className="w-7 h-7 rounded object-cover" />
                ) : (
                  <div className="w-7 h-7 bg-muted rounded flex items-center justify-center">
                    <Image size={10} className="text-muted-foreground" />
                  </div>
                )}
                <span className="text-xs">{lc.name}</span>
              </div>
            ))}
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
};

export default VariantHoverCard;
