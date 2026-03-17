/**
 * Genera archivos WAV sintéticos para TIKTAK.
 * Ejecutar con: node generate_sounds.js
 */
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 22050;
const OUT_DIR = path.join(__dirname, 'assets', 'sounds');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function writeWav(filename, samples) {
  const numSamples = samples.length;
  const buffer = Buffer.alloc(44 + numSamples * 2);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);       // PCM chunk size
  buffer.writeUInt16LE(1, 20);        // PCM format
  buffer.writeUInt16LE(1, 22);        // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32);        // block align
  buffer.writeUInt16LE(16, 34);       // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  for (let i = 0; i < numSamples; i++) {
    const val = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(val * 32767), 44 + i * 2);
  }

  fs.writeFileSync(path.join(OUT_DIR, filename), buffer);
  console.log(`  ✓ ${filename} (${numSamples} samples, ${(numSamples / SAMPLE_RATE * 1000).toFixed(0)}ms)`);
}

function sine(freq, durationMs, amplitude = 0.5, fadeMs = 10) {
  const n = Math.floor(SAMPLE_RATE * durationMs / 1000);
  const fadeSamples = Math.floor(SAMPLE_RATE * fadeMs / 1000);
  return Array.from({ length: n }, (_, i) => {
    const t = i / SAMPLE_RATE;
    let env = 1;
    if (i < fadeSamples) env = i / fadeSamples;
    if (i > n - fadeSamples) env = (n - i) / fadeSamples;
    return amplitude * env * Math.sin(2 * Math.PI * freq * t);
  });
}

function concat(...arrays) {
  return [].concat(...arrays);
}

function silence(ms) {
  return Array(Math.floor(SAMPLE_RATE * ms / 1000)).fill(0);
}

console.log('Generando sonidos...');

// tap — 800 Hz, 60ms, suave
writeWav('tap.wav', sine(800, 60, 0.35, 15));

// win — arpeggio C5-E5-G5-C6
writeWav('win.wav', concat(
  sine(523, 80, 0.5, 10),
  silence(20),
  sine(659, 80, 0.5, 10),
  silence(20),
  sine(784, 80, 0.5, 10),
  silence(20),
  sine(1047, 160, 0.6, 20),
));

// lose — G4 descendiendo a D4
writeWav('lose.wav', concat(
  sine(392, 120, 0.5, 15),
  sine(349, 120, 0.45, 15),
  sine(294, 180, 0.4, 20),
));

// draw — 440 Hz doble beep
writeWav('draw.wav', concat(
  sine(440, 100, 0.4, 10),
  silence(60),
  sine(440, 100, 0.4, 10),
));

// wildcard — acorde 660+880, 120ms
writeWav('wildcard.wav', (() => {
  const n = Math.floor(SAMPLE_RATE * 150 / 1000);
  const fade = Math.floor(SAMPLE_RATE * 15 / 1000);
  return Array.from({ length: n }, (_, i) => {
    const t = i / SAMPLE_RATE;
    let env = 1;
    if (i < fade) env = i / fade;
    if (i > n - fade) env = (n - i) / fade;
    return 0.3 * env * (Math.sin(2 * Math.PI * 660 * t) + Math.sin(2 * Math.PI * 880 * t));
  });
})());

// countdown — 1000 Hz tick, 35ms
writeWav('countdown.wav', sine(1000, 35, 0.4, 8));

// purchase — arpeggio alegre C5-E5-G5 rápido + tono largo
writeWav('purchase.wav', concat(
  sine(523, 70, 0.5, 8),
  silence(15),
  sine(659, 70, 0.5, 8),
  silence(15),
  sine(784, 70, 0.5, 8),
  silence(15),
  sine(1047, 70, 0.5, 8),
  silence(15),
  sine(1319, 200, 0.55, 25),
));

// challenge — dos beeps rápidos a 660 Hz
writeWav('challenge.wav', concat(
  sine(660, 90, 0.5, 10),
  silence(50),
  sine(660, 90, 0.5, 10),
  silence(50),
  sine(880, 140, 0.55, 15),
));

console.log('\n¡Listo! Archivos en:', OUT_DIR);
