# 에이전트 작업 가이드

이 저장소는 로컬 Electron 기반 프로젝트 관리 앱입니다. 변경은 작게 유지하고, 추정한 내용은 반드시 표시하며, 사용자가 요청하지 않은 기능 구현이나 대규모 리디자인은 하지 않습니다.

## 작업 라우팅

모든 작업은 먼저 `skills/workshop-harness/SKILL.md`를 사용해 작업 유형과 워크플로우 필요 여부를 고릅니다. 그다음 필요한 역할 문서와 기준 문서만 읽습니다. 토큰을 아끼기 위해 관련 없는 문서를 선독하지 않습니다.

| 작업 유형 | 먼저 읽을 역할 문서 | 함께 읽을 기준 문서 |
| --- | --- | --- |
| 제품 범위, 요구 판단 | `docs/agents/docs-agent.md` | `docs/PRODUCT.md` |
| UI, 문구, 화면, 스타일 | `docs/agents/ui-agent.md` | `docs/FRONTEND.md`, `docs/DESIGN.md` |
| 프로젝트/작업/진행도/상태/저장 | `docs/agents/state-logic-agent.md` | `docs/DATA_MODEL.md`, `docs/PROJECT_LOGIC.md` |
| 그래프 노드, 링크, 그래프 상호작용 | `docs/agents/graph-agent.md` | `docs/FRONTEND.md`, `docs/PROJECT_LOGIC.md` |
| 검증, 테스트, 마무리 확인 | `docs/agents/qa-agent.md` | `docs/QUALITY_CHECK.md` |
| 파일 위치 파악 | `docs/HARNESS.md` | `docs/generated/project-map.md` |

기존 `README.md`, `gemini.md`, `docs/APP_STRUCTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/DEPENDENCIES.md`, `docs/codex.md`는 새 harness 문서로 이어지는 호환 문서입니다. 세부 판단은 위 기준 문서들을 우선합니다.

`docs/HARNESS.md`와 `docs/agents/*.md`는 사람도 읽을 수 있는 라우팅 설명입니다. 실행 절차, 패킷, 리스크 게이트, 워크플로우 산출물은 `skills/workshop-harness/`가 우선합니다.

## 공통 원칙

- 기존 구조, 토큰, 컴포넌트 패턴을 우선 재사용합니다.
- 기능 추가, 버그 수정, 문서 정리는 가능한 한 섞지 않습니다.
- 큰 리팩터링이나 앱 리디자인은 명시 요청 없이 진행하지 않습니다.
- 파생 가능한 진행도와 상태는 계산값으로 다루고, 중복 저장이 필요하면 이유를 문서에 남깁니다.
- 한국어 문구와 CSS `content` 문자열은 UTF-8 기준으로 관리합니다.
- 파일을 추정해서 고치지 말고, 관련 역할 문서가 지정한 파일을 먼저 확인합니다.

## 확인 절차

`docs/agents/qa-agent.md`와 `docs/QUALITY_CHECK.md`에 적힌 기준을 따릅니다. 작업 위험도에 따라 검증 깊이를 조절합니다.

- 문서만 변경한 경우: 요청된 문서가 존재하는지 확인하고, 앱 소스가 의도치 않게 변경되지 않았는지 diff로 확인합니다.
- 사소한 UI, 문구, 스타일 변경: 관련 diff를 확인하고, 필요한 경우 `npm test` 또는 관련 개별 테스트를 실행합니다.
- 컴포넌트, 상태 관리, 화면 흐름을 변경한 경우: 관련 테스트와 `npm test`를 실행합니다.
- 프로젝트 계층, 작업 기여 방식, 진행도/완성도 롤업, 상태 계산, 그래프 로직, 저장 로직을 변경한 경우: 관련 테스트, `npm test`, 필요 시 `npm run dist`를 실행합니다.
- 검증을 생략한 경우에는 생략한 이유를 마무리 요약에 명시합니다.
- 항상 실행한 명령어와 통과/실패 여부를 마무리 요약에 포함합니다.

## 마무리 요약에 포함할 것

- 변경한 파일
- 영향을 받은 동작 또는 문서
- 작업 중 둔 가정
- 남은 위험과 질문
- 실행한 명령과 결과
