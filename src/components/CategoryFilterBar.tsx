import {
  Building2,
  CloudRain,
  Flame,
  GraduationCap,
  Landmark,
  Layers,
  Radio,
  ShieldAlert,
} from 'lucide-react';
import { memo } from 'react';
import { LanguageCode, NewsCategoryFilter, NewsReel } from '../types';

export interface CategoryFilterMeta {
  id: NewsCategoryFilter;
  labels: Record<LanguageCode, string>;
}

export const CATEGORY_FILTERS: CategoryFilterMeta[] = [
  {
    id: 'All',
    labels: {
      en: 'All',
      hi: 'सभी',
      bho: 'सभ',
      mr: 'सर्व',
      ta: 'அனைத்தும்',
      bn: 'সব',
    },
  },
  {
    id: 'Breaking',
    labels: {
      en: 'Breaking',
      hi: 'ब्रेकिंग',
      bho: 'ब्रेकिंग',
      mr: 'ब्रेकिंग',
      ta: 'முக்கியம்',
      bn: 'ব্রেকিং',
    },
  },
  {
    id: 'Crime',
    labels: {
      en: 'Crime',
      hi: 'अपराध',
      bho: 'अपराध',
      mr: 'गुन्हेगारी',
      ta: 'குற்றம்',
      bn: 'অপরাধ',
    },
  },
  {
    id: 'Weather',
    labels: {
      en: 'Weather',
      hi: 'मौसम',
      bho: 'मौसम',
      mr: 'हवामान',
      ta: 'வானிலை',
      bn: 'আবহাওয়া',
    },
  },
  {
    id: 'Education',
    labels: {
      en: 'Education',
      hi: 'शिक्षा',
      bho: 'शिक्षा',
      mr: 'शिक्षण',
      ta: 'கல்வி',
      bn: 'শিক্ষা',
    },
  },
  {
    id: 'Administration',
    labels: {
      en: 'Admin',
      hi: 'प्रशासन',
      bho: 'प्रशासन',
      mr: 'प्रशासन',
      ta: 'நிர்வாகம்',
      bn: 'প্রশাসন',
    },
  },
  {
    id: 'Infrastructure',
    labels: {
      en: 'Infra',
      hi: 'विकास',
      bho: 'सड़क-विकास',
      mr: 'पायाभूत',
      ta: 'உள்கட்டமைப்பு',
      bn: 'পরিকাঠামো',
    },
  },
  {
    id: 'Citizen Dispatch',
    labels: {
      en: 'Citizen Live',
      hi: 'नागरिक लाइव',
      bho: 'गांव-शहर लाइव',
      mr: 'नागरिक लाईव्ह',
      ta: 'நேரடி புகார்',
      bn: 'নাগরিক লাইভ',
    },
  },
];

const CATEGORY_TEXT_PATTERNS = {
  Crime:
    /पुलिस|गिरफ्तार|अपराध|चोरी|लूट|हत्या|अपहरण|छापेमारी|ठगी|थाना|बरामद|फायरिंग|crime|police|arrest|theft|robbery|murder|fraud|raid|scam|firing/i,
  Weather:
    /बारिश|मौसम|बाढ़|गर्मी|ठंड|कोहरा|आंधी|लू|तापमान|जल-निकासी|weather|rain|flood|heatwave|monsoon|storm|humidity/i,
  Education:
    /स्कूल|कॉलेज|परीक्षा|शिक्षा|छात्र|विश्वविद्यालय|स्मार्ट क्लास|पुस्तकालय|school|college|exam|university|student|campus|classroom/i,
  Administration:
    /प्रशासन|समाहरणालय|डीएम|नगर निगम|सरकार|योजना|कलेक्ट्रेट|पंचायत|जन-सुनवाई|राशन|पेंशन|collector|collectorate|municipal|panchayat|administration|civic/i,
};

