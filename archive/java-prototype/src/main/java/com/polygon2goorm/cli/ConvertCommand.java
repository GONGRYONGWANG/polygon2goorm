package com.polygon2goorm.cli;

import com.polygon2goorm.application.ConvertUseCase;
import com.polygon2goorm.application.InspectResult;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;
import picocli.CommandLine.Parameters;

import java.nio.file.Path;
import java.util.concurrent.Callable;

@Command(name = "convert", description = "Convert a v1-compatible Polygon FULL package ZIP into goorm helper output.")
public class ConvertCommand implements Callable<Integer> {
    @Parameters(index = "0", description = "Polygon FULL package ZIP path")
    private Path zipPath;

    @Option(names = {"-o", "--output"}, required = true, description = "Output directory")
    private Path outputDir;

    @Option(names = "--force-semi-portable", description = "Allow conversion when inspect reports SEMI_PORTABLE")
    private boolean forceSemiPortable;

    @Override
    public Integer call() {
        InspectResult result = new ConvertUseCase().convert(zipPath, outputDir, forceSemiPortable);
        System.out.println("Result: " + result.report().result());
        System.out.println("Wrote output: " + outputDir.toAbsolutePath());
        System.out.println("Tests: " + result.ir().tests().tests().size());
        return 0;
    }
}
