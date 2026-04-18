package com.polygon2goorm.gui;

import com.polygon2goorm.application.ConvertUseCase;
import com.polygon2goorm.application.InspectResult;
import com.polygon2goorm.common.AppException;
import com.polygon2goorm.domain.model.CompatibilityResult;
import com.polygon2goorm.domain.model.Issue;

import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JFileChooser;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.SwingUtilities;
import javax.swing.SwingWorker;
import javax.swing.TransferHandler;
import javax.swing.UIManager;
import javax.swing.UnsupportedLookAndFeelException;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Cursor;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import java.awt.datatransfer.DataFlavor;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

public class Polygon2GoormGui {
    private static final Color BACKGROUND = new Color(246, 248, 251);
    private static final Color SURFACE = Color.WHITE;
    private static final Color BORDER = new Color(218, 225, 235);
    private static final Color PRIMARY = new Color(37, 99, 235);
    private static final Color TEXT = new Color(28, 35, 48);
    private static final Color MUTED = new Color(91, 103, 122);

    private final JFrame frame = new JFrame("polygon2goorm");
    private final JTextArea log = new JTextArea();
    private final JLabel dropTitle = new JLabel("Polygon ZIP 드롭");
    private final JLabel dropSubtitle = new JLabel("FULL package ZIP을 놓으면 statement.html과 goorm-testcases.zip을 만듭니다.");
    private final JLabel statusLabel = new JLabel("준비됨");

    public static void main(String[] args) {
        configureLookAndFeel();
        SwingUtilities.invokeLater(() -> new Polygon2GoormGui().show());
    }

