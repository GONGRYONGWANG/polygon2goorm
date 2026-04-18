package com.polygon2goorm.domain.model;

import java.util.List;

public record StatementInfo(
        String title,
        String pdfPath,
        String fallbackTextPath,
        List<String> assets
) {
}
