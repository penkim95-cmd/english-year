# 기여 안내

## 개발 환경

```bash
nvm use            # .nvmrc (Node 24)
npm install
npm run dev
```

변경을 올리기 전에 CI와 같은 검사를 로컬에서 돌립니다.

```bash
npm run ci         # typecheck → lint → format:check → test → build
npm run test:e2e   # 처음 한 번: npx playwright install chromium
```

## 코드 규칙

- **계층을 지킵니다.** `domain`과 `core`는 DOM·화면을 모릅니다. 새 학습 로직은 `domain/`에 순수 함수로 만들고 테스트를 함께 씁니다.
- **마크업은 `html` 템플릿으로만.** 값은 자동으로 이스케이프됩니다. `raw()`는 개발자가 쓴 고정 문자열에만 쓰고, 사용자 입력·AI 응답·백업 내용에는 절대 쓰지 않습니다.
- **버튼 동작은 `data-action`으로.** 화면 모듈의 `xxxActions` 객체에 핸들러를 추가하면 됩니다. 인자는 `data-*` 속성으로 넘깁니다.
- **외부에서 온 데이터는 검증합니다.** 저장소·백업·AI JSON은 `sanitizeJson`과 `normalize*` 함수를 거칩니다.
- **음성 상태는 `speech/` 안에서만.** 화면에서 직접 `SpeechRecognition`을 만들지 않습니다([ADR 0005](docs/adr/0005-single-speech-session.md)).
- **저장 키(`STORAGE_KEYS`)는 바꾸지 않습니다.** 바꿔야 하면 기존 키를 읽어 옮기는 코드와 테스트를 함께 넣습니다.
- 코드 주석은 영어, 화면 문구와 문서는 한국어로 씁니다.

## 콘텐츠 수정

레슨·단어·슬랭은 `src/data/*.json`에 있습니다. 형식은 `src/types.ts`를 보세요. 수정한 뒤 `npm test`를 돌리면 52주 전체 형식과 자동 학습지가 정답으로 풀리는지 확인합니다.

## 커밋과 PR

- 커밋 메시지는 [Conventional Commits](https://www.conventionalcommits.org/ko/v1.0.0/) 형식(`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- 설계를 바꾸는 변경은 `docs/adr/`에 새 ADR을 추가합니다.
- 사용자에게 보이는 변경은 `CHANGELOG.md`의 `Unreleased`에 적습니다.
