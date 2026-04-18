package com.polygon2goorm.application;

import com.polygon2goorm.domain.model.DiscoveredPackage;
import com.polygon2goorm.domain.model.PolygonIr;
import com.polygon2goorm.domain.model.Report;

public record InspectResult(
        DiscoveredPackage discoveredPackage,
        PolygonIr ir,
        Report report
) {
}
