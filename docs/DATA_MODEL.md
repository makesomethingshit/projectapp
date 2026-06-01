# 데이터 모델

## 저장 방식

앱 상태는 `localStorage`의 `studio-project-widget-state-v1` 키에 저장됩니다. 백업 키는 `studio-project-widget-state-v1-backup`입니다. JSON 가져오기/내보내기는 `main.js`의 Electron IPC와 `state.js`의 상태 직렬화 함수를 통해 이루어집니다.

`getSerializableState()`가 저장하는 주요 항목은 다음과 같습니다.

- `projects`
- `tasks`
- `projectLinks`
- `archiveResources`
- `archiveResourceLinks`
- `completionWeights`
- `appSettings`
- 선택된 프로젝트와 필터/보기 상태
- 펼쳐진 프로젝트 ID

직렬화 데이터에는 `version: 1`이 포함됩니다. 현재는 단일 버전이지만, 저장 구조가 바뀌면 다음 규칙을 따릅니다.

- 이전 JSON을 버리지 않고 `applyLoadedState()`에서 정규화 또는 마이그레이션합니다.
- 마이그레이션은 원천 데이터와 파생 표시값을 섞지 않습니다.
- 깨진 참조는 정규화 단계에서 제거하고, 가능한 경우 유효한 새 참조로 변환합니다.
- 가져오기/내보내기 변경 후에는 `npm test`와 수동 JSON 확인을 함께 수행합니다.

## Project

프로젝트는 주로 `state.js`에서 정의되고 `normalizeProjects()`로 정규화됩니다.

현재 확인된 필드:

- `id`: 숫자
- `parentId`: 숫자 또는 `null`
- `name`: 문자열
- `status`: 문자열
- `progress`: 저장된 완성도 fallback, 0-100으로 보정
- `advance`: 저장된 진행도 fallback, 0-100으로 보정
- `contributionMode`: `completion`, `advance`, `both`
- `deadline`: 날짜 문자열 또는 `null`
- `note`: 문자열
- `resources`: 과거 방식의 프로젝트별 리소스. 현재는 아카이브 리소스로 마이그레이션됩니다.

원천 데이터:

- ID, 계층, 상태, 마감, 메모, 기여 방식은 프로젝트에 저장됩니다.
- 화면의 완성도는 대체로 `getRollupProgress(project.id)` 결과를 사용합니다.
- 화면의 진행도는 대체로 `getRollupAdvance(project.id)` 결과를 사용합니다.
- 프로젝트의 저장된 `progress`와 `advance`는 기여 항목이 없거나 재귀 보호가 필요한 경우 fallback으로 쓰입니다.
- 표시용 값이 필요할 때는 `getProjectDisplayProgress(project.id)`와 `getProjectDisplayAdvance(project.id)`를 사용합니다. 이 helper들은 현재 롤업 결과를 반환하며, 저장된 프로젝트 값을 최종 표시값으로 오해하지 않게 하는 경계입니다.

## Folder

현재 코드에는 별도 Folder 모델이 없습니다. `parentId`를 가진 프로젝트 계층이 폴더 역할까지 겸하는 것으로 보입니다.

현재 동작:

- `parentId: null`이면 최상위 프로젝트/그룹입니다.
- `parentId`가 다른 프로젝트 ID이면 하위 프로젝트입니다.
- 목록과 그래프 렌더링은 이 프로젝트 계층을 직접 사용합니다.

불확실한 점:

- 앞으로 폴더를 별도 엔티티로 만들지, 프로젝트 계층으로 유지할지 결정되어 있지 않습니다.
- 같은 최상위 프로젝트 아래의 형제 프로젝트들이 롤업과 표시 외에 어떤 규칙을 공유해야 하는지는 명확하지 않습니다.

## Task

작업은 `state.js`에서 정의되고 `normalizeTasks()`로 정규화됩니다.

현재 확인된 필드:

- `id`: 숫자
- `projectId`: 숫자 또는 `null`
- `name`: 문자열
- `progress`: 완성도, 0-100
- `advance`: 진행도, 0-100
- `contributionMode`: `completion`, `advance`, `both`
- `note`: 문자열

