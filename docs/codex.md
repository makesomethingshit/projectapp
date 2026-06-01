# Codex 작업 기준

이 파일은 기존 Codex 작업 노트의 호환 진입점입니다. 현재 기준은 루트의 [AGENTS.md](../AGENTS.md)입니다.

## 작업 전 읽을 문서

- [AGENTS.md](../AGENTS.md): 미래 에이전트용 최상위 안내.
- [PRODUCT.md](PRODUCT.md): 제품 목표와 범위.
- [DATA_MODEL.md](DATA_MODEL.md): 저장 데이터와 원천 데이터.
- [PROJECT_LOGIC.md](PROJECT_LOGIC.md): 프로젝트/작업/진행도 규칙.
- [DESIGN.md](DESIGN.md): 디자인 방향과 금지 패턴.
- [FRONTEND.md](FRONTEND.md): 화면/파일/상태 구조.
- [QUALITY_CHECK.md](QUALITY_CHECK.md): 테스트와 수동 QA.
- [generated/project-map.md](generated/project-map.md): 파일 지도.

## 유지할 작업 원칙

- 검색은 가능한 `rg`를 사용합니다.
- 기능 추가, 버그 수정, 문서 정리는 서로 섞지 않습니다.
- 대규모 리팩터링은 별도 실행 계획 없이 진행하지 않습니다.
- 프로젝트/작업/진행도 변경은 `state.js`, `calculator.js`, 관련 테스트를 먼저 확인합니다.
- UI 변경은 `DESIGN.md`, `FRONTEND.md`, 관련 CSS를 먼저 확인합니다.
- 완료 전에는 가능한 검증 명령을 실행하고 결과를 남깁니다.

## 현재 주의점

- 한국어 문구와 CSS `content` 문자열은 UTF-8 기준으로 관리하며, 인코딩 회귀가 의심되면 `test_encoding_integrity.mjs`를 실행합니다.
- 별도 Folder 모델은 없습니다.
- 프로젝트 `status`는 현재 수동 저장값으로 보입니다.
- 프로젝트 `progress`/`advance`는 저장값과 계산 롤업값이 공존합니다.

상세 내용은 [PROJECT_LOGIC.md](PROJECT_LOGIC.md)와 [DATA_MODEL.md](DATA_MODEL.md)를 기준으로 합니다.
