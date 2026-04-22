import assert from "assert";
import { __test__ } from "../src/polygon.js";

test("prefers Korean HTML statements over other statement languages", () => {
  const selected = __test__.selectStatement([
    { path: "statements/.html/english/problem.html", type: "text/html", language: "english" },
    { path: "statements/.html/korean/problem.html", type: "text/html", language: "korean" },
    { path: "statements/korean/problem.tex", type: "application/x-tex", language: "korean" }
  ]);
  assert.strictEqual(selected.path, "statements/.html/korean/problem.html");
});

test("falls back to HTML before non-HTML statements", () => {
  const selected = __test__.selectStatement([
    { path: "statements/korean/problem.tex", type: "application/x-tex", language: "korean" },
    { path: "statements/.html/english/problem.html", type: "text/html", language: "english" }
  ]);
  assert.strictEqual(selected.path, "statements/.html/english/problem.html");
});

test("pairs precomputed Polygon test inputs and outputs", () => {
  const discovery = __test__.findTests([
    entry("tests/01"),
    entry("tests/01.a"),
    entry("tests/02"),
    entry("tests/02.a"),
    entry("statements/korean/example.01"),
    entry("statements/korean/example.01.a")
  ], [1]);

  assert.strictEqual(discovery.pairs.length, 2);
  assert.strictEqual(discovery.inputCount, 2);
  assert.strictEqual(discovery.outputCount, 2);
  assert.strictEqual(discovery.pairs[0].sample, true);
});

test("reports standard/source packages with missing output files clearly", () => {
  const discovery = __test__.findTests([
    entry("tests/01"),
    entry("tests/02"),
    entry("tests/43")
  ], []);
  const report = __test__.analyze(baseProblem(), discovery);

  assert.strictEqual(report.result, "UNSUPPORTED");
  assert.strictEqual(report.issues[0].type, "TEST_OUTPUTS_MISSING");
  assert.match(report.issues[0].message, /standard\/source package/i);
});

test("maps polygon section titles to goorm-friendly Korean labels", () => {
  const sections = [
    nodeWithTitle("Scoring"),
    nodeWithTitle("Notes"),
    nodeWithTitle("Tutorial"),
    nodeWithTitle("Input format"),
    nodeWithTitle("Output format")
  ].map(node => __test__.sectionTitle(node));

  assert.deepStrictEqual(sections, ["배점", "노트", "노트2", "입력", "출력"]);
});

function entry(name, size = 10) {
  return { name, uncompressedSize: size };
}

function baseProblem() {
  return {
    inputFile: "",
    outputFile: "",
    checkerName: "ncmp.cpp",
    checkerSourcePath: "",
    hasCheckerFile: false,
    answerUnsupported: null,
    hasAnswerSource: true
  };
}

function nodeWithTitle(title) {
  return {
    querySelector(selector) {
      if (selector === ":scope > .section-title") {
        return { textContent: title };
      }
      return null;
    },
    classList: []
  };
}

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}
