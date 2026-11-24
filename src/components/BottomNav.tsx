import { BadgeCheck, Compass, Film, Plus, Tv, User } from 'lucide-react';
import { memo } from 'react';
import { UI_COPY } from '../data/newsReels';
import { LanguageCode, NavTab } from '../types';

interface BottomNavProps {
  activeTab: NavTab;
  language: LanguageCode;
  portalBadgeCount?: number;
  portalRole?: 'reporter' | 'admin' | null;
  onSelectTab: (tab: NavTab) => void;
  onOpenReportModal: () => void;
}

export const BottomNav = memo(function BottomNav({
  activeTab,
  language,
  portalBadgeCount = 0,
  portalRole = null,
  onSelectTab,
  onOpenReportModal,
}: BottomNavProps) {
  const copy = UI_COPY[language];

  return (
    <nav
      aria-label="Primary navigation"
      className="bottom-broadcast-nav h-[calc(3.5rem+env(safe-area-inset-bottom))] bg-[#0A0B0E]/96 border-t border-white/10 lg:hidden"
    >
      <div className="grid grid-cols-6 h-14 max-w-lg mx-auto">
        <button
          type="button"
          onClick={() => onSelectTab('feed')}
          className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
            activeTab === 'feed' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Film className={`w-5 h-5 ${activeTab === 'feed' ? 'text-[#E63926]' : ''}`} />
          <span className="text-[10px] font-medium tracking-tight whitespace-nowrap truncate max-w-full px-0.5">
            {copy.homeFeed}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('explore')}
          className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
            activeTab === 'explore' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Compass className={`w-5 h-5 ${activeTab === 'explore' ? 'text-[#E63926]' : ''}`} />
          <span className="text-[10px] font-medium tracking-tight whitespace-nowrap truncate max-w-full px-0.5">
            {copy.exploreDistricts}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('livetv')}
          className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
            activeTab === 'livetv' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Tv className={`w-5 h-5 ${activeTab === 'livetv' ? 'text-[#E63926]' : ''}`} />
          <span className="text-[10px] font-medium tracking-tight whitespace-nowrap truncate max-w-full px-0.5">
            {copy.liveTv}
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenReportModal}
          aria-label="Post News Reel"
          className="flex flex-col items-center justify-center gap-0.5 text-white transition-transform active:scale-95"
        >
          <span className="w-8 h-6 rounded-lg bg-gradient-to-r from-[#E63926] to-[#F59E0B] flex items-center justify-center shadow-md shadow-[#E63926]/30">
            <Plus className="w-4 h-4 text-white stroke-[2.75]" />
          </span>
          <span className="text-[10px] font-semibold tracking-tight text-amber-200 whitespace-nowrap truncate max-w-full px-0.5">
            {copy.citizenReport}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('profile')}
          className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
            activeTab === 'profile' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <User className={`w-5 h-5 ${activeTab === 'profile' ? 'text-[#E63926]' : ''}`} />
          <span className="text-[10px] font-medium tracking-tight whitespace-nowrap truncate max-w-full px-0.5">
            {copy.profile}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('portal')}
          className={`relative flex flex-col items-center justify-center gap-0.5 transition-colors ${
            activeTab === 'portal' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <span className="relative inline-flex">
            <BadgeCheck
              className={`w-5 h-5 ${
                activeTab === 'portal'
                  ? 'text-[#F59E0B]'
                  : portalRole === 'admin'
                  ? 'text-emerald-400'
                  : portalRole === 'reporter'
                  ? 'text-[#F59E0B]'
                  : ''
              }`}
            />
            {portalBadgeCount > 0 && (
              <span className="absolute -top-1 -right-2 min-w-[15px] h-[15px] px-1 rounded-full bg-[#E63926] text-white text-[9px] font-bold flex items-center justify-center font-mono-tabular">
                {portalBadgeCount > 9 ? '9+' : portalBadgeCount}
              </span>
            )}
          </span>
          <span className="text-[10px] font-medium tracking-tight whitespace-nowrap truncate max-w-full px-0.5">
            {copy.portal}
          </span>
        </button>
      </div>
    </nav>
  );
});
