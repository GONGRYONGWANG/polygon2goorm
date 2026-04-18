# Polygon → goorm 포팅 도구 프로젝트 지시서

이 문서는 Codex가 바로 작업을 시작할 수 있도록 프로젝트 목적, 범위, 설계 원칙, 작업 순서, 산출물, 주의사항을 정리한 실행 지시 문서다.

---

## 1. 프로젝트 개요

### 프로젝트명
`polygon2goorm`

### 목적
Codeforces Polygon에서 **FULL package**로 export한 문제 패키지를 입력으로 받아, **goorm 문제 생성에 필요한 산출물**로 변환하는 로컬 실행 도구를 만든다.

이 프로젝트의 핵심은 “모든 Polygon 문제를 완벽히 옮기는 것”이 아니라,

1. **자동 포팅 가능한 문제를 판별**하고
2. **포팅 가능한 문제에 대해 statement / testcase / metadata를 추출**하고
3. **goorm 업로드용 결과물 + 호환성 리포트**를 생성하는 것

이다.

---

## 2. 최우선 전제

### 반드시 지킬 범위
- **FULL package만 지원**
- **표준 입력 / 표준 출력(stdin / stdout) 문제만 지원**
- **precomputed tests가 들어 있는 패키지만 지원**
- **statement PDF가 있는 경우를 우선 지원**
- **custom checker / interactive / special judge / output-only / grader / generator 의존 문제는 v1에서 미지원**

### 이유
- STANDARD package까지 지원하면 generator / validator 실행 파이프라인이 필요해져서 프로젝트 범위가 급격히 커진다.
- goorm은 기본적으로 **테스트케이스 기반 채점** 중심이라고 가정한다.
- 따라서 Polygon의 richer judging model을 전부 이식하려고 하면 실패한다.

---

## 3. 우리가 이미 합의한 핵심 가정

### Polygon 쪽
- Polygon은 문제별로 richer metadata를 가질 수 있다.
- FULL package에는 이미 생성된 테스트 파일이 포함될 수 있다.
- checker / validator / generator / statement resource 같은 요소가 있을 수 있다.
- statement는 PDF / tex / html 등 다양한 형태일 수 있다.
- zip 구조는 고정 단일 경로라고 가정하면 안 되고, **탐색 기반으로 구현**해야 한다.

### goorm 쪽
- statement는 **PDF 업로드가 가능하다고 가정**한다.
- 이 덕분에 statement 변환 난이도는 크게 낮아진다.
- 핵심 문제는 statement 변환보다 **채점 가능 여부 분석 + 테스트케이스 변환**이다.
- 일반적인 custom checker / interactive 문제는 직접 지원하지 않는다고 보고 v1에서는 미지원 처리한다.

---

## 4. 프로젝트 목표

Codex는 아래 결과를 만드는 것을 목표로 작업한다.

### 입력
- Polygon FULL package zip 파일 1개

### 출력
예시:

```text
out/
 ├─ statement.pdf
 ├─ tests/
 │   ├─ 001.in
 │   ├─ 001.out
 │   ├─ 002.in
 │   ├─ 002.out
 ├─ ir.json
 ├─ goorm.json
 ├─ report.json
 └─ README.md
```

### 각 파일 의미
- `statement.pdf`: goorm에 업로드할 statement
- `tests/`: 정리된 테스트케이스
- `ir.json`: 내부 공통 포맷(Intermediate Representation)
- `goorm.json`: goorm 업로드를 위해 사람이 참고하거나 자동화에 활용할 수 있는 구조화 데이터
- `report.json`: 자동 포팅 가능 여부, 경고, 미지원 기능 보고서
- `README.md`: 사람이 확인할 수 있는 요약 안내

---

## 5. 기술 스택

### 권장
- **Java 21**
- **picocli**: CLI 엔트리 포인트
- **Jackson**: JSON / XML 파싱
- `java.nio.file`: 파일 탐색
- `java.util.zip` 또는 Apache Commons Compress: zip 해제
- **JUnit 5**: 테스트
- AssertJ: 테스트 가독성 향상

