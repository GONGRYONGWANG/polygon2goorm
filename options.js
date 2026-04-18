const LANGUAGE_LABELS = {
  c: "C",
  "c++": "C++",
  java: "Java",
  python3: "Python3",
  go: "Go",
  swift: "Swift",
  javascript: "Javascript",
  typescript: "Typescript",
  ruby: "Ruby",
  kotlin: "Kotlin",
  scala: "Scala",
  vbdotnet: "VB.NET",
  pascal: "Pascal",
  lua: "Lua",
  objectivec: "Objective-C",
  R: "R",
  rust: "Rust",
  cobol: "Cobol",
  clojure: "Clojure",
  smalltalk: "Smalltalk",
  dart: "Dart",
  haskell: "Haskell",
  perl: "Perl",
  commonlisp: "Common Lisp",
  d: "D",
  erlang: "Erlang",
  php: "PHP",
  csharp: "C#"
};

const DEFAULT_LIMITS = {
  c: boj(),
  "c++": boj(),
  java: boj(2, 1, 2, 16),
  python3: boj(3, 2, 2, 32),
  go: boj(1, 2, 1, 512),
  swift: boj(1, 0, 1, 512),
  javascript: boj(3, 2, 2, 0),
  typescript: boj(3, 2, 2, 0),
  ruby: boj(2, 1, 1, 512),
  kotlin: boj(2, 1, 2, 16),
  scala: boj(2, 1, 2, 128),
  vbdotnet: boj(2, 1, 2, 16),
  pascal: boj(),
  lua: boj(),
  objectivec: boj(),
  R: boj(),
  rust: boj(1, 0, 1, 16),
  cobol: boj(),
  clojure: boj(),
  smalltalk: boj(),
  dart: boj(),
  haskell: boj(),
  perl: boj(1, 0, 1, 512),
  commonlisp: boj(),
  d: boj(1, 0, 1, 16),
  erlang: boj(),
  php: boj(1, 0, 1, 512),
  csharp: boj(2, 1, 2, 16)
};

const rows = document.querySelector("#limitRows");
const status = document.querySelector("#status");
const saveButton = document.querySelector("#saveButton");
const resetButton = document.querySelector("#resetButton");

init();

function boj(timeScale = 1, timeAdd = 0, memoryScale = 1, memoryAdd = 0) {
  return { timeScale, timeAdd, memoryScale, memoryAdd };
}

async function init() {
  render(await loadLimits());
  saveButton.addEventListener("click", save);
  resetButton.addEventListener("click", reset);
}

async function loadLimits() {
  const stored = await chrome.storage.local.get(["resourceLimits", "timeScales"]);
  const migrated = migrateTimeScales(stored.timeScales || {});
  return mergeLimits(DEFAULT_LIMITS, stored.resourceLimits || migrated);
}

function migrateTimeScales(timeScales) {
  return Object.fromEntries(Object.entries(timeScales).map(([language, timeScale]) => [language, { timeScale }]));
}

function mergeLimits(defaults, overrides) {
  return Object.fromEntries(Object.entries(defaults).map(([language, values]) => [
    language,
    { ...values, ...(overrides[language] || {}) }
  ]));
}

function render(limits) {
  rows.replaceChildren(...Object.keys(LANGUAGE_LABELS).map(language => row(language, limits[language])));
}

function row(language, values) {
  const tr = document.createElement("tr");
  tr.append(
    cell(LANGUAGE_LABELS[language], "language"),
    inputCell(language, "timeScale", values.timeScale, "0.1"),
    inputCell(language, "timeAdd", values.timeAdd, "1"),
    inputCell(language, "memoryScale", values.memoryScale, "0.1"),
    inputCell(language, "memoryAdd", values.memoryAdd, "1")
  );
  return tr;
}

function cell(text, className = "") {
  const td = document.createElement("td");
  td.textContent = text;
  if (className) td.className = className;
  return td;
}

function inputCell(language, field, value, step) {
  const td = document.createElement("td");
  const input = document.createElement("input");
  input.type = "number";
  input.min = field.endsWith("Scale") ? "0.1" : "0";
  input.step = step;
  input.dataset.language = language;
  input.dataset.field = field;
  input.value = String(value);
  td.append(input);
  return td;
}

async function save() {
  const limits = {};
  for (const input of rows.querySelectorAll("input")) {
    const value = Number(input.value);
    if (!Number.isFinite(value) || value < 0 || (input.dataset.field.endsWith("Scale") && value <= 0)) {
      showStatus(`${LANGUAGE_LABELS[input.dataset.language]} 값을 확인하세요.`);
      input.focus();
      return;
    }
    if (!limits[input.dataset.language]) limits[input.dataset.language] = {};
    limits[input.dataset.language][input.dataset.field] = value;
  }
  await chrome.storage.local.set({ resourceLimits: limits });
  showStatus("저장됨");
}

async function reset() {
  await chrome.storage.local.set({ resourceLimits: DEFAULT_LIMITS });
  await chrome.storage.local.remove(["timeScales"]);
  render(DEFAULT_LIMITS);
  showStatus("BOJ 기본값으로 초기화됨");
}

function showStatus(message) {
  status.textContent = message;
  setTimeout(() => {
    if (status.textContent === message) status.textContent = "";
  }, 2500);
}
