import { ZipArchive, createStoredZip } from "./zip.js";
import { base64DataUrl, decodeBestEffort, escapeHtml } from "./util.js";

const STANDARD_CHECKERS = new Set(["ncmp.cpp", "lcmp.cpp", "wcmp.cpp", "fcmp.cpp", "hcmp.cpp", "rcmp.cpp", "icmp.cpp", "yesno.cpp"]);
const MAX_TEST_COUNT = 60;
const MAX_TEST_FILE_BYTES = 30 * 1024 * 1024;
const MAX_TESTCASE_ZIP_BYTES = 180 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DEFAULT_IMAGE_MAX_WIDTH = 640;
const ALLOWED_IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const JUDGE_SOURCE_LANGUAGES = new Set(["c++", "python3"]);

export async function convertPolygonPackage(file) {
  const zip = await ZipArchive.fromFile(file);
  const problemEntry = zip.findByBasename("problem.xml");
  if (!problemEntry) {
    return unsupported("No problem.xml was found.");
  }

  const problemXml = decodeBestEffort(await zip.read(problemEntry));
  const problem = parseProblemXml(problemXml);
  problem.hasCheckerFile = hasCheckerFile(zip.files());
  const answer = await readAnswerSource(zip, problem);
  problem.hasAnswerSource = Boolean(answer.source);
  problem.answerUnsupported = answer.unsupported || null;

  const testDiscovery = findTests(zip.files(), problem.sampleIndexes);
  const tests = testDiscovery.pairs;
  const report = analyze(problem, testDiscovery);
  if (report.result === "UNSUPPORTED") {
    return {
      title: problem.title,
      timeLimitMs: problem.timeLimitMs,
      memoryLimitMb: problem.memoryLimitMb,
      statementHtml: "",
      answerSource: answer.source,
      answerSourcePath: answer.path,
      answerLanguage: answer.language || "c++",
      testcaseZipBytes: new Uint8Array(),
      inputOutputExampleSet: [],
      testCount: tests.length,
      discoveredInputCount: testDiscovery.inputCount,
      discoveredOutputCount: testDiscovery.outputCount,
      report
    };
  }

  const statement = await buildStatementHtml(zip, problem);
  const testcaseZipBytes = await buildTestcaseZip(zip, tests);

  return {
    title: statement.title || problem.title,
    timeLimitMs: problem.timeLimitMs,
    memoryLimitMb: problem.memoryLimitMb,
    statementHtml: statement.html,
    answerSource: answer.source,
    answerSourcePath: answer.path,
    answerLanguage: answer.language || "c++",
    testcaseZipBytes,
    inputOutputExampleSet: tests.map(test => test.sample ? "true" : "false"),
    testCount: tests.length,
    discoveredInputCount: testDiscovery.inputCount,
    discoveredOutputCount: testDiscovery.outputCount,
    statementPath: statement.path,
    embeddedImageCount: statement.embeddedImageCount,
    report
  };
}

function unsupported(message) {
  return {
    title: "Unsupported package",
    timeLimitMs: 0,
    memoryLimitMb: 0,
    statementHtml: "",
    answerSource: "",
    answerSourcePath: "",
    testcaseZipBytes: new Uint8Array(),
    inputOutputExampleSet: [],
    testCount: 0,
    report: {
      result: "UNSUPPORTED",
      issues: [{ type: "PACKAGE", severity: "HIGH", message }]
    }
  };
}

function parseProblemXml(xmlText) {
  const xml = new DOMParser().parseFromString(xmlText, "application/xml");
  const root = xml.documentElement;
  const title = root.getAttribute("short-name")
    || root.getAttribute("name")
    || xml.querySelector("name")?.getAttribute("value")
    || "Untitled Problem";
  const judging = xml.querySelector("judging");
  const checker = xml.querySelector("checker");
  const checkerName = checker?.getAttribute("name") || "";
  const checkerSourcePath = checker?.querySelector("source")?.getAttribute("path") || "";
  const statement = selectStatement([...xml.querySelectorAll("statement")]
    .map(node => ({
      path: node.getAttribute("path") || "",
      type: node.getAttribute("type") || "",
      language: node.getAttribute("language") || ""
    })));

  return {
    title,
    timeLimitMs: numberText(xml.querySelector("time-limit")?.textContent),
    memoryLimitMb: memoryToMb(numberText(xml.querySelector("memory-limit")?.textContent)),
    inputFile: judging?.getAttribute("input-file") || "",
    outputFile: judging?.getAttribute("output-file") || "",
    checkerName,
    checkerSourcePath,
    statementPath: statement.path,
    solutionCandidates: solutionCandidates(xml),
    sampleIndexes: mainTests(xml)
      .map((node, index) => node.getAttribute("sample") === "true" ? index + 1 : null)
      .filter(Boolean)
  };
}

