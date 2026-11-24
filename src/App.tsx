import {
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  Compass,
  Film,
  LocateFixed,
  MapPin,
  Mic,
  PlusSquare,
  ShieldCheck,
  Tv,
  User,
  Video,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BottomNav } from './components/BottomNav';
import {
  CATEGORY_FILTERS,
  CategoryFilterBar,
  matchesCategoryFilter,
} from './components/CategoryFilterBar';
import { ReelCard } from './components/ReelCard';
import { ScopeFilterBar } from './components/ScopeFilterBar';
import { pickLocalAdForDistrict } from './components/SponsoredBanner';
import { SponsoredReelCard } from './components/SponsoredReelCard';
import { TopBar } from './components/TopBar';
import { DEFAULT_LIVE_TV_CHANNELS } from './data/liveTvChannels';
import {
  DISTRICTS,
  INITIAL_NEWS_REELS,
  LANGUAGES,
  UI_COPY,
  buildCitizenReel,
  getReelTiming,
} from './data/newsReels';
import {
  pregenerateGeminiReelAudio,
  useSpeechNarration,
} from './hooks/useSpeechNarration';
import { detectCurrentIndianDistrict } from './utils/gpsLocation';
import {
  fetchAllScopesLiveNews,
  fetchLiveNewsForDistrict,
  getReelDedupeKey,
} from './utils/liveRssNews';
import {
  calculateReporterWallet,
  deriveDistrictCode3,
  deriveReporterName3,
  getEffectiveReporterRate,
  hasStoredSelectedDistrict,
  loadAdNetworkConfig,
  loadApprovedPortalReels,
  loadBreakingOverrides,
  loadDefaultNewsRate,
  loadDeletedReelIds,
  loadLiveCitizenReels,
  loadLiveTvChannels,
  loadLocalAds,
  loadPayoutRequests,
  loadPendingTvChannels,
  loadPortalReporters,
  loadPortalSession,
  loadPortalSubmissions,
  loadSelectedDistrict,
  saveAdNetworkConfig,
  saveApprovedPortalReels,
  saveBreakingOverrides,
  saveDefaultNewsRate,
  saveDeletedReelIds,
  saveLiveCitizenReels,
  saveLiveTvChannels,
  saveLocalAds,
  savePayoutRequests,
  savePendingTvChannels,
  savePortalReporters,
  savePortalSession,
  savePortalSubmissions,
  saveSelectedDistrict,
} from './utils/portalStorage';
import { studioAudioBed } from './utils/studioAudioBed';

const CitizenReporterModal = lazy(() =>
  import('./components/CitizenReporterModal').then((m) => ({ default: m.CitizenReporterModal }))
);
const ExploreDistrictsView = lazy(() =>
  import('./components/ExploreDistrictsView').then((m) => ({ default: m.ExploreDistrictsView }))
);
const LiveTvView = lazy(() =>
  import('./components/LiveTvView').then((m) => ({ default: m.LiveTvView }))
);
const PortalView = lazy(() =>
  import('./components/PortalView').then((m) => ({ default: m.PortalView }))
);
const ProfileView = lazy(() =>
  import('./components/ProfileView').then((m) => ({ default: m.ProfileView }))
);
const VerifySourceModal = lazy(() =>
  import('./components/VerifySourceModal').then((m) => ({ default: m.VerifySourceModal }))
);
const VoiceEngineModal = lazy(() =>
  import('./components/VoiceEngineModal').then((m) => ({ default: m.VoiceEngineModal }))
);
const WhatsAppShareSheet = lazy(() =>
  import('./components/WhatsAppShareSheet').then((m) => ({ default: m.WhatsAppShareSheet }))
);
import {
  AdFormat,
  AdNetworkConfig,
  AdminAuthStatus,
  AudioSourceMode,
  DistrictId,
  DistrictMeta,
  LanguageCode,
  LiveTvCategory,
  LiveTvChannel,
  LiveTvStreamType,
  LocalAd,
  NavTab,
  NewsCategoryFilter,
  NewsReel,
  NewsScope,
  PayoutRequest,
  PendingTvChannelSubmission,
  PortalSession,
  ReelScopeFilter,
  ReporterAccount,
  ReporterStatus,
  SubmittedStory,
  VoiceEngineConfig,
} from './types';

type FeedItem =
  | { kind: 'reel'; reel: NewsReel }
  | { kind: 'ad'; ad: LocalAd; key: string };

function formatShortClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
}

interface RemoteLiveNewsItemPayload {
  id: string;
  title: string;
  headline?: string;
  district: string;
  script: string;
  ward?: string;
  category?: NewsReel['category'];
  scope?: NewsScope;
  reporterName?: string;
  reporterId?: string;
  imageUrl?: string;
  videoUrl?: string;
  hasOriginalAudio?: boolean;
  isBreaking?: boolean;
}

function mapRemoteLiveNewsToReels(
  liveNews: RemoteLiveNewsItemPayload[],
  deletedIds: string[],
  overrides: Record<string, boolean>
): NewsReel[] {
  const deletedSet = new Set(deletedIds);
  return liveNews
    .filter((item) => !deletedSet.has(item.id))
    .map((item) => {
      const scriptLines = item.script
        .split(/\n+|(?<=[.।!?])\s+/)
        .map((l) => l.trim())
        .filter(Boolean);
      const reel = buildCitizenReel({
        district: item.district,
        ward: item.ward || 'District Headquarters',
        category: item.category || 'Breaking',
        scope: item.scope || 'local',
        hasOriginalAudio: Boolean(item.hasOriginalAudio && item.videoUrl),
        line1: item.headline || item.title,
        line2: scriptLines[0] || `Verified report from ${item.district}.`,
        line3: scriptLines[1] || `Filed by ${item.reporterName || 'District Reporter'}.`,
        script: item.script,
        imageUrl: item.imageUrl || '/src/assets/images/reel_muzaffarpur_bridge_1795283609462.jpg',
        videoUrl: item.videoUrl,
        reporterName: item.reporterName || 'Verified Reporter',
        reporterId: item.reporterId || 'REP-VERIFIED',
        isBreaking: Boolean(item.isBreaking),
        isLiveFeed: true,
        isVerifiedReporter: true,
      });
      return {
        ...reel,
        id: item.id,
        isBreaking: Object.prototype.hasOwnProperty.call(overrides, item.id)
          ? overrides[item.id]
          : Boolean(item.isBreaking),
      };
    });
}

