import { clamp, smoothstep, type Vec2 } from './math.ts';

export interface ThermalCore {
  /** Offset from the thermal center in meters. */
  dx: number;
  dy: number;
  /** Radius at which lift has dropped to half of the core strength, at mid height. */
  radius: number;
  /** Peak updraft in m/s. */
  strength: number;
  /** Phase of the strength pulsation in radians. */
  phase: number;
}

export interface ThermalConfig {
  /** Trigger point on the ground (local meters). */
  x: number;
  y: number;
  /** Altitude (m MSL) where the thermal starts and where it ends (inversion / cloud base). */
  baseAltitude: number;
  topAltitude: number;
  cores: ThermalCore[];
  /** Peak downdraft in the ring around the thermal, m/s (positive number). */
  sinkRing: number;
  pulsePeriod: number;
  /** Relative strength variation, 0..1. */
  pulseAmplitude: number;
  /**
   * Shape of the lift fall-off from a core: lift = strength × 0,5^((d / radius)^falloff).
   * 2 (default) is a Gaussian; lower values keep more lift toward the edge.
   */
  falloff?: number;
}

export interface CoreLocation extends Vec2 {
  strength: number;
}

const LN2 = Math.LN2;

/**
 * Thermal with one or more Gaussian cores and a sink ring, loosely based on the
 * updraft shape in Allen (2006). The column narrows near the ground and leans
 * downwind with height.
 */
export class Thermal {
  readonly config: ThermalConfig;
  private readonly riseSpeed: number;
  private readonly outerRadius: number;

  constructor(config: ThermalConfig) {
    this.config = config;
    this.riseSpeed = Math.max(1, ...config.cores.map((c) => c.strength));
    this.outerRadius = Math.max(...config.cores.map((c) => Math.hypot(c.dx, c.dy) + c.radius * 1.5));
  }

  /** Relative height in the column, 0 at the base and 1 at the top. */
  private heightFraction(z: number): number {
    const { baseAltitude, topAltitude } = this.config;
    return clamp((z - baseAltitude) / (topAltitude - baseAltitude), 0, 1);
  }

  private heightFactor(z: number): number {
    const { baseAltitude, topAltitude } = this.config;
    return smoothstep(baseAltitude, baseAltitude + 120, z) * (1 - smoothstep(topAltitude - 300, topAltitude, z));
  }

  private widthFactor(z: number): number {
    return 0.7 + 0.6 * this.heightFraction(z);
  }

  /** Center of the column at altitude z, displaced downwind. */
  centerAt(z: number, wind: Vec2): Vec2 {
    const drift = Math.max(0, z - this.config.baseAltitude) / this.riseSpeed;
    return { x: this.config.x + wind.x * drift, y: this.config.y + wind.y * drift };
  }

  private coreStrength(core: ThermalCore, t: number): number {
    const { pulsePeriod, pulseAmplitude } = this.config;
    const pulse = pulsePeriod > 0 ? Math.sin((2 * Math.PI * t) / pulsePeriod + core.phase) : 0;
    return core.strength * (1 + pulseAmplitude * pulse);
  }

  /** Vertical air speed in m/s caused by this thermal. */
  liftAt(x: number, y: number, z: number, t: number, wind: Vec2): number {
    const hf = this.heightFactor(z);
    if (hf <= 0) return 0;
    const center = this.centerAt(z, wind);
    const px = x - center.x;
    const py = y - center.y;
    const wf = this.widthFactor(z);

    const outer = this.outerRadius * wf;
    const d = Math.hypot(px, py);
    if (d > outer * 4) return 0;

    const halfFalloff = (this.config.falloff ?? 2) / 2;
    let lift = 0;
    for (const core of this.config.cores) {
      const r = core.radius * wf;
      const dc2 = ((px - core.dx * wf) ** 2 + (py - core.dy * wf) ** 2) / (r * r);
      lift += this.coreStrength(core, t) * Math.exp(-(dc2 ** halfFalloff) * LN2);
    }
    const ring = this.config.sinkRing * Math.exp(-(((d - outer * 1.5) / (outer * 0.45)) ** 2));
    return hf * (lift - ring);
  }

  /** Position and strength of the strongest core at altitude z. */
  strongestCoreAt(z: number, t: number, wind: Vec2): CoreLocation {
    const center = this.centerAt(z, wind);
    const wf = this.widthFactor(z);
    const hf = this.heightFactor(z);
    let best: CoreLocation = { x: center.x, y: center.y, strength: -Infinity };
    for (const core of this.config.cores) {
      const strength = this.coreStrength(core, t) * hf;
      if (strength > best.strength) best = { x: center.x + core.dx * wf, y: center.y + core.dy * wf, strength };
    }
    return best;
  }
}
