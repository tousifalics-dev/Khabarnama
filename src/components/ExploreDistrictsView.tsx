import {
  CheckCircle2,
  Clock,
  Film,
  MapPin,
  Play,
  PlusSquare,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Video,
} from 'lucide-react';
import { useMemo } from 'react';
import { DISTRICTS, getReelTiming } from '../data/newsReels';
import {
  AdNetworkConfig,
  DistrictId,
  DistrictMeta,
  LanguageCode,
  LocalAd,
  NewsReel,
} from '../types';
import { SponsoredBanner } from './SponsoredBanner';

interface ExploreDistrictsViewProps {
  reels: NewsReel[];
  districts?: DistrictMeta[];
  language: LanguageCode;
  selectedDistrict: DistrictId;
  isLoadingDistrictNews?: boolean;
  localAds: LocalAd[];
  adNetworkConfig: AdNetworkConfig;
  onTrackAd: (ad: LocalAd, eventType: 'impression' | 'click') => void;
  onOpenDistrictPicker: () => void;
  onRefreshLiveNews: () => void;
  onStartLiveReport: (mode: 'record' | 'upload') => void;
  onJumpToReel: (reelId: string) => void;
}

function formatSec(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
}

export function ExploreDistrictsView({
  reels,
  districts = DISTRICTS,
  language,
  selectedDistrict,
  isLoadingDistrictNews = false,
  localAds,
  adNetworkConfig,
  onTrackAd,
  onOpenDistrictPicker,
  onRefreshLiveNews,
  onStartLiveReport,
  onJumpToReel,
}: ExploreDistrictsViewProps) {
  // Strictly filter news strictly to selectedDistrict & local scope — zero cross-district or national/world leakage
  const districtReels = useMemo(() => {
    const localOnly = reels.filter((r) => (r.scope || 'local') === 'local');
    if (selectedDistrict === 'All') return localOnly;
    const target = String(selectedDistrict).toLowerCase();
    return localOnly.filter((r) => r.district.toLowerCase() === target);
  }, [reels, selectedDistrict]);

  const activeDistrictMeta = useMemo(() => {
    if (selectedDistrict === 'All') return null;
    const target = String(selectedDistrict).toLowerCase();
    return districts.find((d) => d.id.toLowerCase() === target) || null;
  }, [districts, selectedDistrict]);

  const districtTitle =
    selectedDistrict === 'All' ? 'All Districts (सभी जिले)' : String(selectedDistrict);

  return (
    <div className="w-full max-w-full min-w-0 flex flex-col">
      {/* Sticky District Header inside Zila Tab */}
      <div className="sticky top-0 z-20 w-full max-w-full bg-[#0A0B0E]/95 backdrop-blur-md border-b border-white/10 px-3.5 sm:px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2.5 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="shrink-0" aria-hidden="true">
                📍
              </span>
              <h1 className="font-display font-bold text-sm sm:text-lg text-white truncate">
                {districtTitle} की ख़बरें (District News)
              </h1>
            </div>
            <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-zinc-400 mt-0.5">
              <span className="inline-flex items-center gap-1 text-emerald-300 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{districtReels.length} Strict Local {districtReels.length === 1 ? 'Story' : 'Stories'}</span>
              </span>
              {activeDistrictMeta && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    {activeDistrictMeta.state} · PIN {activeDistrictMeta.pinPrefix}
                  </span>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenDistrictPicker}
            className="min-h-[38px] px-3 py-1.5 rounded-full bg-[#E63926] hover:bg-[#D62E1C] text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 whitespace-nowrap shadow-md shadow-[#E63926]/25 transition-colors"
          >
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span>ज़िला बदलें (Change District)</span>
          </button>
        </div>
      </div>

      {/* Main Scrollable Content Strictly for Selected District */}
      <div className="max-w-5xl mx-auto w-full px-3.5 sm:px-6 pt-3.5 space-y-4">
        <SponsoredBanner
          localAds={localAds}
          adNetworkConfig={adNetworkConfig}
          selectedDistrict={selectedDistrict}
          placementLabel="Sponsored · Local Partner"
          onTrackAd={onTrackAd}
        />

        {/* Per-City & District Live Reporting Studio Card */}
        <section
          aria-label={`Live Reporting Desk for ${districtTitle}`}
          className="rounded-2xl bg-gradient-to-br from-[#1C1214] via-[#14161C] to-[#10131A] border border-[#E63926]/40 p-4 shadow-xl space-y-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#B91C1C]/90 border border-red-400/60 text-[10px] font-extrabold tracking-wider uppercase text-white">
                <span className="w-2 h-2 rounded-full bg-red-200 animate-ping" />
                <span>LIVE REPORTING • {districtTitle.toUpperCase()}</span>
              </div>
              <h2 className="font-display font-bold text-base sm:text-lg text-white mt-2">
                {selectedDistrict === 'All'
                  ? 'Live Citizen & Bureau Reporting Desk'
                  : `${districtTitle} Live Bureau & Field Desk`}
              </h2>
              <p className="text-xs text-zinc-300 mt-0.5 leading-relaxed">
                {activeDistrictMeta
                  ? `${activeDistrictMeta.summary[language]} · ${activeDistrictMeta.activeDesks} active field desks covering ${activeDistrictMeta.topBeat}.`
                  : 'Go live directly with your camera or publish a field bulletin. Stories appear immediately in this district feed with Gemini AI Voice narration.'}
              </p>
            </div>

            <button
              type="button"
              onClick={onRefreshLiveNews}
              disabled={isLoadingDistrictNews}
              aria-label="Fetch latest live news for this district"
              className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-white/8 hover:bg-white/14 border border-white/15 text-[11px] font-semibold text-zinc-100 flex items-center gap-1.5 shrink-0 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#F59E0B] ${isLoadingDistrictNews ? 'animate-spin' : ''}`} />
              <span>{isLoadingDistrictNews ? 'Fetching...' : 'Live Sync'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => onStartLiveReport('record')}
              className="min-h-[44px] px-3 py-2.5 rounded-xl bg-[#E63926] hover:bg-[#D62E1C] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#E63926]/25 transition-colors"
            >
              <Video className="w-4 h-4 shrink-0" />
              <span className="truncate">🔴 Go Live (Camera)</span>
            </button>

            <button
              type="button"
              onClick={() => onStartLiveReport('upload')}
              className="min-h-[44px] px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/16 border border-white/15 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <PlusSquare className="w-4 h-4 text-[#F59E0B] shrink-0" />
              <span className="truncate">File Live Report</span>
            </button>
          </div>
        </section>

        {/* Strict District-Only News List */}
        {isLoadingDistrictNews ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5" aria-busy="true">
            {[0, 1, 2].map((skeletonIdx) => (
              <div
                key={skeletonIdx}
                className="rounded-2xl bg-[#14161C] border border-white/10 overflow-hidden animate-pulse"
              >
                <div className="h-44 bg-white/8" />
                <div className="p-4 space-y-2.5">
                  <div className="h-4 w-24 rounded bg-white/10" />
                  <div className="h-5 w-full rounded bg-white/12" />
                  <div className="h-4 w-4/5 rounded bg-white/8" />
                </div>
              </div>
            ))}
          </div>
        ) : districtReels.length === 0 ? (
          <div className="rounded-2xl bg-[#14161C] border border-white/12 p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#E63926]/15 border border-[#E63926]/40 text-[#E63926] flex items-center justify-center mx-auto">
              <Radio className="w-6 h-6" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h2 className="font-display font-bold text-base sm:text-lg text-white">
                No reports in {districtTitle} yet
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                This Zila Tab strictly displays news only for {districtTitle}. Be the first live reporter in {districtTitle} or switch districts above.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => onStartLiveReport('record')}
                className="w-full sm:w-auto min-h-[42px] px-4 py-2 rounded-xl bg-[#E63926] hover:bg-[#D62E1C] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Video className="w-4 h-4 shrink-0" />
                <span>Go Live from {districtTitle}</span>
              </button>
              <button
                type="button"
                onClick={onOpenDistrictPicker}
                className="w-full sm:w-auto min-h-[42px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/16 border border-white/15 text-white text-xs sm:text-sm font-medium transition-colors"
              >
                ज़िला बदलें (Change District)
              </button>
            </div>
          </div>
        ) : (
          <section aria-label={`${districtTitle} News List`} className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Film className="w-4 h-4 text-[#E63926] shrink-0" />
                <h2 className="font-display font-bold text-sm sm:text-base text-white truncate">
                  {districtTitle} Local Bulletins ({districtReels.length})
                </h2>
              </div>
              <span className="text-[11px] text-zinc-400 shrink-0">
                Tap card to watch &amp; listen
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {districtReels.map((reel, idx) => {
                const durationSec = getReelTiming(reel, language).durationSec;
                return (
                  <button
                    key={reel.id}
                    type="button"
                    onClick={() => onJumpToReel(reel.id)}
                    className="group w-full text-left rounded-2xl overflow-hidden bg-[#14161C] border border-white/12 hover:border-[#E63926] transition-colors flex flex-col shadow-lg"
                  >
                    <div className="relative h-44 w-full overflow-hidden bg-black">
                      <img
                        src={reel.imageUrl}
                        alt={reel.headline[language]}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#14161C] via-black/30 to-transparent" />

                      {/* Top Badges */}
                      <div className="absolute top-2.5 left-2.5 right-12 flex items-center gap-1.5 flex-wrap">
                        {reel.isLiveFeed && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#B91C1C]/95 border border-red-400/60 text-white text-[10px] font-extrabold tracking-wider uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-200 animate-pulse" />
                            <span>LIVE • {reel.district}</span>
                          </span>
                        )}
                        {reel.isBreaking && (
                          <span className="px-2 py-0.5 rounded-md bg-[#E63926] text-white text-[10px] font-bold uppercase">
                            BREAKING
                          </span>
                        )}
                        {reel.isVerifiedReporter && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600/95 text-white text-[10px] font-bold uppercase">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>VERIFIED</span>
                          </span>
                        )}
                      </div>

                      {/* Play Button Overlay */}
                      <div className="absolute top-2.5 right-2.5 w-9 h-9 rounded-full bg-black/75 border border-white/25 text-white flex items-center justify-center group-hover:bg-[#E63926] transition-colors">
                        <Play className="w-4 h-4 fill-white ml-0.5" />
                      </div>

                      {/* Bottom Metadata Strip */}
                      <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between gap-2 text-[11px]">
                        <span className="px-2 py-0.5 rounded bg-black/75 border border-white/15 text-amber-200 font-semibold truncate">
                          #{idx + 1} · {reel.category}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/75 border border-white/15 text-zinc-100 font-mono-tabular shrink-0">
                          <Clock className="w-3 h-3 text-[#F59E0B]" />
                          <span>{formatSec(durationSec)}</span>
                        </span>
                      </div>
                    </div>

                    <div className="p-3.5 flex-1 flex flex-col justify-between gap-2.5">
                      <div className="space-y-1.5">
                        <h3 className="font-display font-bold text-sm sm:text-[15px] text-white leading-snug line-clamp-2 group-hover:text-[#FDE68A] transition-colors">
                          {reel.headline[language]}
                        </h3>
                        <p className="text-xs text-zinc-300 leading-relaxed line-clamp-2">
                          {reel.caption[language]}
                        </p>
                      </div>

                      <div className="pt-2.5 border-t border-white/8 flex items-center justify-between gap-2 text-[11px] text-zinc-400">
                        <span className="inline-flex items-center gap-1 min-w-0 truncate">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">
                            {reel.wardOrZone} · {reel.publishedAgo}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-[#FDE68A] font-semibold shrink-0">
                          <Sparkles className="w-3 h-3" />
                          <span>Watch Live</span>
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