### 왜 Spring Boot를 쓰지 않는가
이 프로젝트는 웹 서비스가 아니라 **로컬 파일 변환 도구 / CLI 프로그램**이다.
핵심은 서버 운영이 아니라:
- zip 입력
- 패키지 분석
- 포맷 변환
- 결과물 생성

이므로 Spring Boot는 v1에서는 불필요하다.

---

## 6. 프로젝트 형태

### 프로그램 타입
CLI

### 예상 명령 예시
```bash
polygon2goorm inspect problem.zip
polygon2goorm convert problem.zip --output ./out
```

### v1에서 필요한 커맨드
1. `inspect`
   - 패키지 구조 검사
   - 포팅 가능 여부 분석
   - unsupported feature 탐지
   - 결과를 stdout 및 report.json 형태로 출력 가능

2. `convert`
   - inspect 결과가 AUTO_PORTABLE 또는 SEMI_PORTABLE일 때
   - statement / tests / metadata 추출
   - 결과 디렉터리 생성

`validate` 같은 추가 명령은 v2로 미뤄도 된다.

---

## 7. 절대 하지 말아야 할 것

- STANDARD package 지원 시도
- generator 실행 파이프라인 구현
- custom checker를 goorm용 checker로 변환하려는 시도
- interactive 문제 지원 시도
- zip 내부 경로를 하드코딩하는 방식
- statement tex를 완벽하게 markdown으로 변환하려는 과도한 작업

v1은 **좁고 정확하게** 가야 한다.

---

## 8. 아키텍처 개요

## 8.1 전체 흐름

```text
Polygon FULL package zip
    ↓
Unzip
    ↓
Package Scan
    ↓
Capability Analyzer
    ↓
Polygon → IR 변환
    ↓
IR → Goorm 산출물 변환
    ↓
Output Writer
```

## 8.2 핵심 모듈

권장 패키지 구조 예시:

```text
com.polygon2goorm
 ├─ cli
 ├─ application
 ├─ domain
 │   ├─ model
 │   ├─ analysis
 │   └─ service
 ├─ infrastructure
 │   ├─ zip
 │   ├─ parser
 │   ├─ filesystem
 │   └─ writer
 └─ common
```

좀 더 구체적으로는:

- `cli`
  - picocli command 정의
- `application`
  - use case orchestration
- `domain.model`
  - IR, 분석 결과 모델
- `domain.analysis`
  - checker / generator / statement / tests capability 분석
- `infrastructure.zip`
  - 압축 해제
- `infrastructure.parser`
  - problem.xml 및 파일 트리 파싱
- `infrastructure.writer`
  - ir.json / goorm.json / report.json / README.md 출력

---

## 9. 핵심 설계 원칙

### 9.1 먼저 Polygon → IR을 만든다
절대 Polygon → goorm 직결 변환부터 하지 말 것.

반드시

```text
Polygon Package → IR → Goorm Output
```

구조로 구현한다.

이유:
- 구조가 깔끔해진다.
- 테스트하기 쉽다.
- 나중에 다른 플랫폼으로의 포팅도 가능하다.
- capability analyzer와 exporter를 분리할 수 있다.

### 9.2 “정확한 경로”가 아니라 “탐색 기반”으로 찾는다
zip 내부 구조는 완전히 고정이라고 가정하지 않는다.

예를 들어 statement PDF는 다음처럼 탐색한다.

우선순위 예시:
1. `**/*.pdf`
2. statement 관련 디렉터리 우선
3. 언어 폴더 중 `english` 우선

테스트도 마찬가지로 경로 하드코딩 대신 패턴 기반으로 찾는다.

### 9.3 변환기보다 분석기가 먼저다
이 프로젝트의 핵심 가치는 “변환”만이 아니라 **포팅 가능성 분석**이다.

따라서 첫 번째 산출물은 사실상 `CapabilityAnalyzer`여야 한다.

---

## 10. Intermediate Representation(IR) 초안

Codex는 아래와 유사한 구조를 Java record 또는 class로 설계한다.

