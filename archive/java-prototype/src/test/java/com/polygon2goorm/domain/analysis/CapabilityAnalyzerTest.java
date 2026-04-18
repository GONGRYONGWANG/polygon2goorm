package com.polygon2goorm.domain.analysis;

import com.polygon2goorm.domain.model.CompatibilityResult;
import com.polygon2goorm.domain.model.DiscoveredPackage;
import com.polygon2goorm.domain.model.DiscoveredTestCase;
import com.polygon2goorm.domain.model.ParsedProblemXml;
import com.polygon2goorm.domain.model.ProblemMeta;
import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CapabilityAnalyzerTest {
    private final CapabilityAnalyzer analyzer = new CapabilityAnalyzer();

    @Test
    void returnsAutoPortableForPlainStdInStdOutPackage() {
        DiscoveredPackage pkg = packageWith(
                Path.of("problem.xml"),
                Path.of("statements/english/problem.pdf"),
                null,
                Path.of("statements/english/problem.html"),
                null,
                List.of(testCase()));

        assertThat(analyzer.analyze(pkg).result()).isEqualTo(CompatibilityResult.AUTO_PORTABLE);
    }

    @Test
    void returnsUnsupportedWhenCustomCheckerExists() {
        DiscoveredPackage pkg = packageWith(
                Path.of("problem.xml"),
                Path.of("statements/english/problem.pdf"),
                Path.of("checkers/check.cpp"),
                null,
                null,
                List.of(testCase()));

        assertThat(analyzer.analyze(pkg).result()).isEqualTo(CompatibilityResult.UNSUPPORTED);
        assertThat(analyzer.analyze(pkg).issues()).anyMatch(issue -> issue.type().equals("CUSTOM_CHECKER"));
    }

    @Test
    void returnsSemiPortableWhenOnlyPdfIsMissingButFallbackExists() {
        DiscoveredPackage pkg = packageWith(
                Path.of("problem.xml"),
                null,
                null,
                Path.of("statements/english/problem.tex"),
                null,
                List.of(testCase()));

        assertThat(analyzer.analyze(pkg).result()).isEqualTo(CompatibilityResult.SEMI_PORTABLE);
    }

    @Test
    void returnsUnsupportedWhenProblemXmlIsMissing() {
        DiscoveredPackage pkg = packageWith(
                null,
                Path.of("statements/english/problem.pdf"),
                null,
                null,
                null,
                List.of(testCase()));

        assertThat(analyzer.analyze(pkg).result()).isEqualTo(CompatibilityResult.UNSUPPORTED);
    }

    @Test
    void returnsSemiPortableWhenGeneratorExistsButPrecomputedTestsExist() {
        DiscoveredPackage pkg = packageWith(
                Path.of("problem.xml"),
                null,
                null,
                Path.of("statements/english/problem.tex"),
                Path.of("files/random.cpp"),
                List.of(testCase()));

        assertThat(analyzer.analyze(pkg).result()).isEqualTo(CompatibilityResult.SEMI_PORTABLE);
        assertThat(analyzer.analyze(pkg).issues()).anyMatch(issue -> issue.type().equals("GENERATOR_PRESENT"));
    }

    private static DiscoveredPackage packageWith(
            Path problemXml,
            Path statementPdf,
            Path checker,
            Path fallback,
            Path generator,
            List<DiscoveredTestCase> tests
    ) {
        Path root = Path.of("");
        ParsedProblemXml parsed = new ParsedProblemXml(ProblemMeta.defaults(), false, null, null, List.of());
        return new DiscoveredPackage(root, List.of(), problemXml, parsed, statementPdf, fallback, checker, null, generator, false, tests);
    }

    private static DiscoveredTestCase testCase() {
        return new DiscoveredTestCase(1, Path.of("tests/001.in"), Path.of("tests/001.out"), false);
    }
}