function selectStatement(statements) {
  return statements
    .filter(statement => statement.path)
    .sort((a, b) => scoreStatementCandidate(a) - scoreStatementCandidate(b))[0]
    || { path: "" };
}

function scoreStatementCandidate(statement) {
  const path = statement.path || "";
  const lowerPath = path.toLowerCase();
  const lowerType = (statement.type || "").toLowerCase();
  const lowerLanguage = (statement.language || "").toLowerCase();
  let score = lowerPath.length;
  if (lowerType.includes("html") || isHtmlPath(lowerPath)) score -= 10000;
  if (isKoreanStatement(lowerLanguage, lowerPath)) score -= 5000;
  if (basename(lowerPath) === "problem.html" || basename(lowerPath) === "problem.htm") score -= 500;
  return score;
}

function isKoreanStatement(language, path) {
  return language === "korean"
    || language === "ko"
    || path.includes("/korean/")
    || path.includes("\\korean\\");
}

function solutionCandidates(xml) {
  return [...xml.querySelectorAll("solutions solution")]
    .map((solution, order) => {
      const source = solution.querySelector("source");
      return {
        order,
        tag: solution.getAttribute("tag") || "",
        name: solution.getAttribute("name") || "",
        outcome: solution.getAttribute("outcome") || solution.getAttribute("verdict") || "",
        path: source?.getAttribute("path") || solution.getAttribute("path") || "",
        type: source?.getAttribute("type") || ""
      };
    })
    .filter(solution => solution.path)
    .sort((a, b) => solutionScore(a) - solutionScore(b) || a.order - b.order);
}

function solutionScore(solution) {
  const tag = solution.tag.toLowerCase();
  const value = `${solution.tag} ${solution.name} ${solution.outcome} ${solution.path} ${solution.type}`.toLowerCase();
  const isMain = tag === "main" || tag === "main-correct" || /\bmain\b/.test(value);
  const isCorrect = tag === "accepted" || tag === "correct" || tag === "main-correct" || /\b(accepted|correct|ok)\b/.test(value);
  let score = solution.order;
  if (isMain && isCorrect) score -= 10000;
  else if (isMain) score -= 5000;
  else if (isCorrect) score -= 1000;
  if (/\.(cpp|cc|cxx)/.test(value) || value.includes("g++")) score -= 20;
  if (value.includes("wrong") || value.includes("wa") || value.includes("fail")) score += 100;
  return score;
}

function mainTests(xml) {
  const namedTests = [...xml.querySelectorAll('judging testset[name="tests"] tests > test')];
  if (namedTests.length) return namedTests;
  return [...xml.querySelectorAll("judging testset tests > test")];
}

function hasCheckerFile(entries) {
  return entries.some(entry => {
    const name = basename(entry.name).toLowerCase();
    return name === "check.cpp"
      || name === "checker.cpp"
      || name === "check.exe"
      || name === "checker.exe";
  });
}

async function readAnswerSource(zip, problem) {
  const mainSolutions = problem.solutionCandidates.filter(solution => isMainSolution(solution));

  for (const solution of mainSolutions) {
    const entry = zip.find(solution.path) || zip.findByBasename(basename(solution.path));
    const language = solutionLanguage(solution, entry?.name || solution.path);
    if (entry && isJudgeSourceLanguage(language)) {
      return { source: decodeBestEffort(await zip.read(entry)), path: entry.name, language };
    }
  }

  const fallbackSolutions = problem.solutionCandidates.filter(solution => !isMainSolution(solution) && isCorrectSolution(solution));
  for (const solution of fallbackSolutions) {
    const entry = zip.find(solution.path) || zip.findByBasename(basename(solution.path));
    const language = solutionLanguage(solution, entry?.name || solution.path);
    if (entry && isJudgeSourceLanguage(language)) {
      return { source: decodeBestEffort(await zip.read(entry)), path: entry.name, language };
    }
  }

  const main = mainSolutions[0];
  return {
    source: "",
    path: main?.path || "",
    language: main ? solutionLanguage(main, main.path) : "",
    unsupported: {
      path: main?.path || "",
      language: main ? solutionLanguage(main, main.path) : "",
      reason: main
        ? "Main solution is not C++ or Python, and no accepted/correct C++ or Python fallback solution was found."
        : "No main solution and no accepted/correct C++ or Python solution was found."
    }
  };
}

