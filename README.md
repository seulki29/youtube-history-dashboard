# YouTube 시청 기록 대시보드

Google Takeout으로 내보낸 YouTube 시청 기록을 분석해 정적 웹 대시보드로 보여줍니다.
GitHub Pages로 배포되며, **원본 기록은 공개되지 않고 집계 통계만** 표시됩니다.

## 보여주는 것
- 총 시청 건수 · 추정 시청시간 · 하루 평균 · 채널 수
- **Shorts vs 일반 영상** 구분 (건수 + 추정 시청시간)
- **시청자 추정** — 아빠 / 자인 / 미분류 (채널·제목 키워드 기반)
- 관심사 카테고리, 시간대·요일·월별 패턴, 채널 TOP 25

## 추정 방식 (중요)
Takeout 데이터에는 **Shorts 여부도, 실제 재생 시간도 없습니다.** 그래서 *다음 영상까지의 간격*으로 추정합니다.
- 간격 ≤ 75초 → **Shorts**, 그 이상 → **일반 영상**
- 시청 시간 = 다음 영상까지의 간격(최대 30분 캡, 세션 마지막 영상은 5분 기본값)
- 시청자 구분 = 채널/제목 키워드 매칭 (Shorts는 채널이 다양해 상당수 미분류)

모두 정확한 값이 아닌 **추정치**입니다. 정확한 재생 길이가 필요하면 YouTube Data API로 영상별 길이를 조회해야 합니다.

## 사용법
1. [Google Takeout](https://takeout.google.com)에서 **YouTube > 기록**을 JSON으로 내보내 zip을 이 폴더에 둡니다.
2. 압축을 풉니다: `extracted/` 아래에 `시청 기록.json`이 오도록.
3. 집계 생성: `node build.js` → `docs/data.json` 갱신
4. 로컬 미리보기: `npx serve docs` (또는 아무 정적 서버)

## 분류 커스터마이즈
`build.js` 상단의 `CATEGORIES` / `CHANNEL_OVERRIDE` 를 수정하면 아빠/자인 분류 규칙을 바꿀 수 있습니다.

## 구조
```
build.js        # Takeout JSON -> docs/data.json 집계
docs/
  index.html    # 대시보드
  style.css
  app.js        # Chart.js 렌더링
  data.json     # 집계 결과 (유일하게 공개되는 데이터)
```
