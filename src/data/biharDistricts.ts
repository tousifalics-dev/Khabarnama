import { DistrictMeta, LanguageCode } from '../types';

export interface BiharDistrictSeed {
  id: string;
  hindiName: string;
  pinPrefix: string;
  topBeat: string;
  activeDesks: number;
  keywords: string[];
  queryTerm: string;
}

export const BIHAR_DISTRICT_SEEDS: BiharDistrictSeed[] = [
  {
    id: 'Araria',
    hindiName: 'अररिया',
    pinPrefix: '854311',
    topBeat: 'Border Trade & Kosi Roads',
    activeDesks: 9,
    queryTerm: 'Araria',
    keywords: ['araria', 'अररिया', 'forbesganj', 'फारबिसगंज', 'jogbani', 'जोगबनी'],
  },
  {
    id: 'Arwal',
    hindiName: 'अरवल',
    pinPrefix: '804401',
    topBeat: 'Sone Canal & Agri Irrigation',
    activeDesks: 6,
    queryTerm: 'Arwal',
    keywords: ['arwal', 'अरवल', 'kurtha', 'कुर्था', 'karpi', 'करपी'],
  },
  {
    id: 'Aurangabad',
    hindiName: 'औरंगाबाद',
    pinPrefix: '824101',
    topBeat: 'GT Road Corridor & Power Grid',
    activeDesks: 10,
    queryTerm: 'Aurangabad',
    keywords: ['aurangabad', 'औरंगाबाद', 'daudnagar', 'दाउदनगर', 'nabinagar', 'नबीनगर'],
  },
  {
    id: 'Banka',
    hindiName: 'बांका',
    pinPrefix: '813102',
    topBeat: 'Mandar Hill & Rural Bridges',
    activeDesks: 7,
    queryTerm: 'Banka',
    keywords: ['banka', 'बांका', 'बाँका', 'amarpur', 'अमरपुर', 'bounsi', 'बौंसी'],
  },
  {
    id: 'Begusarai',
    hindiName: 'बेगूसराय',
    pinPrefix: '851101',
    topBeat: 'Barauni Industrial & Simaria Bridge',
    activeDesks: 13,
    queryTerm: 'Begusarai',
    keywords: ['begusarai', 'बेगूसराय', 'barauni', 'बरौनी', 'simaria', 'सिमरिया', 'teghra', 'तेघड़ा'],
  },
  {
    id: 'Bhagalpur',
    hindiName: 'भागलपुर',
    pinPrefix: '812001',
    topBeat: 'Smart City, Silk & Vikramshila Bridge',
    activeDesks: 16,
    queryTerm: 'Bhagalpur',
    keywords: ['bhagalpur', 'भागलपुर', 'sultanganj', 'सुल्तानगंज', 'kahalgaon', 'कहलगांव', 'naugachhia', 'नवगछिया'],
  },
  {
    id: 'Bhojpur',
    hindiName: 'भोजपुर',
    pinPrefix: '802301',
    topBeat: 'Arrah Junction & Koilwar Bridge',
    activeDesks: 11,
    queryTerm: 'Bhojpur Arrah',
    keywords: ['bhojpur', 'भोजपुर', 'arrah', 'ara', 'आरा', 'jagdishpur', 'जगदीशपुर', 'piro', 'पीरो'],
  },
  {
    id: 'Buxar',
    hindiName: 'बक्सर',
    pinPrefix: '802101',
    topBeat: 'Ganga Ghat, Chausa Power & Rail',
    activeDesks: 9,
    queryTerm: 'Buxar',
    keywords: ['buxar', 'बक्सर', 'dumraon', 'डुमरांव', 'chausa', 'चौसा'],
  },
  {
    id: 'Darbhanga',
    hindiName: 'दरभंगा',
    pinPrefix: '846004',
    topBeat: 'Airport Transit, AIIMS & Makhana',
    activeDesks: 14,
    queryTerm: 'Darbhanga',
    keywords: ['darbhanga', 'दरभंगा', 'laheriasarai', 'लहेरियासराय', 'benipur', 'बेनीपुर'],
  },
  {
    id: 'East Champaran (Motihari)',
    hindiName: 'पूर्वी चंपारण (मोतिहारी)',
    pinPrefix: '845401',
    topBeat: 'Motihari Civic, Raxaul & Agri',
    activeDesks: 13,
    queryTerm: 'Motihari East Champaran',
    keywords: ['east champaran', 'motihari', 'पूर्वी चंपारण', 'मोतिहारी', 'raxaul', 'रक्सौल', 'chakia', 'चकिया'],
  },
  {
    id: 'Gaya',
    hindiName: 'गया',
    pinPrefix: '823001',
    topBeat: 'Gayaji Dam, Bodh Gaya & Airport',
    activeDesks: 16,
    queryTerm: 'Gaya',
    keywords: ['gaya', 'गया', 'bodh gaya', 'bodhgaya', 'बोधगया', 'sherghati', 'शेरघाटी', 'tekari', 'टिकारी'],
  },
  {
    id: 'Gopalganj',
    hindiName: 'गोपालगंज',
    pinPrefix: '841428',
    topBeat: 'Gandak Embankment & Sugarcane Mills',
    activeDesks: 9,
    queryTerm: 'Gopalganj',
    keywords: ['gopalganj', 'गोपालगंज', 'thawe', 'थावे', 'mirganj', 'मीरगंज'],
  },
  {
    id: 'Jamui',
    hindiName: 'जमुई',
    pinPrefix: '811307',
    topBeat: 'Kiul Basin, Mining & Solar Grid',
    activeDesks: 8,
    queryTerm: 'Jamui',
    keywords: ['jamui', 'जमुई', 'jhajha', 'झाझा', 'sikandra', 'सिकंदरा', 'chakai', 'चकाई'],
  },
  {
    id: 'Jehanabad',
    hindiName: 'जहानाबाद',
    pinPrefix: '804408',
    topBeat: 'Patna-Gaya Rail & Barabar Heritage',
    activeDesks: 8,
    queryTerm: 'Jehanabad',
    keywords: ['jehanabad', 'जहानाबाद', 'makhdumpur', 'मखदुमपुर', 'ghosi', 'घोसी'],
  },
  {
    id: 'Kaimur (Bhabua)',
    hindiName: 'कैमूर (भभुआ)',
    pinPrefix: '821101',
    topBeat: 'Vindhya Hills, Mohania NH-2 & Mandi',
    activeDesks: 8,
    queryTerm: 'Kaimur Bhabua',
    keywords: ['kaimur', 'bhabua', 'कैमूर', 'भभुआ', 'mohania', 'मोहनिया', 'kudra', 'कुदरा'],
  },
  {
    id: 'Katihar',
    hindiName: 'कटिहार',
    pinPrefix: '854105',
    topBeat: 'Katihar Rail Division & Mahananda Bund',
    activeDesks: 11,
    queryTerm: 'Katihar',
    keywords: ['katihar', 'कटिहार', 'barsoi', 'बारसोई', 'manihari', 'मनिहारी'],
  },
  {
    id: 'Khagaria',
    hindiName: 'खगड़िया',
    pinPrefix: '851204',
    topBeat: 'Kosi-Bagmati Bridges & Maize Hub',
    activeDesks: 8,
    queryTerm: 'Khagaria',
    keywords: ['khagaria', 'खगड़िया', 'gogri', 'गोगरी', 'alauli', 'अलौली'],
  },
  {
    id: 'Kishanganj',
    hindiName: 'किशनगंज',
    pinPrefix: '855107',
    topBeat: 'Tea Gardens, Pineapple & Border Rail',
    activeDesks: 9,
    queryTerm: 'Kishanganj',
    keywords: ['kishanganj', 'किशनगंज', 'thakurganj', 'ठाकुरगंज', 'bahadurganj', 'बहादुरगंज'],
  },
  {
    id: 'Lakhisarai',
    hindiName: 'लखीसराय',
    pinPrefix: '811311',
    topBeat: 'Kiul Junction & Kiul River Water Grid',
    activeDesks: 7,
    queryTerm: 'Lakhisarai',
    keywords: ['lakhisarai', 'लखीसराय', 'kiul', 'किऊल', 'barahiya', 'बड़हिया'],
  },
  {
    id: 'Madhepura',
    hindiName: 'मधेपुरा',
    pinPrefix: '852113',
    topBeat: 'Electric Loco Factory & Kosi Drainage',
    activeDesks: 8,
    queryTerm: 'Madhepura',
    keywords: ['madhepura', 'मधेपुरा', 'uda kishunganj', 'उदाकिशुनगंज', 'murliganj', 'मुरलीगंज'],
  },
  {
    id: 'Madhubani',
    hindiName: 'मधुबनी',
    pinPrefix: '847211',
    topBeat: 'Mithila Craft Clusters & Jhanjharpur Rail',
    activeDesks: 12,
    queryTerm: 'Madhubani',
    keywords: ['madhubani', 'मधुबनी', 'jhanjharpur', 'झंझारपुर', 'jaynagar', 'जयनगर', 'benipatti', 'बेनीपट्टी'],
  },
  {
    id: 'Munger',
    hindiName: 'मुंगेर',
    pinPrefix: '811201',
    topBeat: 'Srikrishna Setu, Yoga & Jamalpur Rail',
    activeDesks: 11,
    queryTerm: 'Munger',
    keywords: ['munger', 'मुंगेर', 'jamalpur', 'जमालपुर', 'tarapur', 'तारापुर', 'kharagpur', 'खड़गपुर'],
  },
  {
    id: 'Muzaffarpur',
    hindiName: 'मुजफ्फरपुर',
    pinPrefix: '842001',
    topBeat: 'Agri-Logistics, Bridges & Smart City',
    activeDesks: 16,
    queryTerm: 'Muzaffarpur',
    keywords: ['muzaffarpur', 'मुजफ्फरपुर', 'मुज़फ्फरपुर', 'motipur', 'मोतीपुर', 'kanti', 'कांटी', 'saraiya', 'सरैया'],
  },
  {
    id: 'Nalanda',
    hindiName: 'नालंदा',
    pinPrefix: '803101',
    topBeat: 'Bihar Sharif Smart City & Rajgir',
    activeDesks: 13,
    queryTerm: 'Nalanda Bihar Sharif',
    keywords: ['nalanda', 'नालंदा', 'bihar sharif', 'biharsharif', 'बिहारशरीफ', 'बिहार शरीफ', 'rajgir', 'राजगीर', 'hilsa', 'हिलसा'],
  },
  {
    id: 'Nawada',
    hindiName: 'नवादा',
    pinPrefix: '805110',
    topBeat: 'Ganga Water Supply & Kakolat Eco',
    activeDesks: 9,
    queryTerm: 'Nawada',
    keywords: ['nawada', 'नवादा', 'rajauli', 'रजौली', 'hisua', 'हिसुआ', 'warsaliganj', 'वारिसलीगंज'],
  },
  {
    id: 'Patna',
    hindiName: 'पटना',
    pinPrefix: '800001',
    topBeat: 'Metro, Ganga Path & State Capital',
    activeDesks: 24,
    queryTerm: 'Patna',
    keywords: ['patna', 'पटना', 'danapur', 'दानापुर', 'bihta', 'बिहटा', 'barhi', 'बाढ़', 'mokama', 'मोकामा'],
  },
  {
    id: 'Purnia',
    hindiName: 'पूर्णिया',
    pinPrefix: '854301',
    topBeat: 'Seemanchal Airport, Maize & NH-31',
    activeDesks: 13,
    queryTerm: 'Purnia',
    keywords: ['purnia', 'purnea', 'पूर्णिया', 'बनमनखी', 'banmankhi', 'kasba', 'कसबा', 'dhamdaha', 'धमदाहा'],
  },
  {
    id: 'Rohtas',
    hindiName: 'रोहतास',
    pinPrefix: '821115',
    topBeat: 'Sasaram, Dehri-on-Sone & Rice Bowl',
    activeDesks: 11,
    queryTerm: 'Rohtas Sasaram',
    keywords: ['rohtas', 'रोहतास', 'sasaram', 'सासाराम', 'dehri', 'डेहरी', 'bikramganj', 'बिक्रमगंज'],
  },
  {
    id: 'Saharsa',
    hindiName: 'सहरसा',
    pinPrefix: '852201',
    topBeat: 'Kosi Division HQ & Rail Overbridges',
    activeDesks: 10,
    queryTerm: 'Saharsa',
    keywords: ['saharsa', 'सहरसा', 'simri bakhtiarpur', 'सिमरी बख्तियारपुर', 'sonbarsa', 'सोनबरसा'],
  },
  {
    id: 'Samastipur',
    hindiName: 'समस्तीपुर',
    pinPrefix: '848101',
    topBeat: 'Pusa Agri Campus & Rail Division',
    activeDesks: 12,
    queryTerm: 'Samastipur',
    keywords: ['samastipur', 'समस्तीपुर', 'rosera', 'रोसड़ा', 'dalsinghsarai', 'दलसिंहसराय', 'pusa', 'पूसा'],
  },
  {
    id: 'Saran (Chhapra)',
    hindiName: 'सारण (छपरा)',
    pinPrefix: '841301',
    topBeat: 'Chhapra Ring Road, Rail Wheel & Sonepur',
    activeDesks: 13,
    queryTerm: 'Chhapra Saran',
    keywords: ['saran', 'chhapra', 'chapra', 'सारण', 'छपरा', 'sonepur', 'सोनपुर', 'marhaura', 'मढ़ौरा'],
  },
  {
    id: 'Sheikhpura',
    hindiName: 'शेखपुरा',
    pinPrefix: '811105',
    topBeat: 'Stone Mining Safety & Rural Water',
    activeDesks: 6,
    queryTerm: 'Sheikhpura',
    keywords: ['sheikhpura', 'शेखपुरा', 'barbigha', 'बरबीघा'],
  },
  {
    id: 'Sheohar',
    hindiName: 'शिवहर',
    pinPrefix: '843329',
    topBeat: 'Bagmati Flood Embankment & NH-104',
    activeDesks: 6,
    queryTerm: 'Sheohar',
    keywords: ['sheohar', 'शिवहर', 'piprahi', 'पिपराही', 'tariyani', 'तरियानी'],
  },
  {
    id: 'Sitamarhi',
    hindiName: 'सीतामढ़ी',
    pinPrefix: '843302',
    topBeat: 'Punaura Dham Corridor & Border NH',
    activeDesks: 11,
    queryTerm: 'Sitamarhi',
    keywords: ['sitamarhi', 'सीतामढ़ी', 'punaura', 'पुनौरा', 'bairgania', 'बैरगनिया', 'pupri', 'पुपरी'],
  },
  {
    id: 'Siwan',
    hindiName: 'सिवान',
    pinPrefix: '841226',
    topBeat: 'Siwan Junction, Civic Bypass & Health',
    activeDesks: 11,
    queryTerm: 'Siwan',
    keywords: ['siwan', 'सिवान', 'सीवान', 'maharajganj', 'महाराजगंज', 'mairwa', 'मैरवा'],
  },
  {
    id: 'Supaul',
    hindiName: 'सुपौल',
    pinPrefix: '852131',
    topBeat: 'Bakaur-Kosi Mega Bridge & Solar Grid',
    activeDesks: 9,
    queryTerm: 'Supaul',
    keywords: ['supaul', 'सुपौल', 'birpur', 'बीरपुर', 'triveniganj', 'त्रिवेणीगंज', 'nirmali', 'निर्मली'],
  },
  {
    id: 'Vaishali',
    hindiName: 'वैशाली',
    pinPrefix: '844101',
    topBeat: 'Hajipur Banana Cluster & Gandhi Setu',
    activeDesks: 13,
    queryTerm: 'Vaishali Hajipur',
    keywords: ['vaishali', 'वैशाली', 'hajipur', 'हाजीपुर', 'mahnar', 'महनार', 'mahua', 'महुआ', 'lalganj', 'लालगंज'],
  },
  {
    id: 'West Champaran (Bettiah)',
    hindiName: 'पश्चिम चंपारण (बेतिया)',
    pinPrefix: '845438',
    topBeat: 'Valmiki Tiger Reserve, Bettiah & Cane',
    activeDesks: 12,
    queryTerm: 'Bettiah West Champaran',
    keywords: ['west champaran', 'bettiah', 'पश्चिम चंपारण', 'बेतिया', 'bagaha', 'बगहा', 'narkatiaganj', 'नरकटियागंज'],
  },
];

