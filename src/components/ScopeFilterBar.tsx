import { RefreshCw } from 'lucide-react';
import React from 'react';
import { ReelScopeFilter } from '../types';

interface ScopeFilterBarProps {
  selectedScope: ReelScopeFilter;
  counts: Record<ReelScopeFilter, number>;
  onSelectScope: (scope: ReelScopeFilter) => void;
  onRefreshFeed?: () => void;
  isRefreshing?: boolean;
}

const SCOPE_ITEMS: Array<{
  id: ReelScopeFilter;
  icon: string;
  label: string;
  activeClass: string;
}> = [
  {
    id: 'mix',
    icon: '🔥',
    label: 'Mix',
    activeClass: 'bg-[#E63926] border-[#ff7362] text-white shadow-[0_2px_10px_rgba(230,57,38,0.45)]',
  },
  {
    id: 'local',
    icon: '📍',
    label: 'Local',
    activeClass: 'bg-emerald-600 border-emerald-400/80 text-white shadow-[0_2px_10px_rgba(16,185,129,0.38)]',
  },
  {
    id: 'national',
    icon: '🇮🇳',
    label: 'National',
    activeClass: 'bg-amber-500 border-amber-300 text-black shadow-[0_2px_10px_rgba(245,158,11,0.4)]',
  },
  {
    id: 'international',
    icon: '🌍',
    label: 'World',
    activeClass: 'bg-indigo-600 border-indigo-400/80 text-white shadow-[0_2px_10px_rgba(99,102,241,0.4)]',
  },
];

export const ScopeFilterBar: React.FC<ScopeFilterBarProps> = ({
  selectedScope,
  counts,
  onSelectScope,
  onRefreshFeed,
  isRefreshing = false,
}) => {
  return (
    <div
      className="w-full max-w-full overflow-hidden flex items-center gap-[5px] px-[10px] py-[4px]"
      role="tablist"
      aria-label="News Scope Switcher"
    >
      {SCOPE_ITEMS.map((item) => {
        const isActive = selectedScope === item.id;
        const count = counts[item.id] ?? 0;

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelectScope(item.id)}
            className={`flex-1 min-w-0 h-7 px-1.5 rounded-full border text-[11px] font-bold tracking-tight flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-95 ${
              isActive
                ? item.activeClass
                : 'bg-black/60 hover:bg-black/80 border-white/15 text-white/85 backdrop-blur-md'
            }`}
          >
            <span className="shrink-0 text-[11px] leading-none">{item.icon}</span>
            <span className="truncate leading-none">{item.label}</span>
            <span
              className={`shrink-0 text-[9px] font-extrabold px-1 py-0.5 rounded-full leading-none tabular-nums ${
                isActive
                  ? item.id === 'national'
                    ? 'bg-black/15 text-black'
                    : 'bg-black/25 text-white'
                  : 'bg-white/10 text-white/65'
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
      {onRefreshFeed && (
        <button
          type="button"
          onClick={onRefreshFeed}
          disabled={isRefreshing}
          title="Refresh Local, National & World news"
          aria-label="Refresh Local, National and World news"
          className="shrink-0 w-7 h-7 rounded-full border border-white/20 bg-black/65 hover:bg-black/85 text-white/90 flex items-center justify-center backdrop-blur-md transition-all active:scale-90 disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      )}
    </div>
  );
};
