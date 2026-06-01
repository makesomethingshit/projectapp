# Local File Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 아카이브(리소스) 시스템에서 OS의 네이티브 파일/폴더 선택창을 통해 경로를 등록하고, 등록된 리소스를 로컬 프로그램으로 즉시 실행하며, 백그라운드에서 파일 유실 여부를 검사해 UI에 ⚠️ 경고를 표시합니다.

**Architecture:** Electron 메인 프로세스(main.js)에 파일 선택 및 존재 검사 IPC 핸들러를 추가하고, Preload 브릿지(preload.js)를 거쳐 렌더러(app.js, ui-components.js)에서 호출합니다. 비동기로 동작하는 유효성 체크 로직이 완료되면 CSS 클래스(.is-missing)를 제어하여 UI를 동적으로 변경합니다.

**Tech Stack:** Electron (dialog, shell IPC), Node.js (fs, path modules), Vanilla HTML/CSS/JS

---

### Task 1: Preload & Main IPC Channels

**Files:**
- Modify: [main.js](file:///c:/Users/USER/Documents/Codex/2026-05-22/1-2-ui-3-4/main.js)
- Modify: [preload.js](file:///c:/Users/USER/Documents/Codex/2026-05-22/1-2-ui-3-4/preload.js)
- Create: [test_local_file_bridge.mjs](file:///c:/Users/USER/Documents/Codex/2026-05-22/1-2-ui-3-4/test_local_file_bridge.mjs) (테스트용)

- [ ] **Step 1: Write path existence and file selection logic in main.js**
  `main.js`의 `ipcMain` 핸들러 등록 부분(예: 205라인 `open-resource` 아래)에 `select-file-or-folder`와 `check-path-exists` 채널을 등록합니다.
  ```javascript
  ipcMain.handle("select-file-or-folder", async (event, type) => {
    if (!mainWindow) return null;
    const isFolder = type === "folder";
    const result = await dialog.showOpenDialog(mainWindow, {
      title: isFolder ? "폴더 선택" : "파일 선택",
      properties: isFolder ? ["openDirectory"] : ["openFile"]
    });
    if (result.canceled || !result.filePaths?.[0]) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("check-path-exists", async (_event, filePath) => {
    try {
      if (!filePath) return false;
      if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
        return true;
      }
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  });
  ```

- [ ] **Step 2: Expose IPC channels in preload.js**
  `preload.js`의 `contextBridge.exposeInMainWorld("workshopApp", { ... })` 객체 내부에 API를 바인딩합니다.
  ```javascript
  selectFileOrFolder: (type) => ipcRenderer.invoke("select-file-or-folder", type),
  checkPathExists: (path) => ipcRenderer.invoke("check-path-exists", path)
  ```

- [ ] **Step 3: Create a unit test for path checking logic**
  `test_local_file_bridge.mjs` 파일을 만들고 로컬 파일 검증 헬퍼 동작을 확인하는 독립 실행형 테스트를 작성합니다.
  ```javascript
  import assert from "assert";
  import fs from "fs";

  // 모킹하지 않고 실제 로컬 환경의 헬퍼 로직을 직접 테스트
  function mockCheckPathExists(filePath) {
    if (!filePath) return false;
    if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
      return true;
    }
    return fs.existsSync(filePath);
  }

  // 1. 웹 링크는 항상 true여야 함
  assert.strictEqual(mockCheckPathExists("https://google.com"), true);

  // 2. 존재하지 않는 경로는 false여야 함
  assert.strictEqual(mockCheckPathExists("C:\\invalid\\path\\test_file_xyz.txt"), false);

  // 3. 임시 파일 생성 후 존재 검증
  const tempPath = "./temp_test_bridge.txt";
  fs.writeFileSync(tempPath, "test");
  assert.strictEqual(mockCheckPathExists(tempPath), true);
  fs.unlinkSync(tempPath);
  assert.strictEqual(mockCheckPathExists(tempPath), false);

  console.log("Local file bridge unit test passed!");
  ```

- [ ] **Step 4: Run the test to verify path utility logic**
  Run: `node test_local_file_bridge.mjs`
  Expected Output: `Local file bridge unit test passed!`

- [ ] **Step 5: Commit changes**
  Run: `git add main.js preload.js test_local_file_bridge.mjs`
  Run: `git commit -m "기능 구현: 파일/폴더 선택 및 유실 검사를 위한 IPC 채널 구축"`

---

### Task 2: UI Markup & Select Button Events

**Files:**
- Modify: [ui-components.js](file:///c:/Users/USER/Documents/Codex/2026-05-22/1-2-ui-3-4/ui-components.js)
- Modify: [app-graph-events.js](file:///c:/Users/USER/Documents/Codex/2026-05-22/1-2-ui-3-4/app-graph-events.js)

- [ ] **Step 1: Add File/Folder buttons to newArchiveForm in ui-components.js**
  `ui-components.js`의 `renderArchiveView()` 함수 내 `#addArchiveForm` 템플릿(254라인 부근)의 `newArchivePath` 입력 상자 코드를 다음과 같이 교체합니다.
  ```html
  <div style="display: flex; gap: 4px; align-items: center; flex: 1.5;">
    <input type="text" id="newArchivePath" placeholder="로컬 경로 또는 웹 URL" style="flex: 1; padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text);" required />
    <button type="button" id="newArchiveSelectFile" title="로컬 파일 선택" style="padding: 6px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--panel-raised); cursor: pointer; color: var(--text); font-size: 11px;">📁 파일</button>
    <button type="button" id="newArchiveSelectFolder" title="로컬 폴더 선택" style="padding: 6px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--panel-raised); cursor: pointer; color: var(--text); font-size: 11px;">📂 폴더</button>
  </div>
  ```

- [ ] **Step 2: Add File/Folder buttons to edit-archive-form in ui-components.js**
  `ui-components.js`의 `renderArchiveView()` 내 개별 리소스 수정 폼(178라인 부근)의 `data-edit-archive-path` 입력 상자 코드를 교체합니다.
  ```html
  <div style="display: flex; gap: 4px; align-items: center; flex: 1;">
    <input data-edit-archive-path type="text" value="${escapeHtml(resource.path)}" aria-label="아카이브 경로 또는 URL" style="flex: 1; min-width: 0; padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text);" required />
    <button type="button" class="edit-archive-select-file" data-resource-id="${resource.id}" title="로컬 파일 선택" style="padding: 6px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--panel-raised); cursor: pointer; color: var(--text); font-size: 11px;">📁</button>
    <button type="button" class="edit-archive-select-folder" data-resource-id="${resource.id}" title="로컬 폴더 선택" style="padding: 6px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--panel-raised); cursor: pointer; color: var(--text); font-size: 11px;">📂</button>
  </div>
  ```

- [ ] **Step 3: Update resource card row HTML structure**
  `ui-components.js`의 `archive-resource-row`를 정의하는 부분(187라인 및 513라인 부근)에 `js-archive-item`, `data-resource-id`, `data-resource-path` 속성을 삽입합니다.
  ```html
  <!-- 187라인 부근 -->
  <div class="archive-resource-row js-archive-item" data-resource-id="${resource.id}" data-resource-path="${escapeHtml(resource.path)}" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; box-shadow: var(--shadow-sm);">
  ```
  ```html
  <!-- 513라인 부근 (상세 패널 연결 부분) -->
  <div class="archive-resource-row js-archive-item" data-resource-id="${resource.id}" data-resource-path="${escapeHtml(resource.path)}" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; box-shadow: var(--shadow-sm);">
  ```

- [ ] **Step 4: Bind click events in app-graph-events.js**
  `app-graph-events.js` 내에 신규 생성 시의 버튼 이벤트와 수정 시의 이벤트 위임을 바인딩합니다.
  - `#newArchiveSelectFile`, `#newArchiveSelectFolder` 클릭 핸들러 추가:
    ```javascript
    // app-graph-events.js 내 이벤트 바인딩 블록에 추가
    view.addEventListener("click", async (e) => {
      // 신규 추가 폼의 파일 선택
      if (e.target.id === "newArchiveSelectFile") {
        const path = await window.workshopApp.selectFileOrFolder("file");
        if (path) {
          const input = document.getElementById("newArchivePath");
          if (input) input.value = path;
          // 드롭다운 타입을 'file'로 변경
          const typeSelect = document.getElementById("newArchiveType");
          if (typeSelect) typeSelect.value = "file";
        }
      }
      // 신규 추가 폼의 폴더 선택
      if (e.target.id === "newArchiveSelectFolder") {
        const path = await window.workshopApp.selectFileOrFolder("folder");
        if (path) {
          const input = document.getElementById("newArchivePath");
          if (input) input.value = path;
          // 드롭다운 타입을 'folder'로 변경
          const typeSelect = document.getElementById("newArchiveType");
          if (typeSelect) typeSelect.value = "folder";
        }
      }
      
      // 수정 폼 내 파일 선택
      const editFileBtn = e.target.closest(".edit-archive-select-file");
      if (editFileBtn) {
        const path = await window.workshopApp.selectFileOrFolder("file");
        if (path) {
          const form = editFileBtn.closest("form");
          const input = form.querySelector("[data-edit-archive-path]");
          if (input) input.value = path;
          const typeSelect = form.querySelector("[data-edit-archive-type]");
          if (typeSelect) typeSelect.value = "file";
        }
      }
      // 수정 폼 내 폴더 선택
      const editFolderBtn = e.target.closest(".edit-archive-select-folder");
      if (editFolderBtn) {
        const path = await window.workshopApp.selectFileOrFolder("folder");
        if (path) {
          const form = editFolderBtn.closest("form");
          const input = form.querySelector("[data-edit-archive-path]");
          if (input) input.value = path;
          const typeSelect = form.querySelector("[data-edit-archive-type]");
          if (typeSelect) typeSelect.value = "folder";
        }
      }
    });
    ```

- [ ] **Step 5: Run existing tests to ensure no regression**
  Run: `node test_archive_view_modes.mjs`
  Expected: PASS

- [ ] **Step 6: Commit changes**
  Run: `git add ui-components.js app-graph-events.js`
  Run: `git commit -m "기능 구현: 아카이브 추가/수정 모달에 OS 파일 선택 단추 추가 및 이벤트 연결"`

---

### Task 3: Path Verification & UI CSS Style

**Files:**
- Modify: [app.js](file:///c:/Users/USER/Documents/Codex/2026-05-22/1-2-ui-3-4/app.js)
- Modify: [components.css](file:///c:/Users/USER/Documents/Codex/2026-05-22/1-2-ui-3-4/components.css)

- [ ] **Step 1: Implement scanArchivePaths in app.js**
  `app.js` 파일 내 적절한 위치(예: `syncGraphPortEdges` 아래)에 `scanArchivePaths` 비동기 존재 스캔 엔진 함수를 작성하고 export합니다.
  ```javascript
  export async function scanArchivePaths(container = document) {
    const items = container.querySelectorAll(".js-archive-item");
    if (!items || items.length === 0) return;
    
    // 병렬 배치 실행으로 검사 최적화
    const promises = Array.from(items).map(async (item) => {
      const path = item.getAttribute("data-resource-path");
      if (!path) return;
      
      const exists = await window.workshopApp.checkPathExists(path);
      if (!exists) {
        item.classList.add("is-missing");
      } else {
        item.classList.remove("is-missing");
      }
    });
    
    await Promise.all(promises);
  }
  ```

- [ ] **Step 2: Add CSS rules for is-missing state in components.css**
  `components.css` 맨 밑에 유실 리소스에 대한 스타일링 가이드를 작성합니다.
  ```css
  /* 유실 리소스 카드 스타일 */
  .archive-resource-row.is-missing {
    border-color: rgba(239, 68, 68, 0.4) !important;
    background: rgba(239, 68, 68, 0.04) !important;
    opacity: 0.8;
  }

  .archive-resource-row.is-missing strong::before {
    content: "⚠️ [유실됨] ";
    color: var(--coral, #ef4444);
    font-weight: bold;
  }

  .archive-resource-row.is-missing .green-command {
    opacity: 0.5;
    cursor: not-allowed !important;
    pointer-events: none;
  }
  ```

- [ ] **Step 3: Trigger scanArchivePaths when rendering main views in app.js**
  `app.js`에서 아카이브 전체 화면을 그리는 함수(`showMainView("archive")` 등) 및 프로젝트 상세 패널을 그리는 함수(`selectProject(projectId)`)의 실행 코드 끝 부분에 `scanArchivePaths()` 호출을 연동합니다.
  - `selectProject` 함수 탐색: `app.js` 내의 `selectProject` 내부 마지막 라인에 추가:
    ```javascript
    // app.js 내 selectProject 함수 끝자락
    renderProjectDetail(project); // 기존 렌더러 호출 직후
    scanArchivePaths(document.getElementById("projectDetailPanel")); // 비동기 스캔 트리거
    ```
  - `showMainView` 함수 탐색: `app.js` 내 `showMainView` 가 "archive"일 때의 처리 끝자락에 추가:
    ```javascript
    // app.js 내 showMainView 에서 case "archive": 처리 끝자락
    document.getElementById("archiveFullContent").innerHTML = renderArchiveView(); // 기존 코드
    scanArchivePaths(document.getElementById("archiveFullView")); // 비동기 스캔 트리거
    ```

- [ ] **Step 4: Run unit tests to confirm stability**
  Run: `node test_archive_detail_panel.mjs`
  Expected: PASS

- [ ] **Step 5: Commit changes**
  Run: `git add app.js components.css`
  Run: `git commit -m "기능 구현: 백그라운드 유실 체크 엔진 구현 및 CSS 경고 스타일 바인딩"`
