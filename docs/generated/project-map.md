# 프로젝트 맵

2026-06-01 현재 저장소를 점검해 만든 지도입니다.

## 루트 앱 파일

- `package.json`: Electron 앱 메타데이터, 실행 스크립트, 빌드 포함 파일, 의존성.
- `main.js`: Electron main process. 창 생성, 개발 중 자동 reload, 상단 고정, 집중 위젯, 가져오기/내보내기, 리소스 열기 IPC.
- `preload.js`: 렌더러와 Electron 기능 사이의 브리지.
- `index.html`: 메인 앱 셸, 상단 바, 패널, 모달 골격.
- `focus-widget.html`: 보조 집중 위젯 화면.

## 상태와 도메인 로직

- `state.js`: 중앙 상태, 기본/demo 데이터, 정규화, 저장/불러오기, 과거 프로젝트 리소스 마이그레이션, 히스토리 기록.
- `calculator.js`: 진행도 보정, 계층 탐색, 완성도/진행도 롤업, 표시용 진행도 helper, stale 완성도 가중치 정리, 프로젝트/수식 링크, 병목 계산.
- `archive-model.js`: 아카이브 리소스 정규화, 아카이브 링크 정규화, 과거 리소스 마이그레이션, 아카이브 리소스 수정/연결 helper.

프로젝트, 작업, 계층, 진행도, 수식, 상태, 아카이브, 가져오기/내보내기, 저장 로직을 바꾸기 전에는 이 파일들을 먼저 봅니다.

## 렌더러 조율

- `app.js`: 렌더 조율, UI 상태 helper, 그래프 helper, 아카이브 변경, 작업 업데이트 진입점.
- `app-graph-events.js`: 앱 이벤트, 그래프 드래그/선택, 폼 제출, 단축키, 아카이브 폼.
- `app-modals.js`: 모달 설정과 옵션 렌더링.
- `app-graph-actions.js`: 그래프 연결 생성/삭제, 계층 링크 처리.
- `detail-navigation.js`: 상세 화면 탐색 helper.
- `graph-navigation.js`: 그래프 탐색 helper.
- `graph-selection.js`: 그래프 선택 helper.

위험: `app.js`와 `app-graph-events.js`는 매우 넓은 파일입니다. 새 핸들러를 추가하기 전 기존 핸들러를 검색합니다.

## 렌더링 컴포넌트

- `ui-components.js`: 프로젝트 상세, 작업 카드, 아카이브 뷰, 지표, 병목 카드, 목록/상세 마크업.
- `graph-components.js`: 그래프 데이터, 그래프 노드/엣지 마크업, 수식 컨트롤, 미니맵/컨텍스트 메뉴, 전체 그래프 렌더링.

UI 마크업을 바꾸기 전 이 파일들을 확인합니다.

## 스타일

- `styles.css`: 스타일시트 import.
- `variables.css`: 테마, 색, 폰트, 토큰.
- `layout.css`: 앱 셸, 상단 바, 패널 레이아웃.
- `components.css`: 일반 UI 컴포넌트.
- `modals.css`: 모달과 폼 UI.
- `graph.css`: 그래프 기본 레이아웃과 시각 요소.
- `graph-interactions.css`: 그래프 상호작용 상태와 전체 그래프 override.
- `focus-widget.css`: 집중 위젯 스타일.

시각 변경 전에는 `docs/DESIGN.md`를 먼저 읽습니다.

## 테스트

루트에 있는 독립 실행형 테스트/스모크 파일:

- `test_archive_model.mjs`
- `test_archive_resource_update.mjs`
- `test_archive_attach_detach.mjs`
- `test_archive_detail_panel.mjs`
- `test_archive_edit_controls.mjs`
- `test_archive_project_port_markup.mjs`
- `test_archive_search.mjs`
- `test_archive_topic_grouping.mjs`
- `test_archive_view_attach_controls.mjs`
- `test_archive_view_modes.mjs`
- `test_bottleneck_alert_design.mjs`
- `test_bottleneck_hierarchy_direction.mjs`
- `test_project_progress_rollup_contract.mjs`
- `test_detail_bottleneck_navigation.mjs`
- `test_graph_navigation.mjs`
- `test_graph_port_labels.mjs`
- `test_graph_selection.mjs`
- `test_build_data.js`

`package.json`에는 전체 테스트를 실행하는 스크립트가 없습니다.

## 기존 문서

- `README.md`: 새 harness 문서로 안내하는 프로젝트 진입점.
- `gemini.md`: 기존 AI 작업 규칙의 호환 진입점. 현재 기준은 `AGENTS.md`.
- `docs/APP_STRUCTURE.md`: 구조 문서 호환 진입점. 현재 기준은 `FRONTEND.md`, `DATA_MODEL.md`, `PROJECT_LOGIC.md`.
- `docs/DESIGN_SYSTEM.md`: 디자인 문서 호환 진입점. 현재 기준은 `DESIGN.md`.
- `docs/DEPENDENCIES.md`: 의존성 문서. 현재 기준은 `package.json`, `package-lock.json`, `QUALITY_CHECK.md`.
- `docs/codex.md`: 기존 Codex 작업 노트의 호환 진입점. 현재 기준은 `AGENTS.md`.
- `docs/superpowers/plans/`: 이전 구현 계획.
- `docs/superpowers/specs/`: 이전 설계 스펙.

## 생성물 또는 무거운 폴더

- `node_modules/`: 설치된 의존성.
- `dist/`: 빌드 결과물.
- `backup/`: JSON 백업 데이터.
- `data/`: 로컬 데이터/agent memory 관련 파일.
- `iii-extract/`, `iii-x86_64-pc-windows-msvc.zip`: 추출/다운로드된 바이너리 관련 파일.
- `.codegraph/`, `.superpowers/`, `.codex-skill-repos/`: 도구 메타데이터.

명시 요청이 없다면 생성물과 무거운 폴더는 수정하지 않습니다.

## 불확실하거나 위험한 영역

- 인코딩 손상 때문에 기존 한국어 UI 문자열과 `CHANGELOG.md` 일부를 소스만 보고 신뢰하기 어렵습니다. 주요 진입 문서는 새 harness 기준으로 정리했습니다.
- 폴더 동작이 별도 모델로 표현되어 있지 않습니다.
- 프로젝트 상태는 수동입니다.
- 완성도/진행도는 저장 fallback 값과 표시용 파생값이 함께 존재합니다. 표시에는 `getProjectDisplayProgress()`와 `getProjectDisplayAdvance()`를 우선 사용합니다.
- 수식 노드와 아카이브 그래프 노드가 별도 도메인 컬렉션이 아니라 `appSettings` 안에 있습니다.
- 그래프 상호작용이 `app-graph-events.js`에 많이 집중되어 있습니다.

## 작업별 먼저 볼 파일

- 프로젝트/작업/진행도 로직: `docs/PROJECT_LOGIC.md`, `state.js`, `calculator.js`, `app-graph-actions.js`, 관련 테스트.
- 아카이브 변경: `docs/DATA_MODEL.md`, `archive-model.js`, `ui-components.js`, 아카이브 테스트.
- 그래프 변경: `graph-components.js`, `app-graph-events.js`, `app-graph-actions.js`, `graph.css`, `graph-interactions.css`, 그래프 테스트.
- UI 변경: `docs/DESIGN.md`, `docs/FRONTEND.md`, `ui-components.js`, 관련 CSS.
- Electron/import/export/focus widget: `main.js`, `preload.js`, `focus-widget.js`, `state.js`.
