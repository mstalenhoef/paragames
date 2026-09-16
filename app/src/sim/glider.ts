import { clamp, deg, G, headingVector, wrapAngle, type Vec2 } from './math.ts';

export interface GliderParams {
  /** Airspeed without brakes, m/s. */
  trimSpeed: number;
  /** Relative airspeed loss at full symmetric brake. */
  brakeSpeedLoss: number;
  /** Minimum sink rate in straight flight, m/s, reached at `minSinkBrake`. */
  minSink: number;
  minSinkBrake: number;
  /** Sink polar curvature: extra sink per (brake - minSinkBrake)². */
  sinkCurvature: number;
  /** Extra sink from asymmetric brake drag at full differential brake, m/s. */
  turnBrakeDrag: number;
  maxBank: number;
  /** Time constant for bank to follow brake input, s. */
  rollTimeConstant: number;
  maxRollRate: number;
}

export const DEFAULT_GLIDER: GliderParams = {
  trimSpeed: 10.5,
  brakeSpeedLoss: 0.32,
  minSink: 1.0,
  minSinkBrake: 0.25,
  sinkCurvature: 1.6,
  turnBrakeDrag: 0.25,
  maxBank: deg(50),
  rollTimeConstant: 0.8,
  maxRollRate: deg(35),
};

/** Brake positions, 0 (released) to 1 (fully pulled). */
export interface Controls {
  left: number;
  right: number;
}

export interface GliderState {
  x: number;
  y: number;
  /** Altitude, m MSL. */
  z: number;
  /** Compass heading in radians, 0 = north, clockwise. */
  heading: number;
  /** Bank angle in radians, positive = right turn. */
  bank: number;
  airspeed: number;
  /** Own sink rate in still air, m/s (positive). */
  sinkRate: number;
  /** Vertical speed relative to the ground, m/s. */
  climbRate: number;
}

export interface AirSample {
  wind: Vec2;
  /** Vertical air speed at a position, m/s. */
  verticalAirSpeed(x: number, y: number, z: number): number;
}

export function createGlider(x: number, y: number, z: number, heading: number, params = DEFAULT_GLIDER): GliderState {
  return { x, y, z, heading, bank: 0, airspeed: params.trimSpeed, sinkRate: straightSink(0, params), climbRate: 0 };
}

function straightSink(symmetricBrake: number, p: GliderParams): number {
  return p.minSink + p.sinkCurvature * (symmetricBrake - p.minSinkBrake) ** 2;
}

/** Turn radius in the air mass for a given airspeed and bank. */
export function turnRadius(airspeed: number, bank: number): number {
  const tan = Math.tan(Math.abs(bank));
  return tan < 1e-4 ? Infinity : (airspeed * airspeed) / (G * tan);
}

export function stepGlider(s: GliderState, controls: Controls, air: AirSample, dt: number, p = DEFAULT_GLIDER): GliderState {
  const left = clamp(controls.left, 0, 1);
  const right = clamp(controls.right, 0, 1);
  const symmetric = Math.min(left, right);
  const differential = right - left;

  const targetBank = differential * p.maxBank;
  const rollRate = clamp((targetBank - s.bank) / p.rollTimeConstant, -p.maxRollRate, p.maxRollRate);
  const bank = clamp(s.bank + rollRate * dt, -p.maxBank, p.maxBank);

  const airspeed = p.trimSpeed * (1 - p.brakeSpeedLoss * symmetric);
  // Sink grows with load factor n = 1/cos(bank) as n^1.5.
  const sinkRate = (straightSink(symmetric, p) + p.turnBrakeDrag * Math.abs(differential)) / Math.cos(bank) ** 1.5;
  const turnRate = (G * Math.tan(bank)) / airspeed;
  const heading = wrapAngle(s.heading + turnRate * dt);

  const dir = headingVector(heading);
  const x = s.x + (dir.x * airspeed + air.wind.x) * dt;
  const y = s.y + (dir.y * airspeed + air.wind.y) * dt;
  const climbRate = air.verticalAirSpeed(x, y, s.z) - sinkRate;
  const z = s.z + climbRate * dt;

  return { x, y, z, heading, bank, airspeed, sinkRate, climbRate };
}
