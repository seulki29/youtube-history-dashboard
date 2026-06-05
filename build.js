// Takeout 시청 기록 -> 집계 데이터(docs/data.json) 생성
// 원본 기록은 공개하지 않고, 대시보드에 필요한 통계만 추출한다.
const fs = require('fs');
const path = require('path');

const SRC = 'extracted/Takeout/YouTube 및 YouTube Music/시청 기록/시청 기록.json';
const OUT = 'docs/data.json';

// ── 추정 파라미터 ──────────────────────────────────────────────
const SHORT_MAX_SEC = 75;     // 다음 영상까지 간격이 이 값 이하면 Shorts(추정)
const SESSION_GAP_SEC = 1800;  // 30분 이상 비면 세션 종료로 간주
const TAIL_SEC = 300;          // 세션 마지막 영상의 시청 시간 기본값(5분)

// ── 분류 설정(키워드/채널) — 필요시 자유롭게 수정 ──────────────
// 채널명/제목에 키워드가 들어가면 해당 카테고리로 분류한다.
const CATEGORIES = [
  { cat: '괴수·특촬',   owner: '자인', kw: ['kaiju', '괴수', 'godzilla', '고질라', 'ultraman', '울트라', '특촬', 'tokusatsu', 'capi'] },
  { cat: '동물·파충류', owner: '자인', kw: ['파충류', 'reptile', '뱀', 'snake', '도마뱀', 'lizard', '거북', '동물', 'animal', '공룡', 'dino', '상어', 'shark', '곤충', '카멜레온'] },
  { cat: '예능·게임',   owner: '자인', kw: ['mrbeast', '키즈', 'kids', '마인크래프트', 'minecraft', '로블록스', 'roblox'] },
  { cat: '뉴스·시사',   owner: '아빠', kw: ['뉴스', 'news', 'mbc', 'jtbc', 'sbs', 'kbs', 'ytn', '정치', '시사', '스브스'] },
  { cat: '영어학습',     owner: '아빠', kw: ['영어', 'english', '브릿센트', 'punchline', '회화', '캘리쌤', 'half-asleep', '코믹한영어'] },
  { cat: '음악',         owner: '아빠', kw: ['music', '음악', 'official audio', 'poclanos', 'coachella', 'playlist', 'lyrics', 'mv)'] },
  { cat: '영화·리뷰',   owner: '함께', kw: ['영화', 'movie', '리뷰', '결말', '무비', '빨강도깨비'] },
  { cat: '함께보기',     owner: '함께', kw: [] },
  { cat: '축구·스포츠', owner: '자인', kw: ['축구', 'soccer', 'football', 'tottenham', 'man city', 'premier league', '손흥민', '스포츠', 'sports', '야구', '농구', '슛포러브', '아트사커', '쿠팡플레이'] },
  { cat: '당구',         owner: '아빠', kw: ['당구', 'billiard', 'pba', '조명우'] },
  { cat: '과학·지식',   owner: '아빠', kw: ['과학', 'science', '안될과학', '지식'] },
];

// 키워드로 안 잡히는 상위 채널 명시적 지정
const CHANNEL_OVERRIDE = {
  'Evolution Square': '괴수·특촬', 'Tuvok12': '괴수·특촬', '제노 플래쉬': '괴수·특촬',
  'TerraGreen': '괴수·특촬', '군림보': '괴수·특촬', '멍웃겨 리액션': '동물·파충류',
  '지식줄고양': '동물·파충류', '아기사슴소보로': '동물·파충류',
  '이제는 조명우시대': '당구', 'billiards_lupin': '당구',
  '쿠팡플레이 스포츠': '축구·스포츠', 'Tottenham Hotspur': '축구·스포츠', 'Man City': '축구·스포츠',
  'JK 아트사커 온라인': '축구·스포츠', '축구친구': '축구·스포츠', 'Premier League': '축구·스포츠',
  'Nauka Dryblingu - trener dryblingu Piłkarskiego1v1': '축구·스포츠',
  '무비띵크_Movie Think': '영화·리뷰', '무비체인': '영화·리뷰',
  '메밀묵도리': '예능·게임', '김진짜 Real KIM': '예능·게임', '김동댕': '예능·게임', '제발돼라 PleaseBee': '예능·게임',
  '자까': '함께보기',
  '슬기로운 정치생활': '뉴스·시사', 'POCLANOS': '음악', 'Coachella': '음악',
  'Half-Asleep Music': '음악', '브릿센트 x 영국영어': '영어학습',
};

const catByName = Object.fromEntries(CATEGORIES.map(c => [c.cat, c]));

function classify(channel, title) {
  const hay = `${channel || ''}  ${title || ''}`.toLowerCase();
  if (channel && CHANNEL_OVERRIDE[channel]) {
    const c = catByName[CHANNEL_OVERRIDE[channel]];
    return { cat: c.cat, owner: c.owner };
  }
  for (const c of CATEGORIES) {
    if (c.kw.some(k => hay.includes(k))) return { cat: c.cat, owner: c.owner };
  }
  return { cat: '기타', owner: '미분류' };
}

// KST 변환
const toKST = iso => new Date(new Date(iso).getTime() + 9 * 3600 * 1000);

// ── 처리 ───────────────────────────────────────────────────────
const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));

