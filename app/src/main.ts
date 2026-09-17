import { Application, Assets, type Texture } from 'pixi.js';
import { VarioSound } from './audio/vario-sound.ts';
import { detectLocale, formatClimb, formatDuration, formatMeters, setLocale, t, translateDom } from './i18n/index.ts';
import { ControlInput } from './input/controls.ts';
import { createSetup, goalAltitude, LESSONS, type Lesson } from './levels/lessons.ts';
import { findSite, SITES, type Site } from './levels/sites.ts';
import { DIFFICULTIES, findDifficulty, type DifficultyLevel } from './levels/difficulty.ts';
import { climbColorCss } from './render/colors.ts';
import { FlightView } from './render/flight-view.ts';
import { FixedStepper, Flight } from './sim/flight.ts';
import { loadTerrain, type LoadedTerrain } from './terrain/load.ts';
import { Dialog, el } from './ui/dialog.ts';
import { loadSettings, saveSettings, type Settings } from './ui/settings.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

type State = 'menu' | 'flying' | 'paused' | 'ended';

interface SiteAssets {
  terrain: LoadedTerrain;
  texture: Texture;
}

const terrainCache = new Map<string, Promise<SiteAssets>>();

function loadSiteAssets(terrainId: string): Promise<SiteAssets> {
  let assets = terrainCache.get(terrainId);
  if (!assets) {
    assets = (async () => {
      const terrain = await loadTerrain(terrainId);
      const texture = await Assets.load<Texture>({ src: terrain.imageUrl, data: { autoGenerateMipmaps: true } });
      return { terrain, texture };
    })();
    // Allow a retry after a failed download.
    assets.catch(() => terrainCache.delete(terrainId));
    terrainCache.set(terrainId, assets);
  }
  return assets;
}

const NO_AIDS = { liftOverlay: false, coreMarker: false, climbTrail: false };

class Game {
  private readonly app: Application;
  private terrain: LoadedTerrain;
  private view: FlightView;
  private readonly input: ControlInput;
  private readonly sound = new VarioSound();
  private readonly dialog = new Dialog($<HTMLDialogElement>('dialog'));
  private readonly settings: Settings = loadSettings();
  private readonly stepper = new FixedStepper();

  private state: State = 'menu';
  private site: Site;
  private lesson: Lesson = LESSONS[0];
  private difficulty: DifficultyLevel;
  private siteRequest = 0;
  private flight: Flight | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private hudTimer = 0;

  private readonly hud = {
    altitude: $('hud-altitude'),
    agl: $('hud-agl'),
    vario: $('hud-vario'),
    average: $('hud-average'),
    time: $('hud-time'),
    goal: $('hud-goal'),
  };

