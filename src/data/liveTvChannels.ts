import { LiveTvCategory, LiveTvChannel, LiveTvStreamType } from '../types';

export function inferLiveTvStreamType(
  streamUrl: string,
  explicitType?: LiveTvStreamType
): LiveTvStreamType {
  if (explicitType === 'hls' || explicitType === 'youtube') {
    return explicitType;
  }
  return /\.m3u8(\?.*)?$/i.test(streamUrl.trim()) ? 'hls' : 'youtube';
}

function makeHlsChannel(
  id: string,
  name: string,
  category: LiveTvCategory,
  regionLabel: string,
  languageLabel: string,
  streamUrl: string,
  watchUrl: string,
  backupStreamUrl?: string,
  backupType?: LiveTvStreamType,
  youtubeChannelId?: string,
  district?: string
): LiveTvChannel {
  return {
    id,
    name,
    category,
    district:
      district ||
      (category === 'local'
        ? 'ALL_BIHAR'
        : category === 'national'
        ? 'NATIONAL'
        : 'INTERNATIONAL'),
    type: 'hls',
    regionLabel,
    languageLabel,
    youtubeChannelId,
    streamUrl,
    backupStreamUrl,
    backupType: backupStreamUrl ? backupType || inferLiveTvStreamType(backupStreamUrl) : undefined,
    watchUrl,
    isCustom: false,
  };
}

function makeYouTubeChannel(
  id: string,
  name: string,
  category: LiveTvCategory,
  regionLabel: string,
  languageLabel: string,
  embedUrl: string,
  watchUrl: string,
  backupStreamUrl?: string,
  backupType?: LiveTvStreamType,
  youtubeChannelId?: string,
  district?: string
): LiveTvChannel {
  return {
    id,
    name,
    category,
    district:
      district ||
      (category === 'local'
        ? 'ALL_BIHAR'
        : category === 'national'
        ? 'NATIONAL'
        : 'INTERNATIONAL'),
    type: 'youtube',
    regionLabel,
    languageLabel,
    youtubeChannelId,
    streamUrl: embedUrl,
    backupStreamUrl,
    backupType: backupStreamUrl ? backupType || inferLiveTvStreamType(backupStreamUrl) : undefined,
    watchUrl,
    isCustom: false,
  };
}

