# Archive Tab and Nodes Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 프로젝트 및 할 일 리소스를 연동하여 즉각 실행할 수 있는 아카이브 탭(A) 및 아카이브 노드(C) 통합 구현.

**Architecture:** Electron Main 프로세스의 Shell API를 중개하는 IPC 채널을 개설하고, LocalStorage 스키마를 확장하여 상세 아카이브 탭 및 캔버스 아카이브 노드 관계선을 상호 롤업 연동합니다.

**Tech Stack:** Electron API (shell.openPath, shell.openExternal), HTML5, CSS3 Vanilla HSL, ES Modules.

---

### Task 1: Electron IPC 및 Preload 브릿지 구현

**Files:**
- Modify: `main.js:1`
- Modify: `main.js:106`
- Modify: `preload.js:3`

- [ ] **Step 1: main.js 상단에 shell 모듈 임포트 추가**
  ```javascript
  // main.js 상단 수정
  const { app, BrowserWindow, Menu, nativeTheme, ipcMain, dialog, shell } = require("electron");
  ```

- [ ] **Step 2: main.js에 open-resource IPC 핸들러 추가**
  ```javascript
  // main.js ipcMain 핸들러 영역 끝부분에 추가
  ipcMain.handle("open-resource", async (_event, path, type) => {
    try {
      if (!path) return { ok: false, error: "경로가 없습니다." };
      const isWebLink = type === "link" || path.startsWith("http://") || path.startsWith("https://");
      if (isWebLink) {
        await shell.openExternal(path);
      } else {
        const err = await shell.openPath(path);
        if (err) return { ok: false, error: err };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
  ```

- [ ] **Step 3: preload.js에 workshopApp.openResource 브릿지 함수 노출**
  ```javascript
  // preload.js contextBridge.exposeInMainWorld 내부에 추가
  openResource: (path, type) => ipcRenderer.invoke("open-resource", path, type),
  ```

- [ ] **Step 4: node --check 실행 및 구문 정합성 확인**
  Run: `node --check main.js; node --check preload.js`
  Expected: PASS

- [ ] **Step 5: Git Commit**
  ```bash
  git add main.js preload.js
  git commit -m "feat: add open-resource Electron IPC channel and preload bridge"
  ```

---

### Task 2: 데이터 스키마 정의 및 데모 데이터 주입

**Files:**
- Modify: `state.js:13`
- Modify: `state.js:160`

- [ ] **Step 1: state.js 내의 state 기본 객체 스키마 확장**
  ```javascript
  // state.js의 기본 state 정의 영역에 추가
  export const state = {
    // ... 기존 필드
    projects: [],
    tasks: [],
    projectLinks: [],
    appSettings: {
      theme: "light",
      alwaysOnTop: true,
      leftPanelCollapsed: false,
      globalGraphView: false,
      graphScope: "all",
      graphShowTasks: true,
      graphShowExternal: true,
      graphZoom: 1.0,
      graphCanvasScale: 1.25,
      graphNodeScale: 1.0,
      graphNodePositions: {},
      graphTaskPositions: {},
      graphMemoNodes: [],
      graphFormulaNodes: [],
      graphFormulaLinks: [],
      graphFormulaInputLinks: [],
      // 신규 추가 필드
      graphArchiveNodes: [],
      graphArchiveLinks: []
    },
    // ...
  };
  ```

- [ ] **Step 2: state.js 로드 시 신규 필드 강제 보정 및 병목 테스트 데모 데이터에 아카이브 예시 주입**
  ```javascript
  // state.js의 loadState() 내부 또는 마이그레이션 영역 보완
  // graphArchiveNodes와 graphArchiveLinks가 누락되어 있으면 초기화
  if (!state.appSettings.graphArchiveNodes) state.appSettings.graphArchiveNodes = [];
  if (!state.appSettings.graphArchiveLinks) state.appSettings.graphArchiveLinks = [];
  
  // projects 내 리소스 배열 초기화
  state.projects.forEach(p => {
    if (!p.resources) p.resources = [];
  });
  ```
  데모 데이터 인젝트(id 9) 프로젝트 부분 수정:
  ```javascript
  // "⚠️ 병목 진단 테스트" 데모 프로젝트(id 9) 강제 생성 시 resources 데이터 탑재
  const demoProj = state.projects.find(p => p.id === 9);
  if (demoProj) {
    demoProj.resources = [
      { id: 1, name: "📁 로컬 탐색기 테스트(윈도우 C드라이브)", type: "folder", path: "C:\\" },
      { id: 2, name: "🔗 작업실 GitHub 저장소", type: "link", path: "https://github.com" }
    ];
  }
  ```

