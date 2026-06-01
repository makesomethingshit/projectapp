# 에이전트 작업 가이드

이 저장소는 로컬 Electron 기반 프로젝트 관리 앱입니다. 변경은 작게 유지하고, 추정한 내용은 반드시 표시하며, 사용자가 요청하지 않은 기능 구현이나 대규모 리디자인은 하지 않습니다.

## 먼저 읽을 문서

- `docs/PRODUCT.md`: 제품 의도와 범위.
- `docs/FRONTEND.md`: 앱 구조, 화면 구조, 컴포넌트, 스타일링 방식.
- `docs/DATA_MODEL.md`: 저장되는 데이터와 원천 데이터.
- `docs/PROJECT_LOGIC.md`: 프로젝트/작업/진행도/상태/그래프 로직.
- `docs/DESIGN.md`: UI 변경 전 확인해야 할 디자인 원칙.
- `docs/QUALITY_CHECK.md`: 변경 전후 확인 명령과 QA 목록.
- `docs/generated/project-map.md`: 현재 저장소 파일 지도.

기존 `README.md`, `gemini.md`, `docs/APP_STRUCTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/DEPENDENCIES.md`, `docs/codex.md`는 새 harness 문서로 이어지는 호환 문서입니다. 세부 판단은 위 기준 문서들을 우선합니다.

## 핵심 로직 변경 전 확인

프로젝트 계층, 작업 기여 방식, 완성도/진행도 롤업, 외부 영향 링크, 수식 노드, 아카이브 링크를 바꾸기 전에는 다음 파일을 확인합니다.

- `state.js`
- `calculator.js`
- `app-graph-actions.js`
- `app-graph-events.js`
- `graph-components.js`
- 관련 `test_*.mjs` 파일

이 앱의 가장 큰 위험은 상태 불일치입니다. 가능하면 진행도와 상태는 파생값으로 계산하고, 중복 저장이 필요한 경우 그 이유를 문서에 남깁니다.

## UI 변경 전 확인

- `index.html`
- `ui-components.js`
- `graph-components.js`
- `variables.css`
- `layout.css`
- `components.css`
- `modals.css`
- `graph.css`
- `graph-interactions.css`

기존 레이아웃, 토큰, 컴포넌트 패턴을 우선 재사용합니다. 명시 요청 없이 앱을 새로 디자인하지 않습니다.

## 확인 절차

`docs/QUALITY_CHECK.md`에 적힌 명령과 체크리스트를 따릅니다. 문서만 바꾼 경우에도 요청된 문서가 모두 존재하는지, 앱 소스가 의도치 않게 바뀌지 않았는지 확인합니다.

## 마무리 요약에 포함할 것

- 변경한 파일
- 영향을 받은 동작 또는 문서
- 작업 중 둔 가정
- 남은 위험과 질문
- 실행한 명령과 결과
