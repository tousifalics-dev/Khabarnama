/**
 * Synthesizes a clean, broadcast-grade local newsroom WAV audio Blob (chime + warm studio bed)
 * so starter reels and offline fallback reels play uninterrupted on native HTML5 <audio>
 * with zero Gemini API calls or quota dependencies.
 */
export function createNewsroomBroadcastWavBlob(durationSec = 18): Blob {
  const safeDuration = Math.min(90, Math.max(6, Math.round(durationSec)));
  const sampleRate = 16000;
  const numSamples = sampleRate * safeDuration;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = numSamples * blockAlign;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  // Subtle broadcast chime (0..0.9s) followed by soft rhythmic newsroom pulse bed
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;

    // Opening 3-note newsroom bulletin sting (C5 -> E5 -> G5)
    if (t < 0.95) {
      const n1 = t < 0.35 ? Math.sin(2 * Math.PI * 523.25 * t) * Math.exp(-t * 7.5) : 0;
      const n2 =
        t >= 0.14 && t < 0.55
          ? Math.sin(2 * Math.PI * 659.25 * (t - 0.14)) * Math.exp(-(t - 0.14) * 7.0)
          : 0;
      const n3 =
        t >= 0.28
          ? Math.sin(2 * Math.PI * 783.99 * (t - 0.28)) * Math.exp(-(t - 0.28) * 5.2)
          : 0;
      sample += (n1 * 0.22 + n2 * 0.2 + n3 * 0.24);
    }

    // Soft studio pad & gentle 2Hz news ticker pulse bed
    const pad =
      Math.sin(2 * Math.PI * 110 * t) * 0.028 +
      Math.sin(2 * Math.PI * 164.81 * t) * 0.018;
    const pulsePhase = t % 0.5;
    const tickEnv = pulsePhase < 0.045 ? Math.exp(-pulsePhase * 65) * 0.032 : 0;
    const tickTone = Math.sin(2 * Math.PI * 880 * pulsePhase) * tickEnv;

    // Smooth fade-in and fade-out
    const fadeIn = Math.min(1, t / 0.12);
    const fadeOut = Math.min(1, Math.max(0, (safeDuration - t) / 0.5));
    const mixed = (sample + pad + tickTone) * fadeIn * fadeOut;

    const clamped = Math.max(-1, Math.min(1, mixed));
    view.setInt16(44 + i * 2, Math.round(clamped * 32767), true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

const SPEECH_LANG_MAP: Record<string, string> = {
  hi: 'hi-IN',
  bho: 'hi-IN',
  en: 'en-IN',
  mr: 'mr-IN',
  ta: 'ta-IN',
  bn: 'bn-IN',
};

/**
 * Checks whether the browser/WebView exposes local SpeechSynthesis voices
 * so starter or offline fallback reels can speak text cleanly with zero API calls.
 */
export function hasAvailableLocalSpeechVoice(language: string): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  try {
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return false;
    const targetPrefix = (SPEECH_LANG_MAP[language] || 'hi-IN').split('-')[0].toLowerCase();
    return voices.some((v) => v.lang.toLowerCase().startsWith(targetPrefix)) || voices.length > 0;
  } catch {
    return false;
  }
}

export function startLocalSpeechFallback(
  text: string,
  language: string,
  rate = 1.0
): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  const clean = text.trim();
  if (!clean) return false;
  try {
    window.speechSynthesis.cancel();
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return false;

    const targetLang = SPEECH_LANG_MAP[language] || 'hi-IN';
    const shortCode = targetLang.split('-')[0].toLowerCase();
    const matchedVoice =
      voices.find((v) => v.lang.toLowerCase() === targetLang.toLowerCase()) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(shortCode)) ||
      voices.find((v) => v.lang.toLowerCase().startsWith('en'));

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = matchedVoice?.lang || targetLang;
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }
    utterance.rate = Math.min(1.25, Math.max(0.85, rate));
    utterance.pitch = 1.0;
    utterance.volume = 0.92;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

export function stopLocalSpeechFallback(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Ignore speechSynthesis cleanup errors
  }
}
