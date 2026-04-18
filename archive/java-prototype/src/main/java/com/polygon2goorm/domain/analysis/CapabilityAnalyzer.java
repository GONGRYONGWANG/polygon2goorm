package com.polygon2goorm.domain.analysis;

import com.polygon2goorm.domain.model.CompatibilityInfo;
import com.polygon2goorm.domain.model.CompatibilityResult;
import com.polygon2goorm.domain.model.DiscoveredPackage;
import com.polygon2goorm.domain.model.Issue;
import com.polygon2goorm.domain.model.Report;

import java.util.ArrayList;
import java.util.List;

public class CapabilityAnalyzer {
    public Report analyze(DiscoveredPackage discoveredPackage) {
        List<Issue> issues = new ArrayList<>();
        List<String> suggestions = new ArrayList<>();

        if (discoveredPackage.problemXml() == null) {
            issues.add(Issue.high("PROBLEM_XML_MISSING", "No problem.xml was found, so this is not confidently a Polygon FULL package.", null));
            suggestions.add("Export a Polygon FULL package ZIP and try again.");
        }
        if (discoveredPackage.checker() != null) {
            issues.add(Issue.high("CUSTOM_CHECKER", "Custom checker detected. Goorm testcase-based judging cannot represent this in v1.", rel(discoveredPackage, discoveredPackage.checker())));
            suggestions.add("Export or choose a version of this problem without a special judge.");
        }
        if (discoveredPackage.interactiveHint()) {
            issues.add(Issue.high("INTERACTIVE", "Interactive problem markers were detected. Interactive packages are unsupported in v1.", null));
        }
        if (discoveredPackage.tests().isEmpty()) {
            issues.add(Issue.high("TESTS_MISSING", "No precomputed input/output test pairs were found.", null));
        }
        if (discoveredPackage.generator() != null) {
            if (discoveredPackage.tests().isEmpty()) {
                issues.add(Issue.high("GENERATOR_DEPENDENT", "Generator-dependent package structure detected and no precomputed tests are available.", rel(discoveredPackage, discoveredPackage.generator())));
            } else {
                issues.add(Issue.low("GENERATOR_PRESENT", "Generator files were detected but ignored because precomputed tests are available in the FULL package.", rel(discoveredPackage, discoveredPackage.generator())));
            }
        }
        if (discoveredPackage.statementFallback() == null) {
            issues.add(Issue.medium("STATEMENT_TEXT_MISSING", "No HTML or text statement source was found for goorm editor input.", null));
        } else if (!isHtml(discoveredPackage.statementFallback())) {
            issues.add(Issue.medium("STATEMENT_HTML_MISSING", "No HTML statement found; non-HTML fallback requires manual handling.", rel(discoveredPackage, discoveredPackage.statementFallback())));
        }
        if (discoveredPackage.validator() != null) {
            issues.add(Issue.low("VALIDATOR_PRESENT", "Validator detected. It is reported but ignored because v1 uses precomputed tests.", rel(discoveredPackage, discoveredPackage.validator())));
        }
        if (!"stdin".equals(discoveredPackage.meta().inputMethod()) || !"stdout".equals(discoveredPackage.meta().outputMethod())) {
            issues.add(Issue.medium("FILE_IO", "File input/output metadata detected. v1 conversion is testcase-based, but manual goorm review may be required.", null));
        }

        CompatibilityResult result = classify(issues);
        if (result == CompatibilityResult.UNSUPPORTED && suggestions.isEmpty()) {
            suggestions.add("Skip this package in v1 or convert it manually.");
        }
        if (result == CompatibilityResult.SEMI_PORTABLE) {
            suggestions.add("Review warnings before uploading to goorm.");
        }
        return new Report(result, List.copyOf(issues), List.copyOf(suggestions));
    }

    public CompatibilityInfo compatibility(Report report) {
        List<String> warnings = report.issues().stream()
                .filter(issue -> issue.severity() != com.polygon2goorm.domain.model.Severity.HIGH)
                .map(Issue::message)
                .toList();
        List<String> unsupported = report.issues().stream()
                .filter(issue -> issue.severity() == com.polygon2goorm.domain.model.Severity.HIGH)
                .map(Issue::type)
                .toList();
        return new CompatibilityInfo(report.result(), warnings, unsupported);
    }

    private static CompatibilityResult classify(List<Issue> issues) {
        boolean hasHigh = issues.stream().anyMatch(issue -> issue.severity() == com.polygon2goorm.domain.model.Severity.HIGH);
        if (hasHigh) {
            return CompatibilityResult.UNSUPPORTED;
        }
        boolean hasWarning = !issues.isEmpty();
        return hasWarning ? CompatibilityResult.SEMI_PORTABLE : CompatibilityResult.AUTO_PORTABLE;
    }

    private static String rel(DiscoveredPackage pkg, java.nio.file.Path path) {
        return path == null ? null : pkg.root().relativize(path).toString().replace('\\', '/');
    }

    private static boolean isHtml(java.nio.file.Path path) {
        String name = path.getFileName().toString().toLowerCase(java.util.Locale.ROOT);
        return name.endsWith(".html") || name.endsWith(".htm");
    }
}
