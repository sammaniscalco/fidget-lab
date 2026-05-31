import React, { useEffect, useRef } from '../vendor/react.mjs';
import { createRoot } from '../vendor/react-dom-client.mjs';

const fidgets = [
  { id: 'stress', label: 'Stress ball', icon: 'O' },
  { id: 'spinner', label: 'Spinner', icon: '*' },
  { id: 'popit', label: 'Pop-it', icon: '#' }
];

const shapes = {
  stress: ['round', 'heart', 'bean'],
  spinner: ['tri', 'quad', 'bar'],
  popit: ['square', 'circle', 'flower']
};

const palettes = [
  { name: 'Lagoon', primary: '#21b6a8', secondary: '#ffcf56', accent: '#f05d5e' },
  { name: 'Berry', primary: '#d94f8b', secondary: '#62d2ff', accent: '#ffd166' },
  { name: 'Citrus', primary: '#ff8b3d', secondary: '#7bd957', accent: '#4d96ff' },
  { name: 'Mint', primary: '#48cfae', secondary: '#f7a072', accent: '#7567ff' }
];

const state = {
  type: 'stress',
  paletteIndex: 0,
  primary: palettes[0].primary,
  secondary: palettes[0].secondary,
  accent: palettes[0].accent,
  size: 64,
  softness: 58,
  shape: 'round',
  muted: false,
  soundWave: 'toy',
  tonePitch: 100,
  toneLength: 100,
  toneVolume: 75,
  noiseAmount: 8,
  popResetKey: 0
};

let audioContext;
let spinnerDegrees = 0;
let spinnerVelocity = 0;
let spinnerFrame = 0;

let root;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function update(next) {
  Object.assign(state, next);
  render();
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'className') node.className = value;
    else if (key === 'style') Object.assign(node.style, value);
    else if (key === 'value') node.value = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value !== false && value != null) node.setAttribute(key, value);
  });
  children.flat().forEach((child) => {
    node.append(child instanceof Node ? child : document.createTextNode(child));
  });
  return node;
}

function svgIcon(name) {
  const symbols = {
    play: '▶',
    pointer: '⌖',
    palette: '◐',
    sliders: '≡',
    sound: state.muted ? '×' : '♪',
    reset: '↻'
  };
  return el('span', { className: 'mini-icon', 'aria-hidden': 'true' }, [symbols[name]]);
}

function playTone(kind) {
  if (state.muted) return;
  if (!audioContext) audioContext = new AudioContext();
  if (audioContext.state === 'suspended') audioContext.resume();

  const audio = audioContext;
  const now = audio.currentTime;
  const gain = audio.createGain();
  const osc = audio.createOscillator();
  const filter = audio.createBiquadFilter();
  const config = {
    pop: { type: 'triangle', start: 520, end: 160, length: 0.13, gain: 0.22 },
    squish: { type: 'sine', start: 140, end: 90, length: 0.18, gain: 0.16 },
    spin: { type: 'sawtooth', start: 250, end: 410, length: 0.09, gain: 0.08 },
    reset: { type: 'square', start: 220, end: 180, length: 0.08, gain: 0.06 }
  }[kind];

  filter.type = 'lowpass';
  const length = config.length * state.toneLength / 100;
  const level = config.gain * state.toneVolume / 100;
  const pitch = state.tonePitch / 100;
  const wave = state.soundWave === 'toy' ? config.type : state.soundWave;
  filter.frequency.setValueAtTime((kind === 'spin' ? 650 : 900) * clamp(pitch, 0.65, 1.8), now);
  osc.type = wave;
  osc.frequency.setValueAtTime(config.start * pitch, now);
  osc.frequency.exponentialRampToValueAtTime(config.end * pitch, now + length);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(level, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audio.destination);
  osc.start(now);
  osc.stop(now + length + 0.03);

  if (state.noiseAmount > 0) {
    const noiseLength = Math.max(0.04, length * 0.72);
    const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * noiseLength), audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / data.length);
    }
    const noise = audio.createBufferSource();
    const noiseGain = audio.createGain();
    const noiseFilter = audio.createBiquadFilter();
    noise.buffer = buffer;
    noiseFilter.type = kind === 'pop' ? 'bandpass' : 'lowpass';
    noiseFilter.frequency.setValueAtTime(kind === 'pop' ? 1300 * pitch : 520 * pitch, now);
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(state.noiseAmount / 450, now + 0.008);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + noiseLength);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(audio.destination);
    noise.start(now);
    noise.stop(now + noiseLength + 0.02);
  }
}

