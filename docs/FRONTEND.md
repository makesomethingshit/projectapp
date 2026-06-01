# 프론트엔드 구조

## 런타임

이 앱은 plain HTML, CSS, JavaScript 모듈로 구성된 Electron 앱입니다. 렌더러에는 React/Vue/Svelte 같은 라우터나 프레임워크 빌드 단계가 없습니다.

진입점:

- `main.js`: Electron main process.
- `preload.js`: 렌더러와 Electron API 사이의 안전한 브리지.
- `index.html`: 메인 앱 DOM과 모달 골격.
- `focus-widget.html`: 별도 집중 위젯 창.

## 앱 구조

주요 루트 파일:

- `app.js`: 렌더러 조율, UI 상태 helper, 렌더 함수, 아카이브 액션, 그래프 helper export.
- `app-graph-events.js`: 클릭, 폼, 키보드, 포인터 드래그, 그래프 상호작용, 아카이브 폼, 단축키 이벤트 연결.
- `app-modals.js`: 모달 열기/닫기와 옵션 렌더링.
- `app-graph-actions.js`: 그래프 연결 생성/삭제와 계층 연결 변경.
- `state.js`: 상태 객체, 정규화, 저장/불러오기, demo 데이터, import/export 형태.
- `calculator.js`: 계층 탐색, 롤업, 가중치, 영향 링크, 병목 계산과 병목 추천.
- `ui-components.js`: 상세 화면, 프로젝트/작업/아카이브 마크업, 지표 패널, 병목 카드와 추천 문구.
- `graph-components.js`: 그래프 데이터 구성과 그래프 마크업.
- `archive-model.js`: 아카이브 리소스와 링크의 순수 모델 로직.
- `detail-navigation.js`, `graph-navigation.js`, `graph-selection.js`: 탐색/선택 보조 로직.

## 화면 구조

라우트 대신 상태로 화면을 전환합니다.

- 상세 보기: 프로젝트 목록과 선택 프로젝트 상세 패널.
- 그래프 보기: 전체/로컬 그래프 화면.
- 아카이브 보기: 전체 아카이브 리소스 화면.
- 집중 위젯: 별도 Electron 창.

관련 상태:

- `state.viewMode`
- `state.appSettings.globalGraphView`
- `state.projectFilter`
- `state.detailFilter`
- `state.searchQuery`
- `state.selectedProjectId`

## 주요 화면

- 상단 바: 파일 메뉴, 집중 위젯, 환경설정, 보기 탭, 검색, 고정 토글.
- 프로젝트 패널: 필터, 프로젝트 목록, 프로젝트 추가.
- 상세 패널: 선택 프로젝트 헤더, 롤업, 하위 프로젝트, 병목 알림, 작업, 연결된 아카이브 리소스.
- 상세 패널의 완성도/진행도 롤업 카드를 펼치면 `calculator.js`의 `getRollupExplanation()` 결과를 기반으로 계산 요약, 기여 항목, 비중/평균 몫, 외부/수식 반영분을 보여줍니다.
- 병목 카드는 `getBottleneckRecommendations()` 결과를 기반으로 각 병목 항목의 다음 행동 추천을 함께 보여줍니다.
- 그래프 캔버스: 프로젝트 노드, 작업, 메모 노드, 수식 노드, 아카이브 노드, 링크, 미니맵, 컨텍스트 컨트롤.
- 아카이브 전체 보기: 주제/종류/전체 기준 리소스 목록, 연결/분리, 추가/수정/삭제.
- 모달: 프로젝트 추가/수정, 작업 추가/수정, 메모, 삭제 확인, 환경설정, 가중치 슬라이더.

## 상태 관리

`state.js`에서 export하는 하나의 mutable 객체가 중심입니다. 대부분의 UI 변경은 이 객체를 수정하고 `saveState()`를 호출한 뒤 다시 렌더링합니다.

중앙 reducer는 없습니다. 앞으로도 기존 패턴에 맞춰 작게 수정하고, 대량 변경이나 import 후에는 정규화 함수를 사용합니다.

## 스타일링

CSS 책임 분리:

- `styles.css`: CSS import.
- `variables.css`: 테마, 색, 폰트, 토큰.
- `layout.css`: 앱 셸, 상단 바, 패널 레이아웃.
- `components.css`: 일반 UI 컴포넌트.
- `modals.css`: 모달과 폼.
- `graph.css`: 그래프 기본 레이아웃과 시각 요소.
- `graph-interactions.css`: 그래프 상호작용 상태와 전체 그래프 override.
- `focus-widget.css`: 집중 위젯.

## 새 UI를 추가할 위치

- 상세/목록/아카이브 마크업: `ui-components.js`
- 그래프 전용 마크업/데이터: `graph-components.js`
- 모달 폼: `index.html`, 동작은 `app-modals.js`, submit 처리는 `app-graph-events.js`
- 도메인 계산: `calculator.js`
- 저장/정규화: `state.js`
- 아카이브 순수 로직: `archive-model.js`

## 추가하지 말아야 할 위치

- 기존 컴포넌트 렌더러가 맡을 수 있는 큰 마크업을 이벤트 핸들러 안에 직접 넣지 않습니다.
- `calculator.js`가 맡아야 할 도메인 계산을 템플릿 문자열이나 CSS에 넣지 않습니다.
- 그래프 전용 CSS를 일반 컴포넌트 CSS에 섞지 않습니다.
- 파생 표시값을 이유 없이 저장 상태로 추가하지 않습니다.

## 이름 규칙

관찰된 패턴:

- DOM ID는 `projectList`, `archiveFullView`, `taskModal`처럼 camelCase를 씁니다.
- 상호작용은 `data-task-progress`, `data-graph-remove-edge`, `data-archive-view-mode` 같은 data attribute가 담당합니다.
- helper 함수는 `normalize`, `get`, `render`, `open`, `close`, `apply`, `remove`, `update` 같은 동사를 씁니다.

기존 영역의 패턴이 다르면 그 영역의 방식을 우선합니다.
