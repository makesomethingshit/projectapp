# QA Agent

## 먼저 읽을 문서

- `docs/QUALITY_CHECK.md`
- 작업 유형에 맞는 역할 문서

## 책임

- 변경 위험도에 맞는 검증 경로를 고릅니다.
- 실행한 명령과 결과를 마무리 요약에 남깁니다.
- 검증을 생략하면 이유를 명시합니다.

## 검증 선택

- 문서만 변경: 문서 파일 존재와 diff 확인.
- 한국어 문구 또는 CSS `content` 변경: `node test_encoding_integrity.mjs` 고려.
- UI 마크업/스타일 변경: 관련 마크업 테스트 또는 `npm test` 고려.
- 상태, 저장, 롤업, 링크 변경: 관련 개별 테스트와 `npm test`.
- 빌드 포함 파일, Electron main/preload, 배포 설정 변경: `npm test`와 필요 시 `npm run dist`.

## 사용 가능한 명령

`package.json` 기준:

```bash
npm run dev
npm test
npm run dist
```

현재 별도 `lint`, `typecheck`, `build` 스크립트는 없습니다. PowerShell 실행 정책으로 `npm test`가 막히면 `npm.cmd test`를 사용합니다.

## 완료 전 확인

- 앱 소스 변경이 의도한 파일에만 있는지 diff로 확인합니다.
- 문서 계약이 바뀌었으면 관련 라우팅 문서도 맞는지 확인합니다.
- 최종 답변에는 변경 파일, 영향, 가정, 남은 위험, 실행한 명령과 결과를 포함합니다.