function render() {
  document.documentElement.style.setProperty('--primary', state.primary);
  document.documentElement.style.setProperty('--secondary', state.secondary);
  document.documentElement.style.setProperty('--accent', state.accent);
  root.replaceChildren(
    el('main', { className: 'app', style: { '--primary': state.primary, '--secondary': state.secondary, '--accent': state.accent } }, [
      el('section', { className: 'workbench', 'aria-label': 'Fidget designer' }, [
        renderPanel(),
        renderStage()
      ])
    ])
  );
}

function renderPanel() {
  return el('aside', { className: 'panel' }, [
    el('div', { className: 'brand' }, [
      el('span', { className: 'brand-mark' }, [svgIcon('play')]),
      el('div', {}, [el('h1', {}, ['Fidget Lab']), el('p', {}, ['Design it, then poke it.'])])
    ]),
    el('div', { className: 'control-group' }, [
      el('div', { className: 'group-title' }, [svgIcon('pointer'), ' Type']),
      el('div', { className: 'segmented' }, fidgets.map((item) => el('button', {
        className: state.type === item.id ? 'is-active' : '',
        title: item.label,
        'aria-label': item.label,
        onclick: () => update({ type: item.id, shape: shapes[item.id][0] })
      }, [el('span', { className: 'toy-icon' }, [item.icon]), el('span', {}, [item.label])])))
    ]),
    el('div', { className: 'control-group' }, [
      el('div', { className: 'group-title' }, [svgIcon('palette'), ' Color']),
      el('div', { className: 'palette-row' }, palettes.map((palette, index) => el('button', {
        className: `swatch ${state.paletteIndex === index ? 'is-active' : ''}`,
        title: palette.name,
        'aria-label': palette.name,
        style: { '--a': palette.primary, '--b': palette.secondary, '--c': palette.accent },
        onclick: () => update({ paletteIndex: index, primary: palette.primary, secondary: palette.secondary, accent: palette.accent })
      }, [
        el('span', { className: 'swatch-chip', style: { backgroundColor: palette.primary } }),
        el('span', { className: 'swatch-chip', style: { backgroundColor: palette.secondary } }),
        el('span', { className: 'swatch-chip', style: { backgroundColor: palette.accent } })
      ]))),
      el('div', { className: 'color-inputs' }, [
        colorControl('Main', 'primary'),
        colorControl('Edge', 'secondary'),
        colorControl('Pop', 'accent')
      ])
    ]),
    el('div', { className: 'control-group' }, [
      el('div', { className: 'group-title' }, [svgIcon('sliders'), ' Shape']),
      el('div', { className: 'shape-grid' }, shapes[state.type].map((option) => el('button', {
        className: state.shape === option ? 'is-active' : '',
        onclick: () => update({ shape: option })
      }, [option]))),
      rangeControl('Size', 'size', 42, 88),
      rangeControl('Bounce', 'softness', 20, 90)
    ]),
    renderSoundControls(),
    el('div', { className: 'toolbar' }, [
      el('button', {
        className: 'icon-button',
        title: state.muted ? 'Turn sound on' : 'Mute sound',
        'aria-label': state.muted ? 'Turn sound on' : 'Mute sound',
        onclick: () => update({ muted: !state.muted })
      }, [svgIcon('sound')]),
      el('button', {
        className: 'reset-button',
        onclick: () => {
          playTone('reset');
          update({ popResetKey: state.popResetKey + 1 });
        }
      }, [svgIcon('reset'), 'Reset toy'])
    ])
  ]);
}

