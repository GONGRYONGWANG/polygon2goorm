package com.polygon2goorm.infrastructure.parser;

import com.polygon2goorm.domain.model.DiscoveredPackage;
import com.polygon2goorm.domain.model.DiscoveredTestCase;
import com.polygon2goorm.domain.model.ParsedProblemXml;
import com.polygon2goorm.infrastructure.filesystem.FileDiscovery;

import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

public class PackageScanner {
    private final FileDiscovery fileDiscovery;
    private final ProblemXmlParser problemXmlParser;
    private final TestCaseMatcher testCaseMatcher;

    public PackageScanner(FileDiscovery fileDiscovery, ProblemXmlParser problemXmlParser, TestCaseMatcher testCaseMatcher) {
        this.fileDiscovery = fileDiscovery;
        this.problemXmlParser = problemXmlParser;
        this.testCaseMatcher = testCaseMatcher;
    }

    public DiscoveredPackage scan(Path root) {
        List<Path> files = fileDiscovery.walkFiles(root);
        Path problemXml = bestByName(root, files, "problem.xml");
        ParsedProblemXml parsed = problemXmlParser.parse(problemXml);
        List<DiscoveredTestCase> tests = applySampleMetadata(testCaseMatcher.match(root, files), parsed);

        Path statementPdf = bestStatement(root, files, ".pdf");
        Path fallback = bestFallbackStatement(root, files);
        Path checker = null;
        if (!isExactStandardChecker(parsed.checkerName())) {
            checker = pathFromProblemXml(root, parsed.checkerSourcePath());
            if (checker == null) {
                checker = firstChecker(root, files);
            }
            if (checker == null && parsed.checkerName() != null) {
                checker = problemXml;
            }
        }
        Path validator = firstFeature(root, files, "validator", "validate");
        Path generator = firstFeature(root, files, "generator", "gen");
        boolean interactive = parsed.interactiveHint()
                || files.stream().anyMatch(path -> relative(root, path).contains("interactive"));

        return new DiscoveredPackage(root, files, problemXml, parsed, statementPdf, fallback,
                checker, validator, generator, interactive, tests);
    }

    private static List<DiscoveredTestCase> applySampleMetadata(List<DiscoveredTestCase> tests, ParsedProblemXml parsed) {
        if (parsed.sampleTestIndexes().isEmpty()) {
            return tests;
        }
        return tests.stream()
                .map(test -> new DiscoveredTestCase(
                        test.id(),
                        test.inputPath(),
                        test.answerPath(),
                        test.sample() || parsed.sampleTestIndexes().contains(test.id())))
                .toList();
    }

    private static Path bestByName(Path root, List<Path> files, String name) {
        return files.stream()
                .filter(path -> path.getFileName().toString().equalsIgnoreCase(name))
                .min(Comparator.comparingInt(path -> scorePath(root, path, "problem")))
                .orElse(null);
    }

    private static Path bestStatement(Path root, List<Path> files, String... extensions) {
        return files.stream()
                .filter(path -> hasExtension(path, extensions))
                .min(Comparator.comparingInt(path -> scorePath(root, path, "statement")))
                .orElse(null);
    }

    private static Path bestFallbackStatement(Path root, List<Path> files) {
        Path html = bestStatement(root, files, ".html", ".htm");
        return html == null ? bestStatement(root, files, ".tex") : html;
    }

    private static Path firstFeature(Path root, List<Path> files, String... tokens) {
        return files.stream()
                .filter(path -> {
                    String relative = relative(root, path);
                    for (String token : tokens) {
                        if (relative.contains(token)) {
                            return true;
                        }
                    }
                    return false;
                })
                .filter(path -> !relative(root, path).contains("statement"))
                .min(Comparator.comparing(path -> relative(root, path)))
                .orElse(null);
    }

    private static Path firstChecker(Path root, List<Path> files) {
        return files.stream()
                .filter(path -> {
                    String relative = relative(root, path);
                    return relative.contains("checker") || relative.contains("check");
                })
                .filter(path -> !relative(root, path).contains("statement"))
                .filter(path -> !isExactStandardChecker(path.getFileName().toString()))
                .min(Comparator.comparing(path -> relative(root, path)))
                .orElse(null);
    }

    private static Path pathFromProblemXml(Path root, String relativePath) {
        if (relativePath == null || relativePath.isBlank()) {
            return null;
        }
        Path path = root.resolve(relativePath).normalize();
        return path.startsWith(root) && java.nio.file.Files.isRegularFile(path) ? path : null;
    }

    private static boolean isExactStandardChecker(String name) {
        if (name == null) {
            return false;
        }
        String lower = name.toLowerCase(Locale.ROOT);
        if (lower.startsWith("std::")) {
            lower = lower.substring("std::".length());
        }
        return lower.equals("ncmp.cpp")
                || lower.equals("lcmp.cpp")
                || lower.equals("wcmp.cpp")
                || lower.equals("fcmp.cpp")
                || lower.equals("yesno.cpp");
    }

    private static boolean hasExtension(Path path, String... extensions) {
        String name = path.getFileName().toString().toLowerCase(Locale.ROOT);
        for (String extension : extensions) {
            if (name.endsWith(extension)) {
                return true;
            }
        }
        return false;
    }

    private static int scorePath(Path root, Path path, String preferredToken) {
        String relative = relative(root, path);
        int score = 100;
        if (relative.contains(preferredToken)) {
            score -= 40;
        }
        if (relative.contains("english") || relative.contains("/en/") || relative.contains("\\en\\")) {
            score -= 20;
        }
        if (relative.contains("statements") || relative.contains("statement")) {
            score -= 20;
        }
        return score + relative.length() / 10;
    }

    private static String relative(Path root, Path path) {
        return root.relativize(path).toString().replace('\\', '/').toLowerCase(Locale.ROOT);
    }
}