function buildBiharSummary(seed: BiharDistrictSeed): Record<LanguageCode, string> {
  return {
    en: `Live civic updates, ${seed.topBeat.toLowerCase()}, and verified ground bulletins from ${seed.id}, Bihar.`,
    hi: `${seed.hindiName} जिले के ${seed.topBeat} और प्रशासनिक विकास से जुड़े ताज़ा लाइव समाचार।`,
    bho: `${seed.hindiName} जिला के सड़क, बिजली, खेती आ प्रशासन से जुड़ल ताजा स्थानीय खबर।`,
    mr: `${seed.id}, बिहार येथील स्थानिक प्रशासन, पायाभूत सुविधा व हवामान विषयक ताज्या बातम्या.`,
    ta: `${seed.id}, பீகார் மாவட்டத்தின் உள்ளூர் நிர்வாகம் மற்றும் வளர்ச்சிப் பணிகள் குறித்த நேரடி செய்திகள்.`,
    bn: `${seed.id}, বিহার জেলার স্থানীয় প্রশাসন, পরিকাঠামো ও নাগরিক পরিষেবার লাইভ সংবাদ।`,
  };
}

export const BIHAR_DISTRICTS: DistrictMeta[] = BIHAR_DISTRICT_SEEDS.map((seed) => ({
  id: seed.id,
  state: 'Bihar',
  hindiName: seed.hindiName,
  group: 'bihar',
  pinPrefix: seed.pinPrefix,
  activeDesks: seed.activeDesks,
  topBeat: seed.topBeat,
  summary: buildBiharSummary(seed),
}));

