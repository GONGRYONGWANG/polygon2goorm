package com.polygon2goorm.infrastructure.parser;

import com.polygon2goorm.domain.model.ParsedProblemXml;
import com.polygon2goorm.domain.model.ProblemMeta;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilderFactory;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class ProblemXmlParser {
    public ParsedProblemXml parse(Path problemXml) {
        if (problemXml == null || !Files.isRegularFile(problemXml)) {
            return new ParsedProblemXml(ProblemMeta.defaults(), false, null, null, List.of());
        }
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            Document document = factory.newDocumentBuilder().parse(problemXml.toFile());
            Element root = document.getDocumentElement();

            String title = firstNonBlank(
                    attribute(root, "short-name"),
                    attribute(root, "name"),
                    textOfFirst(document, "name"),
                    textOfFirst(document, "title"),
                    "Untitled Problem");
            int timeLimitMs = parseInt(firstNonBlank(
                    textOfFirst(document, "time-limit"),
                    attribute(root, "time-limit"),
                    attributeOfFirstElementWithAttribute(document, "time-limit")), 0);
            int memoryLimitMb = memoryToMb(firstNonBlank(
                    textOfFirst(document, "memory-limit"),
                    attribute(root, "memory-limit"),
                    attributeOfFirstElementWithAttribute(document, "memory-limit")));
            String inputFile = blankToNull(firstNonBlank(
                    textOfFirst(document, "input-file"),
                    attribute(root, "input-file"),
                    attributeOfFirstElementWithAttribute(document, "input-file")));
            String outputFile = blankToNull(firstNonBlank(
                    textOfFirst(document, "output-file"),
                    attribute(root, "output-file"),
                    attributeOfFirstElementWithAttribute(document, "output-file")));
            String checker = blankToNull(firstNonBlank(
                    attribute(root, "checker"),
                    attributeOfFirstElementWithAttribute(document, "checker"),
                    attributeOfFirstNamedElement(document, "checker", "name"),
                    textOfFirst(document, "checker")));
            String checkerSourcePath = checkerSourcePath(document);
            boolean interactive = containsIgnoreCase(root.getTextContent(), "interactive")
                    || containsIgnoreCase(attribute(root, "type"), "interactive");

            String inputMethod = inputFile == null ? "stdin" : "file";
            String outputMethod = outputFile == null ? "stdout" : "file";
            ProblemMeta meta = new ProblemMeta(title, "Polygon", timeLimitMs, memoryLimitMb,
                    inputMethod, outputMethod, inputFile, outputFile, List.of());
            return new ParsedProblemXml(meta, interactive, checker, checkerSourcePath, sampleTestIndexes(document));
        } catch (Exception e) {
            return new ParsedProblemXml(ProblemMeta.defaults(), false, null, null, List.of());
        }
    }

    private static String textOfFirst(Document document, String tagName) {
        NodeList nodes = document.getElementsByTagName(tagName);
        if (nodes.getLength() == 0) {
            return null;
        }
        return nodes.item(0).getTextContent();
    }

    private static String attribute(Element element, String name) {
        if (element == null || !element.hasAttribute(name)) {
            return null;
        }
        return element.getAttribute(name);
    }

    private static String attributeOfFirstElementWithAttribute(Document document, String attributeName) {
        NodeList nodes = document.getElementsByTagName("*");
        for (int i = 0; i < nodes.getLength(); i++) {
            if (nodes.item(i) instanceof Element element && element.hasAttribute(attributeName)) {
                return element.getAttribute(attributeName);
            }
        }
        return null;
    }

    private static String attributeOfFirstNamedElement(Document document, String tagName, String attributeName) {
        NodeList nodes = document.getElementsByTagName(tagName);
        for (int i = 0; i < nodes.getLength(); i++) {
            if (nodes.item(i) instanceof Element element && element.hasAttribute(attributeName)) {
                return element.getAttribute(attributeName);
            }
        }
        return null;
    }

    private static String checkerSourcePath(Document document) {
        NodeList checkers = document.getElementsByTagName("checker");
        if (checkers.getLength() == 0 || !(checkers.item(0) instanceof Element checker)) {
            return null;
        }
        NodeList children = checker.getElementsByTagName("source");
        if (children.getLength() == 0 || !(children.item(0) instanceof Element source)) {
            return null;
        }
        return source.getAttribute("path");
    }

    private static List<Integer> sampleTestIndexes(Document document) {
        List<Integer> indexes = new ArrayList<>();
        NodeList tests = document.getElementsByTagName("test");
        for (int i = 0; i < tests.getLength(); i++) {
            if (tests.item(i) instanceof Element element
                    && "true".equalsIgnoreCase(element.getAttribute("sample"))) {
                indexes.add(i + 1);
            }
        }
        return List.copyOf(indexes);
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static int parseInt(String value, int fallback) {
        if (value == null) {
            return fallback;
        }
        String digits = value.replaceAll("[^0-9]", "");
        if (digits.isBlank()) {
            return fallback;
        }
        return Integer.parseInt(digits);
    }

    private static int memoryToMb(String value) {
        if (value == null || value.isBlank()) {
            return 0;
        }
        String normalized = value.toLowerCase(Locale.ROOT);
        int amount = parseInt(normalized, 0);
        if (normalized.contains("kb")) {
            return Math.max(1, amount / 1024);
        }
        if (normalized.contains("gb")) {
            return amount * 1024;
        }
        if (amount > 4096 && !normalized.contains("mb")) {
            return Math.max(1, amount / 1024 / 1024);
        }
        return amount;
    }

    private static boolean containsIgnoreCase(String value, String token) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(token.toLowerCase(Locale.ROOT));
    }
}
