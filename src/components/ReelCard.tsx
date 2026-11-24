import {
  Bookmark,
  CheckCircle2,
  Heart,
  MapPin,
  MessageCircle,
  Mic,
  Pause,
  Play,
  ShieldCheck,
  Video,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { MouseEvent, PointerEvent, memo, useEffect, useMemo, useRef, useState } from 'react';
import { LANGUAGES, UI_COPY, getReelTiming } from '../data/newsReels';
import {
  AudioSourceMode,
  DistrictId,
  GeminiTtsStatus,
  LanguageCode,
  NewsReel,
  ReelScopeFilter,
  VideoClipItem,
} from '../types';
import { AiAnchorPip } from './AiAnchorPip';
import { NewsStudioCanvas } from './NewsStudioCanvas';
import { cleanNewsText } from '../utils/liveRssNews';

interface ReelCardProps {
  reel: NewsReel;
  isActive: boolean;
  isPlaying: boolean;
  currentTimeSec: number;
  language: LanguageCode;
  audioEnabled: boolean;
  audioSourceMode: AudioSourceMode;
  isSpeaking: boolean;
  ttsStatus?: GeminiTtsStatus;
  geminiDurationSec?: number | null;
  narrationProgress?: number;
  isBulletinComplete?: boolean;
  spokenCueIndex?: number;
  spokenWordIndex?: number;
  currentSentence?: number;
  totalSentences?: number;
  isLiked: boolean;
  isBookmarked: boolean;
  preloadVideo?: boolean;
  selectedDistrict?: DistrictId;
  selectedScope?: ReelScopeFilter;
  filteredCount?: number;
  onTogglePlay: () => void;
  onSeek: (sec: number) => void;
  onToggleAudio: () => void;
  onSelectAudioSourceMode: (mode: AudioSourceMode) => void;
  onOpenVoiceSettings?: () => void;
  onGoLiveFromDistrict?: (district: DistrictId) => void;
  onToggleLike: (reelId: string) => void;
  onEnsureLike: (reelId: string) => void;
  onToggleBookmark: (reelId: string) => void;
  onOpenShare: (reel: NewsReel) => void;
  onOpenVerify: (reel: NewsReel) => void;
}

interface HeartBurst {
  id: number;
  x: number;
  y: number;
}

function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
}

