import { useCallback, useEffect, useRef, useState } from 'react';
import { estimateNarrationDurationSec } from '../data/newsReels';
import {
  GeminiTtsStatus,
  LanguageCode,
  SubtitleCue,
  VoiceEngineConfig,
} from '../types';
import {
  base64AudioToWavBlob,
  buildAudioCacheKey,
  getCachedGeminiAudioBlob,
  saveGeminiAudioBlob,
} from '../utils/audioCacheDb';
import {
  createNewsroomBroadcastWavBlob,
  startLocalSpeechFallback,
  stopLocalSpeechFallback,
} from '../utils/localBroadcastAudio';

export interface NarrationSegment {
  cueIndex: number; // -1 for headline, 0..N-1 for subtitle cues
  text: string;
  wordOffsets: number[];
  globalCharStart: number;
  globalCharEnd: number;
  charLength: number;
}

interface CachedGeminiAudio {
  objectUrl: string;
  textSnapshot: string;
  durationSec?: number;
}

interface SpeechNarrationOptions {
  enabled: boolean;
  isPlaying: boolean;
  language: LanguageCode;
  reelId: string;
  audioUrl?: string;
  headline: string;
  subtitles: SubtitleCue[];
  nextReelId?: string;
  nextAudioUrl?: string;
  nextHeadline?: string;
  nextSubtitles?: SubtitleCue[];
  seekTargetSec: number | null;
  seekVersion: number;
  rateMultiplier?: number;
  voiceConfig: VoiceEngineConfig;
  onSyncCue?: (
    cueIndex: number,
    cueWordIndex: number,
    progress: number,
    audioCurrentSec: number,
    audioDurationSec: number
  ) => void;
  onCompleteReel?: () => void;
}

function getWordOffsets(text: string): number[] {
  const offsets: number[] = [];
  const words = text.split(/\s+/).filter(Boolean);
  let pos = 0;
  for (const w of words) {
    const idx = text.indexOf(w, pos);
    const actual = idx >= 0 ? idx : pos;
    offsets.push(actual);
    pos = actual + w.length;
  }
  return offsets;
}

export function buildNarrationSegments(
  headline: string,
  subtitles: SubtitleCue[],
  language: LanguageCode
): { segments: NarrationSegment[]; totalTextChars: number; fullScriptText: string } {
  const rawParts: Array<{ cueIndex: number; text: string }> = [];
  const cleanHeadline = headline.trim();
  if (cleanHeadline) {
    rawParts.push({ cueIndex: -1, text: cleanHeadline });
  }
  subtitles.forEach((cue, idx) => {
    const txt = (cue.text[language] || '').trim();
    if (txt) {
      rawParts.push({ cueIndex: idx, text: txt });
    }
  });

  const segments: NarrationSegment[] = [];
  let cursor = 0;
  const scriptParts: string[] = [];

  for (const part of rawParts) {
    const globalCharStart = cursor;
    const globalCharEnd = cursor + part.text.length;
    cursor = globalCharEnd + 1;
    scriptParts.push(part.text);

    segments.push({
      cueIndex: part.cueIndex,
      text: part.text,
      wordOffsets: getWordOffsets(part.text),
      globalCharStart,
      globalCharEnd,
      charLength: part.text.length,
    });
  }

  const totalTextChars = Math.max(
    1,
    segments.length > 0 ? segments[segments.length - 1].globalCharEnd : 1
  );

  return {
    segments,
    totalTextChars,
    fullScriptText: scriptParts.join('. '),
  };
}

function getWordIndexInSegment(seg: NarrationSegment, localCharIndex: number): number {
  let wordIdx = 0;
  for (let i = 0; i < seg.wordOffsets.length; i++) {
    if (localCharIndex >= seg.wordOffsets[i]) {
      wordIdx = i;
    } else {
      break;
    }
  }
  return wordIdx;
}

/**
 * Generates Gemini TTS audio once on Admin approval/publish, uploads it to Cloudinary
 * (or server audio hosting fallback), caches the WAV Blob in IndexedDB, and returns
 * the permanent public `audioUrl` to save in Firebase RTDB `live_news/{district}/{newsId}/audioUrl`.
 */
