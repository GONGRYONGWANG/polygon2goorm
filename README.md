# Polygon2Goorm

Polygon2Goorm은 Codeforces Polygon 문제를 구름 LEVEL 프로그래밍 문제로 옮기기 위한 Chrome 확장 프로그램입니다.

확장은 브라우저 안에서 현재 Polygon packages 페이지의 최신 Windows 패키지를 내려받고, 문제 지문과 이미지, 테스트케이스, 정답 코드를 분석한 뒤 구름 LEVEL 문제를 생성합니다.

## 한국어 설명

### 사용 흐름

1. 문제를 만들 대상 구름 LEVEL 탭을 하나 열어둡니다.
2. Polygon 문제의 `Packages` 페이지를 엽니다.
3. 최신 revision의 Windows package가 준비되어 있는지 확인합니다.
4. Polygon2Goorm 확장 팝업을 엽니다.
5. `문제 생성` 버튼을 누릅니다.
6. 생성이 끝나면 확장이 구름 탭을 `https://level.goorm.io/l/my`로 이동시킵니다.

수동으로 `lectureIndex`를 입력하거나 찾는 버튼은 없습니다. 확장이 열린 구름 LEVEL 탭에서 `lectureIndex`를 자동으로 찾습니다. 여러 개가 발견되면 대상이 아닌 구름 탭을 닫고 다시 실행하세요.

### 주요 기능

- 현재 Polygon 탭에서 최신 ready Windows package 링크를 찾습니다.
- 패키지를 브라우저 안에서 다운로드하고 파싱합니다.
- Polygon statement HTML을 구름 에디터 HTML로 변환합니다.
- TeX 수식을 구름 `/texconverter` 이미지 태그로 변환합니다.
- 지문 이미지를 base64 data URL로 포함합니다.
- 미리 생성된 입력/출력 테스트케이스 쌍을 추출합니다.
- 구름 업로드 형식의 테스트케이스 ZIP을 메모리에서 생성합니다.
- 구름 batch testcase API와 문제 생성 API를 호출합니다.

### 지원 범위

- Polygon Windows/FULL package.
- 표준 입력/표준 출력 문제.
- 미리 생성된 입력/출력 테스트케이스 쌍.
- 테스트케이스 최대 60쌍.
- 테스트 파일 1개당 최대 30 MB.
- 생성되는 테스트케이스 ZIP 최대 180 MB.
- 지문 이미지: PNG, JPEG, GIF, WebP.
- 표준 exact-output Polygon checker:
  - `std::ncmp.cpp`
  - `std::lcmp.cpp`
  - `std::wcmp.cpp`
  - `std::fcmp.cpp`
  - `std::hcmp.cpp`
  - `std::rcmp.cpp`
  - `std::icmp.cpp`
  - `std::yesno.cpp`

### 지원하지 않거나 차단하는 경우

- 커스텀 checker.
- 인터랙티브 문제.
- 파일 입력/출력 문제.
- 미리 생성된 출력 파일이 없는 generator-only package.
- 완전한 `tests/*`와 `tests/*.a` 쌍이 없는 standard/source package.
- 최신 revision package가 아직 준비되지 않은 Polygon package.

확장은 안전하게 옮길 수 없는 패키지를 일부러 차단합니다. 잘못된 테스트 데이터로 구름 문제가 생성되는 것보다 명확히 실패하는 쪽을 우선합니다.

### 정답 코드 선택 정책

구름 judge source에는 Polygon solution 중 호환 가능한 correct solution만 사용합니다.

현재 정책:

- main correct solution이 C++ 또는 Python 3이면 우선 사용합니다.
- main solution이 다른 언어라면 correct C++ 또는 Python 3 solution으로 대체합니다.
- 호환 가능한 correct solution이 없으면 오류로 중단합니다.

구름의 오래된 언어 런타임에 맞추기 위해 정답 코드를 임의로 고쳐 쓰지는 않습니다.

### 리소스 제한 옵션

확장 옵션 페이지에서 언어별 시간/메모리 제한 보정값을 설정할 수 있습니다.

각 언어는 다음 값을 가집니다.

- 시간 배율
- 시간 추가값(초)
- 메모리 배율
- 메모리 추가값(MB)

기본값은 가능한 경우 BOJ식 보정값을 따릅니다. 옵션 페이지에서 BOJ 기본값으로 초기화할 수 있습니다.

### 로컬 설치

