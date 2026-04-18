package com.polygon2goorm.infrastructure.parser;

import com.polygon2goorm.domain.model.DiscoveredTestCase;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TestCaseMatcherTest {
    @TempDir
    Path tempDir;

    @Test
    void matchesInputOutputPairsByStem() throws Exception {
        Path tests = Files.createDirectories(tempDir.resolve("tests"));
        Path input = Files.writeString(tests.resolve("001.in"), "1 2\n");
        Path output = Files.writeString(tests.resolve("001.out"), "3\n");
        Files.writeString(tests.resolve("note.txt"), "ignore me\n");

        List<DiscoveredTestCase> result = new TestCaseMatcher().match(tempDir, List.of(input, output, tests.resolve("note.txt")));

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().inputPath()).isEqualTo(input);
        assertThat(result.getFirst().answerPath()).isEqualTo(output);
        assertThat(result.getFirst().sample()).isFalse();
    }

    @Test
    void treatsSamplePathAsSample() throws Exception {
        Path samples = Files.createDirectories(tempDir.resolve("samples"));
        Path input = Files.writeString(samples.resolve("sample01.in"), "1\n");
        Path output = Files.writeString(samples.resolve("sample01.ans"), "1\n");

        List<DiscoveredTestCase> result = new TestCaseMatcher().match(tempDir, List.of(input, output));

        assertThat(result).singleElement().extracting(DiscoveredTestCase::sample).isEqualTo(true);
    }
}