export function matchesCategoryFilter(
  reel: NewsReel,
  category: NewsCategoryFilter
): boolean {
  if (category === 'All') return true;

  const searchable = `${reel.headline.en || ''} ${reel.headline.hi || ''} ${
    reel.caption.en || ''
  } ${reel.caption.hi || ''} ${reel.wardOrZone || ''}`;

  switch (category) {
    case 'Breaking':
      return Boolean(reel.isBreaking) || reel.category === 'Breaking';
    case 'Crime':
      return reel.category === 'Crime' || CATEGORY_TEXT_PATTERNS.Crime.test(searchable);
    case 'Weather':
      return (
        reel.category === 'Weather' ||
        reel.category === 'Weather & Civic' ||
        CATEGORY_TEXT_PATTERNS.Weather.test(searchable)
      );
    case 'Education':
      return reel.category === 'Education' || CATEGORY_TEXT_PATTERNS.Education.test(searchable);
    case 'Administration':
      return (
        reel.category === 'Administration' ||
        CATEGORY_TEXT_PATTERNS.Administration.test(searchable)
      );
    case 'Infrastructure':
      return (
        reel.category === 'Infrastructure' ||
        reel.category === 'Transit' ||
        reel.category === 'Clean Energy' ||
        reel.category === 'Environment'
      );
    case 'Citizen Dispatch':
      return (
        reel.category === 'Citizen Dispatch' ||
        Boolean(reel.isCitizenSubmitted) ||
        Boolean(reel.isVerifiedReporter)
      );
    default:
      return reel.category === category;
  }
}

function renderCategoryIcon(id: NewsCategoryFilter, isActive: boolean) {
  const cls = `w-3 h-3 shrink-0 ${isActive ? 'text-white' : 'text-zinc-300'}`;
  switch (id) {
    case 'All':
      return <Layers className={cls} />;
    case 'Breaking':
      return <Flame className={`w-3 h-3 shrink-0 ${isActive ? 'text-[#FDE68A]' : 'text-[#E63926]'}`} />;
    case 'Crime':
      return <ShieldAlert className={`w-3 h-3 shrink-0 ${isActive ? 'text-white' : 'text-red-400'}`} />;
    case 'Weather':
      return <CloudRain className={`w-3 h-3 shrink-0 ${isActive ? 'text-white' : 'text-sky-400'}`} />;
    case 'Education':
      return <GraduationCap className={`w-3 h-3 shrink-0 ${isActive ? 'text-white' : 'text-emerald-400'}`} />;
    case 'Administration':
      return <Landmark className={`w-3 h-3 shrink-0 ${isActive ? 'text-white' : 'text-amber-300'}`} />;
    case 'Infrastructure':
      return <Building2 className={`w-3 h-3 shrink-0 ${isActive ? 'text-white' : 'text-indigo-300'}`} />;
    case 'Citizen Dispatch':
      return <Radio className={`w-3 h-3 shrink-0 ${isActive ? 'text-white' : 'text-rose-400'}`} />;
  }
}

interface CategoryFilterBarProps {
  selectedCategory: NewsCategoryFilter;
  language: LanguageCode;
  counts: Record<NewsCategoryFilter, number>;
  onSelectCategory: (category: NewsCategoryFilter) => void;
}

export const CategoryFilterBar = memo(function CategoryFilterBar({
  selectedCategory,
  language,
  counts,
  onSelectCategory,
}: CategoryFilterBarProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter district news by category"
      className="w-full max-w-full overflow-x-auto no-scrollbar flex items-center gap-1.5 px-0.5 py-0.5"
    >
      {CATEGORY_FILTERS.map((cat) => {
        const isActive = selectedCategory === cat.id;
        const count = counts[cat.id] ?? 0;
        const label = cat.labels[language] || cat.labels.en;

        return (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelectCategory(cat.id)}
            className={`min-h-[30px] px-2.5 py-1 rounded-full border text-[11px] font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 backdrop-blur-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E63926] ${
              isActive
                ? 'bg-[#E63926] border-[#E63926] text-white shadow-md shadow-[#E63926]/30'
                : count === 0
                ? 'bg-black/55 border-white/10 text-zinc-400 hover:bg-black/75 hover:text-zinc-200'
                : 'bg-black/75 border-white/18 text-zinc-100 hover:bg-black/90 hover:border-white/30'
            }`}
          >
            {renderCategoryIcon(cat.id, isActive)}
            <span>{label}</span>
            <span
              className={`font-mono-tabular text-[10px] px-1.5 py-0 rounded-full ${
                isActive
                  ? 'bg-black/25 text-[#FDE68A]'
                  : 'bg-white/10 text-zinc-300'
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
});
