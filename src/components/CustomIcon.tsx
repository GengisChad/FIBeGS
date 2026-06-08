import { useState, lazy, Suspense } from "react";
import type { LucideIcon } from "lucide-react";
import { Pencil } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { useCustomIcon, isLiveSite } from "@/hooks/useCustomIcons";
import { cn } from "@/lib/utils";

const IconUploadDialog = lazy(() => import("./IconUploadDialog"));

type Props = {
  iconKey: string;
  fallback: LucideIcon;
  size?: number;
  className?: string;
  editable?: boolean;
};

export const CustomIcon = ({
  iconKey,
  fallback: Fallback,
  size = 16,
  className,
  editable = true,
}: Props) => {
  const override = useCustomIcon(iconKey);
  const { isAdmin } = useAdmin();
  const [open, setOpen] = useState(false);
  const live = isLiveSite();

  const showOverride = !live && !!override?.image_url;
  const showEdit = isAdmin && editable && !live;

  return (
    <span
      className="inline-flex items-center justify-center relative"
      style={{ width: size, height: size, lineHeight: 0 }}
    >
      {showOverride ? (
        <img
          src={override!.image_url}
          alt=""
          width={size}
          height={size}
          className={cn("object-contain", className)}
          style={{ width: size, height: size }}
          draggable={false}
        />
      ) : (
        <Fallback size={size} className={className} />
      )}

      {showEdit && (
        <button
          type="button"
          aria-label={`Modifica icona ${iconKey}`}
          title={`Personalizza icona (${iconKey})`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
          className="absolute -top-1.5 -right-1.5 z-10 grid place-items-center h-3.5 w-3.5 rounded-full bg-primary text-primary-foreground shadow ring-1 ring-background hover:scale-110 transition-transform"
        >
          <Pencil size={8} strokeWidth={2.5} />
        </button>
      )}

      {open && (
        <Suspense fallback={null}>
          <IconUploadDialog
            iconKey={iconKey}
            currentUrl={override?.image_url || null}
            open={open}
            onOpenChange={setOpen}
          />
        </Suspense>
      )}
    </span>
  );
};

export default CustomIcon;
