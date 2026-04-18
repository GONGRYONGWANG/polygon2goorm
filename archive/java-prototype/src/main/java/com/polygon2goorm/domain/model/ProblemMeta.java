package com.polygon2goorm.domain.model;

import java.util.List;

public record ProblemMeta(
        String title,
        String source,
        int timeLimitMs,
        int memoryLimitMb,
        String inputMethod,
        String outputMethod,
        String inputFile,
        String outputFile,
        List<String> languages
) {
    public static ProblemMeta defaults() {
        return new ProblemMeta("Untitled Problem", "Polygon", 0, 0, "stdin", "stdout", null, null, List.of());
    }
}
