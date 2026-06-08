# State Logic Agent

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