```json
{
  "meta": {
    "title": "",
    "source": "",
    "timeLimitMs": 0,
    "memoryLimitMb": 0,
    "inputMethod": "stdin",
    "outputMethod": "stdout",
    "inputFile": null,
    "outputFile": null,
    "languages": []
  },
  "statement": {
    "title": "",
    "pdfPath": "",
    "fallbackTextPath": null,
    "assets": []
  },
  "samples": [
    {
      "id": 1,
      "input": "",
      "output": ""
    }
  ],
  "tests": {
    "tests": [
      {
        "id": 1,
        "inputPath": "",
        "answerPath": "",
        "isSample": false
      }
    ]
  },
  "judge": {
    "checker": {
      "present": false,
      "path": null
    },
    "validator": {
      "present": false,
      "path": null
    },
    "generator": {
      "present": false,
      "path": null
    },
    "interactive": false
  },
  "compatibility": {
    "result": "AUTO_PORTABLE",
    "warnings": [],
    "unsupportedFeatures": []
  }
}
```

필드명은 조정 가능하지만, 개념 분리는 유지할 것.

---

## 11. Capability Analyzer 설계

### 분석 결과 enum 예시
- `AUTO_PORTABLE`
- `SEMI_PORTABLE`
- `UNSUPPORTED`

### 탐지해야 하는 핵심 이슈
1. custom checker 존재
2. interactive 문제 흔적
3. generator 존재
4. validator 존재
5. precomputed tests 유무
6. statement PDF 유무
7. stdin/stdout 여부
8. input/output 파일형 문제 여부
9. output uniqueness를 보장하지 못할 가능성 힌트

### 판정 규칙 초안

#### AUTO_PORTABLE
- FULL package
- precomputed tests 존재
- stdin/stdout
- custom checker 없음
- interactive 아님
- statement PDF 존재 또는 대체 가능

#### SEMI_PORTABLE
- statement PDF가 없고 fallback만 존재
- validator는 있지만 무시 가능
- 파일 I/O가 있으나 수동 조치로 가능
- 일부 메타 누락 가능

#### UNSUPPORTED
- custom checker 존재
- interactive 문제
- generator 의존으로 보이는 구조
- tests 부족
- 채점 방식이 단순 입력/출력 비교로 환원 불가

### report.json 예시

```json
{
  "result": "UNSUPPORTED",
  "issues": [
    {
      "type": "CUSTOM_CHECKER",
      "severity": "HIGH",
      "message": "Custom checker detected. Goorm testcase-based judging cannot represent this in v1."
    }
  ],
  "suggestions": [
    "Export a different problem without special judge",
    "Skip this package in v1"
  ]
}
```

---

## 12. Polygon 쪽에서 추출해야 하는 정보

Codex는 우선 `problem.xml`과 파일 트리를 함께 사용해 아래 정보를 확보하도록 구현한다.

### 필수 메타
- 제목
- 시간 제한
- 메모리 제한
- input method
- output method
- input file name
- output file name

### statement 관련
- 영어 statement PDF 경로
- pdf가 없으면 tex/html 등 fallback 파일 경로
- statement assets 존재 여부

### 테스트 관련
- 테스트 디렉터리 위치
- 입력 파일 목록
- 정답 파일 목록
- 샘플 여부 구분 가능성

### judge 관련
- checker 존재 여부 및 경로
- validator 존재 여부 및 경로
- generator 존재 여부 및 경로
- interactive 관련 힌트

### 주의
`problem.xml`만 신뢰하지 말고, 실제 zip 내부 파일을 스캔해 교차 검증할 것.

---

## 13. Goorm 타깃 포맷

정식 import API가 확실하지 않은 상태이므로, v1에서는 **goorm UI에 입력 가능한 데이터 묶음**을 만드는 것을 목표로 한다.

예시 `goorm.json`:

```json
{
  "content": {
    "title": "Sample Problem",
    "statementPdf": "statement.pdf",
    "source": "Polygon"
  },
  "limits": {
    "timeLimitMs": 2000,
    "memoryLimitMb": 256
  },
  "judgeCases": [
    {
      "inputFile": "tests/001.in",
      "outputFile": "tests/001.out",
      "isSample": true
    },
    {
      "inputFile": "tests/002.in",
      "outputFile": "tests/002.out",
      "isSample": false
    }
  ],
  "judgeOptions": {
    "ignoreWhitespace": false,
    "ignoreCase": false,
    "useRegex": false
  }
}
```

이 파일은 실제 API payload가 아니라, 업로드 보조용 구조화 데이터다.

---

## 14. 테스트케이스 처리 규칙

### 목표
Polygon 패키지의 테스트 입력/출력 파일을 찾아서 goorm에서 쓰기 쉬운 이름으로 정렬 복사한다.

### 출력 이름 규칙 예시
- `001.in`
- `001.out`
- `002.in`
- `002.out`

### 해야 할 일
- 입력/정답 파일 pair 매칭
- 안정적인 정렬 규칙 정의
- 샘플 테스트와 숨은 테스트를 분리 가능한 경우 구분

### 구현 주의
- 파일명 패턴이 완전히 고정이라고 가정하지 말 것
- `01` / `01.a` 같은 패턴도 있고 다른 형태도 있을 수 있다
- pair 매칭 로직을 유연하게 작성할 것

### 샘플 처리
- 샘플 여부를 명확히 알 수 없으면 기본적으로 hidden으로 분류하고 warning을 남긴다.
- 샘플을 statement에서 파싱하는 것은 v2 후보로 둔다.

---

## 15. statement 처리 규칙

### v1 기본 정책
1. 영어 PDF가 있으면 그것을 최우선 사용
2. PDF가 없고 tex/html만 있으면 `SEMI_PORTABLE` 또는 `UNSUPPORTED`로 내릴 수 있음
3. PDF가 있으면 본문 변환은 하지 않고 pass-through

### 해야 할 일
- 가장 적절한 statement PDF 찾기
- output 디렉터리에 `statement.pdf`로 복사
- 경로 정보 IR과 goorm.json에 반영

### 하지 말 것
- tex → markdown 완전 변환
- 복잡한 수식 렌더링 처리
- statement content reconstruction에 시간 과투입

---

## 16. CLI 명세 초안

### inspect
```bash
polygon2goorm inspect <zipPath>
```

#### 동작
- zip 해제(임시 디렉터리)
- 구조 탐색
- capability analysis
- stdout 요약 출력
- 필요 시 `report.json` 생성 옵션 제공

#### stdout 예시
```text
Result: AUTO_PORTABLE
Title: Two Arrays
Statement PDF: found
Tests: 42 pairs
Checker: not found
Generator: not found
Warnings: 0
```

### convert
```bash
polygon2goorm convert <zipPath> --output <dir>
```

#### 동작
- inspect 포함
- unsupported면 기본 실패
- 지원 가능 시 산출물 생성

#### 옵션 후보
- `--force-semi-portable`
- `--keep-temp`
- `--verbose`

---

## 17. 에러 처리 정책

Codex는 에러 메시지를 최대한 사용자 친화적으로 설계한다.

예시:
- `Not a FULL package or no precomputed tests were found.`
- `Custom checker detected. This package is unsupported in v1.`
- `No statement PDF found. PDF statement is required in v1.`
- `Could not match testcase input/output pairs.`

에러는 stack trace만 출력하지 말고, **왜 실패했는지 + 어떤 조치를 하면 되는지**를 함께 제공한다.

---

## 18. 우선 구현 순서

Codex는 아래 순서를 따른다.

### Step 1. 프로젝트 스캐폴딩
- Gradle 기반 Java 21 프로젝트 생성
- picocli, Jackson, JUnit 설정
- 기본 CLI 엔트리 구성

### Step 2. ZIP 해제 및 파일 스캔
- zip을 임시 디렉터리에 푸는 기능
- 전체 파일 트리 스캔 유틸 작성
- 탐색 결과 로그 출력

### Step 3. problem.xml 파싱
- 최소 메타데이터 추출
- XML 누락 시 graceful failure