function isMainSolution(solution) {
  const value = `${solution.tag} ${solution.name} ${solution.outcome} ${solution.path} ${solution.type}`.toLowerCase();
  return solution.tag.toLowerCase() === "main" || /\bmain\b/.test(value);
}

function isCorrectSolution(solution) {
  const tag = solution.tag.toLowerCase();
  const value = `${solution.tag} ${solution.name} ${solution.outcome} ${solution.path} ${solution.type}`.toLowerCase();
  return tag === "accepted" || tag === "correct" || tag === "main-correct" || /\b(accepted|correct|ok)\b/.test(value);
}

function solutionLanguage(solution, path) {
  const value = `${solution.type || ""} ${path || ""}`.toLowerCase();
  if (/\.(cpp|cc|cxx)$/.test(value) || value.includes("cpp") || value.includes("g++")) return "c++";
  if (/\.c$/.test(value) || /\bc\.gcc|\bc\.g\+\+|\bgcc\b/.test(value)) return "c";
  if (/\.java$/.test(value) || value.includes("java")) return "java";
  if (/\.py$/.test(value) || value.includes("python.3") || value.includes("python3")) return "python3";
  if (value.includes("python.2") || value.includes("python2")) return "python2";
  if (/\.go$/.test(value) || value.includes("golang")) return "go";
  if (/\.swift$/.test(value)) return "swift";
  if (/\.(js|mjs|cjs)$/.test(value) || value.includes("javascript") || value.includes("node")) return "javascript";
  if (/\.ts$/.test(value) || value.includes("typescript")) return "typescript";
  if (/\.rb$/.test(value) || value.includes("ruby")) return "ruby";
  if (/\.kt$/.test(value) || value.includes("kotlin")) return "kotlin";
  if (/\.scala$/.test(value) || value.includes("scala")) return "scala";
  if (/\.(vb|vbs)$/.test(value) || value.includes("vbdotnet") || value.includes("vb.net")) return "vbdotnet";
  if (/\.(pas|pp)$/.test(value) || value.includes("pascal")) return "pascal";
  if (/\.lua$/.test(value)) return "lua";
  if (/\.(m|mm)$/.test(value) || value.includes("objective")) return "objectivec";
  if (/\.r$/.test(value) || /\br\b/.test(solution.type || "")) return "R";
  if (/\.rs$/.test(value) || value.includes("rust")) return "rust";
  if (/\.(cob|cbl)$/.test(value) || value.includes("cobol")) return "cobol";
  if (/\.clj$/.test(value) || value.includes("clojure")) return "clojure";
  if (/\.st$/.test(value) || value.includes("smalltalk")) return "smalltalk";
  if (/\.dart$/.test(value)) return "dart";
  if (/\.hs$/.test(value) || value.includes("haskell")) return "haskell";
  if (/\.pl$/.test(value) || value.includes("perl")) return "perl";
  if (/\.(lisp|lsp|cl)$/.test(value) || value.includes("commonlisp") || value.includes("common-lisp")) return "commonlisp";
  if (/\.d$/.test(value) || value.includes("dmd")) return "d";
  if (/\.erl$/.test(value) || value.includes("erlang")) return "erlang";
  if (/\.php$/.test(value)) return "php";
  if (/\.cs$/.test(value) || value.includes("csharp") || value.includes("c#")) return "csharp";
  return "";
}

function isJudgeSourceLanguage(language) {
  return JUDGE_SOURCE_LANGUAGES.has(language);
}

function fallbackSolutionScore(path) {
  const lower = path.toLowerCase();
  let score = lower.length;
  if (lower.includes("main")) score -= 100;
  if (lower.includes("accepted") || lower.includes("correct") || lower.includes("solution") || lower.includes("sol.")) score -= 50;
  if (lower.includes("wrong") || lower.includes("wa") || lower.includes("fail")) score += 100;
  return score;
}

