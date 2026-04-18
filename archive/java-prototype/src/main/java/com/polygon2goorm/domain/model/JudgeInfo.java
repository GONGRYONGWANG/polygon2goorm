package com.polygon2goorm.domain.model;

public record JudgeInfo(
        FeaturePresence checker,
        FeaturePresence validator,
        FeaturePresence generator,
        boolean interactive
) {
}
