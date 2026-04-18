package com.polygon2goorm.infrastructure.writer;

import com.polygon2goorm.common.AppException;
import com.polygon2goorm.common.JsonSupport;
import com.polygon2goorm.domain.model.DiscoveredPackage;
import com.polygon2goorm.domain.model.PolygonIr;
import com.polygon2goorm.domain.model.Report;
import com.polygon2goorm.domain.service.GoormManifestBuilder;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Comparator;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

public class OutputWriter {
    private static final int MAX_GOORM_TEST_FILES = 60;
    private static final long MAX_GOORM_CASE_FILE_BYTES = 30L * 1024L * 1024L;
    private static final long MAX_GOORM_ZIP_CONTENT_BYTES = 180L * 1024L * 1024L;

    private final GoormManifestBuilder goormManifestBuilder;
    private final StatementTextExporter statementTextExporter;

    public OutputWriter(GoormManifestBuilder goormManifestBuilder) {
        this(goormManifestBuilder, new StatementTextExporter());
    }

    public OutputWriter(GoormManifestBuilder goormManifestBuilder, StatementTextExporter statementTextExporter) {
        this.goormManifestBuilder = goormManifestBuilder;
        this.statementTextExporter = statementTextExporter;
    }

    public void write(Path outputDir, DiscoveredPackage discoveredPackage, PolygonIr ir, Report report) {
        try {
            Files.createDirectories(outputDir);
            Path testsDir = outputDir.resolve("tests");
            recreateDirectory(testsDir);
            validateGoormTestLimits(discoveredPackage);
            Files.deleteIfExists(outputDir.resolve("statement.pdf"));

            boolean statementHtmlAvailable = statementTextExporter.export(
                    discoveredPackage.statementFallback(),
                    outputDir.resolve("statement.html"),
                    outputDir.resolve("statement.txt"));
            for (var test : discoveredPackage.tests()) {
                Files.copy(test.inputPath(), testsDir.resolve("input.%d.txt".formatted(test.id())), StandardCopyOption.REPLACE_EXISTING);
                Files.copy(test.answerPath(), testsDir.resolve("output.%d.txt".formatted(test.id())), StandardCopyOption.REPLACE_EXISTING);
            }
            writeGoormTestZip(testsDir, outputDir.resolve("goorm-testcases.zip"), discoveredPackage);

            JsonSupport.mapper().writeValue(outputDir.resolve("ir.json").toFile(), ir);
            Map<String, Object> goorm = goormManifestBuilder.build(ir);
            if (statementHtmlAvailable) {
                @SuppressWarnings("unchecked")
                Map<String, Object> content = (Map<String, Object>) goorm.get("content");
                content.put("statementHtml", "statement.html");
                content.put("statementText", "statement.txt");
            }
            JsonSupport.mapper().writeValue(outputDir.resolve("goorm.json").toFile(), goorm);
            JsonSupport.mapper().writeValue(outputDir.resolve("report.json").toFile(), report);
            Files.writeString(outputDir.resolve("README.md"), readme(ir, report));
        } catch (IOException e) {
            throw new AppException("Could not write conversion output to: " + outputDir, e);
        }
    }

    private static String readme(PolygonIr ir, Report report) {
        return """
                # polygon2goorm Output

                ## Problem

                - Title: %s
                - Compatibility: %s
                - Tests: %d

                ## Files

                - `statement.html`: HTML statement fragment for goorm editor paste.
                - `statement.txt`: plain-text fallback extracted from the HTML statement.
                - `tests/`: normalized testcase input/output pairs using goorm names.
                - `goorm-testcases.zip`: testcase ZIP ready for goorm upload.
                - `ir.json`: internal representation used by polygon2goorm.
                - `goorm.json`: helper manifest for manual goorm upload.
                - `report.json`: compatibility analysis.

                ## Notes

                v1 supports FULL Polygon packages with precomputed stdin/stdout tests only.
                Custom checkers, interactive problems, and generator-dependent packages are unsupported.
                Sample tests are marked through `input_output_example_set` in `goorm.json`.
                """.formatted(ir.meta().title(), report.result(), ir.tests().tests().size());
    }

    private static void validateGoormTestLimits(DiscoveredPackage discoveredPackage) throws IOException {
        int fileCount = discoveredPackage.tests().size() * 2;
        if (fileCount > MAX_GOORM_TEST_FILES) {
            throw new AppException("Goorm testcase upload allows at most 60 files. This package has " + fileCount + " input/output files.");
        }

        long totalBytes = 0;
        for (var test : discoveredPackage.tests()) {
            long inputSize = Files.size(test.inputPath());
            long outputSize = Files.size(test.answerPath());
            if (inputSize > MAX_GOORM_CASE_FILE_BYTES) {
                throw new AppException("Goorm testcase file exceeds 30MB: " + test.inputPath());
            }
            if (outputSize > MAX_GOORM_CASE_FILE_BYTES) {
                throw new AppException("Goorm testcase file exceeds 30MB: " + test.answerPath());
            }
            totalBytes += inputSize + outputSize;
        }
        if (totalBytes > MAX_GOORM_ZIP_CONTENT_BYTES) {
            throw new AppException("Goorm testcase ZIP content exceeds 180MB before compression.");
        }
    }

    private static void writeGoormTestZip(Path testsDir, Path zipPath, DiscoveredPackage discoveredPackage) throws IOException {
        try (ZipOutputStream zip = new ZipOutputStream(Files.newOutputStream(zipPath))) {
            for (var test : discoveredPackage.tests()) {
                addZipEntry(zip, testsDir.resolve("input.%d.txt".formatted(test.id())), "input.%d.txt".formatted(test.id()));
                addZipEntry(zip, testsDir.resolve("output.%d.txt".formatted(test.id())), "output.%d.txt".formatted(test.id()));
            }
        }
    }

    private static void addZipEntry(ZipOutputStream zip, Path path, String entryName) throws IOException {
        zip.putNextEntry(new ZipEntry(entryName));
        Files.copy(path, zip);
        zip.closeEntry();
    }

    private static void recreateDirectory(Path directory) throws IOException {
        if (Files.exists(directory)) {
            try (var paths = Files.walk(directory)) {
                for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) {
                    Files.delete(path);
                }
            }
        }
        Files.createDirectories(directory);
    }
}
