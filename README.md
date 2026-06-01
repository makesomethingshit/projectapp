# 작업실

작업실은 Electron 기반의 로컬 프로젝트 관리 앱입니다. 프로젝트, 하위 프로젝트, 작업, 완성도/진행도, 그래프 관계, 아카이브 리소스를 관리합니다.

## 먼저 읽기

- [에이전트 작업 가이드](AGENTS.md)
- [제품 문서](docs/PRODUCT.md)
- [데이터 모델](docs/DATA_MODEL.md)
- [프로젝트 로직](docs/PROJECT_LOGIC.md)
- [디자인 원칙](docs/DESIGN.md)
- [프론트엔드 구조](docs/FRONTEND.md)
- [품질 확인](docs/QUALITY_CHECK.md)
- [프로젝트 맵](docs/generated/project-map.md)

## 기존 문서

기존 `docs/APP_STRUCTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/DEPENDENCIES.md`, `docs/codex.md`, `gemini.md`는 새 harness 문서로 연결되는 호환 문서로 정리했습니다. 변경 이력은 [CHANGELOG.md](CHANGELOG.md)에 남아 있습니다.

## 실행

```bash
npm run dev
```

배포용 portable 빌드는 다음 명령을 사용합니다.

```bash
npm run dist
```
