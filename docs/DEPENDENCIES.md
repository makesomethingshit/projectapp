# 의존성

이 앱은 Node/Electron 기반입니다. 현재 의존성 기준은 `package.json`과 `package-lock.json`입니다.

## 주요 파일

- `package.json`: 앱 메타데이터, 실행 명령, 빌드 설정, 직접 의존성.
- `package-lock.json`: 설치 버전 고정.

## 직접 의존성

현재 `devDependencies`:

- `electron`
- `electron-builder`

## 명령

```bash
npm run dev
npm run dist
```

품질 확인 절차와 테스트 실행 방식은 [QUALITY_CHECK.md](QUALITY_CHECK.md)를 기준으로 합니다.

## 주의

새 의존성을 추가하면 `package.json`, `package-lock.json`, 이 문서, [QUALITY_CHECK.md](QUALITY_CHECK.md)를 함께 갱신합니다.
