export function createAudio() {
  let context, master, timer, enabled = false, phase = 'present', beat = 0, volume = .58;
  let transition = Promise.resolve();
  const scale = [48, 55, 60, 62, 64, 67, 71, 72];
  function note(midi, duration = 2.8, gain = 0.07) {
    if (!context || !enabled) return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    envelope.gain.setValueAtTime(0, context.currentTime);
    envelope.gain.linearRampToValueAtTime(gain, context.currentTime + .035);
    envelope.gain.exponentialRampToValueAtTime(.0001, context.currentTime + duration);
    oscillator.connect(envelope).connect(master);
    oscillator.start();
    oscillator.stop(context.currentTime + duration + .1);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }
  function tick() {
    if (!enabled || document.hidden) return;
    const melody = [2, 4, 3, 1, 2, 5, 4, 3, 2, 1, 0, 1, 2, 4, 6, 5];
    const offset = phase === 'echo' ? -2 : 0;
    note(scale[melody[beat % melody.length]] + 12 + offset, 3.5, .045);
    if (beat % 4 === 0) { note(48 + offset, 5, .05); note(55 + offset, 4, .025); }
    beat++;
  }
  async function changeEnabled() {
      if (!context) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return false;
        context = new Audio();
        master = context.createGain();
        master.gain.value = volume;
        master.connect(context.destination);
      }
      if (!enabled) {
        await context.resume();
        enabled = true;
        tick();
        timer = setInterval(tick, 900);
      } else {
        enabled = false;
        clearInterval(timer);
        timer = undefined;
        await context.suspend();
      }
      return enabled;
  }
  return {
    toggle() {
      transition = transition.catch(() => {}).then(changeEnabled);
      return transition;
    },
    setPhase(value) { phase = value; },
    setVolume(value) {
      if (!Number.isFinite(value)) return;
      volume = Math.max(0, Math.min(1, value));
      if (master) master.gain.setTargetAtTime(volume, context.currentTime, .04);
    },
    chime() { note(phase === 'echo' ? 74 : 76, 1.3, .045); },
    delivery() { [0, 4, 7, 12].forEach((offset, i) => setTimeout(() => note(60 + offset, 2, .08), i * 130)); },
    isEnabled() { return enabled; },
    dispose() { clearInterval(timer); void context?.close(); },
  };
}
