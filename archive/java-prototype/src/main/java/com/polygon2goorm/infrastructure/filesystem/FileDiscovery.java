package com.polygon2goorm.infrastructure.filesystem;

import com.polygon2goorm.common.AppException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

public class FileDiscovery {
    public List<Path> walkFiles(Path root) {
        try (Stream<Path> stream = Files.walk(root)) {
            return stream
                    .filter(Files::isRegularFile)
                    .sorted(Comparator.comparing(path -> root.relativize(path).toString().toLowerCase()))
                    .toList();
        } catch (IOException e) {
            throw new AppException("Could not scan extracted package: " + root, e);
        }
    }
}
