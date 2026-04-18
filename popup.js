import { convertPolygonPackage } from "./src/polygon.js";
import { bytesToBase64 } from "./src/util.js";

const portButton = document.querySelector("#portButton");
const log = document.querySelector("#log");

init();

async function init() {
  portButton.addEventListener("click", portCurrentPolygonProblem);
}

async function portCurrentPolygonProblem() {
  setBusy(true);
  try {
    const goormTab = await findGoormTab();
    const lectureIndex = await detectSingleLectureIndex(goormTab.id);

    writeLog("Polygon 패키지 다운로드 링크 찾는 중...");
    const packageFile = await fetchPolygonPackageFromActiveTab();

    writeLog(`Polygon 패키지 분석 중...\n${packageFile.name}`);
    const conversion = await convertPolygonPackage(packageFile);
    if (conversion.report.result === "UNSUPPORTED") {
      writeLog([
        "포팅할 수 없는 패키지입니다.",
        "",
        ...conversion.report.issues.map(issue => `- [${issue.severity}] ${issue.type}: ${issue.message}`)
      ].join("\n"));
      return;
    }
    writeLog("구름에 테스트케이스 업로드 및 문제 생성 중...");
    const testcaseZipBase64 = bytesToBase64(conversion.testcaseZipBytes);
    const resourceLimitOverrides = await readResourceLimitOverrides();
    const uploadResult = await runInTab(goormTab.id, uploadAndCreateProblem, {
      lectureIndex,
      title: conversion.title,
      contents: conversion.statementHtml,
      answerSource: conversion.answerSource,
      answerSourcePath: conversion.answerSourcePath,
      answerLanguage: conversion.answerLanguage,
      timeLimitSeconds: Math.max(1, Math.ceil(conversion.timeLimitMs / 1000)),
      memoryLimitMb: conversion.memoryLimitMb || 512,
      inputOutputExampleSet: conversion.inputOutputExampleSet,
      resourceLimitOverrides,
      testcaseZipBase64
    });

    if (!uploadResult?.ok) {
      throw new Error(uploadResult?.message || "구름 API 호출 실패");
    }

    writeLog([
      "문제 생성 완료.",
      "",
      `제목: ${conversion.title}`,
      `테스트케이스: ${conversion.testCount}개`,
      `업로드 크기: input ${uploadResult.inputBytes ?? "?"} bytes / output ${uploadResult.outputBytes ?? "?"} bytes`,
      `저장 방식: ${uploadResult.finalMethod || "?"}`,
      `정답 코드: ${conversion.answerSource ? `추출됨 (${conversion.answerSourcePath || "경로 미상"})` : "찾지 못함"}`,
      `판정: ${conversion.report.result}`,
      "",
      "구름 내 문제 목록으로 이동합니다.",
      "",
      ...conversion.report.issues.map(issue => `- [${issue.severity}] ${issue.type}: ${issue.message}`)
    ].join("\n"));
    await openMyGoormProblemsAfterDelay(goormTab.id, goormTab.windowId);
  } catch (error) {
    writeLog(`포팅 실패:\n${error.stack || error.message}`);
  } finally {
    setBusy(false);
  }
}

async function fetchPolygonPackageFromActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith("https://polygon.codeforces.com/")) {
    throw new Error("현재 탭이 Polygon 페이지가 아닙니다. Polygon 문제 또는 packages 페이지에서 실행하세요.");
  }

  const packageLink = await readPolygonPackageLink(tab.id);
  if (packageLink?.latestIssue) {
    throw new Error(`${packageLink.latestIssue.message}\n${packageLink.latestIssue.rowText ? `latest package: ${packageLink.latestIssue.rowText}` : ""}`);
  }
  if (!packageLink?.url) {
    const debug = packageLink?.debug?.length
      ? `\n후보:\n${packageLink.debug.map(item => `- ${item.score}: ${item.text || "(no text)"} ${item.href || item.kind || ""}`).join("\n")}`
      : "";
    throw new Error(`현재 Polygon 페이지에서 패키지 다운로드 링크를 찾지 못했습니다. URL: ${packageLink?.pageUrl || tab.url}${debug}`);
  }

  const packageUrl = validatePolygonPackageUrl(packageLink);
  const response = await fetch(packageUrl, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Polygon 패키지 다운로드 실패: HTTP ${response.status}`);
  }

  const blob = await response.blob();
  if (!blob.size) {
    throw new Error("Polygon 패키지 다운로드 결과가 비어 있습니다.");
  }

  const name = packageFilename(response, packageUrl);
  return new File([blob], name, { type: blob.type || "application/zip" });
}

function validatePolygonPackageUrl(packageLink) {
  const url = new URL(packageLink.url);
  if (url.protocol !== "https:" || url.hostname !== "polygon.codeforces.com") {
    throw new Error(`허용되지 않은 Polygon 패키지 URL입니다: ${url.href}`);
  }

  const value = `${packageLink.text || ""} ${url.pathname} ${url.search}`.toLowerCase();
  if (!/(package|packages|download|zip)/.test(value) || !/(windows|win)/.test(value)) {
    throw new Error(`Windows 패키지 다운로드 링크로 확인되지 않았습니다: ${url.href}`);
  }
  return url.href;
}

async function readPolygonPackageLink(tabId) {
  const frameResults = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: () => {
      const elements = [...document.querySelectorAll("a[href], form[action], button, input[type='button'], input[type='submit'], [onclick]")];
      const links = elements.flatMap((element, order) => elementLinks(element, order));
      const latestNotReady = detectLatestNotReadyPackage();

      const candidates = links
        .map(link => ({ ...link, score: packageLinkScore(link) }))
        .filter(link => link.score < 900)
        .sort(comparePackageLinks);
      const latestPackage = latestPackageContainer();
      const latestCandidates = latestPackage
        ? elementLinks(latestPackage, 0)
          .map(link => ({ ...link, score: packageLinkScore(link) }))
          .filter(isWindowsPackageCandidate)
          .sort(comparePackageLinks)
        : [];
      const latestIssue = detectLatestPackageIssueV2(latestPackage, latestCandidates);

      return {
        best: latestNotReady || latestIssue ? null : latestPackage ? latestCandidates[0] || null : candidates[0] || null,
        pageUrl: location.href,
        latestIssue: latestNotReady || latestIssue,
        debug: links
          .map(link => ({ ...link, score: packageLinkScore(link) }))
          .sort(comparePackageLinks)
          .slice(0, 20)
      };

      function elementLinks(element, order) {
        const text = elementText(element);
        const values = [];
        const href = element.getAttribute("href") || element.getAttribute("action");
        if (href) values.push({ text, href: absolute(href), kind: element.tagName.toLowerCase(), order });

        const onclick = element.getAttribute("onclick") || "";
        for (const match of onclick.matchAll(/['"]([^'"]*(?:package|download|zip|windows|standard|linux)[^'"]*)['"]/gi)) {
          values.push({ text: `${text} ${onclick}`.trim(), href: absolute(match[1]), kind: "onclick", order });
        }

        for (const attr of element.getAttributeNames()) {
          if (!attr.startsWith("data-")) continue;
          const value = element.getAttribute(attr) || "";
          if (/package|download|zip|windows|standard|linux/i.test(value)) {
            values.push({ text: `${text} ${attr}`.trim(), href: absolute(value), kind: attr, order });
          }
        }

        if (!values.length && /package|download|zip|windows|standard|linux/i.test(text)) {
          values.push({ text, href: "", kind: element.tagName.toLowerCase(), order });
        }
        return values;
      }

      function elementText(element) {
        return (element.textContent
          || element.getAttribute("value")
          || element.getAttribute("title")
          || element.getAttribute("aria-label")
          || "").replace(/\s+/g, " ").trim();
      }

      function absolute(value) {
        if (!value || value === "#") return "";
        try {
          return new URL(value, location.href).href;
        } catch {
          return "";
        }
      }

      function packageLinkScore(link) {
        const text = link.text.toLowerCase();
        const href = (link.href || "").toLowerCase();
        const value = `${text} ${href}`;
        let score = 1000;
        if (href.includes("/package") || href.includes("/packages")) score -= 500;
        if (value.includes("package")) score -= 400;
        if (value.includes("download")) score -= 300;
        if (href.includes(".zip") || value.includes("zip")) score -= 300;
        if (text === "windows" || value.includes("windows")) score -= 1000;
        if (text === "standard" || value.includes("standard")) score += 120;
        if (text === "linux" || value.includes("linux")) score += 180;
        if (value.includes("full")) score -= 80;
        if (value.includes("statements")) score += 300;
        if (value.includes("tutorial")) score += 300;
        if (href.includes("/download") || href.includes("download=")) score -= 200;
        return score;
      }

      function comparePackageLinks(a, b) {
        if (a.score !== b.score) return a.score - b.score;
        return (a.order ?? 0) - (b.order ?? 0);
      }

      function detectLatestNotReadyPackage() {
        const element = [...document.querySelectorAll("[title], a[href]")]
          .find(item => /no ready package for latest revision/i.test(
            `${item.getAttribute("title") || ""} ${elementText(item)} ${item.getAttribute("href") || ""}`
          ));
        if (!element) return null;
        return {
          type: "LATEST_PACKAGE_NOT_READY",
          message: "Latest revision package가 아직 준비되지 않았습니다. Polygon에서 latest package build가 끝난 뒤 다시 실행하세요.",
          rowText: elementText(element.closest("tr, li, div") || element).slice(0, 240)
        };
      }

      function isWindowsPackageCandidate(link) {
        if (!link?.href || link.score >= 900) return false;
        const value = `${link.text || ""} ${link.href || ""}`.toLowerCase();
        return /(windows|win)/.test(value) && /(package|download|zip)/.test(value);
      }

      function detectLatestPackageIssueV2(row, latestCandidates) {
        if (!row) return null;
        const text = elementText(row);
        if (!/\blatest\b/i.test(text)) return null;
        if (latestCandidates.length) return null;

        const hasRevision = /\b(revision|rev\.?)\s*[:#]?\s*\d+\b/i.test(text) || /\br\d+\b/i.test(text);
        return {
          type: "LATEST_PACKAGE_REVISION_MISSING",
          message: hasRevision
            ? "Latest package에 revision은 보이지만 Windows package 다운로드 링크가 없습니다. Polygon에서 Windows package build가 끝난 뒤 다시 실행하세요."
            : "Latest package에 revision이 아직 없어 Windows package를 다운로드할 수 없습니다. Polygon에서 package build가 끝난 뒤 다시 실행하세요.",
          rowText: text.slice(0, 240)
        };
      }

      function latestPackageContainer() {
        if (!/packages/i.test(location.href)) return null;
        const rows = [...document.querySelectorAll("tr, li, div, .package, .package-row, [class*='package']")]
          .filter(element => /\blatest\b/i.test(elementText(element)));
        return rows.sort(compareLatestRows)[0] || null;
      }

      function compareLatestRows(a, b) {
        const lengthDiff = elementText(a).length - elementText(b).length;
        if (lengthDiff) return lengthDiff;
        return elementDepth(b) - elementDepth(a);
      }

      function detectLatestPackageIssue() {
        const row = latestPackageRow();
        if (!row) return null;
        const text = elementText(row);
        const value = text.toLowerCase();
        if (!value.includes("latest")) return null;

        const rowLinks = elementLinks(row, 0);
        const hasWindowsDownload = rowLinks.some(link => {
          const linkValue = `${link.text || ""} ${link.href || ""}`.toLowerCase();
          return link.href && /(windows|win)/.test(linkValue) && /(package|download|zip)/.test(linkValue);
        });
        if (hasWindowsDownload) return null;

        const hasWindowsLabel = value.includes("windows") || [...row.querySelectorAll("button, input, a, span, td")]
          .some(element => /windows/i.test(elementText(element)));
        const hasRevision = /\b(revision|rev\.?)\s*[:#]?\s*\d+\b/i.test(text)
          || /\br\d+\b/i.test(text)
          || row.querySelector("[href*='revision'], [href*='download'], [href*='package']");
        if (!hasWindowsLabel || hasRevision) return null;

        return {
          type: "LATEST_PACKAGE_REVISION_MISSING",
          message: "Latest package에 revision이 아직 없어 Windows package를 다운로드할 수 없습니다. Polygon에서 package build가 끝난 뒤 다시 실행하세요.",
          rowText: text.slice(0, 240)
        };
      }

      function latestPackageRow() {
        const rows = [...document.querySelectorAll("tr, li, .package, .package-row, [class*='package']")]
          .filter(element => /latest/i.test(elementText(element)) && /(windows|standard|linux|package)/i.test(elementText(element)));
        return rows.sort((a, b) => elementDepth(a) - elementDepth(b))[0] || null;
      }

      function elementDepth(element) {
        let depth = 0;
        for (let current = element; current?.parentElement; current = current.parentElement) depth += 1;
        return depth;
      }
    }
  });

  const results = frameResults.map(item => item.result).filter(Boolean);
  const latestIssueResult = results.find(result => result.latestIssue);
  if (latestIssueResult) {
    return {
      url: "",
      pageUrl: latestIssueResult.pageUrl || "",
      latestIssue: latestIssueResult.latestIssue,
      debug: latestIssueResult.debug || []
    };
  }
  const candidates = results
    .map(result => result.best)
    .filter(candidate => candidate?.href)
    .sort((a, b) => a.score - b.score);
  if (candidates[0]) return { url: candidates[0].href, ...candidates[0] };

  const debug = results.flatMap(result => result.debug || []).slice(0, 8);
  return { url: "", pageUrl: results[0]?.pageUrl || "", debug };
}

function packageFilename(response, url) {
  const disposition = response.headers.get("content-disposition") || "";
  const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8) return decodeURIComponent(utf8[1]);
  const plain = disposition.match(/filename="?([^";]+)"?/i);
  if (plain) return plain[1];
  const fromUrl = new URL(url).pathname.split("/").filter(Boolean).at(-1);
  return fromUrl?.endsWith(".zip") ? fromUrl : "polygon-package.zip";
}

async function readLectureIndexesFromTab(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const sources = [
        document.documentElement.innerHTML,
        JSON.stringify(localStorage),
        JSON.stringify(sessionStorage)
      ];
      return [...new Set(sources.flatMap(source => source.match(/lec_[A-Za-z0-9_]+/g) || []))];
    }
  });
  return result || [];
}

async function detectSingleLectureIndex(tabId) {
  const lectureIndexes = await readLectureIndexesFromTab(tabId);
  if (!lectureIndexes.length) {
    throw new Error("열린 구름 LEVEL 탭에서 lectureIndex를 찾지 못했습니다. 구름 LEVEL에 로그인된 탭을 하나 열어두고 다시 실행하세요.");
  }
  if (lectureIndexes.length > 1) {
    throw new Error([
      "여러 lectureIndex가 발견되어 자동 선택하지 않았습니다.",
      "만들 대상 구름 LEVEL/강의 탭만 남기거나 문제 생성 페이지를 열어둔 뒤 다시 실행하세요.",
      "",
      ...lectureIndexes.map(value => `- ${value}`)
    ].join("\n"));
  }
  const [lectureIndex] = lectureIndexes;
  if (!isValidLectureIndex(lectureIndex)) {
    throw new Error(`lectureIndex 형식이 올바르지 않습니다: ${lectureIndex}`);
  }
  return lectureIndex;
}

function isValidLectureIndex(value) {
  return /^lec_[A-Za-z0-9_]+$/.test(value);
}

async function findGoormTab({ requireQuizPage = false } = {}) {
  const tabs = await chrome.tabs.query({ url: "https://level.goorm.io/*" });
  const quizTab = tabs.find(tab => /\/quiz\/new\/programming|\/edit\/programming/.test(tab.url || ""));
  const tab = quizTab || (!requireQuizPage ? tabs.find(tab => tab.url?.startsWith("https://level.goorm.io/")) : null);
  if (!tab?.id) {
    throw new Error(requireQuizPage
      ? "구름 문제 생성/편집 탭을 찾지 못했습니다. lectureIndex 자동 감지는 해당 페이지에서만 신뢰합니다."
      : "열린 구름 LEVEL 탭이 없습니다. 먼저 구름 LEVEL에 로그인된 탭을 하나 열어주세요.");
  }
  return tab;
}

async function runInTab(tabId, func, payload) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func,
    args: [payload]
  });
  return result;
}

async function openMyGoormProblemsAfterDelay(tabId, windowId) {
  await new Promise(resolve => setTimeout(resolve, 800));
  await chrome.tabs.update(tabId, { url: "https://level.goorm.io/l/my", active: true });
  if (windowId != null) {
    await chrome.windows.update(windowId, { focused: true });
  }
}

async function readResourceLimitOverrides() {
  const stored = await chrome.storage.local.get(["resourceLimits", "timeScales"]);
  if (stored.resourceLimits && typeof stored.resourceLimits === "object") return stored.resourceLimits;
  if (stored.timeScales && typeof stored.timeScales === "object") {
    return Object.fromEntries(Object.entries(stored.timeScales).map(([language, timeScale]) => [language, { timeScale }]));
  }
  return {};
}

function uploadAndCreateProblem(payload) {
  function parseJsonOrText(text) {
    if (!text) return { result: true };
    try {
      return JSON.parse(text);
    } catch {
      return { result: false, text };
    }
  }

  function formatResponse(value) {
    if (!value) return "";
    if (typeof value === "string") return value.slice(0, 500);
    return JSON.stringify(value).slice(0, 500);
  }

  function extractQuizIndex(text) {
    const parsed = parseJsonOrText(text);
    const direct = parsed?.index
      || parsed?.quizIndex
      || parsed?.data?.index
      || parsed?.data?.quizIndex
      || parsed?.data?.quiz?.index
      || parsed?.quiz?.index;
    if (direct) return direct;

    const match = String(text || "").match(/q_[A-Za-z0-9]+_\d+/);
    return match ? match[0] : "";
  }

  function distributeScores(count) {
    const base = Math.floor(100 / count);
    let remainder = 100 - base * count;
    return Array.from({ length: count }, () => String(base + (remainder-- > 0 ? 1 : 0)));
  }

  function defaultSource() {
    return "#include <iostream>\nusing namespace std;\nint main() {\n\tchar input[100];\n\tcin >> input;\n\tcout << \"Hello World! Your input is \" << input << endl;\n\treturn 0;\n}";
  }

  function template(source) {
    return [{ hidden: false, readonly: false, source }];
  }

  function defaultAnswerCode() {
    return {
      c: template("#include <stdio.h>\nint main() {\n\tchar input[100];\n\tscanf(\"%s\",input);\n\tprintf(\"Hello World! Your input is %s\",input);\n\treturn 0;\n}\n"),
      "c++": template(defaultSource()),
      java: template("import java.io.*;\nclass Main {\n\tpublic static void main(String[] args) throws Exception {\n\t\tBufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n\t\tString input = br.readLine();\n\t\tSystem.out.println(\"Hello World! Your input is \" + input);\n\t}\n}"),
      python3: template("# -*- coding: utf-8 -*-\n# UTF-8 encoding when using korean\nuser_input = input()\nprint (\"Hello World! Your input is \" + user_input)"),
      go: template("package main\nimport \"fmt\"\nfunc main() {\n\tvar input string\n\t_, err := fmt.Scanln(&input);\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\tfmt.Println(\"Hello World! Your input is\",input);\n}"),
      swift: template("let input = readLine()!\nprint(\"Hello World! Your input is \\(input)\")"),
      javascript: template("// Run by Node.js\nconst readline = require('readline');\n\n(async () => {\n\tlet rl = readline.createInterface({ input: process.stdin });\n\t\n\tfor await (const line of rl) {\n\t\tconsole.log('Hello World! Your input is', line);\n\t\trl.close();\n\t}\n\t\n\tprocess.exit();\n})();\n"),
      typescript: template("// Run by Node.js\nimport * as readline from 'readline';\n\n(async () => {\n\tlet rl = readline.createInterface({ input: process.stdin });\n\t\n\tfor await (const line of rl) {\n\t\tconsole.log('Hello World! Your input is', line);\n\t\trl.close();\n\t}\n\t\n\tprocess.exit();\n})();\n"),
      ruby: template("input = gets\nputs \"Hello World! Your input is \" + input "),
      kotlin: template("import java.util.Scanner\nfun main(args: Array<String>) {\n\tval input = readLine()\n\tprint(\"Hello World! Your input is \" + input)\n}"),
      scala: template("object Main {\n\tdef main(args: Array[String]) {\n\t\tvar input = scala.io.StdIn.readLine()\n\t\tprintln(\"Hello World. Your input is \"+input)\n\t}\n}"),
      vbdotnet: template("Module Goorm\n\tSub Main()\n\t\tDim input As String\n\t\tinput = Console.ReadLine()\n\t\tConsole.WriteLine(\"Hello World! Your input is \" & input)\n\tEnd Sub\nEnd Module"),
      pascal: template("program Goorm;\nvar\n\tinput:String;\nbegin\n\tReadln(input);\n\twriteln('Hello World! Your input is ', input);\nend."),
      lua: template("input = io.read()\nprint(\"Hello World! Your input is\",input)"),
      objectivec: template("#import <Foundation/Foundation.h> \nint main()\n{\n\t@autoreleasepool {\n\t\tchar input[100];\n\t\tscanf(\"%s\",input);\n\t\tprintf(\"Hello World! Your input is %s\",input);\n\t\treturn 0;\n\t}\n}"),
      R: template("fp=file(\"stdin\", \"r\")\ninput=scan(file=fp, what=\"character\", n=1)\ncat(\"Hello World! Your input is\",input ,\"\\n\")"),
      rust: template("use std::io;\n\nfn main() {\n\tlet mut input = String::new();\n\tio::stdin().read_line(&mut input).unwrap();\n\tprintln!(\"Hello World! Your input is {}\", input);\n}"),
      cobol: template("000010 IDENTIFICATION DIVISION.\n000020 PROGRAM-ID. GOORM.\n000030 DATA DIVISION.\n000040 WORKING-STORAGE SECTION.\n000050 01 A        PIC X(10).\n000060 PROCEDURE DIVISION.\n000070   ACCEPT A\n000080   DISPLAY 'Hello World! Your input is ', A.\n000090   STOP RUN."),
      clojure: template("(def n (read-line))\n(println \"Hello World! Your input is\" n)"),
      smalltalk: template("input := stdin nextLine .\nTranscript show: ('Hello World! Your input is ' , input, '!'); cr"),
      dart: template("import 'dart:io';\nvoid main() {\n\tvar line = stdin.readLineSync()!;\n\tprint(\"Hello World! Your input is \" + line);\n}"),
      haskell: template("main :: IO()\nmain = do\n\tinput <- getLine\n\tputStrLn (\"Hello World! Your input is \" ++ input)"),
      perl: template("$n = <>;\nprint \"Hello World! Your input is $n\";"),
      commonlisp: template("(setq n (read))\n(format t \"Hello World! Your input is \")\n(write n)"),
      d: template("import std.stdio;\n\nvoid main() {\n\tstring input;\n\treadf(\"%s\\n\", &input);\n\twriteln(\"Hello World! Your input is \",input);\n}"),
      erlang: template("%% Do not change -module and -export\n-module(main).\n-export([start/0]).\nstart() ->\n\t{ok,X} = io:fread(\"\", \"~s\"),\n\tio:fwrite(\"Hello World! Your input is ~s\",X)."),
      php: template("<?php\n\t$n = fgets(STDIN);\n\techo \"Hello World! Your input is $n\";\n?>"),
      csharp: template("using System;\nnamespace goorm\n{\n\tclass Program\n\t{\n\t\tstatic void Main(string[] args)\n\t\t{\n\t\t\tstring input;\n\t\t\tinput = Console.ReadLine();\n\t\t\tConsole.WriteLine(\"Hello World! Your input is \" + input);\n\t\t}\n\t}\n}")
    };
  }

  function buildQuizAddPayload(inputset, outputset, count) {
    const templateSource = defaultSource();
    const judgeSource = payload.answerSource || templateSource;
    const judgeLanguage = judgeLanguageConfig(payload.answerLanguage || "c++");
    const languageKeys = goormLanguageKeys();
    const scoreset = distributeScores(count);
    const exampleSet = payload.inputOutputExampleSet?.length === count
      ? payload.inputOutputExampleSet
      : Array.from({ length: count }, () => "false");
    const limits = goormResourceLimits(payload.timeLimitSeconds, payload.memoryLimitMb);

    return {
      lectureIndex: payload.lectureIndex,
      lecture_index: payload.lectureIndex,
      title: payload.title,
      contents: payload.contents,
      contents_type: "contents",
      difficulty: 1,
      form: "programming",
      type: "programming",
      setting: "exam_mode",
      open: "private",
      purpose: "",
      language: judgeLanguage.language,
      compiler_option: judgeLanguage.compilerOption,
      version_option: judgeLanguage.versionOption,
      build_option: judgeLanguage.buildOption,
      run_option: judgeLanguage.runOption,
      source: judgeSource,
      checked_code_type: "contents",
      code_type: "contents",
      skeleton_type: "editor",
      testcase_type: "batch",
      inputset,
      outputset,
      input_output_example_set: exampleSet,
      regexset: Array.from({ length: count }, () => false),
      scoreset,
      groupset: [],
      useTestcaseGrouping: false,
      input_file: { list: [], selected_list: [], use: false },
      output_file: { use: false, output_type: "", filepath: "" },
      mark_trim: true,
      mark_all_trim: false,
      mark_delete_comma: false,
      mark_delete_period: false,
      mark_ignore_capital: false,
      mark_line_trim: true,
      showMarkOptions: false,
      tc_marking_result_dump: true,
      data_file: [],
      bookmarks: "[]",
      dockerImage: {},
      use_run_screen_example: false,
      run_screen_example: "",
      run_time_limit: 60,
      show_run_res_usage: false,
      show_submit_res_usage: true,
      use_language_option_validate: false,
      validate_build_option: JSON.stringify(goormValidateBuildOptions()),
      validate_memory_limit: JSON.stringify(limits.memory),
      validate_run_option: JSON.stringify(emptyLanguageMap(languageKeys)),
      validate_time_limit: JSON.stringify(limits.time),
      quizExplanation: { type: "html", index: "", text: "" },
      authorship: [{ order: 1, name: "", url: "" }, { order: 2, name: "", url: "" }],
      classification: JSON.stringify([
        { value: "tag_private", text: "비공개", from: "offer" },
        { value: "tag_difficulty_1", text: "난이도 1", from: "offer" },
        { value: "tag_programming", text: "일반 프로그래밍 문제", from: "offer" },
        { value: "tag_exam_mode", text: "채점 모드", from: "offer" },
        ...languageKeys.map(language => ({ value: `tag_${language}`, text: goormLanguageLabels()[language], from: "offer" }))
      ]),
      answer_build_option: JSON.stringify(goormAnswerBuildOptions()),
      answer_code: JSON.stringify(defaultAnswerCode()),
      answer_language: languageKeys,
      answer_interpreter_option: { python3: "python3" },
      answer_compiler_option: { c: "gcc", "c++": "gcc" },
      answer_main_class: { java: "Main", scala: "Main" },
      answer_language_version: goormLanguageVersions(),
      answer_run_option: JSON.stringify(emptyLanguageMap(languageKeys)),
      isUnSubmitableQuiz: false
    };
  }

  function judgeLanguageConfig(language) {
    const versions = goormLanguageVersions();
    const buildOptions = goormAnswerBuildOptions();
    return {
      language,
      compilerOption: goormCompilerOptions()[language] || "",
      versionOption: versions[language] || "",
      buildOption: buildOptions[language] || "",
      runOption: ""
    };
  }

  function goormLanguageKeys() {
    return ["c", "c++", "java", "python3", "go", "swift", "javascript", "typescript", "ruby", "kotlin", "scala", "vbdotnet", "pascal", "lua", "objectivec", "R", "rust", "cobol", "clojure", "smalltalk", "dart", "haskell", "perl", "commonlisp", "d", "erlang", "php", "csharp"];
  }

  function goormLanguageLabels() {
    return { c: "C", "c++": "C++", java: "Java", python3: "Python3", go: "Go", swift: "Swift", javascript: "Javascript", typescript: "Typescript", ruby: "Ruby", kotlin: "Kotlin", scala: "Scala", vbdotnet: "VB.NET", pascal: "Pascal", lua: "Lua", objectivec: "Objective-C", R: "R", rust: "Rust", cobol: "Cobol", clojure: "Clojure", smalltalk: "Smalltalk", dart: "Dart", haskell: "Haskell", perl: "Perl", commonlisp: "Common Lisp", d: "D", erlang: "Erlang", php: "PHP", csharp: "C#" };
  }

  function goormLanguageVersions() {
    return { c: "17", "c++": "17", java: "21", python3: "3.9", go: "1.16", swift: "5", javascript: "16", typescript: "4.4", ruby: "3.0", kotlin: "1.6", scala: "2.13", vbdotnet: "16", pascal: "3.2", lua: "5.3", objectivec: "10", R: "4.1", rust: "1.48", cobol: "3.1", clojure: "1.10", smalltalk: "3.2", dart: "2.14", haskell: "8.8", perl: "5.30", commonlisp: "2.0", d: "2.097", erlang: "24", php: "8.0", csharp: "9" };
  }

  function goormAnswerBuildOptions() {
    return { c: "-lm", "c++": "-std=c++17 -O2 -Wall -lm", java: "", go: "", kotlin: "", scala: "", vbdotnet: "", pascal: "", objectivec: "", rust: "", cobol: "", haskell: "", d: "", erlang: "" };
  }

  function goormValidateBuildOptions() {
    return { c: "", "c++": "", java: "", go: "", swift: "", kotlin: "", scala: "", vbdotnet: "", pascal: "", objectivec: "", rust: "", cobol: "", haskell: "", d: "", erlang: "" };
  }

  function goormCompilerOptions() {
    return { c: "gcc", "c++": "gcc" };
  }

  function emptyLanguageMap(languageKeys) {
    return Object.fromEntries(languageKeys.map(language => [language, ""]));
  }

  function goormResourceLimits(baseSeconds, baseMemoryMb) {
    const limits = mergeResourceLimits(defaultResourceLimits(), payload.resourceLimitOverrides || {});
    const time = {};
    const memory = {};
    for (const language of goormLanguageKeys()) {
      const limit = limits[language];
      time[language] = String(Math.max(1, Math.ceil(baseSeconds * limit.timeScale + limit.timeAdd)));
      memory[language] = String(Math.max(1, Math.ceil(baseMemoryMb * limit.memoryScale + limit.memoryAdd)));
    }
    return { time, memory };
  }

  function defaultResourceLimits() {
    const boj = (timeScale = 1, timeAdd = 0, memoryScale = 1, memoryAdd = 0) => ({ timeScale, timeAdd, memoryScale, memoryAdd });
    return {
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
  }

  function mergeResourceLimits(defaults, overrides) {
    const allowed = new Set(goormLanguageKeys());
    const merged = { ...defaults };
    for (const [language, values] of Object.entries(overrides || {})) {
      if (!allowed.has(language) || !values || typeof values !== "object") continue;
      merged[language] = { ...merged[language], ...sanitizeResourceLimit(values) };
    }
    return merged;
  }

  function sanitizeResourceLimit(values) {
    const result = {};
    for (const key of ["timeScale", "timeAdd", "memoryScale", "memoryAdd"]) {
      const value = Number(values[key]);
      if (!Number.isFinite(value)) continue;
      if (key.endsWith("Scale") && value <= 0) continue;
      if (key.endsWith("Add") && value < 0) continue;
      result[key] = value;
    }
    return result;
  }

  const bytes = Uint8Array.from(atob(payload.testcaseZipBase64), c => c.charCodeAt(0));
  const batchFile = new File([bytes], "goorm-testcases.zip", { type: "application/x-zip-compressed" });
  const batchForm = new FormData();
  batchForm.append("batchFile", batchFile);

  return fetch("/api/quiz/programming/batch/testcase", {
    method: "POST",
    credentials: "include",
    body: batchForm
  })
    .then(response => response.json())
    .then(testcaseResult => {
      if (!testcaseResult.result) {
        throw new Error("테스트케이스 업로드 실패");
      }

      const testcases = testcaseResult.data.testcases;
      const inputBytes = testcases.reduce((sum, testcase) => sum + Number(testcase.input?.size || 0), 0);
      const outputBytes = testcases.reduce((sum, testcase) => sum + Number(testcase.output?.size || 0), 0);
      const inputset = testcases.map(testcase => testcase.input.path);
      const outputset = testcases.map(testcase => testcase.output.path);
      const quizInfo = buildQuizAddPayload(inputset, outputset, testcases.length);

      return fetch("/quiz/add", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quizInfo)
      })
        .then(async addResponse => {
          const addText = await addResponse.text();
          if (!addResponse.ok) {
            throw new Error(`/quiz/add 실패: HTTP ${addResponse.status} ${addText.slice(0, 500)}`);
          }

          const quizIndex = extractQuizIndex(addText);
          if (!quizIndex) {
            throw new Error(`/quiz/add 성공, 하지만 생성된 quiz index를 응답에서 찾지 못했습니다. 응답: ${addText.slice(0, 500)}`);
          }

          quizInfo.index = quizIndex;
          return { quizInfo, inputBytes, outputBytes };
        });
    })
    .then(({ quizInfo, inputBytes, outputBytes }) => {
      const finalForm = new FormData();
      finalForm.append("quizInfo", JSON.stringify(quizInfo));
      finalForm.append("batchFile", batchFile);

      return fetch("/api/quiz/programming/batch", {
        method: "POST",
        credentials: "include",
        body: finalForm
      }).then(async response => {
        const text = await response.text();
        const result = parseJsonOrText(text);
        if (response.ok && result.result !== false) {
          return { response, inputBytes, outputBytes, finalMethod: "batch multipart" };
        }

        throw new Error(`/api/quiz/programming/batch 실패: HTTP ${response.status} ${formatResponse(result)}`);
      });
    })
    .then(({ response, inputBytes, outputBytes, finalMethod }) => {
      if (!response.ok) {
        throw new Error(`최종 저장 실패: HTTP ${response.status}`);
      }
      return { ok: true, inputBytes, outputBytes, finalMethod };
    })
    .catch(error => ({ ok: false, message: error.message }));
}

function setBusy(busy) {
  portButton.disabled = busy;
}

function writeLog(message) {
  log.textContent = message;
}