- [ ] **Step 3: node --check 실행 및 구문 정합성 확인**
  Run: `node --check state.js`
  Expected: PASS

- [ ] **Step 4: Git Commit**
  ```bash
  git add state.js
  git commit -m "feat: extend state schema with archive structures and inject demo resources"
  ```

---

### Task 3: 아카이브 탭 뷰 및 할 일 배지/모달 UI 마크업 구현

**Files:**
- Modify: `ui-components.js:481`
- Modify: `ui-components.js:376`
- Modify: `ui-components.js:562`

- [ ] **Step 1: ui-components.js 내의 renderViewSwitch 개편**
  ```javascript
  // ui-components.js의 renderViewSwitch() 수정
  export function renderViewSwitch() {
    return `
      <div class="view-switch" aria-label="보기 전환">
        <button type="button" class="${state.viewMode === "detail" ? "active" : ""}" data-view-mode="detail">상세</button>
        <button type="button" class="${state.viewMode === "graph" ? "active" : ""}" data-view-mode="graph">그래프</button>
        <button type="button" class="${state.viewMode === "archive" ? "active" : ""}" data-view-mode="archive">아카이브</button>
      </div>
    `;
  }
  ```

- [ ] **Step 2: ui-components.js에 renderArchiveView 렌더러 추가**
  ```javascript
  // ui-components.js 끝단에 추가
  export function renderArchiveView(project) {
    const resources = project.resources || [];
    const fileListMarkup = resources.length ? resources.map(res => {
      let icon = "📄";
      if (res.type === "folder") icon = "📁";
      if (res.type === "link") icon = "🔗";
      
      return `
        <div class="archive-resource-row" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px;">
          <div style="text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; margin-right: 8px;">
            <strong style="display: block; font-size: 11.5px; color: var(--text);">${icon} ${escapeHtml(res.name)}</strong>
            <small style="display: block; font-size: 9px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(res.path)}</small>
          </div>
          <div style="display: flex; gap: 4px; flex-shrink: 0;">
            <button type="button" class="mock-button green-command" data-open-archive-path="${escapeHtml(res.path)}" data-archive-type="${res.type}" style="padding: 4px 8px; font-size: 10px; border-radius: 4px; border: 1px solid var(--border); background: var(--panel-raised); cursor: pointer; color: var(--text);">열기</button>
            <button type="button" class="mock-button delete-archive-btn" data-delete-archive-id="${res.id}" data-project-id="${project.id}" style="padding: 4px 8px; font-size: 10px; border-radius: 4px; border: 1px solid var(--coral); background: transparent; color: var(--coral); cursor: pointer;">×</button>
          </div>
        </div>
      `;
    }).join("") : `<p class="notice">연결된 리소스가 없습니다.</p>`;

    return `
      <header class="detail-header">
        <div class="detail-title-area">
          <p class="detail-kicker">프로젝트 보관소</p>
          <h2>${escapeHtml(project.name)} 아카이브</h2>
          <p>프로젝트와 관련된 로컬 파일, 디렉토리 경로, 참고 웹사이트를 연결하여 바로 실행합니다.</p>
        </div>
        <div class="detail-side">
          ${renderViewSwitch()}
        </div>
      </header>

      <section class="archive-list-section" style="margin-top: 16px;">
        <h3 style="text-align: left; font-size: 12px; margin-bottom: 8px; color: var(--text);">리소스 목록 (${resources.length})</h3>
        ${fileListMarkup}
      </section>

      <section class="archive-add-section" style="margin-top: 20px; padding-top: 16px; border-top: 1px dashed var(--border);">
        <h3 style="text-align: left; font-size: 12px; margin-bottom: 8px; color: var(--text);">+ 새 리소스 연결 추가</h3>
        <form id="addArchiveForm" style="display: grid; gap: 8px; text-align: left;">
          <div style="display: flex; gap: 6px;">
            <input type="text" id="newArchiveName" placeholder="리소스 이름 (예: 최종 기획안)" style="flex: 1; padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text);" required />
            <select id="newArchiveType" style="width: 100px; padding: 6px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text);">
              <option value="file">로컬 파일</option>
              <option value="folder">로컬 폴더</option>
              <option value="link">웹 링크</option>
            </select>
          </div>
          <div style="display: flex; gap: 6px;">
            <input type="text" id="newArchivePath" placeholder="로컬 경로 또는 웹 URL (예: C:\\Projects\\spec.pdf)" style="flex: 1; padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text);" required />
            <button type="submit" style="padding: 6px 16px; border: none; border-radius: 6px; background: var(--accent); color: white; cursor: pointer; font-weight: bold;">추가</button>
          </div>
        </form>
      </section>
    `;
  }
  ```