export const METRO_DISTRICTS: DistrictMeta[] = [
  {
    id: 'Delhi',
    state: 'NCT Delhi',
    hindiName: 'दिल्ली',
    group: 'metro',
    pinPrefix: '110001',
    activeDesks: 34,
    topBeat: 'Education & Smart Campuses',
    summary: {
      en: 'Public STEM smart-labs, Pink Line metro student passes, and solar school roofs.',
      hi: 'सरकारी स्कूल स्मार्ट-लैब, मेट्रो छात्र पास और सौर ऊर्जा संचालित परिसर अपडेट।',
      bho: 'दिल्ली सरकारी स्कूल स्मार्ट लैब, मेट्रो छात्र पास आ सोलर कैंपस के ताजा खबर।',
      mr: 'शासकीय शाळा स्मार्ट-लॅब, मेट्रो विद्यार्थी पास आणि सौर शाळा प्रकल्प.',
      ta: 'அரசுப் பள்ளி ஸ்மார்ட் ஆய்வகங்கள், மெட்ரோ மாணவர் பாஸ் மற்றும் சூரிய சக்தி வளாகங்கள்.',
      bn: 'সরকারি স্কুল স্মার্ট-ল্যাব, মেট্রো ছাত্র পাস এবং সোলার ক্যাম্পাস আপডেট।',
    },
  },
  {
    id: 'Mumbai',
    state: 'Maharashtra',
    hindiName: 'मुंबई',
    group: 'metro',
    pinPrefix: '400001',
    activeDesks: 31,
    topBeat: 'Coastal Mobility & Monsoon',
    summary: {
      en: 'Coastal Road high-tide advisories, BEST electric feeder buses, and harbour rail alerts.',
      hi: 'कोस्टल रोड हाई-टाइड अलर्ट, बेस्ट इलेक्ट्रिक बस रूट और लोकल ट्रेन अपडेट।',
      bho: 'मुंबई कोस्टल रोड बारिश अलर्ट, इलेक्ट्रिक बस आ लोकल ट्रेन के ताजा स्थिति।',
      mr: 'कोस्टल रोड हाय-टाईड सूचना, बेस्ट इलेक्ट्रिक फीडर बस आणि लोकल वेळापत्रक.',
      ta: 'மும்பை கடற்கரை சாலை உயர் அலை எச்சரிக்கை, மின்சார பேருந்து மற்றும் ரயில் தகவல்.',
      bn: 'মুম্বাই কোস্টাল রোড জোয়ার সতর্কতা, ইলেকট্রিক বাস ও লোকাল ট্রেন আপডেট।',
    },
  },
  {
    id: 'Bengaluru',
    state: 'Karnataka',
    hindiName: 'बेंगलुरु',
    group: 'metro',
    pinPrefix: '560001',
    activeDesks: 26,
    topBeat: 'Lake Ecology & Suburban Rail',
    summary: {
      en: 'East Bengaluru lake rejuvenation sensors, Namma Metro feeder loops, and ward water.',
      hi: 'पूर्वी बेंगलुरु झील पुनरुद्धार सेंसर, नम्मा मेट्रो फीडर और वार्ड जल आपूर्ति।',
      bho: 'बेंगलुरु झील सफाई सेंसर, मेट्रो फीडर बस आ मोहल्ला पानी आपूर्ति के खबर।',
      mr: 'पूर्व बेंगळुरू तलाव पुनरुज्जीवन, नम्मा मेट्रो फीडर सेवा आणि पाणीपुरवठा.',
      ta: 'கிழக்கு பெங்களூரு ஏரி புனரமைப்பு, நம்ம மெட்ரோ இணைப்புப் பேருந்து மற்றும் குடிநீர்.',
      bn: 'পূর্ব বেঙ্গালুরু হ্রদ পুনরুজ্জীবন, নাম্মা মেট্রো ফিডার বাস ও পানীয় জল আপডেট।',
    },
  },
  {
    id: 'Chennai',
    state: 'Tamil Nadu',
    hindiName: 'चेन्नई',
    group: 'metro',
    pinPrefix: '600001',
    activeDesks: 19,
    topBeat: 'Solar Transit & Coastal Grid',
    summary: {
      en: 'MTC solar-roofed coastal bus shelters, zero-emission fleet expansion, and Marina lanes.',
      hi: 'चेन्नई एमटीसी सोलर बस शेल्टर, इलेक्ट्रिक बस बेड़ा और मरीना तटीय कॉरिडोर।',
      bho: 'चेन्नई में सौर ऊर्जा से चले वाला बस स्टैंड आ बिजली बस सेवा के विस्तार।',
      mr: 'चेन्नई एमटीसी सौर बस थांबे, इलेक्ट्रिक बस ताफा आणि मरीना किनारी मार्ग.',
      ta: 'சென்னை எம்டிசி சூரிய சக்தி பேருந்து நிறுத்தங்கள், மின்சாரப் பேருந்துகள் மற்றும் மெரினா வழித்தடம்.',
      bn: 'চেন্নাই এমটিসি সোলার বাস স্টপ, ইলেকট্রিক বাস বহর ও মেরিনা উপকূলীয় রুট।',
    },
  },
];

