# 품질 확인

## 사용 가능한 명령

`package.json`에 정의된 명령:

```bash
npm run dev
npm test
npm run dist
```

현재 `lint`, `typecheck`, `build` 스크립트는 없습니다. 자동 회귀 확인은 `npm test`를 우선 사용합니다.

## 테스트 명령

루트에 독립 실행형 Node 테스트 파일이 있고, `scripts/run-tests.mjs`가 이를 순서대로 실행합니다.

```bash
npm test
```

개별 확인이 필요할 때는 아래 파일을 직접 실행합니다.

```bash
node test_archive_model.mjs
node test_archive_resource_update.mjs
node test_archive_attach_detach.mjs
node test_archive_detail_panel.mjs
node test_archive_edit_controls.mjs
node test_archive_project_port_markup.mjs
node test_archive_search.mjs
node test_archive_topic_grouping.mjs
node test_archive_view_attach_controls.mjs
node test_archive_view_modes.mjs
node test_bottleneck_alert_design.mjs
node test_bottleneck_hierarchy_direction.mjs
node test_project_progress_rollup_contract.mjs
node test_rollup_explanation.mjs
node test_rollup_explanation_markup.mjs
node test_encoding_integrity.mjs
node test_detail_bottleneck_navigation.mjs
node test_graph_navigation.mjs
node test_graph_port_labels.mjs
node test_graph_selection.mjs
node test_local_file_bridge.mjs
node test_build_data.js
```

`test_build_data.js`는 일부 결과를 출력하는 진단용 성격이 강하고 모든 기대값을 assert하지 않습니다. `npm test`에 포함되어 있지만 완전한 자동 테스트로 보지는 않습니다.

PowerShell 실행 정책 때문에 `npm test`가 막히면 `npm.cmd test`를 사용합니다.

## 수동 QA 체크리스트

- 앱이 이미 켜져 있으면 그 창에서 확인합니다. 꺼져 있을 때만 `npm run dev`로 실행합니다.
- 프로젝트 목록이 렌더링되는지 확인합니다.
- 상세, 그래프, 아카이브 화면을 전환합니다.
- 프로젝트를 선택했을 때 상세 패널이 바뀌는지 확인합니다.
- 작업을 추가하고 완성도/진행도를 조정한 뒤 프로젝트 롤업이 바뀌는지 확인합니다.
- 작업을 다른 프로젝트로 옮겼을 때 그래프 위치가 오해를 만들지 않는지 확인합니다.
- 아카이브 리소스를 추가/수정/삭제하고 프로젝트 연결/분리를 확인합니다.
- 부모/자식 프로젝트 관계를 만들거나 수정해도 순환 구조가 생기지 않는지 확인합니다.
- 데이터를 내보낸 뒤 JSON 구조를 확인합니다.
- JSON을 가져온 뒤 프로젝트/작업/아카이브 링크가 정규화되고 깨진 참조가 제거되는지 확인합니다.
- 집중 위젯을 열고 작업 업데이트가 동기화되는지 확인합니다.

## 디자인 체크리스트

- `variables.css`의 기존 토큰을 사용합니다.
- light/analog와 dark/digital 테마 모두에서 읽힙니다.
- 임의의 그라디언트, 과한 그림자, 흔한 관리자 대시보드 밀도를 추가하지 않습니다.
- 버튼, 카드, 패널, 모달에서 텍스트가 넘치지 않습니다.
- 그래프 컨트롤이 중요한 그래프 내용을 가리지 않습니다.
- 위험 색상은 삭제, 위험, 실제 경고에만 사용합니다.
- 한국어 문구와 CSS `content` 문자열이 깨져 보이지 않는지 확인합니다.

## 프로젝트 로직 체크리스트

- 프로젝트 계층 변경이 순환 구조를 만들지 않습니다.
- 롤업 표시는 `getProjectDisplayProgress()`와 `getProjectDisplayAdvance()`를 사용합니다.
- 저장된 `progress`/`advance`를 최종 표시 롤업으로 오해하지 않습니다.
- 작업 `contributionMode`가 지켜집니다.
- 프로젝트 `contributionMode`가 하위 기여에 반영됩니다.
- 위계/작업 변경 후 stale `completionWeights`가 남지 않습니다.
- 외부 링크와 수식 링크는 방향성과 정규화를 유지합니다.
- 프로젝트 삭제 시 하위 작업과 관련 링크가 정리됩니다.
- 아카이브 리소스 링크가 존재하는 프로젝트/작업/리소스를 가리킵니다.

## 문서 업데이트 체크리스트

- 모델 변경 후 `docs/DATA_MODEL.md`를 업데이트합니다.
- 계층, 롤업, 상태, 링크 규칙 변경 후 `docs/PROJECT_LOGIC.md`를 업데이트합니다.
- 파일 이동이나 화면/컴포넌트 경계 변경 후 `docs/FRONTEND.md`를 업데이트합니다.
- 의도적인 디자인 방향 변경 후 `docs/DESIGN.md`를 업데이트합니다.
- 스크립트나 테스트 변경 후 `docs/QUALITY_CHECK.md`를 업데이트합니다.
- 중요한 파일/폴더 변화 후 `docs/generated/project-map.md`를 업데이트합니다.
