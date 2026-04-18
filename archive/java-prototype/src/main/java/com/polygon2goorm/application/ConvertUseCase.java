package com.polygon2goorm.application;

import com.polygon2goorm.common.AppException;
import com.polygon2goorm.domain.model.CompatibilityResult;
import com.polygon2goorm.domain.service.GoormManifestBuilder;
import com.polygon2goorm.infrastructure.writer.OutputWriter;

import java.nio.file.Path;

public class ConvertUseCase {
    private final InspectUseCase inspectUseCase;
    private final OutputWriter outputWriter;

    public ConvertUseCase() {
        this(new InspectUseCase(), new OutputWriter(new GoormManifestBuilder()));
    }

    public ConvertUseCase(InspectUseCase inspectUseCase, OutputWriter outputWriter) {
        this.inspectUseCase = inspectUseCase;
        this.outputWriter = outputWriter;
    }

    public InspectResult convert(Path zipPath, Path outputDir, boolean forceSemiPortable) {
        InspectResult result = inspectUseCase.inspect(zipPath);
        if (result.report().result() == CompatibilityResult.UNSUPPORTED) {
            throw new AppException("Package is unsupported in v1. Run inspect for details.");
        }
        if (result.report().result() == CompatibilityResult.SEMI_PORTABLE && !forceSemiPortable) {
            throw new AppException("Package is semi-portable. Re-run with --force-semi-portable after reviewing inspect output.");
        }
        outputWriter.write(outputDir, result.discoveredPackage(), result.ir(), result.report());
        return result;
    }
}