function renderSoundControls() {
  return el('div', { className: 'control-group sound-controls' }, [
    el('div', { className: 'group-title' }, [svgIcon('sound'), ' Sound']),
    el('label', { className: 'select-label' }, [
      'Tone',
      el('select', { value: state.soundWave, onchange: (event) => update({ soundWave: event.target.value }) }, [
        el('option', { value: 'toy' }, ['Toy defaults']),
        el('option', { value: 'sine' }, ['Soft sine']),
        el('option', { value: 'triangle' }, ['Plucky triangle']),
        el('option', { value: 'square' }, ['Chippy square']),
        el('option', { value: 'sawtooth' }, ['Buzzy saw'])
      ])
    ]),
    rangeControl('Pitch', 'tonePitch', 55, 170),
    rangeControl('Length', 'toneLength', 45, 180),
    rangeControl('Volume', 'toneVolume', 0, 100),
    rangeControl('Noise', 'noiseAmount', 0, 80),
    el('div', { className: 'test-tones' }, [
      el('button', { className: 'tone-button', onclick: () => playTone('pop') }, ['Pop']),
      el('button', { className: 'tone-button', onclick: () => playTone('squish') }, ['Squish']),
      el('button', { className: 'tone-button', onclick: () => playTone('spin') }, ['Spin'])
    ])
  ]);
}

function colorControl(label, key) {
  return el('label', {}, [
    label,
    el('input', { type: 'color', value: state[key], oninput: (event) => update({ [key]: event.target.value }) })
  ]);
}

function rangeControl(label, key, min, max) {
  return el('label', { className: 'range-label' }, [
    label,
    el('input', { type: 'range', min, max, value: state[key], oninput: (event) => update({ [key]: Number(event.target.value) }) }),
    el('output', {}, [String(state[key])])
  ]);
}

function renderStage() {
  const hint = state.type === 'stress' ? 'Press and drag to squish' : state.type === 'spinner' ? 'Flick or click to spin' : 'Press bubbles to pop';
  return el('section', { className: 'stage', 'aria-label': 'Interactive fidget play area' }, [
    el('div', { className: 'stage-light one' }),
    el('div', { className: 'stage-light two' }),
    el('div', { className: 'toy-shell' }, [renderToy()]),
    el('div', { className: 'status-strip' }, [
      el('span', {}, [hint]),
      el('span', {}, [`${state.shape} / ${state.size}% / ${state.softness}%`])
    ])
  ]);
}

function renderToy() {
  if (state.type === 'stress') return renderStressBall();
  if (state.type === 'spinner') return renderSpinner();
  return renderPopIt();
}

