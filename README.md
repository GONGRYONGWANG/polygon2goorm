# Polygon2Goorm Chrome Extension

Polygon2Goorm is now a Chrome extension-only prototype. It converts a Codeforces Polygon FULL package ZIP in the browser and creates a goorm LEVEL programming problem from the goorm new problem page.

## Current Workflow

1. Open the goorm LEVEL programming problem creation page:
   `https://level.goorm.io/teach/lecture/.../quiz/new/programming`
2. Open the Polygon2Goorm extension popup.
3. Click `현재 페이지에서 찾기` to detect `lectureIndex`.
4. Select a Polygon FULL package ZIP.
5. Click `문제 생성`.
6. Refresh the goorm problem list and confirm the created problem.

The extension:

- parses the Polygon ZIP locally,
- converts statement HTML into goorm editor HTML,
- embeds statement images as base64 data URLs,
- creates a goorm testcase ZIP in memory,
- uploads the testcase ZIP to `/api/quiz/programming/batch/testcase`,
- calls `/quiz/add` with batch testcase metadata.

## Supported V1 Scope

- Polygon FULL package ZIP.
- Standard input/output problems.
- Precomputed input/output tests.
- Exact-output standard checkers only: `std::ncmp.cpp`, `std::lcmp.cpp`, `std::wcmp.cpp`, `std::fcmp.cpp`, `std::yesno.cpp`.

## Unsupported

- Custom checkers.
- Tolerance checkers such as `std::rcmp6.cpp`.
- Interactive problems.
- Generator-only packages without precomputed tests.

## Install Locally

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click `Load unpacked`.
4. Select this folder:

```text
<project-folder>
```

## Development Check

```powershell
npm run check
```

## Java Prototype Archive

The previous Java/Gradle implementation was archived here:

```text
archive/java-prototype
```
