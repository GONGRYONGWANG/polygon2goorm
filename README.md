# Polygon2Goorm

Chrome extension for porting Codeforces Polygon packages to goorm LEVEL programming problems.

Polygon2Goorm runs in the browser, downloads the latest ready Polygon Windows package from the current Polygon packages page, converts it locally, and creates a goorm LEVEL problem through goorm's programming problem endpoints.

## Current Workflow

1. Open a logged-in goorm LEVEL tab for the target lecture or problem list.
2. Open the Polygon problem's `Packages` page.
3. Make sure the latest revision has a ready Windows package.
4. Open the Polygon2Goorm extension popup.
5. Click `문제 생성`.
6. After creation, the extension moves the goorm tab to `https://level.goorm.io/l/my`.

There is no manual `lectureIndex` button anymore. The extension detects `lectureIndex` from an open goorm LEVEL tab. If multiple lecture indexes are found, close unrelated goorm tabs and run it again.

## What It Does

- Finds the latest ready Polygon Windows package link on the active Polygon tab.
- Downloads and parses the package in the browser.
- Converts Polygon statement HTML into goorm editor HTML.
- Converts TeX fragments to goorm `/texconverter` image tags.
- Embeds statement images as base64 data URLs.
- Extracts precomputed input/output testcase pairs.
- Builds a goorm-compatible testcase ZIP in memory.
- Uploads testcase metadata through goorm batch testcase APIs.
- Creates the goorm programming problem and refreshes the goorm tab.

## Supported Scope

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

## Unsupported or Blocked

- Custom checkers.
- Interactive problems.
- File input/output problems.
- Generator-only packages without precomputed output files.
- Standard/source packages that do not contain complete `tests/*` and `tests/*.a` pairs.
- Latest Polygon revisions whose package is not ready yet.

The extension intentionally blocks packages that cannot be safely ported. It is better to fail loudly than to create a goorm problem with missing or wrong test data.

## Solution Source Policy

The goorm judge source is taken from Polygon solutions only when a compatible correct solution is available.

Current policy:

- Prefer the Polygon main correct solution when it is C++ or Python 3.
- If the main solution is another language, fall back to a correct C++ or Python 3 solution.
- If no compatible correct solution is found, stop with an error.

This avoids silently rewriting solutions for older goorm language runtimes.

## Resource Limit Options

Open the extension options page to configure time and memory conversion rules per language.

Each language has:

- time multiplier
- time addition in seconds
- memory multiplier
- memory addition in MB

The default values follow BOJ-style adjustments where applicable. The options page includes a reset button for restoring BOJ defaults.

## Install Locally

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click `Load unpacked`.
4. Select the project folder.

## Development

Run syntax checks:

```powershell
npm run check
```

Create a distributable ZIP from the project root:

```powershell
Compress-Archive -Path "manifest.json","popup.html","popup.js","styles.css","options.html","options.css","options.js","src","icons" -DestinationPath "polygon2goorm-extension.zip" -Force
```

## Repository Notes

- `archive/java-prototype` contains the archived Java/Gradle prototype.
- `polygon2goorm-extension.zip` is generated and intentionally ignored by git.
- Downloaded Polygon package ZIPs are intentionally ignored by git.