    private void show() {
        frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        frame.setMinimumSize(new Dimension(760, 520));
        frame.getContentPane().setBackground(BACKGROUND);
        frame.setLayout(new BorderLayout(12, 12));

        JPanel dropPanel = new JPanel(new GridBagLayout());
        dropPanel.setBackground(SURFACE);
        dropPanel.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(BORDER, 1),
                BorderFactory.createEmptyBorder(36, 28, 36, 28)));
        dropPanel.setPreferredSize(new Dimension(680, 180));

        dropTitle.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 24));
        dropTitle.setForeground(TEXT);
        dropSubtitle.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 14));
        dropSubtitle.setForeground(MUTED);
        statusLabel.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 13));
        statusLabel.setForeground(PRIMARY);

        GridBagConstraints gbc = new GridBagConstraints();
        gbc.gridx = 0;
        gbc.gridy = 0;
        gbc.insets = new Insets(0, 0, 8, 0);
        dropPanel.add(dropTitle, gbc);
        gbc.gridy = 1;
        gbc.insets = new Insets(0, 0, 16, 0);
        dropPanel.add(dropSubtitle, gbc);
        gbc.gridy = 2;
        gbc.insets = new Insets(0, 0, 0, 0);
        dropPanel.add(statusLabel, gbc);

        TransferHandler zipTransferHandler = new ZipTransferHandler();
        dropPanel.setTransferHandler(zipTransferHandler);
        dropTitle.setTransferHandler(zipTransferHandler);
        dropSubtitle.setTransferHandler(zipTransferHandler);
        statusLabel.setTransferHandler(zipTransferHandler);
        frame.setTransferHandler(zipTransferHandler);

        JButton chooseButton = new JButton("ZIP 파일 선택");
        chooseButton.setFocusPainted(false);
        chooseButton.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(PRIMARY, 1),
                BorderFactory.createEmptyBorder(10, 18, 10, 18)));
        chooseButton.setBackground(PRIMARY);
        chooseButton.setForeground(Color.WHITE);
        chooseButton.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        chooseButton.addActionListener(event -> chooseZip());

        log.setEditable(false);
        log.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 13));
        log.setForeground(TEXT);
        log.setBackground(SURFACE);
        log.setBorder(BorderFactory.createEmptyBorder(16, 16, 16, 16));
        log.setText("""
                준비됨.

                지원 범위:
                - Polygon FULL package ZIP
                - standard input/output
                - precomputed test pairs
                - standard checker 또는 checker 없음

                생성 파일:
                - statement.html
                - goorm-testcases.zip
                """);

        JPanel top = new JPanel(new BorderLayout(8, 8));
        top.setOpaque(false);
        top.setBorder(BorderFactory.createEmptyBorder(18, 18, 0, 18));
        top.add(dropPanel, BorderLayout.CENTER);
        top.add(chooseButton, BorderLayout.SOUTH);

        JScrollPane scrollPane = new JScrollPane(log);
        scrollPane.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createEmptyBorder(0, 18, 18, 18),
                BorderFactory.createLineBorder(BORDER, 1)));
        scrollPane.getViewport().setBackground(SURFACE);

        frame.add(top, BorderLayout.NORTH);
        frame.add(scrollPane, BorderLayout.CENTER);
        frame.setLocationRelativeTo(null);
        frame.setVisible(true);
    }

    private void chooseZip() {
        JFileChooser chooser = new JFileChooser();
        chooser.setFileSelectionMode(JFileChooser.FILES_ONLY);
        int result = chooser.showOpenDialog(frame);
        if (result == JFileChooser.APPROVE_OPTION) {
            handleZip(chooser.getSelectedFile().toPath());
        }
    }

    private void handleZip(Path zipPath) {
        if (!Files.isRegularFile(zipPath) || !zipPath.getFileName().toString().toLowerCase().endsWith(".zip")) {
            setLog("ZIP 파일만 처리할 수 있습니다:\n" + zipPath);
            return;
        }

        statusLabel.setText("분석 중...");
        setLog("분석 중: " + zipPath + "\n");

        new SwingWorker<String, Void>() {
            @Override
            protected String doInBackground() {
                return convert(zipPath);
            }

            @Override
            protected void done() {
                try {
                    setLog(get());
                } catch (Exception e) {
                    setLog("처리 중 오류가 발생했습니다.\n\n" + e.getMessage());
                } finally {
                    statusLabel.setText("준비됨");
                }
            }
        }.execute();
    }

    private String convert(Path zipPath) {
        ConvertUseCase convertUseCase = new ConvertUseCase();
        Path outputDir = outputDirFor(zipPath);
        try {
            InspectResult result = convertUseCase.convert(zipPath, outputDir, true);
            return successMessage(result, outputDir);
        } catch (AppException e) {
            return unsupportedMessage(e.getMessage(), zipPath);
        }
    }

    private String successMessage(InspectResult result, Path outputDir) {
        StringBuilder builder = new StringBuilder();
        builder.append("변환 완료\n\n");
        builder.append("판정: ").append(result.report().result()).append('\n');
        builder.append("문제: ").append(result.ir().meta().title()).append('\n');
        builder.append("테스트케이스: ").append(result.ir().tests().tests().size()).append("개\n\n");
        builder.append("구름에 사용할 파일:\n");
        builder.append("- statement.html: ").append(outputDir.resolve("statement.html").toAbsolutePath()).append('\n');
        builder.append("- goorm-testcases.zip: ").append(outputDir.resolve("goorm-testcases.zip").toAbsolutePath()).append("\n\n");

        if (!result.report().issues().isEmpty()) {
            builder.append("주의/경고:\n");
            appendIssues(builder, result.report().issues());
        }
        return builder.toString();
    }

    private String unsupportedMessage(String errorMessage, Path zipPath) {
        try {
            InspectResult result = new com.polygon2goorm.application.InspectUseCase().inspect(zipPath);
            if (result.report().result() != CompatibilityResult.UNSUPPORTED) {
                return "변환할 수 없습니다.\n\n" + errorMessage;
            }
            StringBuilder builder = new StringBuilder();
            builder.append("포팅할 수 없는 패키지입니다.\n\n");
            builder.append("문제: ").append(result.ir().meta().title()).append('\n');
            builder.append("판정: ").append(result.report().result()).append("\n\n");
            builder.append("이유:\n");
            appendIssues(builder, result.report().issues());
            return builder.toString();
        } catch (Exception inspectFailure) {
            return "포팅할 수 없는 패키지입니다.\n\n"
                    + errorMessage + "\n\n"
                    + "추가 분석도 실패했습니다: " + inspectFailure.getMessage();
        }
    }

    private static void appendIssues(StringBuilder builder, List<Issue> issues) {
        for (Issue issue : issues) {
            builder.append("- [").append(issue.severity()).append("] ")
                    .append(issue.type()).append(": ")
                    .append(issue.message());
            if (issue.path() != null) {
                builder.append(" (").append(issue.path()).append(')');
            }
            builder.append('\n');
        }
    }

    private static Path outputDirFor(Path zipPath) {
        String fileName = zipPath.getFileName().toString();
        String baseName = fileName.toLowerCase().endsWith(".zip")
                ? fileName.substring(0, fileName.length() - 4)
                : fileName;
        Path parent = zipPath.getParent() == null ? Path.of(".") : zipPath.getParent();
        return parent.resolve(baseName + "-goorm");
    }

    private void setLog(String text) {
        log.setText(text);
        log.setCaretPosition(0);
    }

    private static void configureLookAndFeel() {
        try {
            UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());
        } catch (ClassNotFoundException | InstantiationException | IllegalAccessException | UnsupportedLookAndFeelException ignored) {
            // Fall back to Swing defaults if the system look and feel is unavailable.
        }
        UIManager.put("Panel.background", BACKGROUND);
        UIManager.put("OptionPane.background", BACKGROUND);
        UIManager.put("Button.font", new Font(Font.SANS_SERIF, Font.BOLD, 13));
        UIManager.put("Label.font", new Font(Font.SANS_SERIF, Font.PLAIN, 13));
    }

    private class ZipTransferHandler extends TransferHandler {
        @Override
        public boolean canImport(TransferSupport support) {
            return support.isDataFlavorSupported(DataFlavor.javaFileListFlavor);
        }

        @Override
        public boolean importData(TransferSupport support) {
            if (!canImport(support)) {
                return false;
            }
            try {
                @SuppressWarnings("unchecked")
                List<File> files = (List<File>) support.getTransferable().getTransferData(DataFlavor.javaFileListFlavor);
                if (!files.isEmpty()) {
                    handleZip(files.getFirst().toPath());
                    return true;
                }
            } catch (Exception e) {
                setLog("드래그앤드롭 처리에 실패했습니다.\n\n" + e.getMessage());
            }
            return false;
        }
    }
}
