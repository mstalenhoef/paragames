/** Dutch messages. This catalog defines the set of keys every locale must provide. */
export const nl = {
  'app.title': 'Thermiek centreren',
  'app.subtitle': 'Leer de kern van de thermiekbel te vinden.',

  'menu.site': 'Vlieggebied',
  'menu.difficulty': 'Moeilijkheid',
  'menu.levels': 'Niveaus',

  'difficulty.easy': 'Makkelijk',
  'difficulty.easy.description': 'Brede thermiek die geleidelijk zwakker wordt naar de rand, zonder dalende lucht eromheen.',
  'difficulty.medium': 'Gemiddeld',
  'difficulty.medium.description': 'Thermiek van gemiddelde breedte met een lichte dalende rand.',
  'difficulty.hard': 'Moeilijk',
  'difficulty.hard.description': 'Smalle kern die snel zwakker wordt, omringd door dalende lucht.',
  'menu.settings': 'Instellingen',
  'menu.howToPlay': 'Uitleg',
  'menu.start': 'Vliegen',

  'howToPlay.title': 'Zo centreer je',
  'howToPlay.body':
    'Luister naar de vario. Wordt het stijgen sterker, maak dan je bocht wat ruimer  zodat je richting de kern schuift. ' +
    'Wordt het stijgen weer zwakker, verkrap dan je bocht zodat je terug draait naar de betere lift. ' +
    'Een steilere bocht is krapper, maar je daalt er ook sneller mee.',
  'howToPlay.controlsTouch': 'Telefoon: houd de linker- of rechterrem ingedrukt en schuif omlaag voor meer rem.',
  'howToPlay.controlsKeyboard':
    'Toetsenbord: Z trekt de linkerrem aan, A laat hem vieren; M trekt de rechterrem aan, K laat hem vieren. De rem blijft staan waar je hem loslaat. Spatie pauzeert, +/− zoomt.',

  'level.intro.title': '1. De bel in beeld',
  'level.intro.description': 'De thermiek is zichtbaar op de kaart. Cirkel rond de kern en stijg naar {goal}.',
  'level.trail.title': '2. Volg je spoor',
  'level.trail.description': 'De thermiek is onzichtbaar. Je spoor kleurt naar het stijgen: verschuif je cirkels naar het warme deel.',
  'level.vario.title': '3. Alleen de vario',
  'level.vario.description': 'Geen hulpmiddelen meer op de kaart. Centreer op gevoel en geluid.',

  'hud.altitude': 'Hoogte',
  'hud.heightAboveGround': 'Boven grond',
  'hud.vario': 'Vario',
  'hud.average': 'Gemiddeld',
  'hud.time': 'Tijd',
  'hud.goal': 'Doel',
  'hud.brakeLeft': 'Linkerrem',
  'hud.brakeRight': 'Rechterrem',
  'hud.pause': 'Pauze',
  'hud.zoomIn': 'Inzoomen',
  'hud.zoomOut': 'Uitzoomen',

  'pause.title': 'Gepauzeerd',
  'pause.resume': 'Verder vliegen',
  'pause.restart': 'Opnieuw',
  'pause.menu': 'Naar menu',

  'result.goal': 'Doel bereikt!',
  'result.landed': 'Geland',
  'result.outOfMap': 'Buiten de kaart gevlogen',
  'result.flightTime': 'Vliegtijd',
  'result.altitudeGain': 'Hoogtewinst',
  'result.maxAltitude': 'Maximale hoogte',
  'result.averageClimb': 'Gemiddeld stijgen',
  'result.retry': 'Opnieuw',
  'result.next': 'Volgend niveau',
  'result.menu': 'Menu',

  'settings.sound': 'Vario-geluid',
  'settings.mapOrientation': 'Kaartoriëntatie',
  'settings.northUp': 'Noorden boven',
  'settings.headingUp': 'Vliegrichting boven',
  'settings.gliderColor': 'Kleur scherm (Swing Serac RS)',
  'settings.hotspots': 'Thermiek-hotspots',
  'settings.hotspotsHint': 'Plekken waar vaak thermiek gevonden wordt, volgens duizenden vluchten (thermal.kk7.ch). Hoe feller, hoe groter de kans.',
  'settings.close': 'Sluiten',
  'settings.on': 'Aan',
  'settings.off': 'Uit',

  'legend.lift': 'Stijgen',
  'legend.sink': 'Dalen',
  'legend.core': 'Kern',

  'loading': 'Laden…',
  'error.loading': 'Kon de kaart niet laden.',
  'credits': 'Kaartgegevens',
} as const;