function analyze(problem, testDiscovery) {
  const issues = [];
  const tests = Array.isArray(testDiscovery) ? testDiscovery : testDiscovery.pairs;
  const inputCount = Array.isArray(testDiscovery) ? tests.length : testDiscovery.inputCount;
  const outputCount = Array.isArray(testDiscovery) ? tests.length : testDiscovery.outputCount;
  if (tests.length === 0) {
    if (inputCount > 0 && outputCount === 0) {
      issues.push({
        type: "TEST_OUTPUTS_MISSING",
        severity: "HIGH",
        message: `No precomputed output files were found. Found ${inputCount} input file(s) but 0 output file(s). This looks like a standard/source package; use a Windows/FULL package with tests/*.a outputs.`
      });
    } else {
      issues.push({
        type: "TESTS_MISSING",
        severity: "HIGH",
        message: `No precomputed input/output test pairs were found. Found ${inputCount} input file(s) and ${outputCount} output file(s).`
      });
    }
  }
  if (tests.length > MAX_TEST_COUNT) {
    issues.push({ type: "TOO_MANY_TESTS", severity: "HIGH", message: `goorm supports at most ${MAX_TEST_COUNT} testcase pairs, found ${tests.length}.` });
  }
  const totalTestBytes = tests.reduce((sum, test) => sum + test.input.uncompressedSize + test.output.uncompressedSize, 0);
  if (totalTestBytes > MAX_TESTCASE_ZIP_BYTES) {
    issues.push({ type: "TESTS_TOO_LARGE", severity: "HIGH", message: `Total testcase size exceeds 180MB: ${totalTestBytes} bytes.` });
  }
  for (const test of tests) {
    if (test.input.uncompressedSize > MAX_TEST_FILE_BYTES) {
      issues.push({ type: "TEST_FILE_TOO_LARGE", severity: "HIGH", message: `${test.input.name} exceeds 30MB.` });
    }
    if (test.output.uncompressedSize > MAX_TEST_FILE_BYTES) {
      issues.push({ type: "TEST_FILE_TOO_LARGE", severity: "HIGH", message: `${test.output.name} exceeds 30MB.` });
    }
  }
  if (problem.inputFile || problem.outputFile) {
    issues.push({ type: "FILE_IO", severity: "MEDIUM", message: "File input/output metadata detected." });
  }
  if (!isPortableChecker(problem.checkerName, problem.checkerSourcePath, problem.hasCheckerFile)) {
    issues.push({ type: "CUSTOM_CHECKER", severity: "HIGH", message: `Unsupported checker detected: ${problem.checkerName || problem.checkerSourcePath || "check.cpp"}` });
  }
  if (problem.answerUnsupported) {
    issues.push({
      type: "MAIN_SOLUTION_UNSUPPORTED",
      severity: "HIGH",
      message: `${problem.answerUnsupported.reason} Main: ${problem.answerUnsupported.language || "unknown"} ${problem.answerUnsupported.path}`
    });
  } else if (!problem.hasAnswerSource) {
    issues.push({ type: "SOLUTION_MISSING", severity: "MEDIUM", message: "No accepted/main C++ solution source was found." });
  }
  return {
    result: issues.some(issue => issue.severity === "HIGH") ? "UNSUPPORTED" : issues.length ? "SEMI_PORTABLE" : "AUTO_PORTABLE",
    issues
  };
}

function isPortableChecker(name, sourcePath, hasChecker) {
  const checkerId = String(name || sourcePath || "").toLowerCase().replace(/^std::/, "");
  if (!checkerId) return !hasChecker;
  return STANDARD_CHECKERS.has(checkerId) || STANDARD_CHECKERS.has(basename(checkerId));
}

function findTests(entries, sampleIndexes) {
  const files = entries.filter(entry => !isIgnoredTestArea(entry.name));
  const inputs = files.filter(entry => isInput(entry.name)).sort(compareTestEntries);
  const outputs = files.filter(entry => isOutput(entry.name)).sort(compareTestEntries);
  const used = new Set();
  const pairs = [];

  for (const input of inputs) {
    const output = outputs
      .filter(candidate => !used.has(candidate.name))
      .map(candidate => ({ candidate, score: pairScore(input.name, candidate.name) }))
      .sort((a, b) => a.score - b.score)[0];
    if (output && output.score <= 4) {
      const id = pairs.length + 1;
      used.add(output.candidate.name);
      pairs.push({
        id,
        input,
        output: output.candidate,
        sample: sampleIndexes.includes(id)
      });
    }
  }
  return {
    pairs,
    inputCount: inputs.length,
    outputCount: outputs.length,
    unmatchedInputCount: inputs.length - pairs.length,
    unmatchedOutputCount: outputs.length - used.size
  };
}

