# AI 작업 규칙

이 파일은 기존 Gemini/Claude/Codex 작업 규칙 문서의 호환 진입점입니다. 현재 기준 문서는 [AGENTS.md](AGENTS.md)입니다.

## 현재 기준

- 작업 전 읽을 문서: [AGENTS.md](AGENTS.md)
- 제품 의도: [docs/PRODUCT.md](docs/PRODUCT.md)
- 데이터 모델: [docs/DATA_MODEL.md](docs/DATA_MODEL.md)
- 프로젝트/진행도 로직: [docs/PROJECT_LOGIC.md](docs/PROJECT_LOGIC.md)
- UI/디자인: [docs/DESIGN.md](docs/DESIGN.md), [docs/FRONTEND.md](docs/FRONTEND.md)
- 검증 절차: [docs/QUALITY_CHECK.md](docs/QUALITY_CHECK.md)
- 파일 지도: [docs/generated/project-map.md](docs/generated/project-map.md)

## 유지할 원칙

- 기능 추가와 버그 수정은 분리합니다.
- 프로젝트/작업/진행도 로직은 `state.js`와 `calculator.js`를 먼저 확인합니다.
- 일반 UI는 `ui-components.js`, 그래프 UI는 `graph-components.js`, 이벤트 연결은 `app-graph-events.js`를 우선 확인합니다.
- 변경 후에는 가능한 테스트를 직접 실행하고 결과를 요약합니다.
- 변경 이력은 [CHANGELOG.md](CHANGELOG.md)를 참고합니다.

## 주의

이전 문서는 인코딩 손상으로 일부 텍스트를 신뢰하기 어렵습니다. 깨진 문구를 그대로 복원하려 하지 말고, 현재 코드와 새 문서를 기준으로 판단합니다.
