package com.polygon2goorm.domain.model;

import java.util.List;

public record CompatibilityInfo(
        CompatibilityResult result,
        List<String> warnings,
        List<String> unsupportedFeatures
) {
}
