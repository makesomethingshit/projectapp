import assert from "node:assert/strict";

const elements = new Map();

class FakeElement {
  constructor(id) {
    this.id = id;
    this.hidden = true;
    this._innerHTML = "";
    this.textContent = "";
    this.scrollTop = 0;
    this.reviewDetails = null;
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    if (this._innerHTML.includes("task-launcher-curation-review")) {
      this.reviewDetails = { open: false };
    }
  }

  get innerHTML() {
    return this._innerHTML;
  }

  querySelector(selector) {
    if (selector === ".task-launcher-curation-review") return this.reviewDetails;
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

const { openTaskLauncherModal, refreshTaskLauncherModal } = await import("./app-modals.js");
openTaskLauncherModal(777);

const body = getElement("taskLauncherBody");
const modal = getElement("taskLauncherModal");
assert.equal(modal.hidden, false);
assert.match(body.innerHTML, /BP&amp;O/);
assert.match(body.innerHTML, /https:\/\/bpando\.org\/logo-reviews\//);
assert.match(body.innerHTML, /task-launcher-curation/);
assert.match(body.innerHTML, /185&#44060; &#47553;&#53356;&#47484;/);
assert.match(body.innerHTML, /\ube0c\ub79c\ub529\/\ud0c0\uc785 \uc804\ubb38 \ucc38\uace0\uc6d0/);
assert.match(body.innerHTML, /\uc774\ubbf8\uc9c0\+\ud14d\uc2a4\ud2b8 \ud3b8\uc9d1 \ucc38\uace0\uc5d0 \uc801\ud569/);
assert.match(body.innerHTML, /task-launcher-curation-review/);
assert.equal(state.archiveResourceLinks.filter((link) => link.targetType === "task" && Number(link.targetId) === 777).length, 185);
const itsNiceThatResource = state.archiveResources.find((resource) => resource.path === "https://www.itsnicethat.com/graphic-design");
assert.ok(itsNiceThatResource, "It's Nice That should be seeded");
const itsNiceThatLink = state.archiveResourceLinks.find((link) => (
  Number(link.resourceId) === Number(itsNiceThatResource.id)
  && link.targetType === "task"
  && Number(link.targetId) === 777
));
assert.ok(itsNiceThatLink, "It's Nice That should be linked to the design site task");
assert.equal(itsNiceThatLink.relationStrength, "strong");
assert.equal(itsNiceThatLink.relationScore, 94);
assert.ok(itsNiceThatLink.relationNote.includes("\uc8fc\uac04 1\ud398\uc774\uc9c0"));

body.querySelector(".task-launcher-curation-review").open = true;
body.scrollTop = 42;
refreshTaskLauncherModal();
assert.equal(body.querySelector(".task-launcher-curation-review").open, true);
assert.equal(body.scrollTop, 42);

console.log("task launcher modal auto link test passed");