export const ALL_PRESET_DISTRICTS: DistrictMeta[] = [
  ...BIHAR_DISTRICTS,
  ...METRO_DISTRICTS,
];

const SEED_LOOKUP = new Map(
  BIHAR_DISTRICT_SEEDS.map((s) => [s.id.toLowerCase(), s])
);

export function getDistrictSeedMeta(districtId: string): {
  hindiName: string;
  queryTerm: string;
  keywords: string[];
  pinPrefix: string;
  topBeat: string;
} {
  const seed = SEED_LOOKUP.get(districtId.toLowerCase());
  if (seed) {
    return {
      hindiName: seed.hindiName,
      queryTerm: seed.queryTerm,
      keywords: seed.keywords,
      pinPrefix: seed.pinPrefix,
      topBeat: seed.topBeat,
    };
  }
  const clean = districtId.replace(/\s*\([^)]*\)/g, '').trim();
  const metro = METRO_DISTRICTS.find((m) => m.id.toLowerCase() === districtId.toLowerCase());
  const metroKeywords: Record<string, string[]> = {
    delhi: ['delhi', 'new delhi', 'दिल्ली', 'नई दिल्ली', 'dmrc'],
    mumbai: ['mumbai', 'bombay', 'मुंबई', 'मुम्बई', 'bmc', 'worli', 'bandra'],
    bengaluru: ['bengaluru', 'bangalore', 'बेंगलुरु', 'बैंगलोर', 'bbmp', 'namma metro'],
    chennai: ['chennai', 'madras', 'चेन्नई', 'मद्रास', 'gcc', 'mtc'],
  };
  const extra = metroKeywords[clean.toLowerCase()] || [];
  return {
    hindiName: metro?.hindiName || clean,
    queryTerm: clean,
    keywords: Array.from(new Set([clean.toLowerCase(), districtId.toLowerCase(), ...extra])),
    pinPrefix: metro?.pinPrefix || '800001',
    topBeat: metro?.topBeat || 'Local Administration & Infrastructure',
  };
}
