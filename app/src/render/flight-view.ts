import { Application, Container, Graphics, Sprite, Text, Texture, type TextStyleOptions } from 'pixi.js';
import type { LessonAids } from '../levels/lessons.ts';
import type { Flight } from '../sim/flight.ts';
import type { TerrainMeta, ThermalHotspot } from '../terrain/types.ts';
import { climbColor, climbColorRgb } from './colors.ts';
import { drawGlider, findGliderDesign, type GliderDesign } from './glider-graphic.ts';

export type MapOrientation = 'northUp' | 'headingUp';

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 6;
const OVERLAY_CELLS = 96;
const OVERLAY_CELL_SIZE = 8;
const OVERLAY_INTERVAL = 0.25;

const LABEL_STYLE: TextStyleOptions = {
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: 12,
  fill: 0x1d2a1d,
  stroke: { color: 0xffffff, width: 3, join: 'round' },
};

interface FeatureLabel {
  x: number;
  y: number;
  text: Text;
  minZoom: number;
  maxZoom: number;
}

/**
 * Draws a flight on the terrain map. World units are meters; the world container
 * flips y so that north points up on screen.
 */
export class FlightView {
  zoom = 1.4;
  orientation: MapOrientation = 'northUp';

  private readonly app: Application;
  private readonly camera = new Container();
  private readonly world = new Container();
  private readonly overlaySprite: Sprite;
  private readonly overlayCanvas: HTMLCanvasElement;
  private readonly overlayTexture: Texture;
  private readonly trailGraphics = new Graphics();
  private readonly trailHead = new Graphics();
  private readonly markers = new Graphics();
  private readonly hotspots = new Graphics();
  private readonly labels = new Container();
  private readonly glider = new Graphics();
  private readonly featureLabels: FeatureLabel[] = [];
  private gliderDesign: GliderDesign = findGliderDesign(undefined);

  private readonly hotspotData: ThermalHotspot[];
  private drawnHotspotZoom = 0;
  private flight: Flight | null = null;
  private aids: LessonAids | null = null;
  private drawnTrailLength = -1;
  private drawnTrailZoom = 0;
  private nextOverlayTime = 0;

  constructor(app: Application, terrainTexture: Texture, meta: TerrainMeta) {
    this.app = app;

    const terrain = new Sprite(terrainTexture);
    terrain.position.set(meta.minX, -meta.maxY);
    terrain.scale.set(meta.image.metersPerPixel);

    this.overlayCanvas = document.createElement('canvas');
    this.overlayCanvas.width = this.overlayCanvas.height = OVERLAY_CELLS;
    this.overlayTexture = Texture.from(this.overlayCanvas);
    this.overlaySprite = new Sprite(this.overlayTexture);
    this.overlaySprite.scale.set(OVERLAY_CELL_SIZE);
    this.overlaySprite.visible = false;

    this.hotspotData = meta.hotspots;
    this.hotspots.visible = false;
    this.world.addChild(terrain, this.hotspots, this.overlaySprite, this.trailGraphics, this.trailHead, this.markers);
    this.camera.addChild(this.world);
    app.stage.addChild(this.camera, this.labels, this.glider);

    for (const feature of meta.features) {
      const prefix = feature.kind === 'peak' ? '▲ ' : feature.kind === 'takeoff' ? '⬈ ' : feature.kind === 'landing' ? '⬋ ' : '';
      const suffix = feature.kind === 'peak' ? ` ${feature.elevation}` : '';
      const text = new Text({ text: `${prefix}${feature.name}${suffix}`, style: LABEL_STYLE });
      text.anchor.set(0, 0.5);
      if (feature.kind === 'village') text.style = { ...LABEL_STYLE, fontWeight: '600', fontSize: 13 };
      const takeoffOrLanding = feature.kind === 'takeoff' || feature.kind === 'landing';
      this.featureLabels.push({
        x: feature.x,
        y: feature.y,
        text,
        minZoom: takeoffOrLanding ? 0.4 : 0,
        maxZoom: takeoffOrLanding ? MAX_ZOOM : feature.kind === 'village' ? 1.5 : 2.5,
      });
      this.labels.addChild(text);
    }

    drawGlider(this.glider, this.gliderDesign);
  }

  setFlight(flight: Flight, aids: LessonAids): void {
    this.flight = flight;
    this.aids = aids;
    this.drawnTrailLength = -1;
    this.nextOverlayTime = 0;
    this.trailGraphics.clear();
    this.trailHead.clear();
    this.markers.clear();
    this.overlaySprite.visible = aids.liftOverlay;
  }

  setGliderDesign(design: GliderDesign): void {
    this.gliderDesign = design;
    drawGlider(this.glider, design);
  }

  get design(): GliderDesign {
    return this.gliderDesign;
  }

  get showHotspots(): boolean {
    return this.hotspots.visible;
  }

  set showHotspots(show: boolean) {
    this.hotspots.visible = show;
  }

