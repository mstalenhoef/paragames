import { createGlider, stepGlider, DEFAULT_GLIDER, type Controls, type GliderParams, type GliderState } from './glider.ts';
import type { Vec2 } from './math.ts';
import type { Terrain } from './terrain.ts';
import { Thermal, type CoreLocation, type ThermalConfig } from './thermal.ts';

export interface AirConfig {
  wind: Vec2;
  /** Background vertical air movement outside thermals, m/s (usually slightly negative). */
  ambient: number;
  thermals: ThermalConfig[];
}

export interface FlightSetup {
  start: { x: number; y: number; z: number; heading: number };
  /** Flight is won when the glider reaches this altitude, m MSL. */
  goalAltitude: number;
  air: AirConfig;
  glider?: GliderParams;
}

export type FlightStatus = 'flying' | 'goal' | 'landed' | 'outOfMap';

export interface TrailPoint {
  t: number;
  x: number;
  y: number;
  z: number;
  climbRate: number;
}

export const SIM_DT = 1 / 120;
const TRAIL_INTERVAL = 0.5;
const VARIO_TIME_CONSTANT = 0.6;
const AVERAGE_TIME_CONSTANT = 15;

export class Flight {
  readonly setup: FlightSetup;
  readonly terrain: Terrain;
  readonly thermals: Thermal[];
  readonly trail: TrailPoint[] = [];
  private readonly params: GliderParams;

  t = 0;
  glider: GliderState;
  status: FlightStatus = 'flying';
  /** Filtered climb rate as shown by an instrument vario. */
  vario = 0;
  /** Long-term average climb rate (about one thermal circle). */
  varioAverage = 0;
  maxAltitude: number;
  private nextTrailTime = 0;

  constructor(setup: FlightSetup, terrain: Terrain) {
    this.setup = setup;
    this.terrain = terrain;
    this.params = setup.glider ?? DEFAULT_GLIDER;
    this.thermals = setup.air.thermals.map((c) => new Thermal(c));
    const { x, y, z, heading } = setup.start;
    this.glider = createGlider(x, y, z, heading, this.params);
    this.maxAltitude = z;
    this.recordTrail();
  }

  get wind(): Vec2 {
    return this.setup.air.wind;
  }

  verticalAirSpeed(x: number, y: number, z: number, t = this.t): number {
    let w = this.setup.air.ambient;
    for (const thermal of this.thermals) w += thermal.liftAt(x, y, z, t, this.wind);
    return w;
  }

  get groundElevation(): number {
    return this.terrain.elevationAt(this.glider.x, this.glider.y);
  }

  get heightAboveGround(): number {
    return this.glider.z - this.groundElevation;
  }

  get altitudeGain(): number {
    return this.maxAltitude - this.setup.start.z;
  }

  /** Strongest thermal core near the glider's altitude, if any. */
  nearestCore(): CoreLocation | null {
    let best: CoreLocation | null = null;
    let bestDistance = Infinity;
    for (const thermal of this.thermals) {
      const core = thermal.strongestCoreAt(this.glider.z, this.t, this.wind);
      if (core.strength <= 0) continue;
      const d = Math.hypot(core.x - this.glider.x, core.y - this.glider.y);
      if (d < bestDistance) {
        best = core;
        bestDistance = d;
      }
    }
    return best;
  }

  step(controls: Controls, dt = SIM_DT): void {
    if (this.status !== 'flying') return;
    const air = { wind: this.wind, verticalAirSpeed: (x: number, y: number, z: number) => this.verticalAirSpeed(x, y, z) };
    this.glider = stepGlider(this.glider, controls, air, dt, this.params);
    this.t += dt;

    this.vario += (this.glider.climbRate - this.vario) * (1 - Math.exp(-dt / VARIO_TIME_CONSTANT));
    this.varioAverage += (this.glider.climbRate - this.varioAverage) * (1 - Math.exp(-dt / AVERAGE_TIME_CONSTANT));
    this.maxAltitude = Math.max(this.maxAltitude, this.glider.z);

    if (!this.terrain.contains(this.glider.x, this.glider.y)) {
      this.status = 'outOfMap';
    } else if (this.glider.z <= this.groundElevation) {
      this.glider = { ...this.glider, z: this.groundElevation, climbRate: 0 };
      this.status = 'landed';
    } else if (this.glider.z >= this.setup.goalAltitude) {
      this.status = 'goal';
    }

    if (this.t >= this.nextTrailTime || this.status !== 'flying') this.recordTrail();
  }

  private recordTrail(): void {
    const { x, y, z, climbRate } = this.glider;
    this.trail.push({ t: this.t, x, y, z, climbRate });
    this.nextTrailTime = this.t + TRAIL_INTERVAL;
  }
}

/** Runs the simulation at a fixed timestep regardless of the display frame rate. */
export class FixedStepper {
  private accumulator = 0;
  private readonly dt: number;

  constructor(dt = SIM_DT) {
    this.dt = dt;
  }

  advance(frameSeconds: number, step: (dt: number) => void): void {
    this.accumulator += Math.min(frameSeconds, 0.25);
    while (this.accumulator >= this.dt) {
      step(this.dt);
      this.accumulator -= this.dt;
    }
  }
}
