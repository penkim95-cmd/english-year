# 설계 결정 기록 (ADR)

되돌리기 어렵거나 이유를 모르면 다시 논쟁하게 될 결정을 남깁니다. 형식은 [Michael Nygard의 ADR](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)을 따릅니다.

| 번호                                            | 결정                                                 | 상태 |
| ----------------------------------------------- | ---------------------------------------------------- | ---- |
| [0001](0001-vanilla-typescript-no-framework.md) | UI 프레임워크 없이 TypeScript와 작은 렌더러로 만든다 | 채택 |
| [0002](0002-client-side-claude-api.md)          | 서버 없이 기기에서 학습자 키로 Claude API를 호출한다 | 채택 |
| [0003](0003-pwa-instead-of-app-store.md)        | App Store 앱 대신 설치형 PWA로 배포한다              | 채택 |
| [0004](0004-content-as-json.md)                 | 과정 콘텐츠를 코드와 분리된 JSON으로 둔다            | 채택 |
| [0005](0005-single-speech-session.md)           | 음성 인식·재생 상태를 한 모듈에서만 관리한다         | 채택 |

새 결정은 다음 번호로 파일을 만들고 이 표에 추가합니다. 결정을 바꿀 때는 기존 파일을 고치지 않고 새 ADR에서 '대체함'으로 연결합니다.
