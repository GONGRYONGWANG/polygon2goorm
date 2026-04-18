package com.polygon2goorm.application;

import com.polygon2goorm.domain.analysis.CapabilityAnalyzer;
import com.polygon2goorm.domain.model.DiscoveredPackage;
import com.polygon2goorm.domain.model.PolygonIr;
import com.polygon2goorm.domain.model.Report;
import com.polygon2goorm.domain.service.PolygonIrBuilder;
import com.polygon2goorm.infrastructure.filesystem.FileDiscovery;
import com.polygon2goorm.infrastructure.parser.PackageScanner;
import com.polygon2goorm.infrastructure.parser.ProblemXmlParser;
import com.polygon2goorm.infrastructure.parser.TestCaseMatcher;
import com.polygon2goorm.infrastructure.zip.ZipExtractor;

import java.nio.file.Path;

public class InspectUseCase {
    private final ZipExtractor zipExtractor;
    private final PackageScanner packageScanner;
    private final CapabilityAnalyzer capabilityAnalyzer;
    private final PolygonIrBuilder irBuilder;

    public InspectUseCase() {
        this(new ZipExtractor(),
                new PackageScanner(new FileDiscovery(), new ProblemXmlParser(), new TestCaseMatcher()),
                new CapabilityAnalyzer());
    }

    public InspectUseCase(ZipExtractor zipExtractor, PackageScanner packageScanner, CapabilityAnalyzer capabilityAnalyzer) {
        this.zipExtractor = zipExtractor;
        this.packageScanner = packageScanner;
        this.capabilityAnalyzer = capabilityAnalyzer;
        this.irBuilder = new PolygonIrBuilder(capabilityAnalyzer);
    }

    public InspectResult inspect(Path zipPath) {
        Path root = zipExtractor.extract(zipPath);
        DiscoveredPackage discoveredPackage = packageScanner.scan(root);
        Report report = capabilityAnalyzer.analyze(discoveredPackage);
        PolygonIr ir = irBuilder.build(discoveredPackage, report);
        return new InspectResult(discoveredPackage, ir, report);
    }
}