  zoomBy(factor: number): void {
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoom * factor));
  }

  render(): void {
    const flight = this.flight;
    const aids = this.aids;
    if (!flight || !aids) return;
    const { x, y, heading } = flight.glider;
    const width = this.app.screen.width;
    const height = this.app.screen.height;

    const rotation = this.orientation === 'headingUp' ? -heading : 0;
    // Keep the glider slightly below center so there is more map ahead in heading-up mode.
    const centerY = this.orientation === 'headingUp' ? height * 0.6 : height / 2;
    this.camera.position.set(width / 2, centerY);
    this.camera.scale.set(this.zoom);
    this.camera.rotation = rotation;
    this.world.position.set(-x, y);

    this.glider.position.set(width / 2, centerY);
    this.glider.rotation = heading + rotation;

    if (this.hotspots.visible && this.drawnHotspotZoom !== this.zoom) this.renderHotspots();
    this.renderTrail(flight, aids);
    this.renderMarkers(flight, aids);
    if (aids.liftOverlay && flight.t >= this.nextOverlayTime) this.renderOverlay(flight);
    this.renderLabels(x, y, rotation, width / 2, centerY);
  }

  /** kk7 hotspots as rings sized in screen pixels, more opaque with higher probability. */
  private renderHotspots(): void {
    const g = this.hotspots.clear();
    const px = 1 / this.zoom;
    for (const h of this.hotspotData) {
      const alpha = 0.35 + 0.6 * h.probability;
      g.circle(h.x, -h.y, 11 * px).fill({ color: 0xffb020, alpha: alpha * 0.35 }).stroke({ width: 2.5 * px, color: 0xe8590c, alpha });
      g.circle(h.x, -h.y, 3 * px).fill({ color: 0xe8590c, alpha });
    }
    this.drawnHotspotZoom = this.zoom;
  }

  private renderTrail(flight: Flight, aids: LessonAids): void {
    const trail = flight.trail;
    const lineWidth = 3 / this.zoom;
    const plainColor = 0x2a2a60;

    if (trail.length !== this.drawnTrailLength || this.zoom !== this.drawnTrailZoom) {
      const g = this.trailGraphics;
      g.clear();
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1];
        const b = trail[i];
        g.moveTo(a.x, -a.y)
          .lineTo(b.x, -b.y)
          .stroke({ width: lineWidth, color: aids.climbTrail ? climbColor(b.climbRate) : plainColor, alpha: 0.9, cap: 'round' });
      }
      this.drawnTrailLength = trail.length;
      this.drawnTrailZoom = this.zoom;
    }

    const last = trail[trail.length - 1];
    this.trailHead
      .clear()
      .moveTo(last.x, -last.y)
      .lineTo(flight.glider.x, -flight.glider.y)
      .stroke({ width: lineWidth, color: aids.climbTrail ? climbColor(flight.glider.climbRate) : plainColor, alpha: 0.9, cap: 'round' });
  }

  private renderMarkers(flight: Flight, aids: LessonAids): void {
    const g = this.markers.clear();
    const px = 1 / this.zoom;

    if (aids.coreMarker) {
      const core = flight.nearestCore();
      if (core && core.strength > 0.3) {
        g.circle(core.x, -core.y, 9 * px).stroke({ width: 2.5 * px, color: 0xd7263d });
        g.moveTo(core.x - 15 * px, -core.y).lineTo(core.x + 15 * px, -core.y).stroke({ width: 1.5 * px, color: 0xd7263d });
        g.moveTo(core.x, -core.y - 15 * px).lineTo(core.x, -core.y + 15 * px).stroke({ width: 1.5 * px, color: 0xd7263d });
      }
    }
  }

  private renderOverlay(flight: Flight): void {
    this.nextOverlayTime = flight.t + OVERLAY_INTERVAL;
    const { x, y, z } = flight.glider;
    const half = (OVERLAY_CELLS * OVERLAY_CELL_SIZE) / 2;
    const originX = Math.round((x - half) / OVERLAY_CELL_SIZE) * OVERLAY_CELL_SIZE;
    const originY = Math.round((y + half) / OVERLAY_CELL_SIZE) * OVERLAY_CELL_SIZE;

    const ctx = this.overlayCanvas.getContext('2d')!;
    const image = ctx.createImageData(OVERLAY_CELLS, OVERLAY_CELLS);
    const ambient = flight.setup.air.ambient;
    for (let row = 0; row < OVERLAY_CELLS; row++) {
      const wy = originY - (row + 0.5) * OVERLAY_CELL_SIZE;
      for (let col = 0; col < OVERLAY_CELLS; col++) {
        const wx = originX + (col + 0.5) * OVERLAY_CELL_SIZE;
        const w = flight.verticalAirSpeed(wx, wy, z) - ambient;
        const [r, g, b] = climbColorRgb(w);
        const o = (row * OVERLAY_CELLS + col) * 4;
        image.data[o] = r;
        image.data[o + 1] = g;
        image.data[o + 2] = b;
        image.data[o + 3] = Math.min(150, Math.max(0, (Math.abs(w) - 0.15) * 90));
      }
    }
    ctx.putImageData(image, 0, 0);
    this.overlayTexture.source.update();
    this.overlaySprite.position.set(originX, -originY);
  }

  private renderLabels(gx: number, gy: number, rotation: number, cx: number, cy: number): void {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const margin = 200;
    for (const label of this.featureLabels) {
      const visibleAtZoom = this.zoom >= label.minZoom && this.zoom <= label.maxZoom;
      const dx = (label.x - gx) * this.zoom;
      const dy = -(label.y - gy) * this.zoom;
      const sx = cx + dx * cos - dy * sin;
      const sy = cy + dx * sin + dy * cos;
      const onScreen = sx > -margin && sx < this.app.screen.width + margin && sy > -margin && sy < this.app.screen.height + margin;
      label.text.visible = visibleAtZoom && onScreen;
      if (label.text.visible) label.text.position.set(sx, sy);
    }
  }


  destroy(): void {
    this.app.stage.removeChild(this.camera, this.labels, this.glider);
    this.camera.destroy({ children: true });
    this.labels.destroy({ children: true });
    this.glider.destroy();
    this.overlayTexture.destroy(true);
  }
}