export const ReelCard = memo(function ReelCard({
  reel,
  isActive,
  isPlaying,
  currentTimeSec,
  language,
  audioEnabled,
  audioSourceMode,
  isSpeaking,
  ttsStatus = 'idle',
  geminiDurationSec = null,
  narrationProgress = 0,
  isBulletinComplete = false,
  spokenCueIndex,
  spokenWordIndex,
  currentSentence = 1,
  totalSentences,
  isLiked,
  isBookmarked,
  preloadVideo = false,
  selectedDistrict,
  selectedScope = 'mix',
  filteredCount,
  onTogglePlay,
  onSeek,
  onToggleAudio,
  onSelectAudioSourceMode,
  onOpenVoiceSettings,
  onGoLiveFromDistrict,
  onToggleLike,
  onEnsureLike,
  onToggleBookmark,
  onOpenShare,
  onOpenVerify,
}: ReelCardProps) {
  const timing = useMemo(() => getReelTiming(reel, language), [reel, language]);
  const durationSec =
    isActive && geminiDurationSec && geminiDurationSec > 0
      ? geminiDurationSec
      : timing.durationSec;
  const dynamicCues = useMemo(() => {
    const scale = durationSec / Math.max(1, timing.durationSec);
    if (Math.abs(scale - 1) < 0.01) return timing.cues;
    return timing.cues.map((cue) => ({
      ...cue,
      startSec: Number((cue.startSec * scale).toFixed(2)),
      endSec: Number((cue.endSec * scale).toFixed(2)),
    }));
  }, [timing, durationSec]);
  const sanitizedCueItems = useMemo(
    () =>
      dynamicCues.map((cue) => {
        const cleanText = cleanNewsText(cue.text[language] || cue.text.hi || '');
        return {
          cleanText,
          words: cleanText.split(/\s+/).filter(Boolean),
        };
      }),
    [dynamicCues, language]
  );

  const clips: VideoClipItem[] = useMemo(() => {
    if (reel.videoClips && reel.videoClips.length > 0) return reel.videoClips;
    if (reel.videoUrl) return [{ url: reel.videoUrl, camTag: 'CAM 1 • GROUND REPORT' }];
    return [];
  }, [reel.videoClips, reel.videoUrl]);

  const [videoStage, setVideoStage] = useState<'local' | 'external' | 'canvas'>(() =>
    clips.length > 0 ? 'local' : reel.externalVideoUrl ? 'external' : 'canvas'
  );
  const [videoFrameReady, setVideoFrameReady] = useState(false);
  const [showCenterFeedback, setShowCenterFeedback] = useState(false);
  const [heartBursts, setHeartBursts] = useState<HeartBurst[]>([]);
  const [fadingOutSrc, setFadingOutSrc] = useState<string | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const subtitleBoxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);
  const singleTapTimerRef = useRef<number | null>(null);
  const stallTimeoutRef = useRef<number | null>(null);
  const prevClipIndexRef = useRef<number>(0);

  const copy = UI_COPY[language];
  const langShort = LANGUAGES.find((l) => l.code === language)?.shortCode || 'HI';

  useEffect(() => {
    setVideoStage(clips.length > 0 ? 'local' : reel.externalVideoUrl ? 'external' : 'canvas');
    setVideoFrameReady(false);
    prevClipIndexRef.current = 0;
    setFadingOutSrc(null);
  }, [reel.id, reel.externalVideoUrl, clips.length]);

  const isSpeechDriven =
    isActive &&
    audioEnabled &&
    audioSourceMode === 'ai' &&
    (isSpeaking || isBulletinComplete || narrationProgress > 0);

  const effectiveProgress = useMemo(() => {
    if (isBulletinComplete) return 1;
    if (isSpeechDriven) {
      return Math.min(1, Math.max(0, narrationProgress));
    }
    return Math.min(1, Math.max(0, currentTimeSec / Math.max(1, durationSec)));
  }, [isBulletinComplete, isSpeechDriven, narrationProgress, currentTimeSec, durationSec]);

  const effectiveElapsedSec = isSpeechDriven
    ? effectiveProgress * durationSec
    : currentTimeSec;

  const clipDurationSec = useMemo(
    () => Math.max(4, durationSec / Math.max(1, clips.length)),
    [durationSec, clips.length]
  );

  const activeClipIndex = useMemo(() => {
    if (clips.length <= 1) return 0;
    return Math.min(
      clips.length - 1,
      Math.max(0, Math.floor(effectiveElapsedSec / clipDurationSec))
    );
  }, [clips.length, effectiveElapsedSec, clipDurationSec]);

  const activeClip = clips[activeClipIndex];
  const activeCamTag =
    videoStage === 'canvas'
      ? 'STUDIO • LIVE GRAPHICS'
      : activeClip?.camTag || 'CAM 1 • LIVE VISUALS';

  const activeVideoSrc =
    videoStage === 'local'
      ? activeClip?.url || reel.videoUrl
      : videoStage === 'external'
      ? reel.externalVideoUrl
      : undefined;

  useEffect(() => {
    if (prevClipIndexRef.current !== activeClipIndex && clips.length > 1) {
      const prevUrl = clips[prevClipIndexRef.current]?.url;
      prevClipIndexRef.current = activeClipIndex;
      if (prevUrl && videoStage === 'local') {
        setFadingOutSrc(prevUrl);
        const t = window.setTimeout(() => setFadingOutSrc(null), 500);
        return () => window.clearTimeout(t);
      }
    }
  }, [activeClipIndex, clips, videoStage]);

  const isVideoAudioLive =
    isActive && isPlaying && audioEnabled && audioSourceMode === 'video';

  const isSpeakingHeadline =
    isActive &&
    audioEnabled &&
    audioSourceMode === 'ai' &&
    isSpeaking &&
    spokenCueIndex === -1;

  const activeCueIndex = useMemo(() => {
    if (
      isActive &&
      audioEnabled &&
      audioSourceMode === 'ai' &&
      isSpeaking &&
      typeof spokenCueIndex === 'number'
    ) {
      if (spokenCueIndex < 0) return 0;
      return Math.min(Math.max(0, dynamicCues.length - 1), Math.max(0, spokenCueIndex));
    }
    const idx = dynamicCues.findIndex(
      (cue) => effectiveElapsedSec >= cue.startSec && effectiveElapsedSec < cue.endSec
    );
    if (idx !== -1) return idx;
    return effectiveElapsedSec >= durationSec ? Math.max(0, dynamicCues.length - 1) : 0;
  }, [
    isActive,
    audioEnabled,
    audioSourceMode,
    isSpeaking,
    spokenCueIndex,
    dynamicCues,
    durationSec,
    effectiveElapsedSec,
  ]);

  useEffect(() => {
    setVideoFrameReady(false);
  }, [activeVideoSrc]);

  const clearStallWatchdog = () => {
    if (stallTimeoutRef.current !== null) {
      window.clearTimeout(stallTimeoutRef.current);
      stallTimeoutRef.current = null;
    }
  };

  // Synchronize HTML5 video playback, set attributes before play(), and attach 4-second stall watchdog
  useEffect(() => {
    const video = videoRef.current;
    clearStallWatchdog();
    if (!video || !activeVideoSrc) return;

    video.muted = !isVideoAudioLive;
    video.playsInline = true;
    video.loop = true;
    video.preload = 'auto';
    video.volume = 1;

    if (isActive && isPlaying) {
      if (video.readyState >= 2) {
        setVideoFrameReady(true);
      } else {
        stallTimeoutRef.current = window.setTimeout(() => {
          const el = videoRef.current;
          if (!el || el.readyState < 2) {
            if (videoStage === 'local' && reel.externalVideoUrl) {
              setVideoStage('external');
            } else {
              setVideoStage('canvas');
            }
          }
        }, 4000);
      }

      const p = video.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {});
      }
    } else {
      video.pause();
      if (!isActive && video.currentTime !== 0) {
        try {
          video.currentTime = 0;
        } catch {
          // Ignore reset errors before metadata loads
        }
      }
    }

    return clearStallWatchdog;
  }, [isActive, isPlaying, activeVideoSrc, isVideoAudioLive, videoStage, reel.externalVideoUrl]);

  // Ensure video decoder is paused & reset on unmount
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      clearStallWatchdog();
      if (video) {
        video.pause();
        try {
          video.currentTime = 0;
        } catch {
          // Ignore
        }
      }
    };
  }, [activeVideoSrc]);

  // Keep video seek aligned inside the current B-roll clip segment without stuttering on loop wrap
  useEffect(() => {
    const video = videoRef.current;
    if (
      !video ||
      !activeVideoSrc ||
      !video.duration ||
      Number.isNaN(video.duration) ||
      video.seeking ||
      video.readyState < 2
    ) {
      return;
    }
    const clipLocalSec =
      clips.length > 1
        ? Math.max(0, effectiveElapsedSec - activeClipIndex * clipDurationSec)
        : effectiveElapsedSec;
    const targetSec = clipLocalSec % video.duration;
    const rawDiff = Math.abs(video.currentTime - targetSec);
    const wrapDiff = Math.min(rawDiff, Math.max(0, video.duration - rawDiff));
    if (wrapDiff > 2.0) {
      video.currentTime = targetSec;
    }
  }, [effectiveElapsedSec, activeVideoSrc, clips.length, activeClipIndex, clipDurationSec]);

  // Auto-scroll karaoke subtitle track strictly within subtitle box (never disturbing snap-scroller)
  useEffect(() => {
    const container = subtitleBoxRef.current;
    if (!container) return;
    const activeEl = container.querySelector(`[data-cue-idx="${activeCueIndex}"]`) as HTMLElement | null;
    if (activeEl) {
      const targetTop = Math.max(
        0,
        activeEl.offsetTop - container.clientHeight / 2 + activeEl.clientHeight / 2
      );
      container.scrollTo({ top: targetTop, behavior: 'smooth' });
    }
  }, [activeCueIndex, language]);

  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) window.clearTimeout(singleTapTimerRef.current);
    };
  }, []);

  const handleVideoError = () => {
    clearStallWatchdog();
    setVideoFrameReady(false);
    if (videoStage === 'local' && reel.externalVideoUrl) {
      setVideoStage('external');
    } else {
      setVideoStage('canvas');
    }
  };

  const handleVideoStalled = () => {
    if (!isActive || !isPlaying || stallTimeoutRef.current !== null) return;
    stallTimeoutRef.current = window.setTimeout(() => {
      const el = videoRef.current;
      if (el && (el.readyState < 2 || el.paused)) {
        handleVideoError();
      }
    }, 4000);
  };

  const handleVideoReady = () => {
    clearStallWatchdog();
    setVideoFrameReady(true);
  };

  const handleSurfaceClick = (e: MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (now - lastTapRef.current < 260) {
      // Double-tap -> heart burst animation & like
      if (singleTapTimerRef.current) {
        window.clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      lastTapRef.current = 0;
      onEnsureLike(reel.id);
      const burstId = now;
      setHeartBursts((prev) => [...prev, { id: burstId, x, y }]);
      window.setTimeout(() => {
        setHeartBursts((prev) => prev.filter((b) => b.id !== burstId));
      }, 900);
    } else {
      // Single-tap -> play/pause after short double-tap disambiguation window
      lastTapRef.current = now;
      singleTapTimerRef.current = window.setTimeout(() => {
        onTogglePlay();
        setShowCenterFeedback(true);
        window.setTimeout(() => setShowCenterFeedback(false), 550);
      }, 220);
    }
  };

  const seekFromClientX = (clientX: number) => {
    const el = scrubberRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)));
    onSeek(Math.round(ratio * durationSec));
  };

  const handleScrubPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsScrubbing(true);
    seekFromClientX(e.clientX);
  };

  const handleScrubPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    e.stopPropagation();
    seekFromClientX(e.clientX);
  };

  const handleScrubPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    e.stopPropagation();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsScrubbing(false);
  };

  const progressPct = Math.min(100, Math.max(0, effectiveProgress * 100));
  const displayLikes = reel.likes + (isLiked ? 1 : 0);

  const sanitizedHeadline = useMemo(
    () => cleanNewsText(reel.headline[language] || reel.headline.hi || ''),
    [reel.headline, language]
  );
  const sanitizedCaption = useMemo(
    () => cleanNewsText(reel.caption[language] || reel.caption.hi || ''),
    [reel.caption, language]
  );
  const sanitizedTicker = useMemo(
    () => cleanNewsText(reel.ticker[language] || reel.ticker.hi || sanitizedHeadline),
    [reel.ticker, language, sanitizedHeadline]
  );

  return (
    <article
      className="reel-card select-none"
      style={{
        position: 'relative',
        width: '100%',
        flexShrink: 0,
        overflow: 'hidden',
        background: '#060913',
      }}
      aria-label={sanitizedHeadline}
    >
      {/* Layer z-0: Always-Active Animated Newsroom Studio Canvas (prevents blank/black screens) */}
      <div
        className="pointer-events-none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }}
      >
        <NewsStudioCanvas
          district={reel.district}
          category={reel.category}
          isPlaying={isActive && isPlaying}
        />
      </div>

      {/* Layer z-1: Guaranteed Visible Full-Screen Media Layer */}
      <div
        onClick={handleSurfaceClick}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }}
      >
        {activeVideoSrc && isActive && videoStage !== 'canvas' ? (
          <>
            {fadingOutSrc && (
              <video
                src={fadingOutSrc}
                autoPlay
                muted
                playsInline
                loop
                preload="auto"
                className="reel-video gpu-video opacity-50 transition-opacity duration-500 pointer-events-none"
              />
            )}
            <video
              key={`${reel.id}-${videoStage}-${activeVideoSrc}`}
              ref={videoRef}
              src={activeVideoSrc}
              autoPlay
              loop
              muted={!isVideoAudioLive}
              playsInline
              preload="auto"
              onLoadedData={handleVideoReady}
              onCanPlay={handleVideoReady}
              onPlaying={handleVideoReady}
              onStalled={handleVideoStalled}
              onError={handleVideoError}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              className="reel-video gpu-video"
            />
          </>
        ) : activeVideoSrc && videoStage !== 'canvas' ? (
          <>
            <img
              src={reel.imageUrl}
              alt={sanitizedHeadline}
              decoding="async"
              referrerPolicy="no-referrer"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              className="opacity-85"
            />
            {preloadVideo && videoStage === 'local' && clips[0]?.url && (
              <video
                src={clips[0].url}
                preload="metadata"
                muted
                playsInline
                loop
                className="hidden"
                aria-hidden="true"
              />
            )}
          </>
        ) : null}
      </div>

      {/* Layer z-5: High-Contrast Broadcast Scrim */}
      <div
        className="pointer-events-none"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 5,
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 25%, transparent 45%, rgba(0,0,0,0.96) 100%)',
        }}
      />

      {/* Double-Tap Heart Burst Overlays */}
      {heartBursts.map((burst) => (
        <div
          key={burst.id}
          style={{ left: burst.x, top: burst.y }}
          className="pointer-events-none absolute z-30 animate-heart-burst"
        >
          <Heart className="w-20 h-20 text-[#E63926] fill-[#E63926] drop-shadow-[0_6px_24px_rgba(230,57,38,0.65)]" />
        </div>
      ))}

      {/* Single-Tap Center Play/Pause Flash */}
      {showCenterFeedback && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-20">
          <div className="w-16 h-16 rounded-full bg-black/70 backdrop-blur-md border border-white/25 flex items-center justify-center text-white">
            {isPlaying ? <Play className="w-7 h-7 fill-white" /> : <Pause className="w-7 h-7 fill-white" />}
          </div>
        </div>
      )}

      {/* Top TV News HUD (z-10): Compact Status + CAM Scene Tag | Right PiP AI Anchor */}
      <div
        className="absolute top-0 inset-x-0 z-10 w-full max-w-full min-w-0 pt-[calc(max(10px,env(safe-area-inset-top))+118px)] lg:pt-3.5 px-3 flex items-start justify-between gap-2 pointer-events-none"
      >
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {reel.isLiveFeed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#B91C1C]/95 border border-red-400/70 text-white text-[10px] font-extrabold tracking-wider uppercase whitespace-nowrap shadow-[0_0_12px_rgba(230,57,38,0.7)]">
                <span className="w-1.5 h-1.5 rounded-full bg-red-300 animate-pulse" aria-hidden="true" />
                <span>LIVE</span>
              </span>
            )}
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase whitespace-nowrap ${
                reel.isBreaking
                  ? 'bg-[#E63926] text-white shadow'
                  : 'bg-black/70 text-white border border-white/20'
              }`}
            >
              {reel.isBreaking ? copy.breakingBadge : copy.localBadge}
            </span>
            {reel.isVerifiedReporter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600/95 border border-emerald-300/60 text-white text-[10px] font-extrabold tracking-wider uppercase whitespace-nowrap">
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span>VERIFIED</span>
              </span>
            )}
            {selectedDistrict && typeof filteredCount === 'number' && (
              <span className="px-2 py-0.5 rounded bg-black/65 border border-white/15 text-[10px] font-semibold text-zinc-200 whitespace-nowrap">
                {selectedScope === 'national'
                  ? `🇮🇳 ${filteredCount} National`
                  : selectedScope === 'international'
                  ? `🌍 ${filteredCount} World`
                  : selectedScope === 'mix'
                  ? `🔥 ${filteredCount} Mix`
                  : `📍 ${selectedDistrict} (${filteredCount})`}
              </span>
            )}
            {onGoLiveFromDistrict && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onGoLiveFromDistrict(reel.district);
                }}
                aria-label={`Go live from ${reel.district}`}
                className="pointer-events-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E63926]/90 hover:bg-[#E63926] border border-red-300/50 text-[10px] font-bold tracking-wide text-white shadow transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                <span>Go Live</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/70 border border-white/15 text-[10px] font-mono-tabular font-semibold tracking-wider text-zinc-100 uppercase">
              <Video className="w-3 h-3 text-[#E63926]" />
              <span>{videoFrameReady ? activeCamTag : 'STUDIO • LIVE FEED'}</span>
            </span>
            {clips.length > 1 && (
              <span className="text-[10px] font-mono-tabular text-zinc-200 bg-black/60 px-1.5 py-0.5 rounded border border-white/10">
                {activeClipIndex + 1}/{clips.length}
              </span>
            )}
            <span className="text-[10px] text-zinc-200/90 font-medium drop-shadow truncate max-w-[200px]">
              {reel.wardOrZone} · {reel.publishedAgo}
            </span>
          </div>
        </div>

        <AiAnchorPip
          isActive={isActive}
          isPlaying={isPlaying}
          audioEnabled={audioEnabled && audioSourceMode === 'ai'}
          isSpeaking={isSpeaking && audioSourceMode === 'ai'}
          ttsStatus={audioSourceMode === 'ai' ? ttsStatus : 'idle'}
          languageShort={langShort}
          currentSentence={currentSentence}
          totalSentences={totalSentences ?? reel.subtitles.length}
          onToggleAudio={onToggleAudio}
          onOpenVoiceSettings={onOpenVoiceSettings}
        />
      </div>

      {/* Layer z-10: Safe Bottom Written News Overlay (above bottom nav bar & clear of right action rail) */}
      <div
        className="absolute z-10 bottom-[calc(74px+env(safe-area-inset-bottom))] left-[12px] right-[58px] lg:bottom-3.5 lg:left-3.5 lg:right-[66px] flex flex-col gap-1.5 min-w-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Play/Pause & Video Controls Pill + Scrubber */}
        <div className="flex items-center gap-2 rounded-xl bg-black/78 backdrop-blur-md border border-white/18 px-2.5 py-1.5 shadow-lg">
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause reel' : 'Play reel'}
            className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-white" />}
          </button>

          <button
            type="button"
            onClick={onToggleAudio}
            aria-label={audioEnabled ? 'Mute audio' : 'Unmute audio'}
            className={`h-7 px-2 rounded-full border text-[10px] font-bold flex items-center gap-1 shrink-0 transition-colors cursor-pointer ${
              audioEnabled
                ? 'bg-[#F59E0B] border-[#F59E0B] text-black'
                : 'bg-white/12 border-white/20 text-white hover:bg-white/20'
            }`}
          >
            {audioEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
            <span>{audioEnabled ? 'On' : 'Mute'}</span>
          </button>

          <div
            ref={scrubberRef}
            role="slider"
            aria-label="Reel playback progress"
            aria-valuemin={0}
            aria-valuemax={durationSec}
            aria-valuenow={Math.floor(effectiveElapsedSec)}
            tabIndex={0}
            onPointerDown={handleScrubPointerDown}
            onPointerMove={handleScrubPointerMove}
            onPointerUp={handleScrubPointerUp}
            onPointerCancel={handleScrubPointerUp}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') onSeek(Math.min(durationSec, effectiveElapsedSec + 5));
              if (e.key === 'ArrowLeft') onSeek(Math.max(0, effectiveElapsedSec - 5));
            }}
            className="relative flex-1 h-5 flex items-center cursor-pointer touch-none min-w-[40px]"
          >
            <div className="w-full h-1.5 rounded-full bg-white/25 overflow-visible relative">
              <div
                className="h-full bg-[#E63926] rounded-full transition-[width] duration-75 ease-linear relative"
                style={{ width: `${progressPct}%` }}
              >
                <span className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white shadow ring-2 ring-[#E63926]" />
              </div>
            </div>
          </div>

          <span className="font-mono-tabular text-[10px] text-zinc-200 shrink-0">
            {formatClock(effectiveElapsedSec)}/{formatClock(durationSec)}
          </span>
        </div>

        {/* Scope & District Pill */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {reel.scope === 'national' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-500/95 border border-amber-300/80 text-black text-[10px] font-extrabold tracking-wider uppercase shadow">
              <span>🇮🇳 INDIA • NATIONAL</span>
            </span>
          ) : reel.scope === 'international' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-indigo-600/95 border border-indigo-300/70 text-white text-[10px] font-extrabold tracking-wider uppercase shadow">
              <span>🌍 WORLD • INTERNATIONAL</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-600/95 border border-emerald-300/70 text-white text-[10px] font-extrabold tracking-wider uppercase shadow">
              <MapPin className="w-3 h-3 shrink-0" />
              <span>📍 {reel.district.toUpperCase()} • LOCAL</span>
            </span>
          )}
          <span className="px-2 py-0.5 rounded bg-black/75 border border-white/15 text-[10px] font-bold uppercase tracking-wide text-amber-200">
            {reel.category}
          </span>
        </div>

        {/* Crisp Broadcast Headline */}
        <h2
          className={`font-display drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] transition-colors ${
            isSpeakingHeadline ? 'text-[#FDE68A]' : 'text-white'
          }`}
          style={{
            fontSize: '17px',
            fontWeight: 700,
            lineHeight: 1.35,
            color: isSpeakingHeadline ? '#FDE68A' : '#ffffff',
          }}
        >
          {sanitizedHeadline}
        </h2>

        {/* Scrollable / Clean News Body & Synced Subtitles Box */}
        <div
          style={{
            maxHeight: '115px',
            overflowY: 'auto',
            fontSize: '13.5px',
            lineHeight: 1.5,
            color: '#e2e8f0',
            background: 'rgba(15, 23, 42, 0.72)',
            backdropFilter: 'blur(6px)',
            padding: '8px 10px',
            borderRadius: '10px',
            borderLeft: '3px solid #38bdf8',
          }}
          className="newsroom-scroll space-y-1.5"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-sky-300/90 flex-wrap">
            <span>{copy.liveSubtitles}</span>
            <div className="flex items-center gap-1.5">
              <div
                className="inline-flex items-center rounded bg-white/10 border border-white/15 p-0.5"
                role="group"
                aria-label="Broadcast audio track"
              >
                <button
                  type="button"
                  onClick={() => onSelectAudioSourceMode('ai')}
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors ${
                    audioSourceMode === 'ai'
                      ? 'bg-[#F59E0B] text-black'
                      : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  <Mic className="w-2.5 h-2.5" />
                  <span>AI</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectAudioSourceMode('video')}
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors ${
                    audioSourceMode === 'video'
                      ? 'bg-[#E63926] text-white'
                      : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  <Video className="w-2.5 h-2.5" />
                  <span>Clip</span>
                </button>
              </div>
              <span className="font-mono-tabular text-zinc-300">
                {activeCueIndex + 1}/{dynamicCues.length}
              </span>
            </div>
          </div>

          {sanitizedCaption && sanitizedCaption !== sanitizedHeadline && (
            <p className="text-[12.5px] text-slate-200/90 leading-snug">
              {sanitizedCaption}
            </p>
          )}

          <div ref={subtitleBoxRef} className="space-y-1">
            {dynamicCues.map((cue, idx) => {
              const active = idx === activeCueIndex && !isSpeakingHeadline;
              const { cleanText: cleanCueText, words } = sanitizedCueItems[idx] || {
                cleanText: '',
                words: [],
              };
              const cueDuration = Math.max(1, cue.endSec - cue.startSec);
              const cueProgress = active
                ? Math.min(1, Math.max(0, (effectiveElapsedSec - cue.startSec) / cueDuration))
                : 0;
              const timeWordCount = active
                ? Math.max(1, Math.ceil(words.length * cueProgress))
                : 0;
              const highlightedCount =
                active && isActive && audioEnabled && isSpeaking && typeof spokenWordIndex === 'number'
                  ? Math.max(timeWordCount, spokenWordIndex + 1)
                  : timeWordCount;

              return (
                <button
                  key={cue.id}
                  type="button"
                  data-cue-idx={idx}
                  onClick={() => onSeek(cue.startSec)}
                  className={`block w-full text-left text-[13.5px] leading-[1.5] transition-opacity ${
                    active ? 'opacity-100 font-semibold' : 'text-slate-300/75 opacity-80 hover:opacity-100'
                  }`}
                >
                  {active ? (
                    <span>
                      {words.map((word, wIdx) => (
                        <span
                          key={wIdx}
                          className={
                            wIdx < highlightedCount ? 'text-[#FDE68A]' : 'text-slate-100'
                          }
                        >
                          {word}{' '}
                        </span>
                      ))}
                    </span>
                  ) : (
                    cleanCueText
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrolling Breaking News Ticker Strip */}
        <div className="w-full max-w-full min-w-0 overflow-hidden rounded-md bg-gradient-to-r from-[#B91C1C] via-[#DC2626] to-[#B45309] border border-white/15 py-0.5">
          <div className="animate-news-ticker text-[10.5px] font-bold tracking-wide text-white whitespace-nowrap">
            <span className="px-5">{sanitizedTicker}</span>
            <span className="px-5" aria-hidden="true">
              {sanitizedTicker}
            </span>
          </div>
        </div>

        {isActive && isBulletinComplete && (
          <div className="flex justify-center pt-0.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#16A34A] text-white text-[10px] font-bold tracking-wider uppercase shadow">
              <CheckCircle2 className="w-3 h-3" />
              <span>BULLETIN COMPLETE</span>
            </span>
          </div>
        )}
      </div>

      {/* Layer z-15: Right-Side Floating Action Rail (Non-overlapping gutter) */}
      <aside
        className="absolute right-2 z-15 bottom-[calc(74px+env(safe-area-inset-bottom))] lg:bottom-3.5 flex flex-col items-center gap-2.5 shrink-0"
        onClick={(e) => e.stopPropagation()}
        aria-label="Reel actions"
      >
        <button
          type="button"
          onClick={() => onToggleLike(reel.id)}
          aria-label={`Like story (${displayLikes})`}
          className="flex flex-col items-center gap-0.5 focus-visible:outline-none"
        >
          <span
            className={`w-10 h-10 rounded-full flex items-center justify-center border transition-transform active:scale-90 ${
              isLiked
                ? 'bg-[#E63926] border-[#E63926] text-white'
                : 'bg-black/75 border-white/15 text-white hover:bg-black/90'
            }`}
          >
            <Heart className={`w-4.5 h-4.5 ${isLiked ? 'fill-white' : ''}`} />
          </span>
          <span className="font-mono-tabular text-[10px] font-medium text-white drop-shadow">
            {displayLikes >= 1000 ? `${(displayLikes / 1000).toFixed(1)}k` : displayLikes}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onOpenShare(reel)}
          aria-label="Share on WhatsApp"
          className="flex flex-col items-center gap-0.5 focus-visible:outline-none"
        >
          <span className="w-10 h-10 rounded-full bg-[#16A34A]/92 hover:bg-[#16A34A] border border-emerald-400/40 text-white flex items-center justify-center transition-transform active:scale-90">
            <MessageCircle className="w-4.5 h-4.5" />
          </span>
          <span className="text-[9.5px] font-medium text-white drop-shadow">
            {copy.shareWhatsapp}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onToggleBookmark(reel.id)}
          aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark story'}
          className="flex flex-col items-center gap-0.5 focus-visible:outline-none"
        >
          <span
            className={`w-10 h-10 rounded-full flex items-center justify-center border transition-transform active:scale-90 ${
              isBookmarked
                ? 'bg-[#F59E0B] border-[#F59E0B] text-black'
                : 'bg-black/75 border-white/15 text-white hover:bg-black/90'
            }`}
          >
            <Bookmark className={`w-4.5 h-4.5 ${isBookmarked ? 'fill-black' : ''}`} />
          </span>
          <span className="text-[9.5px] font-medium text-white drop-shadow">
            {isBookmarked ? 'Saved' : 'Save'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onOpenVerify(reel)}
          aria-label={copy.verifySource}
          className="flex flex-col items-center gap-0.5 focus-visible:outline-none"
        >
          <span className="w-10 h-10 rounded-full bg-black/80 hover:bg-black/95 border border-[#F59E0B]/60 text-[#F59E0B] flex items-center justify-center transition-transform active:scale-90">
            <ShieldCheck className="w-4.5 h-4.5" />
          </span>
          <span className="text-[9.5px] font-semibold text-[#FDE68A] drop-shadow text-center leading-tight max-w-[48px]">
            {copy.verifySource}
          </span>
        </button>
      </aside>
    </article>
  );
});
