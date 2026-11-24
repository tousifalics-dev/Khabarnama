import { Bookmark, Heart, Play, Radio, Settings, Sparkles, User } from 'lucide-react';
import { LANGUAGES, getReelTiming } from '../data/newsReels';
import { LanguageCode, NewsReel } from '../types';

interface ProfileViewProps {
  reels: NewsReel[];
  likedIds: Set<string>;
  bookmarkedIds: Set<string>;
  language: LanguageCode;
  speechRate: number;
  voiceEngineLabel?: string;
  onChangeLanguage: (lang: LanguageCode) => void;
  onChangeSpeechRate: (rate: number) => void;
  onOpenVoiceSettings?: () => void;
  onJumpToReel: (reelId: string) => void;
}

export function ProfileView({
  reels,
  likedIds,
  bookmarkedIds,
  language,
  speechRate,
  voiceEngineLabel = 'Gemini AI Anchor (Kore)',
  onChangeLanguage,
  onChangeSpeechRate,
  onOpenVoiceSettings,
  onJumpToReel,
}: ProfileViewProps) {
  const savedReels = reels.filter((r) => bookmarkedIds.has(r.id));
  const citizenReels = reels.filter((r) => r.isCitizenSubmitted);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-20 pb-24 lg:pt-24 lg:pb-12 space-y-6">
      {/* Citizen Profile Header */}
      <div className="rounded-2xl bg-[#14161C] border border-white/10 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#E63926]/20 border border-[#E63926]/40 flex items-center justify-center text-[#E63926] shrink-0">
            <User className="w-7 h-7" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl text-white">Local Reader & Reporter</h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Khabar Nama Community Contributor · Multi-District Feed
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-white/10 text-center">
          <div>
            <div className="font-mono-tabular text-lg font-bold text-white">{bookmarkedIds.size}</div>
            <div className="text-[11px] text-zinc-400">Saved</div>
          </div>
          <div>
            <div className="font-mono-tabular text-lg font-bold text-white">{likedIds.size}</div>
            <div className="text-[11px] text-zinc-400">Liked</div>
          </div>
          <div>
            <div className="font-mono-tabular text-lg font-bold text-white">{citizenReels.length}</div>
            <div className="text-[11px] text-zinc-400">Reports</div>
          </div>
        </div>
      </div>

      {/* Voice & Language Preferences */}
      <div className="rounded-2xl bg-[#14161C] border border-white/10 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-bold text-base text-white">
              Broadcast & Voice Settings
            </h2>
            <p className="text-xs text-[#FDE68A] flex items-center gap-1.5 mt-0.5">
              <Sparkles className="w-3.5 h-3.5 text-[#E63926]" />
              <span>Active Engine: {voiceEngineLabel}</span>
            </p>
          </div>
          {onOpenVoiceSettings && (
            <button
              type="button"
              onClick={onOpenVoiceSettings}
              className="min-h-[38px] px-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors"
            >
              <Settings className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span>Voice Engine</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-2">Primary Broadcast Language</label>
            <div className="grid grid-cols-3 gap-2">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => onChangeLanguage(l.code)}
                  className={`min-h-[40px] px-2.5 py-2 rounded-xl text-xs font-medium border transition-colors ${
                    language === l.code
                      ? 'bg-[#E63926] border-[#E63926] text-white'
                      : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                  }`}
                >
                  {l.nativeLabel}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-2">Voice Narration Speed</label>
            <div className="flex items-center gap-2">
              {[0.9, 1.0, 1.2].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => onChangeSpeechRate(rate)}
                  className={`flex-1 min-h-[40px] px-3 py-2 rounded-xl font-mono-tabular text-xs font-semibold border transition-colors ${
                    speechRate === rate
                      ? 'bg-white text-black border-white'
                      : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                  }`}
                >
                  {rate.toFixed(1)}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Saved Reels */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-base text-white flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-[#F59E0B]" />
            <span>Bookmarked Dispatches ({savedReels.length})</span>
          </h2>
        </div>

        {savedReels.length === 0 ? (
          <div className="rounded-2xl bg-[#14161C] border border-white/10 p-6 text-center text-xs sm:text-sm text-zinc-400">
            Bookmark any news reel in the feed to keep it ready for offline reading and quick sharing.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {savedReels.map((reel) => (
              <button
                key={reel.id}
                type="button"
                onClick={() => onJumpToReel(reel.id)}
                className="text-left rounded-2xl bg-[#14161C] hover:bg-white/8 border border-white/10 p-3.5 flex items-center gap-3.5 transition-colors"
              >
                <div className="w-14 h-20 rounded-xl overflow-hidden bg-black shrink-0 relative">
                  <img
                    src={reel.imageUrl}
                    alt={reel.headline[language]}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute inset-0 bg-black/30 flex items-center justify-center text-white">
                    <Play className="w-4 h-4 fill-white" />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                    <span className="text-[#F59E0B] font-semibold">{reel.district}</span>
                    <span aria-hidden="true">·</span>
                    <span>{getReelTiming(reel, language).durationSec}s</span>
                  </div>
                  <p className="font-display font-semibold text-sm text-white line-clamp-2 mt-0.5">
                    {reel.headline[language]}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Citizen Reports Submitted */}
      {citizenReels.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display font-bold text-base text-white flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#E63926]" />
            <span>Your Citizen Reports ({citizenReels.length})</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {citizenReels.map((reel) => (
              <button
                key={reel.id}
                type="button"
                onClick={() => onJumpToReel(reel.id)}
                className="text-left rounded-2xl bg-[#14161C] hover:bg-white/8 border border-white/10 p-3.5 flex items-center gap-3.5 transition-colors"
              >
                <div className="w-14 h-20 rounded-xl overflow-hidden bg-black shrink-0 relative">
                  <img
                    src={reel.imageUrl}
                    alt={reel.headline[language]}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                    <span className="text-[#E63926] font-semibold">{reel.district}</span>
                    <span aria-hidden="true">·</span>
                    <span>{reel.wardOrZone}</span>
                  </div>
                  <p className="font-display font-semibold text-sm text-white line-clamp-2 mt-0.5">
                    {reel.headline[language]}
                  </p>
                  <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400 mt-1">
                    <Heart className="w-3 h-3" /> {reel.likes}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
