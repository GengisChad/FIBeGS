import { useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Nfc, QrCode } from "lucide-react";

interface CheckinQRCodeProps {
  tournamentId: string;
  userId: string;
  displayName: string;
  tournamentTitle: string;
}

const supportsNfc = typeof window !== "undefined" && "NDEFReader" in window;

export const CheckinQRCode = ({ tournamentId, userId, displayName, tournamentTitle }: CheckinQRCodeProps) => {
  const [nfcSending, setNfcSending] = useState(false);
  const checkinData = `checkin:${tournamentId}:${userId}`;

  const sendNfc = useCallback(async () => {
    if (!supportsNfc) return;
    setNfcSending(true);
    try {
      const ndef = new (window as any).NDEFReader();
      await ndef.write({
        records: [{ recordType: "text", data: checkinData }],
      });
      toast.success("Check-in inviato via NFC!");
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        toast.error("Permesso NFC negato");
      } else {
        toast.error("Avvicina il telefono all'organizzatore");
      }
    } finally {
      setNfcSending(false);
    }
  }, [checkinData]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <QrCode size={16} /> Check-in Rapido
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-center text-base">Il tuo Check-in</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <p className="text-sm font-medium text-center">{displayName}</p>
          <p className="text-xs text-muted-foreground text-center">{tournamentTitle}</p>

          {/* QR Code */}
          <div className="bg-white p-3 rounded-xl">
            <QRCodeSVG value={checkinData} size={200} level="M" />
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Mostra questo QR all'organizzatore per fare check-in
          </p>

          {supportsNfc && (
            <>
              <div className="w-full border-t border-border" />
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={sendNfc}
                disabled={nfcSending}
              >
                <Nfc size={16} />
                {nfcSending ? "Avvicina al telefono..." : "Check-in via NFC"}
              </Button>
              <p className="text-[10px] text-muted-foreground text-center">
                Avvicina il telefono a quello dell'organizzatore
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
