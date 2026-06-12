# 프로젝트 로직 규정

## 1. 계층 구조

- **규정**: 프로젝트 계층은 각 프로젝트의 `parentId`에 직접 저장됩니다.
- **규정**: 현재 규칙:
    - `normalizeProjects()`는 잘못된 부모 참조를 제거합니다.
    - 프로젝트는 자기 자신을 부모로 가질 수 없습니다.
    - `normalizeProjects()`는 순환 구조를 발견하면 문제가 되는 부모 연결을 끊습니다.
    - `renderEditParentOptions()`는 수정 중인 프로젝트와 그 하위 프로젝트를 부모 후보에서 제외합니다.
    - 그래프 계층 연결은 `applyGraphConnection()`에서 순환을 막은 뒤 `target.parentId = source.id`를 설정합니다.
    - 프로젝트 삭제 시 하위 프로젝트와 그 작업도 함께 삭제됩니다.
- **규정**: 현재 별도 폴더 계층은 없습니다.

## 2. 부모/자식 관계

- **규정**:
    - `getChildProjects(projectId)`: 직접 하위 프로젝트.
    - `getDescendantProjectIds(projectId)`: 모든 하위 프로젝트.
    - `getProjectPath()` / `getProjectPathObjects()`: 상위 경로.
    - `getTopProjectId()`: 최상위 프로젝트 ID.
- **규정**: 현재 동작상 부모/자식 계층은 탐색 구조이면서 동시에 진행도 반영 구조입니다.

## 3. 완성도 롤업

- **규정**: 완성도는 `progress` 값을 기반으로 하며 `getRollupProgress()` 흐름을 따릅니다.
- **규정**:
    1. `getCompletionContributors(projectId)`가 `contributionMode`가 `advance`가 아닌 하위 프로젝트들과 직접 작업 중 `advance` 전용이 아닌 작업을 모두 기여자로 수집합니다.
    2. 하위 프로젝트가 존재하더라도 직접 연결된 할 일(태스크)들이 배제되지 않고 함께 완성도 합산에 기여합니다.
    3. 기여 비중은 `completionWeights`를 사용하고, 없으면 거의 균등 비중을 씁니다.
    4. 기여 항목이 없으면 프로젝트의 저장된 `progress`를 씁니다.
    5. `getRollupProgress()`는 여기에 외부 프로젝트/수식 링크 영향을 섞습니다. 외부 영향 합계는 최대 90%로 제한됩니다.
    6. UI에서 표시용 완성도는 `getProjectDisplayProgress()`를 통해 읽습니다. 이 함수는 현재 `getRollupProgress()`의 명시적 표시용 별칭입니다.
    7. `getRollupExplanation(projectId, "completion")`은 같은 계산 흐름에서 파생된 설명 데이터만 반환합니다. 별도 완성도 값을 저장하지 않습니다.
- **규정**: 중요한 의미:
    - 하위 프로젝트와 직접 할 일이 동시에 존재할 때 이들이 함께 완성도 롤업에 기여하게 함으로써, 하위 프로젝트가 있는 상위 프로젝트에 직접 등록된 작업의 완성도가 무시되는 현상을 방지합니다.

## 4. 진행도 롤업

- **규정**: 진행도는 `advance` 값을 기반으로 하며 `getRollupAdvance()` 흐름을 따릅니다.
- **규정**:
    1. `contributionMode`가 `completion`이 아닌 하위 프로젝트들과 직접 작업 중 진행도에 기여하는 작업을 모두 수집하여 합산합니다.
    2. 하위 프로젝트의 진행도 롤업값과 직접 작업의 진행도 값을 합하여 전체 기여자 수(하위 프로젝트 수 + 진행도 기여 작업 수)로 나눈 평균 진행도를 사용합니다.
    3. 기여 항목이 없으면 프로젝트의 저장된 `advance`를 쓰고, 없으면 `progress`를 fallback으로 씁니다.
    4. 외부 프로젝트/수식 링크 영향을 섞되, 외부 영향 합계는 최대 90%입니다.
    5. UI에서 표시용 진행도는 `getProjectDisplayAdvance()`를 통해 읽습니다. 이 함수는 현재 `getRollupAdvance()`의 명시적 표시용 별칭입니다.
    6. `getRollupExplanation(projectId, "advance")`은 하위 프로젝트와 직접 작업의 평균 몫, 외부/수식 반영분을 파생 데이터로 설명합니다.