### Step 4. Capability Analyzer 구현
- checker / generator / statement pdf / tests 존재 여부 판정
- AUTO_PORTABLE / SEMI_PORTABLE / UNSUPPORTED 판정

### Step 5. IR 모델 및 Polygon → IR 변환
- domain 모델 정의
- parser 결과를 IR로 변환

### Step 6. 테스트케이스 정리
- pair 매칭
- `tests/001.in`, `tests/001.out` 형식으로 복사

### Step 7. statement PDF 추출
- 적절한 pdf 선택
- `statement.pdf`로 복사

### Step 8. 산출물 writer 구현
- ir.json
- goorm.json
- report.json
- README.md

### Step 9. 테스트 작성
- 최소 3종 fixture 기반 테스트
  1. 단순 AUTO_PORTABLE
  2. checker가 있는 UNSUPPORTED
  3. statement pdf 없는 SEMI_PORTABLE 또는 UNSUPPORTED

---

## 19. 테스트 전략

### 꼭 필요한 fixture 유형
1. **단순한 표준 입출력 문제**
   - pdf 있음
   - tests 있음
   - checker 없음

2. **custom checker 문제**
   - analyzer가 UNSUPPORTED를 내려야 함

3. **generator / validator 흔적 문제**
   - analyzer가 경고 또는 unsupported를 내려야 함

4. **statement PDF 누락 문제**
   - fallback 처리 검증

### 테스트 원칙
- 단위 테스트: parser / analyzer / matcher
- 통합 테스트: zip 하나 넣고 output 구조 전체 검증
- golden file 테스트 권장

---

## 20. README 초안에 들어갈 내용

Codex는 최종적으로 프로젝트 README에 아래 내용을 포함한다.

- 프로젝트 소개
- 지원 범위
- 미지원 범위
- 설치 및 실행 방법
- inspect 예시
- convert 예시
- 출력 파일 설명
- known limitations

특히 지원 / 미지원 범위를 분명히 써야 한다.

---

## 21. v1 성공 기준

아래를 만족하면 v1 성공으로 본다.

1. FULL package zip 하나를 넣었을 때
2. custom checker 없는 표준 문제를 분석하고
3. statement.pdf와 tests를 추출하고
4. ir.json / goorm.json / report.json을 생성하고
5. unsupported 패키지에 대해서는 명확한 사유를 출력한다.

즉, “모든 문제 완전 지원”이 아니라,
**“지원하는 범위를 명확하게 잘 처리하고, 지원하지 않는 이유를 잘 설명하는 도구”**가 목표다.

---

## 22. 추가 지시

### Codex에게 기대하는 작업 방식
- 임의 가정을 최소화할 것
- 경로를 하드코딩하지 말 것
- 먼저 작은 분석기부터 만들고, 그다음 변환기로 확장할 것
- 구현 중간마다 README 또는 설계 메모를 갱신할 것
- v1 범위를 벗어나는 기능은 TODO로 남기고 구현하지 말 것

### 중요 포인트
이 프로젝트의 본질은 “파일 변환기”이기도 하지만, 더 정확히는

**Polygon 문제 패키지가 goorm의 testcase-based judging 모델에 들어갈 수 있는지 판정하는 반자동 포팅 도구**

라는 점을 잊지 말 것.

---

## 23. 첫 커밋 이후 바로 해야 할 일

Codex는 시작 시 다음 순서로 작업하면 된다.

1. Gradle Java 21 CLI 프로젝트 생성
2. `inspect` 커맨드 skeleton 추가
3. zip 해제 + 파일 목록 출력
4. `problem.xml` 존재 여부 확인
5. checker / generator / pdf / tests 탐지 로직 구현
6. 분석 결과를 콘솔에 출력

여기까지가 첫 번째 작동 가능한 마일스톤이다.

---

## 24. 최종 한 줄 정의

> **polygon2goorm는 Polygon FULL package를 분석하여, goorm에서 사용 가능한 testcase-based problem 형태로 자동 포팅 가능한 범위만 변환하고, 나머지는 호환성 리포트로 설명하는 CLI 도구다.**

