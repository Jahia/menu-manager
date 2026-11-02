package org.jahia.community.menumanager;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The parent pom runs native2ascii over the resource bundles and reads them as ISO-8859-1: a UTF-8
 * character reaches the jar as two (French labels read "affichÃ©s" in jContent, while the build
 * passes). Every character outside ASCII is written as a \\uXXXX escape.
 */
class ResourceBundlesTest {

    @Test
    void bundlesHoldAsciiOnly() throws IOException {
        Path dir = Path.of("src/main/resources/resources");
        List<String> offending;
        try (Stream<Path> files = Files.list(dir)) {
            offending = files.filter(f -> f.toString().endsWith(".properties"))
                    .flatMap(f -> {
                        try {
                            List<String> lines = Files.readAllLines(f);
                            return java.util.stream.IntStream.range(0, lines.size())
                                    .filter(i -> lines.get(i).chars().anyMatch(c -> c > 127))
                                    .mapToObj(i -> f.getFileName() + ":" + (i + 1));
                        } catch (IOException e) {
                            throw new IllegalStateException(e);
                        }
                    })
                    .toList();
        }
        assertThat(offending).as("lines with a character to write as \\uXXXX").isEmpty();
    }
}
