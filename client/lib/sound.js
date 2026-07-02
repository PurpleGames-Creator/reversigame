// 効果音（Web Audio API で合成）。音源ファイル不要。
// 石を置く「コトっ」＋ひっくり返る駒ごとの軽いカスケード音。

let ctx = null;

function getCtx() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  // ブラウザの自動再生制限：ユーザー操作後に resume される
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// ユーザー操作時に呼んでオーディオを有効化
export function unlockAudio() {
  getCtx();
}

// 木を打つような減衰音（body）。ピッチをわずかに下げると木質感が出る。
function woodTone(freq, { when = 0, dur = 0.12, gain = 0.25, type = 'triangle', cutoff = 2000 } = {}) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + when;

  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.62), t0 + dur);

  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.004); // 速いアタック
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); // 速い減衰

  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = cutoff;

  osc.connect(g).connect(lp).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

// アタックの「カッ」というノイズ成分（木同士が触れる質感）
function noiseTick(when = 0, gain = 0.1) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + when;
  const len = Math.floor(c.sampleRate * 0.02);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1700;
  bp.Q.value = 0.8;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(bp).connect(g).connect(c.destination);
  src.start(t0);
}

// 石を置く音「コトっ」
export function playPlace() {
  woodTone(196, { dur: 0.13, gain: 0.3, type: 'triangle', cutoff: 2000 });
  woodTone(98, { dur: 0.1, gain: 0.14, type: 'sine', cutoff: 1200 }); // 低音の芯
  noiseTick(0, 0.09);
}

// ひっくり返る駒の音（枚数ぶん軽くカスケード）
export function playFlips(count) {
  if (!count || count < 1) return;
  const n = Math.min(count, 8);
  for (let i = 0; i < n; i++) {
    woodTone(300 + i * 22 + Math.random() * 12, {
      when: 0.06 + i * 0.052,
      dur: 0.07,
      gain: Math.max(0.05, 0.15 - i * 0.01),
      type: 'triangle',
      cutoff: 2600,
    });
  }
}