- [ ] **Step 3: taskCardMarkup에 연결된 아카이브 배지 렌더링 추가**
  ```javascript
  // ui-components.js 내 taskCardMarkup() 보완
  // 할 일에 꽂힌 아카이브 연결선 목록을 쿼리하여 HTML 배지로 삽입
  const archiveLinks = (state.appSettings.graphArchiveLinks || [])
    .filter(link => link.targetType === "task" && link.targetId === task.id);
  const badgesMarkup = archiveLinks.map(link => {
    const archiveNode = (state.appSettings.graphArchiveNodes || []).find(n => n.id === link.sourceId);
    if (!archiveNode) return "";
    let icon = "📄";
    if (archiveNode.type === "folder") icon = "📁";
    if (archiveNode.type === "link") icon = "🔗";
    return `
      <button type="button" class="mini-archive-badge-btn" data-open-archive-path="${escapeHtml(archiveNode.path)}" data-archive-type="${archiveNode.type}" style="display: inline-flex; align-items: center; gap: 3px; border: 1px solid var(--border); border-radius: 4px; padding: 2px 5px; font-size: 8.5px; background: color-mix(in srgb, var(--accent) 6%, var(--surface)); color: var(--accent); cursor: pointer; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 4px;">
        ${icon} ${escapeHtml(archiveNode.title)}
      </button>
    `;
  }).join("");

  // taskCardMarkup의 적절한 위치 (예: strong 밑 또는 progress 슬라이더 위)에 badgesMarkup을 삽입
  ```

- [ ] **Step 4: noteModal 마크업에 아카이브 리소스 목록 렌더러 연동**
  ```javascript
  // ui-components.js 및 app-modals.js 등 noteModal을 렌더링하는 부분 확인
  // index.html 에 있는 noteModal에 동적으로 연결 리소스를 렌더링해 줄 수 있도록 app-modals.js의 openNoteModal() 수정
  ```

- [ ] **Step 5: node --check 실행 및 구문 정합성 확인**
  Run: `node --check ui-components.js`
  Expected: PASS

- [ ] **Step 6: Git Commit**
  ```bash
  git add ui-components.js
  git commit -m "feat: design archive views, mini badges, and modal markup"
  ```

---

### Task 4: 구조지도 아카이브 노드 및 Context Menu 빌딩

**Files:**
- Modify: `graph-components.js:141`
- Modify: `graph-components.js:220`
- Modify: `graph-components.js:460`
- Modify: `graph-components.js:730`

