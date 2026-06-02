# Graph Agent

## 먼저 읽을 문서

- `docs/FRONTEND.md`
- `docs/PROJECT_LOGIC.md`
- 필요 시 `docs/DATA_MODEL.md`
- 필요 시 `docs/DESIGN.md`

## 먼저 볼 파일

- `graph-components.js`
- `app-graph-events.js`
- `app-graph-actions.js`
- `graph-navigation.js`
- `graph-selection.js`
- `graph.css`
- `graph-interactions.css`
- 관련 그래프 `test_*.mjs`

## 책임

- 그래프 노드, 링크, 포트, 선택, 드래그, 미니맵, 컨텍스트 컨트롤의 의미를 유지합니다.
- 프로젝트 계층 링크와 외부 영향 링크를 혼동하지 않습니다.
- 수식 노드와 아카이브 그래프 노드가 실제 도메인 데이터와 어떻게 연결되는지 확인합니다.

## 작업 규칙

- 계층 연결 변경은 순환 구조를 만들지 않아야 합니다.
- 외부 영향 링크는 방향성과 비중 정규화를 유지합니다.
- 작업 이동이나 링크 변경 뒤 그래프 위치가 사용자를 오해하게 만들지 않는지 확인합니다.
- 그래프 전용 CSS는 일반 컴포넌트 CSS에 섞지 않습니다.
- 그래프 컨트롤이 중요한 그래프 내용을 가리지 않게 합니다.

## 완료 전 확인

- 관련 그래프 테스트를 실행합니다.
- 계층/링크/수식/아카이브 그래프 계약이 바뀌면 `docs/PROJECT_LOGIC.md` 또는 `docs/DATA_MODEL.md`를 업데이트합니다.
- 시각 변경이 있으면 UI Agent의 디자인 기준도 확인합니다.
