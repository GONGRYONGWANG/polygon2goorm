package com.polygon2goorm.infrastructure.parser;

import com.polygon2goorm.domain.model.DiscoveredPackage;
import com.polygon2goorm.infrastructure.filesystem.FileDiscovery;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class PackageScannerTest {
    @TempDir
    Path tempDir;

    @Test
    void discoversProblemXmlStatementPdfCheckerAndTestsWithoutFixedPaths() throws Exception {
        Path meta = Files.createDirectories(tempDir.resolve("meta"));
        Files.writeString(meta.resolve("problem.xml"), "<problem short-name=\"A\"><time-limit>2000</time-limit></problem>");
        Path en = Files.createDirectories(tempDir.resolve("random/statements/english"));
        Files.writeString(en.resolve("statement.pdf"), "fake pdf");
        Path tests = Files.createDirectories(tempDir.resolve("another-place/tests"));
        Files.writeString(tests.resolve("01.in"), "1\n");
        Files.writeString(tests.resolve("01.out"), "1\n");
        Path checkers = Files.createDirectories(tempDir.resolve("tools/checkers"));
        Files.writeString(checkers.resolve("checker.cpp"), "int main(){}\n");

        PackageScanner scanner = new PackageScanner(new FileDiscovery(), new ProblemXmlParser(), new TestCaseMatcher());
        DiscoveredPackage result = scanner.scan(tempDir);

        assertThat(result.problemXml().getFileName().toString()).isEqualTo("problem.xml");
        assertThat(result.statementPdf().getFileName().toString()).isEqualTo("statement.pdf");
        assertThat(result.checker().getFileName().toString()).isEqualTo("checker.cpp");
        assertThat(result.tests()).hasSize(1);
        assertThat(result.meta().title()).isEqualTo("A");
    }

    @Test
    void doesNotTreatBuiltInPolygonCheckerNameAsCustomChecker() throws Exception {
        Files.writeString(tempDir.resolve("problem.xml"), """
                <problem short-name="B">
                  <checker name="std::ncmp.cpp"/>
                  <judging>
                    <testset time-limit="1000" memory-limit="268435456"/>
                  </judging>
                </problem>
                """);
        Path statements = Files.createDirectories(tempDir.resolve("statements/en"));
        Files.writeString(statements.resolve("problem.pdf"), "fake pdf");
        Path tests = Files.createDirectories(tempDir.resolve("tests"));
        Files.writeString(tests.resolve("1.in"), "1\n");
        Files.writeString(tests.resolve("1.out"), "1\n");

        PackageScanner scanner = new PackageScanner(new FileDiscovery(), new ProblemXmlParser(), new TestCaseMatcher());
        DiscoveredPackage result = scanner.scan(tempDir);

        assertThat(result.checker()).isNull();
        assertThat(result.meta().timeLimitMs()).isEqualTo(1000);
        assertThat(result.meta().memoryLimitMb()).isEqualTo(256);
    }

    @Test
    void ignoresStandardCheckerFilesWhenProblemXmlDeclaresStandardChecker() throws Exception {
        Files.writeString(tempDir.resolve("problem.xml"), """
                <problem short-name="C">
                  <assets>
                    <checker name="std::ncmp.cpp" type="testlib">
                      <source path="files/check.cpp"/>
                    </checker>
                  </assets>
                </problem>
                """);
        Path files = Files.createDirectories(tempDir.resolve("files"));
        Files.writeString(files.resolve("check.cpp"), "standard checker copy\n");
        Path tests = Files.createDirectories(tempDir.resolve("tests"));
        Files.writeString(tests.resolve("01"), "1\n");
        Files.writeString(tests.resolve("01.a"), "1\n");

        PackageScanner scanner = new PackageScanner(new FileDiscovery(), new ProblemXmlParser(), new TestCaseMatcher());
        DiscoveredPackage result = scanner.scan(tempDir);

        assertThat(result.checker()).isNull();
        assertThat(result.tests()).hasSize(1);
    }

    @Test
    void treatsNonExactStandardCheckerAsUnsupportedCheckerFeature() throws Exception {
        Files.writeString(tempDir.resolve("problem.xml"), """
                <problem short-name="R">
                  <assets>
                    <checker name="std::rcmp6.cpp" type="testlib">
                      <source path="files/check.cpp"/>
                    </checker>
                  </assets>
                </problem>
                """);
        Path files = Files.createDirectories(tempDir.resolve("files"));
        Files.writeString(files.resolve("check.cpp"), "relative error checker\n");
        Path tests = Files.createDirectories(tempDir.resolve("tests"));
        Files.writeString(tests.resolve("01"), "1\n");
        Files.writeString(tests.resolve("01.a"), "1\n");

        PackageScanner scanner = new PackageScanner(new FileDiscovery(), new ProblemXmlParser(), new TestCaseMatcher());
        DiscoveredPackage result = scanner.scan(tempDir);

        assertThat(result.checker()).endsWith(Path.of("files/check.cpp"));
    }

    @Test
    void appliesSampleMetadataFromProblemXmlTestOrder() throws Exception {
        Files.writeString(tempDir.resolve("problem.xml"), """
                <problem short-name="D">
                  <judging>
                    <testset>
                      <tests>
                        <test method="manual" sample="true"/>
                        <test method="manual"/>
                      </tests>
                    </testset>
                  </judging>
                </problem>
                """);
        Path tests = Files.createDirectories(tempDir.resolve("tests"));
        Files.writeString(tests.resolve("01"), "1\n");
        Files.writeString(tests.resolve("01.a"), "1\n");
        Files.writeString(tests.resolve("02"), "2\n");
        Files.writeString(tests.resolve("02.a"), "2\n");

        PackageScanner scanner = new PackageScanner(new FileDiscovery(), new ProblemXmlParser(), new TestCaseMatcher());
        DiscoveredPackage result = scanner.scan(tempDir);

        assertThat(result.tests()).hasSize(2);
        assertThat(result.tests().get(0).sample()).isTrue();
        assertThat(result.tests().get(1).sample()).isFalse();
    }
}
