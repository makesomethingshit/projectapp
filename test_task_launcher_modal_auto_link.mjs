import assert from "node:assert/strict";

const elements = new Map();

class FakeElement {
  constructor(id) {
    this.id = id;
    this.hidden = true;
    this.innerHTML = "";
    this.textContent = "";
  }

  querySelector() {
    return { focus() {} };
  }
}

function getElement(id) {
  if (!elements.has(id)) elements.set(id, new FakeElement(id));
  return elements.get(id);
}

globalThis.document = {
  querySelector(selector) {
    if (typeof selector === "string" && selector.startsWith("#")) {
      return getElement(selector.slice(1));
    }
    return new FakeElement(selector);
  },
  getElementById(id) {
    return getElement(id);
  }
};

globalThis.localStorage = {
  store: new Map(),
  getItem(key) {
    return this.store.get(key) || null;
  },
  setItem(key, value) {
    this.store.set(key, String(value));
  },
  removeItem(key) {
    this.store.delete(key);
  }
};

const { ensureDefaultArchiveSources, state } = await import("./state.js");

state.projects = [{ id: 42, parentId: null, name: "타이포 공부", status: "진행 중", progress: 30, note: "" }];
state.tasks = [{ id: 777, name: "디자인 사이트 보기", projectId: 42, progress: 15, advance: 20, contributionMode: "advance", note: "" }];
state.archiveResources = [];
state.archiveResourceLinks = [];
state.selectedArchiveResourceId = null;
ensureDefaultArchiveSources();

const { openTaskLauncherModal } = await import("./app-modals.js");
openTaskLauncherModal(777);

const body = getElement("taskLauncherBody");
const modal = getElement("taskLauncherModal");
assert.equal(modal.hidden, false);
assert.match(body.innerHTML, /BP&amp;O/);
assert.match(body.innerHTML, /https:\/\/bpando\.org\/logo-reviews\//);
assert.match(body.innerHTML, /task-launcher-curation/);
assert.match(body.innerHTML, /185&#44060; &#47553;&#53356;&#47484;/);
assert.match(body.innerHTML, /Known branding or type reference/);
assert.match(body.innerHTML, /task-launcher-curation-review/);
assert.equal(state.archiveResourceLinks.filter((link) => link.targetType === "task" && Number(link.targetId) === 777).length, 185);

console.log("task launcher modal auto link test passed");
