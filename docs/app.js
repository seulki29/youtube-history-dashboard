const C = {
  dad: '#4f8cff', jain: '#ff9f43', na: '#5a6072',
  short: '#ff4d6d', video: '#38d39f',
  ink: '#f2f3f7', muted: '#9aa0b0', grid: 'rgba(255,255,255,.06)',
};
const ownerColor = o => (o === '아빠' ? C.dad : o === '자인' ? C.jain : C.na);
const fmt = n => n.toLocaleString('ko-KR');
const hrs = m => (m / 60);
const fmtH = m => hrs(m) >= 10 ? Math.round(hrs(m)) : hrs(m).toFixed(1);

Chart.defaults.color = C.muted;
Chart.defaults.font.family = 'Pretendard, sans-serif';
Chart.defaults.font.size = 12;

fetch('data.json').then(r => r.json()).then(render);

function render(d) {
  // 기간 / 생성일
  document.getElementById('period').textContent =
    `${d.meta.from} – ${d.meta.to} · ${fmt(d.meta.days)}일간 · 총 ${fmt(d.meta.total)}건`;
  document.getElementById('gen').textContent = d.meta.generatedAt;

  // 핵심 지표
  const stats = [
    { label: '총 시청 영상', value: fmt(d.meta.total), unit: '건', delta: `하루 평균 ${d.meta.perDay}건` },
    { label: '추정 시청시간', value: fmt(Math.round(hrs(d.meta.totalMinutes))), unit: '시간', delta: `하루 평균 ${(hrs(d.meta.totalMinutes) / d.meta.days).toFixed(1)}시간` },
    { label: 'Shorts 비중', value: Math.round(d.types.short.count / d.meta.total * 100), unit: '%', delta: `${fmt(d.types.short.count)}건` },
    { label: '시청 채널 수', value: fmt(d.meta.uniqueChannels), unit: '개', delta: `TOP25가 큰 비중` },
  ];
  document.getElementById('stats').innerHTML = stats.map(s => `
    <div class="stat">
      <div class="label">${s.label}</div>
      <div class="value">${s.value}<small>${s.unit}</small></div>
      <div class="delta">${s.delta}</div>
    </div>`).join('');

  renderTypeDonut(d);
  renderOwners(d);
  renderCategories(d);
  renderHour(d);
  renderDow(d);
  renderMonth(d);
  renderChannels(d);
}

