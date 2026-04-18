package com.polygon2goorm.domain.model;

import java.nio.file.Path;
import java.util.List;

public record DiscoveredPackage(
        Path root,
        List<Path> files,
        Path problemXml,
        ParsedProblemXml parsedProblemXml,
        Path statementPdf,
        Path statementFallback,
        Path checker,
        Path validator,
        Path generator,
        boolean interactiveHint,
        List<DiscoveredTestCase> tests
) {
    public ProblemMeta meta() {
        return parsedProblemXml == null ? ProblemMeta.defaults() : parsedProblemXml.meta();
    }
}