원천 데이터:

- 작업 완성도와 진행도는 작업에 저장되며, 작업 단위 진행 상태의 직접 입력값입니다.
- 작업은 `contributionMode`에 따라 프로젝트 롤업에 반영됩니다.
- `projectId`가 없는 작업은 그래프의 독립 작업으로 존재할 수 있습니다.

## Status

프로젝트 `status`는 자유 텍스트로 저장됩니다. 코드상 작업 완료, 프로젝트 진행도, 마감, 하위 프로젝트에서 명확히 파생되지는 않습니다.

현재는 필터와 표시 용도로 사용되는 것으로 보입니다. 향후 상태 로직을 추가한다면 수동 상태인지 파생 상태인지 한 곳에서 명확히 정해야 합니다.

## Progress와 Advance

앱은 두 종류의 값을 구분합니다.

- 완성도: `progress`, `getRollupProgress()`, completion segment.
- 진행도: `advance`, `getRollupAdvance()`, advance segment.

파생 상태:

- `getOwnProgress()`는 하위 프로젝트 또는 직접 작업이 있으면 프로젝트 자체 완성도를 계산합니다.
- `getOwnAdvance()`는 하위 프로젝트 또는 직접 작업이 있으면 프로젝트 자체 진행도를 계산합니다.
- `getRollupProgress()`와 `getRollupAdvance()`는 자체 값에 외부 프로젝트/수식 영향을 섞습니다.

저장 상태:

- 프로젝트 `progress`, `advance`
- 작업 `progress`, `advance`
- 수식 노드 `completion`, `advance`
- `completionWeights`

중요한 위험:

프로젝트 진행 값은 저장되기도 하고 계산되기도 합니다. 현재 계약은 프로젝트 저장값을 "기여 항목이 없을 때 쓰는 base/fallback 입력값"으로 취급하고, 최종 표시값은 `getProjectDisplayProgress()`와 `getProjectDisplayAdvance()`에서 가져오는 것입니다. 작업 슬라이더, 하위 프로젝트, 외부 링크, 수식 링크 변경은 부모 프로젝트의 저장 `progress`/`advance`를 덮어쓰지 않고 렌더링 시 계산됩니다.

## Project Links

`projectLinks`는 한 프로젝트가 다른 프로젝트에 주는 외부 영향입니다.

필드:

- `sourceId`
- `targetId`
- `metric`: `completion`, `advance`, `both`
- `weight`: 정규화 시 5-90으로 제한

이 링크는 부모/자식 계층이 아닙니다. 계층은 `parentId`가 담당합니다.

## 수식 노드와 링크

수식 노드는 `state.appSettings.graphFormulaNodes`에 저장됩니다.

주요 필드:

- `id`
- `title`
- `formulaType`: `fixed`, `average`, `weighted`, `min`, `max`
- `completion`
- `advance`
- `x`, `y`

수식 입력 링크는 `state.appSettings.graphFormulaInputLinks`, 수식이 프로젝트에 영향을 주는 링크는 `state.appSettings.graphFormulaLinks`에 저장됩니다.

## 문서/노트/리소스 링크

별도 Document 엔티티 대신 아카이브 리소스가 있습니다.

`archiveResources` 필드:

- `id`
- `name`
- `type`: `file`, `folder`, `link`
- `path`
- `desc`
- `tags`
- `createdAt`

`archiveResourceLinks` 필드:

- `resourceId`
- `targetType`: `project` 또는 `task`
- `targetId`

그래프 전용 아카이브 노드는 `state.appSettings.graphArchiveNodes`에 있고, 그래프 링크는 `state.appSettings.graphArchiveLinks`에 있습니다.

## App Settings

`appSettings`에는 테마, 상단 고정, 그래프 확대/축소, 노드 위치, 메모/수식/아카이브 그래프 노드, 그래프 범위, 집중 작업, 히스토리, 활동 로그, 단축키, 아카이브 보기 방식 등이 함께 들어 있습니다.

설정, 레이아웃, 도메인에 가까운 그래프 노드가 한 객체에 섞여 있으므로 전체 교체나 초기화는 조심해야 합니다.
