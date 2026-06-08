# 하네스 라우팅 (사람용 참조)

**⚠️ 에이전트는 이 파일을 읽지 않습니다. `AGENTS.md`를 참조하세요.**

이 문서는 미래 에이전트가 매번 모든 문서를 읽지 않도록 작업을 역할별로 나누는 사람용 개요입니다. 실행 절차는 `skills/workshop-harness/SKILL.md`가 우선하고, 이 문서는 기존 기준 문서와 역할 문서의 관계를 설명합니다.

## 목표

- 작업 유형별로 필요한 맥락만 읽습니다.
- 제품, UI, 상태 로직, 그래프, QA 책임을 섞지 않습니다.
- 검증 결과와 남은 위험을 항상 남깁니다.
- `skills/workshop-harness/`는 실행 하네스이고, `docs/PRODUCT.md`, `docs/DATA_MODEL.md`, `docs/PROJECT_LOGIC.md`, `docs/FRONTEND.md`, `docs/DESIGN.md`, `docs/QUALITY_CHECK.md`는 판단 기준입니다.

## 역할

| 역할 | 문서 | 주 책임 |
| --- | --- | --- |
| Docs Agent | `docs/agents/docs-agent.md` | 제품 범위, 문서 정합성, 열린 질문 정리 |
| UI Agent | `docs/agents/ui-agent.md` | 화면, 컴포넌트, CSS, 사용자 문구 |
| State Logic Agent | `docs/agents/state-logic-agent.md` | 저장 데이터, 프로젝트/작업, 롤업, 상태 불일치 방지 |
| Graph Agent | `docs/agents/graph-agent.md` | 그래프 노드, 링크, 드래그/선택/연결 동작 |
| QA Agent | `docs/agents/qa-agent.md` | 위험도별 검증, 테스트 선택, 마무리 확인 |

## 라우팅 규칙

1. 작업 요청을 한 문장으로 요약합니다.
2. 아래 트리거에서 가장 좁은 역할을 고릅니다.
3. 선택한 역할 문서와 그 문서가 지정한 기준 문서만 먼저 읽습니다.
4. 작업 중 다른 영역을 건드리게 되면 해당 역할 문서를 추가로 읽습니다.
5. 완료 전에는 QA Agent 기준으로 검증합니다.

## 트리거

- UI, 레이아웃, 테마, 모달, 문구, 버튼, 카드, 패널: UI Agent.
- 프로젝트, 작업, 진행도, 완성도, 상태, 저장, 가져오기/내보내기, 정규화: State Logic Agent.
- 그래프 화면, 노드, 엣지, 링크, 포트, 드래그, 미니맵, 그래프 전용 아카이브/수식 표현: Graph Agent.
- 문서 구조, 제품 범위, 의사결정, README/호환 문서, 프로젝트 맵: Docs Agent.
- 테스트 실패, 검증 계획, 릴리스 확인, 마무리 요약: QA Agent.

## 산출물 규칙

- broad/risky/multi-track 작업은 `skills/workshop-harness/scripts/new_workflow.py`로 `.workflow/<slug>/` 산출물을 만들 수 있습니다.
- 코드 변경은 요청 범위 안에 둡니다.
- 문서 변경은 어떤 계약이 바뀌었는지 명시합니다.
- 검증을 실행하지 않았다면 이유를 남깁니다.
- 추정은 "가정:"으로 표시합니다.

## 금지

- 모든 기준 문서를 습관적으로 선독하지 않습니다.
- UI 작업 중 상태 저장 계약을 몰래 바꾸지 않습니다.
- 상태 로직 작업 중 화면 디자인을 새로 만들지 않습니다.
- 그래프 링크와 프로젝트 계층을 같은 개념으로 취급하지 않습니다.
- `node_modules`, `dist`, `backup`, `data`, `.codegraph`, `.superpowers`, `.codex-skill-repos`는 명시 요청 없이 수정하지 않습니다.
## Archive Auto-Link Contract

- 아카이브는 agent-readable Second Brain으로 관리한다. 사람 눈에 보이는 저장 위치보다 자료 간 관계와 현재 프로젝트와의 내용 관계가 우선이다.
- 자동 연결은 `archiveResourceLinks`에 추가하되, 기존 수동 연결을 지우거나 덮어쓰지 않는다.
- 연결 기준은 내용 중심이다. 자료의 이름, 설명, 명시적 내용 태그와 프로젝트/작업의 이름, 메모를 비교한다.
- 저장 위치, 드라이브명, 파일 타입, 관리용 태그는 관계 기준에서 제외한다. 예: `g-drive`, `d-drive`, `reference-library`, `folder`, `file`, `pdf`, `docx`, `gpt`, `external`, `indexed`.
- 같은 폴더 안에서 관련 파일 후보가 3개 이상이면 파일들을 각각 연결하지 않고, 가능한 경우 해당 폴더 아카이브 리소스를 대표로 연결한다.
- 이 규칙을 바꾸는 작업은 State Logic Agent와 Graph Agent 경계 작업으로 본다. 구현 뒤에는 `test_archive_auto_links.mjs`와 `npm test`를 통과시킨다.
