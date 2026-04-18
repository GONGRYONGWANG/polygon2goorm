package com.polygon2goorm.infrastructure.parser;

import com.polygon2goorm.domain.model.DiscoveredTestCase;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

public class TestCaseMatcher {
    public List<DiscoveredTestCase> match(Path root, List<Path> files) {
        List<Path> inputs = files.stream().filter(path -> isInputCandidate(root, path)).toList();
        List<Path> answers = files.stream().filter(path -> isAnswerCandidate(root, path)).toList();
        Set<Path> usedAnswers = new HashSet<>();
        List<DiscoveredTestCase> pairs = new ArrayList<>();

        for (Path input : inputs) {
            Path answer = answers.stream()
                    .filter(candidate -> !usedAnswers.contains(candidate))
                    .min(Comparator.comparingInt(candidate -> distance(root, input, candidate)))
                    .orElse(null);
            if (answer != null && distance(root, input, answer) <= 4) {
                usedAnswers.add(answer);
                pairs.add(new DiscoveredTestCase(pairs.size() + 1, input, answer, looksSample(root, input)));
            }
        }
        return pairs;
    }

    private static boolean isInputCandidate(Path root, Path path) {
        String relative = root.relativize(path).toString().replace('\\', '/').toLowerCase(Locale.ROOT);
        String fileName = path.getFileName().toString().toLowerCase(Locale.ROOT);
        if (isNonJudgeTestArea(relative)) {
            return false;
        }
        return fileName.endsWith(".in")
                || fileName.matches("[0-9]+")
                || fileName.matches("input[0-9._-]*")
                || fileName.matches("[0-9]+\\.input");
    }

    private static boolean isAnswerCandidate(Path root, Path path) {
        String relative = root.relativize(path).toString().replace('\\', '/').toLowerCase(Locale.ROOT);
        String fileName = path.getFileName().toString().toLowerCase(Locale.ROOT);
        if (isNonJudgeTestArea(relative)) {
            return false;
        }
        return fileName.endsWith(".out")
                || fileName.endsWith(".ans")
                || fileName.endsWith(".a")
                || fileName.matches("answer[0-9._-]*")
                || fileName.matches("[0-9]+\\.answer");
    }

    private static boolean isNonJudgeTestArea(String relative) {
        return relative.contains("/statements/")
                || relative.contains("/statement/")
                || relative.contains("statement-sections/")
                || relative.contains("validator-tests/")
                || relative.contains("checker-tests/")
                || relative.contains("stresses/");
    }

    private static int distance(Path root, Path input, Path answer) {
        String inputStem = stem(input.getFileName().toString());
        String answerStem = stem(answer.getFileName().toString());
        int score = inputStem.equals(answerStem) ? 0 : 2;
        if (!input.getParent().equals(answer.getParent())) {
            Path inputParent = root.relativize(input.getParent());
            Path answerParent = root.relativize(answer.getParent());
            score += inputParent.getFileName() != null && answerParent.getFileName() != null
                    && inputParent.getFileName().toString().equalsIgnoreCase(answerParent.getFileName().toString())
                    ? 1
                    : 2;
        }
        return score;
    }

    private static String stem(String fileName) {
        String lower = fileName.toLowerCase(Locale.ROOT);
        return lower.replaceFirst("\\.(in|out|ans|a|input|answer)$", "")
                .replaceFirst("^(input|answer)[._-]?", "");
    }

    private static boolean looksSample(Path root, Path path) {
        String relative = root.relativize(path).toString().replace('\\', '/').toLowerCase(Locale.ROOT);
        return relative.contains("sample") || relative.contains("examples");
    }
}