function compareTestEntries(a, b) {
  const ak = testSortKey(a.name);
  const bk = testSortKey(b.name);
  if (ak.group !== bk.group) return ak.group.localeCompare(bk.group);
  if (ak.number !== bk.number) return ak.number - bk.number;
  return ak.name.localeCompare(bk.name, undefined, { numeric: true });
}

function testSortKey(path) {
  const normalized = normalizeSlashes(path);
  const name = basename(normalized).toLowerCase();
  const group = dirname(normalized).toLowerCase();
  const number = Number(name.match(/\d+/)?.[0] || Number.MAX_SAFE_INTEGER);
  return { group, number, name };
}

function isIgnoredTestArea(path) {
  const lower = path.toLowerCase();
  return lower.includes("statement")
    || lower.includes("validator-tests")
    || lower.includes("checker-tests")
    || lower.includes("stresses/");
}

function isInput(path) {
  const name = basename(path).toLowerCase();
  return name.endsWith(".in") || /^[0-9]+$/.test(name);
}

function isOutput(path) {
  const name = basename(path).toLowerCase();
  return name.endsWith(".out") || name.endsWith(".ans") || name.endsWith(".a");
}

function pairScore(input, output) {
  let score = stem(input) === stem(output) ? 0 : 2;
  if (dirname(input) !== dirname(output)) score += 2;
  return score;
}

async function buildTestcaseZip(zip, tests) {
  const files = [];
  for (const test of tests) {
    const input = await zip.read(test.input);
    const output = await zip.read(test.output);
    assertReadableTestFile(test.input, input);
    assertReadableTestFile(test.output, output);
    files.push({ name: `input.${test.id}.txt`, data: input });
    files.push({ name: `output.${test.id}.txt`, data: output });
  }
  const testcaseZip = await createStoredZip(files);
  if (testcaseZip.length > MAX_TESTCASE_ZIP_BYTES) {
    throw new Error(`Generated testcase ZIP exceeds 180MB: ${testcaseZip.length} bytes`);
  }
  return testcaseZip;
}

function assertReadableTestFile(entry, bytes) {
  if (entry.uncompressedSize > 0 && bytes.length === 0) {
    throw new Error(`Test file was read as empty: ${entry.name}`);
  }
}

async function buildStatementHtml(zip, problem) {
  const preferredStatementEntry = zip.find(problem.statementPath);
  const statementEntry = isHtmlEntry(preferredStatementEntry) ? preferredStatementEntry : findHtmlStatement(zip.files());
  if (!statementEntry) return { title: "", html: "", path: "", embeddedImageCount: 0 };
  const statementHtml = decodeBestEffort(await zip.read(statementEntry));
  const htmlDoc = new DOMParser().parseFromString(statementHtml, "text/html");
  const statementRoot = htmlDoc.querySelector(".problem-statement") || htmlDoc.body;
  const title = cleanTitle(statementRoot.querySelector(".header .title")?.textContent
    || statementRoot.querySelector(".title")?.textContent
    || "");
  const htmlDir = dirname(statementEntry.name);
  const blocks = [];
  for (const section of statementSections(statementRoot)) {
    if (blocks.length) blocks.push(sectionSpacer());
    blocks.push(sectionHeading(section.title));
    blocks.push(...await contentBlocks(zip, htmlDir, section.node, section.skipLeadingBlank));
  }
  blocks.push(exampleBoundary());
  const html = compactBlocks(blocks).join("");
  return {
    title,
    html,
    path: statementEntry.name,
    embeddedImageCount: (html.match(/<img\b/gi) || []).filter(match => match).length
  };
}

function statementSections(statementRoot) {
  const sections = [];
  for (const child of statementRoot.children) {
    if (child.classList.contains("header") || child.classList.contains("sample-tests")) continue;
    if (child.classList.contains("legend")) {
      sections.push({ title: "문제", node: child, skipLeadingBlank: false });
    } else if (child.classList.contains("input-specification")) {
      sections.push({ title: "입력", node: child, skipLeadingBlank: true });
    } else if (child.classList.contains("output-specification")) {
      sections.push({ title: "출력", node: child, skipLeadingBlank: true });
    } else if (isStatementSection(child)) {
      sections.push({
        title: sectionTitle(child),
        node: child,
        skipLeadingBlank: true
      });
    }
  }
  return sections.filter(section => section.title);
}

