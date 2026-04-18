package com.polygon2goorm.domain.model;

public record FeaturePresence(
        boolean present,
        String path
) {
    public static FeaturePresence absent() {
        return new FeaturePresence(false, null);
    }

    public static FeaturePresence present(String path) {
        return new FeaturePresence(true, path);
    }
}
