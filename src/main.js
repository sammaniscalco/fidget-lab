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
  popResetKey: 0
};

let audioContext;
let spinnerDegrees = 0;

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
  filter.frequency.setValueAtTime(kind === 'spin' ? 650 : 900, now);
  osc.type = config.type;
  osc.frequency.setValueAtTime(config.start, now);
  osc.frequency.exponentialRampToValueAtTime(config.end, now + config.length);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(config.gain, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + config.length);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audio.destination);
  osc.start(now);
  osc.stop(now + config.length + 0.03);
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
      }))),
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
      '--shine-y': '32%'
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
  const label = toy.querySelector('.stress-label');
  const move = (event) => {
    const rect = toy.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 44;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 44;
    toy.style.setProperty('--press-x', `${x}px`);
    toy.style.setProperty('--press-y', `${y}px`);
    toy.style.setProperty('--shine-x', `${50 + x / 2}%`);
    toy.style.setProperty('--shine-y', `${32 + y / 2}%`);
    label.textContent = `${Math.round(Math.hypot(x, y))} psi`;
  };

  toy.addEventListener('pointerdown', (event) => {
    down = true;
    toy.setPointerCapture(event.pointerId);
    toy.classList.add('is-pressed');
    toy.style.setProperty('--squish-x', clamp(1 + state.softness / 420, 1.06, 1.22));
    toy.style.setProperty('--squish-y', clamp(1 - state.softness / 520, 0.82, 0.95));
    move(event);
    playTone('squish');
  });
  toy.addEventListener('pointermove', (event) => {
    if (down) move(event);
  });
  ['pointerup', 'pointercancel'].forEach((name) => toy.addEventListener(name, () => {
    down = false;
    toy.classList.remove('is-pressed');
    toy.style.setProperty('--squish-x', 1);
    toy.style.setProperty('--squish-y', 1);
  }));
  return toy;
}

function renderSpinner() {
  const base = 170 + state.size * 2.25;
  const blades = state.shape === 'bar' ? 2 : state.shape === 'quad' ? 4 : 3;
  const speed = clamp(1.4 - state.softness / 130, 0.55, 1.25);
  const spinner = el('div', {
    className: `spinner spinner-${state.shape}`,
    style: { '--duration': `${speed}s`, transform: `rotate(${spinnerDegrees}deg)` }
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
  const flick = (boost = 1) => {
    spinnerDegrees += 360 * boost + state.softness * 3;
    spinner.style.transform = `rotate(${spinnerDegrees}deg)`;
    playTone('spin');
  };
  wrap.addEventListener('pointerdown', (event) => {
    wrap.setPointerCapture(event.pointerId);
    drag = { x: event.clientX, y: event.clientY };
  });
  wrap.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const distance = Math.hypot(event.clientX - drag.x, event.clientY - drag.y);
    if (distance > 28) {
      flick(clamp(distance / 80, 0.8, 2.5));
      drag = { x: event.clientX, y: event.clientY };
    }
  });
  wrap.addEventListener('pointerup', () => {
    drag = null;
  });
  wrap.addEventListener('click', () => flick(1));
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