/* Shorts vs 영상 도넛 */
function renderTypeDonut(d) {
  const sc = d.types.short.count, vc = d.types.video.count;
  new Chart(document.getElementById('typeDonut'), {
    type: 'doughnut',
    data: { labels: ['Shorts', '영상'], datasets: [{ data: [sc, vc], backgroundColor: [C.short, C.video], borderWidth: 0, cutout: '72%' }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.label}: ${fmt(c.raw)}건` } } } },
  });
  document.getElementById('typeCenter').innerHTML = `<b>${Math.round(sc / (sc + vc) * 100)}%</b><span>Shorts</span>`;
  document.getElementById('typeLegend').innerHTML = [
    { k: 'Shorts', c: C.short, cnt: sc, m: d.types.short.minutes },
    { k: '영상', c: C.video, cnt: vc, m: d.types.video.minutes },
  ].map(r => `
    <div class="row">
      <span class="dot" style="background:${r.c}"></span>
      <div><b>${fmt(r.cnt)}</b> <span class="k">건</span></div>
      <div class="v"><b>${fmtH(r.m)}시간</b><small>추정 시청</small></div>
    </div>`).join('');
}

/* 아빠 vs 자인 */
function renderOwners(d) {
  const max = Math.max(...d.owners.map(o => o.count));
  document.getElementById('ownerBars').innerHTML = d.owners.map(o => `
    <div class="obar">
      <div class="obar-top">
        <span class="name">${o.owner}</span>
        <span class="num">${fmt(o.count)}건 · ${fmtH(o.minutes)}시간</span>
      </div>
      <div class="track"><div class="fill" style="width:${(o.count / max * 100).toFixed(1)}%;background:${ownerColor(o.owner)}"></div></div>
    </div>`).join('');
  const na = d.owners.find(o => o.owner === '미분류');
  document.getElementById('ownerNote').textContent =
    `※ 미분류 ${fmt(na.count)}건은 대부분 Shorts입니다(채널이 매우 다양해 키워드로 시청자를 특정하기 어려움).`;
}

/* 카테고리 가로 바 */
function renderCategories(d) {
  const cats = d.categories.filter(c => c.cat !== '기타').slice(0, 10);
  const max = Math.max(...cats.map(c => c.count));
  document.getElementById('catBars').innerHTML = cats.map(c => `
    <div class="cbar">
      <div class="cname">${c.cat}</div>
      <div class="ctrack"><div class="cfill" style="width:${(c.count / max * 100).toFixed(1)}%;background:linear-gradient(90deg, ${ownerColor(c.owner)}, ${ownerColor(c.owner)}bb)">${c.owner}</div></div>
      <div class="cmeta">${fmt(c.count)}건 <small>· ${fmtH(c.minutes)}h</small></div>
    </div>`).join('');
}

/* 시간대별 — 아빠/자인/미분류 누적 막대 */
function renderHour(d) {
  new Chart(document.getElementById('hourChart'), {
    type: 'bar',
    data: {
      labels: d.hourly.map(h => h.hour),
      datasets: [
        { label: '자인', data: d.hourly.map(h => h.owner['자인']), backgroundColor: C.jain, stack: 's' },
        { label: '아빠', data: d.hourly.map(h => h.owner['아빠']), backgroundColor: C.dad, stack: 's' },
        { label: '미분류', data: d.hourly.map(h => h.owner['미분류']), backgroundColor: C.na, stack: 's' },
      ],
    },
    options: {
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 16 } } },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { callback: (v, i) => i % 2 === 0 ? d.hourly[i].hour + '시' : '' } },
        y: { stacked: true, grid: { color: C.grid }, ticks: { maxTicksLimit: 5 } },
      },
    },
  });
}

/* 요일별 */
function renderDow(d) {
  const names = ['일', '월', '화', '수', '목', '금', '토'];
  new Chart(document.getElementById('dowChart'), {
    type: 'bar',
    data: {
      labels: d.dow.map(x => names[x.dow]),
      datasets: [{
        data: d.dow.map(x => x.count),
        backgroundColor: d.dow.map((x, i) => (i === 0 || i === 6) ? C.short : 'rgba(79,140,255,.65)'),
        borderRadius: 6,
      }],
    },
    options: {
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${fmt(c.raw)}건` } } },
      scales: { x: { grid: { display: false } }, y: { grid: { color: C.grid }, ticks: { maxTicksLimit: 5 } } },
    },
  });
}

/* 월별 — 건수 막대 + 시청시간 라인 */
function renderMonth(d) {
  new Chart(document.getElementById('monthChart'), {
    data: {
      labels: d.monthly.map(m => m.ym),
      datasets: [
        { type: 'bar', label: '건수', data: d.monthly.map(m => m.count), backgroundColor: 'rgba(79,140,255,.55)', borderRadius: 6, yAxisID: 'y' },
        { type: 'line', label: '추정 시청시간', data: d.monthly.map(m => Math.round(hrs(m.minutes))), borderColor: C.jain, backgroundColor: C.jain, tension: .35, pointRadius: 4, yAxisID: 'y1' },
      ],
    },
    options: {
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 16 } } },
      scales: {
        x: { grid: { display: false } },
        y: { position: 'left', grid: { color: C.grid }, title: { display: true, text: '건수' } },
        y1: { position: 'right', grid: { display: false }, title: { display: true, text: '시간' } },
      },
    },
  });
}

/* 채널 랭킹 */
function renderChannels(d) {
  const cls = o => o === '아빠' ? 'dad' : o === '자인' ? 'jain' : 'na';
  document.getElementById('channelList').innerHTML = d.topChannels.map(c => `
    <li>
      <span class="cn">
        <span class="badge ${cls(c.owner)}">${c.owner}</span>
        <span class="t" title="${c.name}">${c.name}</span>
      </span>
      <span class="num">${fmt(c.count)}건 <small>· ${fmtH(c.minutes)}h</small></span>
    </li>`).join('');
}
