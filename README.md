# Polygon2Goorm

Polygon2Goorm is a Chrome extension that ports Codeforces Polygon packages to goorm LEVEL programming problems.

Polygon2Goorm은 Codeforces Polygon 패키지를 구름 LEVEL 프로그래밍 문제로 옮기기 위한 Chrome 확장 프로그램입니다.

## 한국어

### 무엇을 하나요?

Polygon2Goorm은 현재 열려 있는 Polygon `Packages` 페이지에서 최신 ready Windows package를 내려받고, 브라우저 안에서 패키지를 분석한 뒤 구름 LEVEL 문제를 생성합니다.

확장은 다음 항목을 자동으로 처리합니다.

- Polygon statement를 구름 에디터 HTML로 변환
- 수식 TeX를 구름 `/texconverter` 이미지 태그로 변환
- statement 이미지 포함
- 사전 생성된 입력/출력 테스트케이스 추출
- 구름 batch testcase 형식 ZIP 생성 및 업로드
- Polygon 정답 코드 중 구름에 넣을 judge source 선택
- 구름 문제 생성 후 `https://level.goorm.io/l/my`로 이동

모든 변환은 사용자의 브라우저에서 수행됩니다. 별도 서버로 Polygon 패키지나 구름 계정 정보를 보내지 않습니다.

### 설치

#### Chrome 웹 스토어에서 설치

Chrome 웹 스토어에 등록된 버전을 설치하면 됩니다.

#### 개발자 모드로 직접 설치

1. 이 저장소를 내려받거나 압축 해제합니다.
2. Chrome에서 `chrome://extensions`를 엽니다.
3. 오른쪽 위 `Developer mode`를 켭니다.
4. `Load unpacked`를 누릅니다.
5. 이 프로젝트 폴더를 선택합니다.

### 사용 방법

1. 구름 LEVEL에 로그인한 탭을 하나 열어둡니다.
2. Polygon에서 옮길 문제의 `Packages` 페이지를 엽니다.
3. 최신 revision의 Windows package가 ready 상태인지 확인합니다.
4. Polygon2Goorm 확장 팝업을 엽니다.
5. `문제 생성` 버튼을 누릅니다.
6. 생성이 끝나면 구름 문제 목록을 확인합니다.

`lectureIndex`는 열린 구름 LEVEL 탭에서 자동으로 감지합니다. 수동 입력 버튼은 없습니다. 여러 구름 탭에서 서로 다른 `lectureIndex`가 발견되면 확장이 자동 선택을 멈추므로, 대상이 아닌 구름 탭을 닫고 다시 실행하세요.

### 지원 범위

현재 v1은 안전하게 자동 포팅할 수 있는 범위만 지원합니다.

- Polygon Windows/FULL package
- 표준 입력/표준 출력 문제
- 사전 생성된 입력/출력 테스트케이스 쌍
- 최대 60개 테스트케이스
- 테스트케이스 파일 1개당 최대 30 MB
- 생성되는 테스트케이스 ZIP 최대 180 MB
- statement 이미지: PNG, JPEG, GIF, WebP
- exact-output 계열 Polygon standard checker:
  - `std::ncmp.cpp`
  - `std::lcmp.cpp`
  - `std::wcmp.cpp`
  - `std::fcmp.cpp`
  - `std::hcmp.cpp`
  - `std::rcmp.cpp`
  - `std::icmp.cpp`
  - `std::yesno.cpp`

### 지원하지 않는 경우

다음 패키지는 문제를 만들지 않고 오류로 중단합니다.

- custom checker
- interactive 문제
- 파일 입력/출력 문제
- 출력 파일이 없는 generator-only package
- 완전한 `tests/*` 및 `tests/*.a` 쌍이 없는 standard/source package
- 최신 revision package가 아직 준비되지 않은 Polygon 문제
- 구름에서 호환 가능한 C++ 또는 Python 3 correct solution을 찾지 못한 경우

잘못된 테스트 데이터로 문제를 만드는 것보다 명확히 실패하는 쪽을 우선합니다.

### 정답 코드 선택 정책

구름 judge source에는 Polygon solution 중 호환 가능한 correct solution만 사용합니다.

- main correct solution이 C++ 또는 Python 3이면 우선 사용합니다.
- main correct solution이 다른 언어이면 correct C++ 또는 correct Python 3 solution으로 대체합니다.
- 호환 가능한 correct solution이 없으면 문제 생성을 중단합니다.

구름의 언어 런타임이 Polygon/BOJ 환경과 다를 수 있으므로, Rust 등 구버전 런타임에서 깨질 수 있는 코드를 임의로 고쳐 넣지 않습니다.

### 리소스 제한 옵션

확장 옵션 페이지에서 언어별 시간/메모리 보정 규칙을 설정할 수 있습니다.

각 언어는 다음 값을 가집니다.

- 시간 배율
- 시간 추가값(초)
- 메모리 배율
- 메모리 추가값(MB)

기본값은 가능한 경우 BOJ의 언어별 보정 규칙을 따릅니다. 옵션 페이지의 `BOJ 기본값으로 초기화` 버튼으로 초기화할 수 있습니다.

### 개발

문법 검사를 실행합니다.

```powershell
npm run check
```

테스트를 실행합니다.

```powershell
npm test
```

배포용 ZIP을 생성합니다.

```powershell
npm run package
```

확장 버전을 올립니다.

```powershell
npm run version:patch
npm run version:minor
npm run version:major
```

### 저장소 구조

```text
.
├── manifest.json
├── popup.html / popup.js / styles.css
├── options.html / options.js / options.css
├── src/
│   ├── polygon.js
│   ├── zip.js
│   ├── crc32.js
│   └── util.js
├── tests/
├── scripts/
├── icons/
└── archive/java-prototype/
```