- **규정**: 완성도는 가중 기여자를 지원하지만 진행도는 평균 중심입니다. 이 차이는 제품 의도입니다.

## 5. 작업이 프로젝트에 미치는 영향

- **규정**: 작업 슬라이더는 `app-graph-events.js`에서 `task.progress`와 `task.advance`를 업데이트합니다.
- **규정**: 프로젝트 롤업은 렌더링 시 계산되므로, 작업 변경이 프로젝트 저장값을 직접 덮어쓰지 않아도 화면 값이 바뀝니다.
- **규정**: 작업은 다음 방식으로 기여할 수 있습니다.
    - 완성도만
    - 진행도만
    - 완성도와 진행도 모두
- **규정**: 이는 `task.contributionMode`가 결정합니다.
- **규정**: 작업 추가, 수정, 이동, 삭제는 부모 프로젝트의 저장된 `progress`/`advance`를 변경하지 않습니다.
- **규정**: 완성도 기여자가 바뀌는 경우에는 `completionWeights`에서 더 이상 현재 기여자가 아닌 항목만 정리합니다.

## 6. 폴더 또는 상위 프로젝트 반영

- **규정**: 별도 Folder 엔티티는 없습니다.
- **규정**: 상위 프로젝트의 완성도와 진행도는 하위 프로젝트가 기여 항목으로 존재할 때 하위 프로젝트에서 파생됩니다.
- **규정**: 같은 최상위 프로젝트 아래의 형제 프로젝트들은 자동으로 서로 영향을 주지 않습니다.
- **규정**: 영향을 주려면 부모/자식 관계, `projectLinks`, 또는 수식 링크가 필요합니다.

## 7. 상태 표시

- **규정**: 프로젝트 `status`는 수동 저장 텍스트로 보입니다.
- **규정**: 코드상 완성도, 진행도, 작업 상태, 마감에서 자동 계산되는 규칙은 확인되지 않습니다.
- **규정**: 향후 상태 로직은 둘 중 하나로 정해야 합니다.
    - 수동 상태로 유지하고 문서화합니다.
    - 중앙 함수에서 파생 상태로 계산합니다.
- **규정**: 둘을 섞는 경우에는 우선순위를 명확히 해야 합니다.

## 8. 외부 영향 링크

- **규정**: `projectLinks`는 방향성이 있는 프로젝트 간 영향 링크입니다.
- **규정**: 계층 링크가 아닙니다.
- **규정**: 확인된 보호 장치:
    - 존재하는 프로젝트로 정규화됩니다.
    - 자기 자신으로 연결할 수 없습니다.
    - 비중은 5-90으로 제한됩니다.
    - 롤업에서 전체 외부 영향은 최대 90%입니다.
    - 병목 계산은 하위 프로젝트에서 상위 조상 링크를 병목으로 잘못 보고하지 않도록 걸러냅니다.
    - 병목 추천은 `getBottleneckRecommendations()`에서 계산합니다. 기존 병목 계산과 롤업 설명 데이터를 조합한 파생값이며 저장하지 않습니다.

## 9. 수식 로직

- **규정**: 수식 노드는 고정값, 평균, 가중 평균, 최소, 최대 방식으로 입력 링크 값을 계산할 수 있습니다.
- **규정**: 수식 결과는 프로젝트에 영향을 줄 수 있습니다.
- **규정**: 수식 계산 중 순환을 만나면 저장된 수식 노드 값을 반환하는 방식으로 재귀를 보호합니다.

## 10. 아카이브 로직

- **규정**: 아카이브 리소스는 프로젝트와 별도로 정규화됩니다.
- **규정**: 리소스는 `archiveResourceLinks`를 통해 프로젝트 또는 작업에 연결됩니다.
- **규정**: 과거 `project.resources`는 `archiveResources`와 `archiveResourceLinks`로 마이그레이션되고, 프로젝트의 `resources`는 비워집니다.
- **규정**: 그래프 아카이브 노드는 별도의 그래프 표현이며 `resourceId`로 실제 아카이브 리소스와 연결될 수 있습니다.

## 11. 상태 불일치를 피하는 규칙

