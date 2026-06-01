import { createRequire } from 'module';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// require('electron') 모킹하기 위해 module 패치
const Module = require('module');
const originalLoad = Module._load;

const mockIpcHandlers = {};
let mockExposed = {};
let lastShowOpenDialogOptions = null;

// 테스트 동작 제어용 캡슐화된 지역 변수 객체
const testConfig = {
  canceled: false,
  filePath: '/mock/path/file.txt'
};

const mockElectron = {
  app: {
    whenReady: () => ({
      then: (cb) => {
        return { catch: () => {} };
      }
    }),
    on: () => {},
    isPackaged: false
  },
  BrowserWindow: class {
    constructor() {
      this.webContents = {
        on: () => {},
        executeJavaScript: async () => null
      };
    }
    loadFile() {}
    on() {}
    isDestroyed() { return false; }
    show() {}
    focus() {}
    setSize() {}
    setAlwaysOnTop() {}
    isAlwaysOnTop() { return false; }
    setOpacity() {}
    getOpacity() { return 0.94; }
  },
  Menu: {
    setApplicationMenu: () => {}
  },
  nativeTheme: {
    themeSource: 'light'
  },
  ipcMain: {
    handle: (channel, handler) => {
      mockIpcHandlers[channel] = handler;
    }
  },
  dialog: {
    showOpenDialog: async (...args) => {
      const options = args.length === 2 ? args[1] : args[0];
      lastShowOpenDialogOptions = options || {};
      if (testConfig.canceled) {
        return { canceled: true, filePaths: [] };
      }
      return { canceled: false, filePaths: [testConfig.filePath] };
    }
  },
  shell: {
    openExternal: async () => {},
    openPath: async () => ""
  },
  contextBridge: {
    exposeInMainWorld: (key, obj) => {
      mockExposed[key] = obj;
    }
  },
  ipcRenderer: {
    invoke: async (channel, ...args) => {
      if (mockIpcHandlers[channel]) {
        return await mockIpcHandlers[channel]({}, ...args);
      }
      throw new Error(`No IPC handler registered for channel: ${channel}`);
    }
  }
};

Module._load = function (request, parent, isMain) {
  if (request === 'electron') {
    return mockElectron;
  }
  return originalLoad.apply(this, arguments);
};

// main.js와 preload.js 로드하여 등록 처리
require('./main.js');
require('./preload.js');

async function runTests() {
  const app = mockExposed.workshopApp;
  assert.ok(app, 'workshopApp should be exposed');
  assert.strictEqual(typeof app.checkPathExists, 'function', 'checkPathExists should be a function');
  assert.strictEqual(typeof app.selectFileOrFolder, 'function', 'selectFileOrFolder should be a function');

  // 1. checkPathExists 테스트
  // 웹 링크 테스트
  const webLinkResult1 = await app.checkPathExists('http://example.com/some/file.txt');
  assert.strictEqual(webLinkResult1, true, 'HTTP link should return true');

  const webLinkResult2 = await app.checkPathExists('https://github.com/some/repo');
  assert.strictEqual(webLinkResult2, true, 'HTTPS link should return true');

  // 존재하는 파일 테스트 (현재 디렉토리의 package.json)
  const existingFilePath = path.join(__dirname, 'package.json');
  const existResult = await app.checkPathExists(existingFilePath);
  assert.strictEqual(existResult, true, 'Existing file should return true');

  // 존재하지 않는 파일 테스트
  const nonExistentFilePath = path.join(__dirname, 'this-file-does-not-exist.json');
  const nonExistResult = await app.checkPathExists(nonExistentFilePath);
  assert.strictEqual(nonExistResult, false, 'Non-existent file should return false');

  // 빈 문자열 또는 잘못된 인자 테스트
  assert.strictEqual(await app.checkPathExists(''), false, 'Empty path should return false');
  assert.strictEqual(await app.checkPathExists(null), false, 'Null path should return false');
  assert.strictEqual(await app.checkPathExists(undefined), false, 'Undefined path should return false');

  // 2. selectFileOrFolder 테스트
  // 2-1. type === 'file'인 경우 properties 및 title 검증
  testConfig.canceled = false;
  testConfig.filePath = '/mock/file.txt';
  const fileResult = await app.selectFileOrFolder('file');
  assert.strictEqual(fileResult, '/mock/file.txt', 'Should return mock file path');
  assert.deepStrictEqual(lastShowOpenDialogOptions.properties, ['openFile'], 'Should use openFile property for file type');
  assert.strictEqual(lastShowOpenDialogOptions.title, '파일 선택', 'Should use 파일 선택 title for file type');

  // 2-2. type === 'folder'인 경우 properties 및 title 검증
  testConfig.filePath = '/mock/folder';
  const folderResult = await app.selectFileOrFolder('folder');
  assert.strictEqual(folderResult, '/mock/folder', 'Should return mock folder path');
  assert.deepStrictEqual(lastShowOpenDialogOptions.properties, ['openDirectory'], 'Should use openDirectory property for folder type');
  assert.strictEqual(lastShowOpenDialogOptions.title, '폴더 선택', 'Should use 폴더 선택 title for folder type');

  // 2-3. 선택 취소 테스트
  testConfig.canceled = true;
  const cancelResult = await app.selectFileOrFolder('file');
  assert.strictEqual(cancelResult, null, 'Canceled dialog should return null');

  console.log("Local file bridge unit test passed!");
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
