# 2026-05-31 Bottleneck Resolution Design Spec

구조지도(Graph)에서 발견된 병목 프로젝트 및 할 일을 단순 수치 조작(반영비 낮추기 등)으로 타협하는 대신, 실질적으로 일을 실행하여 돌파하도록 돕는 병목 해결 및 추천 액션 기능의 상세 명세서입니다.

---

## 1. 철학 및 설계 원칙

*   **실행 유도 우선 (Action-Oriented):** 병목을 발견했을 때 반영 비율을 조정하는 것은 임시방편(Cheating)에 불과합니다. 따라서 병목의 원인 작업을 즉시 오늘의 집중 위젯에 등록하거나 잘게 쪼개어 시작하게 만드는 **원인 해결 중심**의 조치만 제공합니다.
*   **하이브리드 조작계 (Hybrid UI):** 구조지도 내에서의 빠른 팝오버 조작과 우측 상세 패널에서의 구체적인 원인 진단 및 해결을 동시에 지원합니다.

---

## 2. 제공 기능 상세 (Feature Details)

### A. 구조지도 마이크로 팝오버 (`.bottleneck-popover`)
구조지도 상에서 병목 상태의 **반영비 배지(⚠️ %)** 또는 **프로젝트 내 경고 카드(⚠️)**를 클릭하면 활성화되는 레이어 메뉴입니다.
*   **원인 추적 (`[🔍 원인 추적]`):** 클릭 시 지연을 유발하는 선행 프로젝트로 구조지도 캔버스가 부드럽게 이동 및 줌인(Panned & Zoomed)합니다.
*   **집중 위젯 등록 (`[📌 집중 등록]`):** 
    *   지연 원인이 **할 일**이면 해당 할 일을 집중 위젯에 핀 고정합니다.
    *   지연 원인이 **프로젝트**이면 내부에서 진척률이 가장 낮고 마감이 급한 할 일(최대 2개)을 자동 선별하여 집중 위젯에 핀 고정합니다.
*   **시작을 위한 쪼개기 (`[🚀 쪼개서 시작]`):** 클릭 시 팝오버 내에 아주 작은 할 일 이름 입력 칸(`input`)이 열립니다. 입력 후 엔터를 치면 해당 선행 병목 프로젝트 하위에 새로운 자식 할 일이 즉시 추가되고 렌더링이 갱신됩니다.

### B. 우측 상세 패널 병목 알림 영역 (Sidebar Alert Card)
프로젝트 선택 시 우측 상세 정보 영역 상단(운영 요약 상단)에 **"⚠️ 현재 프로젝트를 지연시키는 요인"** 진단 카드를 띄워줍니다.
*   *"B 프로젝트가 이 프로젝트 완성도를 8.5%p 감소시키는 중"* (수치 명시)
*   **대응 조치 버튼 세트:** `[B 노드로 이동]`, `[B 프로젝트에 할 일 추가]`, `[핵심 작업 집중 등록]` 제공.

---

## 3. 파일별 변경점 및 역할 분담 (Proposed Changes)

### A. [calculator.js](file:///c:/Users/USER/Documents/Codex/2026-05-22/1-2-ui-3-4/calculator.js)
*   `getBottleneckDetails(projectId)`: 해당 프로젝트가 받는 모든 외부/내부 병목들의 원인 아이디, 유형, 구체적인 갉아먹은 수치(`drag`) 및 원인 노드의 이름을 리스트(배열)로 빌드하여 반환합니다.

### B. [ui-components.js](file:///c:/Users/USER/Documents/Codex/2026-05-22/1-2-ui-3-4/ui-components.js)
*   `renderDetailHeader` 혹은 상단 영역에 `getBottleneckDetails`를 수신하여 진단 메시지와 액션 버튼들을 그리는 마크업 렌더러 추가.

### C. [graph-components.js](file:///c:/Users/USER/Documents/Codex/2026-05-22/1-2-ui-3-4/graph-components.js)
*   클릭 가능한 병목 요소(`[data-graph-edge-weight]`, `.graph-child-project-card`, `.graph-task-card`) 클릭 시 병목 해결 팝오버를 출력하는 HTML 마크업 및 데이터 바인딩 추가.

### D. [app.js](file:///c:/Users/USER/Documents/Codex/2026-05-22/1-2-ui-3-4/app.js) (혹은 이벤트 분리 모듈)
*   이벤트 리스너 바인딩:
    *   팝오버 표시 및 닫기 처리.
    *   `Focus` 타겟 노드 위치 이동 애니메이션 (해당 노드의 `x, y`를 읽어 캔버스 트랜스폼 `translate` 및 `scale` 조정).
    *   `quickAddSubtask`: 지정 프로젝트 하위에 태스크를 즉시 삽입하고 상태를 저장(`saveState()`) 후 화면 갱신.

### E. [graph-interactions.css](file:///c:/Users/USER/Documents/Codex/2026-05-22/1-2-ui-3-4/graph-interactions.css)
*   구조지도 팝오버의 유리모피즘(Glassmorphism) 테마 및 인풋 필드(`.bottleneck-popover input`), 버튼(`.bottleneck-popover button`)의 세련된 디자인 추가.

---

## 4. 검증 계획 (Verification Plan)

*   **정적 구문 분석:** `node --check`를 사용해 수정한 JS 파일 검증.
*   **CSS 괄호 검증:** `verify_css.py` 구동을 통한 문법 안정성 확인.
*   **수동 시나리오 검사:**
    1. 병목 연결 배지 클릭 ➔ 원인 추적 클릭 시 해당 노드로 줌인 이동 확인.
    2. "집중 등록" 클릭 ➔ 항상 위에 떠 있는 집중 위젯 목록에 대상 할 일이 정상 핀업되는지 대조.
    3. "쪼개서 시작" 클릭 ➔ 텍스트 입력 후 서브태스크 생성 및 부모 롤업 재계산 확인.
