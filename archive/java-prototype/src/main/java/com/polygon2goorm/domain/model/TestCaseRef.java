package com.polygon2goorm.domain.model;

public record TestCaseRef(
        int id,
        String inputPath,
        String answerPath,
        boolean sample
) {
}
