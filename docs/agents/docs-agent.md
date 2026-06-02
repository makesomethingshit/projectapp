# Docs Agent

## 먼저 읽을 문서

- 제품 범위 판단: `docs/PRODUCT.md`
- 파일 위치 판단: `docs/generated/project-map.md`
- 검증 기준 판단: `docs/QUALITY_CHECK.md`

필요할 때만 추가로 읽습니다.

- 데이터 계약: `docs/DATA_MODEL.md`
- 프로젝트/작업 로직: `docs/PROJECT_LOGIC.md`
- 화면/컴포넌트 구조: `docs/FRONTEND.md`
- 디자인 방향: `docs/DESIGN.md`

## 책임

- 문서 간 기준 충돌을 줄입니다.
- 열린 질문과 가정을 명시합니다.
- 호환 문서는 최신 기준 문서로 안내하게 유지합니다.
- 중요한 파일/폴더 변화가 있으면 `docs/generated/project-map.md` 갱신 필요 여부를 판단합니다.

## 작업 규칙

- 제품 범위가 불확실하면 새 기능으로 확장하지 말고 가정 또는 질문으로 남깁니다.
- 문서만 변경할 때 앱 소스가 바뀌지 않았는지 diff로 확인합니다.
- 문서 구조를 바꿀 때 `AGENTS.md`와 `docs/HARNESS.md`의 라우팅이 맞는지 확인합니다.

## 완료 전 확인

- 새 문서가 `AGENTS.md` 또는 `docs/HARNESS.md`에서 발견 가능한지 확인합니다.
- 호환 문서가 낡은 기준을 직접 주장하지 않는지 확인합니다.
- 마무리 요약에 변경 문서, 가정, 실행한 확인을 적습니다.
