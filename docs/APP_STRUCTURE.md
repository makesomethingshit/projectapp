# 앱 구조

이 파일은 기존 구조 문서의 호환 진입점입니다. 현재 기준 구조 문서는 다음으로 나뉘어 있습니다.

- [프론트엔드 구조](FRONTEND.md): Electron/렌더러 구조, 주요 화면, 컴포넌트 위치, 스타일 파일 역할.
- [데이터 모델](DATA_MODEL.md): 프로젝트, 작업, 아카이브, 수식, 저장 상태.
- [프로젝트 로직](PROJECT_LOGIC.md): 계층, 롤업, 외부 영향 링크, 병목 로직.
- [프로젝트 맵](generated/project-map.md): 현재 저장소 파일 지도.

## 빠른 구조 요약

- `main.js`: Electron 창, IPC, 파일 가져오기/내보내기, 리소스 열기.
- `preload.js`: 렌더러와 Electron 기능 연결.
- `index.html`: 메인 앱 셸과 모달 골격.
- `app.js`: 렌더링 조율과 주요 UI helper.
- `app-graph-events.js`: 클릭, 폼, 키보드, 드래그, 그래프 이벤트 연결.
- `app-modals.js`: 모달 열기/닫기와 옵션 렌더링.
- `app-graph-actions.js`: 그래프 연결과 계층 변경 액션.
- `state.js`: 중앙 상태, 저장/불러오기, 정규화.
- `calculator.js`: 프로젝트 계층과 완성도/진행도 계산.
- `ui-components.js`: 상세/목록/아카이브 UI 마크업.
- `graph-components.js`: 그래프 데이터와 그래프 UI 마크업.
- `archive-model.js`: 아카이브 리소스와 링크 모델.

## 변경 전 읽을 것

프로젝트 구조나 진행도 반영을 바꾸려면 [PROJECT_LOGIC.md](PROJECT_LOGIC.md)를 먼저 읽습니다. UI 구조를 바꾸려면 [FRONTEND.md](FRONTEND.md)를 먼저 읽습니다.
