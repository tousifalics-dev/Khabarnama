import {
  Check,
  ChevronDown,
  Globe,
  LocateFixed,
  MapPin,
  Search,
  Settings,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LANGUAGES, UI_COPY } from '../data/newsReels';
import { DistrictId, DistrictMeta, LanguageCode } from '../types';

interface TopBarProps {
  districts: DistrictMeta[];
  selectedDistrict: DistrictId;
  onSelectDistrict: (district: DistrictId) => void;
  onDetectGps: () => void;
  isDetectingGps: boolean;
  language: LanguageCode;
  onSelectLanguage: (lang: LanguageCode) => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  onOpenVoiceSettings: () => void;
  isStudioMode: boolean;
  isDistrictPickerOpen?: boolean;
  onOpenDistrictPicker?: () => void;
  onCloseDistrictPicker?: () => void;
}

export const TopBar = memo(function TopBar({
  districts,
  selectedDistrict,
  onSelectDistrict,
  onDetectGps,
  isDetectingGps,
  language,
  onSelectLanguage,
  audioEnabled,
  onToggleAudio,
  onOpenVoiceSettings,
  isStudioMode,
  isDistrictPickerOpen,
  onOpenDistrictPicker,
  onCloseDistrictPicker,
}: TopBarProps) {
  const [openMenu, setOpenMenu] = useState<'location' | 'language' | null>(null);
  const [districtSearch, setDistrictSearch] = useState('');
  const barRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const isControlledLocation = typeof isDistrictPickerOpen === 'boolean';
  const isLocationOpen = isControlledLocation
    ? Boolean(isDistrictPickerOpen)
    : openMenu === 'location';

  const currentLang = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];
  const copy = UI_COPY[language];

  const groupedDistricts = useMemo(() => {
    const q = districtSearch.trim().toLowerCase();
    const matches = (d: DistrictMeta) =>
      !q ||
      d.id.toLowerCase().includes(q) ||
      d.state.toLowerCase().includes(q) ||
      (d.hindiName && d.hindiName.includes(q));

    const detected = districts.filter((d) => d.group === 'detected' && matches(d));
    const bihar = districts
      .filter((d) => (d.group === 'bihar' || (!d.group && d.state === 'Bihar')) && matches(d))
      .sort((a, b) => a.id.localeCompare(b.id));
    const metros = districts.filter(
      (d) => (d.group === 'metro' || (!d.group && d.state !== 'Bihar')) && matches(d)
    );
    return { detected, bihar, metros };
  }, [districts, districtSearch]);

  useEffect(() => {
    const closeAll = () => {
      setOpenMenu(null);
      onCloseDistrictPicker?.();
    };
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        barRef.current &&
        !barRef.current.contains(target) &&
        (!sheetRef.current || !sheetRef.current.contains(target))
      ) {
        closeAll();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAll();
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onCloseDistrictPicker]);

  useEffect(() => {
    if (isLocationOpen) {
      setDistrictSearch('');
    }
  }, [isLocationOpen]);

  const closeLocationPicker = () => {
    setOpenMenu((prev) => (prev === 'location' ? null : prev));
    onCloseDistrictPicker?.();
  };

  const handleChooseDistrict = (district: DistrictId) => {
    onSelectDistrict(district);
    setDistrictSearch('');
    closeLocationPicker();
  };

  const renderDistrictCard = (d: DistrictMeta) => {
    const isSelected = selectedDistrict === d.id;
    return (
      <button
        key={d.id}
        type="button"
        onClick={() => handleChooseDistrict(d.id)}
        className={`w-full min-w-0 min-h-[52px] px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors ${
          isSelected
            ? 'bg-[#E63926]/22 border-[#E63926] text-white shadow-sm shadow-[#E63926]/20'
            : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-zinc-100'
        }`}
      >
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs sm:text-[13px] font-semibold leading-snug break-words">
            {d.id}
          </span>
          <span className="text-[10.5px] text-zinc-400 leading-tight break-words mt-0.5">
            {d.hindiName ? d.hindiName : d.state}
          </span>
        </div>
        {isSelected && <Check className="w-4 h-4 text-[#E63926] shrink-0" />}
      </button>
    );
  };

  const activeDistrictLabel =
    selectedDistrict === 'All' ? copy.allDistricts : selectedDistrict;

  return (
    <>
      <header ref={barRef} className="top-broadcast-header">
        <div className="max-w-7xl mx-auto w-full flex flex-nowrap items-center justify-between gap-1.5 sm:gap-4 min-w-0 overflow-hidden">
          {/* Brand Wordmark */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0">
            <span className="inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-[#E63926] text-white font-display font-extrabold text-[11px] sm:text-xs tracking-tight shrink-0 shadow">
              K
            </span>
            <span className="font-display font-bold text-[11px] sm:text-base tracking-tight text-white whitespace-nowrap">
              Khabar Nama
            </span>
            <span className="hidden md:inline text-xs text-zinc-300 whitespace-nowrap">
              · Hyper-Local AI News
            </span>
          </div>

          {/* Right Interactive Controls: Compact District Pill, GPS Auto, Language Switcher, Mute/Unmute, Settings */}
          <div className="flex flex-nowrap items-center justify-end gap-1 sm:gap-1.5 min-w-0 flex-1">
            {/* Compact Mobile-Contained District Pill Button */}
            <button
              type="button"
              onClick={() => {
                setDistrictSearch('');
                if (isControlledLocation) {
                  setOpenMenu(null);
                  if (isLocationOpen) onCloseDistrictPicker?.();
                  else onOpenDistrictPicker?.();
                } else {
                  setOpenMenu((prev) => (prev === 'location' ? null : 'location'));
                }
              }}
              aria-expanded={isLocationOpen}
              aria-haspopup="dialog"
              aria-label={`Selected District: ${activeDistrictLabel}. Tap to change district`}
              className="min-h-[34px] sm:min-h-[40px] max-w-[135px] sm:max-w-[180px] min-w-0 shrink px-2 sm:px-3 rounded-full bg-black/75 hover:bg-black/90 border border-white/20 text-[11px] sm:text-sm font-medium text-zinc-100 flex items-center gap-1 sm:gap-1.5 whitespace-nowrap overflow-hidden transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E63926]"
            >
              <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#E63926] shrink-0" />
              <span className="min-w-0 flex-1 truncate text-left">{activeDistrictLabel}</span>
              <ChevronDown className="w-3 h-3 text-zinc-300 shrink-0" />
            </button>

            {/* Compact GPS Auto-Detect Button */}
            <button
              type="button"
              onClick={() => {
                setOpenMenu(null);
                onDetectGps();
              }}
              disabled={isDetectingGps}
              aria-label="Detect my district with GPS"
              title="Auto-detect my district via GPS"
              className={`min-h-[34px] min-w-[32px] sm:min-h-[40px] px-1.5 sm:px-2.5 rounded-lg border text-[10.5px] sm:text-xs font-semibold flex items-center justify-center gap-1 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E63926] ${
                isDetectingGps
                  ? 'bg-[#E63926]/25 border-[#E63926]/60 text-[#FDE68A]'
                  : 'bg-black/70 hover:bg-black/85 border-white/18 text-zinc-100'
              }`}
            >
              <LocateFixed
                className={`w-3.5 h-3.5 text-[#E63926] shrink-0 ${
                  isDetectingGps ? 'animate-spin' : ''
                }`}
              />
              <span className="hidden min-[420px]:inline">Auto</span>
            </button>

            {/* Language Switcher */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setOpenMenu((prev) => (prev === 'language' ? null : 'language'))}
                aria-expanded={openMenu === 'language'}
                aria-label="Select Language"
                className="min-h-[34px] sm:min-h-[40px] px-1.5 sm:px-3 rounded-full bg-[#E63926]/30 hover:bg-[#E63926]/45 border border-[#E63926]/55 text-[10.5px] sm:text-sm font-semibold text-white flex items-center gap-1 sm:gap-1.5 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E63926]"
              >
                <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#F59E0B] shrink-0" />
                <span className="sm:hidden font-mono-tabular">{currentLang.shortCode}</span>
                <span className="hidden sm:inline">{currentLang.nativeLabel}</span>
                <ChevronDown className="hidden sm:inline w-3 h-3 text-zinc-200 shrink-0" />
              </button>

              {openMenu === 'language' && (
                <div
                  role="listbox"
                  aria-label="Languages"
                  className="absolute right-0 mt-2 w-52 max-w-[calc(100vw-24px)] rounded-2xl bg-[#14161C] border border-white/15 shadow-2xl py-1.5 z-[10000]"
                >
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        onSelectLanguage(lang.code);
                        setOpenMenu(null);
                      }}
                      className={`w-full px-3.5 py-2.5 text-left text-xs sm:text-sm flex items-center justify-between transition-colors ${
                        language === lang.code
                          ? 'bg-white/10 text-white font-semibold'
                          : 'text-zinc-300 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono-tabular text-[11px] text-zinc-400 w-7">
                          {lang.shortCode}
                        </span>
                        <span>{lang.nativeLabel}</span>
                        <span className="text-[11px] text-zinc-500">({lang.label})</span>
                      </div>
                      {language === lang.code && <Check className="w-4 h-4 text-[#F59E0B]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mute / Unmute Button */}
            <button
              type="button"
              onClick={onToggleAudio}
              aria-label={audioEnabled ? 'Mute voice narration' : 'Unmute voice narration'}
              title={audioEnabled ? copy.audioOn : copy.audioMuted}
              className={`min-h-[34px] min-w-[32px] sm:min-h-[40px] sm:px-2.5 rounded-lg border flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E63926] ${
                audioEnabled
                  ? 'bg-[#F59E0B] border-[#F59E0B] text-black font-semibold'
                  : 'bg-black/70 border-white/18 text-zinc-200 hover:text-white hover:bg-black/85'
              }`}
            >
              {audioEnabled ? (
                <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              )}
              <span className="hidden lg:inline text-xs font-semibold">
                {audioEnabled ? 'Audio On' : 'Muted'}
              </span>
            </button>

            {/* Settings Gear Button */}
            <button
              type="button"
              onClick={() => {
                setOpenMenu(null);
                onOpenVoiceSettings();
              }}
              aria-label="Open Settings"
              title="Settings (Gemini AI Voice, Speed & Auto-Next)"
              className={`min-h-[34px] min-w-[32px] sm:min-h-[40px] sm:px-2.5 rounded-lg border flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E63926] ${
                isStudioMode
                  ? 'bg-[#F59E0B]/25 border-[#F59E0B]/60 text-[#FDE68A]'
                  : 'bg-black/70 border-white/18 text-zinc-100 hover:text-white hover:bg-black/85'
              }`}
            >
              <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden lg:inline text-xs font-medium">Settings</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile-Fitted Searchable District Bottom-Sheet Drawer */}
      {isLocationOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Select District"
            className="fixed inset-0 z-[10000] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center"
            onClick={closeLocationPicker}
          >
            <div
              ref={sheetRef}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-full sm:max-w-lg max-h-[75dvh] rounded-t-[20px] sm:rounded-2xl overflow-hidden flex flex-col bg-[#12141A]/95 backdrop-blur-xl border-t sm:border border-white/15 shadow-2xl pb-[env(safe-area-inset-bottom)]"
            >
              {/* Drag Handle & Header */}
              <div className="pt-2.5 px-4 pb-2.5 border-b border-white/10 shrink-0">
                <div className="w-10 h-1 rounded-full bg-white/25 mx-auto mb-2.5 sm:hidden" />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="w-4 h-4 text-[#E63926] shrink-0" />
                    <h2 className="font-display font-bold text-sm sm:text-base text-white truncate">
                      Select District
                    </h2>
                    <span className="text-[10px] font-mono-tabular px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 shrink-0">
                      38 Bihar + Metros
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={closeLocationPicker}
                    aria-label="Close district selector"
                    className="w-8 h-8 rounded-full bg-white/8 hover:bg-white/15 text-zinc-200 flex items-center justify-center shrink-0 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Live Search Bar */}
                <div className="relative flex items-center mt-2.5">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 pointer-events-none" />
                  <input
                    type="text"
                    value={districtSearch}
                    onChange={(e) => setDistrictSearch(e.target.value)}
                    placeholder="Search Bihar district..."
                    aria-label="Search Bihar district"
                    className="w-full h-10 pl-9 pr-9 rounded-xl bg-black/55 border border-white/15 text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#E63926]"
                  />
                  {districtSearch.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDistrictSearch('')}
                      aria-label="Clear search"
                      className="w-7 h-7 rounded-full text-zinc-400 hover:text-white flex items-center justify-center absolute right-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Auto-Detect GPS Button */}
                <button
                  type="button"
                  onClick={() => {
                    closeLocationPicker();
                    onDetectGps();
                  }}
                  disabled={isDetectingGps}
                  className="mt-2 w-full min-h-[40px] px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/35 text-emerald-200 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <LocateFixed
                    className={`w-4 h-4 text-emerald-400 shrink-0 ${
                      isDetectingGps ? 'animate-spin' : ''
                    }`}
                  />
                  <span>
                    {isDetectingGps
                      ? 'Detecting your district...'
                      : '📍 Auto-Detect My District (GPS)'}
                  </span>
                </button>
              </div>

              {/* 2-Column Scrollable Grid */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3.5 py-3 space-y-4 newsroom-scroll">
                {groupedDistricts.detected.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-[10.5px] font-bold tracking-wider uppercase text-emerald-300 px-0.5">
                      GPS Detected District
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {groupedDistricts.detected.map(renderDistrictCard)}
                    </div>
                  </section>
                )}

                {groupedDistricts.bihar.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-[10.5px] font-bold tracking-wider uppercase text-[#FDE68A] px-0.5">
                      BIHAR (All {groupedDistricts.bihar.length} Districts)
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {groupedDistricts.bihar.map(renderDistrictCard)}
                    </div>
                  </section>
                )}

                {groupedDistricts.metros.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-[10.5px] font-bold tracking-wider uppercase text-zinc-300 px-0.5">
                      Major Metros
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {groupedDistricts.metros.map(renderDistrictCard)}
                    </div>
                  </section>
                )}

                {groupedDistricts.detected.length === 0 &&
                  groupedDistricts.bihar.length === 0 &&
                  groupedDistricts.metros.length === 0 && (
                    <div className="py-8 text-center text-xs sm:text-sm text-zinc-400">
                      No matching district found for &ldquo;{districtSearch}&rdquo;
                    </div>
                  )}

                {/* All Districts Option */}
                <div className="pt-1 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => handleChooseDistrict('All')}
                    className={`w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border text-left text-xs sm:text-sm flex items-center justify-between gap-2 transition-colors ${
                      selectedDistrict === 'All'
                        ? 'bg-[#E63926]/22 border-[#E63926] text-white font-semibold'
                        : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-zinc-200'
                    }`}
                  >
                    <span>All Districts (सभी जिले)</span>
                    {selectedDistrict === 'All' && (
                      <Check className="w-4 h-4 text-[#E63926] shrink-0" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
});