function isStatementSection(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
  if (node.querySelector(":scope > .section-title")) return true;
  return node.classList.contains("note") || node.classList.contains("notes");
}

function sectionTitle(node) {
  const rawTitle = cleanTitle(node.querySelector(":scope > .section-title")?.textContent || "");
  const normalized = rawTitle.toLowerCase();
  if (normalized === "input") return "입력";
  if (normalized === "input format") return "입력";
  if (normalized === "output") return "출력";
  if (normalized === "output format") return "출력";
  if (normalized === "scoring") return "배점";
  if (normalized === "notes" || normalized === "note") return "노트";
  if (normalized === "tutorial") return "노트2";
  return rawTitle || classTitle(node);
}

function classTitle(node) {
  return cleanTitle([...node.classList].join(" "));
}

function cleanTitle(value) {
  const title = String(value || "" ).replace(/\s+/g, " ").trim();
  return title;
}

async function contentBlocks(zip, htmlDir, root, skipLeadingBlank) {
  if (!root) return [];
  const blocks = [];
  let seenContent = false;
  for (const child of root.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      const content = convertMathText(child.textContent).replace(/\s+/g, " ").trim();
      if (!content && skipLeadingBlank && !seenContent) continue;
      if (content) {
        seenContent = true;
        blocks.push(`<p>${content}</p>`);
      }
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    if (child.classList.contains("section-title")) continue;
    const tag = child.tagName.toLowerCase();
    if (tag === "p") {
      const content = (await inlineHtml(zip, htmlDir, child)).trim();
      if (!content && skipLeadingBlank && !seenContent) continue;
      if (content) seenContent = true;
      if (content) blocks.push(paragraphHtml(content, child));
    } else if (tag === "ul" || tag === "ol") {
      const items = [];
      for (const li of child.querySelectorAll(":scope > li")) {
        const content = (await inlineHtml(zip, htmlDir, li)).trim();
        if (content) items.push(`<li>${content}</li>`);
      }
      if (items.length) {
        seenContent = true;
        blocks.push(`<${tag}>${items.join("")}</${tag}>`);
      }
    } else {
      const content = (await blockHtml(zip, htmlDir, child)).trim();
      if (content) {
        seenContent = true;
        blocks.push(content);
      }
    }
  }
  return blocks;
}

async function blockHtml(zip, htmlDir, node) {
  const tag = node.tagName.toLowerCase();
  if (tag === "img") {
    const image = await imageHtml(zip, htmlDir, node);
    return image ? imageParagraph(image, node) : "";
  }
  if (tag === "table") {
    const images = [];
    for (const img of node.querySelectorAll("img")) {
      const image = await imageHtml(zip, htmlDir, img);
      if (image) images.push(image);
    }
    return images.map(image => imageParagraph(image, node)).join("\n");
  }
  if (tag === "div" || tag === "center") {
    const directImages = [...node.children].filter(child => child.tagName.toLowerCase() === "img");
    if (directImages.length) {
      const images = [];
      for (const img of directImages) {
        const image = await imageHtml(zip, htmlDir, img);
        if (image) images.push(image);
      }
      return images.map(image => imageParagraph(image, node)).join("\n");
    }

    const content = (await inlineHtml(zip, htmlDir, node)).trim();
    return content ? paragraphHtml(content, node) : "";
  }
  return "";
}

function paragraphHtml(content, sourceNode) {
  const style = isCentered(sourceNode) ? ' style="text-align: center;"' : "";
  return `<p${style}>${content}</p>`;
}

function imageParagraph(image, sourceNode) {
  const style = isCentered(sourceNode) ? ' style="text-align: center;"' : "";
  return `<p${style}>${image}</p>`;
}

function compactBlocks(blocks) {
  const compacted = [];
  for (const block of blocks) {
    if (!block) continue;
    if (block === sectionSpacer() && compacted[compacted.length - 1] === sectionSpacer()) continue;
    compacted.push(block);
  }
  return compacted;
}

