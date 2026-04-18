package com.polygon2goorm.domain.model;

public record Issue(
        String type,
        Severity severity,
        String message,
        String path
) {
    public static Issue high(String type, String message, String path) {
        return new Issue(type, Severity.HIGH, message, path);
    }

    public static Issue medium(String type, String message, String path) {
        return new Issue(type, Severity.MEDIUM, message, path);
    }

    public static Issue low(String type, String message, String path) {
        return new Issue(type, Severity.LOW, message, path);
    }
}