export const DEFAULT_LIVE_TV_CHANNELS: LiveTvChannel[] = [
  // 1. LOCAL (District Cable & Bihar State Broadcasts)
  makeHlsChannel(
    'tv-patna-metro-desk',
    'Patna City Cable & Metro Desk',
    'local',
    'Patna District Cable',
    'Hindi / Magahi',
    'https://cdn.pishow.tv/ott/live/35/master.m3u8',
    'https://prasarbharati.gov.in/live-tv/',
    'https://mumbai-edge.smartplaytv.in/DDNews/index.m3u8',
    'hls',
    undefined,
    'Patna'
  ),
  makeHlsChannel(
    'tv-muz-tirhut-cable',
    'Tirhut Muzaffarpur Local TV',
    'local',
    'Muzaffarpur District Cable',
    'Hindi / Bajjika',
    'https://cdn.pishow.tv/ott/live/35/master.m3u8',
    'https://www.youtube.com/@BiharTak/live',
    'https://mumbai-edge.smartplaytv.in/DDNews/index.m3u8',
    'hls',
    undefined,
    'Muzaffarpur'
  ),
  makeHlsChannel(
    'tv-dd-bihar',
    'DD Bihar Live',
    'local',
    'All Bihar State Broadcast',
    'Hindi / Bhojpuri',
    'https://cdn.pishow.tv/ott/live/35/master.m3u8',
    'https://prasarbharati.gov.in/live-tv/',
    'https://mumbai-edge.smartplaytv.in/DDNews/index.m3u8',
    'hls',
    undefined,
    'ALL_BIHAR'
  ),
  makeHlsChannel(
    'tv-news18-bihar',
    'News18 Bihar Jharkhand',
    'local',
    'All Bihar & Jharkhand',
    'Hindi',
    'https://n18syndication.akamaized.net/bpk-tv/News18_Bihar_Jharkhand_NW18_MOB/output01/master.m3u8',
    'https://www.youtube.com/channel/UC531MlZA5LUbeGwEN_zcppw/live',
    'https://www.youtube.com/embed?listType=playlist&list=UU531MlZA5LUbeGwEN_zcppw&autoplay=1&rel=0',
    'youtube',
    'UC531MlZA5LUbeGwEN_zcppw',
    'ALL_BIHAR'
  ),
  makeHlsChannel(
    'tv-zee-bihar',
    'Zee Bihar Jharkhand',
    'local',
    'All Bihar & Jharkhand',
    'Hindi',
    'https://raw.githubusercontent.com/amazeyourself/adaptive-streams/refs/heads/main/streams/in/YuppTV/ZeeBiharJharkhand.m3u8',
    'https://www.youtube.com/channel/UCZUjHLJivN0OZPC_Wj8JvkA/live',
    'https://www.youtube.com/embed?listType=playlist&list=UUZUjHLJivN0OZPC_Wj8JvkA&autoplay=1&rel=0',
    'youtube',
    'UCZUjHLJivN0OZPC_Wj8JvkA',
    'ALL_BIHAR'
  ),
  makeYouTubeChannel(
    'tv-bihar-tak',
    'Bihar Tak Live Desk',
    'local',
    'All Bihar Digital Desk',
    'Hindi / Bhojpuri',
    'https://www.youtube.com/embed?listType=playlist&list=UUnAp2J0bR9b8pM-Avp1GFOQ&autoplay=1&rel=0',
    'https://www.youtube.com/@BiharTak/live',
    'https://cdn.pishow.tv/ott/live/35/master.m3u8',
    'hls',
    'UCnAp2J0bR9b8pM-Avp1GFOQ',
    'ALL_BIHAR'
  ),

  // 2. NATIONAL (India 24x7)
  makeHlsChannel(
    'tv-dd-news',
    'DD News (24x7 HLS)',
    'national',
    'India Public Broadcaster',
    'Hindi / English',
    'https://mumbai-edge.smartplaytv.in/DDNews/index.m3u8',
    'https://www.youtube.com/channel/UCKwucPzHZ7zCUIf7If-Wo1g/live',
    'https://fta.ektv.in/live/117/117_0.m3u8',
    'hls',
    'UCKwucPzHZ7zCUIf7If-Wo1g',
    'NATIONAL'
  ),
  makeHlsChannel(
    'tv-dd-india',
    'DD India (English)',
    'national',
    'India Global Desk',
    'English',
    'https://fta.ektv.in/live/119/119_0.m3u8',
    'https://prasarbharati.gov.in/live-tv/',
    'https://mumbai-edge.smartplaytv.in/DDNews/index.m3u8',
    'hls',
    undefined,
    'NATIONAL'
  ),
  makeHlsChannel(
    'tv-sansad-tv',
    'Sansad TV Live',
    'national',
    'Parliament Broadcast',
    'Hindi / English',
    'https://d2lk5u59tns74c.cloudfront.net/out/v1/e4182054dce340da9e0ff38b6b3658a4/index.m3u8',
    'https://webcast.gov.in/',
    'https://d2lk5u59tns74c.cloudfront.net/out/v1/fff8f20221d5456e8922e689d71dedc3/index.m3u8',
    'hls',
    undefined,
    'NATIONAL'
  ),
  makeHlsChannel(
    'tv-aaj-tak',
    'Aaj Tak Live',
    'national',
    'India 24x7',
    'Hindi',
    'https://d1rc86nwwc9fag.cloudfront.net/vglive-sk-791258/master.m3u8',
    'https://www.youtube.com/channel/UCt4t-jeY85JegMlZ-E5UWtA/live',
    'https://www.youtube.com/embed?listType=playlist&list=UUt4t-jeY85JegMlZ-E5UWtA&autoplay=1&rel=0',
    'youtube',
    'UCt4t-jeY85JegMlZ-E5UWtA',
    'NATIONAL'
  ),
  makeHlsChannel(
    'tv-ndtv-india',
    'NDTV India',
    'national',
    'India 24x7',
    'Hindi',
    'https://backupndtvindiaelemarchana.akamaized.net/hls/live/2004134/ndtvindia/master_1.m3u8',
    'https://www.youtube.com/channel/UC9CYT9gSNLevX5ey2_6CK0Q/live',
    'https://www.youtube.com/embed?listType=playlist&list=UU9CYT9gSNLevX5ey2_6CK0Q&autoplay=1&rel=0',
    'youtube',
    'UC9CYT9gSNLevX5ey2_6CK0Q',
    'NATIONAL'
  ),

  // 3. INTERNATIONAL (Global 24x7 HLS)
  makeHlsChannel(
    'tv-aljazeera',
    'Al Jazeera English',
    'international',
    'World Desk',
    'English',
    'https://live-hls-apps-aje-fa.getaj.net/AJE/index.m3u8',
    'https://www.youtube.com/channel/UCNye-wNBqNL5ZzHSJj3l8Bg/live',
    'https://live-hls-web-aje.getaj.net/AJE/index.m3u8',
    'hls',
    'UCNye-wNBqNL5ZzHSJj3l8Bg',
    'INTERNATIONAL'
  ),
  makeHlsChannel(
    'tv-dw-news',
    'DW News English',
    'international',
    'Europe & World',
    'English',
    'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8',
    'https://www.youtube.com/channel/UCknLrEdhRCp1aegoMqRaCZg/live',
    'https://www.youtube.com/embed?listType=playlist&list=UUknLrEdhRCp1aegoMqRaCZg&autoplay=1&rel=0',
    'youtube',
    'UCknLrEdhRCp1aegoMqRaCZg',
    'INTERNATIONAL'
  ),
  makeHlsChannel(
    'tv-france24',
    'France 24 English',
    'international',
    'Global Affairs',
    'English',
    'https://amg00106-france24-france24-samsunguk-qvpp8.amagi.tv/playlist/amg00106-france24-france24-samsunguk/playlist.m3u8',
    'https://www.youtube.com/channel/UCQfwfsi5VrQ8yKZ-UWmAEFg/live',
    'https://www.youtube.com/embed?listType=playlist&list=UUQfwfsi5VrQ8yKZ-UWmAEFg&autoplay=1&rel=0',
    'youtube',
    'UCQfwfsi5VrQ8yKZ-UWmAEFg',
    'INTERNATIONAL'
  ),
  makeHlsChannel(
    'tv-wion',
    'WION World News',
    'international',
    'Global News Network',
    'English',
    'https://vg-zeefta.akamaized.net/ptnr-yupptv/title-wion/v1/master/611d79b11b77e2f571934fd80ca1413453772ac7/20c3c0d9-0256-43fe-bca6-70fdd490b957/main.m3u8',
    'https://www.youtube.com/channel/UC_gUM8rL-Lrg6O3adPW9K1g/live',
    'https://www.youtube.com/embed?listType=playlist&list=UU_gUM8rL-Lrg6O3adPW9K1g&autoplay=1&rel=0',
    'youtube',
    'UC_gUM8rL-Lrg6O3adPW9K1g',
    'INTERNATIONAL'
  ),
];

