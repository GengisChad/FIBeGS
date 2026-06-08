import { useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CreditCard, QrCode, Share2 } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";

interface ProfileNfcCardProps {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

const supportsNfc = typeof window !== "undefined" && "NDEFReader" in window;

export const ProfileNfcCard = ({ username, displayName, avatarUrl }: ProfileNfcCardProps) => {
  const [nfcWriting, setNfcWriting] = useState(false);
  const { isAdmin } = useAdmin();
  const profileUrl = `${window.location.origin}/profilo/${username}`;

  const writeNfc = useCallback(async () => {
    if (!supportsNfc) {
      toast.error("NFC non supportato su questo dispositivo");
      return;
    }
    setNfcWriting(true);
    try {
      const ndef = new (window as any).NDEFReader();

      // First, try to read the tag to check if it already has a profile
      await ndef.scan();
      const alreadyWritten = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          ndef.removeEventListener("reading", onReading);
          resolve(false); // No data read in time — tag is empty
        }, 4000);

        const onReading = ({ message }: any) => {
          clearTimeout(timeout);
          ndef.removeEventListener("reading", onReading);
          for (const record of message.records) {
            const decoder = new TextDecoder();
            const data = record.recordType === "url" || record.recordType === "text"
              ? decoder.decode(record.data)
              : "";
            if (data && data.includes("/profilo/")) {
              resolve(true);
              return;
            }
          }
          resolve(false);
        };
        ndef.addEventListener("reading", onReading);
      });

      if (alreadyWritten && !isAdmin) {
        toast.error("Questa tessera è già registrata. Solo un admin può sovrascriverla.");
        setNfcWriting(false);
        return;
      }

      if (alreadyWritten && isAdmin) {
        toast.info("Tessera già registrata — sovrascrittura admin in corso...");
      }

      await ndef.write({
        records: [{ recordType: "url", data: profileUrl }],
      });
      toast.success("Profilo scritto sulla tessera NFC! 🎉");
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        toast.error("Permesso NFC negato. Abilita NFC nelle impostazioni.");
      } else if (err.name === "AbortError") {
        // cancelled
      } else {
        toast.error("Errore nella scrittura NFC");
        console.error("NFC write error:", err);
      }
    } finally {
      setNfcWriting(false);
    }
  }, [profileUrl, isAdmin]);

  const shareProfile = () => {
    if (navigator.share) {
      navigator.share({ title: `Profilo di ${displayName || username}`, url: profileUrl });
    } else {
      navigator.clipboard.writeText(profileUrl);
      toast.success("Link copiato!");
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <QrCode size={16} /> La Mia Card
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-sm p-4 sm:p-6 max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center">La Mia Card</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2 sm:py-3">
          {avatarUrl && (
            <img
              src={avatarUrl}
              alt={displayName || username}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-primary"
            />
          )}
          <p className="font-bold text-lg text-center break-words max-w-full">{displayName || username}</p>
          <p className="text-xs text-muted-foreground text-center break-all">@{username}</p>

          <div className="bg-white p-2.5 sm:p-3 rounded-xl max-w-full">
            <QRCodeSVG value={profileUrl} size={160} level="M" />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Fai scansionare questo QR per aprire il tuo profilo
          </p>

          <div className="flex flex-col sm:flex-row gap-2 w-full">
            {supportsNfc && (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={writeNfc}
                disabled={nfcWriting}
              >
                <CreditCard size={16} />
                {nfcWriting ? "Avvicina tessera..." : "Registra Tessera"}
              </Button>
            )}
            <Button variant="outline" className="w-full gap-2" onClick={shareProfile}>
              <Share2 size={16} /> Condividi
            </Button>
          </div>

          {supportsNfc && (
            <p className="text-[10px] text-muted-foreground text-center">
              Scrivi il tuo profilo su una tessera NFC fisica.
              {!isAdmin && " Una volta scritta, solo un admin potrà sovrascriverla."}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
