package com.polygon2goorm.infrastructure.writer;

import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.net.URLEncoder;

public class StatementTextExporter {
    public boolean export(Path fallbackStatement, Path outputHtml, Path outputText) throws IOException {
        if (fallbackStatement == null || !Files.isRegularFile(fallbackStatement)) {
            return false;
        }
        if (!isHtml(fallbackStatement)) {
            Files.copy(fallbackStatement, outputText, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            return false;
        }

        String html = readBestEffort(fallbackStatement);
        String fragment = toEditorFragment(html);
        Files.writeString(outputHtml, fragment, StandardCharsets.UTF_8);
        Files.writeString(outputText, toPlainText(fragment), StandardCharsets.UTF_8);
        return true;
    }

    private static boolean isHtml(Path path) {
        String name = path.getFileName().toString().toLowerCase(Locale.ROOT);
        return name.endsWith(".html") || name.endsWith(".htm");
    }

    private static String readBestEffort(Path path) throws IOException {
        byte[] bytes = Files.readAllBytes(path);
        String utf8 = new String(bytes, StandardCharsets.UTF_8);
        String ms949 = new String(bytes, Charset.forName("MS949"));
        return scoreKoreanText(ms949) > scoreKoreanText(utf8) ? ms949 : utf8;
    }

    private static int scoreKoreanText(String text) {
        int score = 0;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (c >= 0xAC00 && c <= 0xD7A3) {
                score += 3;
            } else if (c == '\uFFFD') {
                score -= 5;
            } else if (c >= 0x3130 && c <= 0x318F) {
                score += 1;
            } else if (c >= 0x4E00 && c <= 0x9FFF) {
                score -= 1;
            }
        }
        return score;
    }

    private static String toEditorFragment(String html) {
        String body = extractBody(html);
        String problemStatement = extractProblemStatement(body);
        List<String> blocks = new ArrayList<>();

        appendSectionHeading(blocks, "문제");
        appendParagraphs(blocks, section(problemStatement, "legend"));
        appendSection(blocks, "입력", section(problemStatement, "input-specification"));
        appendSection(blocks, "출력", section(problemStatement, "output-specification"));

        return String.join("\n", blocks).strip();
    }

    private static String extractBody(String html) {
        Matcher matcher = Pattern.compile("(?is)<body\\b[^>]*>(.*)</body>").matcher(html);
        return matcher.find() ? matcher.group(1) : html;
    }

    private static String extractProblemStatement(String body) {
        Matcher matcher = Pattern.compile("(?is)<div\\s+class=[\"']problem-statement[\"'][^>]*>.*").matcher(body);
        return matcher.find() ? matcher.group() : body;
    }

    private static void appendSection(List<String> blocks, String title, String html) {
        if (html.isBlank()) {
            return;
        }
        blocks.add("<p><br></p>");
        appendSectionHeading(blocks, title);
        appendParagraphs(blocks, html, true);
    }

    private static void appendSectionHeading(List<String> blocks, String title) {
        blocks.add("<p><b><span style=\"font-size: 24px;\">" + title + "</span></b></p>");
        blocks.add("<hr>");
    }

    private static void appendParagraphs(List<String> blocks, String html) {
        appendParagraphs(blocks, html, false);
    }

    private static void appendParagraphs(List<String> blocks, String html, boolean skipLeadingBlank) {
        Matcher matcher = Pattern.compile("(?is)<p\\b[^>]*>(.*?)</p>").matcher(html);
        boolean seenContent = false;
        while (matcher.find()) {
            String content = cleanInlineHtml(matcher.group(1));
            if (content.isBlank() && skipLeadingBlank && !seenContent) {
                continue;
            }
            if (!content.isBlank()) {
                seenContent = true;
            }
            blocks.add(content.isBlank() ? "<p><br></p>" : "<p>" + content + "</p>");
        }
    }

    private static String section(String html, String className) {
        Pattern startPattern = Pattern.compile("(?is)<div\\s+class=[\"']" + Pattern.quote(className) + "[\"'][^>]*>");
        Matcher start = startPattern.matcher(html);
        if (!start.find()) {
            return "";
        }
        int begin = start.start();
        int depth = 0;
        Matcher tags = Pattern.compile("(?is)</?div\\b[^>]*>").matcher(html);
        tags.region(start.start(), html.length());
        while (tags.find()) {
            String tag = tags.group();
            if (tag.startsWith("</")) {
                depth--;
                if (depth == 0) {
                    return html.substring(begin, tags.end());
                }
            } else {
                depth++;
            }
        }
        return html.substring(begin);
    }

    private static String cleanInlineHtml(String html) {
        return convertPolygonMath(unescapeHtml(stripTags(html)
                .replaceAll("(?i)<br\\s*/?>", "<br>")))
                .replaceAll("\\s+", " ")
                .strip();
    }

    private static String stripTags(String html) {
        return html.replaceAll("(?is)<[^>]+>", "");
    }

    private static String unescapeHtml(String text) {
        return text.replace("&nbsp;", " ")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&amp;", "&")
                .replace("&quot;", "\"");
    }

    private static String convertPolygonMath(String text) {
        String converted = replaceMathDelimiter(text, "$$$$$$");
        return replaceMathDelimiter(converted, "$$$");
    }

    private static String replaceMathDelimiter(String text, String delimiter) {
        StringBuilder result = new StringBuilder();
        int offset = 0;
        while (offset < text.length()) {
            int start = text.indexOf(delimiter, offset);
            if (start < 0) {
                result.append(text.substring(offset));
                break;
            }
            int end = text.indexOf(delimiter, start + delimiter.length());
            if (end < 0) {
                result.append(text.substring(offset));
                break;
            }
            result.append(text, offset, start);
            String equation = text.substring(start + delimiter.length(), end).strip();
            result.append(texImage(equation));
            offset = end + delimiter.length();
        }
        return result.toString();
    }

    private static String texImage(String equation) {
        String encoded = URLEncoder.encode(equation, StandardCharsets.UTF_8).replace("+", "%20");
        return "<span><img src=\"/texconverter?eq=" + encoded + "\"></span>";
    }

    private static String toPlainText(String html) {
        return html
                .replaceAll("(?i)<br>", "\n")
                .replaceAll("(?i)</p>", "\n\n")
                .replaceAll("(?i)</div>", "\n")
                .replaceAll("(?is)<[^>]+>", "")
                .replace("&nbsp;", " ")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&amp;", "&")
                .replaceAll("[ \\t]+", " ")
                .replaceAll("\\n{3,}", "\n\n")
                .strip();
    }
}
