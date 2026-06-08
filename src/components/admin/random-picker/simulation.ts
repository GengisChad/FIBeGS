import { Participant, SimParams, BeybladeType } from "./types";

// Mini Vec2 per evitare dipendenze esterne
export class Vec2 {
  constructor(public x = 0, public y = 0) {}
  clone() {
    return new Vec2(this.x, this.y);
  }
  add(v: Vec2) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }
  sub(v: Vec2) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }
  multiplyScalar(s: number) {
    this.x *= s;
    this.y *= s;
    return this;
  }
  length() {
    return Math.hypot(this.x, this.y);
  }
  normalize() {
    const l = this.length();
    if (l > 0) {
      this.x /= l;
      this.y /= l;
    }
    return this;
  }
  dot(v: Vec2) {
    return this.x * v.x + this.y * v.y;
  }
  copy(v: Vec2) {
    this.x = v.x;
    this.y = v.y;
    return this;
  }
}

export interface BeybladeState {
  id: string;
  participant: Participant;
  type: BeybladeType;
  position: Vec2;
  velocity: Vec2;
  stamina: number;
  durability: number;
  alive: boolean;
  exploded: boolean;
  outOfArena: boolean;
  attachedToRail: boolean;
  railAngularDir: number;
  spinAngle: number;
  dashing: boolean;
}

// Half-angle (in radianti) della rampa di slancio in cima all'arena.
// Misurato sull'asset: la rampa va da x≈572 a x≈692 (centro 632), che corrisponde
// a circa 0.10-0.11 rad attorno a π/2 in coords sim (cerchio).
const LAUNCH_AREA_HALF_ANGLE = 0.11;

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createInitialState(
  participants: Participant[],
  params: SimParams,
  seed = Date.now()
): BeybladeState[] {
  const rand = mulberry32(seed);
  const ringRadius = params.arenaRadius * 0.55;
  return participants.map((p, i) => {
    const baseAngle = (i / participants.length) * Math.PI * 2 + rand() * 0.2;
    const r = ringRadius * (0.7 + rand() * 0.3);
    const pos = new Vec2(Math.cos(baseAngle) * r, Math.sin(baseAngle) * r);
    const tangent = new Vec2(-Math.sin(baseAngle), Math.cos(baseAngle));
    const speed =
      params.launchSpeedMin +
      rand() * (params.launchSpeedMax - params.launchSpeedMin);
    // Sempre antiorario
    const velocity = tangent.clone().multiplyScalar(speed);
    return {
      id: p.id,
      participant: p,
      type: p.type,
      position: pos,
      velocity,
      stamina: params.initialStamina,
      durability: params.initialDurability,
      alive: true,
      exploded: false,
      outOfArena: false,
      attachedToRail: false,
      railAngularDir: 1,
      spinAngle: rand() * Math.PI * 2,
      dashing: false,
    };
  });
}

function typeStats(type: BeybladeType, params: SimParams) {
  switch (type) {
    case "attack":
      return {
        dmg: params.attackDamage,
        recoil: params.attackRecoil,
        orbit: params.attackOrbitFactor,
        centerPull: 0.5,
        drain: 1.0,
        targetRadius: 0.6, // orbita variabile, media
        targetStrength: 0.4, // poco vincolato al raggio
        speedMul: params.attackSpeedMultiplier,
      };
    case "defense":
      return {
        dmg: params.defenseDamage,
        recoil: params.defenseRecoil,
        orbit: 0.2,
        centerPull: params.defenseCenterPull,
        drain: 0.8,
        targetRadius: 0.18, // vicino al centro
        targetStrength: 1.4,
        speedMul: 1.0,
      };
    case "stamina":
      return {
        dmg: params.staminaDamage,
        recoil: params.staminaRecoil,
        orbit: 0.4,
        centerPull: 0.7,
        drain: params.staminaDrainMultiplier,
        targetRadius: params.staminaOrbitRadius, // anello giallo
        targetStrength: 1.6,
        speedMul: 1.0,
      };
  }
}

