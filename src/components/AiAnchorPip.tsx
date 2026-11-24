import { Sparkles, Volume2, VolumeX } from 'lucide-react';
import { memo } from 'react';
import { GeminiTtsStatus } from '../types';

interface AiAnchorPipProps {
  isActive: boolean;
  isPlaying: boolean;
  audioEnabled: boolean;
  isSpeaking: boolean;
  ttsStatus?: GeminiTtsStatus;
  languageShort: string;
  currentSentence: number;
  totalSentences: number;
  onToggleAudio: () => void;
  onOpenVoiceSettings?: () => void;
}

const EQ_BARS = [
  { delay: '0ms', height: 'h-3' },
  { delay: '120ms', height: 'h-4' },
  { delay: '240ms', height: 'h-2.5' },
  { delay: '90ms', height: 'h-4' },
  { delay: '180ms', height: 'h-3' },
];

export const AiAnchorPip = memo(function AiAnchorPip({
  isActive,
  isPlaying,
  audioEnabled,
  isSpeaking,
  ttsStatus = 'idle',
  languageShort,
  onToggleAudio,
  onOpenVoiceSettings,
}: AiAnchorPipProps) {
  const pulseActive = isActive && isPlaying && audioEnabled && isSpeaking;
  const isGenerating = isActive && audioEnabled && ttsStatus === 'generating';
  const isQuotaLimit = isActive && audioEnabled && ttsStatus === 'quota_limit';
  const isError = isActive && audioEnabled && ttsStatus === 'error';
  const isAwaitingGesture = isActive && audioEnabled && ttsStatus === 'awaiting_gesture';

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onToggleAudio();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={
        isQuotaLimit
          ? 'Free AI Voice Limit Reached Today — Reading Mode Active'
          : audioEnabled
          ? 'Mute AI news anchor'
          : 'Unmute AI news anchor'
      }
      className="pointer-events-auto group relative w-[124px] h-[132px] sm:w-[132px] sm:h-[140px] rounded-2xl overflow-hidden bg-[#101420]/94 border border-white/25 shadow-2xl flex flex-col justify-between text-left transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]"
    >
      {/* Top Studio Header Strip */}
      <div className="relative z-10 px-2 pt-1.5 flex items-center justify-between">
        <span className="px-1.5 py-0.5 rounded bg-[#E63926] text-[8px] font-bold tracking-wider text-white uppercase">
          GEMINI AI
        </span>
        <span className="font-mono-tabular text-[9px] font-semibold text-amber-300">
          {languageShort}
        </span>
      </div>

      {/* Animated Broadcast AI Anchor Avatar */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        <div
          className={`absolute inset-0 transition-opacity duration-300 ${
            pulseActive || isGenerating ? 'opacity-100' : 'opacity-45'
          } bg-[radial-gradient(circle_at_50%_45%,rgba(230,57,38,0.28),rgba(15,23,42,0.9)_75%)]`}
        />

        <svg
          viewBox="0 0 80 80"
          className="w-16 h-16 relative z-10 translate-y-1"
          aria-hidden="true"
        >
          <path
            d="M14 78 C16 61 27 56 40 56 C53 56 64 61 66 78 Z"
            fill="#1E293B"
            stroke="#475569"
            strokeWidth="1.5"
          />
          <path d="M33 56 L40 67 L47 56 Z" fill="#F8FAFC" />
          <path d="M38.5 60 L41.5 60 L42 74 L40 77 L38 74 Z" fill="#E63926" />
          <rect x="35" y="48" width="10" height="10" rx="4" fill="#D99B72" />
          <ellipse cx="40" cy="34" rx="14" ry="16" fill="#E5AC82" />
          <path
            d="M25 32 C25 18 33 13 41 13 C50 13 55 19 55 31 C53 23 47 20 39 20 C32 20 27 24 25 32 Z"
            fill="#0F172A"
          />
          <path d="M25 33 C23 33 23 39 25 39" stroke="#38BDF8" strokeWidth="2" fill="none" />
          <path d="M25 38 Q30 44 37 43" stroke="#94A3B8" strokeWidth="1.3" fill="none" />
          <circle cx="37.5" cy="43" r="1.4" fill="#F59E0B" />
          <circle cx="34.5" cy="33" r="1.7" fill="#0F172A" />
          <circle cx="45.5" cy="33" r="1.7" fill="#0F172A" />
          <circle cx="35" cy="32.4" r="0.5" fill="#FFFFFF" />
          <circle cx="46" cy="32.4" r="0.5" fill="#FFFFFF" />
          <ellipse
            cx="40"
            cy="42"
            rx="3.4"
            ry={pulseActive ? '2.2' : '0.9'}
            fill="#7C2D12"
            className={pulseActive ? 'animate-anchor-mouth' : ''}
          />
        </svg>
      </div>

      {/* Live Gemini TTS Status Pill + Equalizer Waveform */}
      <div className="relative z-10 px-1.5 py-1.5 bg-black/84 border-t border-white/12 flex flex-col gap-1">
        <div
          className={`w-full px-1.5 py-0.5 rounded-md flex items-center justify-center gap-1 text-[8px] font-bold tracking-wide font-mono-tabular ${
            isQuotaLimit
              ? 'bg-amber-950/85 border border-amber-400/40 text-amber-100 whitespace-normal text-center leading-[1.2] py-1'
              : isError
              ? 'bg-red-950/90 border border-red-400/50 text-red-200 whitespace-nowrap'
              : isGenerating
              ? 'bg-amber-500/20 border border-amber-400/50 text-[#FDE68A] whitespace-nowrap'
              : audioEnabled
              ? 'bg-[#E63926]/25 border border-[#E63926]/55 text-[#FDE68A] whitespace-nowrap'
              : 'bg-white/10 border border-white/15 text-zinc-200 whitespace-nowrap'
          }`}
        >
          {isQuotaLimit ? (
            <span>⏳ Free AI Voice Limit Reached Today — Reading Mode Active</span>
          ) : isError ? (
            <span className="truncate">READING MODE ACTIVE</span>
          ) : isGenerating ? (
            <>
              <Sparkles className="w-2.5 h-2.5 text-[#F59E0B] shrink-0 animate-spin" />
              <span className="truncate">GENERATING VOICE</span>
            </>
          ) : isAwaitingGesture ? (
            <>
              <Volume2 className="w-2.5 h-2.5 text-[#F59E0B] shrink-0" />
              <span className="truncate">TAP TO START AI</span>
            </>
          ) : audioEnabled ? (
            <>
              <Volume2 className="w-2.5 h-2.5 text-[#F59E0B] shrink-0" />
              <span className="truncate">GEMINI AI ON AIR</span>
            </>
          ) : (
            <>
              <VolumeX className="w-2.5 h-2.5 text-zinc-300 shrink-0" />
              <span>TAP TO UNMUTE</span>
            </>
          )}
        </div>

        {!isQuotaLimit && (
          <div className="flex items-center justify-center gap-[3px] h-2.5" aria-hidden="true">
            {EQ_BARS.map((bar, i) => (
              <span
                key={i}
                style={{ animationDelay: bar.delay }}
                className={`w-[3px] rounded-full ${bar.height} ${
                  pulseActive ? 'bg-[#F59E0B] animate-eq-bar' : 'bg-zinc-600 scale-y-30'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </button>
  );
});