export default function App() {
  const [districts, setDistricts] = useState<DistrictMeta[]>(DISTRICTS);
  const [portalReporters, setPortalReporters] = useState<ReporterAccount[]>(() =>
    loadPortalReporters()
  );
  const [portalSubmissions, setPortalSubmissions] = useState<SubmittedStory[]>(() =>
    loadPortalSubmissions()
  );
  const [portalSession, setPortalSession] = useState<PortalSession>(() =>
    loadPortalSession()
  );
  // Admin Bearer token is kept strictly in memory (never written to localStorage)
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminAuthStatus, setAdminAuthStatus] = useState<AdminAuthStatus | null>(null);
  const [approvedPortalReels, setApprovedPortalReels] = useState<NewsReel[]>(() =>
    loadApprovedPortalReels()
  );
  const [, setLiveCitizenReels] = useState<NewsReel[]>(() => loadLiveCitizenReels());
  const [deletedReelIds, setDeletedReelIds] = useState<string[]>(() =>
    loadDeletedReelIds()
  );
  const [breakingOverrides, setBreakingOverrides] = useState<Record<string, boolean>>(() =>
    loadBreakingOverrides()
  );
  const [customLiveTvChannels, setCustomLiveTvChannels] = useState<LiveTvChannel[]>(() =>
    loadLiveTvChannels()
  );
  const [pendingTvSubmissions, setPendingTvSubmissions] = useState<
    PendingTvChannelSubmission[]
  >(() => loadPendingTvChannels());
  const [localAds, setLocalAds] = useState<LocalAd[]>(() => loadLocalAds());
  const [adNetworkConfig, setAdNetworkConfig] = useState<AdNetworkConfig>(() =>
    loadAdNetworkConfig()
  );
  const [defaultNewsRate, setDefaultNewsRate] = useState<number>(() => loadDefaultNewsRate());
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>(() =>
    loadPayoutRequests()
  );
  const liveTvChannels = useMemo(() => {
    const seen = new Set<string>();
    const combined: LiveTvChannel[] = [];
    for (const ch of [...customLiveTvChannels, ...DEFAULT_LIVE_TV_CHANNELS]) {
      if (!seen.has(ch.id)) {
        seen.add(ch.id);
        combined.push(ch);
      }
    }
    return combined;
  }, [customLiveTvChannels]);

  const [reels, setReels] = useState<NewsReel[]>(() => {
    const liveCitizen = loadLiveCitizenReels();
    const approved = loadApprovedPortalReels();
    const deletedSet = new Set(loadDeletedReelIds());
    const overrides = loadBreakingOverrides();
    const seenIds = new Set<string>();
    const combined: NewsReel[] = [];
    for (const r of [...liveCitizen, ...approved, ...INITIAL_NEWS_REELS]) {
      if (!deletedSet.has(r.id) && !seenIds.has(r.id)) {
        seenIds.add(r.id);
        combined.push(r);
      }
    }
    return combined.map((r) =>
      Object.prototype.hasOwnProperty.call(overrides, r.id)
        ? { ...r, isBreaking: overrides[r.id] }
        : r
    );
  });
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictId>(() =>
    loadSelectedDistrict()
  );
  const [selectedScope, setSelectedScope] = useState<ReelScopeFilter>('mix');
  const [selectedCategory, setSelectedCategory] = useState<NewsCategoryFilter>('All');
  const [isDistrictPickerOpen, setIsDistrictPickerOpen] = useState(false);
  const [language, setLanguage] = useState<LanguageCode>('hi');
  const [activeTab, setActiveTab] = useState<NavTab>('feed');

  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [isLoadingDistrictNews, setIsLoadingDistrictNews] = useState(false);
  const [loadingDistrictLabel, setLoadingDistrictLabel] = useState('');
  const [gpsToast, setGpsToast] = useState<{
    message: string;
    tone: 'info' | 'success' | 'warn';
  } | null>(null);
  const [gpsDetectedNewDistrict, setGpsDetectedNewDistrict] = useState<{
    id: string;
    state: string;
  } | null>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioSourceMode, setAudioSourceMode] = useState<AudioSourceMode>('ai');
  const [autoNext, setAutoNext] = useState(true);
  const [speechRate, setSpeechRate] = useState(1.0);

  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set());
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(() => new Set(['reel-mzp-01']));

  const [verifyModalReel, setVerifyModalReel] = useState<NewsReel | null>(null);
  const [shareModalReel, setShareModalReel] = useState<NewsReel | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportInitialTab, setReportInitialTab] = useState<'upload' | 'url' | 'record'>('upload');
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  const [voiceConfig, setVoiceConfig] = useState<VoiceEngineConfig>({
    geminiVoice: 'Kore',
  });

  const [spokenCueIndex, setSpokenCueIndex] = useState<number>(-1);
  const [spokenWordIndex, setSpokenWordIndex] = useState<number>(0);
  const [seekTargetSec, setSeekTargetSec] = useState<number | null>(null);
  const [seekVersion, setSeekVersion] = useState<number>(0);
  const [timerBulletinComplete, setTimerBulletinComplete] = useState<boolean>(false);

  const feedContainerRef = useRef<HTMLDivElement>(null);
  const bulletinTimeoutRef = useRef<number | null>(null);
  const gpsToastTimerRef = useRef<number | null>(null);
  const gpsDetectingRef = useRef(false);
  const districtFetchSeqRef = useRef(0);
  const [appendedLiveIds, setAppendedLiveIds] = useState<Set<string>>(() => new Set());
  const [newlyLoadedBanner, setNewlyLoadedBanner] = useState<{
    count: number;
    targetReelId: string;
  } | null>(null);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const autoSyncInFlightRef = useRef(false);
  const lastAutoSyncAtRef = useRef<number>(Date.now());

  const { localScopedReels, nationalScopedReels, internationalScopedReels } = useMemo(() => {
    const localList: NewsReel[] = [];
    const nationalList: NewsReel[] = [];
    const internationalList: NewsReel[] = [];
    const targetLower =
      selectedDistrict === 'All' ? null : String(selectedDistrict).toLowerCase();

    for (const r of reels) {
      const scope = r.scope || 'local';
      if (scope === 'national') {
        nationalList.push(r);
      } else if (scope === 'international') {
        internationalList.push(r);
      } else if (!targetLower || r.district.toLowerCase() === targetLower) {
        localList.push(r);
      }
    }
    return {
      localScopedReels: localList,
      nationalScopedReels: nationalList,
      internationalScopedReels: internationalList,
    };
  }, [reels, selectedDistrict]);

  const scopeCounts = useMemo<Record<ReelScopeFilter, number>>(
    () => ({
      mix:
        localScopedReels.length +
        nationalScopedReels.length +
        internationalScopedReels.length,
      local: localScopedReels.length,
      national: nationalScopedReels.length,
      international: internationalScopedReels.length,
    }),
    [localScopedReels.length, nationalScopedReels.length, internationalScopedReels.length]
  );

  const scopedReels = useMemo(() => {
    if (selectedScope === 'local') return localScopedReels;
    if (selectedScope === 'national') return nationalScopedReels;
    if (selectedScope === 'international') return internationalScopedReels;

    // 1-1-1 round-robin interleaving for 🔥 Mix:
    // Keep base reels stable at the top and interleave newly appended live stories below them
    // so live background updates NEVER shift or interrupt the currently playing reel.
    const interleave = (lList: NewsReel[], nList: NewsReel[], iList: NewsReel[], seen: Set<string>) => {
      const out: NewsReel[] = [];
      const maxLen = Math.max(lList.length, nList.length, iList.length);
      for (let i = 0; i < maxLen; i += 1) {
        for (const c of [lList[i], nList[i], iList[i]]) {
          if (c && !seen.has(c.id)) {
            seen.add(c.id);
            out.push(c);
          }
        }
      }
      return out;
    };

    const seen = new Set<string>();
    const baseMixed = interleave(
      localScopedReels.filter((r) => !appendedLiveIds.has(r.id)),
      nationalScopedReels.filter((r) => !appendedLiveIds.has(r.id)),
      internationalScopedReels.filter((r) => !appendedLiveIds.has(r.id)),
      seen
    );
    if (appendedLiveIds.size === 0) return baseMixed;

    const appendedMixed = interleave(
      localScopedReels.filter((r) => appendedLiveIds.has(r.id)),
      nationalScopedReels.filter((r) => appendedLiveIds.has(r.id)),
      internationalScopedReels.filter((r) => appendedLiveIds.has(r.id)),
      seen
    );
    return [...baseMixed, ...appendedMixed];
  }, [selectedScope, localScopedReels, nationalScopedReels, internationalScopedReels, appendedLiveIds]);

  const categoryCounts = useMemo(() => {
    const counts = {} as Record<NewsCategoryFilter, number>;
    for (const cat of CATEGORY_FILTERS) {
      counts[cat.id] =
        cat.id === 'All'
          ? scopedReels.length
          : scopedReels.filter((r) => matchesCategoryFilter(r, cat.id)).length;
    }
    return counts;
  }, [scopedReels]);

  const filteredReels = useMemo(() => {
    if (selectedCategory === 'All') return scopedReels;
    return scopedReels.filter((r) => matchesCategoryFilter(r, selectedCategory));
  }, [scopedReels, selectedCategory]);

  const activeReelAd = useMemo(
    () => pickLocalAdForDistrict(localAds, 'reel', selectedDistrict),
    [localAds, selectedDistrict]
  );

  const feedItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];
    filteredReels.forEach((reel, idx) => {
      items.push({ kind: 'reel', reel });
      if (activeReelAd && (idx + 1) % 4 === 0) {
        items.push({
          kind: 'ad',
          ad: activeReelAd,
          key: `${activeReelAd.id}-slot-${idx}`,
        });
      }
    });
    return items;
  }, [filteredReels, activeReelAd]);

  const safeIndex = Math.min(activeIndex, Math.max(0, feedItems.length - 1));
  const activeFeedItem = feedItems[safeIndex];
  const activeReel = activeFeedItem?.kind === 'reel' ? activeFeedItem.reel : undefined;
  const nextReel = useMemo(() => {
    if (feedItems.length <= 1) return undefined;
    for (let offset = 1; offset < feedItems.length; offset += 1) {
      const candidate = feedItems[(safeIndex + offset) % feedItems.length];
      if (candidate.kind === 'reel') return candidate.reel;
    }
    return undefined;
  }, [feedItems, safeIndex]);
  const copy = UI_COPY[language];
  const activeLangMeta = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  const activeTiming = useMemo(
    () => (activeReel ? getReelTiming(activeReel, language) : null),
    [activeReel, language]
  );

  const clearBulletinTimeout = useCallback(() => {
    if (bulletinTimeoutRef.current !== null) {
      window.clearTimeout(bulletinTimeoutRef.current);
      bulletinTimeoutRef.current = null;
    }
  }, []);

  const handleSyncCue = useCallback(
    (
      cueIdx: number,
      cueWordIdx: number,
      _progress: number,
      audioCurSec: number
    ) => {
      setSpokenCueIndex(cueIdx);
      setSpokenWordIndex(cueWordIdx);
      setCurrentTimeSec(Number(audioCurSec.toFixed(2)));
    },
    []
  );

  const scrollToReelIndex = useCallback(
    (index: number) => {
      clearBulletinTimeout();
      const container = feedContainerRef.current;
      if (!container) return;
      const clamped = Math.max(0, Math.min(feedItems.length - 1, index));
      const target = container.children[clamped] as HTMLElement | undefined;
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setActiveIndex(clamped);
      setCurrentTimeSec(0);
      setSpokenCueIndex(-1);
      setSpokenWordIndex(0);
      setSeekTargetSec(null);
      setTimerBulletinComplete(false);
      setIsPlaying(true);
    },
    [feedItems.length, clearBulletinTimeout]
  );

  const handleSelectCategory = useCallback(
    (category: NewsCategoryFilter) => {
      clearBulletinTimeout();
      setAppendedLiveIds((prev) => (prev.size > 0 ? new Set() : prev));
      setNewlyLoadedBanner(null);
      setSelectedCategory(category);
      setActiveIndex(0);
      setCurrentTimeSec(0);
      setSpokenCueIndex(-1);
      setSpokenWordIndex(0);
      setSeekTargetSec(null);
      setTimerBulletinComplete(false);
      setIsPlaying(true);
      if (feedContainerRef.current) {
        feedContainerRef.current.scrollTo({ top: 0, behavior: 'auto' });
      }
    },
    [clearBulletinTimeout]
  );

  const {
    isSpeaking,
    isAwaitingGesture,
    ttsStatus,
    isBulletinComplete,
    narrationProgress,
    geminiDurationSec,
    isTestingCustom,
    activeVoiceName,
    studioError,
    activeChunkIdx,
    totalChunks,
    primeSpeech,
    speakCustomText,
    stopCustomTest,
    stop: stopSpeech,
  } = useSpeechNarration({
    enabled:
      audioEnabled &&
      audioSourceMode === 'ai' &&
      activeTab === 'feed' &&
      Boolean(activeReel) &&
      !isLoadingDistrictNews &&
      !verifyModalReel &&
      !shareModalReel &&
      !isReportModalOpen &&
      !isVoiceModalOpen,
    isPlaying,
    language,
    reelId: activeReel?.id || '',
    headline: activeReel?.headline[language] || '',
    subtitles: activeReel?.subtitles || [],
    nextReelId: nextReel?.id || '',
    nextHeadline: nextReel?.headline[language] || '',
    nextSubtitles: nextReel?.subtitles || [],
    seekTargetSec,
    seekVersion,
    rateMultiplier: speechRate,
    voiceConfig,
    onSyncCue: handleSyncCue,
    onCompleteReel: () => {
      if (feedItems.length === 0) return;
      if (autoNextRef.current) {
        const nextIndex = (safeIndex + 1) % feedItems.length;
        scrollToReelIndex(nextIndex);
        if (nextIndex === safeIndex) {
          setSeekTargetSec(0);
          setSeekVersion((v) => v + 1);
        }
      } else {
        setCurrentTimeSec(0);
        setSpokenCueIndex(-1);
        setSpokenWordIndex(0);
        setSeekTargetSec(0);
        setSeekVersion((v) => v + 1);
      }
    },
  });

  const activeDurationSec =
    geminiDurationSec && geminiDurationSec > 0
      ? geminiDurationSec
      : activeTiming?.durationSec || 10;
  const durationScale = activeTiming
    ? activeDurationSec / Math.max(1, activeTiming.durationSec)
    : 1;

  const activeCue = useMemo(() => {
    if (!activeTiming || activeTiming.cues.length === 0) return undefined;
    if (audioEnabled && audioSourceMode === 'ai' && (isSpeaking || isBulletinComplete)) {
      if (spokenCueIndex < 0) return undefined;
      return activeTiming.cues[spokenCueIndex] || activeTiming.cues[0];
    }
    if (currentTimeSec < activeTiming.headlineEndSec) {
      return undefined;
    }
    return (
      activeTiming.cues.find(
        (cue) => currentTimeSec >= cue.startSec && currentTimeSec < cue.endSec
      ) || activeTiming.cues[activeTiming.cues.length - 1]
    );
  }, [
    activeTiming,
    audioEnabled,
    audioSourceMode,
    isSpeaking,
    isBulletinComplete,
    spokenCueIndex,
    currentTimeSec,
  ]);

  const loadLiveDistrictNews = useCallback(
    async (district: DistrictId, explicitState?: string, showShimmer = true) => {
      if (district === 'All') {
        districtFetchSeqRef.current += 1;
        setIsLoadingDistrictNews(false);
        return;
      }

      const reqSeq = ++districtFetchSeqRef.current;
      const targetName = String(district);
      const resolvedState =
        explicitState ||
        districtsRef.current.find(
          (d) => d.id.toLowerCase() === targetName.toLowerCase()
        )?.state ||
        'Bihar';

      if (showShimmer) {
        setLoadingDistrictLabel(targetName);
        setIsLoadingDistrictNews(true);
      }

      try {
        const [liveResult] = await Promise.all([
          fetchLiveNewsForDistrict(targetName, resolvedState),
          new Promise<void>((resolve) =>
            window.setTimeout(resolve, showShimmer ? 300 : 0)
          ),
        ]);

        if (districtFetchSeqRef.current !== reqSeq) return;

        if (!showShimmer) {
          // Non-destructive startup background load: append new stories BELOW active Reel #1 without resetting playback
          const deletedSet = new Set(deletedReelIdsRef.current);
          const overrides = breakingOverridesRef.current;
          const existingIds = new Set(reelsRef.current.map((r) => r.id));
          const existingKeys = new Set(reelsRef.current.map((r) => getReelDedupeKey(r)));
          const newLocalAdditions = liveResult.reels
            .filter((r) => {
              const k = getReelDedupeKey(r);
              return !deletedSet.has(r.id) && !existingIds.has(r.id) && !existingKeys.has(k);
            })
            .map((r) =>
              Object.prototype.hasOwnProperty.call(overrides, r.id)
                ? { ...r, isBreaking: overrides[r.id] }
                : r
            );

          if (newLocalAdditions.length > 0) {
            setAppendedLiveIds((prev) => {
              const next = new Set(prev);
              newLocalAdditions.forEach((r) => next.add(r.id));
              return next;
            });
            setReels((prev) => {
              const prevIds = new Set(prev.map((r) => r.id));
              const prevKeys = new Set(prev.map((r) => getReelDedupeKey(r)));
              const safeAdds = newLocalAdditions.filter(
                (r) => !prevIds.has(r.id) && !prevKeys.has(getReelDedupeKey(r))
              );
              return safeAdds.length > 0 ? [...prev, ...safeAdds] : prev;
            });
            setNewlyLoadedBanner((prev) => ({
              count: (prev?.count || 0) + newLocalAdditions.length,
              targetReelId: prev?.targetReelId || newLocalAdditions[0].id,
            }));
          }
          return;
        }

        setAppendedLiveIds(new Set());
        setNewlyLoadedBanner(null);

        setReels((prev) => {
          const targetLower = targetName.toLowerCase();
          const deletedSet = new Set(deletedReelIdsRef.current);
          const overrides = breakingOverridesRef.current;
          const citizenForDistrict = prev.filter(
            (r) =>
              !deletedSet.has(r.id) &&
              (r.scope || 'local') === 'local' &&
              r.district.toLowerCase() === targetLower &&
              Boolean(r.isCitizenSubmitted || r.isVerifiedReporter)
          );
          const citizenIds = new Set(citizenForDistrict.map((r) => r.id));
          const liveFiltered = liveResult.reels.filter(
            (r) => !deletedSet.has(r.id) && !citizenIds.has(r.id)
          );
          const otherDistricts = prev.filter(
            (r) =>
              !deletedSet.has(r.id) &&
              (r.scope === 'national' ||
                r.scope === 'international' ||
                r.district.toLowerCase() !== targetLower)
          );
          return [...citizenForDistrict, ...liveFiltered, ...otherDistricts].map((r) =>
            Object.prototype.hasOwnProperty.call(overrides, r.id)
              ? { ...r, isBreaking: overrides[r.id] }
              : r
          );
        });

        setActiveIndex(0);
        setCurrentTimeSec(0);
        setSpokenCueIndex(-1);
        setSpokenWordIndex(0);
        setSeekTargetSec(null);
        setTimerBulletinComplete(false);
        setIsPlaying(true);
        setSeekVersion((v) => v + 1);
      } finally {
        if (districtFetchSeqRef.current === reqSeq && showShimmer) {
          setIsLoadingDistrictNews(false);
          window.requestAnimationFrame(() => {
            if (feedContainerRef.current) {
              feedContainerRef.current.scrollTop = 0;
            }
          });
        }
      }
    },
    []
  );

  // Stop active narration & videos, strictly filter feed, reset scrollTop = 0, show shimmer, and load live news for district
  const handleSelectDistrict = useCallback(
    (district: DistrictId, explicitState?: string) => {
      clearBulletinTimeout();
      stopSpeech();
      studioAudioBed.fadeOut();
      if (feedContainerRef.current) {
        feedContainerRef.current.querySelectorAll('video').forEach((v) => {
          v.pause();
          try {
            v.currentTime = 0;
          } catch {
            // Ignore seek errors before metadata loads
          }
        });
        feedContainerRef.current.scrollTop = 0;
      }
      setSelectedDistrict(district);
      saveSelectedDistrict(String(district));
      setIsDistrictPickerOpen(false);
      setActiveIndex(0);
      setCurrentTimeSec(0);
      setSpokenCueIndex(-1);
      setSpokenWordIndex(0);
      setSeekTargetSec(null);
      setTimerBulletinComplete(false);
      setIsPlaying(true);
      setSeekVersion((v) => v + 1);
      window.requestAnimationFrame(() => {
        if (feedContainerRef.current) {
          feedContainerRef.current.scrollTop = 0;
        }
      });
      void loadLiveDistrictNews(district, explicitState, true);
    },
    [clearBulletinTimeout, loadLiveDistrictNews, stopSpeech]
  );

  const handleSelectScope = useCallback(
    (scope: ReelScopeFilter) => {
      clearBulletinTimeout();
      stopSpeech();
      studioAudioBed.fadeOut();
      setAppendedLiveIds((prev) => (prev.size > 0 ? new Set() : prev));
      setNewlyLoadedBanner(null);
      if (feedContainerRef.current) {
        feedContainerRef.current.querySelectorAll('video').forEach((v) => {
          v.pause();
          try {
            v.currentTime = 0;
          } catch {
            // Ignore
          }
        });
        feedContainerRef.current.scrollTop = 0;
      }
      setSelectedScope(scope);
      setActiveIndex(0);
      setCurrentTimeSec(0);
      setSpokenCueIndex(-1);
      setSpokenWordIndex(0);
      setSeekTargetSec(null);
      setTimerBulletinComplete(false);
      setIsPlaying(true);
      setSeekVersion((v) => v + 1);
      window.requestAnimationFrame(() => {
        if (feedContainerRef.current) {
          feedContainerRef.current.scrollTop = 0;
        }
      });
    },
    [clearBulletinTimeout, stopSpeech]
  );

  const audioEnabledRef = useRef(audioEnabled);
  const audioSourceModeRef = useRef(audioSourceMode);
  const isSpeakingRef = useRef(isSpeaking);
  const isBulletinCompleteRef = useRef(isBulletinComplete);
  const autoNextRef = useRef(autoNext);
  const currentTimeSecRef = useRef(currentTimeSec);
  const spokenCueIndexRef = useRef(spokenCueIndex);
  const districtsRef = useRef(districts);
  const selectedDistrictRef = useRef(selectedDistrict);
  const handleSelectDistrictRef = useRef(handleSelectDistrict);
  const deletedReelIdsRef = useRef(deletedReelIds);
  const breakingOverridesRef = useRef(breakingOverrides);
  const reelsRef = useRef(reels);
  const activeTabRef = useRef(activeTab);
  audioEnabledRef.current = audioEnabled;
  audioSourceModeRef.current = audioSourceMode;
  isSpeakingRef.current = isSpeaking;
  isBulletinCompleteRef.current = isBulletinComplete;
  autoNextRef.current = autoNext;
  currentTimeSecRef.current = currentTimeSec;
  spokenCueIndexRef.current = spokenCueIndex;
  districtsRef.current = districts;
  selectedDistrictRef.current = selectedDistrict;
  handleSelectDistrictRef.current = handleSelectDistrict;
  deletedReelIdsRef.current = deletedReelIds;
  breakingOverridesRef.current = breakingOverrides;
  reelsRef.current = reels;
  activeTabRef.current = activeTab;

  const showGpsToast = useCallback(
    (message: string, tone: 'info' | 'success' | 'warn', autoHideMs = 3400) => {
      if (gpsToastTimerRef.current !== null) {
        window.clearTimeout(gpsToastTimerRef.current);
        gpsToastTimerRef.current = null;
      }
      setGpsToast({ message, tone });
      if (autoHideMs > 0) {
        gpsToastTimerRef.current = window.setTimeout(() => {
          setGpsToast(null);
          gpsToastTimerRef.current = null;
        }, autoHideMs);
      }
    },
    []
  );

  const handleDetectGps = useCallback(
    async (isAutoLaunch = false) => {
      if (gpsDetectingRef.current) return;
      gpsDetectingRef.current = true;
      setIsDetectingGps(true);
      showGpsToast('Detecting your district...', 'info', 0);

      try {
        const result = await detectCurrentIndianDistrict(districtsRef.current);

        if (result.matchedExisting) {
          const targetId = result.matchedExisting.id;
          setGpsDetectedNewDistrict(null);
          if (
            !isAutoLaunch ||
            String(selectedDistrictRef.current).toLowerCase() !== targetId.toLowerCase()
          ) {
            handleSelectDistrictRef.current(targetId);
          }
          if (!isAutoLaunch) {
            setActiveTab('feed');
          }
          showGpsToast(`📍 Local feed: ${targetId}`, 'success', 3200);
        } else {
          const newDistrictMeta: DistrictMeta = {
            id: result.districtName,
            state: result.stateName,
            group: 'detected',
            pinPrefix: result.postcode || 'IN',
            activeDesks: 1,
            topBeat: 'Citizen & Local Dispatch',
            summary: {
              hi: `${result.districtName} (${result.stateName}) के स्थानीय नागरिक समाचार और लाइव वीडियो बुलेटिन।`,
              en: `Hyper-local citizen dispatches and verified video bulletins for ${result.districtName}, ${result.stateName}.`,
              bho: `${result.districtName} (${result.stateName}) के स्थानीय समाचार आ नागरिक बुलेटिन।`,
              ta: `${result.districtName} (${result.stateName}) உள்ளூர் செய்திகள் மற்றும் குடிமக்கள் அறிக்கைகள்.`,
              bn: `${result.districtName} (${result.stateName}) স্থানীয় সংবাদ ও নাগরিক ভিডিও বুলেটিন।`,
              mr: `${result.districtName} (${result.stateName}) मधील स्थानिक बातम्या आणि नागरिक वार्तांकन.`,
            },
          };

          setDistricts((prev) =>
            prev.some((d) => d.id.toLowerCase() === result.districtName.toLowerCase())
              ? prev
              : [...prev, newDistrictMeta]
          );
          setGpsDetectedNewDistrict({ id: result.districtName, state: result.stateName });
          handleSelectDistrictRef.current(result.districtName, result.stateName);
          if (!isAutoLaunch) {
            setActiveTab('feed');
          }
          showGpsToast(`📍 Detected: ${result.districtName}`, 'success', 3600);
        }
      } catch {
        showGpsToast('GPS off — please select your district manually', 'warn', 3800);
      } finally {
        gpsDetectingRef.current = false;
        setIsDetectingGps(false);
      }
    },
    [showGpsToast]
  );

  // Fetch live Local (selectedDistrict), National (India) & International (World) news on startup via Primary (Gemini Search Grounding) or Backup (CORS Proxy + DOMParser) engine + trigger Auto GPS if no district saved
  useEffect(() => {
    let active = true;
    const initialDistrict = loadSelectedDistrict();
    let resolvedState = 'Bihar';

    if (initialDistrict !== 'All') {
      const matched = districtsRef.current.find(
        (d) => d.id.toLowerCase() === initialDistrict.toLowerCase()
      );
      resolvedState = matched?.state || 'Bihar';
      if (!matched) {
        const dynamicMeta: DistrictMeta = {
          id: initialDistrict,
          state: 'India',
          group: 'detected',
          pinPrefix: 'IN',
          activeDesks: 1,
          topBeat: 'Citizen & Local Dispatch',
          summary: {
            hi: `${initialDistrict} के स्थानीय नागरिक समाचार और लाइव वीडियो बुलेटिन।`,
            en: `Hyper-local citizen dispatches and verified video bulletins for ${initialDistrict}.`,
            bho: `${initialDistrict} के स्थानीय समाचार आ नागरिक बुलेटिन।`,
            ta: `${initialDistrict} உள்ளூர் செய்திகள் மற்றும் குடிமக்கள் அறிக்கைகள்.`,
            bn: `${initialDistrict} স্থানীয় সংবাদ ও নাগরিক ভিডিও বুলেটিন।`,
            mr: `${initialDistrict} मधील स्थानिक बातम्या आणि नागरिक वार्तांकन.`,
          },
        };
        setDistricts((prev) =>
          prev.some((d) => d.id.toLowerCase() === initialDistrict.toLowerCase())
            ? prev
            : [...prev, dynamicMeta]
        );
      }
    }

    if (!hasStoredSelectedDistrict()) {
      void handleDetectGps(true);
    }

    void (async () => {
      const scoped = await fetchAllScopesLiveNews(initialDistrict, resolvedState, false);
      if (!active) return;

      const deletedSet = new Set(deletedReelIdsRef.current);
      const overrides = breakingOverridesRef.current;
      const existingIds = new Set(reelsRef.current.map((r) => r.id));
      const existingKeys = new Set(reelsRef.current.map((r) => getReelDedupeKey(r)));
      const additions = [...scoped.local, ...scoped.national, ...scoped.international]
        .filter(
          (r) =>
            !deletedSet.has(r.id) &&
            !existingIds.has(r.id) &&
            !existingKeys.has(getReelDedupeKey(r))
        )
        .map((r) =>
          Object.prototype.hasOwnProperty.call(overrides, r.id)
            ? { ...r, isBreaking: overrides[r.id] }
            : r
        );

      if (additions.length > 0) {
        setAppendedLiveIds((prev) => {
          const next = new Set(prev);
          additions.forEach((r) => next.add(r.id));
          return next;
        });
        setReels((prev) => {
          const prevIds = new Set(prev.map((r) => r.id));
          const prevKeys = new Set(prev.map((r) => getReelDedupeKey(r)));
          const safeAdds = additions.filter(
            (r) => !prevIds.has(r.id) && !prevKeys.has(getReelDedupeKey(r))
          );
          return safeAdds.length > 0 ? [...prev, ...safeAdds] : prev;
        });
        setNewlyLoadedBanner((prev) => ({
          count: (prev?.count || 0) + additions.length,
          targetReelId: prev?.targetReelId || additions[0].id,
        }));
      }
    })();

    return () => {
      active = false;
    };
  }, [handleDetectGps]);

    const handleJumpToNewlyLoaded = useCallback(() => {
      const info = newlyLoadedBanner;
      setNewlyLoadedBanner(null);
      if (!info) return;
      const targetIdx = feedItems.findIndex(
        (item) => item.kind === 'reel' && item.reel.id === info.targetReelId
      );
      if (targetIdx !== -1) {
        scrollToReelIndex(targetIdx);
      } else if (feedItems.length > 1) {
        scrollToReelIndex(1);
      }
    }, [feedItems, newlyLoadedBanner, scrollToReelIndex]);

    const runAutoNewsUpdate = useCallback(
      async (options: { manual?: boolean; forceImmediate?: boolean } = {}) => {
        const { manual = false, forceImmediate = false } = options;
        if (autoSyncInFlightRef.current) return;
        const now = Date.now();
        if (!manual && now - lastAutoSyncAtRef.current < 120_000) return;

        autoSyncInFlightRef.current = true;
        lastAutoSyncAtRef.current = now;
        setIsAutoRefreshing(true);

        try {
          const targetDistrict = String(selectedDistrictRef.current || 'Muzaffarpur');
          const resolvedState =
            districtsRef.current.find(
              (d) => d.id.toLowerCase() === targetDistrict.toLowerCase()
            )?.state || 'Bihar';

          const [scopedResult, syncResult] = await Promise.allSettled([
            fetchAllScopesLiveNews(targetDistrict, resolvedState, manual),
            fetch('/api/news/sync', { cache: 'no-store' }),
          ]);

          let remoteLiveReels: NewsReel[] = [];
          if (syncResult.status === 'fulfilled' && syncResult.value.ok) {
            const newsData = (await syncResult.value.json()) as {
              synced?: boolean;
              liveNews?: RemoteLiveNewsItemPayload[];
            };
            if (newsData.synced && Array.isArray(newsData.liveNews)) {
              remoteLiveReels = mapRemoteLiveNewsToReels(
                newsData.liveNews,
                deletedReelIdsRef.current,
                breakingOverridesRef.current
              );
              if (remoteLiveReels.length > 0) {
                setApprovedPortalReels((prev) => {
                  const merged = new Map<string, NewsReel>();
                  for (const r of prev) merged.set(r.id, r);
                  for (const r of remoteLiveReels) merged.set(r.id, r);
                  const next = Array.from(merged.values());
                  saveApprovedPortalReels(next);
                  return next;
                });
              }
            }
          }

          const rssLocal = scopedResult.status === 'fulfilled' ? scopedResult.value.local : [];
          const rssNational = scopedResult.status === 'fulfilled' ? scopedResult.value.national : [];
          const rssInternational =
            scopedResult.status === 'fulfilled' ? scopedResult.value.international : [];

          const allIncoming = [
            ...remoteLiveReels,
            ...rssLocal,
            ...rssNational,
            ...rssInternational,
          ];

          const deletedSet = new Set(deletedReelIdsRef.current);
          const overrides = breakingOverridesRef.current;
          const currentReels = reelsRef.current;
          const existingIds = new Set(currentReels.map((r) => r.id));
          const existingKeys = new Set(currentReels.map((r) => getReelDedupeKey(r)));
          const incomingMetaById = new Map<string, NewsReel>();
          for (const item of allIncoming) {
            incomingMetaById.set(item.id, item);
          }

          const batchSeenKeys = new Set<string>();
          const brandNewReels: NewsReel[] = [];
          for (const candidate of allIncoming) {
            if (deletedSet.has(candidate.id)) continue;
            const key = getReelDedupeKey(candidate);
            if (existingIds.has(candidate.id) || existingKeys.has(key) || batchSeenKeys.has(key)) {
              continue;
            }
            batchSeenKeys.add(key);
            brandNewReels.push(
              Object.prototype.hasOwnProperty.call(overrides, candidate.id)
                ? { ...candidate, isBreaking: overrides[candidate.id] }
                : candidate
            );
          }

          // Non-destructive merge: refresh publishedAgo labels & append newly fetched live stories
          // BELOW the active reel so playback and active video NEVER reset or flicker.
          let appendedCount = 0;
          if (brandNewReels.length > 0) {
            setAppendedLiveIds((prev) => {
              const next = new Set(prev);
              brandNewReels.forEach((r) => next.add(r.id));
              return next;
            });
          }

          setReels((prev) => {
            let changed = false;
            const updated = prev.map((existing) => {
              const fresh = incomingMetaById.get(existing.id);
              if (fresh && fresh.publishedAgo && fresh.publishedAgo !== existing.publishedAgo) {
                changed = true;
                return { ...existing, publishedAgo: fresh.publishedAgo };
              }
              return existing;
            });

            if (brandNewReels.length === 0) {
              return changed ? updated : prev;
            }

            const prevIds = new Set(updated.map((r) => r.id));
            const prevKeys = new Set(updated.map((r) => getReelDedupeKey(r)));
            const safeAdds = brandNewReels.filter(
              (r) => !prevIds.has(r.id) && !prevKeys.has(getReelDedupeKey(r))
            );
            appendedCount = safeAdds.length;
            if (safeAdds.length === 0) {
              return changed ? updated : prev;
            }
            return [...updated, ...safeAdds];
          });

          if (appendedCount > 0) {
            setNewlyLoadedBanner((prev) => ({
              count: (prev?.count || 0) + appendedCount,
              targetReelId: prev?.targetReelId || brandNewReels[0].id,
            }));
          }

          if (manual || forceImmediate) {
            if (appendedCount > 0) {
              showGpsToast(
                `✨ ${appendedCount} New Live Stories Loaded below`,
                'success',
                2600
              );
            } else {
              showGpsToast('✅ Local, National & World feeds up to date', 'success', 2400);
            }
          }
        } finally {
          autoSyncInFlightRef.current = false;
          setIsAutoRefreshing(false);
        }
      },
      [showGpsToast]
    );

    const handleManualRefreshFeed = useCallback(() => {
      void runAutoNewsUpdate({ manual: true, forceImmediate: true });
    }, [runAutoNewsUpdate]);

    // Automatic periodic background polling (every 5 minutes) + tab visibility/focus/online refresh
    useEffect(() => {
      const AUTO_UPDATE_INTERVAL_MS = 5 * 60 * 1000;
      const intervalId = window.setInterval(() => {
        if (document.visibilityState === 'visible') {
          void runAutoNewsUpdate({ manual: false, forceImmediate: false });
        }
      }, AUTO_UPDATE_INTERVAL_MS);

      const handleVisibilityOrFocus = () => {
        if (document.visibilityState === 'visible') {
          void runAutoNewsUpdate({ manual: false, forceImmediate: false });
        }
      };
      const handleOnline = () => {
        void runAutoNewsUpdate({ manual: false, forceImmediate: false });
      };

      document.addEventListener('visibilitychange', handleVisibilityOrFocus);
      window.addEventListener('focus', handleVisibilityOrFocus);
      window.addEventListener('online', handleOnline);

      return () => {
        window.clearInterval(intervalId);
        document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
        window.removeEventListener('focus', handleVisibilityOrFocus);
        window.removeEventListener('online', handleOnline);
      };
    }, [runAutoNewsUpdate]);

  useEffect(() => {
    return () => {
      clearBulletinTimeout();
      if (gpsToastTimerRef.current !== null) {
        window.clearTimeout(gpsToastTimerRef.current);
        gpsToastTimerRef.current = null;
      }
      studioAudioBed.dispose();
    };
  }, [clearBulletinTimeout]);

  // Web Audio API Ambient Newsroom Bed: ultra-low-volume studio tone while reel is active, smooth fade-out on completion/mute
  const shouldPlayStudioBed =
    activeTab === 'feed' &&
    Boolean(activeReel) &&
    isPlaying &&
    audioEnabled &&
    audioSourceMode === 'ai' &&
    !isLoadingDistrictNews &&
    !isBulletinComplete &&
    !timerBulletinComplete &&
    !verifyModalReel &&
    !shareModalReel &&
    !isReportModalOpen &&
    !isVoiceModalOpen;

  useEffect(() => {
    if (shouldPlayStudioBed) {
      studioAudioBed.start(isSpeaking);
      studioAudioBed.setDucked(isSpeaking);
    } else {
      studioAudioBed.fadeOut();
    }
  }, [shouldPlayStudioBed, isSpeaking]);

  // Decoupled 10Hz requestAnimationFrame fallback timer when muted or playing Reporter Video Audio
  useEffect(() => {
    if (activeTab !== 'feed' || isLoadingDistrictNews || !isPlaying || !activeReel || !activeTiming) return;
    if (verifyModalReel || shareModalReel || isReportModalOpen) return;
    if (timerBulletinComplete) return;

    let rafId = 0;
    let lastFrameAt = performance.now();
    let lastUiCommitAt = lastFrameAt;
    let accumulatedSec = 0;

    const step = (now: number) => {
      const dtSec = Math.min(0.25, Math.max(0, (now - lastFrameAt) / 1000));
      lastFrameAt = now;

      // When AI Dubbing is active, useSpeechNarration owns real-time progress and completion
      if (
        audioEnabledRef.current &&
        audioSourceModeRef.current === 'ai' &&
        (isSpeakingRef.current || isBulletinCompleteRef.current)
      ) {
        accumulatedSec = 0;
        rafId = window.requestAnimationFrame(step);
        return;
      }

      accumulatedSec += dtSec;
      if (now - lastUiCommitAt >= 100) {
        const deltaToCommit = accumulatedSec;
        accumulatedSec = 0;
        lastUiCommitAt = now;

        const next = currentTimeSecRef.current + deltaToCommit;
        if (next >= activeDurationSec) {
          currentTimeSecRef.current = activeDurationSec;
          setCurrentTimeSec(activeDurationSec);
          setTimerBulletinComplete(true);
          clearBulletinTimeout();
          bulletinTimeoutRef.current = window.setTimeout(() => {
            setTimerBulletinComplete(false);
            if (autoNextRef.current && feedItems.length > 0) {
              const nextIndex = (safeIndex + 1) % feedItems.length;
              scrollToReelIndex(nextIndex);
            } else {
              currentTimeSecRef.current = 0;
              setCurrentTimeSec(0);
              setSpokenCueIndex(-1);
              setSpokenWordIndex(0);
            }
          }, 1000);
          return;
        }

        currentTimeSecRef.current = next;
        setCurrentTimeSec(next);
      }

      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [
    activeTab,
    isLoadingDistrictNews,
    isPlaying,
    activeReel,
    activeTiming,
    activeDurationSec,
    timerBulletinComplete,
    safeIndex,
    feedItems.length,
    scrollToReelIndex,
    clearBulletinTimeout,
    verifyModalReel,
    shareModalReel,
    isReportModalOpen,
  ]);

  // Smart IntersectionObserver: play only the reel currently scrolled into view
  useEffect(() => {
    const container = feedContainerRef.current;
    if (!container || activeTab !== 'feed' || isLoadingDistrictNews) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.65) {
            const idxAttr = entry.target.getAttribute('data-reel-idx');
            if (idxAttr !== null) {
              const idx = Number(idxAttr);
              if (!Number.isNaN(idx)) {
                setActiveIndex((prev) => {
                  if (prev !== idx) {
                    clearBulletinTimeout();
                    setCurrentTimeSec(0);
                    setSpokenCueIndex(-1);
                    setSpokenWordIndex(0);
                    setSeekTargetSec(null);
                    setTimerBulletinComplete(false);
                    setIsPlaying(true);
                  }
                  return idx;
                });
              }
            }
          }
        }
      },
      {
        root: container,
        threshold: [0.65],
      }
    );

    const children = Array.from(container.children);
    children.forEach((child) => observer.observe(child));

    return () => observer.disconnect();
  }, [activeTab, isLoadingDistrictNews, feedItems.length, selectedDistrict, clearBulletinTimeout]);

  // Single Active Player Lock: pause any off-screen <video> outside the active reel index
  useEffect(() => {
    const container = feedContainerRef.current;
    if (!container) return;
    container.querySelectorAll('video').forEach((v) => {
      const holder = v.closest('[data-reel-idx]');
      const idxAttr = holder?.getAttribute('data-reel-idx');
      if (idxAttr === null || Number(idxAttr) !== safeIndex) {
        v.pause();
      }
    });
  }, [safeIndex, activeTab]);

  // Keyboard navigation on desktop (Up / Down arrows, Space to play/pause)
  useEffect(() => {
    if (activeTab !== 'feed' || verifyModalReel || shareModalReel || isReportModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        scrollToReelIndex(safeIndex + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        scrollToReelIndex(safeIndex - 1);
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeTab,
    safeIndex,
    scrollToReelIndex,
    verifyModalReel,
    shareModalReel,
    isReportModalOpen,
  ]);

  const toggleLike = useCallback((reelId: string) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(reelId)) next.delete(reelId);
      else next.add(reelId);
      return next;
    });
  }, []);

  const ensureLike = useCallback((reelId: string) => {
    setLikedIds((prev) => {
      if (prev.has(reelId)) return prev;
      const next = new Set(prev);
      next.add(reelId);
      return next;
    });
  }, []);

  const toggleBookmark = useCallback((reelId: string) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(reelId)) next.delete(reelId);
      else next.add(reelId);
      return next;
    });
  }, []);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((p) => !p);
  }, []);

  const handleSeek = useCallback(
    (sec: number) => {
      if (!activeReel) return;
      clearBulletinTimeout();
      setTimerBulletinComplete(false);
      setCurrentTimeSec(sec);
      const timing = getReelTiming(activeReel, language);
      const scaledSec = sec / Math.max(0.01, durationScale);
      if (scaledSec < timing.headlineEndSec) {
        setSpokenCueIndex(-1);
        setSpokenWordIndex(0);
      } else {
        const foundIdx = timing.cues.findIndex(
          (c) => scaledSec >= c.startSec && scaledSec < c.endSec
        );
        const cueIdx = foundIdx >= 0 ? foundIdx : Math.max(0, timing.cues.length - 1);
        setSpokenCueIndex(cueIdx);
        setSpokenWordIndex(0);
      }
      setSeekTargetSec(sec);
      setSeekVersion((v) => v + 1);
      setIsPlaying(true);
    },
    [activeReel, language, durationScale, clearBulletinTimeout]
  );

  const handleOpenShare = useCallback((reel: NewsReel) => {
    setShareModalReel(reel);
  }, []);

  const handleOpenVerify = useCallback((reel: NewsReel) => {
    setVerifyModalReel(reel);
  }, []);

  const handlePublishCitizenReel = useCallback(
    (newReel: NewsReel) => {
      clearBulletinTimeout();
      stopSpeech();
      setReels((prev) => [newReel, ...prev]);
      setLiveCitizenReels((prev) => {
        const next = [newReel, ...prev];
        saveLiveCitizenReels(next);
        return next;
      });
      setIsReportModalOpen(false);
      setSelectedDistrict(newReel.district);
      saveSelectedDistrict(String(newReel.district));
      setActiveTab('feed');
      setActiveIndex(0);
      setCurrentTimeSec(0);
      setSpokenCueIndex(-1);
      setSpokenWordIndex(0);
      setSeekTargetSec(null);
      setTimerBulletinComplete(false);
      setIsPlaying(true);
      if (newReel.hasOriginalAudio) {
        setAudioSourceMode('video');
        setAudioEnabled(true);
      } else {
        primeSpeech();
        studioAudioBed.unlock();
        setAudioSourceMode('ai');
        setAudioEnabled(true);
        setSeekVersion((v) => v + 1);
      }
      window.requestAnimationFrame(() => {
        if (feedContainerRef.current) {
          feedContainerRef.current.scrollTop = 0;
        }
      });
    },
    [clearBulletinTimeout, primeSpeech, stopSpeech]
  );

  const handleJumpToReel = useCallback(
    (reelId: string) => {
      const targetReel = reels.find((r) => r.id === reelId);
      if (!targetReel) return;
      const targetScope: NewsScope = targetReel.scope || 'local';
      const keepAll = selectedDistrictRef.current === 'All';
      const targetDistrict =
        targetScope === 'local' && !keepAll ? targetReel.district : selectedDistrictRef.current;

      if (
        targetScope === 'local' &&
        !keepAll &&
        String(selectedDistrictRef.current).toLowerCase() !== targetReel.district.toLowerCase()
      ) {
        setSelectedDistrict(targetDistrict);
        saveSelectedDistrict(String(targetDistrict));
      }

      if (selectedScope !== 'mix' && selectedScope !== targetScope) {
        setSelectedScope(targetScope);
      }

      const nextScope: ReelScopeFilter =
        selectedScope === 'mix' ? 'mix' : targetScope;
      const localList = reels.filter(
        (r) =>
          (r.scope || 'local') === 'local' &&
          (targetDistrict === 'All' ||
            r.district.toLowerCase() === String(targetDistrict).toLowerCase())
      );
      const natList = reels.filter((r) => r.scope === 'national');
      const intlList = reels.filter((r) => r.scope === 'international');
      let targetList: NewsReel[] = [];
      if (nextScope === 'local') targetList = localList;
      else if (nextScope === 'national') targetList = natList;
      else if (nextScope === 'international') targetList = intlList;
      else {
        const seen = new Set<string>();
        const maxLen = Math.max(localList.length, natList.length, intlList.length);
        for (let i = 0; i < maxLen; i += 1) {
          for (const c of [localList[i], natList[i], intlList[i]]) {
            if (c && !seen.has(c.id)) {
              seen.add(c.id);
              targetList.push(c);
            }
          }
        }
      }

      const reelIdx = targetList.findIndex((r) => r.id === reelId);
      const hasReelAd = Boolean(pickLocalAdForDistrict(localAds, 'reel', targetDistrict));
      const feedIdx = reelIdx === -1 ? -1 : hasReelAd ? reelIdx + Math.floor(reelIdx / 4) : reelIdx;
      setSelectedCategory('All');
      primeSpeech();
      studioAudioBed.unlock();
      setAudioEnabled(true);
      setActiveTab('feed');
      if (feedIdx !== -1) {
        window.setTimeout(() => scrollToReelIndex(feedIdx), 60);
      }
    },
    [localAds, primeSpeech, reels, scrollToReelIndex, selectedScope]
  );

  const handleUnmuteGeminiAnchor = useCallback(() => {
    clearBulletinTimeout();
    setTimerBulletinComplete(false);
    primeSpeech();
    studioAudioBed.unlock();
    setAudioSourceMode('ai');
    setAudioEnabled(true);
    setSeekTargetSec(currentTimeSecRef.current > 0.2 ? currentTimeSecRef.current : null);
    setSeekVersion((v) => v + 1);
  }, [clearBulletinTimeout, primeSpeech]);

  const handleToggleAudio = useCallback(() => {
    clearBulletinTimeout();
    setTimerBulletinComplete(false);
    if (!audioEnabledRef.current) {
      if (audioSourceModeRef.current === 'ai') {
        primeSpeech();
        studioAudioBed.unlock();
      }
      setAudioEnabled(true);
    } else {
      stopSpeech();
      studioAudioBed.fadeOut();
      setAudioEnabled(false);
    }
  }, [clearBulletinTimeout, primeSpeech, stopSpeech]);

  const handleSelectAudioSourceMode = useCallback(
    (mode: AudioSourceMode) => {
      clearBulletinTimeout();
      setTimerBulletinComplete(false);
      if (mode === 'video') {
        stopSpeech();
        studioAudioBed.fadeOut();
        setAudioSourceMode('video');
        setAudioEnabled(true);
      } else {
        primeSpeech();
        studioAudioBed.unlock();
        setAudioSourceMode('ai');
        setAudioEnabled(true);
        setSeekTargetSec(currentTimeSecRef.current > 0.2 ? currentTimeSecRef.current : null);
        setSeekVersion((v) => v + 1);
      }
    },
    [clearBulletinTimeout, primeSpeech, stopSpeech]
  );

  const handleSelectLanguage = useCallback(
    (lang: LanguageCode) => {
      clearBulletinTimeout();
      setLanguage(lang);
      setCurrentTimeSec(0);
      setSpokenCueIndex(-1);
      setSpokenWordIndex(0);
      setSeekTargetSec(null);
      setTimerBulletinComplete(false);
      setSeekVersion((v) => v + 1);
    },
    [clearBulletinTimeout]
  );

  const handleOpenVoiceSettings = useCallback(() => setIsVoiceModalOpen(true), []);
  const handleOpenReportModal = useCallback(() => {
    setReportInitialTab('upload');
    setIsReportModalOpen(true);
  }, []);
  const handleStartLiveReportFromZila = useCallback((mode: 'record' | 'upload') => {
    setReportInitialTab(mode);
    setIsReportModalOpen(true);
  }, []);
  const handleGoLiveForDistrict = useCallback(
    (district: DistrictId) => {
      if (district !== 'All' && String(selectedDistrictRef.current).toLowerCase() !== String(district).toLowerCase()) {
        setSelectedDistrict(district);
        saveSelectedDistrict(String(district));
      }
      setReportInitialTab('record');
      setIsReportModalOpen(true);
    },
    []
  );
  const handleOpenDistrictPicker = useCallback(() => setIsDistrictPickerOpen(true), []);
  const handleCloseDistrictPicker = useCallback(() => setIsDistrictPickerOpen(false), []);

  const refreshAdminAuthStatus = useCallback(async () => {
    try {
      const resp = await fetch('/api/admin/auth/status');
      if (!resp.ok) return;
      const data = (await resp.json()) as AdminAuthStatus;
      setAdminAuthStatus(data);
    } catch {
      // Ignore transient network errors
    }
  }, []);

  useEffect(() => {
    void refreshAdminAuthStatus();
  }, [refreshAdminAuthStatus]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [reportersResp, newsResp, liveTvResp, tvSubResp, adsResp, payoutsResp] =
          await Promise.all([
            fetch('/api/reporters'),
            fetch('/api/news/sync'),
            fetch('/api/live-tv'),
            fetch('/api/tv-submissions'),
            fetch('/api/ads/sync'),
            fetch('/api/payouts/sync'),
          ]);

        if (reportersResp.ok) {
          const data = (await reportersResp.json()) as {
            synced?: boolean;
            reporters?: ReporterAccount[];
          };
          if (active && data.synced && Array.isArray(data.reporters) && data.reporters.length > 0) {
            setPortalReporters((prev) => {
              const merged = new Map<string, ReporterAccount>();
              for (const r of prev) {
                const dist3 = (r.district3 || deriveDistrictCode3(String(r.district))).toUpperCase();
                merged.set(`${dist3}:${r.name3}:${r.birthYear}`, r);
              }
              for (const r of data.reporters!) {
                const dist3 = (r.district3 || deriveDistrictCode3(String(r.district))).toUpperCase();
                const key = `${dist3}:${r.name3}:${r.birthYear}`;
                const existing = merged.get(key);
                merged.set(key, {
                  ...r,
                  approvedCount: Math.max(r.approvedCount || 0, existing?.approvedCount || 0),
                  ...(typeof r.perNewsRate === 'number'
                    ? { perNewsRate: r.perNewsRate }
                    : typeof existing?.perNewsRate === 'number'
                    ? { perNewsRate: existing.perNewsRate }
                    : {}),
                });
              }
              const next = Array.from(merged.values());
              savePortalReporters(next);
              return next;
            });
          }
        }

        if (newsResp.ok) {
          const newsData = (await newsResp.json()) as {
            synced?: boolean;
            pendingNews?: Array<{
              id: string;
              title: string;
              headline?: string;
              district: string;
              script: string;
              reporterName: string;
              reporterId?: string;
              ward?: string;
              category?: NewsReel['category'];
              scope?: NewsScope;
              imageUrl?: string;
              videoUrl?: string;
              hasOriginalAudio?: boolean;
              isBreaking?: boolean;
              submittedAt?: string;
            }>;
            liveNews?: Array<{
              id: string;
              title: string;
              headline?: string;
              district: string;
              script: string;
              ward?: string;
              category?: NewsReel['category'];
              scope?: NewsScope;
              reporterName?: string;
              reporterId?: string;
              imageUrl?: string;
              videoUrl?: string;
              hasOriginalAudio?: boolean;
              isBreaking?: boolean;
            }>;
          };

          if (active && newsData.synced) {
            if (Array.isArray(newsData.pendingNews) && newsData.pendingNews.length > 0) {
              setPortalSubmissions((prev) => {
                const merged = new Map<string, SubmittedStory>();
                for (const s of prev) {
                  merged.set(s.id, s);
                }
                for (const remote of newsData.pendingNews!) {
                  if (!merged.has(remote.id)) {
                    merged.set(remote.id, {
                      id: remote.id,
                      reporterId: remote.reporterId || 'REP-FIELD',
                      reporterName: remote.reporterName,
                      district: remote.district,
                      ward: remote.ward || 'District Headquarters',
                      category: remote.category || 'Breaking',
                      scope: remote.scope || 'local',
                      headline: remote.headline || remote.title,
                      script: remote.script,
                      imageUrl: remote.imageUrl || '/src/assets/images/reel_muzaffarpur_bridge_1795283609462.jpg',
                      videoUrl: remote.videoUrl,
                      hasOriginalAudio: Boolean(remote.hasOriginalAudio),
                      status: 'pending',
                      isBreaking: Boolean(remote.isBreaking),
                      submittedAt: remote.submittedAt || new Date().toISOString(),
                    });
                  }
                }
                const next = Array.from(merged.values());
                savePortalSubmissions(next);
                return next;
              });
            }

            if (Array.isArray(newsData.liveNews) && newsData.liveNews.length > 0) {
              const remoteReels = mapRemoteLiveNewsToReels(
                newsData.liveNews,
                deletedReelIdsRef.current,
                breakingOverridesRef.current
              );

              setApprovedPortalReels((prev) => {
                const merged = new Map<string, NewsReel>();
                for (const r of prev) merged.set(r.id, r);
                for (const r of remoteReels) merged.set(r.id, r);
                const next = Array.from(merged.values());
                saveApprovedPortalReels(next);
                return next;
              });

              setReels((prev) => {
                const existingIds = new Set(prev.map((r) => r.id));
                const existingKeys = new Set(prev.map((r) => getReelDedupeKey(r)));
                const additions = remoteReels.filter(
                  (r) => !existingIds.has(r.id) && !existingKeys.has(getReelDedupeKey(r))
                );
                return additions.length > 0 ? [...additions, ...prev] : prev;
              });
            }
          }
        }

        if (liveTvResp.ok) {
          const tvData = (await liveTvResp.json()) as {
            synced?: boolean;
            channels?: LiveTvChannel[];
          };
          if (active && tvData.synced && Array.isArray(tvData.channels)) {
            setCustomLiveTvChannels((prev) => {
              const merged = new Map<string, LiveTvChannel>();
              for (const ch of prev) merged.set(ch.id, ch);
              for (const ch of tvData.channels!) merged.set(ch.id, { ...ch, isCustom: true });
              const next = Array.from(merged.values());
              saveLiveTvChannels(next);
              return next;
            });
          }
        }

        if (tvSubResp.ok) {
          const tvSubData = (await tvSubResp.json()) as {
            synced?: boolean;
            submissions?: PendingTvChannelSubmission[];
          };
          if (active && tvSubData.synced && Array.isArray(tvSubData.submissions)) {
            setPendingTvSubmissions(tvSubData.submissions);
            savePendingTvChannels(tvSubData.submissions);
          }
        }

        if (adsResp.ok) {
          const adsData = (await adsResp.json()) as {
            synced?: boolean;
            localAds?: LocalAd[];
            adNetworkConfig?: AdNetworkConfig | null;
          };
          if (active && adsData.synced) {
            if (Array.isArray(adsData.localAds) && adsData.localAds.length > 0) {
              setLocalAds((prev) => {
                const merged = new Map<string, LocalAd>();
                for (const ad of prev) merged.set(ad.id, ad);
                for (const ad of adsData.localAds!) merged.set(ad.id, ad);
                const next = Array.from(merged.values());
                saveLocalAds(next);
                return next;
              });
            }
            if (adsData.adNetworkConfig) {
              setAdNetworkConfig(adsData.adNetworkConfig);
              saveAdNetworkConfig(adsData.adNetworkConfig);
            }
          }
        }

        if (payoutsResp.ok) {
          const payoutsData = (await payoutsResp.json()) as {
            synced?: boolean;
            defaultNewsRate?: number | null;
            payoutRequests?: PayoutRequest[];
          };
          if (active && payoutsData.synced) {
            if (
              typeof payoutsData.defaultNewsRate === 'number' &&
              Number.isFinite(payoutsData.defaultNewsRate)
            ) {
              setDefaultNewsRate(payoutsData.defaultNewsRate);
              saveDefaultNewsRate(payoutsData.defaultNewsRate);
            }
            if (Array.isArray(payoutsData.payoutRequests)) {
              setPayoutRequests((prev) => {
                const merged = new Map<string, PayoutRequest>();
                for (const p of prev) merged.set(p.id, p);
                for (const remote of payoutsData.payoutRequests!) {
                  const local = merged.get(remote.id);
                  merged.set(remote.id, {
                    ...remote,
                    status:
                      remote.status === 'paid' || local?.status === 'paid' ? 'paid' : 'pending',
                    paidAt: remote.paidAt || local?.paidAt,
                  });
                }
                const next = Array.from(merged.values()).sort(
                  (a, b) =>
                    new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
                );
                savePayoutRequests(next);
                return next;
              });
            }
          }
        }
      } catch {
        // Offline / localStorage-only mode
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Portal Auth, Story Submission & Chief Editor Moderation Handlers
  const handlePortalLoginReporter = useCallback(
    (districtLoginId: string, loginPassword: string): { ok: boolean; error?: string } => {
      const cleanDist3 = districtLoginId
        .replace(/[^a-zA-Z]/g, '')
        .slice(0, 3)
        .toUpperCase();
      const cleanPass = loginPassword
        .replace(/[^a-zA-Z0-9]/g, '')
        .trim()
        .toUpperCase();

      if (cleanDist3.length !== 3) {
        return {
          ok: false,
          error: 'Enter Login ID: first 3 letters of your District (e.g. MUZ for Muzaffarpur).',
        };
      }
      if (!/^[A-Z]{3}\d{4}$/.test(cleanPass)) {
        return {
          ok: false,
          error: 'Enter Login Password: first 3 letters of your Name + 4-digit Birth Year (e.g. RAH1998).',
        };
      }

      const enteredName3 = cleanPass.slice(0, 3);
      const enteredBirthYear = cleanPass.slice(3, 7);

      const matched = portalReporters.find((r) => {
        const repDist3 = (r.district3 || deriveDistrictCode3(String(r.district)))
          .trim()
          .toUpperCase();
        return (
          repDist3 === cleanDist3 &&
          r.name3.trim().toUpperCase() === enteredName3 &&
          r.birthYear.trim() === enteredBirthYear
        );
      });

      if (!matched) {
        return {
          ok: false,
          error: `No reporter found for District ID "${cleanDist3}" and Password "${cleanPass}".`,
        };
      }
      if (matched.status === 'pending') {
        return {
          ok: false,
          error: 'Account pending Chief Editor approval.',
        };
      }
      if (matched.status === 'suspended') {
        return { ok: false, error: 'This reporter account has been suspended by Chief Editor.' };
      }
      const nextSession: PortalSession = { role: 'reporter', reporterId: matched.id };
      setPortalSession(nextSession);
      savePortalSession(nextSession);
      return { ok: true };
    },
    [portalReporters]
  );

  const handlePortalRegisterReporter = useCallback(
    (payload: {
      name: string;
      district: Exclude<DistrictId, 'All'>;
      birthYear: string;
    }): { ok: boolean; error?: string; district3?: string; loginPassword?: string } => {
      const cleanName = payload.name.trim();
      const cleanName3 = deriveReporterName3(cleanName);
      const cleanDist3 = deriveDistrictCode3(String(payload.district));
      const cleanYear = payload.birthYear.trim();
      const yearNum = Number(cleanYear);

      if (!cleanName || cleanName3.length < 3) {
        return {
          ok: false,
          error: 'Full Name must contain at least 3 English letters (A–Z) for password generation.',
        };
      }
      if (!/^\d{4}$/.test(cleanYear) || yearNum < 1960 || yearNum > 2008) {
        return {
          ok: false,
          error: 'Enter a valid 4-digit Year of Birth between 1960 and 2008.',
        };
      }

      const loginPassword = `${cleanName3}${cleanYear}`;
      if (
        portalReporters.some((r) => {
          const repDist3 = (r.district3 || deriveDistrictCode3(String(r.district))).toUpperCase();
          return (
            repDist3 === cleanDist3 &&
            r.name3.toUpperCase() === cleanName3 &&
            r.birthYear.trim() === cleanYear
          );
        })
      ) {
        return {
          ok: false,
          error: `Reporter with Login ID ${cleanDist3} and Password ${loginPassword} already exists.`,
        };
      }

      const nextAccount: ReporterAccount = {
        id: `REP-${cleanDist3}-${loginPassword}`,
        name: cleanName,
        name3: cleanName3,
        birthYear: cleanYear,
        district3: cleanDist3,
        district: payload.district,
        status: 'pending',
        createdAt: new Date().toISOString(),
        approvedCount: 0,
      };
      const updated = [nextAccount, ...portalReporters];
      setPortalReporters(updated);
      savePortalReporters(updated);

      void fetch('/api/reporters/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          district: payload.district,
          birthYear: cleanYear,
        }),
      }).catch(() => {});

      return { ok: true, district3: cleanDist3, loginPassword };
    },
    [portalReporters]
  );

  const handlePortalSetupAdmin = useCallback(
    async (
      adminId: string,
      password: string
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        const resp = await fetch('/api/admin/auth/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminId, password }),
        });
        const data = (await resp.json()) as {
          ok?: boolean;
          adminId?: string;
          token?: string;
          error?: string;
          configured?: boolean;
          envOverride?: boolean;
        };
        if (!resp.ok || !data.ok || !data.token || !data.adminId) {
          void refreshAdminAuthStatus();
          return { ok: false, error: data.error || 'Failed to initialize Chief Editor credentials.' };
        }
        setAdminToken(data.token);
        setAdminAuthStatus({
          configured: true,
          envOverride: Boolean(data.envOverride),
          lockedUntilMs: 0,
          failedAttempts: 0,
          maxAttempts: 3,
        });
        setPortalSession({ role: 'admin', adminId: data.adminId });
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error while initializing Chief Editor credentials.' };
      }
    },
    [refreshAdminAuthStatus]
  );

  const handlePortalLoginAdmin = useCallback(
    async (
      adminId: string,
      password: string
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        const resp = await fetch('/api/admin/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminId, password }),
        });
        const data = (await resp.json()) as {
          ok?: boolean;
          adminId?: string;
          token?: string;
          error?: string;
          configured?: boolean;
          lockedUntilMs?: number;
          failedAttempts?: number;
          maxAttempts?: number;
        };
        if (!resp.ok || !data.ok || !data.token || !data.adminId) {
          setAdminAuthStatus((prev) => ({
            configured: data.configured !== undefined ? data.configured : prev?.configured ?? true,
            envOverride: prev?.envOverride ?? false,
            lockedUntilMs: typeof data.lockedUntilMs === 'number' ? data.lockedUntilMs : 0,
            failedAttempts:
              typeof data.failedAttempts === 'number'
                ? data.failedAttempts
                : prev?.failedAttempts ?? 0,
            maxAttempts: typeof data.maxAttempts === 'number' ? data.maxAttempts : 3,
          }));
          return { ok: false, error: data.error || 'Invalid Unique Admin ID or Password.' };
        }
        setAdminToken(data.token);
        setAdminAuthStatus((prev) => ({
          configured: true,
          envOverride: prev?.envOverride ?? false,
          lockedUntilMs: 0,
          failedAttempts: 0,
          maxAttempts: typeof data.maxAttempts === 'number' ? data.maxAttempts : 3,
        }));
        setPortalSession({ role: 'admin', adminId: data.adminId });
        return { ok: true };
      } catch {
        return { ok: false, error: 'Unable to reach Chief Editor authentication server.' };
      }
    },
    []
  );

  const handlePortalChangeAdminCredentials = useCallback(
    async (
      currentPassword: string,
      newAdminId: string,
      newPassword: string
    ): Promise<{ ok: boolean; error?: string; adminId?: string }> => {
      if (!adminToken) {
        return { ok: false, error: 'Admin session expired. Please log in again.' };
      }
      try {
        const resp = await fetch('/api/admin/auth/change-credentials', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ currentPassword, newAdminId, newPassword }),
        });
        const data = (await resp.json()) as {
          ok?: boolean;
          adminId?: string;
          token?: string;
          error?: string;
        };
        if (!resp.ok || !data.ok || !data.token || !data.adminId) {
          if (resp.status === 401 && /expired|unauthorized/i.test(data.error || '')) {
            setAdminToken(null);
            setPortalSession(null);
          }
          return { ok: false, error: data.error || 'Failed to update Admin credentials.' };
        }
        setAdminToken(data.token);
        setPortalSession({ role: 'admin', adminId: data.adminId });
        return { ok: true, adminId: data.adminId };
      } catch {
        return { ok: false, error: 'Network error while updating Admin credentials.' };
      }
    },
    [adminToken]
  );

  const handlePortalLogout = useCallback(() => {
    stopCustomTest();
    setAdminToken(null);
    setPortalSession(null);
    savePortalSession(null);
  }, [stopCustomTest]);

  const handlePortalSubmitStory = useCallback(
    (payload: {
      headline: string;
      script: string;
      category: NewsReel['category'];
      scope: NewsScope;
      ward: string;
      imageUrl: string;
      videoUrl?: string;
      hasOriginalAudio: boolean;
    }) => {
      if (portalSession?.role !== 'reporter') return;
      const reporter = portalReporters.find(
        (r) => r.id.toLowerCase() === portalSession.reporterId.toLowerCase()
      );
      if (!reporter) return;

      const story: SubmittedStory = {
        id: `sub-${Date.now()}`,
        reporterId: reporter.id,
        reporterName: reporter.name,
        district: reporter.district,
        ward: payload.ward,
        category: payload.category,
        scope: payload.scope,
        headline: payload.headline,
        script: payload.script,
        imageUrl: payload.imageUrl,
        videoUrl: payload.videoUrl,
        hasOriginalAudio: payload.hasOriginalAudio,
        status: 'pending',
        isBreaking: payload.category === 'Breaking',
        submittedAt: new Date().toISOString(),
      };
      const updated = [story, ...portalSubmissions];
      setPortalSubmissions(updated);
      savePortalSubmissions(updated);

      void fetch('/api/news/pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: story.id,
          title: story.headline,
          district: story.district,
          script: story.script,
          reporterName: story.reporterName,
          reporterId: story.reporterId,
          ward: story.ward,
          category: story.category,
          scope: story.scope,
          imageUrl: story.imageUrl,
          videoUrl: story.videoUrl,
          hasOriginalAudio: story.hasOriginalAudio,
          isBreaking: story.isBreaking,
          submittedAt: story.submittedAt,
        }),
      }).catch(() => {});
    },
    [portalSession, portalReporters, portalSubmissions]
  );

  const handlePortalApproveStory = useCallback(
    (
      storyId: string,
      edits: { headline: string; script: string; isBreaking: boolean; scope: NewsScope }
    ) => {
      const target = portalSubmissions.find((s) => s.id === storyId);
      if (!target) return;

      const resolvedScope: NewsScope = edits.scope || target.scope || 'local';
      const scriptLines = edits.script
        .split(/\n+|(?<=[.।!?])\s+/)
        .map((l) => l.trim())
        .filter(Boolean);
      const line2 =
        scriptLines[0] || `Live verified report from ${target.ward}, ${target.district}.`;
      const line3 =
        scriptLines[1] || `Filed by verified district reporter (${target.reporterId}).`;

      const publishedReel = buildCitizenReel({
        district: target.district,
        ward: target.ward,
        category: target.category,
        scope: resolvedScope,
        hasOriginalAudio: target.hasOriginalAudio && Boolean(target.videoUrl),
        line1: edits.headline,
        line2,
        line3,
        script: edits.script,
        imageUrl: target.imageUrl,
        videoUrl: target.videoUrl,
        reporterName: target.reporterName,
        reporterId: target.reporterId,
        isBreaking: edits.isBreaking,
        isLiveFeed: true,
        isVerifiedReporter: true,
      });

      const nextApprovedReels = [publishedReel, ...approvedPortalReels];
      setApprovedPortalReels(nextApprovedReels);
      saveApprovedPortalReels(nextApprovedReels);
      setReels((prev) => [publishedReel, ...prev]);

      const targetReporter = portalReporters.find(
        (r) => r.id.toLowerCase() === target.reporterId.toLowerCase()
      );
      const lockedRate = getEffectiveReporterRate(targetReporter, defaultNewsRate);

      const nextSubmissions = portalSubmissions.map((s) =>
        s.id === storyId
          ? {
              ...s,
              headline: edits.headline,
              script: edits.script,
              isBreaking: edits.isBreaking,
              scope: resolvedScope,
              factChecked: true,
              earnedAmount: lockedRate,
              status: 'approved' as const,
              reviewedAt: new Date().toISOString(),
              publishedReelId: publishedReel.id,
            }
          : s
      );
      setPortalSubmissions(nextSubmissions);
      savePortalSubmissions(nextSubmissions);

      const nextReporters = portalReporters.map((r) =>
        r.id.toLowerCase() === target.reporterId.toLowerCase()
          ? { ...r, approvedCount: r.approvedCount + 1 }
          : r
      );
      setPortalReporters(nextReporters);
      savePortalReporters(nextReporters);

      if (adminToken) {
        void fetch('/api/news/approve', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            pendingStoryId: target.id,
            id: publishedReel.id,
            title: edits.headline,
            district: target.district,
            script: edits.script,
            ward: target.ward,
            category: target.category,
            scope: resolvedScope,
            reporterName: target.reporterName,
            reporterId: target.reporterId,
            imageUrl: target.imageUrl,
            videoUrl: target.videoUrl,
            hasOriginalAudio: target.hasOriginalAudio,
            isBreaking: edits.isBreaking,
            earnedAmount: lockedRate,
            publishedAt: new Date().toISOString(),
          }),
        }).catch(() => {});
      }

      // Pre-generate Gemini TTS narration once upon Admin approval and persist to IndexedDB
      void pregenerateGeminiReelAudio({
        newsId: publishedReel.id,
        language,
        voiceName: voiceConfig.geminiVoice || 'Kore',
        headline: publishedReel.headline[language] || publishedReel.headline.hi,
        subtitles: publishedReel.subtitles,
      });
    },
    [
      portalSubmissions,
      approvedPortalReels,
      portalReporters,
      defaultNewsRate,
      adminToken,
      language,
      voiceConfig.geminiVoice,
    ]
  );

  const handlePublishQuickReel = useCallback(
    (payload: {
      scope: NewsScope;
      district: string;
      category: NewsReel['category'];
      ward: string;
      headline: string;
      script: string;
      isBreaking: boolean;
    }) => {
      const scriptLines = payload.script
        .split(/\n+|(?<=[.।!?])\s+/)
        .map((l) => l.trim())
        .filter(Boolean);
      const line2 = scriptLines[0] || payload.script;
      const line3 = scriptLines[1] || 'Chief Editor Verified Newsroom Bulletin.';

      const publishedReel = buildCitizenReel({
        district: payload.district,
        ward: payload.ward,
        category: payload.category,
        scope: payload.scope,
        hasOriginalAudio: false,
        line1: payload.headline,
        line2,
        line3,
        script: payload.script,
        imageUrl: '/src/assets/images/reel_muzaffarpur_bridge_1795283609462.jpg',
        videoUrl: '/videos/reel_muzaffarpur.mp4',
        reporterName: 'Chief Editor Desk',
        reporterId: portalSession?.role === 'admin' ? portalSession.adminId : 'CHIEF-EDITOR',
        isBreaking: payload.isBreaking,
        isLiveFeed: true,
        isVerifiedReporter: true,
      });

      const nextApproved = [publishedReel, ...approvedPortalReels];
      setApprovedPortalReels(nextApproved);
      saveApprovedPortalReels(nextApproved);
      setReels((prev) => [publishedReel, ...prev]);

      if (adminToken) {
        void fetch('/api/news/approve', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            id: publishedReel.id,
            title: payload.headline,
            district: payload.district,
            script: payload.script,
            ward: payload.ward,
            category: payload.category,
            scope: payload.scope,
            reporterName: 'Chief Editor Desk',
            reporterId: portalSession?.role === 'admin' ? portalSession.adminId : 'CHIEF-EDITOR',
            imageUrl: publishedReel.imageUrl,
            videoUrl: publishedReel.videoUrl,
            hasOriginalAudio: false,
            isBreaking: payload.isBreaking,
            publishedAt: new Date().toISOString(),
          }),
        }).catch(() => {});
      }

      // Pre-generate Gemini TTS narration once upon Admin publishing live
      void pregenerateGeminiReelAudio({
        newsId: publishedReel.id,
        language,
        voiceName: voiceConfig.geminiVoice || 'Kore',
        headline: publishedReel.headline[language] || publishedReel.headline.hi,
        subtitles: publishedReel.subtitles,
      });
    },
    [adminToken, approvedPortalReels, language, portalSession, voiceConfig.geminiVoice]
  );

  const handlePortalRejectStory = useCallback(
    (storyId: string, reason: string) => {
      const nextSubmissions = portalSubmissions.map((s) =>
        s.id === storyId
          ? {
              ...s,
              status: 'rejected' as const,
              rejectionReason: reason,
              reviewedAt: new Date().toISOString(),
            }
          : s
      );
      setPortalSubmissions(nextSubmissions);
      savePortalSubmissions(nextSubmissions);

      if (adminToken) {
        void fetch(`/api/news/pending/${encodeURIComponent(storyId)}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }).catch(() => {});
      }
    },
    [portalSubmissions, adminToken]
  );

  const handlePortalToggleReelBreaking = useCallback(
    (reelId: string) => {
      const target = reels.find((r) => r.id === reelId);
      if (!target) return;
      const nextBreaking = !target.isBreaking;

      const nextOverrides = { ...breakingOverrides, [reelId]: nextBreaking };
      setBreakingOverrides(nextOverrides);
      saveBreakingOverrides(nextOverrides);

      const nextApproved = approvedPortalReels.map((r) =>
        r.id === reelId ? { ...r, isBreaking: nextBreaking } : r
      );
      setApprovedPortalReels(nextApproved);
      saveApprovedPortalReels(nextApproved);

      setReels((prev) =>
        prev.map((r) => (r.id === reelId ? { ...r, isBreaking: nextBreaking } : r))
      );
    },
    [reels, breakingOverrides, approvedPortalReels]
  );

  const handlePortalDeleteReel = useCallback(
    (reelId: string) => {
      const nextDeleted = deletedReelIds.includes(reelId)
        ? deletedReelIds
        : [...deletedReelIds, reelId];
      setDeletedReelIds(nextDeleted);
      saveDeletedReelIds(nextDeleted);

      const nextApproved = approvedPortalReels.filter((r) => r.id !== reelId);
      setApprovedPortalReels(nextApproved);
      saveApprovedPortalReels(nextApproved);

      setReels((prev) => prev.filter((r) => r.id !== reelId));
    },
    [deletedReelIds, approvedPortalReels]
  );

  const handlePortalUpdateReporterStatus = useCallback(
    (reporterId: string, status: ReporterStatus) => {
      const targetReporter = portalReporters.find(
        (r) => r.id.toLowerCase() === reporterId.toLowerCase()
      );
      const nextReporters = portalReporters.map((r) =>
        r.id.toLowerCase() === reporterId.toLowerCase() ? { ...r, status } : r
      );
      setPortalReporters(nextReporters);
      savePortalReporters(nextReporters);

      if (adminToken) {
        void fetch(`/api/reporters/${encodeURIComponent(reporterId)}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ status, reporter: targetReporter }),
        }).catch(() => {});
      }
    },
    [portalReporters, adminToken]
  );

  const handleWatchDistrictFromPortal = useCallback(
    (district: DistrictId) => {
      handleSelectDistrict(district);
      setActiveTab('feed');
    },
    [handleSelectDistrict]
  );

  const handleSelectTab = useCallback(
    (nextTab: NavTab) => {
      if (nextTab !== 'feed') {
        clearBulletinTimeout();
        stopSpeech();
        stopCustomTest();
        studioAudioBed.fadeOut();
        setIsPlaying(false);
        if (feedContainerRef.current) {
          feedContainerRef.current.querySelectorAll('video').forEach((v) => {
            v.pause();
          });
        }
      } else {
        setIsPlaying(true);
      }
      setActiveTab(nextTab);
    },
    [clearBulletinTimeout, stopCustomTest, stopSpeech]
  );

  const handleAddLiveTvChannel = useCallback(
    async (payload: {
      name: string;
      category: LiveTvCategory;
      district?: string;
      type?: LiveTvStreamType;
      youtubeChannelId?: string;
      streamUrl: string;
      backupStreamUrl?: string;
      backupType?: LiveTvStreamType;
      watchUrl: string;
    }): Promise<{ ok: boolean; error?: string }> => {
      const targetDistrict =
        payload.district ||
        (payload.category === 'local'
          ? 'ALL_BIHAR'
          : payload.category === 'national'
          ? 'NATIONAL'
          : 'INTERNATIONAL');
      const localChannel: LiveTvChannel = {
        id: `tv-custom-${Date.now()}`,
        name: payload.name,
        category: payload.category,
        district: targetDistrict,
        type:
          payload.type ||
          (/\.m3u8(\?.*)?$/i.test(payload.streamUrl) ? 'hls' : 'youtube'),
        regionLabel:
          payload.category === 'local'
            ? targetDistrict === 'ALL_BIHAR'
              ? 'Bihar Regional Desk'
              : `${targetDistrict} Local Cable & Web TV`
            : payload.category === 'national'
            ? 'India 24x7'
            : 'Global News',
        languageLabel: payload.category === 'international' ? 'English' : 'Hindi',
        youtubeChannelId: payload.youtubeChannelId,
        streamUrl: payload.streamUrl,
        ...(payload.backupStreamUrl
          ? {
              backupStreamUrl: payload.backupStreamUrl,
              backupType:
                payload.backupType ||
                (/\.m3u8(\?.*)?$/i.test(payload.backupStreamUrl) ? 'hls' : 'youtube'),
            }
          : {}),
        watchUrl: payload.watchUrl,
        isCustom: true,
        addedAt: new Date().toISOString(),
      };

      if (adminToken) {
        try {
          const resp = await fetch('/api/live-tv', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify(localChannel),
          });
          const data = (await resp.json()) as {
            ok?: boolean;
            channel?: LiveTvChannel;
            error?: string;
          };
          if (!resp.ok) {
            return { ok: false, error: data.error || 'Failed to publish Live TV channel.' };
          }
          const saved = data.channel ? { ...data.channel, isCustom: true } : localChannel;
          setCustomLiveTvChannels((prev) => {
            const next = [saved, ...prev];
            saveLiveTvChannels(next);
            return next;
          });
          return { ok: true };
        } catch {
          return { ok: false, error: 'Network error while saving Live TV channel.' };
        }
      }

      setCustomLiveTvChannels((prev) => {
        const next = [localChannel, ...prev];
        saveLiveTvChannels(next);
        return next;
      });
      return { ok: true };
    },
    [adminToken]
  );

  const handleDeleteLiveTvChannel = useCallback(
    async (channelId: string, district?: string) => {
      setCustomLiveTvChannels((prev) => {
        const next = prev.filter((c) => c.id !== channelId);
        saveLiveTvChannels(next);
        return next;
      });

      if (adminToken) {
        const qs = district ? `?district=${encodeURIComponent(district)}` : '';
        void fetch(`/api/live-tv/${encodeURIComponent(channelId)}${qs}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }).catch(() => {});
      }
    },
    [adminToken]
  );

  const handleSubmitTvChannel = useCallback(
    async (payload: {
      name: string;
      category: LiveTvCategory;
      district: string;
      type?: LiveTvStreamType;
      youtubeChannelId?: string;
      streamUrl: string;
      backupStreamUrl?: string;
      backupType?: LiveTvStreamType;
      watchUrl: string;
    }): Promise<{ ok: boolean; error?: string }> => {
      const activeRep =
        portalSession?.role === 'reporter'
          ? portalReporters.find(
              (r) => r.id.toLowerCase() === portalSession.reporterId.toLowerCase()
            )
          : null;
      const reporterName = activeRep?.name || 'District Reporter';
      const reporterId = activeRep?.id || 'REP-FIELD';

      const submission: PendingTvChannelSubmission = {
        id: `tvsub-${Date.now()}`,
        name: payload.name,
        category: payload.category,
        district: payload.district,
        type:
          payload.type ||
          (/\.m3u8(\?.*)?$/i.test(payload.streamUrl) ? 'hls' : 'youtube'),
        regionLabel: `${payload.district} Local Cable & Web TV`,
        languageLabel: payload.category === 'international' ? 'English' : 'Hindi',
        youtubeChannelId: payload.youtubeChannelId,
        streamUrl: payload.streamUrl,
        watchUrl: payload.watchUrl,
        reporterId,
        reporterName,
        status: 'pending',
        submittedAt: new Date().toISOString(),
      };

      setPendingTvSubmissions((prev) => {
        const next = [submission, ...prev];
        savePendingTvChannels(next);
        return next;
      });

      try {
        await fetch('/api/tv-submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submission),
        });
      } catch {
        // Offline / localStorage fallback already persisted
      }
      return { ok: true };
    },
    [portalReporters, portalSession]
  );

  const handleApproveTvSubmission = useCallback(
    async (sub: PendingTvChannelSubmission) => {
      setPendingTvSubmissions((prev) => {
        const next = prev.filter((item) => item.id !== sub.id);
        savePendingTvChannels(next);
        return next;
      });

      const approvedChannel: LiveTvChannel = {
        id: `tv-${sub.district.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
        name: sub.name,
        category: sub.category,
        district: sub.district,
        type: sub.type,
        regionLabel: `${sub.district} Local Cable & Web TV`,
        languageLabel: 'Hindi',
        youtubeChannelId: sub.youtubeChannelId,
        streamUrl: sub.streamUrl,
        watchUrl: sub.watchUrl,
        isCustom: true,
        addedAt: new Date().toISOString(),
      };

      setCustomLiveTvChannels((prev) => {
        const next = [approvedChannel, ...prev];
        saveLiveTvChannels(next);
        return next;
      });

      if (adminToken) {
        try {
          await fetch(`/api/tv-submissions/${encodeURIComponent(sub.id)}/approve`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify(sub),
          });
        } catch {
          // Best-effort sync
        }
      }
    },
    [adminToken]
  );

  const handleRejectTvSubmission = useCallback(
    async (subId: string) => {
      setPendingTvSubmissions((prev) => {
        const next = prev.filter((item) => item.id !== subId);
        savePendingTvChannels(next);
        return next;
      });

      if (adminToken) {
        void fetch(`/api/tv-submissions/${encodeURIComponent(subId)}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }).catch(() => {});
      }
    },
    [adminToken]
  );

  const handleAddLocalAd = useCallback(
    async (payload: {
      district: string;
      format: AdFormat;
      businessName: string;
      tagline: string;
      mediaUrl: string;
      mediaType: 'image' | 'video';
      phone: string;
      whatsapp: string;
    }): Promise<{ ok: boolean; error?: string }> => {
      const draftAd: LocalAd = {
        id: `ad-${Date.now()}`,
        district: payload.district,
        format: payload.format,
        businessName: payload.businessName,
        tagline: payload.tagline,
        mediaUrl: payload.mediaUrl,
        mediaType: payload.mediaType,
        phone: payload.phone,
        whatsapp: payload.whatsapp,
        active: true,
        impressions: 0,
        clicks: 0,
        createdAt: new Date().toISOString(),
      };

      if (adminToken) {
        try {
          const resp = await fetch('/api/ads/local', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify(draftAd),
          });
          const data = (await resp.json()) as { ok?: boolean; ad?: LocalAd; error?: string };
          if (!resp.ok) {
            return { ok: false, error: data.error || 'Failed to publish local sponsor ad.' };
          }
          const saved = data.ad || draftAd;
          setLocalAds((prev) => {
            const next = [saved, ...prev];
            saveLocalAds(next);
            return next;
          });
          return { ok: true };
        } catch {
          return { ok: false, error: 'Network error while publishing local sponsor ad.' };
        }
      }

      setLocalAds((prev) => {
        const next = [draftAd, ...prev];
        saveLocalAds(next);
        return next;
      });
      return { ok: true };
    },
    [adminToken]
  );

  const handleToggleLocalAd = useCallback(
    async (ad: LocalAd) => {
      const nextActive = !ad.active;
      setLocalAds((prev) => {
        const next = prev.map((item) =>
          item.id === ad.id ? { ...item, active: nextActive } : item
        );
        saveLocalAds(next);
        return next;
      });

      if (adminToken) {
        void fetch(
          `/api/ads/local/${encodeURIComponent(ad.district)}/${encodeURIComponent(ad.id)}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({ active: nextActive, ad }),
          }
        ).catch(() => {});
      }
    },
    [adminToken]
  );

  const handleDeleteLocalAd = useCallback(
    async (ad: LocalAd) => {
      setLocalAds((prev) => {
        const next = prev.filter((item) => item.id !== ad.id);
        saveLocalAds(next);
        return next;
      });

      if (adminToken) {
        void fetch(
          `/api/ads/local/${encodeURIComponent(ad.district)}/${encodeURIComponent(ad.id)}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${adminToken}`,
            },
          }
        ).catch(() => {});
      }
    },
    [adminToken]
  );

  const handleSaveAdNetworkConfig = useCallback(
    async (config: AdNetworkConfig): Promise<{ ok: boolean; error?: string }> => {
      const normalized: AdNetworkConfig = {
        ...config,
        updatedAt: new Date().toISOString(),
      };
      if (adminToken) {
        try {
          const resp = await fetch('/api/ads/config', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify(normalized),
          });
          const data = (await resp.json()) as {
            ok?: boolean;
            adNetworkConfig?: AdNetworkConfig;
            error?: string;
          };
          if (!resp.ok) {
            return { ok: false, error: data.error || 'Failed to save Google Ad Network config.' };
          }
          const saved = data.adNetworkConfig || normalized;
          setAdNetworkConfig(saved);
          saveAdNetworkConfig(saved);
          return { ok: true };
        } catch {
          return { ok: false, error: 'Network error while saving Google Ad Network config.' };
        }
      }

      setAdNetworkConfig(normalized);
      saveAdNetworkConfig(normalized);
      return { ok: true };
    },
    [adminToken]
  );

  const handleSaveDefaultNewsRate = useCallback(
    async (rate: number): Promise<{ ok: boolean; error?: string }> => {
      if (!Number.isFinite(rate) || rate < 0 || rate > 50000) {
        return { ok: false, error: 'Default per-news rate must be between ₹0 and ₹50,000.' };
      }
      const cleanRate = Math.round(rate);

      if (adminToken) {
        try {
          const resp = await fetch('/api/settings/default-news-rate', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({ defaultNewsRate: cleanRate }),
          });
          const data = (await resp.json()) as {
            ok?: boolean;
            defaultNewsRate?: number;
            error?: string;
          };
          if (!resp.ok) {
            return { ok: false, error: data.error || 'Failed to save default per-news rate.' };
          }
          const savedRate =
            typeof data.defaultNewsRate === 'number' ? data.defaultNewsRate : cleanRate;
          setDefaultNewsRate(savedRate);
          saveDefaultNewsRate(savedRate);
          return { ok: true };
        } catch {
          return { ok: false, error: 'Network error while saving default per-news rate.' };
        }
      }

      setDefaultNewsRate(cleanRate);
      saveDefaultNewsRate(cleanRate);
      return { ok: true };
    },
    [adminToken]
  );

  const handleUpdateReporterRate = useCallback(
    async (
      reporterId: string,
      perNewsRate: number | null
    ): Promise<{ ok: boolean; error?: string }> => {
      if (perNewsRate !== null && (!Number.isFinite(perNewsRate) || perNewsRate < 0 || perNewsRate > 50000)) {
        return { ok: false, error: 'Custom per-news rate must be between ₹0 and ₹50,000.' };
      }
      const cleanRate = perNewsRate === null ? null : Math.round(perNewsRate);
      const targetReporter = portalReporters.find(
        (r) => r.id.toLowerCase() === reporterId.toLowerCase()
      );

      if (adminToken) {
        try {
          const resp = await fetch(`/api/reporters/${encodeURIComponent(reporterId)}/rate`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({ perNewsRate: cleanRate, reporter: targetReporter }),
          });
          const data = (await resp.json()) as { ok?: boolean; error?: string };
          if (!resp.ok) {
            return { ok: false, error: data.error || 'Failed to update reporter payout rate.' };
          }
        } catch {
          return { ok: false, error: 'Network error while updating reporter payout rate.' };
        }
      }

      setPortalReporters((prev) => {
        const next = prev.map((r) => {
          if (r.id.toLowerCase() !== reporterId.toLowerCase()) return r;
          if (cleanRate === null) {
            const { perNewsRate: _removed, ...rest } = r;
            return rest;
          }
          return { ...r, perNewsRate: cleanRate };
        });
        savePortalReporters(next);
        return next;
      });
      return { ok: true };
    },
    [portalReporters, adminToken]
  );

  const handleRequestUpiPayout = useCallback(
    async (payload: {
      reporterId: string;
      reporterName: string;
      district: string;
      upiId: string;
      amount: number;
    }): Promise<{ ok: boolean; error?: string; payout?: PayoutRequest }> => {
      const cleanUpi = payload.upiId.trim();
      if (!/^[a-zA-Z0-9._-]{2,}@[a-zA-Z0-9]{2,}$/.test(cleanUpi)) {
        return { ok: false, error: 'Enter a valid UPI ID (e.g. rahul@upi or 98350xxxxx@ybl).' };
      }

      const targetReporter = portalReporters.find(
        (r) => r.id.toLowerCase() === payload.reporterId.toLowerCase()
      );
      const wallet = calculateReporterWallet(
        targetReporter,
        portalSubmissions,
        payoutRequests,
        defaultNewsRate
      );
      const cleanAmount = Math.round(payload.amount);

      if (!Number.isFinite(cleanAmount) || cleanAmount < 1) {
        return { ok: false, error: 'Enter a withdrawal amount of at least ₹1.' };
      }
      if (cleanAmount > wallet.withdrawableBalance) {
        return {
          ok: false,
          error:
            wallet.pendingPayoutAmount > 0
              ? `Max withdrawable right now is ₹${wallet.withdrawableBalance} (₹${wallet.pendingPayoutAmount} already pending admin payout).`
              : `Amount exceeds your available balance of ₹${wallet.availableBalance}.`,
        };
      }

      const draftPayout: PayoutRequest = {
        id: `pay-${Date.now()}`,
        reporterId: payload.reporterId,
        reporterName: payload.reporterName,
        district: payload.district,
        upiId: cleanUpi,
        amount: cleanAmount,
        status: 'pending',
        requestedAt: new Date().toISOString(),
      };

      setPayoutRequests((prev) => {
        const next = [draftPayout, ...prev];
        savePayoutRequests(next);
        return next;
      });

      try {
        await fetch('/api/payouts/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draftPayout),
        });
      } catch {
        // Offline / localStorage fallback remains saved
      }

      return { ok: true, payout: draftPayout };
    },
    [portalReporters, portalSubmissions, payoutRequests, defaultNewsRate]
  );

  const handleMarkPayoutPaid = useCallback(
    async (payoutId: string): Promise<{ ok: boolean; error?: string }> => {
      const targetPayout = payoutRequests.find((p) => p.id === payoutId);
      if (!targetPayout) {
        return { ok: false, error: 'Payout request not found.' };
      }
      const paidAt = new Date().toISOString();

      if (adminToken) {
        try {
          const resp = await fetch(`/api/payouts/${encodeURIComponent(payoutId)}/mark-paid`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({ payout: targetPayout }),
          });
          const data = (await resp.json()) as { ok?: boolean; error?: string };
          if (!resp.ok) {
            return { ok: false, error: data.error || 'Failed to mark payout as paid.' };
          }
        } catch {
          return { ok: false, error: 'Network error while updating payout status.' };
        }
      }

      setPayoutRequests((prev) => {
        const next = prev.map((p) =>
          p.id === payoutId ? { ...p, status: 'paid' as const, paidAt } : p
        );
        savePayoutRequests(next);
        return next;
      });
      return { ok: true };
    },
    [payoutRequests, adminToken]
  );

  const handleTrackAd = useCallback((ad: LocalAd, eventType: 'impression' | 'click') => {
    setLocalAds((prev) => {
      const next = prev.map((item) =>
        item.id === ad.id
          ? {
              ...item,
              impressions: eventType === 'impression' ? item.impressions + 1 : item.impressions,
              clicks: eventType === 'click' ? item.clicks + 1 : item.clicks,
            }
          : item
      );
      saveLocalAds(next);
      return next;
    });

    void fetch(
      `/api/ads/local/${encodeURIComponent(ad.district)}/${encodeURIComponent(ad.id)}/track`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType, ad }),
      }
    ).catch(() => {});
  }, []);

  const pendingPortalCount = useMemo(
    () => portalSubmissions.filter((s) => s.status === 'pending').length,
    [portalSubmissions]
  );

  const isStudioMode = ttsStatus !== 'error' && ttsStatus !== 'quota_limit';

  const handleTriggerManualGps = useCallback(() => {
    void handleDetectGps(false);
  }, [handleDetectGps]);

  const isGpsDetectedNewEmpty =
    gpsDetectedNewDistrict !== null &&
    gpsDetectedNewDistrict.id.toLowerCase() === String(selectedDistrict).toLowerCase();

  const activeDistrictState = useMemo(() => {
    if (isGpsDetectedNewEmpty && gpsDetectedNewDistrict) {
      return gpsDetectedNewDistrict.state;
    }
    return (
      districts.find((d) => d.id.toLowerCase() === String(selectedDistrict).toLowerCase())?.state ||
      ''
    );
  }, [districts, gpsDetectedNewDistrict, isGpsDetectedNewEmpty, selectedDistrict]);

  const nearbyStateDistrict = useMemo(() => {
    return (
      districts.find(
        (d) =>
          d.id.toLowerCase() !== String(selectedDistrict).toLowerCase() &&
          activeDistrictState.length > 0 &&
          d.state.toLowerCase() === activeDistrictState.toLowerCase() &&
          reels.some((r) => r.district.toLowerCase() === d.id.toLowerCase())
      ) ||
      districts.find(
        (d) =>
          d.id.toLowerCase() !== String(selectedDistrict).toLowerCase() &&
          reels.some((r) => r.district.toLowerCase() === d.id.toLowerCase())
      ) ||
      null
    );
  }, [activeDistrictState, districts, reels, selectedDistrict]);

  return (
    <div className="w-full max-w-full h-dvh max-h-dvh overflow-hidden bg-[#0A0B0E] text-[#F8F9FA]">
      <TopBar
        districts={districts}
        selectedDistrict={selectedDistrict}
        onSelectDistrict={handleSelectDistrict}
        onDetectGps={handleTriggerManualGps}
        isDetectingGps={isDetectingGps}
        language={language}
        onSelectLanguage={handleSelectLanguage}
        audioEnabled={audioEnabled}
        onToggleAudio={handleToggleAudio}
        onOpenVoiceSettings={handleOpenVoiceSettings}
        isStudioMode={isStudioMode}
        isDistrictPickerOpen={isDistrictPickerOpen}
        onOpenDistrictPicker={handleOpenDistrictPicker}
        onCloseDistrictPicker={handleCloseDistrictPicker}
      />

      {gpsToast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed ${
            activeTab === 'feed'
              ? 'top-[calc(max(12px,env(safe-area-inset-top))+118px)]'
              : 'top-[calc(max(12px,env(safe-area-inset-top))+46px)]'
          } left-1/2 -translate-x-1/2 z-[9998] pointer-events-none max-w-[calc(100vw-24px)] px-3 py-1.5 rounded-full border backdrop-blur-md shadow-xl text-[11px] sm:text-xs font-medium flex items-center gap-1.5 whitespace-nowrap ${
            gpsToast.tone === 'success'
              ? 'bg-emerald-950/90 border-emerald-400/40 text-emerald-100'
              : gpsToast.tone === 'warn'
              ? 'bg-amber-950/90 border-amber-400/40 text-amber-100'
              : 'bg-[#14161C]/92 border-white/20 text-zinc-100'
          }`}
        >
          <LocateFixed
            className={`w-3.5 h-3.5 shrink-0 ${
              gpsToast.tone === 'info'
                ? 'text-[#E63926] animate-spin'
                : gpsToast.tone === 'success'
                ? 'text-emerald-400'
                : 'text-amber-400'
            }`}
          />
          <span className="truncate">{gpsToast.message}</span>
        </div>
      )}

      {activeTab === 'feed' && (
        <main className="w-full max-w-full h-dvh max-h-dvh overflow-hidden lg:pt-16 lg:pb-0 lg:max-w-7xl lg:mx-auto lg:px-6 lg:grid lg:grid-cols-[250px_1fr_340px] lg:gap-6 lg:items-center">
          {/* Desktop Left Rail: Newsroom Navigation & District Filter */}
          <aside className="hidden lg:flex flex-col h-[calc(100dvh-5.5rem)] max-h-[820px] justify-between py-2">
            <div className="space-y-5 overflow-y-auto newsroom-scroll pr-1">
              <nav className="space-y-1" aria-label="Desktop navigation">
                <button
                  type="button"
                  onClick={() => setActiveTab('feed')}
                  className="w-full min-h-[42px] px-3.5 rounded-xl bg-white/10 text-white text-sm font-semibold flex items-center gap-3"
                >
                  <Film className="w-4 h-4 text-[#E63926]" />
                  <span>{copy.homeFeed}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectTab('explore')}
                  className="w-full min-h-[42px] px-3.5 rounded-xl text-zinc-300 hover:bg-white/6 hover:text-white text-sm font-medium flex items-center gap-3 transition-colors"
                >
                  <Compass className="w-4 h-4 text-zinc-400" />
                  <span>{copy.exploreDistricts}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectTab('livetv')}
                  className="w-full min-h-[42px] px-3.5 rounded-xl text-zinc-300 hover:bg-white/6 hover:text-white text-sm font-medium flex items-center gap-3 transition-colors"
                >
                  <Tv className="w-4 h-4 text-[#E63926]" />
                  <span>{copy.liveTv}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectTab('profile')}
                  className="w-full min-h-[42px] px-3.5 rounded-xl text-zinc-300 hover:bg-white/6 hover:text-white text-sm font-medium flex items-center gap-3 transition-colors"
                >
                  <User className="w-4 h-4 text-zinc-400" />
                  <span>{copy.profile}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectTab('portal')}
                  className="w-full min-h-[42px] px-3.5 rounded-xl text-zinc-300 hover:bg-white/6 hover:text-white text-sm font-medium flex items-center justify-between gap-2 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <BadgeCheck className="w-4 h-4 text-[#F59E0B]" />
                    <span>{copy.portal}</span>
                  </span>
                  {pendingPortalCount > 0 && (
                    <span className="font-mono-tabular text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#E63926] text-white">
                      {pendingPortalCount}
                    </span>
                  )}
                </button>
              </nav>

              <div className="border-t border-white/10 pt-4">
                <p className="text-xs font-semibold text-[#FDE68A] px-2 mb-2">
                  BIHAR (All 38 Districts) & Metros
                </p>
                <div className="space-y-1">
                  {districts.map((d) => {
                    const count = reels.filter(
                      (r) => r.district.toLowerCase() === d.id.toLowerCase()
                    ).length;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => handleSelectDistrict(d.id)}
                        className={`w-full min-h-[36px] px-3 rounded-xl text-xs flex items-center justify-between gap-2 transition-colors ${
                          selectedDistrict === d.id
                            ? 'bg-[#E63926]/15 text-white font-semibold border border-[#E63926]/40'
                            : 'text-zinc-300 hover:bg-white/6'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span className="truncate">{d.id}</span>
                        </span>
                        <span className="font-mono-tabular text-zinc-400 shrink-0">
                          {count > 0 ? count : 'Live'}
                        </span>
                      </button>
                    );
                  })}
                  <div className="my-1.5 border-t border-white/10" />
                  <button
                    type="button"
                    onClick={() => handleSelectDistrict('All')}
                    className={`w-full min-h-[38px] px-3 rounded-xl text-xs flex items-center justify-between transition-colors ${
                      selectedDistrict === 'All'
                        ? 'bg-[#E63926]/15 text-white font-semibold border border-[#E63926]/40'
                        : 'text-zinc-300 hover:bg-white/6'
                    }`}
                  >
                    <span>All Districts (सभी जिले)</span>
                    <span className="font-mono-tabular text-zinc-400">{reels.length}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleStartLiveReportFromZila('record')}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#E63926] hover:bg-[#D62E1C] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-[#E63926]/20"
              >
                <Video className="w-4 h-4" />
                <span>🔴 Go Live ({selectedDistrict === 'All' ? 'City' : selectedDistrict})</span>
              </button>
              <button
                type="button"
                onClick={handleOpenReportModal}
                className="w-full min-h-[40px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <PlusSquare className="w-4 h-4 text-[#F59E0B]" />
                <span>File Text / Video Report</span>
              </button>
            </div>
          </aside>

          {/* Center Stage: Scope Switcher + News Category Filter Pills + 9:16 Vertical Snap-Scroll Reels Deck */}
          <section
            aria-label="Vertical News Reels Feed"
            className="relative w-full max-w-full min-w-0 h-full overflow-hidden lg:h-[calc(100dvh-5.5rem)] lg:max-h-[820px] flex flex-col items-center justify-center"
          >
            <div className="absolute top-[calc(max(10px,env(safe-area-inset-top))+42px)] inset-x-0 z-30 flex flex-col gap-0.5 lg:static lg:w-full lg:max-w-[540px] lg:mb-2 lg:shrink-0">
              <ScopeFilterBar
                selectedScope={selectedScope}
                counts={scopeCounts}
                onSelectScope={handleSelectScope}
                onRefreshFeed={handleManualRefreshFeed}
                isRefreshing={isAutoRefreshing}
              />
              <div className="px-2.5 lg:px-0">
                <CategoryFilterBar
                  selectedCategory={selectedCategory}
                  language={language}
                  counts={categoryCounts}
                  onSelectCategory={handleSelectCategory}
                />
              </div>
              {(newlyLoadedBanner ||
                (!gpsToast &&
                  !isLoadingDistrictNews &&
                  (!audioEnabled ||
                    (audioEnabled && audioSourceMode === 'ai' && isAwaitingGesture)))) && (
                <div className="flex flex-wrap items-center justify-center gap-1.5 px-3 pt-1 pointer-events-none">
                  {!gpsToast &&
                    !isLoadingDistrictNews &&
                    (!audioEnabled ||
                      (audioEnabled && audioSourceMode === 'ai' && isAwaitingGesture)) && (
                      <button
                        type="button"
                        onClick={handleUnmuteGeminiAnchor}
                        aria-label="Tap to Unmute Gemini Anchor"
                        className="pointer-events-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#E63926]/95 hover:bg-[#D62E1C] border border-white/30 backdrop-blur-md shadow-[0_4px_18px_rgba(230,57,38,0.5)] text-[11px] font-bold text-white whitespace-nowrap animate-pulse cursor-pointer active:scale-95 transition-transform"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-white shrink-0" />
                        <span>🔊 Tap to Unmute Gemini Anchor</span>
                      </button>
                    )}
                  {newlyLoadedBanner && (
                    <button
                      type="button"
                      onClick={handleJumpToNewlyLoaded}
                      className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600/95 hover:bg-emerald-500 border border-white/25 text-white text-[11px] font-bold shadow-[0_4px_16px_rgba(16,185,129,0.45)] backdrop-blur-md transition-transform active:scale-95 cursor-pointer"
                    >
                      <span>
                        ✨ {newlyLoadedBanner.count} New Live{' '}
                        {newlyLoadedBanner.count === 1 ? 'Story' : 'Stories'} Loaded
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div
              ref={feedContainerRef}
              className="reel-snap-container w-full max-w-full flex-1 min-h-0 lg:w-auto lg:aspect-[9/16] lg:max-h-full lg:rounded-3xl lg:border lg:border-white/15 lg:shadow-2xl bg-black overflow-y-auto overflow-x-hidden"
            >
              {isLoadingDistrictNews ? (
                <div className="reel-snap-item w-full max-w-full h-full flex flex-col justify-between p-5 pt-24 pb-8 bg-gradient-to-b from-[#141720] via-[#0D0F14] to-black">
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#E63926]/20 border border-[#E63926]/45 text-xs font-semibold text-white">
                      <span className="w-2 h-2 rounded-full bg-[#E63926] animate-ping" />
                      <span>
                        Loading live news for{' '}
                        {loadingDistrictLabel || String(selectedDistrict)}...
                      </span>
                    </div>
                    <div className="h-4 w-36 rounded-lg bg-white/10 animate-pulse" />
                  </div>

                  <div className="space-y-3 my-auto">
                    <div className="h-6 w-28 rounded-md bg-white/10 animate-pulse" />
                    <div className="h-7 w-full rounded-xl bg-white/12 animate-pulse" />
                    <div className="h-7 w-4/5 rounded-xl bg-white/10 animate-pulse" />
                    <div className="h-24 w-full rounded-2xl bg-white/8 border border-white/10 animate-pulse" />
                  </div>

                  <div className="space-y-2.5">
                    <div className="h-6 w-full rounded-lg bg-[#B91C1C]/30 animate-pulse" />
                    <div className="h-2 w-full rounded-full bg-white/15 animate-pulse" />
                  </div>
                </div>
              ) : filteredReels.length === 0 ? (
                <div className="reel-snap-item w-full max-w-full h-full flex items-center justify-center p-5 bg-[#0D0F14]">
                  <div className="w-full max-w-xs rounded-2xl bg-[#14161C] border border-white/15 p-5 text-center space-y-4 shadow-2xl">
                    <div className="w-12 h-12 rounded-2xl bg-[#E63926]/15 border border-[#E63926]/40 text-[#E63926] flex items-center justify-center mx-auto">
                      {isGpsDetectedNewEmpty ? (
                        <LocateFixed className="w-6 h-6" />
                      ) : (
                        <MapPin className="w-6 h-6" />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <h2 className="font-display font-bold text-base sm:text-lg text-white leading-snug">
                        {selectedCategory !== 'All' && scopedReels.length > 0
                          ? `No ${selectedCategory} news in ${
                              selectedScope === 'national'
                                ? 'India National'
                                : selectedScope === 'international'
                                ? 'World'
                                : selectedDistrict === 'All'
                                ? 'All Districts'
                                : selectedDistrict
                            } right now`
                          : isGpsDetectedNewEmpty
                          ? `📍 Detected: ${selectedDistrict} — Be the first Citizen Reporter in your area!`
                          : `No news reels in ${selectedDistrict} yet`}
                      </h2>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        {selectedCategory !== 'All' && scopedReels.length > 0
                          ? `There are ${scopedReels.length} other stories ready in this feed. Switch back to All or post a ${selectedCategory} update.`
                          : isGpsDetectedNewEmpty
                          ? `Your feed is locked to ${selectedDistrict}${
                              activeDistrictState ? `, ${activeDistrictState}` : ''
                            }. Post the first local video reel or browse nearby state news.`
                          : `Be the first local reporter to publish a verified video bulletin for ${selectedDistrict}.`}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {selectedCategory !== 'All' && scopedReels.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleSelectCategory('All')}
                          className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#F59E0B] hover:bg-amber-400 text-black text-xs sm:text-sm font-bold transition-colors"
                        >
                          Show All News ({scopedReels.length})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleOpenReportModal}
                        className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#E63926] hover:bg-[#D62E1C] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                      >
                        <PlusSquare className="w-4 h-4 shrink-0" />
                        <span>
                          + Post {selectedCategory !== 'All' ? `${selectedCategory} ` : 'First '}
                          News for {selectedDistrict === 'All' ? 'Your City' : selectedDistrict}
                        </span>
                      </button>
                      {nearbyStateDistrict && selectedCategory === 'All' && (
                        <button
                          type="button"
                          onClick={() => handleSelectDistrict(nearbyStateDistrict.id)}
                          className="w-full min-h-[40px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/16 border border-white/12 text-white text-xs font-medium transition-colors"
                        >
                          View Nearby {nearbyStateDistrict.state} News ({nearbyStateDistrict.id})
                        </button>
                      )}
                      {selectedDistrict !== 'All' && (
                        <button
                          type="button"
                          onClick={() => handleSelectDistrict('All')}
                          className="w-full min-h-[38px] px-4 py-2 rounded-xl bg-white/6 hover:bg-white/12 text-zinc-200 text-xs font-medium transition-colors"
                        >
                          All Districts (सभी जिले)
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                feedItems.map((item, idx) => {
                  const active = idx === safeIndex;
                  if (item.kind === 'ad') {
                    return (
                      <div
                        key={item.key}
                        data-reel-idx={idx}
                        className="reel-snap-item w-full max-w-full h-full shrink-0 overflow-hidden"
                      >
                        <SponsoredReelCard
                          ad={item.ad}
                          isActive={active}
                          onTrackAd={handleTrackAd}
                          onSwipeNext={() => scrollToReelIndex(safeIndex + 1)}
                        />
                      </div>
                    );
                  }

                  const reel = item.reel;
                  const withinWindow = Math.abs(idx - safeIndex) <= 1;
                  const activeSpeechDriven =
                    audioEnabled &&
                    audioSourceMode === 'ai' &&
                    (isSpeaking ||
                      isBulletinComplete ||
                      ttsStatus === 'generating' ||
                      ttsStatus === 'awaiting_gesture');
                  const cardProgress = active
                    ? activeSpeechDriven
                      ? narrationProgress
                      : Math.min(1, currentTimeSec / activeDurationSec)
                    : 0;
                  const cardBulletinComplete = active
                    ? activeSpeechDriven
                      ? isBulletinComplete
                      : timerBulletinComplete
                    : false;
                  return (
                    <div
                      key={reel.id}
                      data-reel-idx={idx}
                      className="reel-snap-item w-full max-w-full h-full shrink-0 overflow-hidden"
                    >
                      {withinWindow ? (
                        <ReelCard
                          reel={reel}
                          isActive={active}
                          isPlaying={active ? isPlaying : false}
                          currentTimeSec={active ? currentTimeSec : 0}
                          language={language}
                          audioEnabled={audioEnabled}
                          audioSourceMode={audioSourceMode}
                          isSpeaking={active && isSpeaking}
                          ttsStatus={active ? ttsStatus : 'idle'}
                          geminiDurationSec={active ? geminiDurationSec : null}
                          narrationProgress={cardProgress}
                          isBulletinComplete={cardBulletinComplete}
                          spokenCueIndex={active ? spokenCueIndex : undefined}
                          spokenWordIndex={active ? spokenWordIndex : undefined}
                          currentSentence={active ? activeChunkIdx + 1 : 1}
                          totalSentences={active ? totalChunks : undefined}
                          isLiked={likedIds.has(reel.id)}
                          isBookmarked={bookmarkedIds.has(reel.id)}
                          preloadVideo={idx === safeIndex + 1}
                          selectedDistrict={selectedDistrict}
                          selectedScope={selectedScope}
                          filteredCount={filteredReels.length}
                          onTogglePlay={handleTogglePlay}
                          onSeek={handleSeek}
                          onToggleAudio={handleToggleAudio}
                          onSelectAudioSourceMode={handleSelectAudioSourceMode}
                          onOpenVoiceSettings={handleOpenVoiceSettings}
                          onGoLiveFromDistrict={handleGoLiveForDistrict}
                          onToggleLike={toggleLike}
                          onEnsureLike={ensureLike}
                          onToggleBookmark={toggleBookmark}
                          onOpenShare={handleOpenShare}
                          onOpenVerify={handleOpenVerify}
                        />
                      ) : (
                        <article
                          className={`reel-snap-item relative w-full max-w-full h-full overflow-hidden bg-gradient-to-br ${reel.fallbackGradient} flex flex-col justify-end p-4`}
                          aria-label={reel.headline[language]}
                        >
                          <img
                            src={reel.imageUrl}
                            alt={reel.headline[language]}
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            className="absolute inset-0 w-full h-full object-cover object-center opacity-50"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
                          <div className="relative z-10 space-y-1.5 pb-10">
                            <span className="inline-block px-2 py-0.5 rounded bg-black/70 border border-white/20 text-[10px] font-bold uppercase text-amber-200">
                              {reel.district} · {reel.category}
                            </span>
                            <h2 className="font-display font-bold text-base text-white line-clamp-2">
                              {reel.headline[language]}
                            </h2>
                          </div>
                        </article>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Vertical Stepper Controls */}
            <div className="hidden lg:flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => scrollToReelIndex(safeIndex - 1)}
                disabled={safeIndex === 0}
                aria-label="Previous reel"
                className="w-11 h-11 rounded-full bg-[#14161C] hover:bg-white/12 disabled:opacity-35 border border-white/12 text-white flex items-center justify-center transition-colors"
              >
                <ChevronUp className="w-5 h-5" />
              </button>
              <span className="font-mono-tabular text-xs text-zinc-400 py-1">
                {safeIndex + 1}/{feedItems.length}
              </span>
              <button
                type="button"
                onClick={() => scrollToReelIndex(safeIndex + 1)}
                disabled={safeIndex >= feedItems.length - 1}
                aria-label="Next reel"
                className="w-11 h-11 rounded-full bg-[#14161C] hover:bg-white/12 disabled:opacity-35 border border-white/12 text-white flex items-center justify-center transition-colors"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
          </section>

          {/* Desktop Right Inspector: Full Synced Script + Verify Source + Audio Status */}
          {activeReel && (
            <aside className="hidden lg:flex flex-col h-[calc(100dvh-5.5rem)] max-h-[820px] gap-4 py-2">
              {/* Live Voice & Audio Source Card */}
              <div className="rounded-2xl bg-[#14161C] border border-white/10 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-400">Active Broadcast Track</p>
                    <p className="font-display font-bold text-base text-white truncate">
                      {audioSourceMode === 'video'
                        ? 'Reporter Video Audio'
                        : `${activeLangMeta.nativeLabel} · ${activeLangMeta.label}`}
                    </p>
                    {audioSourceMode === 'ai' && (
                      <button
                        type="button"
                        onClick={handleOpenVoiceSettings}
                        className="mt-0.5 text-[11px] font-medium text-[#FDE68A] hover:underline truncate block max-w-full text-left"
                      >
                        {activeVoiceName}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleAudio}
                    className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      audioEnabled
                        ? 'bg-[#F59E0B] text-black'
                        : 'bg-white/10 hover:bg-white/15 text-white'
                    }`}
                  >
                    {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    <span>{audioEnabled ? 'Audio On' : 'Unmute'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-black/45 border border-white/10">
                  <button
                    type="button"
                    onClick={() => handleSelectAudioSourceMode('ai')}
                    className={`min-h-[34px] px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      audioSourceMode === 'ai'
                        ? 'bg-[#F59E0B] text-black'
                        : 'text-zinc-300 hover:text-white'
                    }`}
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>AI Dubbing</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectAudioSourceMode('video')}
                    className={`min-h-[34px] px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      audioSourceMode === 'video'
                        ? 'bg-[#E63926] text-white'
                        : 'text-zinc-300 hover:text-white'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Reporter Audio</span>
                  </button>
                </div>
              </div>

              {/* Full Interactive Transcript */}
              <div className="flex-1 min-h-0 rounded-2xl bg-[#14161C] border border-white/10 p-4 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-bold text-sm text-white">
                    {copy.liveSubtitles}
                  </h3>
                  <span className="font-mono-tabular text-xs text-zinc-400">
                    {formatShortClock(activeDurationSec)}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1 newsroom-scroll">
                  {(activeTiming?.cues || []).map((cue, idx) => {
                    const isCueActive = activeCue?.id === cue.id;
                    const scaledStart = cue.startSec * durationScale;
                    const scaledEnd = cue.endSec * durationScale;
                    return (
                      <button
                        key={cue.id}
                        type="button"
                        onClick={() => {
                          clearBulletinTimeout();
                          setTimerBulletinComplete(false);
                          setCurrentTimeSec(scaledStart);
                          setSpokenCueIndex(idx);
                          setSpokenWordIndex(0);
                          setSeekTargetSec(scaledStart);
                          setSeekVersion((v) => v + 1);
                          setIsPlaying(true);
                        }}
                        className={`w-full text-left p-2.5 rounded-xl border transition-colors ${
                          isCueActive
                            ? 'bg-[#E63926]/12 border-[#E63926]/45 text-white'
                            : 'bg-white/3 border-transparent text-zinc-400 hover:bg-white/6 hover:text-zinc-200'
                        }`}
                      >
                        <div className="font-mono-tabular text-[10px] text-zinc-400 mb-0.5">
                          {formatShortClock(scaledStart)} – {formatShortClock(scaledEnd)}
                        </div>
                        <p className="text-xs leading-relaxed">{cue.text[language]}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Source Verification Quick Card */}
              <button
                type="button"
                onClick={() => setVerifyModalReel(activeReel)}
                className="text-left rounded-2xl bg-[#14161C] hover:bg-white/8 border border-white/10 p-4 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F59E0B]">
                    <ShieldCheck className="w-4 h-4" />
                    <span>{copy.verifySource}</span>
                  </span>
                  <span className="font-mono-tabular text-[11px] text-zinc-400">
                    {activeReel.verification.dispatchId}
                  </span>
                </div>
                <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">
                  {activeReel.verification.factCheckSummary[language]}
                </p>
              </button>
            </aside>
          )}
        </main>
      )}

      {activeTab === 'explore' && (
        <main className="h-dvh max-h-dvh w-full max-w-full overflow-y-auto overflow-x-hidden pt-[calc(max(10px,env(safe-area-inset-top))+48px)] pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pt-16 lg:pb-12 newsroom-scroll">
          <Suspense fallback={null}>
            <ExploreDistrictsView
              reels={reels}
              districts={districts}
              language={language}
              selectedDistrict={selectedDistrict}
              isLoadingDistrictNews={isLoadingDistrictNews}
              onOpenDistrictPicker={handleOpenDistrictPicker}
              onRefreshLiveNews={() => {
                if (selectedDistrict === 'All') {
                  handleSelectDistrict('Muzaffarpur');
                } else {
                  const st = districts.find(
                    (d) => d.id.toLowerCase() === String(selectedDistrict).toLowerCase()
                  )?.state;
                  void loadLiveDistrictNews(selectedDistrict, st, true);
                }
              }}
              onStartLiveReport={handleStartLiveReportFromZila}
              onJumpToReel={handleJumpToReel}
              localAds={localAds}
              adNetworkConfig={adNetworkConfig}
              onTrackAd={handleTrackAd}
            />
          </Suspense>
        </main>
      )}

      {activeTab === 'profile' && (
        <main className="h-dvh max-h-dvh w-full max-w-full overflow-y-auto overflow-x-hidden newsroom-scroll">
          <Suspense fallback={null}>
            <ProfileView
              reels={reels}
              likedIds={likedIds}
              bookmarkedIds={bookmarkedIds}
              language={language}
              speechRate={speechRate}
              voiceEngineLabel={activeVoiceName}
              onChangeLanguage={setLanguage}
              onChangeSpeechRate={setSpeechRate}
              onOpenVoiceSettings={handleOpenVoiceSettings}
              onJumpToReel={handleJumpToReel}
            />
          </Suspense>
        </main>
      )}

      {activeTab === 'livetv' && (
        <main className="h-dvh max-h-dvh w-full max-w-full overflow-hidden">
          <Suspense fallback={null}>
            <LiveTvView
              channels={liveTvChannels}
              selectedDistrict={selectedDistrict}
              onOpenDistrictPicker={handleOpenDistrictPicker}
              onOpenReporterTvSubmit={() => handleSelectTab('portal')}
              localAds={localAds}
              adNetworkConfig={adNetworkConfig}
              onTrackAd={handleTrackAd}
            />
          </Suspense>
        </main>
      )}

      {activeTab === 'portal' && (
        <main className="h-dvh max-h-dvh w-full max-w-full overflow-y-auto overflow-x-hidden newsroom-scroll">
          <Suspense fallback={null}>
            <PortalView
              districts={districts}
              reels={reels}
              session={portalSession}
              adminAuthStatus={adminAuthStatus}
              reporters={portalReporters}
              submissions={portalSubmissions}
              isTestingNarration={isTestingCustom}
              onLoginReporter={handlePortalLoginReporter}
              onRegisterReporter={handlePortalRegisterReporter}
              onSetupAdmin={handlePortalSetupAdmin}
              onLoginAdmin={handlePortalLoginAdmin}
              onChangeAdminCredentials={handlePortalChangeAdminCredentials}
              onRefreshAdminAuthStatus={refreshAdminAuthStatus}
              onLogout={handlePortalLogout}
              onSubmitStory={handlePortalSubmitStory}
              onApproveStory={handlePortalApproveStory}
              onRejectStory={handlePortalRejectStory}
              onToggleReelBreaking={handlePortalToggleReelBreaking}
              onDeleteReel={handlePortalDeleteReel}
              onPublishQuickReel={handlePublishQuickReel}
              onUpdateReporterStatus={handlePortalUpdateReporterStatus}
              onPreviewSpeech={(txt) => void speakCustomText(txt)}
              onStopPreviewSpeech={stopCustomTest}
              onWatchDistrictFeed={handleWatchDistrictFromPortal}
              liveTvChannels={liveTvChannels}
              pendingTvSubmissions={pendingTvSubmissions}
              onSubmitTvChannel={handleSubmitTvChannel}
              onApproveTvSubmission={handleApproveTvSubmission}
              onRejectTvSubmission={handleRejectTvSubmission}
              onAddLiveTvChannel={handleAddLiveTvChannel}
              onDeleteLiveTvChannel={handleDeleteLiveTvChannel}
              localAds={localAds}
              adNetworkConfig={adNetworkConfig}
              onAddLocalAd={handleAddLocalAd}
              onToggleLocalAd={handleToggleLocalAd}
              onDeleteLocalAd={handleDeleteLocalAd}
              onSaveAdNetworkConfig={handleSaveAdNetworkConfig}
              defaultNewsRate={defaultNewsRate}
              payoutRequests={payoutRequests}
              onSaveDefaultNewsRate={handleSaveDefaultNewsRate}
              onUpdateReporterRate={handleUpdateReporterRate}
              onRequestUpiPayout={handleRequestUpiPayout}
              onMarkPayoutPaid={handleMarkPayoutPaid}
            />
          </Suspense>
        </main>
      )}

      {/* Desktop Top Navigation Switcher when not on feed */}
      {activeTab !== 'feed' && (
        <div className="hidden lg:flex fixed bottom-6 left-1/2 -translate-x-1/2 z-40 items-center gap-2 p-1.5 rounded-2xl bg-[#14161C]/95 border border-white/15 shadow-2xl">
          <button
            type="button"
            onClick={() => handleSelectTab('feed')}
            className="min-h-[40px] px-4 rounded-xl text-xs font-medium text-zinc-200 hover:bg-white/10 flex items-center gap-2"
          >
            <Film className="w-4 h-4 text-[#E63926]" />
            <span>Back to Reels</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectTab('explore')}
            className={`min-h-[40px] px-4 rounded-xl text-xs font-medium flex items-center gap-2 ${
              activeTab === 'explore' ? 'bg-white/15 text-white' : 'text-zinc-300 hover:bg-white/10'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>{copy.exploreDistricts}</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectTab('livetv')}
            className={`min-h-[40px] px-4 rounded-xl text-xs font-medium flex items-center gap-2 ${
              activeTab === 'livetv' ? 'bg-[#E63926] text-white font-semibold' : 'text-zinc-300 hover:bg-white/10'
            }`}
          >
            <Tv className="w-4 h-4" />
            <span>{copy.liveTv}</span>
          </button>
          <button
            type="button"
            onClick={handleOpenReportModal}
            className="min-h-[40px] px-4 rounded-xl bg-[#E63926] text-white text-xs font-semibold flex items-center gap-2"
          >
            <PlusSquare className="w-4 h-4" />
            <span>Citizen Report</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectTab('profile')}
            className={`min-h-[40px] px-4 rounded-xl text-xs font-medium flex items-center gap-2 ${
              activeTab === 'profile' ? 'bg-white/15 text-white' : 'text-zinc-300 hover:bg-white/10'
            }`}
          >
            <User className="w-4 h-4" />
            <span>{copy.profile}</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectTab('portal')}
            className={`min-h-[40px] px-4 rounded-xl text-xs font-medium flex items-center gap-2 ${
              activeTab === 'portal' ? 'bg-[#F59E0B] text-black font-semibold' : 'text-zinc-300 hover:bg-white/10'
            }`}
          >
            <BadgeCheck className="w-4 h-4" />
            <span>{copy.portal}</span>
          </button>
        </div>
      )}

      <BottomNav
        activeTab={activeTab}
        language={language}
        portalBadgeCount={pendingPortalCount}
        portalRole={portalSession?.role || null}
        onSelectTab={handleSelectTab}
        onOpenReportModal={handleOpenReportModal}
      />

      <Suspense fallback={null}>
        {verifyModalReel && (
          <VerifySourceModal
            reel={verifyModalReel}
            language={language}
            onClose={() => setVerifyModalReel(null)}
          />
        )}

        {shareModalReel && (
          <WhatsAppShareSheet
            reel={shareModalReel}
            language={language}
            onClose={() => setShareModalReel(null)}
            onShared={(id) => {
              setReels((prev) =>
                prev.map((r) => (r.id === id ? { ...r, shares: r.shares + 1 } : r))
              );
            }}
          />
        )}

        {isReportModalOpen && (
          <CitizenReporterModal
            isOpen={isReportModalOpen}
            defaultDistrict={selectedDistrict === 'All' ? 'Muzaffarpur' : selectedDistrict}
            districts={districts}
            initialSourceTab={reportInitialTab}
            onClose={() => setIsReportModalOpen(false)}
            onPublishReel={handlePublishCitizenReel}
          />
        )}

        {isVoiceModalOpen && (
          <VoiceEngineModal
            isOpen={isVoiceModalOpen}
            language={language}
            config={voiceConfig}
            studioError={studioError}
            speechRate={speechRate}
            autoNext={autoNext}
            isTestingCustom={isTestingCustom}
            defaultSampleText={
              activeReel?.subtitles[spokenCueIndex]?.text[language] ||
              activeReel?.headline[language] ||
              ''
            }
            onChangeConfig={setVoiceConfig}
            onChangeSpeechRate={setSpeechRate}
            onToggleAutoNext={() => setAutoNext((v) => !v)}
            onSpeakCustomText={(txt) => void speakCustomText(txt)}
            onStopCustomText={stopCustomTest}
            onEnableAndTest={() => {
              primeSpeech();
              studioAudioBed.unlock();
              setAudioEnabled(true);
              setIsPlaying(true);
              setSeekTargetSec(currentTimeSecRef.current > 0.2 ? currentTimeSecRef.current : null);
              setSeekVersion((v) => v + 1);
            }}
            onClose={() => {
              stopCustomTest();
              setIsVoiceModalOpen(false);
            }}
          />
        )}
      </Suspense>
    </div>
  );
}
