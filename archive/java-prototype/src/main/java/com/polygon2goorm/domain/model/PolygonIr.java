package com.polygon2goorm.domain.model;

import java.util.List;

public record PolygonIr(
        ProblemMeta meta,
        StatementInfo statement,
        List<SampleCase> samples,
        TestSuite tests,
        JudgeInfo judge,
        CompatibilityInfo compatibility
) {
}
