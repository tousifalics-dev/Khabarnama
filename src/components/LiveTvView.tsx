import Hls from 'hls.js';
import {
  AlertTriangle,
  ExternalLink,
  Globe2,
  Loader2,
  Play,
  Radio,
  RefreshCw,
  Tv,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { inferLiveTvStreamType } from '../data/liveTvChannels';
import {
  AdNetworkConfig,
  DistrictId,
  LiveTvCategory,
  LiveTvChannel,
  LiveTvStreamType,
  LocalAd,
} from '../types';
import { SponsoredBanner } from './SponsoredBanner';

interface LiveTvViewProps {
  channels: LiveTvChannel[];
  selectedDistrict: DistrictId;
  localAds: LocalAd[];
  adNetworkConfig: AdNetworkConfig;
  onTrackAd: (ad: LocalAd, eventType: 'impression' | 'click') => void;
  onOpenDistrictPicker: () => void;
  onOpenReporterTvSubmit?: () => void;
}

const CATEGORY_TABS: Array<{
  id: LiveTvCategory;
  label: string;
  shortLabel: string;
}> = [
  { id: 'local', label: '📍 Local (Bihar)', shortLabel: '📍 Local' },
  { id: 'national', label: '🇮🇳 National', shortLabel: '🇮🇳 National' },
  { id: 'international', label: '🌍 International', shortLabel: '🌍 World' },
];

declare global {
  interface Window {
    Hls?: typeof Hls;
  }
}

export function LiveTvView({
  channels,
  selectedDistrict,
  localAds,
  adNetworkConfig,
  onTrackAd,
  onOpenDistrictPicker,
  onOpenReporterTvSubmit,
}: LiveTvViewProps) {
  const [activeCategory, setActiveCategory] = useState<LiveTvCategory>('local');
  const [selectedChannelId, setSelectedChannelId] = useState<string>(
    () => channels.find((c) => c.category === 'local')?.id || channels[0]?.id || ''
  );
  const [usingBackup, setUsingBackup] = useState(false);
  const [retrySeed, setRetrySeed] = useState(0);
  const [streamStatus, setStreamStatus] = useState<'loading' | 'playing' | 'error'>('loading');
  const [errorDetail, setErrorDetail] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsInstanceRef = useRef<Hls | null>(null);

  const localFilteredChannels = useMemo(() => {
    const allLocal = channels.filter((c) => c.category === 'local');
    if (selectedDistrict === 'All') return allLocal;
    const targetLower = String(selectedDistrict).toLowerCase();
    const districtSpecific = allLocal.filter(
      (c) => c.district && c.district !== 'ALL_BIHAR' && c.district.toLowerCase() === targetLower
    );
    const stateWide = allLocal.filter(
      (c) => !c.district || c.district === 'ALL_BIHAR'
    );
    return [...districtSpecific, ...stateWide];
  }, [channels, selectedDistrict]);

  const hasDedicatedDistrictChannel = useMemo(() => {
    if (selectedDistrict === 'All') return true;
    const targetLower = String(selectedDistrict).toLowerCase();
    return localFilteredChannels.some(
      (c) => c.district && c.district !== 'ALL_BIHAR' && c.district.toLowerCase() === targetLower
    );
  }, [localFilteredChannels, selectedDistrict]);

  const categoryCounts = useMemo(() => {
    const counts: Record<LiveTvCategory, number> = {
      local: localFilteredChannels.length,
      national: 0,
      international: 0,
    };
    for (const ch of channels) {
      if (ch.category !== 'local') {
        counts[ch.category] = (counts[ch.category] || 0) + 1;
      }
    }
    return counts;
  }, [channels, localFilteredChannels.length]);

  const visibleChannels = useMemo(
    () =>
      activeCategory === 'local'
        ? localFilteredChannels
        : channels.filter((c) => c.category === activeCategory),
    [channels, activeCategory, localFilteredChannels]
  );

  const activeChannel = useMemo(
    () =>
      visibleChannels.find((c) => c.id === selectedChannelId) ||
      visibleChannels[0] ||
      channels.find((c) => c.id === selectedChannelId) ||
      channels[0] ||
      null,
    [channels, selectedChannelId, visibleChannels]
  );

  const activeStreamSource = useMemo<{
    url: string;
    type: LiveTvStreamType;
    hasBackup: boolean;
  } | null>(() => {
    if (!activeChannel) return null;
    if (usingBackup && activeChannel.backupStreamUrl) {
      return {
        url: activeChannel.backupStreamUrl,
        type: inferLiveTvStreamType(activeChannel.backupStreamUrl, activeChannel.backupType),
        hasBackup: true,
      };
    }
    return {
      url: activeChannel.streamUrl,
      type: inferLiveTvStreamType(activeChannel.streamUrl, activeChannel.type),
      hasBackup: Boolean(activeChannel.backupStreamUrl),
    };
  }, [activeChannel, usingBackup]);

  // Reset backup state cleanly whenever switching channels
  useEffect(() => {
    setUsingBackup(false);
    setRetrySeed((s) => s + 1);
  }, [activeChannel?.id]);

  // 5-second stream load timeout watchdog
  useEffect(() => {
    if (!activeStreamSource || streamStatus !== 'loading') return;
    const timeoutId = window.setTimeout(() => {
      setStreamStatus((prev) => {
        if (prev === 'loading') {
          setErrorDetail('Stream took longer than 5 seconds to respond.');
          return 'error';
        }
        return prev;
      });
    }, 5000);
    return () => window.clearTimeout(timeoutId);
  }, [activeStreamSource, streamStatus, retrySeed]);

  // Dual-Engine playLiveChannel effect (HLS.js + Native HLS + YouTube Iframe)
  useEffect(() => {
    if (hlsInstanceRef.current) {
      hlsInstanceRef.current.destroy();
      hlsInstanceRef.current = null;
    }

    if (!activeChannel || !activeStreamSource) return;
    setStreamStatus('loading');
    setErrorDetail('');

    if (activeStreamSource.type !== 'hls') {
      return;
    }

    const videoEl = videoRef.current;
    if (!videoEl) return;

    const HlsEngine = window.Hls || Hls;
    let recoveredMediaOnce = false;
    let recoveredNetworkOnce = false;

    const markPlaying = () => {
      setStreamStatus('playing');
      setErrorDetail('');
    };

    const markFailed = (reason: string) => {
      setStreamStatus('error');
      setErrorDetail(reason);
    };

    const handleVideoCanPlay = () => {
      markPlaying();
      void videoEl.play().catch(() => {
        // Browsers allow playback via controls if autoplay with sound is blocked
      });
    };

    const handleVideoError = () => {
      markFailed('Broadcast video stream interrupted or blocked.');
    };

    videoEl.addEventListener('playing', markPlaying);
    videoEl.addEventListener('canplay', handleVideoCanPlay);
    videoEl.addEventListener('loadeddata', markPlaying);
    videoEl.addEventListener('error', handleVideoError);

    if (HlsEngine && HlsEngine.isSupported()) {
      const hls = new HlsEngine({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
      });
      hlsInstanceRef.current = hls;

      hls.on(HlsEngine.Events.MANIFEST_PARSED, () => {
        markPlaying();
        void videoEl.play().catch(() => {});
      });

      hls.on(HlsEngine.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        if (data.type === HlsEngine.ErrorTypes.NETWORK_ERROR && !recoveredNetworkOnce) {
          recoveredNetworkOnce = true;
          hls.startLoad();
          return;
        }
        if (data.type === HlsEngine.ErrorTypes.MEDIA_ERROR && !recoveredMediaOnce) {
          recoveredMediaOnce = true;
          hls.recoverMediaError();
          return;
        }
        hls.destroy();
        if (hlsInstanceRef.current === hls) {
          hlsInstanceRef.current = null;
        }
        markFailed('Unable to load live HLS broadcast feed.');
      });

      hls.loadSource(activeStreamSource.url);
      hls.attachMedia(videoEl);
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = activeStreamSource.url;
      videoEl.load();
    } else {
      markFailed('HLS playback is not supported in this browser.');
    }

    return () => {
      videoEl.removeEventListener('playing', markPlaying);
      videoEl.removeEventListener('canplay', handleVideoCanPlay);
      videoEl.removeEventListener('loadeddata', markPlaying);
      videoEl.removeEventListener('error', handleVideoError);
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
      videoEl.removeAttribute('src');
    };
  }, [activeChannel, activeStreamSource, retrySeed]);

  const handleSelectCategory = (cat: LiveTvCategory) => {
    setActiveCategory(cat);
    const firstInCat =
      cat === 'local'
        ? localFilteredChannels[0]
        : channels.find((c) => c.category === cat);
    if (firstInCat) {
      setSelectedChannelId(firstInCat.id);
    }
  };

  const handleSwitchToBackup = useCallback(() => {
    if (!activeChannel?.backupStreamUrl) return;
    setUsingBackup((prev) => !prev);
    setRetrySeed((s) => s + 1);
  }, [activeChannel?.backupStreamUrl]);

  const handleRetryStream = useCallback(() => {
    setRetrySeed((s) => s + 1);
  }, []);

  const activeDistrictLabel =
    selectedDistrict === 'All' ? 'Bihar State' : String(selectedDistrict);

  return (
    <div className="h-dvh max-h-dvh w-full max-w-full flex flex-col overflow-hidden bg-[#0A0B0E] pt-[calc(max(8px,env(safe-area-inset-top))+46px)] pb-[calc(3.6rem+env(safe-area-inset-bottom))] lg:pt-16 lg:pb-20">
      <div className="w-full max-w-6xl mx-auto flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[1.35fr_1fr] lg:gap-5 lg:px-6 lg:py-4 overflow-hidden">
        {/* Top Sticky 16:9 Dual-Engine Live Player Column */}
        <section className="shrink-0 lg:flex lg:flex-col lg:justify-start bg-[#0A0B0E] lg:bg-transparent border-b border-white/10 lg:border-b-0">
          <div className="w-full aspect-video bg-black lg:rounded-2xl overflow-hidden lg:border lg:border-white/15 shadow-2xl relative">
            {activeChannel && activeStreamSource ? (
              <>
                {activeStreamSource.type === 'hls' ? (
                  <video
                    key={`${activeChannel.id}-${activeStreamSource.url}-${retrySeed}`}
                    ref={videoRef}
                    controls
                    autoPlay
                    playsInline
                    className="w-full h-full object-contain bg-black"
                  />
                ) : (
                  <iframe
                    key={`${activeChannel.id}-${activeStreamSource.url}-${retrySeed}`}
                    src={activeStreamSource.url}
                    title={`${activeChannel.name} Live TV`}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                    onLoad={() => {
                      setStreamStatus('playing');
                      setErrorDetail('');
                    }}
                    onError={() => {
                      setStreamStatus('error');
                      setErrorDetail('YouTube embed could not be loaded in this viewport.');
                    }}
                  />
                )}

                {/* Connecting Indicator Overlay */}
                {streamStatus === 'loading' && (
                  <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 p-4 pointer-events-none">
                    <Loader2 className="w-7 h-7 text-[#F59E0B] animate-spin" />
                    <p className="text-xs font-semibold text-white">
                      Connecting to {activeChannel.name} (
                      {activeStreamSource.type === 'hls' ? 'HLS Stream' : 'Live Embed'})...
                    </p>
                  </div>
                )}

                {/* Sleek Error / Timeout Fallback Overlay */}
                {streamStatus === 'error' && (
                  <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3 p-4 text-center z-10">
                    <div className="w-10 h-10 rounded-xl bg-[#E63926]/20 border border-[#E63926]/50 text-[#E63926] flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="space-y-1 max-w-xs">
                      <p className="font-display font-bold text-sm text-white">
                        {activeChannel.name} stream paused or unavailable
                      </p>
                      <p className="text-[11px] text-zinc-400 leading-snug">
                        {errorDetail || 'Broadcast source timed out. Switch to backup or open the official stream.'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {activeChannel.backupStreamUrl && !usingBackup && (
                        <button
                          type="button"
                          onClick={handleSwitchToBackup}
                          className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#F59E0B] hover:bg-amber-400 text-black text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                          <span>Switch to Backup Stream</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleRetryStream}
                        className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white/12 hover:bg-white/20 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                        <span>Retry</span>
                      </button>
                      <a
                        href={activeChannel.watchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#E63926] hover:bg-[#D62E1C] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                      >
                        <span>Open Live ↗</span>
                      </a>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 gap-2 p-4 text-center">
                <Tv className="w-8 h-8 text-zinc-500" />
                <p className="text-xs">Select a live news channel below to begin streaming.</p>
              </div>
            )}
          </div>

          {/* Active Channel Broadcast Bar */}
          {activeChannel && activeStreamSource && (
            <div className="px-3.5 py-2.5 sm:px-4 bg-[#12141A] lg:rounded-2xl lg:mt-3 lg:border lg:border-white/10 flex items-center justify-between gap-2 min-w-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#E63926] text-white text-[10px] font-bold tracking-wide shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    <span>LIVE</span>
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono-tabular font-semibold text-amber-200 shrink-0">
                    {activeStreamSource.type === 'hls' ? 'HLS' : 'YT'}
                    {usingBackup ? ' · BACKUP' : ''}
                  </span>
                  <h1 className="font-display font-bold text-sm sm:text-base text-white truncate">
                    {activeChannel.name}
                  </h1>
                </div>
                <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                  {activeChannel.regionLabel} · {activeChannel.languageLabel}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {activeChannel.backupStreamUrl && (
                  <button
                    type="button"
                    onClick={handleSwitchToBackup}
                    className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-white/8 hover:bg-white/15 border border-white/12 text-[11px] font-semibold text-zinc-200 whitespace-nowrap transition-colors"
                  >
                    {usingBackup ? 'Primary' : 'Backup'}
                  </button>
                )}
                <a
                  href={activeChannel.watchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/16 border border-white/15 text-[11px] sm:text-xs font-semibold text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                >
                  <span>Open Live ↗</span>
                  <ExternalLink className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
                </a>
              </div>
            </div>
          )}
        </section>

        {/* Category Filter Tabs + Scrollable Channel List */}
        <section className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#0A0B0E] lg:rounded-2xl lg:bg-[#12141A] lg:border lg:border-white/10">
          {/* 3 Category Filter Buttons */}
          <div className="px-3 pt-2.5 pb-2 border-b border-white/10 shrink-0 space-y-2">
            <div
              role="tablist"
              aria-label="Live TV Categories"
              className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-black/55 border border-white/10"
            >
              {CATEGORY_TABS.map((tab) => {
                const isActive = activeCategory === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => handleSelectCategory(tab.id)}
                    className={`min-h-[40px] px-2 rounded-lg text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 whitespace-nowrap truncate transition-colors ${
                      isActive
                        ? 'bg-[#E63926] text-white shadow-sm'
                        : 'text-zinc-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="sm:hidden truncate">{tab.shortLabel}</span>
                    <span className="hidden sm:inline truncate">{tab.label}</span>
                    <span
                      className={`font-mono-tabular text-[10px] ${
                        isActive ? 'text-white/90' : 'text-zinc-500'
                      }`}
                    >
                      ({categoryCounts[tab.id]})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Dynamic Local District Banner */}
            {activeCategory === 'local' && (
              <div className="rounded-xl bg-[#1A1412] border border-[#F59E0B]/40 shadow-[0_0_16px_rgba(245,158,11,0.12)] px-3 py-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm shrink-0" aria-hidden="true">
                    📡
                  </span>
                  <p className="text-xs font-bold text-[#FDE68A] truncate">
                    {activeDistrictLabel} Local Cable &amp; Live Desk
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenDistrictPicker}
                  className="min-h-[32px] px-2.5 rounded-lg bg-white/10 hover:bg-white/16 text-[11px] font-semibold text-white whitespace-nowrap shrink-0 transition-colors"
                >
                  Change District
                </button>
              </div>
            )}
          </div>

          {/* Scrollable Channel Rows */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-2.5 space-y-2 newsroom-scroll">
            <SponsoredBanner
              localAds={localAds}
              adNetworkConfig={adNetworkConfig}
              selectedDistrict={selectedDistrict}
              placementLabel="TV Sponsor"
              onTrackAd={onTrackAd}
            />
            {activeCategory === 'local' &&
              selectedDistrict !== 'All' &&
              !hasDedicatedDistrictChannel && (
                <div className="rounded-xl bg-[#141720] border border-amber-500/30 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs font-bold text-white">
                      No Local Cable stream linked for {selectedDistrict} yet
                    </p>
                    <p className="text-[11px] text-zinc-400 leading-snug">
                      State-wide Bihar news channels are active below. Verified reporters can link a {selectedDistrict} cable or YouTube live stream.
                    </p>
                  </div>
                  {onOpenReporterTvSubmit && (
                    <button
                      type="button"
                      onClick={onOpenReporterTvSubmit}
                      className="min-h-[34px] px-3 py-1.5 rounded-lg bg-[#F59E0B] hover:bg-amber-400 text-black text-[11px] font-bold whitespace-nowrap shrink-0 transition-colors"
                    >
                      Submit {selectedDistrict} Cable / YT Link
                    </button>
                  )}
                </div>
              )}
            {visibleChannels.length === 0 ? (
              <div className="py-10 text-center text-xs text-zinc-400">
                No channels available in this category yet.
              </div>
            ) : (
              visibleChannels.map((ch) => {
                const isSelected = activeChannel?.id === ch.id;
                const chType = inferLiveTvStreamType(ch.streamUrl, ch.type);
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setSelectedChannelId(ch.id)}
                    className={`w-full min-h-[60px] px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between gap-3 transition-colors ${
                      isSelected
                        ? 'bg-[#E63926]/16 border-[#E63926] text-white'
                        : 'bg-[#14161C] hover:bg-white/[0.06] border-white/10 text-zinc-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-[#E63926] text-white'
                            : 'bg-white/8 text-zinc-300'
                        }`}
                      >
                        {ch.category === 'international' ? (
                          <Globe2 className="w-5 h-5" />
                        ) : isSelected ? (
                          <Radio className="w-5 h-5" />
                        ) : (
                          <Tv className="w-5 h-5" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-display font-bold text-sm text-white truncate">
                            {ch.name}
                          </span>
                          <span className="text-[9.5px] font-mono-tabular font-bold px-1.5 py-0.5 rounded bg-white/10 text-amber-200 shrink-0">
                            {chType === 'hls' ? 'HLS' : 'YT'}
                          </span>
                          {ch.isCustom && (
                            <span className="text-[10px] font-medium text-[#FDE68A] shrink-0">
                              · Custom
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                          {ch.regionLabel} · {ch.languageLabel}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 shrink-0 ${
                        isSelected
                          ? 'bg-[#E63926] text-white'
                          : 'bg-white/8 text-zinc-300'
                      }`}
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>{isSelected ? 'Playing' : 'Watch'}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