export function stepSimulation(
  beys: BeybladeState[],
  params: SimParams,
  dt: number,
  elapsed: number = Infinity
): { winner?: BeybladeState; finished: boolean } {
  const arenaR = params.arenaRadius;
  const railR = arenaR - params.railWidth * 0.5;
  const railSnap = railR - params.beybladeRadius;
  // Out-of-arena solo se sfondi ben oltre il rail (in pratica solo via slingshot mancato)
  const outR = arenaR + 1.5;

  for (const b of beys) {
    if (!b.alive) continue;
    const stats = typeStats(b.type, params);

    b.stamina -= params.staminaDrainPerSec * stats.drain * dt;
    if (b.stamina < 0) b.stamina = 0;

    const distToCenter = b.position.length();
    const staminaRatio = b.stamina / params.initialStamina;
    const orbitDesire = stats.orbit * staminaRatio;
    // Pull verso centro come "conca"
    const bowlPull =
      params.centerGravity *
      (stats.centerPull + (1 - staminaRatio) * 1.5 - orbitDesire) *
      (0.4 + (distToCenter / arenaR) * 1.4);
    if (distToCenter > 0.001) {
      const norm = b.position.clone().normalize();
      const pull = norm.clone().multiplyScalar(-bowlPull * dt);
      b.velocity.add(pull);

      // Forza radiale verso il raggio target del tipo (defense→centro,
      // stamina→anello giallo, attack→ampio range)
      const targetR = stats.targetRadius * arenaR;
      const radialDelta = distToCenter - targetR; // >0 = troppo lontano
      const radialForce = -radialDelta * stats.targetStrength;
      b.velocity.add(norm.clone().multiplyScalar(radialForce * dt));

      // Forza tangenziale antioraria
      const tangentCcw = new Vec2(-norm.y, norm.x);
      b.railAngularDir = 1;
      const orbitForce =
        params.orbitForce *
        stats.speedMul *
        (0.6 + (distToCenter / arenaR) * 0.8);
      b.velocity.add(tangentCcw.clone().multiplyScalar(orbitForce * dt));
    }

    b.velocity.multiplyScalar(1 - params.friction);

    b.position.add(b.velocity.clone().multiplyScalar(dt));

    b.spinAngle += dt * (8 + b.velocity.length() * 0.5);

    const newDist = b.position.length();

    // Se ha superato il rail
    if (newDist >= railSnap) {
      if (newDist > outR) {
        b.alive = false;
        b.outOfArena = true;
        continue;
      }
      const norm = b.position.clone().normalize();
      // Riposiziona sul rail
      b.position.copy(norm.clone().multiplyScalar(railSnap));

      const wasAttached = b.attachedToRail;

      // Se sta ancora dashando (sparato verso il centro) e raggiunge il bordo
      // opposto, NON aggancia automaticamente: rimbalza o aggancia in base al
      // random grip. Una volta toccato il bordo, il dash è concluso.
      const isDashImpact = b.dashing;
      b.dashing = false;

      // Decidi se agganciare: se era già agganciato continua; altrimenti random
      let grip = wasAttached;
      if (!wasAttached) {
        grip = Math.random() < params.railGripChance;
      }

      if (grip) {
        b.attachedToRail = true;
        // Rail SEMPRE antioraria
        b.railAngularDir = 1;
        const tangent = new Vec2(-norm.y, norm.x);
        const newSpeed = params.railSpeed;
        b.velocity = tangent.multiplyScalar(newSpeed);

        const angle = Math.atan2(b.position.y, b.position.x);
        const upAngle = Math.PI / 2;
        const angDiff = Math.abs(
          ((angle - upAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI
        );
        if (angDiff < LAUNCH_AREA_HALF_ANGLE && newSpeed > 4) {
          b.attachedToRail = false;
          b.dashing = true;
          const towardCenter = b.position.clone().normalize().multiplyScalar(-1);
          const slingSpeed = newSpeed * params.railSlingshotBoost;
          b.velocity = towardCenter.multiplyScalar(slingSpeed);
          b.stamina -= params.slingshotStaminaCost;
        }
      } else {
        // Rimbalza: inverti componente normale (con bounciness)
        b.attachedToRail = false;
        const vn = b.velocity.dot(norm);
        if (vn > 0) {
          const reflect = norm.clone().multiplyScalar(-vn * (1 + params.bounciness));
          b.velocity.add(reflect);
        }
        // Se era un impatto da dash, l'attrito col rail rallenta un po'
        if (isDashImpact) b.velocity.multiplyScalar(0.85);
      }
    } else {
      b.attachedToRail = false;
    }
  }

  for (let i = 0; i < beys.length; i++) {
    const a = beys[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < beys.length; j++) {
      const c = beys[j];
      if (!c.alive) continue;
      const diff = c.position.clone().sub(a.position);
      const dist = diff.length();
      const minDist = params.beybladeRadius * 2;
      if (dist < minDist && dist > 0.0001) {
        const normal = diff.clone().normalize();
        const overlap = minDist - dist;
        a.position.sub(normal.clone().multiplyScalar(overlap * 0.5));
        c.position.add(normal.clone().multiplyScalar(overlap * 0.5));

        // Se uno dei due è in dash o agganciato al rail → si sgancia
        // e viene "sparato via" nell'arena dall'urto.
        if (a.dashing || a.attachedToRail) {
          a.attachedToRail = false;
          a.dashing = false;
        }
        if (c.dashing || c.attachedToRail) {
          c.attachedToRail = false;
          c.dashing = false;
        }

        const relVel = c.velocity.clone().sub(a.velocity);
        const velAlongNormal = relVel.dot(normal);
        // Anti-stick: anche se le velocità non si avvicinano (o sono ~0), applica
        // un rinculo minimo per evitare che due bey restino incollati.
        if (velAlongNormal > -0.05) {
          const kick = 0.6;
          a.velocity.sub(normal.clone().multiplyScalar(kick));
          c.velocity.add(normal.clone().multiplyScalar(kick));
          continue;
        }

        const e = params.bounciness;
        const impulse = -(1 + e) * velAlongNormal * 0.5;
        const impulseVec = normal.clone().multiplyScalar(impulse);

        const aStats = typeStats(a.type, params);
        const cStats = typeStats(c.type, params);

        a.velocity.sub(impulseVec.clone().multiplyScalar(aStats.recoil));
        c.velocity.add(impulseVec.clone().multiplyScalar(cStats.recoil));

        // Cap velocità post-collisione per evitare accelerazioni esplosive
        const maxV = params.maxCollisionSpeed;
        const aSpeed = a.velocity.length();
        if (aSpeed > maxV) a.velocity.multiplyScalar(maxV / aSpeed);
        const cSpeed = c.velocity.length();
        if (cSpeed > maxV) c.velocity.multiplyScalar(maxV / cSpeed);

        const impact = Math.abs(velAlongNormal);
        const baseDmg = impact * params.damageMultiplier;
        a.durability -= baseDmg * cStats.dmg;
        c.durability -= baseDmg * aStats.dmg;
      }
    }
  }

  const beforeMin = elapsed < params.minDuration;
  for (const b of beys) {
    if (!b.alive) continue;
    if (beforeMin) {
      // Tieni in vita per durata minima: clamp stamina/durabilità a 1
      if (b.durability <= 1) b.durability = 1;
      if (b.stamina <= 1) b.stamina = 1;
      continue;
    }
    if (b.durability <= 0) {
      b.alive = false;
      b.exploded = true;
    } else if (b.stamina <= 0 && b.velocity.length() < 0.5) {
      b.alive = false;
    }
  }

  const aliveOnes = beys.filter((b) => b.alive);
  if (!beforeMin && aliveOnes.length <= 1) {
    return { winner: aliveOnes[0], finished: true };
  }
  return { finished: false };
}
