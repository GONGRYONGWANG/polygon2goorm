package com.polygon2goorm.domain.model;

import java.nio.file.Path;

public record DiscoveredTestCase(
        int id,
        Path inputPath,
        Path answerPath,
        boolean sample
) {
}