- [ ] **Step 1: buildGraphData()에서 archive 노드 및 archiveLink 엣지 빌딩 연동**
  ```javascript
  // buildGraphData() 내부에 archiveNodes 빌딩 추가
  const archiveNodes = options.full ? (state.appSettings.graphArchiveNodes || []).map((node) => ({
    id: `archive-${node.id}`,
    sourceId: node.id,
    type: "archive",
    label: node.title,
    sublabel: node.path,
    archiveType: node.type,
    x: Math.max(5, Math.min(95, Number(node.x) || 50)),
    y: Math.max(7, Math.min(93, Number(node.y) || 50))
  })) : [];
  
  // nodes 배열에 병합
  const nodes = [...projectNodes, ...visibleTasks, ...freeTasks, ...memoNodes, ...formulaNodes, ...archiveNodes];
  
  // edges 배열에 archiveLinks 병합
  const archiveEdges = options.full ? (state.appSettings.graphArchiveLinks || []).map((link) => {
    const source = archiveNodes.find((node) => node.sourceId === link.sourceId);
    let to = "";
    if (link.targetType === "project") {
      const targetAncestorId = getVisibleAncestorId(link.targetId);
      to = targetAncestorId ? `project-${targetAncestorId}` : null;
    } else {
      to = `task-${link.targetId}`; // or task.id depending on node list format
    }
    if (!source || !to) return null;
    
    return {
      id: `archiveLink:${link.sourceId}:${link.targetType}:${link.targetId}`,
      sourceId: link.sourceId,
      targetId: link.targetId,
      targetType: link.targetType,
      from: `archive-${link.sourceId}`,
      to,
      type: "external",
      linkKind: "archiveLink",
      external: true,
      removable: true
    };
  }).filter(Boolean) : [];
  ```

- [ ] **Step 2: renderGraphView() 내에서 archive 노드 마크업 추가**
  ```javascript
  // renderGraphView() 내의 nodes.map(...) 루프 내에 archive 노드 템플릿 지원
  // archive 노드 article 구조:
  /*
  <article class="graph-node archive ${node.selected ? 'selected' : ''}" data-graph-free-node="archive:${node.sourceId}" style="--x:${node.x}%; --y:${node.y}%">
    <button type="button" class="graph-node-main">
      <strong>${escapeHtml(node.label)}</strong>
      <span>${escapeHtml(node.sublabel)}</span>
    </button>
    <button type="button" class="graph-drag-handle" data-graph-drag-free-node="archive:${node.sourceId}">이동</button>
    <button type="button" class="mock-button" data-open-archive-path="${escapeHtml(node.sublabel)}" data-archive-type="${node.archiveType}" style="width: 100%; margin-top: 4px; font-size: 9.5px; padding: 4px;">열기/실행</button>
  </article>
  */
  ```

- [ ] **Step 3: graphContextMenuMarkup()에 아카이브 노드 추가 항목 추가**
  ```javascript
  // graphContextMenuMarkup()에 추가
  <button type="button" data-graph-context-action="archive-node">아카이브 노드</button>
  ```

- [ ] **Step 4: node --check 실행 및 구문 정합성 확인**
  Run: `node --check graph-components.js`
  Expected: PASS

- [ ] **Step 5: Git Commit**
  ```bash
  git add graph-components.js
  git commit -m "feat: build archive node data and canvas renderers"
  ```

---

### Task 5: Core CRUD 로직 및 모듈 연동

**Files:**
- Modify: `app.js:320`
- Modify: `app.js:860`
- Modify: `app-modals.js:70`

- [ ] **Step 1: app.js에 아카이브 비즈니스 CRUD 함수 정의 및 export**
  ```javascript
  // app.js에 추가
  export async function openResource(path, type) {
    if (window.workshopApp?.openResource) {
      const res = await window.workshopApp.openResource(path, type);
      if (res && !res.ok) {
        state.graphNotice = `에러: ${res.error}`;
      } else {
        state.graphNotice = "리소스를 열었습니다.";
      }
    } else {
      window.open(path, "_blank");
    }
    render();
  }

  export function addArchiveResource(projectId, name, type, path) {
    const proj = getProject(projectId);
    if (!proj) return;
    proj.resources = proj.resources || [];
    const id = createId(proj.resources);
    proj.resources.push({ id, name, type, path });
    state.graphNotice = `"${name}" 리소스를 추가했습니다.`;
    saveState();
    render();
  }

  export function deleteArchiveResource(projectId, resourceId) {
    const proj = getProject(projectId);
    if (!proj) return;
    proj.resources = (proj.resources || []).filter(r => r.id !== Number(resourceId));
    state.graphNotice = "리소스를 제거했습니다.";
    saveState();
    render();
  }
  
  // 아카이브 노드 CRUD 헬퍼 추가
  export function createGraphArchiveNode(point) {
    state.appSettings.graphArchiveNodes = state.appSettings.graphArchiveNodes || [];
    const id = createId(state.appSettings.graphArchiveNodes);
    state.appSettings.graphArchiveNodes.push({
      id,
      title: "새 리소스 폴더",
      type: "folder",
      path: "C:\\",
      x: point.x,
      y: point.y
    });
    state.graphNotice = "아카이브 노드를 생성했습니다.";
    saveState();
    renderProjectDetail();
  }
  ```