export async function generateAndHostAdminReelAudio(params: {
  adminToken: string;
  newsId: string;
  district: string;
  language: LanguageCode;
  voiceName?: string;
  headline: string;
  subtitles: SubtitleCue[];
}): Promise<{
  ok: boolean;
  audioUrl?: string;
  storage?: 'cloudinary' | 'server';
  quotaExhausted?: boolean;
  error?: string;
}> {
  const voiceName = params.voiceName || 'Kore';
  const { fullScriptText } = buildNarrationSegments(
    params.headline,
    params.subtitles,
    params.language
  );
  const clean = fullScriptText.trim();
  if (!params.adminToken || !params.newsId || !clean) {
    return { ok: false, error: 'Missing admin token or script.' };
  }

  try {
    const res = await fetch('/api/admin/generate-and-host-audio', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.adminToken}`,
      },
      body: JSON.stringify({
        newsId: params.newsId,
        district: params.district,
        text: clean,
        language: params.language,
        voiceName,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      audioUrl?: string;
      storage?: 'cloudinary' | 'server';
      audioBase64?: string;
      mimeType?: string;
      quotaExhausted?: boolean;
      error?: string;
    };

    if (!res.ok || !data.audioUrl) {
      const isQuota =
        res.status === 429 || res.status === 403 || Boolean(data.quotaExhausted);
      return {
        ok: false,
        quotaExhausted: isQuota,
        error: data.error || `Audio hosting HTTP ${res.status}`,
      };
    }

    if (data.audioBase64) {
      const cacheKey = buildAudioCacheKey(params.newsId, params.language, voiceName);
      const blob = base64AudioToWavBlob(
        data.audioBase64,
        data.mimeType || 'audio/wav'
      );
      await saveGeminiAudioBlob({
        cacheKey,
        newsId: params.newsId,
        language: params.language,
        voiceName,
        textSnapshot: clean,
        blob,
        mimeType: blob.type || 'audio/wav',
      });
    }

    return {
      ok: true,
      audioUrl: data.audioUrl,
      storage: data.storage,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Admin audio hosting failed',
    };
  }
}

function isSafeAudioStreamUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('/api/hosted-audio/') ||
    trimmed.startsWith('/audio/') ||
    trimmed.startsWith('data:audio/')
  );
}

export function useSpeechNarration({
  enabled,
  isPlaying,
  language,
  reelId,
  audioUrl = '',
  headline,
  subtitles,
  nextReelId = '',
  nextAudioUrl = '',
  nextHeadline = '',
  nextSubtitles = [],
  seekTargetSec,
  seekVersion,
  rateMultiplier = 1.0,
  voiceConfig,
  onSyncCue,
  onCompleteReel,
}: SpeechNarrationOptions) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isBulletinComplete, setIsBulletinComplete] = useState(false);
  const [narrationProgress, setNarrationProgress] = useState(0);
  const [audioCurrentSec, setAudioCurrentSec] = useState(0);
  const [geminiDurationSec, setGeminiDurationSec] = useState<number | null>(null);
  const [ttsStatus, setTtsStatus] = useState<GeminiTtsStatus>('idle');
  const [isTestingCustom, setIsTestingCustom] = useState(false);
  const [studioError, setStudioError] = useState<string | null>(null);
  const [activeCueProgress, setActiveCueProgress] = useState<number>(0);

  // Persistent single HTML5 Audio element, Background Preloader & Memory Blob Cache Map
  const persistentAudioRef = useRef<HTMLAudioElement | null>(null);
  const prefetchAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef = useRef<Map<string, CachedGeminiAudio>>(new Map());
  const inflightFetchRef = useRef<
    Map<string, Promise<{ objectUrl: string | null; error?: string; quotaExhausted?: boolean }>>
  >(new Map());
  const quotaBlockedUntilRef = useRef<number>(0);

  const loadedSessionKeyRef = useRef<string | null>(null);
  const lastAppliedSeekVersionRef = useRef<number>(0);
  const sessionIdRef = useRef<number>(0);
  const customTestSessionRef = useRef<number>(0);

  const syncRafIdRef = useRef<number | null>(null);
  const completeDelayTimerRef = useRef<number | null>(null);
  const gestureCleanupRef = useRef<(() => void) | null>(null);

  const onSyncCueRef = useRef(onSyncCue);
  const onCompleteReelRef = useRef(onCompleteReel);
  const audioUrlRef = useRef(audioUrl);
  const nextAudioUrlRef = useRef(nextAudioUrl);
  const headlineRef = useRef(headline);
  const subtitlesRef = useRef(subtitles);
  const nextReelIdRef = useRef(nextReelId);
  const nextHeadlineRef = useRef(nextHeadline);
  const nextSubtitlesRef = useRef(nextSubtitles);
  const rateMultiplierRef = useRef(rateMultiplier);

  onSyncCueRef.current = onSyncCue;
  onCompleteReelRef.current = onCompleteReel;
  audioUrlRef.current = audioUrl;
  nextAudioUrlRef.current = nextAudioUrl;
  headlineRef.current = headline;
  subtitlesRef.current = subtitles;
  nextReelIdRef.current = nextReelId;
  nextHeadlineRef.current = nextHeadline;
  nextSubtitlesRef.current = nextSubtitles;
  rateMultiplierRef.current = rateMultiplier;

  const getPersistentAudio = useCallback((): HTMLAudioElement | null => {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
    if (!persistentAudioRef.current) {
      const el = new Audio();
      el.preload = 'auto';
      el.setAttribute('playsinline', 'true');
      persistentAudioRef.current = el;
    }
    return persistentAudioRef.current;
  }, []);

  const clearTimersAndListeners = useCallback(() => {
    if (syncRafIdRef.current !== null) {
      window.cancelAnimationFrame(syncRafIdRef.current);
      syncRafIdRef.current = null;
    }
    if (completeDelayTimerRef.current !== null) {
      window.clearTimeout(completeDelayTimerRef.current);
      completeDelayTimerRef.current = null;
    }
    if (gestureCleanupRef.current) {
      gestureCleanupRef.current();
      gestureCleanupRef.current = null;
    }
  }, []);

  const detachAudioEvents = (audio: HTMLAudioElement | null) => {
    if (!audio) return;
    audio.onloadedmetadata = null;
    audio.onplay = null;
    audio.onpause = null;
    audio.onended = null;
    audio.onerror = null;
  };

  const primeSpeech = useCallback(() => {
    const audio = getPersistentAudio();
    if (!audio) return;
    try {
      audio.load();
    } catch {
      // Ignore pre-load hints
    }
  }, [getPersistentAudio]);

  const stop = useCallback(() => {
    sessionIdRef.current += 1;
    clearTimersAndListeners();
    loadedSessionKeyRef.current = null;
    stopLocalSpeechFallback();

    const audio = persistentAudioRef.current;
    if (audio) {
      detachAudioEvents(audio);
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch {
        // Ignore seek errors before metadata
      }
      audio.removeAttribute('src');
    }

    setIsSpeaking(false);
    setIsBulletinComplete(false);
    setNarrationProgress(0);
    setAudioCurrentSec(0);
    setGeminiDurationSec(null);
    setTtsStatus('idle');
  }, [clearTimersAndListeners]);

  // Revoke cached ObjectURLs cleanly on unmount
  useEffect(() => {
    const cache = audioCacheRef.current;
    return () => {
      stop();
      cache.forEach((entry) => {
        if (entry.objectUrl.startsWith('blob:')) {
          URL.revokeObjectURL(entry.objectUrl);
        }
      });
      cache.clear();
    };
  }, [stop]);

  // Fetch Gemini TTS audio (`gemini-3.8-flash-lite-tts` via /api/tts) with in-memory + permanent IndexedDB cache
  const fetchGeminiReelAudio = useCallback(
    async (
      newsId: string,
      cacheKey: string,
      scriptText: string,
      targetLang: LanguageCode,
      voiceName: string
    ): Promise<{ objectUrl: string | null; error?: string; quotaExhausted?: boolean }> => {
      const clean = scriptText.trim();
      if (!clean) return { objectUrl: null, error: 'Empty news script.' };

      // 1. Hot in-memory ObjectURL cache
      const cached = audioCacheRef.current.get(cacheKey);
      if (cached && cached.textSnapshot === clean) {
        return { objectUrl: cached.objectUrl };
      }

      // 2. Permanent IndexedDB Blob cache (zero API calls across reloads & quota limits)
      const storedBlob = await getCachedGeminiAudioBlob(cacheKey, clean);
      if (storedBlob) {
        const objectUrl = URL.createObjectURL(storedBlob);
        if (audioCacheRef.current.size >= 30) {
          const oldestKey = audioCacheRef.current.keys().next().value;
          if (oldestKey) {
            const evicted = audioCacheRef.current.get(oldestKey);
            if (evicted && evicted.objectUrl.startsWith('blob:')) {
              URL.revokeObjectURL(evicted.objectUrl);
            }
            audioCacheRef.current.delete(oldestKey);
          }
        }
        audioCacheRef.current.set(cacheKey, {
          objectUrl,
          textSnapshot: clean,
        });
        return { objectUrl };
      }

      // 3. Respect quota cooldown only for uncached clips
      if (Date.now() < quotaBlockedUntilRef.current) {
        return {
          objectUrl: null,
          quotaExhausted: true,
          error: 'Free AI Voice Limit Reached Today — Reading Mode Active',
        };
      }

      const existing = inflightFetchRef.current.get(cacheKey);
      if (existing) return existing;

      const reqPromise = (async () => {
        try {
          const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: clean,
              language: targetLang,
              voiceName: voiceName || 'Kore',
            }),
          });
          const data = (await res.json().catch(() => ({}))) as {
            audioBase64?: string;
            mimeType?: string;
            error?: string;
            quotaExhausted?: boolean;
          };

          if (!res.ok || !data.audioBase64) {
            const isQuota =
              res.status === 429 ||
              res.status === 403 ||
              Boolean(data.quotaExhausted);
            if (isQuota) {
              quotaBlockedUntilRef.current = Date.now() + 5 * 60 * 1000;
            }
            return {
              objectUrl: null,
              quotaExhausted: isQuota,
              error:
                isQuota
                  ? 'Free AI Voice Limit Reached Today — Reading Mode Active'
                  : data.error || `Gemini TTS HTTP ${res.status}`,
            };
          }

          const blob = base64AudioToWavBlob(
            data.audioBase64,
            data.mimeType || 'audio/wav'
          );

          // Persist permanently in IndexedDB keyed by newsId + language + voiceName
          void saveGeminiAudioBlob({
            cacheKey,
            newsId,
            language: targetLang,
            voiceName: voiceName || 'Kore',
            textSnapshot: clean,
            blob,
            mimeType: blob.type || 'audio/wav',
          });

          const objectUrl = URL.createObjectURL(blob);

          // Evict oldest in-memory entry if over 30 and revoke stale blob URL
          if (audioCacheRef.current.size >= 30) {
            const oldestKey = audioCacheRef.current.keys().next().value;
            if (oldestKey) {
              const evicted = audioCacheRef.current.get(oldestKey);
              if (evicted && evicted.objectUrl.startsWith('blob:')) {
                URL.revokeObjectURL(evicted.objectUrl);
              }
              audioCacheRef.current.delete(oldestKey);
            }
          }

          audioCacheRef.current.set(cacheKey, {
            objectUrl,
            textSnapshot: clean,
          });

          return { objectUrl };
        } catch (err) {
          return {
            objectUrl: null,
            error: err instanceof Error ? err.message : 'Gemini TTS network error',
          };
        } finally {
          inflightFetchRef.current.delete(cacheKey);
        }
      })();

      inflightFetchRef.current.set(cacheKey, reqPromise);
      return reqPromise;
    },
    []
  );

  const stopCustomTest = useCallback(() => {
    customTestSessionRef.current += 1;
    stopLocalSpeechFallback();
    const audio = persistentAudioRef.current;
    if (audio && loadedSessionKeyRef.current === null) {
      detachAudioEvents(audio);
      audio.pause();
    }
    setIsTestingCustom(false);
  }, []);

  // Voice Studio & Admin 1-Tap Preview (uses /api/tts if available, gracefully falls back to local broadcast audio)
  const speakCustomText = useCallback(
    async (rawText: string) => {
      const clean = rawText.trim();
      if (!clean) return;

      stop();
      stopCustomTest();

      const testId = ++customTestSessionRef.current;
      const safeVoice = voiceConfig.geminiVoice || 'Kore';
      const cacheKey = `custom::${language}::${safeVoice}::${clean.slice(0, 80)}::${clean.length}`;

      setStudioError(null);
      setIsTestingCustom(true);

      const res = await fetchGeminiReelAudio('custom_preview', cacheKey, clean, language, safeVoice);
      if (customTestSessionRef.current !== testId) return;

      const audio = getPersistentAudio();
      if (!audio) {
        setIsTestingCustom(false);
        return;
      }

      detachAudioEvents(audio);

      if (res.objectUrl) {
        audio.src = res.objectUrl;
        audio.volume = 1;
      } else {
        // Zero-API local preview fallback so public viewers never see API key warnings
        const est = estimateNarrationDurationSec(clean).durationSec;
        const fallbackBlob = createNewsroomBroadcastWavBlob(Math.min(12, Math.max(5, est)));
        audio.src = URL.createObjectURL(fallbackBlob);
        const spokeLocal = startLocalSpeechFallback(clean, language, rateMultiplierRef.current);
        audio.volume = spokeLocal ? 0.16 : 0.6;
      }

      audio.playbackRate = Math.min(1.3, Math.max(0.85, rateMultiplierRef.current));

      audio.onended = () => {
        stopLocalSpeechFallback();
        if (customTestSessionRef.current === testId) {
          setIsTestingCustom(false);
        }
      };
      audio.onerror = () => {
        stopLocalSpeechFallback();
        if (customTestSessionRef.current === testId) {
          setIsTestingCustom(false);
        }
      };

      try {
        await audio.play();
      } catch {
        stopLocalSpeechFallback();
        if (customTestSessionRef.current === testId) {
          setStudioError('Tap again to start broadcast audio.');
          setIsTestingCustom(false);
        }
      }
    },
    [stop, stopCustomTest, voiceConfig.geminiVoice, language, fetchGeminiReelAudio, getPersistentAudio]
  );

  // Sync playbackRate live without re-fetching Gemini audio
  useEffect(() => {
    const audio = persistentAudioRef.current;
    if (audio) {
      audio.playbackRate = Math.min(1.3, Math.max(0.85, rateMultiplier));
    }
  }, [rateMultiplier]);

  // Main Zero-API Cloud-First Reel Narration Controller
  useEffect(() => {
    const voiceName = voiceConfig.geminiVoice || 'Kore';
    const hostedUrl = isSafeAudioStreamUrl(audioUrl) ? audioUrl.trim() : '';
    const targetKey = hostedUrl
      ? `${buildAudioCacheKey(reelId, language, voiceName)}::url::${hostedUrl.slice(0, 96)}`
      : buildAudioCacheKey(reelId, language, voiceName);

    // Handle disabled / modal open / tab switch
    if (!enabled) {
      if (loadedSessionKeyRef.current !== null) {
        stop();
      } else {
        stopLocalSpeechFallback();
        setTtsStatus('idle');
      }
      return;
    }

    // Fast path: Same reel + language + voice already loaded on persistent <audio>
    if (loadedSessionKeyRef.current === targetKey && persistentAudioRef.current?.src) {
      const audio = persistentAudioRef.current;

      // Apply scrubber/cue seek directly onto live <audio>
      if (
        seekVersion !== lastAppliedSeekVersionRef.current &&
        seekTargetSec !== null &&
        Number.isFinite(audio.duration) &&
        audio.duration > 0
      ) {
        lastAppliedSeekVersionRef.current = seekVersion;
        const clampedSec = Math.min(Math.max(0, seekTargetSec), Math.max(0, audio.duration - 0.1));
        audio.currentTime = clampedSec;
        setAudioCurrentSec(clampedSec);
        setIsBulletinComplete(false);
        const ratio = Math.min(0.998, Math.max(0, clampedSec / audio.duration));
        setNarrationProgress(ratio);
      }

      if (isPlaying) {
        if (audio.paused && !audio.ended) {
          void audio.play().catch(() => {});
        } else if (audio.ended && seekVersion !== lastAppliedSeekVersionRef.current) {
          lastAppliedSeekVersionRef.current = seekVersion;
          audio.currentTime = 0;
          setIsBulletinComplete(false);
          void audio.play().catch(() => {});
        }
      } else {
        if (!audio.paused) {
          audio.pause();
        }
        stopLocalSpeechFallback();
        setIsSpeaking(false);
      }
      return;
    }

    // Pause cleanly if inactive before initial load
    if (!isPlaying) {
      return;
    }

    // Start fresh playback session for this reel
    stop();
    const { segments, totalTextChars, fullScriptText } = buildNarrationSegments(
      headlineRef.current,
      subtitlesRef.current,
      language
    );

    if (!reelId || segments.length === 0 || !fullScriptText.trim()) {
      return;
    }

    const sessionId = ++sessionIdRef.current;
    loadedSessionKeyRef.current = targetKey;
    lastAppliedSeekVersionRef.current = seekVersion;
    setStudioError(null);
    setTtsStatus('generating');
    setIsBulletinComplete(false);
    setNarrationProgress(0);
    setAudioCurrentSec(0);
    setGeminiDurationSec(null);
    setActiveCueProgress(0);

    const mapProgressToSegment = (progress: number): { seg: NarrationSegment; wordIdx: number } => {
      const globalChar = progress * totalTextChars;
      let matched = segments[0];
      for (let i = 0; i < segments.length; i++) {
        if (globalChar <= segments[i].globalCharEnd || i === segments.length - 1) {
          matched = segments[i];
          break;
        }
      }
      const localChar = Math.max(0, globalChar - matched.globalCharStart);
      return {
        seg: matched,
        wordIdx: getWordIndexInSegment(matched, localChar),
      };
    };

    const startSyncLoop = (audio: HTMLAudioElement) => {
      if (syncRafIdRef.current !== null) {
        window.cancelAnimationFrame(syncRafIdRef.current);
      }
      let lastUiEmitAt = 0;

      const tick = (now: number) => {
        if (sessionIdRef.current !== sessionId) return;
        if (
          now - lastUiEmitAt >= 100 &&
          Number.isFinite(audio.duration) &&
          audio.duration > 0
        ) {
          lastUiEmitAt = now;
          const dur = audio.duration;
          const cur = Math.min(dur, Math.max(0, audio.currentTime));
          const progress = Math.min(0.998, Math.max(0, cur / dur));
          const { seg, wordIdx } = mapProgressToSegment(progress);

          setAudioCurrentSec(cur);
          setNarrationProgress(progress);
          setActiveCueProgress(Math.max(0, seg.cueIndex));
          onSyncCueRef.current?.(seg.cueIndex, wordIdx, progress, cur, dur);
        }
        syncRafIdRef.current = window.requestAnimationFrame(tick);
      };
      syncRafIdRef.current = window.requestAnimationFrame(tick);
    };

    const resolveZeroApiAudioSource = async (): Promise<{
      src: string;
      isFallbackSynth: boolean;
    }> => {
      const clean = fullScriptText.trim();

      // Priority 1: Cloud-hosted / Firebase `reel.audioUrl` (ZERO Gemini API calls)
      if (hostedUrl) {
        return { src: hostedUrl, isFallbackSynth: false };
      }

      // Priority 2: Hot in-memory Blob URL cache
      const baseCacheKey = buildAudioCacheKey(reelId, language, voiceName);
      const memCached = audioCacheRef.current.get(baseCacheKey);
      if (memCached && memCached.textSnapshot === clean) {
        return { src: memCached.objectUrl, isFallbackSynth: false };
      }

      // Priority 3: Permanent IndexedDB Blob cache
      const storedBlob = await getCachedGeminiAudioBlob(baseCacheKey, clean);
      if (storedBlob) {
        const objectUrl = URL.createObjectURL(storedBlob);
        audioCacheRef.current.set(baseCacheKey, {
          objectUrl,
          textSnapshot: clean,
        });
        return { src: objectUrl, isFallbackSynth: false };
      }

      // Priority 4: Zero-API synthesized broadcast audio fallback for starter/unhosted reels
      const estDuration = estimateNarrationDurationSec(clean).durationSec;
      const synthBlob = createNewsroomBroadcastWavBlob(estDuration);
      const synthUrl = URL.createObjectURL(synthBlob);
      audioCacheRef.current.set(`${baseCacheKey}::synth`, {
        objectUrl: synthUrl,
        textSnapshot: clean,
        durationSec: estDuration,
      });
      return { src: synthUrl, isFallbackSynth: true };
    };

    const loadAndPlayReelAudio = async () => {
      const resolved = await resolveZeroApiAudioSource();
      if (sessionIdRef.current !== sessionId) return;

      const audio = getPersistentAudio();
      if (!audio) return;

      let activeIsFallback = resolved.isFallbackSynth;
      let startedFallbackSpeech = false;

      const attachAndPlaySource = async (src: string, isFallback: boolean) => {
        activeIsFallback = isFallback;
        detachAudioEvents(audio);
        audio.src = src;
        audio.preload = 'auto';
        audio.setAttribute('playsinline', 'true');
        audio.volume = isFallback ? 0.58 : 1;
        audio.playbackRate = Math.min(1.3, Math.max(0.85, rateMultiplierRef.current));

        audio.onloadedmetadata = () => {
          if (sessionIdRef.current !== sessionId) return;
          if (Number.isFinite(audio.duration) && audio.duration > 0) {
            setGeminiDurationSec(audio.duration);
            const cached = audioCacheRef.current.get(targetKey);
            if (cached) cached.durationSec = audio.duration;
          }
        };

        audio.onplay = () => {
          if (sessionIdRef.current !== sessionId) return;
          if (gestureCleanupRef.current) {
            gestureCleanupRef.current();
            gestureCleanupRef.current = null;
          }
          if (activeIsFallback && !startedFallbackSpeech && audio.currentTime < 1.2) {
            const spoke = startLocalSpeechFallback(
              fullScriptText,
              language,
              rateMultiplierRef.current
            );
            startedFallbackSpeech = true;
            if (spoke) {
              audio.volume = 0.16;
            }
          }
          setIsSpeaking(true);
          setTtsStatus('playing');
          startSyncLoop(audio);

          // Preload next reel's hosted audioUrl (or IndexedDB cache) in the background
          const nxtAudio = nextAudioUrlRef.current;
          if (isSafeAudioStreamUrl(nxtAudio) && typeof Audio !== 'undefined') {
            if (!prefetchAudioRef.current) {
              prefetchAudioRef.current = new Audio();
              prefetchAudioRef.current.preload = 'auto';
            }
            if (prefetchAudioRef.current.src !== nxtAudio) {
              prefetchAudioRef.current.src = nxtAudio;
              prefetchAudioRef.current.load();
            }
          } else {
            const nxtId = nextReelIdRef.current;
            if (nxtId && nxtId !== reelId) {
              const nextBuilt = buildNarrationSegments(
                nextHeadlineRef.current,
                nextSubtitlesRef.current,
                language
              );
              const nextClean = nextBuilt.fullScriptText.trim();
              if (nextClean) {
                const nextKey = buildAudioCacheKey(nxtId, language, voiceName);
                if (!audioCacheRef.current.has(nextKey)) {
                  void getCachedGeminiAudioBlob(nextKey, nextClean).then((blob) => {
                    if (blob && !audioCacheRef.current.has(nextKey)) {
                      audioCacheRef.current.set(nextKey, {
                        objectUrl: URL.createObjectURL(blob),
                        textSnapshot: nextClean,
                      });
                    }
                  });
                }
              }
            }
          }
        };

        audio.onpause = () => {
          if (sessionIdRef.current !== sessionId) return;
          stopLocalSpeechFallback();
          if (!audio.ended) {
            setIsSpeaking(false);
            if (syncRafIdRef.current !== null) {
              window.cancelAnimationFrame(syncRafIdRef.current);
              syncRafIdRef.current = null;
            }
          }
        };

        audio.onended = () => {
          if (sessionIdRef.current !== sessionId) return;
          clearTimersAndListeners();
          stopLocalSpeechFallback();
          setIsSpeaking(false);
          setIsBulletinComplete(true);
          setNarrationProgress(1);
          setTtsStatus('idle');
          if (Number.isFinite(audio.duration) && audio.duration > 0) {
            setAudioCurrentSec(audio.duration);
          }
          completeDelayTimerRef.current = window.setTimeout(() => {
            if (sessionIdRef.current !== sessionId) return;
            onCompleteReelRef.current?.();
          }, 450);
        };

        audio.onerror = () => {
          if (sessionIdRef.current !== sessionId) return;
          // If hosted cloud URL fails temporarily, fall back cleanly to local broadcast WAV
          if (!activeIsFallback) {
            const estDuration = estimateNarrationDurationSec(fullScriptText).durationSec;
            const localUrl = URL.createObjectURL(createNewsroomBroadcastWavBlob(estDuration));
            void attachAndPlaySource(localUrl, true);
            return;
          }
          clearTimersAndListeners();
          stopLocalSpeechFallback();
          loadedSessionKeyRef.current = null;
          setIsSpeaking(false);
          setTtsStatus('idle');
        };

        try {
          await audio.play();
        } catch (playErr) {
          if (sessionIdRef.current !== sessionId) return;
          const isAutoplayBlocked =
            playErr instanceof DOMException && playErr.name === 'NotAllowedError';
          if (isAutoplayBlocked) {
            setTtsStatus('awaiting_gesture');
            setIsSpeaking(false);
            const onFirstGesture = () => {
              if (gestureCleanupRef.current) {
                gestureCleanupRef.current();
                gestureCleanupRef.current = null;
              }
              if (sessionIdRef.current !== sessionId) return;
              void audio.play().catch(() => {
                if (sessionIdRef.current !== sessionId) return;
                setTtsStatus('awaiting_gesture');
              });
            };
            window.addEventListener('pointerdown', onFirstGesture, { once: true });
            window.addEventListener('keydown', onFirstGesture, { once: true });
            gestureCleanupRef.current = () => {
              window.removeEventListener('pointerdown', onFirstGesture);
              window.removeEventListener('keydown', onFirstGesture);
            };
            return;
          }
          setTtsStatus('idle');
          setIsSpeaking(false);
        }
      };

      await attachAndPlaySource(resolved.src, resolved.isFallbackSynth);
    };

    void loadAndPlayReelAudio();
  }, [
    enabled,
    isPlaying,
    reelId,
    audioUrl,
    language,
    voiceConfig.geminiVoice,
    seekVersion,
    seekTargetSec,
    stop,
    clearTimersAndListeners,
    getPersistentAudio,
  ]);

  const activeVoiceName = `Gemini AI Anchor (${voiceConfig.geminiVoice || 'Kore'})`;

  return {
    isSpeaking,
    isAwaitingGesture: ttsStatus === 'awaiting_gesture',
    ttsStatus,
    isBulletinComplete,
    narrationProgress,
    audioCurrentSec,
    geminiDurationSec,
    isTestingCustom,
    activeVoiceName,
    studioError,
    activeChunkIdx: activeCueProgress,
    totalChunks: subtitles.length,
    primeSpeech,
    speakCustomText,
    stopCustomTest,
    stop,
  };
}
