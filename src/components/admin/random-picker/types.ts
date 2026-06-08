export type BeybladeType = "attack" | "defense" | "stamina";

export interface Participant {
  id: string;
  name: string;
  userId?: string;
  avatarUrl?: string;
  spriteUrl?: string;
  type: BeybladeType;
}

export interface SimParams {
  // Arena (in unità di gioco)
  arenaRadius: number;
  railWidth: number;
  centerGravity: number;
  // Beyblade
  beybladeRadius: number;
  initialStamina: number;
  initialDurability: number;
  staminaDrainPerSec: number;
  // Lancio iniziale
  launchSpeedMin: number;
  launchSpeedMax: number;
  // Tipi: moltiplicatori
  attackDamage: number;
  attackRecoil: number;
  attackOrbitFactor: number;
  attackSpeedMultiplier: number;
  defenseDamage: number;
  defenseRecoil: number;
  defenseCenterPull: number;
  staminaDamage: number;
  staminaRecoil: number;
  staminaDrainMultiplier: number;
  staminaOrbitRadius: number; // 0..1, frazione di arenaR (anello giallo ~0.85)
  // Rail
  railSpeed: number;
  railSlingshotBoost: number;
  railGripChance: number; // 0..1 probabilità di agganciarsi al rail al primo tocco
  // Generale
  damageMultiplier: number;
  bounciness: number;
  friction: number;
  minDuration: number;
  slingshotStaminaCost: number;
  orbitForce: number;
  maxCollisionSpeed: number;
}

export const DEFAULT_PARAMS: SimParams = {
  arenaRadius: 10,
  railWidth: 0.4,
  centerGravity: 0.6,
  beybladeRadius: 0.45,
  initialStamina: 100,
  initialDurability: 100,
  staminaDrainPerSec: 1.2,
  launchSpeedMin: 6,
  launchSpeedMax: 9,
  attackDamage: 1.6,
  attackRecoil: 1.5,
  attackOrbitFactor: 0.7,
  attackSpeedMultiplier: 1.5,
  defenseDamage: 0.7,
  defenseRecoil: 0.5,
  defenseCenterPull: 1.4,
  staminaDamage: 1.0,
  staminaRecoil: 1.0,
  staminaDrainMultiplier: 0.6,
  staminaOrbitRadius: 0.85,
  railSpeed: 14,
  railSlingshotBoost: 1.6,
  railGripChance: 0.35,
  damageMultiplier: 1.0,
  bounciness: 0.85,
  friction: 0.005,
  minDuration: 20,
  slingshotStaminaCost: 0.8,
  orbitForce: 4,
  maxCollisionSpeed: 22,
};

export const TYPE_COLORS: Record<BeybladeType, string> = {
  attack: "#ef4444",
  defense: "#3b82f6",
  stamina: "#22c55e",
};

export const TYPE_LABEL: Record<BeybladeType, string> = {
  attack: "Attacco",
  defense: "Difesa",
  stamina: "Durata",
};