`archive/java-prototype`에는 이전 Java/Gradle 프로토타입이 보관되어 있습니다. 현재 확장은 Java 없이 브라우저 안에서 동작합니다.

### 개인정보와 권한

이 확장은 별도 서버를 운영하지 않으며 사용자 데이터를 수집하지 않습니다.

확장이 사용하는 권한의 목적은 다음과 같습니다.

- `activeTab`: 현재 Polygon 페이지에서 패키지 링크를 찾기 위해 사용
- `scripting`: Polygon/goorm 페이지 안에서 필요한 값과 링크를 읽기 위해 사용
- `tabs`: 열린 goorm LEVEL 탭을 찾고 생성 후 이동시키기 위해 사용
- `storage`: 사용자가 설정한 시간/메모리 보정 옵션 저장
- 호스트 권한: Polygon package 다운로드와 goorm 문제 생성 요청에 사용

### 배포 전 확인

공개 배포 전에 다음을 확인하세요.

```powershell
npm run package
```

그리고 다음 항목이 저장소에 포함되지 않았는지 확인하세요.

- 개인 로컬 경로
- GitHub token 또는 API token
- 구름/Polygon 세션 쿠키
- 다운로드한 Polygon package ZIP
- 생성된 `polygon2goorm-extension.zip`

---

## English

### What It Does

Polygon2Goorm downloads the latest ready Windows package from the currently open Polygon `Packages` page, parses it locally in the browser, and creates a goorm LEVEL programming problem.

It automatically handles:

- converting Polygon statement HTML to goorm editor HTML
- converting TeX fragments to goorm `/texconverter` image tags
- embedding statement images
- extracting precomputed input/output testcase pairs
- generating and uploading a goorm-compatible batch testcase ZIP
- selecting a compatible Polygon correct solution as the judge source
- navigating the goorm tab to `https://level.goorm.io/l/my` after creation

All conversion work runs in the user's browser. The extension does not send Polygon packages or goorm account data to any separate server.

### Installation

#### From the Chrome Web Store

Install the published Chrome Web Store version when available.

#### Local Developer Install

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select this project folder.

### Usage

1. Keep one logged-in goorm LEVEL tab open.
2. Open the Polygon problem's `Packages` page.
3. Make sure the latest revision has a ready Windows package.
4. Open the Polygon2Goorm extension popup.
5. Click `문제 생성`.
6. Check the goorm problem list after creation.

The extension detects `lectureIndex` from an open goorm LEVEL tab. There is no manual `lectureIndex` button. If multiple different lecture indexes are found, close unrelated goorm tabs and run the extension again.

### Supported Scope

The current v1 supports only cases that can be ported safely.

- Polygon Windows/FULL packages
- standard input/output problems
- precomputed input/output testcase pairs
- up to 60 testcase pairs
- up to 30 MB per testcase file
- up to 180 MB for the generated testcase ZIP
- statement images: PNG, JPEG, GIF, and WebP
- exact-output Polygon standard checkers:
  - `std::ncmp.cpp`
  - `std::lcmp.cpp`
  - `std::wcmp.cpp`
  - `std::fcmp.cpp`
  - `std::hcmp.cpp`
  - `std::rcmp.cpp`
  - `std::icmp.cpp`
  - `std::yesno.cpp`

### Unsupported Cases

The extension stops with an error for:

- custom checkers
- interactive problems
- file input/output problems
- generator-only packages without output files
- standard/source packages without complete `tests/*` and `tests/*.a` pairs
- Polygon problems whose latest revision package is not ready
- packages without a compatible C++ or Python 3 correct solution for goorm

The extension prefers a clear failure over creating a problem with missing or incorrect test data.

### Solution Source Policy

The goorm judge source is selected only from compatible Polygon correct solutions.

- Prefer the main correct solution when it is C++ or Python 3.
- If the main correct solution uses another language, fall back to a correct C++ or Python 3 solution.
- If no compatible correct solution exists, stop with an error.

The extension does not rewrite solutions for incompatible or older goorm runtimes.

### Resource Limit Options

The options page lets users configure time and memory conversion rules per language.

Each language has:

- time multiplier
- time addition in seconds
- memory multiplier
- memory addition in MB

Defaults follow BOJ-style language adjustments where applicable. Use `BOJ 기본값으로 초기화` to restore the defaults.

### Development

Run syntax checks:

```powershell
npm run check
```

Run tests:

```powershell
npm test
```

Create a distributable ZIP:

```powershell
npm run package
```

Bump the extension version:

```powershell
npm run version:patch
npm run version:minor
npm run version:major
```

### Repository Layout

```text
.
├── manifest.json
├── popup.html / popup.js / styles.css
├── options.html / options.js / options.css
├── src/
│   ├── polygon.js
│   ├── zip.js
│   ├── crc32.js
│   └── util.js
├── tests/
├── scripts/
├── icons/
└── archive/java-prototype/
```

`archive/java-prototype` contains the archived Java/Gradle prototype. The current extension runs in the browser without Java.

### Privacy and Permissions

This extension does not operate a separate server and does not collect user data.

Permissions are used for:

- `activeTab`: reading package links from the current Polygon page
- `scripting`: reading required values and links from Polygon/goorm pages
- `tabs`: finding an open goorm LEVEL tab and navigating it after creation
- `storage`: saving time/memory conversion options
- host permissions: downloading Polygon packages and sending goorm problem creation requests

### Public Release Checklist

Before publishing, run:

```powershell
npm run package
```

Also make sure the repository does not include:

- personal local paths
- GitHub tokens or API tokens
- goorm/Polygon session cookies
- downloaded Polygon package ZIP files
- the generated `polygon2goorm-extension.zip`
