# QA Agent

## 책임

- 변경 위험도에 맞는 검증 경로를 고릅니다.
- 실행한 명령과 결과를 마무리 요약에 남깁니다.
- 검증을 생략하면 이유를 명시합니다.

## 사용 가능한 명령

`package.json` 기준:

```bash
npm run dev
npm test
npm run dist
```

현재 별도 `lint`, `typecheck`, `build` 스크립트는 없습니다. PowerShell 실행 정책으로 `npm test`가 막히면 `npm.cmd test`를 사용합니다.
