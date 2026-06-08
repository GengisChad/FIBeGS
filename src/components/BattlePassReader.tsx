import { useState, useEffect, useRef } from "react";
import { useBattlePass, BattlePassData } from "@/hooks/useBattlePass";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  BluetoothSearching,
  Zap,
  Trophy,
  Trash2,
  Download,
  Loader2,
  BarChart3,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface BattlePassReaderProps {
  currentBestSpeed?: number | null;
  onScoreUpdated?: () => void;
}

export function BattlePassReader({ currentBestSpeed, onScoreUpdated }: BattlePassReaderProps) {
  const { user } = useAuth();
  const {
    isSupported,
    status,
    error,
    data,
    deviceName,
    debugLogs,
    connect,
    autoConnect,
    disconnect,
    readData,
    clearDevice,
    clearDebugLogs,
    forgetDevice,
    hasSavedDevice,
  } = useBattlePass();
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const autoConnectAttempted = useRef(false);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // Auto-connect and auto-read when dialog opens
  useEffect(() => {
    if (!dialogOpen || isIOS || !isSupported || autoConnectAttempted.current) return;
    
    if (hasSavedDevice() && status === "disconnected") {
      autoConnectAttempted.current = true;
      (async () => {
        const connected = await autoConnect();
        if (connected) {
          // Auto-read after successful auto-connect
          const result = await readData();
          if (result && result.launches.length === 0) {
            toast.info("Nessun lancio registrato sul BattlePass");
          }
        }
      })();
    }
  }, [dialogOpen, isIOS, isSupported, status, hasSavedDevice, autoConnect, readData]);

  // Reset auto-connect flag when dialog closes
  useEffect(() => {
    if (!dialogOpen) {
      autoConnectAttempted.current = false;
    }
  }, [dialogOpen]);

  const handleConnect = async () => {
    const connected = await connect();
    if (connected) {
      const result = await readData();
      if (result && result.launches.length === 0) {
        toast.info("Nessun lancio registrato sul BattlePass");
      }
    }
  };

  const handleRead = async () => {
    const result = await readData();
    if (result && result.launches.length === 0) {
      toast.info("Nessun lancio registrato sul BattlePass");
    }
  };

  const handleSave = async () => {
    if (!user || !data) return;

    const bestFromDevice = Math.max(data.header.maxLaunchSpeed, ...(data.launches.length ? data.launches : [0]));
    const isNewRecord = bestFromDevice > (currentBestSpeed || 0);

    // If not a new record, check 1-week cooldown
    if (!isNewRecord) {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentScores } = await supabase
        .from("battlepass_scores")
        .select("created_at")
        .eq("user_id", user.id)
        .gte("created_at", oneWeekAgo)
        .limit(1);

      if (recentScores && recentScores.length > 0) {
        toast.error("Puoi caricare dati senza nuovo record solo una volta a settimana.");
        return;
      }
    }

    setSaving(true);
    try {
      if (data.launches.length > 0) {
        const rows = data.launches.map((speed) => ({
          user_id: user.id,
          launch_speed: speed,
        }));

        const { error: insertError } = await supabase
          .from("battlepass_scores")
          .insert(rows);

        if (insertError) throw insertError;
      }

      const overallBest = Math.max(bestFromDevice, currentBestSpeed || 0);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ best_launch_speed: overallBest })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      toast.success(isNewRecord
        ? `Nuovo record! Miglior velocità: ${overallBest}`
        : `Dati salvati! Miglior velocità: ${overallBest}`
      );
      onScoreUpdated?.();
      setDialogOpen(false);
    } catch (err: any) {
      toast.error("Errore nel salvataggio: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (confirm("Sei sicuro di voler cancellare i dati dal BattlePass? Questa azione è irreversibile.")) {
      await clearDevice();
      toast.success("Dati cancellati dal BattlePass");
    }
  };

  const statusIcon = () => {
    switch (status) {
      case "scanning":
        return <BluetoothSearching className="h-5 w-5 animate-pulse" />;
      case "connecting":
        return <Loader2 className="h-5 w-5 animate-spin" />;
      case "connected":
        return <BluetoothConnected className="h-5 w-5 text-primary" />;
      case "reading":
        return <Loader2 className="h-5 w-5 animate-spin" />;
      case "error":
        return <BluetoothOff className="h-5 w-5 text-destructive" />;
      default:
        return <Bluetooth className="h-5 w-5" />;
    }
  };

  const statusLabel = () => {
    switch (status) {
      case "scanning": return "Ricerca dispositivo...";
      case "connecting": return "Connessione...";
      case "connected": return `Connesso a ${deviceName}`;
      case "reading": return "Lettura dati...";
      case "error": return "Errore";
      default: return "Non connesso";
    }
  };

  const maxSpeed = data
    ? Math.max(data.header.maxLaunchSpeed, ...(data.launches.length ? data.launches : [0]))
    : 0;

  const speedPercent = Math.min((maxSpeed / 30000) * 100, 100);

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Zap className="h-4 w-4 text-green-500" />
          BattlePass
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md max-h-[85vh] overflow-y-auto rounded-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-accent-foreground" />
            Beybattle Pass
          </DialogTitle>
          <DialogDescription>
            {hasSavedDevice()
              ? "Connessione automatica al tuo BattlePass..."
              : "Collega il tuo Beybattle Pass via Bluetooth per leggere la tua shoot power."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isIOS && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <BluetoothOff className="h-5 w-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">
                La connessione Bluetooth non è supportata su iOS (iPhone/iPad). Usa un dispositivo Android o un PC con Chrome/Edge.
              </p>
            </div>
          )}

          {/* Connection Status */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              {statusIcon()}
              <span className="text-sm font-medium">{isIOS ? "Non disponibile su iOS" : statusLabel()}</span>
            </div>
            {!isIOS && (status === "disconnected" || status === "error") ? (
              <Button size="sm" onClick={handleConnect} className="gap-1">
                <Bluetooth className="h-4 w-4" />
                Connetti
              </Button>
            ) : !isIOS && status === "connected" ? (
              <Button size="sm" variant="ghost" onClick={disconnect}>
                Disconnetti
              </Button>
            ) : null}
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              {error}
            </p>
          )}

          {/* Current best on profile */}
          {currentBestSpeed != null && currentBestSpeed > 0 && (
            <Card className="border-accent/30 bg-accent/5">
              <CardContent className="p-3 flex items-center gap-3">
                <Trophy className="h-5 w-5 text-foreground shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Record personale salvato</p>
                  <p className="text-lg font-bold text-green-500">{currentBestSpeed.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions when connected */}
          {status === "connected" && !data && (
            <Button onClick={handleRead} className="w-full gap-2">
              <Download className="h-4 w-4" />
              Leggi dati dal BattlePass
            </Button>
          )}

          {/* Data display */}
          {data && (
            <div className="space-y-3">
              <Card className="border-primary/30">
                <CardHeader className="p-3 pb-1">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4 text-accent-foreground" />
                    Miglior Velocità di Lancio
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <p className="text-3xl font-bold text-green-500">
                    {maxSpeed.toLocaleString()}
                  </p>
                  <Progress value={speedPercent} className="mt-2 h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {data.header.launchCount} lanci totali registrati
                  </p>
                </CardContent>
              </Card>

              {data.launches.length > 0 && (
                <Card>
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Ultimi lanci ({data.launches.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="grid grid-cols-5 gap-1.5 max-h-40 overflow-y-auto">
                      {data.launches.map((speed, i) => (
                        <div
                          key={i}
                          className={`text-center p-1.5 rounded text-xs font-mono ${
                            speed === maxSpeed
                              ? "bg-accent/20 text-accent-foreground font-bold border border-accent/30"
                              : "bg-muted/50"
                          }`}
                        >
                          {speed.toLocaleString()}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 gap-2"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Salva sul profilo
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRead}
                  size="icon"
                  title="Rileggi dati"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleClear}
                  size="icon"
                  title="Cancella dati dal dispositivo"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            {hasSavedDevice()
              ? "Il dispositivo verrà riconnesso automaticamente. Premi 'Connetti' per associarne uno diverso."
              : "Collega il tuo Beybattle Pass (BX-09) via Bluetooth per registrare la tua shoot power. Funziona su Chrome e Edge (Android/Desktop)."}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
