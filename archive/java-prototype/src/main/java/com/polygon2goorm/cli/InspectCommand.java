package com.polygon2goorm.cli;

import com.polygon2goorm.application.InspectResult;
import com.polygon2goorm.application.InspectUseCase;
import com.polygon2goorm.common.JsonSupport;
import com.polygon2goorm.domain.model.Issue;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;
import picocli.CommandLine.Parameters;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.Callable;

@Command(name = "inspect", description = "Inspect a Polygon FULL package ZIP and report v1 compatibility.")
public class InspectCommand implements Callable<Integer> {
    @Parameters(index = "0", description = "Polygon FULL package ZIP path")
    private Path zipPath;

    @Option(names = "--report", description = "Optional path to write report.json")
    private Path reportPath;

    @Override
    public Integer call() throws Exception {
        InspectResult result = new InspectUseCase().inspect(zipPath);
        System.out.println("Result: " + result.report().result());
        System.out.println("Title: " + result.ir().meta().title());
        System.out.println("Statement HTML/Text: " + pathStatus(result.discoveredPackage().root(), result.discoveredPackage().statementFallback()));
        System.out.println("Tests: " + result.discoveredPackage().tests().size() + " pairs");
        System.out.println("Checker: " + pathStatus(result.discoveredPackage().root(), result.discoveredPackage().checker()));
        System.out.println("Generator: " + pathStatus(result.discoveredPackage().root(), result.discoveredPackage().generator()));
        System.out.println("Warnings: " + result.report().issues().stream().filter(issue -> issue.severity() != com.polygon2goorm.domain.model.Severity.HIGH).count());
        for (Issue issue : result.report().issues()) {
            System.out.println("- [" + issue.severity() + "] " + issue.type() + ": " + issue.message());
        }
        if (reportPath != null) {
            if (reportPath.getParent() != null) {
                Files.createDirectories(reportPath.getParent());
            }
            JsonSupport.mapper().writeValue(reportPath.toFile(), result.report());
        }
        return 0;
    }

    private static String pathStatus(Path root, Path path) {
        if (path == null) {
            return "not found";
        }
        return "found (" + root.relativize(path).toString().replace('\\', '/') + ")";
    }
}
