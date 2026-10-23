# 보안

## 취약점 신고

공개 이슈 대신 GitHub의 **Security → Report a vulnerability**(비공개 신고)를 이용해 주세요. 재현 방법과 영향 범위를 함께 적어 주시면 확인 후 답변드립니다.

## 위협 모델

이 앱은 한 사람이 자기 기기에서 쓰는 개인용 정적 웹앱입니다. 서버와 계정이 없고, 보호할 자산은 다음 두 가지입니다.

| 자산              | 저장 위치                               | 위협                                            |
| ----------------- | --------------------------------------- | ----------------------------------------------- |
| Claude API 키     | 기기 `localStorage` (`eng-year-apikey`) | 주입된 스크립트가 읽어서 외부로 전송            |
| 학습 기록·AI 대화 | 기기 `localStorage`                     | 악의적인 백업 파일·AI 응답이 화면에 코드로 실행 |

## 대응

**스크립트 주입 차단**

- 모든 화면 출력은 기본 이스케이프 `html` 템플릿(`src/ui/html.ts`)을 거칩니다. `& < > " '`를 모두 바꾸고, ESLint가 `innerHTML` 직접 대입을 막습니다.
- 빌드 결과에는 인라인 스크립트가 없고, CSP가 `script-src 'self'`로 같은 출처 파일만 실행합니다.

**키 유출 경로 차단**

- CSP `connect-src 'self' https://api.anthropic.com`: 스크립트가 주입되더라도 다른 서버로 요청을 보낼 수 없습니다.
- `form-action 'none'`, `base-uri 'none'`, `object-src 'none'`, `referrer no-referrer`.
- 키는 백업 파일에 들어가지 않습니다(테스트로 확인).

**외부 데이터 검증**

- 백업 복원과 AI의 JSON 응답은 `sanitizeJson`으로 `__proto__`·`constructor`·`prototype` 키를 버리고 깊이(8)·배열 길이(5000)·문자열 길이(5000)를 제한한 뒤, 알려진 필드와 타입만 받아들입니다(`src/core/storage.ts`의 `sanitizeJson`, `src/state/store.ts`의 `normalize*`).

**공급망**

- 런타임 의존성은 `@anthropic-ai/sdk` 하나이며 정확한 버전으로 고정합니다. 실행 중에 외부 CDN에서 코드를 받지 않습니다(외부 요청은 Google Fonts 스타일시트·글꼴과 `api.anthropic.com`뿐).
- Dependabot이 npm·GitHub Actions 업데이트를 제안합니다.

## 알려진 한계와 권장 사항

- **키는 기기에 평문으로 저장됩니다.** 브라우저에서 직접 API를 부르는 구조의 한계입니다([ADR 0002](docs/adr/0002-client-side-claude-api.md)). 이 앱 전용 키를 만들고 Anthropic Console에서 **월 사용 한도**를 걸어 두세요. 기기를 잃어버리면 Console에서 키를 폐기하세요.
- **배포 출처를 다른 사이트와 공유하지 마세요.** `사용자명.github.io` 아래의 모든 GitHub Pages 사이트는 같은 출처를 씁니다. 같은 계정에 신뢰하지 않는 코드를 올린 Pages 사이트가 있으면 그 페이지가 키를 읽을 수 있습니다. 이 앱만 올리거나 별도 계정·사용자 도메인을 쓰세요.
- **인라인 `style` 속성은 허용합니다**(`style-src 'unsafe-inline'`). 단계별 색상에 쓰며, 스크립트 실행 권한은 주지 않습니다.
- 이 구조는 **여러 사용자에게 서비스하는 용도로 설계되지 않았습니다.** 그런 경우에는 서버 측 프록시로 키를 보관해야 합니다.

## 저장소에 넣지 않는 것

API 키, 개인 정보, 학습 기록. 학습자 이름·소개는 앱 안에서 입력하며 기기에만 저장됩니다. `.env*` 파일은 `.gitignore`에 들어 있습니다.
