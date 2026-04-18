# polygon2goorm

`polygon2goorm` is a Java 21 CLI that inspects a Codeforces Polygon FULL package ZIP and converts the v1-compatible subset into files useful for manual goorm problem creation.

The tool is intentionally conservative. Its first job is to decide whether a Polygon package fits goorm's testcase-based judging model. Only packages that can be represented clearly are converted automatically.

## Supported In v1

- Polygon FULL package ZIP input.
- Precomputed input/output test files.
- Standard input and standard output problems.
- Statement HTML fragment extraction for goorm editor input.
- JSON compatibility report and helper goorm manifest generation.

## Not Supported In v1

- STANDARD package generation flows.
- Custom checker or special judge problems.
- Interactive problems.
- Generator-dependent packages.
- Output-only, grader, or non-testcase judging models.
- PDF statement upload flow.
- TeX statement conversion.

## Build

```bash
gradle test
gradle installDist
```

This project targets Java 21 through Gradle toolchains.

## Inspect

```bash
polygon2goorm inspect problem.zip
polygon2goorm inspect problem.zip --report out/report.json
```

`inspect` prints the compatibility result, discovered statement/test/checker/generator status, and any issues.

## Convert

```bash
polygon2goorm convert problem.zip --output ./out
polygon2goorm convert problem.zip --output ./out --force-semi-portable
```

`convert` refuses `UNSUPPORTED` packages. It also refuses `SEMI_PORTABLE` packages unless `--force-semi-portable` is passed.

## Drag And Drop GUI

```bash
gradle runGui
```

On Windows, you can also double-click:

```text
run-gui.bat
```

To open only the GUI without a terminal window, double-click:

```text
run-gui.vbs
```

Drop a Polygon FULL package ZIP onto the window. If the package is portable enough for v1, the app creates a sibling output folder named `<zip-name>-goorm` and writes:

- `statement.html`
- `goorm-testcases.zip`

If the package is not portable, the app does not convert it and explains the blocking issues.

## Output

```text
out/
  statement.html
  statement.txt
  goorm-testcases.zip
  tests/
    input.1.txt
    output.1.txt
  ir.json
  goorm.json
  report.json
  README.md
```

`goorm.json` is not an official goorm API payload. It is a structured helper file for manual upload and review.

`statement.html` is an HTML fragment intended for goorm's statement editor. Empty paragraphs are normalized as `<p><br></p>` where possible.

`goorm-testcases.zip` contains testcase files at the ZIP root using goorm's upload names:

- `input.n.txt`
- `output.n.txt`

`n` is consecutive from `1`.

## Known Limitations

- Polygon ZIP layouts vary, so discovery is heuristic by design.
- Sample detection is best-effort; uncertain tests are treated as hidden.
- Missing or unusual `problem.xml` fields fall back to defaults and produce warnings where possible.
- Local conversion does not run validators, generators, or checker programs.
- Goorm testcase upload limits are enforced during conversion: at most 60 testcase files, each file at most 30MB, and total testcase content at most 180MB before compression.
