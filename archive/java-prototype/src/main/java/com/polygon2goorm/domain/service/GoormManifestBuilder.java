package com.polygon2goorm.domain.service;

import com.polygon2goorm.domain.model.PolygonIr;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class GoormManifestBuilder {
    public Map<String, Object> build(PolygonIr ir) {
        Map<String, Object> content = new LinkedHashMap<>();
        content.put("title", ir.meta().title());
        content.put("statementHtml", null);
        content.put("statementText", null);
        content.put("source", ir.meta().source());

        Map<String, Object> limits = new LinkedHashMap<>();
        limits.put("timeLimitMs", ir.meta().timeLimitMs());
        limits.put("memoryLimitMb", ir.meta().memoryLimitMb());

        List<Map<String, Object>> cases = ir.tests().tests().stream()
                .map(test -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("inputFile", "tests/input.%d.txt".formatted(test.id()));
                    item.put("outputFile", "tests/output.%d.txt".formatted(test.id()));
                    item.put("isSample", test.sample());
                    return item;
                })
                .toList();
        List<String> exampleSet = ir.tests().tests().stream()
                .map(test -> test.sample() ? "true" : "false")
                .toList();

        Map<String, Object> judgeOptions = new LinkedHashMap<>();
        judgeOptions.put("ignoreWhitespace", false);
        judgeOptions.put("ignoreCase", false);
        judgeOptions.put("useRegex", false);

        Map<String, Object> manifest = new LinkedHashMap<>();
        manifest.put("content", content);
        manifest.put("limits", limits);
        manifest.put("testcaseZip", "goorm-testcases.zip");
        manifest.put("judgeCases", cases);
        manifest.put("input_output_example_set", exampleSet);
        manifest.put("judgeOptions", judgeOptions);
        return manifest;
    }
}
