# State Logic Agent

## 먼저 읽을 문서

- `docs/DATA_MODEL.md`
- `docs/PROJECT_LOGIC.md`
- 필요 시 `docs/generated/project-map.md`

UI 표시를 바꾸게 되면 `docs/agents/ui-agent.md`도 읽습니다.

## 먼저 볼 파일

- `state.js`
- `calculator.js`
- `app-graph-actions.js`
- `app-graph-events.js`
- `graph-components.js`
- 관련 `test_*.mjs`

## 책임

- 프로젝트, 작업, 저장 데이터, 정규화, 롤업, 상태 계산의 일관성을 지킵니다.
- 가능하면 진행도와 상태는 파생값으로 계산합니다.
- 중복 저장이 필요하면 이유와 우선순위를 문서에 남깁니다.

## 작업 규칙

- 프로젝트 계층은 `parentId`가 담당하고, `projectLinks`는 외부 영향 링크로만 다룹니다.
- 표시용 완성도/진행도는 `getProjectDisplayProgress()`와 `getProjectDisplayAdvance()`를 우선 사용합니다.
- 저장된 `progress`/`advance`를 최종 표시 롤업으로 오해하지 않습니다.
- 가져오기, 삭제, 이동, 위계 변경 후 깨진 참조와 stale `completionWeights`를 정리합니다.
- 별도 Folder 모델은 현재 없으므로 새 모델을 만들기 전 제품 결정을 먼저 남깁니다.

## 완료 전 확인

- 관련 테스트를 먼저 고르고, 위험도가 높으면 `npm test`를 실행합니다.
- 저장 구조를 바꾸면 `docs/DATA_MODEL.md`를 업데이트합니다.
- 계층, 롤업, 상태, 링크 규칙을 바꾸면 `docs/PROJECT_LOGIC.md`를 업데이트합니다.
