import { useState } from "react";
import { RpgProvider, useRpg } from "./state/rpgStore";
import { MainMenu } from "./screens/MainMenu";
import { GameDeckBuilder } from "./screens/GameDeckBuilder";
import { Shop } from "./screens/Shop";
import { ComingSoon } from "./screens/ComingSoon";
import { BattleScene } from "./battle/BattleScene";
import { AdminPanel } from "./screens/AdminPanel";
import { GachaScreen } from "./screens/GachaScreen";

type Screen = "menu" | "deck" | "shop" | "inventory" | "pvp" | "gacha" | "battle" | "admin";

const RpgInner = () => {
  const { loading, run, startRunLevel } = useRpg();
  const [screen, setScreen] = useState<Screen>("menu");
  const [battleLevel, setBattleLevel] = useState<number>(1);

  if (loading) return <div className="text-center py-20 text-muted-foreground">Caricamento...</div>;

  const startBattle = (id?: number) => {
    const levelId = id ?? run.currentLevel;
    startRunLevel(levelId);
    setBattleLevel(levelId);
    setScreen("battle");
  };

  switch (screen) {
    case "menu": return <MainMenu onNavigate={setScreen as any} onPlay={startBattle} onExit={() => window.location.assign("/")} />;
    case "deck": return <GameDeckBuilder onBack={() => setScreen("menu")} />;
    case "shop": return <Shop onBack={() => setScreen("menu")} />;
    case "inventory": return <ComingSoon title="Inventario" onBack={() => setScreen("menu")} />;
    case "pvp": return <ComingSoon title="PvP" onBack={() => setScreen("menu")} />;
    case "gacha": return <GachaScreen onBack={() => setScreen("menu")} />;
    case "admin": return <AdminPanel onBack={() => setScreen("menu")} />;
    case "battle": return <BattleScene levelId={battleLevel} onExit={() => setScreen("menu")} />;
  }
};

export const RpgApp = () => (
  <RpgProvider>
    <RpgInner />
  </RpgProvider>
);
