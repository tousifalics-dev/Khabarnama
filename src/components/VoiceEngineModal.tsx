import { Check, Play, Radio, Sparkles, Square, Volume2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  GeminiTtsVoice,
  LanguageCode,
  VoiceEngineConfig,
} from '../types';

interface VoiceEngineModalProps {
  isOpen: boolean;
  language: LanguageCode;
  config: VoiceEngineConfig;
  studioError: string | null;
  speechRate: number;
  autoNext: boolean;
  isTestingCustom: boolean;
  defaultSampleText: string;
  onChangeConfig: (next: VoiceEngineConfig) => void;
  onChangeSpeechRate: (rate: number) => void;
  onToggleAutoNext: () => void;
  onSpeakCustomText: (text: string) => void;
  onStopCustomText: () => void;
  onEnableAndTest: () => void;
  onClose: () => void;
}

const GEMINI_VOICES: { id: GeminiTtsVoice; label: string; style: string }[] = [
  { id: 'Kore', label: 'Kore', style: 'Crisp Female Anchor' },
  { id: 'Puck', label: 'Puck', style: 'Energetic Male Anchor' },
  { id: 'Charon', label: 'Charon', style: 'Deep Prime-Time Anchor' },
  { id: 'Aoede', label: 'Aoede', style: 'Warm Regional Anchor' },
];

export function VoiceEngineModal({
  isOpen,
  language,
  config,
  studioError,
  speechRate,
  autoNext,
  isTestingCustom,
  defaultSampleText,
  onChangeConfig,
  onChangeSpeechRate,
  onToggleAutoNext,
  onSpeakCustomText,
  onStopCustomText,
  onEnableAndTest,
  onClose,
}: VoiceEngineModalProps) {
  const [customText, setCustomText] = useState(defaultSampleText);

  useEffect(() => {
    if (isOpen) {
      setCustomText(defaultSampleText);
    }
  }, [isOpen, language, defaultSampleText]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={() => {
        onStopCustomText();
        onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Gemini AI Voice Studio"
    >
      <div
        className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto bg-[#14161C] border border-white/12 rounded-t-3xl sm:rounded-3xl p-5 pb-7 sm:p-6 shadow-2xl newsroom-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1.5 bg-white/20 rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-[#E63926]/20 border border-[#E63926]/40 flex items-center justify-center text-[#E63926]">
              <Radio className="w-5 h-5" />
            </span>
            <div>
              <h2 className="font-display font-bold text-base sm:text-lg text-white">
                Gemini AI Voice Studio
              </h2>
              <p className="text-xs text-zinc-400">
                100% Google Gemini API Text-to-Speech narration &amp; anchor personas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onStopCustomText();
              onClose();
            }}
            aria-label="Close voice studio settings"
            className="min-w-[40px] min-h-[40px] rounded-full bg-white/8 hover:bg-white/15 text-zinc-300 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Pure Gemini AI Voice Studio Card */}
        <div className="rounded-2xl bg-black/40 border border-white/10 p-4 space-y-3.5 mb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium text-zinc-400">
                Exclusive Neural Broadcast Engine
              </p>
              <p className="text-xs sm:text-sm font-semibold text-white mt-0.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
                <span>Gemini 3.8 Flash Lite TTS</span>
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-300 shrink-0">
              <Check className="w-3.5 h-3.5" />
              <span>Continuous Cache</span>
            </span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Streams pre-generated broadcast narration in your selected Indian language with continuous background buffering and synchronized subtitles.
          </p>

          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">
              Gemini Anchor Voice
            </label>
            <div className="grid grid-cols-2 gap-2">
              {GEMINI_VOICES.map((voice) => (
                <button
                  key={voice.id}
                  type="button"
                  onClick={() => onChangeConfig({ geminiVoice: voice.id })}
                  className={`min-h-[54px] px-3 py-2 rounded-xl text-left border transition-colors ${
                    config.geminiVoice === voice.id
                      ? 'bg-[#E63926]/20 border-[#E63926] text-white'
                      : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                  }`}
                >
                  <p className="text-xs font-bold leading-tight">{voice.label}</p>
                  <p className="text-[11px] text-zinc-400 leading-tight mt-0.5">
                    {voice.style}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {studioError && (
          <p className="text-xs text-amber-300 bg-amber-950/50 border border-amber-500/30 rounded-xl p-2.5 mb-4">
            {studioError}
          </p>
        )}

        {/* Interactive Gemini TTS Reader */}
        <div className="rounded-2xl bg-black/45 border border-white/10 p-3.5 space-y-2.5 mb-4">
          <div className="flex items-center justify-between">
            <label htmlFor="tts-custom-input" className="text-xs font-semibold text-white">
              Test Gemini Anchor Voice
            </label>
            <button
              type="button"
              onClick={() => setCustomText(defaultSampleText)}
              className="text-[11px] font-medium text-[#F59E0B] hover:underline"
            >
              Load Headline
            </button>
          </div>
          <textarea
            id="tts-custom-input"
            rows={2}
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Type any news line in Hindi, Bhojpuri, English, Marathi, Bengali, or Tamil..."
            className="w-full rounded-xl bg-[#14161C] border border-white/12 px-3 py-2 text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#E63926] resize-none"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (isTestingCustom) {
                  onStopCustomText();
                } else {
                  onSpeakCustomText(customText);
                }
              }}
              disabled={!customText.trim() && !isTestingCustom}
              className={`flex-1 min-h-[40px] px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                isTestingCustom
                  ? 'bg-zinc-700 hover:bg-zinc-600 text-white'
                  : 'bg-[#F59E0B] hover:bg-amber-400 text-black'
              }`}
            >
              {isTestingCustom ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop Gemini Preview</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Preview Gemini Voice</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Auto-Next Reel Playback Switch */}
        <div className="mb-4 rounded-2xl bg-black/45 border border-white/10 px-3.5 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-white">Auto-Next Reel</p>
            <p className="text-[11px] text-zinc-400">
              Automatically scroll to the next news reel when Gemini audio ends
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoNext}
            onClick={onToggleAutoNext}
            className={`min-w-[62px] min-h-[36px] px-3 rounded-full text-xs font-bold transition-colors shrink-0 ${
              autoNext
                ? 'bg-[#16A34A] text-white'
                : 'bg-white/10 text-zinc-300 border border-white/15'
            }`}
          >
            {autoNext ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Playback Speed Multiplier */}
        <div className="mb-5">
          <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">
            Gemini Audio Speed
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[0.95, 1.0, 1.15].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onChangeSpeechRate(r)}
                className={`min-h-[40px] rounded-xl font-mono-tabular text-xs font-semibold border transition-colors ${
                  speechRate === r
                    ? 'bg-white text-black border-white'
                    : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                }`}
              >
                {r.toFixed(2)}x
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            onStopCustomText();
            onEnableAndTest();
            onClose();
          }}
          className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#E63926] hover:bg-[#D62E1C] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <Volume2 className="w-4 h-4" />
          <span>Activate Gemini Voice</span>
        </button>
      </div>
    </div>
  );
}
