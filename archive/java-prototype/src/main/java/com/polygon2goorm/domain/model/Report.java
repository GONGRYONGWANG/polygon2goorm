package com.polygon2goorm.domain.model;

import java.util.List;

public record Report(
        CompatibilityResult result,
        List<Issue> issues,
        List<String> suggestions
) {
}