  constructor(app: Application, site: Site, assets: SiteAssets) {
    this.app = app;
    this.site = site;
    this.difficulty = findDifficulty(this.settings.difficulty);
    this.terrain = assets.terrain;
    this.view = new FlightView(app, assets.texture, assets.terrain.meta);
    this.view.orientation = this.settings.orientation;
    this.view.showHotspots = this.settings.showHotspots;
    this.input = new ControlInput({ left: $('brake-left'), right: $('brake-right') });
    this.sound.setEnabled(this.settings.sound);

    this.buildMenu();
    this.bindGameButtons();
    app.ticker.add((ticker) => this.tick(ticker.deltaMS / 1000));

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'flying') this.pause();
    });

    this.showSitePreview();
    this.showMenu();
  }

  /** Shows the start area of the selected site behind the menu. */
  private showSitePreview(): void {
    this.flight = new Flight(createSetup(this.site, LESSONS[0], 1, this.terrain.meta.hotspots, this.difficulty), this.terrain.terrain);
    this.view.setFlight(this.flight, NO_AIDS);
  }

  private buildMenu(): void {
    $('site-list').replaceChildren(
      ...SITES.map((site) =>
        el('button', {
          type: 'button',
          textContent: site.name,
          onclick: () => void this.selectSite(site),
        }),
      ),
    );
    $('difficulty-list').replaceChildren(
      ...DIFFICULTIES.map((difficulty) =>
        el('button', {
          type: 'button',
          textContent: t(difficulty.labelKey),
          onclick: () => this.selectDifficulty(difficulty),
        }),
      ),
    );
    $('btn-howto').onclick = () => this.showHowTo();
    $('btn-settings').onclick = () => this.showSettings();
    this.updateMenu();
  }

  private updateMenu(loading = false): void {
    const siteButtons = [...$('site-list').children] as HTMLButtonElement[];
    siteButtons.forEach((button, i) => button.setAttribute('aria-pressed', String(SITES[i] === this.site)));
    const difficultyButtons = [...$('difficulty-list').children] as HTMLButtonElement[];
    difficultyButtons.forEach((button, i) => button.setAttribute('aria-pressed', String(DIFFICULTIES[i] === this.difficulty)));
    $('difficulty-description').textContent = t(this.difficulty.descriptionKey);

    $('level-list').replaceChildren(
      ...LESSONS.map((lesson) =>
        el('li', {}, [
          el('button', { type: 'button', disabled: loading, onclick: () => void this.startLesson(lesson) }, [
            el('span', { className: 'level-title', textContent: t(lesson.titleKey) }),
            el('span', {
              className: 'level-description',
              textContent: t(lesson.descriptionKey, { goal: formatMeters(goalAltitude(this.site, lesson)) }),
            }),
          ]),
        ]),
      ),
    );
    $('level-list').setAttribute('aria-busy', String(loading));
    $('credits-list').replaceChildren(...this.terrain.meta.attribution.map((line) => el('li', { textContent: line })));
  }

  private selectDifficulty(difficulty: DifficultyLevel): void {
    this.difficulty = difficulty;
    this.settings.difficulty = difficulty.id;
    saveSettings(this.settings);
    this.updateMenu();
  }

  private async selectSite(site: Site): Promise<void> {
    if (site === this.site) return;
    const request = ++this.siteRequest;
    this.site = site;
    this.settings.siteId = site.id;
    saveSettings(this.settings);
    this.updateMenu(true);

    let assets: SiteAssets;
    try {
      assets = await loadSiteAssets(site.terrainId);
    } catch (error) {
      console.error(error);
      if (request === this.siteRequest) this.dialog.show(t('error.loading'), [], [{ label: t('settings.close'), onClick: () => this.dialog.close() }]);
      return;
    }
    if (request !== this.siteRequest) return;

    if (assets.terrain !== this.terrain) {
      const { zoom, orientation, showHotspots } = this.view;
      this.view.destroy();
      this.view = new FlightView(this.app, assets.texture, assets.terrain.meta);
      Object.assign(this.view, { zoom, orientation, showHotspots });
      this.terrain = assets.terrain;
    }
    this.showSitePreview();
    this.updateMenu();
  }

  private bindGameButtons(): void {
    $('btn-pause').onclick = () => this.pause();
    $('btn-zoom-in').onclick = () => this.view.zoomBy(1.4);
    $('btn-zoom-out').onclick = () => this.view.zoomBy(1 / 1.4);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'KeyP' || e.code === 'Escape') {
        if (this.state === 'flying') {
          e.preventDefault();
          this.pause();
        } else if (this.state === 'paused' && e.code !== 'Escape') {
          e.preventDefault();
          this.resume();
        }
      } else if (e.key === '+' || e.key === '=') {
        this.view.zoomBy(1.25);
      } else if (e.key === '-') {
        this.view.zoomBy(1 / 1.25);
      }
    });

    const canvas = this.app.canvas;
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.view.zoomBy(Math.exp(-e.deltaY * 0.002));
      },
      { passive: false },
    );

    // Pinch to zoom on the map (brake sliders capture their own pointers).
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchDistance = 0;
    const distance = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    canvas.addEventListener('pointerdown', (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) pinchDistance = distance();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && pinchDistance > 0) {
        const d = distance();
        this.view.zoomBy(d / pinchDistance);
        pinchDistance = d;
      }
    });
    const release = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      pinchDistance = 0;
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
  }

  private async startLesson(lesson: Lesson): Promise<void> {
    // Unlocking audio must happen inside the user gesture.
    const unlock = this.sound.unlock().catch(() => undefined);
    this.dialog.close();
    this.lesson = lesson;
    this.flight = new Flight(createSetup(this.site, lesson, Math.floor(Math.random() * 2 ** 31), this.terrain.meta.hotspots, this.difficulty), this.terrain.terrain);
    this.view.setFlight(this.flight, lesson.aids);
    this.input.reset();

    $('menu').hidden = true;
    $('game-ui').hidden = false;
    $('legend').hidden = !(lesson.aids.climbTrail || lesson.aids.liftOverlay);
    $('legend-core').hidden = !lesson.aids.coreMarker;

    this.state = 'flying';
    this.updateHud();
    await unlock;
    this.sound.start();
    void this.requestWakeLock();
  }

  private tick(frameSeconds: number): void {
    const flight = this.flight;
    if (!flight) return;

    if (this.state === 'flying') {
      this.stepper.advance(frameSeconds, (dt) => flight.step(this.input.update(dt), dt));
      this.sound.update(flight.vario);
      this.hudTimer -= frameSeconds;
      if (this.hudTimer <= 0) {
        this.hudTimer = 0.1;
        this.updateHud();
      }
      if (flight.status !== 'flying') this.endFlight();
    }
    this.view.render();
  }

  private updateHud(): void {
    const flight = this.flight;
    if (!flight) return;
    this.hud.altitude.textContent = formatMeters(flight.glider.z);
    this.hud.agl.textContent = formatMeters(flight.heightAboveGround);
    this.hud.vario.textContent = formatClimb(flight.vario);
    this.hud.vario.style.color = flight.vario > 0.1 || flight.vario < -1.5 ? climbColorCss(flight.vario) : '';
    this.hud.average.textContent = formatClimb(flight.varioAverage);
    this.hud.time.textContent = formatDuration(flight.t);
    this.hud.goal.textContent = formatMeters(flight.setup.goalAltitude);
  }

  private pause(): void {
    if (this.state !== 'flying') return;
    this.state = 'paused';
    this.sound.stop();
    this.dialog.show(
      t('pause.title'),
      [],
      [
        { label: t('pause.resume'), onClick: () => this.resume() },
        { label: t('pause.restart'), secondary: true, onClick: () => void this.startLesson(this.lesson) },
        { label: t('menu.settings'), secondary: true, onClick: () => this.showSettings(() => this.pause()) },
        { label: t('pause.menu'), secondary: true, onClick: () => this.showMenu() },
      ],
      () => this.resume(),
    );
  }

  private resume(): void {
    this.dialog.close();
    this.state = 'flying';
    this.sound.start();
  }

  private endFlight(): void {
    const flight = this.flight!;
    this.state = 'ended';
    this.sound.stop();
    void this.releaseWakeLock();
    this.updateHud();

    const title = t(flight.status === 'goal' ? 'result.goal' : flight.status === 'landed' ? 'result.landed' : 'result.outOfMap');
    const gain = flight.altitudeGain;
    const stats = el('dl', { className: 'stats' }, [
      el('dt', { textContent: t('menu.difficulty') }),
      el('dd', { textContent: `${t(this.difficulty.labelKey)} · ${this.site.name}` }),
      el('dt', { textContent: t('result.flightTime') }),
      el('dd', { textContent: formatDuration(flight.t) }),
      el('dt', { textContent: t('result.altitudeGain') }),
      el('dd', { textContent: formatMeters(gain) }),
      el('dt', { textContent: t('result.maxAltitude') }),
      el('dd', { textContent: formatMeters(flight.maxAltitude) }),
      el('dt', { textContent: t('result.averageClimb') }),
      el('dd', { textContent: formatClimb(flight.t > 0 ? (flight.glider.z - flight.setup.start.z) / flight.t : 0) }),
    ]);

    const actions = [
      { label: t('result.retry'), onClick: () => void this.startLesson(this.lesson) },
      { label: t('result.menu'), secondary: true, onClick: () => this.showMenu() },
    ];
    const next = LESSONS[LESSONS.indexOf(this.lesson) + 1];
    if (flight.status === 'goal' && next) actions.unshift({ label: t('result.next'), onClick: () => void this.startLesson(next) });
    this.dialog.show(title, [stats], actions, () => this.showMenu());
  }

  private showMenu(): void {
    this.state = 'menu';
    this.sound.stop();
    void this.releaseWakeLock();
    this.dialog.close();
    $('game-ui').hidden = true;
    $('menu').hidden = false;
  }

  private showHowTo(): void {
    this.dialog.show(
      t('howToPlay.title'),
      [el('p', { textContent: t('howToPlay.body') }), el('p', { textContent: t('howToPlay.controlsTouch') }), el('p', { textContent: t('howToPlay.controlsKeyboard') })],
      [{ label: t('settings.close'), onClick: () => this.dialog.close() }],
      () => this.dialog.close(),
    );
  }

  private showSettings(onClose: () => void = () => this.dialog.close()): void {
    const segmented = <V extends string | boolean>(options: [V, string][], current: V, apply: (value: V) => void) => {
      const buttons = options.map(([value, label]) =>
        el('button', {
          type: 'button',
          textContent: label,
          onclick: () => {
            apply(value);
            buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(options[i][0] === value)));
          },
        }),
      );
      buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(options[i][0] === current)));
      return el('div', { className: 'segmented' }, buttons);
    };

    const close = () => {
      if (this.state === 'paused') this.state = 'flying';
      onClose();
    };
    this.dialog.show(
      t('menu.settings'),
      [
        el('div', { className: 'setting' }, [
          el('span', { textContent: t('settings.sound') }),
          segmented([[true, t('settings.on')], [false, t('settings.off')]], this.settings.sound, (sound) => {
            this.settings.sound = sound;
            this.sound.setEnabled(sound);
            saveSettings(this.settings);
          }),
        ]),
        el('div', { className: 'setting' }, [
          el('span', { textContent: t('settings.mapOrientation') }),
          segmented([['northUp', t('settings.northUp')], ['headingUp', t('settings.headingUp')]], this.settings.orientation, (orientation) => {
            this.settings.orientation = orientation;
            this.view.orientation = orientation;
            saveSettings(this.settings);
          }),
        ]),
        el('div', { className: 'setting' }, [
          el('span', { textContent: t('settings.hotspots') }),
          segmented([[true, t('settings.on')], [false, t('settings.off')]], this.settings.showHotspots, (show) => {
            this.settings.showHotspots = show;
            this.view.showHotspots = show;
            saveSettings(this.settings);
          }),
        ]),
        el('p', { className: 'setting-hint', textContent: t('settings.hotspotsHint') }),
      ],
      [{ label: t('settings.close'), onClick: close }],
      close,
    );
  }

  private async requestWakeLock(): Promise<void> {
    try {
      this.wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      this.wakeLock = null;
    }
  }

  private async releaseWakeLock(): Promise<void> {
    await this.wakeLock?.release().catch(() => undefined);
    this.wakeLock = null;
  }
}

async function main(): Promise<void> {
  setLocale(detectLocale());
  translateDom(document);
  document.title = t('app.title');

  try {
    const app = new Application();
    await app.init({
      resizeTo: window,
      background: '#1f3b2c',
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 3),
      autoDensity: true,
    });
    $('stage').appendChild(app.canvas);

    const site = findSite(loadSettings().siteId);
    const assets = await loadSiteAssets(site.terrainId);
    $('loading').hidden = true;
    new Game(app, site, assets);
  } catch (error) {
    console.error(error);
    $('loading').textContent = t('error.loading');
  }
}

void main();