async function inlineHtml(zip, htmlDir, node) {
  let out = "";
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      out += convertMathText(child.textContent);
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = child.tagName.toLowerCase();
      if (tag === "img") {
        out += await imageHtml(zip, htmlDir, child);
      } else if (tag === "b" || tag === "strong") {
        out += `<b>${await inlineHtml(zip, htmlDir, child)}</b>`;
      } else if (tag === "br") {
        out += "<br>";
      } else {
        out += await inlineHtml(zip, htmlDir, child);
      }
    }
  }
  return out.replace(/\s+/g, " ").trim();
}

function convertMathText(text) {
  const escaped = escapeHtml(text);
  return replaceMathDelimiter(replaceMathDelimiter(escaped, "$$$$$$"), "$$$")
    .replace(/\${2,}/g, "");
}

function replaceMathDelimiter(text, delimiter) {
  let result = "";
  let offset = 0;
  while (offset < text.length) {
    const start = text.indexOf(delimiter, offset);
    if (start < 0) {
      result += text.slice(offset);
      break;
    }
    const end = text.indexOf(delimiter, start + delimiter.length);
    if (end < 0) {
      result += text.slice(offset);
      break;
    }
    result += text.slice(offset, start);
    const equation = text.slice(start + delimiter.length, end).trim();
    result += `<span><img src="/texconverter?eq=${encodeURIComponent(equation)}"></span>`;
    offset = end + delimiter.length;
  }
  return result;
}

async function imageHtml(zip, htmlDir, imageNodeOrSrc) {
  const imageNode = typeof imageNodeOrSrc === "string" ? null : imageNodeOrSrc;
  const src = typeof imageNodeOrSrc === "string" ? imageNodeOrSrc : imageNodeOrSrc.getAttribute("src") || "";
  const centered = imageNode ? isCentered(imageNode) : false;
  if (!src || src.startsWith("/texconverter")) return "";
  if (src.startsWith("data:")) {
    if (!isAllowedDataImage(src)) return "";
    return `<img style="${imageStyle(imageNode, null, centered)}" src="${escapeHtml(src)}">`;
  }
  const cleanSrc = decodeURIComponent(src.split("?")[0]).replace(/^file:\/+/, "");
  const imageName = basename(cleanSrc);
  const candidates = unique([
    normalizeRelativePath(`${htmlDir}/${cleanSrc}`),
    normalizeRelativePath(cleanSrc),
    normalizeRelativePath(`${htmlDir}/${imageName}`),
    `statements/korean/${imageName}`,
    `statements/english/${imageName}`,
    `statement-sections/korean/${imageName}`,
    `statement-sections/english/${imageName}`,
    `resources/${imageName}`,
    `files/resources/${imageName}`
  ]);
  const entry = candidates.map(path => zip.find(path)).find(Boolean)
    || zip.files().find(file => basename(file.name) === imageName);
  if (!entry) return "";
  const bytes = await zip.read(entry);
  const mime = mimeType(entry.name);
  if (!ALLOWED_IMAGE_MIMES.has(mime) || bytes.length > MAX_IMAGE_BYTES) return "";
  return `<img style="${imageStyle(imageNode, imageDimensions(bytes, mime), centered)}" src="${base64DataUrl(bytes, mime)}">`;
}

function imageStyle(imageNode, dimensions, centered) {
  const declaredWidth = imageNode ? declaredImageWidth(imageNode) : 0;
  const intrinsicWidth = dimensions?.width || 0;
  const width = declaredWidth || Math.min(intrinsicWidth || DEFAULT_IMAGE_MAX_WIDTH, DEFAULT_IMAGE_MAX_WIDTH);
  const widthRule = width > 0 ? ` width: ${width}px;` : "";
  const centerRule = centered ? " display: block; margin-left: auto; margin-right: auto;" : "";
  return `max-width: 100%;${widthRule} height: auto; object-fit: contain;${centerRule}`;
}

function isCentered(node) {
  for (let current = node; current && current.nodeType === Node.ELEMENT_NODE; current = current.parentElement) {
    const tag = current.tagName.toLowerCase();
    const align = (current.getAttribute("align") || "").toLowerCase();
    const style = current.getAttribute("style") || "";
    const className = current.getAttribute("class") || "";
    if (tag === "center" || align === "center") return true;
    if (/(?:^|;)\s*text-align\s*:\s*center\b/i.test(style)) return true;
    if (/\bcenter(?:ed)?\b/i.test(className)) return true;
    if (/\bproblem-statement\b/.test(className)) break;
  }
  return false;
}

