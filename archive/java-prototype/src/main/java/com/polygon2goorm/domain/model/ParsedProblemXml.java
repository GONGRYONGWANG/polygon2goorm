package com.polygon2goorm.domain.model;

import java.util.List;

public record ParsedProblemXml(
        ProblemMeta meta,
        boolean interactiveHint,
        String checkerName,
        String checkerSourcePath,
        List<Integer> sampleTestIndexes
) {
}