export function resolveLiveTvStreamSource(rawInput: string): {
  ok: boolean;
  type?: LiveTvStreamType;
  youtubeChannelId?: string;
  youtubeVideoId?: string;
  streamUrl?: string;
  watchUrl?: string;
  error?: string;
} {
  const input = rawInput.trim();
  if (!input) {
    return {
      ok: false,
      error: 'Enter an HLS (.m3u8) URL, YouTube video link (watch?v= / youtu.be/), or Channel ID (UC...).',
    };
  }

  // Raw 11-character YouTube Video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
    return {
      ok: true,
      type: 'youtube',
      youtubeVideoId: input,
      streamUrl: `https://www.youtube.com/embed/${encodeURIComponent(input)}?autoplay=1&rel=0&playsinline=1`,
      watchUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(input)}`,
    };
  }

  // Raw YouTube Channel ID (starts with UC)
  if (/^UC[a-zA-Z0-9_-]{12,40}$/.test(input)) {
    const uploadsPlaylist = `UU${input.slice(2)}`;
    return {
      ok: true,
      type: 'youtube',
      youtubeChannelId: input,
      streamUrl: `https://www.youtube.com/embed?listType=playlist&list=${encodeURIComponent(uploadsPlaylist)}&autoplay=1&rel=0`,
      watchUrl: `https://www.youtube.com/channel/${encodeURIComponent(input)}/live`,
    };
  }

  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return { ok: false, error: 'Stream URL must begin with https://' };
    }

    const host = url.hostname.toLowerCase();
    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      // /channel/UC...
      const channelMatch = url.pathname.match(/\/channel\/(UC[a-zA-Z0-9_-]{12,40})/i);
      if (channelMatch) {
        const chId = channelMatch[1];
        const uploadsPlaylist = `UU${chId.slice(2)}`;
        return {
          ok: true,
          type: 'youtube',
          youtubeChannelId: chId,
          streamUrl: `https://www.youtube.com/embed?listType=playlist&list=${encodeURIComponent(uploadsPlaylist)}&autoplay=1&rel=0`,
          watchUrl: `https://www.youtube.com/channel/${encodeURIComponent(chId)}/live`,
        };
      }

      // /embed/live_stream?channel=UC...
      const queryChannel = url.searchParams.get('channel');
      if (queryChannel && /^UC[a-zA-Z0-9_-]{12,40}$/.test(queryChannel)) {
        const uploadsPlaylist = `UU${queryChannel.slice(2)}`;
        return {
          ok: true,
          type: 'youtube',
          youtubeChannelId: queryChannel,
          streamUrl: `https://www.youtube.com/embed?listType=playlist&list=${encodeURIComponent(uploadsPlaylist)}&autoplay=1&rel=0`,
          watchUrl: `https://www.youtube.com/channel/${encodeURIComponent(queryChannel)}/live`,
        };
      }

      // Extract 11-char video ID from v=, youtu.be/, /live/, /embed/, /shorts/
      let videoId = url.searchParams.get('v') || '';
      if (!videoId && host.includes('youtu.be')) {
        videoId = url.pathname.replace(/^\//, '').split('/')[0] || '';
      }
      if (!videoId) {
        const pathMatch = url.pathname.match(/\/(?:live|embed|shorts|v)\/([a-zA-Z0-9_-]{11})/);
        if (pathMatch) videoId = pathMatch[1];
      }
      if (!videoId) {
        const genericMatch = url.pathname.match(/\/(?:live|embed|shorts)\/([a-zA-Z0-9_-]{6,20})/);
        if (genericMatch) videoId = genericMatch[1];
      }

      if (videoId && /^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
        return {
          ok: true,
          type: 'youtube',
          youtubeVideoId: videoId,
          streamUrl: `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0&playsinline=1`,
          watchUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
        };
      }

      return {
        ok: false,
        error:
          'Could not extract YouTube Video ID or Channel ID. Paste a watch?v=..., youtu.be/..., or .m3u8 link.',
      };
    }

    const isHls = /\.m3u8(\?.*)?$/i.test(url.pathname + url.search);
    return {
      ok: true,
      type: isHls ? 'hls' : 'youtube',
      streamUrl: url.toString(),
      watchUrl: url.toString(),
    };
  } catch {
    return {
      ok: false,
      error: 'Enter a valid .m3u8 HLS URL or YouTube link (youtube.com/watch?v=... or youtu.be/...).',
    };
  }
}
