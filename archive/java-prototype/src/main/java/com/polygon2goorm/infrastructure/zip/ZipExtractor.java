package com.polygon2goorm.infrastructure.zip;

import com.polygon2goorm.common.AppException;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

public class ZipExtractor {
    public Path extract(Path zipPath) {
        if (!Files.isRegularFile(zipPath)) {
            throw new AppException("Input ZIP does not exist: " + zipPath);
        }
        try {
            Path target = Files.createTempDirectory("polygon2goorm-");
            try (InputStream raw = Files.newInputStream(zipPath);
                 ZipInputStream zip = new ZipInputStream(raw)) {
                ZipEntry entry;
                while ((entry = zip.getNextEntry()) != null) {
                    Path destination = target.resolve(entry.getName()).normalize();
                    if (!destination.startsWith(target)) {
                        throw new AppException("Unsafe ZIP entry path: " + entry.getName());
                    }
                    if (entry.isDirectory()) {
                        Files.createDirectories(destination);
                    } else {
                        Files.createDirectories(destination.getParent());
                        Files.copy(zip, destination, StandardCopyOption.REPLACE_EXISTING);
                    }
                    zip.closeEntry();
                }
            }
            return target;
        } catch (IOException e) {
            throw new AppException("Could not extract ZIP: " + zipPath, e);
        }
    }
}