// 시간순 정렬 + 각 영상의 "다음까지 간격"으로 시청시간/타입 추정
const items = raw
  .filter(r => r.time)
  .map(r => ({
    t: new Date(r.time).getTime(),
    channel: r.subtitles && r.subtitles.length ? r.subtitles[0].name : null,
    title: (r.title || '').replace(/\s*을\(를\) 시청했습니다\.?$/, '').replace(/ 을\(를\) 시청했습니다\.?$/, ''),
  }))
  .sort((a, b) => a.t - b.t);

const OWNERS = ['자인', '아빠', '함께', '미분류'];
const blankOwner = () => Object.fromEntries(OWNERS.map(o => [o, 0]));

const types = { short: { count: 0, sec: 0 }, video: { count: 0, sec: 0 } };
const owners = Object.fromEntries(OWNERS.map(o => [o, { count: 0, sec: 0 }]));
const catAgg = {};
const channelAgg = {};
const monthly = {};
const hourly = Array.from({ length: 24 }, () => ({ count: 0, sec: 0, owner: blankOwner() }));
const dow = Array.from({ length: 7 }, () => ({ count: 0, sec: 0 }));
const channels = new Set();

for (let i = 0; i < items.length; i++) {
  const it = items[i];
  const next = items[i + 1];
  const gap = next ? (next.t - it.t) / 1000 : Infinity;

  let sec, type;
  if (gap <= SESSION_GAP_SEC) {
    sec = gap;
    type = gap <= SHORT_MAX_SEC ? 'short' : 'video';
  } else {
    // 세션 마지막 영상: 간격으로 길이를 알 수 없음 -> 일반영상 가정 + 기본 시청시간
    sec = TAIL_SEC;
    type = 'video';
  }

  const { cat, owner } = classify(it.channel, it.title);

  types[type].count++; types[type].sec += sec;
  owners[owner].count++; owners[owner].sec += sec;

  catAgg[cat] = catAgg[cat] || { cat, owner, count: 0, sec: 0 };
  catAgg[cat].count++; catAgg[cat].sec += sec;

  if (it.channel) {
    channels.add(it.channel);
    channelAgg[it.channel] = channelAgg[it.channel] || { name: it.channel, count: 0, sec: 0, owner };
    channelAgg[it.channel].count++; channelAgg[it.channel].sec += sec;
  }

  const k = toKST(it.t);
  const ym = `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, '0')}`;
  monthly[ym] = monthly[ym] || { ym, count: 0, sec: 0 };
  monthly[ym].count++; monthly[ym].sec += sec;

  const h = k.getUTCHours();
  hourly[h].count++; hourly[h].sec += sec; hourly[h].owner[owner]++;
  dow[k.getUTCDay()].count++; dow[k.getUTCDay()].sec += sec;
}

const min = Math.min(...items.map(i => i.t));
const max = Math.max(...items.map(i => i.t));
const days = Math.max(1, Math.round((max - min) / 86400000));

const round = n => Math.round(n);
const data = {
  meta: {
    total: items.length,
    from: new Date(min).toISOString().slice(0, 10),
    to: new Date(max).toISOString().slice(0, 10),
    days,
    perDay: +(items.length / days).toFixed(1),
    uniqueChannels: channels.size,
    totalMinutes: round(items.reduce((s, _, i) => s, 0)), // placeholder, set below
    generatedAt: new Date().toISOString().slice(0, 10),
    params: { SHORT_MAX_SEC, SESSION_GAP_SEC, TAIL_SEC },
  },
  types: {
    short: { count: types.short.count, minutes: round(types.short.sec / 60) },
    video: { count: types.video.count, minutes: round(types.video.sec / 60) },
  },
  owners: OWNERS.map(o => ({ owner: o, count: owners[o].count, minutes: round(owners[o].sec / 60) })),
  categories: Object.values(catAgg)
    .map(c => ({ cat: c.cat, owner: c.owner, count: c.count, minutes: round(c.sec / 60) }))
    .sort((a, b) => b.count - a.count),
  topChannels: Object.values(channelAgg)
    .sort((a, b) => b.count - a.count).slice(0, 30)
    .map(c => ({ name: c.name, count: c.count, minutes: round(c.sec / 60), owner: c.owner })),
  hourly: hourly.map((h, i) => ({ hour: i, count: h.count, minutes: round(h.sec / 60), owner: h.owner })),
  dow: dow.map((d, i) => ({ dow: i, count: d.count, minutes: round(d.sec / 60) })),
  monthly: Object.values(monthly).sort((a, b) => a.ym.localeCompare(b.ym))
    .map(m => ({ ym: m.ym, count: m.count, minutes: round(m.sec / 60) })),
};
data.meta.totalMinutes = data.types.short.minutes + data.types.video.minutes;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(data, null, 2), 'utf8');

// 콘솔 요약
const hrs = m => (m / 60).toFixed(0);
console.log(`총 ${data.meta.total.toLocaleString()}건 / ${data.meta.from}~${data.meta.to} (${days}일)`);
console.log(`Shorts ${data.types.short.count.toLocaleString()}건 ${hrs(data.types.short.minutes)}시간 | 영상 ${data.types.video.count.toLocaleString()}건 ${hrs(data.types.video.minutes)}시간`);
console.log(`총 추정 시청시간: ${hrs(data.meta.totalMinutes)}시간 (하루 평균 ${(data.meta.totalMinutes / days / 60).toFixed(1)}시간)`);
data.owners.forEach(o => console.log(`  ${o.owner}: ${o.count.toLocaleString()}건 / ${hrs(o.minutes)}시간`));
console.log(`-> ${OUT} 생성`);