function declaredImageWidth(imageNode) {
  const attrWidth = positiveNumber(imageNode.getAttribute("width"));
  if (attrWidth) return Math.min(attrWidth, DEFAULT_IMAGE_MAX_WIDTH);
  const style = imageNode.getAttribute("style") || "";
  const styleWidth = positiveNumber(style.match(/(?:^|;)\s*width\s*:\s*([0-9.]+)px/i)?.[1]);
  if (styleWidth) return Math.min(styleWidth, DEFAULT_IMAGE_MAX_WIDTH);
  return 0;
}

function positiveNumber(value) {
  const number = Number.parseFloat(value || "");
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function imageDimensions(bytes, mime) {
  if (mime === "image/png") return pngDimensions(bytes);
  if (mime === "image/gif") return littleEndianDimensions(bytes, 6);
  if (mime === "image/jpeg") return jpegDimensions(bytes);
  if (mime === "image/webp") return webpDimensions(bytes);
  return null;
}

function pngDimensions(bytes) {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function littleEndianDimensions(bytes, offset) {
  if (bytes.length < offset + 4) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint16(offset, true), height: view.getUint16(offset + 2, true) };
}

function jpegDimensions(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
    if (length < 2) return null;
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return { width: (bytes[offset + 7] << 8) + bytes[offset + 8], height: (bytes[offset + 5] << 8) + bytes[offset + 6] };
    }
    offset += 2 + length;
  }
  return null;
}

function webpDimensions(bytes) {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 12) !== "WEBP") return null;
  const type = ascii(bytes, 12, 16);
  if (type === "VP8X" && bytes.length >= 30) {
    return { width: 1 + threeByteLittleEndian(bytes, 24), height: 1 + threeByteLittleEndian(bytes, 27) };
  }
  if (type === "VP8 " && bytes.length >= 30) {
    return littleEndianDimensions(bytes, 26);
  }
  if (type === "VP8L" && bytes.length >= 25) {
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

function threeByteLittleEndian(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function ascii(bytes, start, end) {
  return String.fromCharCode(...bytes.slice(start, end));
}

function normalizeRelativePath(path) {
  const parts = [];
  for (const part of normalizeSlashes(path).split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function isAllowedDataImage(src) {
  const match = src.match(/^data:([^;,]+);base64,(.*)$/i);
  if (!match) return false;
  const mime = match[1].toLowerCase();
  if (!ALLOWED_IMAGE_MIMES.has(mime)) return false;
  return Math.floor(match[2].length * 3 / 4) <= MAX_IMAGE_BYTES;
}

function sectionHeading(title) {
  return `<p><b><span style="font-size: 24px;">${title}</span></b></p><hr>`;
}

function sectionSpacer() {
  return "<p><br></p>";
}

function exampleBoundary() {
  return "<hr>";
}

function findHtmlStatement(entries) {
  return entries
    .filter(isHtmlEntry)
    .sort((a, b) => scoreStatement(a.name) - scoreStatement(b.name))[0];
}

function isHtmlEntry(entry) {
  return Boolean(entry && isHtmlPath(entry.name));
}

function isHtmlPath(path) {
  const lower = String(path || "").toLowerCase();
  return lower.endsWith(".html") || lower.endsWith(".htm");
}

function scoreStatement(path) {
  const lower = path.toLowerCase();
  let score = lower.length;
  if (isKoreanStatement("", lower)) score -= 5000;
  if (basename(lower) === "problem.html" || basename(lower) === "problem.htm") score -= 500;
  if (lower.includes("statement")) score -= 100;
  return score;
}

function numberText(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function memoryToMb(bytes) {
  if (!bytes) return 0;
  return bytes > 4096 ? Math.max(1, Math.round(bytes / 1024 / 1024)) : bytes;
}

function mimeType(path) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".png")) return "image/png";
  return "";
}

export const __test__ = {
  analyze,
  findTests,
  selectStatement,
  sectionTitle,
  scoreStatement,
  scoreStatementCandidate
};

function stem(path) {
  return basename(path).toLowerCase().replace(/\.(in|out|ans|a|input|answer)$/, "");
}

function basename(path) {
  const parts = normalizeSlashes(path).split("/");
  return parts[parts.length - 1];
}

function dirname(path) {
  const parts = normalizeSlashes(path).split("/");
  parts.pop();
  return parts.join("/");
}

function normalizeSlashes(path) {
  return String(path || "").split("\\").join("/");
}

