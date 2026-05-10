let globalSfxVolume = 1.0;

const uiSfxUrls = {
  click:       '/audio/sfx/ui_click.ogg',
  hover:       '/audio/sfx/ui_hover.ogg',
  choiceClick: '/audio/sfx/ui_choice.ogg',
  confirm:     '/audio/sfx/ui_confirm.ogg',
  actionBtn:   '/audio/sfx/ui_action.ogg',  // replaces the laser blaster
};

const audioPool: Record<string, HTMLAudioElement[]> = {};

export function setUiSfxVolume(vol: number) {
  globalSfxVolume = vol;
}

export function playUiSfx(type: keyof typeof uiSfxUrls) {
  if (globalSfxVolume <= 0) return;
  const url = uiSfxUrls[type];
  if (!url) return;

  if (!audioPool[type]) {
    audioPool[type] = [];
  }

  let audio = audioPool[type].find(a => a.paused || a.ended);
  if (!audio) {
    audio = new Audio(url);
    audioPool[type].push(audio);
  }

  let vol = globalSfxVolume;
  if (type === 'hover' || type === 'click' || type === 'choiceClick') {
    vol = globalSfxVolume * 0.6;
  }
  audio.volume = vol;
  audio.currentTime = 0;
  audio.play().catch((e) => { 
    if (e.name !== 'NotAllowedError') {
      console.debug('UI SFX playback deferred:', e.message); 
    }
  });
}
