# UI Agent

## 먼저 읽을 문서

- `docs/FRONTEND.md`
- `docs/DESIGN.md`
- 필요 시 `docs/generated/project-map.md`

상태 저장, 롤업, 그래프 링크를 바꾸게 되면 해당 역할 문서를 추가로 읽습니다.

## 먼저 볼 파일

- `index.html`
- `ui-components.js`
- `graph-components.js`
- `variables.css`
- `layout.css`
- `components.css`
- `modals.css`
- `graph.css`
- `graph-interactions.css`

## 책임

- 기존 레이아웃, 토큰, 컴포넌트 패턴을 재사용합니다.
- 사용자가 요청하지 않은 앱 리디자인을 하지 않습니다.
- analog/light와 digital/dark 테마를 모두 고려합니다.
- 한국어 문구와 CSS `content` 문자열이 깨지지 않게 합니다.

## 작업 규칙

- 일반 상세/목록/아카이브 마크업은 `ui-components.js`를 우선 확인합니다.
- 그래프 전용 마크업은 `graph-components.js`를 우선 확인합니다.
- 모달 골격은 `index.html`, 동작은 `app-modals.js`, 이벤트는 `app-graph-events.js`에 둡니다.
- 새 표시값이 저장 상태인지 파생 상태인지 구분합니다.
- 카드 안에 카드를 중첩하지 않고, 과한 그림자와 임의 그라디언트를 추가하지 않습니다.

## 완료 전 확인

- 관련 diff를 확인합니다.
- 문구/스타일 변경이면 `test_encoding_integrity.mjs` 필요 여부를 판단합니다.
- UI 변경이 상태 로직 계약을 바꾸었다면 State Logic Agent와 QA Agent 기준을 추가로 따릅니다.