function renderStressBall() {
  const base = 190 + state.size * 2.2;
  const toy = el('div', {
    className: `stress toy stress-${state.shape}`,
    style: {
      width: `${base}px`,
      height: `${base}px`,
      '--squish-x': 1,
      '--squish-y': 1,
      '--press-x': '0px',
      '--press-y': '0px',
      '--shine-x': '50%',
      '--shine-y': '32%',
      '--twist': '0deg'
    },
    role: 'button',
    tabindex: '0',
    'aria-label': 'Squishy stress ball'
  }, [
    el('span', { className: 'stress-highlight' }),
    el('span', { className: 'stress-dent' }),
    el('span', { className: 'stress-label' }, ['0 psi'])
  ]);

  let down = false;
  let frame = 0;
  let lastMove = { x: 0, y: 0 };
  const physics = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    targetX: 0,
    targetY: 0,
    squash: 1,
    stretch: 1,
    targetSquash: 1,
    targetStretch: 1
  };
  const label = toy.querySelector('.stress-label');

  const applyStressFrame = () => {
    const spring = down ? 0.34 : 0.17;
    const damping = down ? 0.58 : 0.72;
    physics.vx = (physics.vx + (physics.targetX - physics.x) * spring) * damping;
    physics.vy = (physics.vy + (physics.targetY - physics.y) * spring) * damping;
    physics.x += physics.vx;
    physics.y += physics.vy;
    physics.stretch += (physics.targetStretch - physics.stretch) * 0.28;
    physics.squash += (physics.targetSquash - physics.squash) * 0.28;

    const pressure = Math.hypot(physics.x, physics.y);
    toy.style.setProperty('--press-x', `${physics.x}px`);
    toy.style.setProperty('--press-y', `${physics.y}px`);
    toy.style.setProperty('--shine-x', `${50 + physics.x / 2}%`);
    toy.style.setProperty('--shine-y', `${32 + physics.y / 2}%`);
    toy.style.setProperty('--squish-x', physics.stretch.toFixed(3));
    toy.style.setProperty('--squish-y', physics.squash.toFixed(3));
    toy.style.setProperty('--twist', `${clamp(physics.vx * 0.9, -10, 10)}deg`);
    label.textContent = `${Math.round(pressure)} psi`;

    if (
      down ||
      Math.abs(physics.vx) > 0.05 ||
      Math.abs(physics.vy) > 0.05 ||
      Math.abs(physics.x) > 0.05 ||
      Math.abs(physics.y) > 0.05 ||
      Math.abs(physics.stretch - 1) > 0.002 ||
      Math.abs(physics.squash - 1) > 0.002
    ) {
      frame = requestAnimationFrame(applyStressFrame);
    } else {
      frame = 0;
      toy.style.setProperty('--press-x', '0px');
      toy.style.setProperty('--press-y', '0px');
      toy.style.setProperty('--shine-x', '50%');
      toy.style.setProperty('--shine-y', '32%');
      toy.style.setProperty('--squish-x', 1);
      toy.style.setProperty('--squish-y', 1);
      toy.style.setProperty('--twist', '0deg');
      label.textContent = '0 psi';
    }
  };

  const ensureStressFrame = () => {
    if (!frame) frame = requestAnimationFrame(applyStressFrame);
  };

  const move = (event) => {
    const rect = toy.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 44;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 44;
    const dx = x - lastMove.x;
    const dy = y - lastMove.y;
    const pressure = clamp(Math.hypot(x, y) / 31, 0, 1);
    const dragForce = clamp(Math.hypot(dx, dy) / 14, 0, 1);
    physics.targetX = x;
    physics.targetY = y;
    physics.targetStretch = clamp(1 + pressure * state.softness / 230 + dragForce * 0.08, 1.03, 1.32);
    physics.targetSquash = clamp(1 - pressure * state.softness / 330 - dragForce * 0.05, 0.72, 0.96);
    lastMove = { x, y };
    ensureStressFrame();
  };

  toy.addEventListener('pointerdown', (event) => {
    down = true;
    toy.setPointerCapture(event.pointerId);
    toy.classList.add('is-pressed');
    move(event);
    playTone('squish');
  });
  toy.addEventListener('pointermove', (event) => {
    if (down) move(event);
  });
  ['pointerup', 'pointercancel'].forEach((name) => toy.addEventListener(name, () => {
    down = false;
    toy.classList.remove('is-pressed');
    physics.targetX = 0;
    physics.targetY = 0;
    physics.targetStretch = clamp(0.95 - Math.abs(physics.vx) / 130, 0.86, 0.99);
    physics.targetSquash = clamp(1.06 + Math.abs(physics.vy) / 100, 1.02, 1.2);
    setTimeout(() => {
      physics.targetStretch = 1;
      physics.targetSquash = 1;
      ensureStressFrame();
    }, 120);
    ensureStressFrame();
  }));
  return toy;
}