- **규정**:
    - 프로젝트 `progress`와 `advance`는 기여 항목이 없을 때의 fallback으로 취급합니다.
    - 표시와 요약에는 `getProjectDisplayProgress()`와 `getProjectDisplayAdvance()`를 사용합니다.
    - 세그먼트, 병목, 수식 내부 계산처럼 계산 로직 자체가 필요한 곳은 `getRollupProgress()`와 `getRollupAdvance()`를 직접 사용할 수 있습니다.
    - 롤업 설명 UI는 `getRollupExplanation()` 결과를 사용합니다. 설명 행, 비중, 영향도는 모두 계산 시점의 파생값이며 저장하지 않습니다.
    - 병목 추천 UI는 `getBottleneckRecommendations()` 결과를 사용합니다. 추천 문장과 행동 유형은 저장 상태가 아니라 현재 롤업/병목 상태에서 즉시 계산합니다.
    - 가져오기나 대량 변경 후에는 정규화 함수를 사용합니다.
    - 같은 관계를 `parentId`와 `projectLinks`에 동시에 표현하지 않습니다.
    - 프로젝트 삭제 시 하위 작업, 프로젝트 링크, 수식 링크, 수식 입력 링크, 아카이브 링크, 레이아웃 위치를 함께 정리합니다.
    - 작업을 다른 프로젝트로 옮길 때 그래프 위치가 오해를 만들면 기존 위치를 초기화합니다.
    - 완성도와 진행도의 기여 방식을 명시적으로 유지합니다.
    - 위계 변경, 작업 삭제, 작업 이동처럼 완성도 기여자 목록이 바뀌는 동작 뒤에는 `pruneCompletionWeights()`로 stale weight만 제거합니다.

## 12. 알려진 문제 / 열린 질문

- **규정**:
    - 제품 요구에는 폴더가 있지만 코드에는 별도 Folder 모델이 없습니다.
    - 프로젝트 `status`는 수동이라 진행도/마감과 어긋날 수 있습니다.
    - 완성도는 가중치, 진행도는 평균을 쓰는 비대칭 구조입니다.
    - 프로젝트의 저장 `progress`/`advance`와 표시 롤업값이 달라질 수 있습니다.
    - 한국어 문구는 UTF-8 기준으로 관리하며, 인코딩 회귀는 `test_encoding_integrity.mjs`로 확인합니다.
    - `appSettings`에 설정, 그래프 레이아웃, 수식, 아카이브 그래프 노드, 히스토리, 단축키가 섞여 있습니다.
## Archive Auto-Link Logic

- 아카이브 자동 링크는 계층 구조가 아니라 리좀형 관계 보강이다. 프로젝트와 자료는 `archiveResourceLinks`로 연결되며, 폴더/드라이브 경로는 개념적 상하관계로 취급하지 않는다.
- 연결 점수는 자료의 내용 단서와 프로젝트/작업의 내용 단서가 겹치는지를 기준으로 계산한다.
    - 자료 쪽 단서: `archiveResources.name`, `archiveResources.desc`, 명시적 내용 태그.
    - 프로젝트 쪽 단서: `projects.name`, `projects.note`, 연결된 `tasks.name`, `tasks.note`.
- 다음 값은 내용 단서로 쓰지 않는다: 저장 위치, 드라이브명, 파일 확장자, 파일 타입, 관리 태그, 스캔/인덱싱 출처 태그.
- 자동 링크는 기존 링크를 보존하면서 누락된 후보만 추가한다. 사용자가 직접 만든 연결을 삭제하거나 재분류하지 않는다.
- 같은 폴더 안에서 관련 파일 후보가 3개 이상이면 그래프 가독성을 위해 파일별 링크를 접고 폴더 리소스를 대표 링크로 사용한다.
- 새 프로젝트 생성, 프로젝트 이름/메모 수정, 아카이브 자료 추가/수정, 앱 로드 시 자동 링크 보강을 수행한다.
- 이 로직을 변경하면 `test_archive_auto_links.mjs`, `test_archive_view_modes.mjs`, `test_archive_seed_sources.mjs`, `npm test`를 확인한다.
## Archive Relation v2 Logic

- Automatic archive relations use semantic similarity plus shared content terms. The default confirmed-link threshold is intentionally conservative.
- Candidates below the confirmed threshold but above the suggestion threshold are returned as suggestions and are not stored as `archiveResourceLinks`.
- Relation metadata is normalized with each archive link: `relationStatus`, `relationType`, `relationStrength`, `relationScore`, and `relationNote`.
- Existing `relationNote` text is included as same-resource context when automatic archive links are scored again, so user memos can improve later Space auto-link suggestions without mutating the archive resource itself.
- Space graph step distance is computed from the selected material through material-to-material graph links: selected material is `0`, direct neighbors are `1`, and neighbors reached through one intermediate material are `2`.
