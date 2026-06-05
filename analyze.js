const fs = require('fs');

const path = 'extracted/Takeout/YouTube 및 YouTube Music/시청 기록/시청 기록.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

const total = data.length;

// KST(UTC+9) 기준으로 변환
function toKST(iso) {
  return new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
}

let withChannel = 0, ads = 0, removed = 0;
const channelCount = {};
const monthCount = {};
const hourCount = new Array(24).fill(0);
const dowCount = new Array(7).fill(0);
let minTime = null, maxTime = null;

for (const r of data) {
  // 광고 판별
  if (r.details && r.details.some(d => d.name === 'From Google Ads')) { ads++; }

  // 채널
  if (r.subtitles && r.subtitles.length) {
    const ch = r.subtitles[0].name;
    channelCount[ch] = (channelCount[ch] || 0) + 1;
    withChannel++;
  } else {
    removed++; // 삭제/비공개 영상은 보통 채널정보 없음
  }

  if (r.time) {
    const t = new Date(r.time);
    if (!minTime || t < minTime) minTime = t;
    if (!maxTime || t > maxTime) maxTime = t;
    const k = toKST(r.time);
    const ym = `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, '0')}`;
    monthCount[ym] = (monthCount[ym] || 0) + 1;
    hourCount[k.getUTCHours()]++;
    dowCount[k.getUTCDay()]++;
  }
}

console.log('='.repeat(60));
console.log('YouTube 시청 기록 분석');
console.log('='.repeat(60));
console.log(`총 시청 기록: ${total.toLocaleString()}건`);
console.log(`기간: ${minTime.toISOString().slice(0,10)} ~ ${maxTime.toISOString().slice(0,10)}`);
const days = Math.round((maxTime - minTime) / 86400000);
console.log(`총 ${days.toLocaleString()}일 (약 ${(days/365).toFixed(1)}년), 하루 평균 ${(total/days).toFixed(1)}건`);
console.log(`광고 시청: ${ads.toLocaleString()}건`);
console.log(`채널 정보 없음(삭제/비공개 추정): ${removed.toLocaleString()}건`);
console.log(`고유 채널 수: ${Object.keys(channelCount).length.toLocaleString()}개`);

console.log('\n── 최다 시청 채널 TOP 20 ──');
Object.entries(channelCount).sort((a,b)=>b[1]-a[1]).slice(0,20).forEach(([ch,c],i)=>{
  console.log(`${String(i+1).padStart(2)}. ${String(c).padStart(5)}건  ${ch}`);
});

console.log('\n── 시간대별 시청(KST) ──');
const maxH = Math.max(...hourCount);
for (let h=0; h<24; h++){
  const bar = '█'.repeat(Math.round(hourCount[h]/maxH*30));
  console.log(`${String(h).padStart(2,'0')}시  ${String(hourCount[h]).padStart(5)}  ${bar}`);
}

console.log('\n── 요일별 시청(KST) ──');
const dow = ['일','월','화','수','목','금','토'];
const maxD = Math.max(...dowCount);
for (let d=0; d<7; d++){
  const bar = '█'.repeat(Math.round(dowCount[d]/maxD*30));
  console.log(`${dow[d]}  ${String(dowCount[d]).padStart(5)}  ${bar}`);
}

console.log('\n── 월별 시청량(최근 24개월) ──');
Object.entries(monthCount).sort().slice(-24).forEach(([m,c])=>{
  const bar = '█'.repeat(Math.round(c/Math.max(...Object.values(monthCount))*30));
  console.log(`${m}  ${String(c).padStart(5)}  ${bar}`);
});
