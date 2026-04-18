package com.polygon2goorm.domain.service;

import com.polygon2goorm.domain.analysis.CapabilityAnalyzer;
import com.polygon2goorm.domain.model.DiscoveredPackage;
import com.polygon2goorm.domain.model.FeaturePresence;
import com.polygon2goorm.domain.model.JudgeInfo;
import com.polygon2goorm.domain.model.PolygonIr;
import com.polygon2goorm.domain.model.Report;
import com.polygon2goorm.domain.model.SampleCase;
import com.polygon2goorm.domain.model.StatementInfo;
import com.polygon2goorm.domain.model.TestCaseRef;
import com.polygon2goorm.domain.model.TestSuite;

import java.nio.file.Path;
import java.util.List;

public class PolygonIrBuilder {
    private final CapabilityAnalyzer analyzer;

    public PolygonIrBuilder(CapabilityAnalyzer analyzer) {
        this.analyzer = analyzer;
    }

    public PolygonIr build(DiscoveredPackage discoveredPackage, Report report) {
        String title = discoveredPackage.meta().title();
        StatementInfo statement = new StatementInfo(
                title,
                rel(discoveredPackage, discoveredPackage.statementPdf()),
                rel(discoveredPackage, discoveredPackage.statementFallback()),
                List.of());
        List<TestCaseRef> tests = discoveredPackage.tests().stream()
                .map(test -> new TestCaseRef(test.id(), rel(discoveredPackage, test.inputPath()), rel(discoveredPackage, test.answerPath()), test.sample()))
                .toList();
        JudgeInfo judge = new JudgeInfo(
                presence(discoveredPackage, discoveredPackage.checker()),
                presence(discoveredPackage, discoveredPackage.validator()),
                presence(discoveredPackage, discoveredPackage.generator()),
                discoveredPackage.interactiveHint());
        return new PolygonIr(discoveredPackage.meta(), statement, List.of(), new TestSuite(tests), judge, analyzer.compatibility(report));
    }

    private static FeaturePresence presence(DiscoveredPackage pkg, Path path) {
        return path == null ? FeaturePresence.absent() : FeaturePresence.present(rel(pkg, path));
    }

    private static String rel(DiscoveredPackage pkg, Path path) {
        return path == null ? null : pkg.root().relativize(path).toString().replace('\\', '/');
    }
}