function renderSpinner() {
  const base = 170 + state.size * 2.25;
  const blades = state.shape === 'bar' ? 2 : state.shape === 'quad' ? 4 : 3;
  const spinner = el('div', {
    className: `spinner spinner-${state.shape}`,
    style: { transform: `rotate(${spinnerDegrees}deg)` }
  }, [
    Array.from({ length: blades }, (_, index) => el('span', {
      className: 'spinner-blade',
      style: { transform: `rotate(${index * (360 / blades)}deg) translateY(-37%)` }
    }, [el('i')])),
    el('span', { className: 'spinner-hub' })
  ]);
  const wrap = el('div', {
    className: 'spinner-wrap toy',
    style: { width: `${base}px`, height: `${base}px` },
    role: 'button',
    tabindex: '0',
    'aria-label': 'Spinning fidget spinner'
  }, [spinner]);

  let drag = null;
  let lastTick = 0;

  const spinStep = (time) => {
    const delta = lastTick ? Math.min((time - lastTick) / 1000, 0.04) : 0.016;
    lastTick = time;
    spinnerDegrees += spinnerVelocity * delta;
    spinnerVelocity *= Math.pow(0.975 - state.softness / 7000, delta * 60);
    spinner.style.transform = `rotate(${spinnerDegrees}deg)`;

    if (Math.abs(spinnerVelocity) > 5) {
      spinnerFrame = requestAnimationFrame(spinStep);
    } else {
      spinnerVelocity = 0;
      spinnerFrame = 0;
      lastTick = 0;
    }
  };

  const addMomentum = (velocity) => {
    spinnerVelocity = clamp(spinnerVelocity + velocity, -2600, 2600);
    if (!spinnerFrame) spinnerFrame = requestAnimationFrame(spinStep);
    playTone('spin');
  };

  const angleFromEvent = (event) => {
    const rect = wrap.getBoundingClientRect();
    return Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2));
  };

  wrap.addEventListener('pointerdown', (event) => {
    wrap.setPointerCapture(event.pointerId);
    drag = { angle: angleFromEvent(event), time: performance.now() };
  });
  wrap.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const angle = angleFromEvent(event);
    const now = performance.now();
    let delta = angle - drag.angle;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    const elapsed = Math.max((now - drag.time) / 1000, 0.016);
    spinnerDegrees += delta * 180 / Math.PI;
    spinner.style.transform = `rotate(${spinnerDegrees}deg)`;
    spinnerVelocity = clamp((delta * 180 / Math.PI) / elapsed * 1.25, -2200, 2200);
    drag = { angle, time: now };
  });
  wrap.addEventListener('pointerup', () => {
    if (drag) addMomentum(spinnerVelocity || 720);
    drag = null;
  });
  wrap.addEventListener('pointercancel', () => {
    drag = null;
  });
  wrap.addEventListener('click', () => addMomentum(900 + state.softness * 9));
  return wrap;
}

function renderPopIt() {
  const count = state.shape === 'flower' ? 19 : state.shape === 'circle' ? 21 : 25;
  const base = 190 + state.size * 2.15;
  return el('div', {
    className: `popit toy popit-${state.shape}`,
    style: { width: `${base}px`, height: `${base}px`, '--bounce': state.softness }
  }, Array.from({ length: count }, (_, index) => {
    const bubble = el('button', { className: 'bubble', 'aria-label': `Bubble ${index + 1}` });
    bubble.addEventListener('pointerdown', () => {
      bubble.classList.toggle('is-popped');
      playTone('pop');
    });
    return bubble;
  }));
}

function FidgetApp() {
  const mountRef = useRef(null);

  useEffect(() => {
    root = mountRef.current;
    render();
    return () => {
      root = null;
    };
  }, []);

  return React.createElement('div', { ref: mountRef });
}

createRoot(document.getElementById('root')).render(React.createElement(FidgetApp));