1. `chrome://extensions`를 엽니다.
2. Developer mode를 켭니다.
3. `Load unpacked`를 누릅니다.
4. 프로젝트 폴더를 선택합니다.

### 개발

문법 검사:

```powershell
npm run check
```

테스트 실행:

```powershell
npm test
```

배포용 ZIP 생성:

```powershell
npm run package
```

버전 올리기:

```powershell
npm run version:patch
npm run version:minor
npm run version:major
```

### 저장소 메모

- `archive/java-prototype`에는 이전 Java/Gradle 프로토타입이 보관되어 있습니다.
- `polygon2goorm-extension.zip`은 생성 산출물이므로 git에서 제외합니다.
- 다운로드한 Polygon package ZIP도 git에서 제외합니다.

---

## English

Polygon2Goorm is a Chrome extension for porting Codeforces Polygon packages to goorm LEVEL programming problems.

It runs in the browser, downloads the latest ready Polygon Windows package from the current Polygon packages page, converts it locally, and creates a goorm LEVEL problem through goorm's programming problem endpoints.

### Workflow

1. Open a logged-in goorm LEVEL tab for the target lecture or problem list.
2. Open the Polygon problem's `Packages` page.
3. Make sure the latest revision has a ready Windows package.
4. Open the Polygon2Goorm extension popup.
5. Click `문제 생성`.
6. After creation, the extension moves the goorm tab to `https://level.goorm.io/l/my`.

There is no manual `lectureIndex` button anymore. The extension detects `lectureIndex` from an open goorm LEVEL tab. If multiple lecture indexes are found, close unrelated goorm tabs and run it again.

### What It Does

- Finds the latest ready Polygon Windows package link on the active Polygon tab.
- Downloads and parses the package in the browser.
- Converts Polygon statement HTML into goorm editor HTML.
- Converts TeX fragments to goorm `/texconverter` image tags.
- Embeds statement images as base64 data URLs.
- Extracts precomputed input/output testcase pairs.
- Builds a goorm-compatible testcase ZIP in memory.
- Uploads testcase metadata through goorm batch testcase APIs.
- Creates the goorm programming problem and refreshes the goorm tab.

### Supported Scope

- Polygon Windows/FULL packages.
- Standard input/output problems.
- Precomputed input/output testcase pairs.
- Up to 60 testcase pairs.
- Up to 30 MB per testcase file.
- Up to 180 MB for the generated testcase ZIP.
- Statement images: PNG, JPEG, GIF, and WebP.
- Standard exact-output Polygon checkers:
  - `std::ncmp.cpp`
  - `std::lcmp.cpp`
  - `std::wcmp.cpp`
  - `std::fcmp.cpp`
  - `std::hcmp.cpp`
  - `std::rcmp.cpp`
  - `std::icmp.cpp`
  - `std::yesno.cpp`

### Unsupported or Blocked

- Custom checkers.
- Interactive problems.
- File input/output problems.
- Generator-only packages without precomputed output files.
- Standard/source packages that do not contain complete `tests/*` and `tests/*.a` pairs.
- Latest Polygon revisions whose package is not ready yet.

The extension intentionally blocks packages that cannot be safely ported. It is better to fail loudly than to create a goorm problem with missing or wrong test data.

### Solution Source Policy

The goorm judge source is taken from Polygon solutions only when a compatible correct solution is available.

Current policy:

- Prefer the Polygon main correct solution when it is C++ or Python 3.
- If the main solution is another language, fall back to a correct C++ or Python 3 solution.
- If no compatible correct solution is found, stop with an error.

This avoids silently rewriting solutions for older goorm language runtimes.

### Resource Limit Options

Open the extension options page to configure time and memory conversion rules per language.

Each language has:

- time multiplier
- time addition in seconds
- memory multiplier
- memory addition in MB

The default values follow BOJ-style adjustments where applicable. The options page includes a reset button for restoring BOJ defaults.

### Install Locally

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click `Load unpacked`.
4. Select the project folder.

### Development

Run syntax checks:

```powershell
npm run check
```

Run tests:

```powershell
npm test
```

Create a distributable ZIP from the project root:

```powershell
npm run package
```

Bump the extension version:

```powershell
npm run version:patch
npm run version:minor
npm run version:major
```

### Repository Notes

- `archive/java-prototype` contains the archived Java/Gradle prototype.
- `polygon2goorm-extension.zip` is generated and intentionally ignored by git.
- Downloaded Polygon package ZIPs are intentionally ignored by git.