- [ ] **Step 2: renderProjectDetail()에서 state.viewMode === "archive" 조건 분기 추가**
  ```javascript
  // renderProjectDetail() 시작부분 부근 수정
  if (state.viewMode === "archive") {
    projectDetail.innerHTML = renderArchiveView(project);
    return;
  }
  ```

- [ ] **Step 3: app-modals.js의 openNoteModal()에서 아카이브 리스트 노출 및 연동**
  ```javascript
  // openNoteModal 내부에서, noteModal 엘리먼트 내부에 해당 태스크에 연결된 아카이브 리소스를 동적으로 그려주기
  const noteArchiveContainer = noteModal.querySelector(".note-archive-section") 
    || (() => {
         const div = document.createElement("div");
         div.className = "note-archive-section";
         noteModal.querySelector(".modal-actions").before(div);
         return div;
       })();
  // 연결된 리소스 쿼리하여 리스트 렌더링
  ```

- [ ] **Step 4: node --check 실행 및 구문 정합성 확인**
  Run: `node --check app.js; node --check app-modals.js`
  Expected: PASS

- [ ] **Step 5: Git Commit**
  ```bash
  git add app.js app-modals.js
  git commit -m "feat: implement archive business operations and noteModal link list UI"
  ```

---

### Task 6: UI 및 구조지도 이벤트 바인딩 통합

**Files:**
- Modify: `app-graph-events.js:80`
- Modify: `app-graph-events.js:142`

- [ ] **Step 1: app-graph-events.js에 아카이브 모듈 임포트 추가**
  ```javascript
  import {
    // ...
    openResource,
    addArchiveResource,
    deleteArchiveResource,
    createGraphArchiveNode
  } from "./app.js";
  ```

- [ ] **Step 2: app-graph-events.js 클릭 리스너 내 아카이브 액션 바인딩**
  - 아카이브 바로가기 버튼 클릭 (`[data-open-archive-path]`):
    ```javascript
    const openResBtn = event.target.closest("[data-open-archive-path]");
    if (openResBtn) {
      event.preventDefault();
      const path = openResBtn.dataset.openArchivePath;
      const type = openResBtn.dataset.archiveType;
      openResource(path, type);
      return;
    }
    ```
  - 아카이브 추가 폼 서브밋 (`#addArchiveForm`):
    ```javascript
    if (event.target.closest("#addArchiveForm")) {
      // form submit listener or delegate click
    }
    ```
  - 아카이브 리소스 삭제 (`[data-delete-archive-id]`):
    ```javascript
    const delResBtn = event.target.closest("[data-delete-archive-id]");
    if (delResBtn) {
      event.preventDefault();
      const projId = Number(delResBtn.dataset.projectId);
      const resId = Number(delResBtn.dataset.deleteArchiveId);
      deleteArchiveResource(projId, resId);
      return;
    }
    ```
  - 콘텍스트 메뉴 '아카이브 노드' 생성 (`data-graph-context-action="archive-node"`):
    ```javascript
    if (action === "archive-node") {
      createGraphArchiveNode(point);
      return;
    }
    ```

- [ ] **Step 3: node --check 실행 및 구문 정합성 확인**
  Run: `node --check app-graph-events.js`
  Expected: PASS

- [ ] **Step 4: Git Commit**
  ```bash
  git add app-graph-events.js
  git commit -m "feat: wire all archive-related click and submit events"
  ```
