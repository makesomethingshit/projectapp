# 2026-05-31 Project Bottlenecks Design Spec

작업실 앱의 구조지도(Graph Canvas) 상에서 프로젝트 완성도 및 진행도를 지연시키는 주된 원인(병목)을 찾아내고, 시각적으로 강조하여 사용자의 의사결정을 돕는 기능 설계 문서입니다.

## 1. 개요 및 배경

완성도와 진행도는 독립된 지표로서 하위 프로젝트(내부 반영) 및 외부 프로젝트(외부 반영선)의 영향을 받아 결정됩니다.
이 과정에서 특정 선행 프로젝트나 하위 할 일이 완료되지 않아 상위/후행 프로젝트의 진행이 멈추거나 점수가 크게 하락하는 현상을 **병목(Bottleneck)**으로 정의하고, 이를 구조지도에 직관적인 빨간색/주황색 및 경고 심볼로 표시하여 사용자가 우선순위를 식별하도록 지원합니다.

---

## 2. 병목 탐지 수학적 기준 (Data & Math Logic)

병목 판정은 점수 하락의 실제 영향도(Drag Score)를 기준으로 계산합니다.

### A. 외부 반영선 병목 (External Link Bottleneck)
외부 연결선 $S \to T$ (Source $S$가 Target $T$에 영향)가 Target의 전체 합산(Rollup) 점수를 깎아먹는 영향도 $D_{ext}$는 다음과 같이 정의합니다:
$$D_{ext} = W \times \frac{V_{target\_own} - V_{source\_rollup}}{100}$$
*   $W$: 반영선(Link)의 반영비 가중치 (5% ~ 90%)
*   $V_{target\_own}$: 후행 프로젝트 $T$의 자체 점수 (자체 진행도 또는 하위 가중 평균 이전의 기본 값)
*   $V_{source\_rollup}$: 선행 프로젝트 $S$의 최종 반영 점수

### B. 내부 기여 요소 병목 (Internal Element Bottleneck)
부모 프로젝트 $P$에 속한 하위 프로젝트 또는 직속 할 일 $C_i$가 부모 프로젝트의 최종 Rollup 완성도를 깎아먹는 영향도 $D_{int}$는 다음과 같이 정의합니다:
$$D_{int} = \frac{W_i}{Total\_W} \times (V_{parent\_rollup} - V_{child})$$
*   $W_i$: 부모 노드 내에서 $C_i$가 차지하는 기여 가중치(Weight)
*   $Total\_W$: 부모 노드에 등록된 모든 기여 요소 가중치 합
*   $V_{parent\_rollup}$: 부모 프로젝트 $P$의 최종 합산 점수
*   $V_{child}$: 기여 요소 $C_i$의 점수 (하위 프로젝트의 경우 롤업 점수, 할 일의 경우 자체 완성도 점수)

### C. 병목 등급 판정 (Bottleneck Severity Levels)
영향도 $D$가 양수일 때 아래 기준에 따라 등급을 나눕니다:
*   🔴 **임계 병목 (Critical Bottleneck):** $D \ge 10$ (후행/부모 점수를 **10%p 이상** 감소시키는 원인)
*   🟡 **주의 병목 (Warning Bottleneck):** $5 \le D < 10$ (후행/부모 점수를 **5%p ~ 10%p** 감소시키는 원인)
*   🟢 **일반 상태:** $D < 5$

---

## 3. UI 및 시각화 설계 (Visual Styling)

### A. 외부 반영선 (External SVG Path)
*   **임계 병목:** 점선 스타일(stroke-dasharray) 및 흐르는 애니메이션 효과가 들어간 빨간색 라인 적용.
*   **주의 병목:** 주황색 점선(stroke-dasharray) 라인 적용.
*   **수치 배지:** 반영 비율 배지(예: `50%`) 좌측에 `⚠️` 아이콘 추가. 배경색과 테두리에 해당하는 등급 색상(Red/Orange) 및 미세한 광원 효과(box-shadow) 부여.

### B. 내부 노드 카드 (Sub-project & Task Cards)
부모 노드 내부의 리스트 형태 자식 카드에 스타일을 추가합니다:
*   **임계 병목:** 테두리(Border) 빨간색 강조, 배경색에 미세한 빨간색 알파값 적용. 타이틀 좌측에 `⚠️` 아이콘 추가. 하락 영향도 수치(`하락 기여: -8.0%p`)를 서브 텍스트로 표기.
*   **주의 병목:** 테두리 주황색 강조. 타이틀 좌측에 `⚠️` 아이콘 추가 및 하락 수치 표기.

---

## 4. 파일별 변경점 예측 (Proposed File Modifications)

### A. [calculator.js](file:///c:/Users/USER/Documents/Codex/2026-05-22/1-2-ui-3-4/calculator.js)
*   `getExternalLinkDrag(link)`: 외부 링크의 영향도를 계산하여 `{ drag, level }` 객체를 반환하는 함수 구현.
*   `getInternalContributorDrag(projectId, key)`: 부모 내 자식 요소의 영향도를 계산하여 `{ drag, level }` 객체를 반환하는 함수 구현.

### B. [graph-components.js](file:///c:/Users/USER/Documents/Codex/2026-05-22/1-2-ui-3-4/graph-components.js)
*   `renderGraphView()`:
    *   SVG 연결선 파싱 시 각 링크의 병목 레벨을 계산하여 path 클래스에 `bottleneck-critical` 또는 `bottleneck-warning` 추가.
    *   반영 비율 배지 마크업에 `⚠️` 접두사 추가 및 등급 클래스 바인딩.
*   `graphProjectCardMarkup()`:
    *   자식 프로젝트 카드 렌더링 시 내부 병목 레벨을 연산하여 카드 래퍼 클래스에 바인딩하고, 하단에 `하락 기여: -X.X%p` 요약 텍스트 추가.
    *   할 일 카드 또한 동일한 병목 레벨을 바인딩하여 렌더링.

### C. [graph-interactions.css](file:///c:/Users/USER/Documents/Codex/2026-05-22/1-2-ui-3-4/graph-interactions.css)
*   `.graph-lines path.external.bottleneck-critical` 및 `.bottleneck-warning`에 대한 대시라인 및 컬러 토큰 설정.
*   `@keyframes bottleneck-flow` 애니메이션 정의 (Critical 외부 반영선에 생동감 제공).
*   `.graph-edge-weight-badge.bottleneck-critical` 등 수치 배지용 유리 모피즘(Glassmorphism) 테마 보강.
*   부모 노드 내부의 자식 카드 및 할 일 카드 스타일의 경고 테두리(`border: 1px.5px solid var(--coral)`) 스타일 클래스 선언.

---

## 5. 검증 계획 (Verification Plan)

### A. 자동 검증 및 정적 검사
*   구문 검사: 코드 수정 후 `node --check app.js` 및 `calculator.js`, `graph-components.js`를 테스트 실행하여 문법 오류가 없는지 검증합니다.
*   CSS 유효성: `verify_css.py`를 실행하여 괄호 짝 누락 여부를 확인합니다.

### B. 수동 UI 동작 검증
*   임의로 선행 프로젝트의 완성도를 낮추고 반영비 가중치를 높인 연결선을 테스트 케이스로 생성하여 병목 라인과 애니메이션이 의도대로 나타나는지 육안으로 최종 확인합니다.
*   하위 프로젝트 완성도를 낮추어 부모 노드 내부에 빨간색 경고 카드와 영향도 텍스트가 정상 노출되는지 대조합니다.
