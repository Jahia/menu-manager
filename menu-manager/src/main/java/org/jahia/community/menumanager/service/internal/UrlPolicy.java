package org.jahia.community.menumanager.service.internal;

import java.util.Locale;
import java.util.Optional;

/**
 * The addresses an external link item may hold: {@code https:}, {@code http:}, {@code mailto:} and
 * {@code tel:}. Tab, line feed and carriage return are stripped first (browsers ignore them inside a
 * scheme, so {@code java\tscript:} would pass a naive check); any other control character or a space
 * refuses the address, and so do the protocol-relative forms {@code //}, {@code /\} and {@code \/}.
 * Used on save and again at render time, for addresses written by other means.
 */
public final class UrlPolicy {

    /** Longest address accepted. */
    public static final int MAX_LENGTH = 2048;

    private UrlPolicy() {
    }

    /**
     * @param raw an address as typed or stored
     * @return the address to use, or empty when it is not allowed
     */
    public static Optional<String> check(String raw) {
        if (raw == null) {
            return Optional.empty();
        }
        // Spaces only: trim() would also drop other control characters at the ends, silently.
        String url = stripSpaces(raw.replace("\t", "").replace("\n", "").replace("\r", ""));
        if (url.isEmpty() || url.length() > MAX_LENGTH || url.startsWith("//") || url.startsWith("/\\") || url.startsWith("\\/")
                || hasControlCharacter(url)) {
            return Optional.empty();
        }
        String lower = url.toLowerCase(Locale.ROOT);
        if (lower.startsWith("https://") || lower.startsWith("http://")) {
            return hasHost(url) ? Optional.of(lowerScheme(url)) : Optional.empty();
        }
        if ((lower.startsWith("mailto:") && url.length() > 7) || (lower.startsWith("tel:") && url.length() > 4)) {
            return Optional.of(lowerScheme(url));
        }
        return Optional.empty();
    }

    /** A space, a control character or DEL anywhere: refused rather than cleaned. */
    private static boolean hasControlCharacter(String url) {
        for (int i = 0; i < url.length(); i++) {
            char c = url.charAt(i);
            if (c <= ' ' || c == 0x7f) {
                return true;
            }
        }
        return false;
    }

    /** An http(s) address names a host, with no backslash in it (some browsers read one as a slash). */
    private static boolean hasHost(String url) {
        String rest = url.substring(url.indexOf("://") + 3);
        int end = firstOf(rest, "/?#");
        String authority = end < 0 ? rest : rest.substring(0, end);
        return !authority.isEmpty() && !authority.contains("\\");
    }

    /** The scheme in lower case, as the content type's constraint expects ({@code HTTPS://} would be refused there). */
    private static String lowerScheme(String url) {
        int colon = url.indexOf(':');
        return url.substring(0, colon).toLowerCase(Locale.ROOT) + url.substring(colon);
    }

    private static String stripSpaces(String s) {
        int start = 0;
        int end = s.length();
        while (start < end && s.charAt(start) == ' ') {
            start++;
        }
        while (end > start && s.charAt(end - 1) == ' ') {
            end--;
        }
        return s.substring(start, end);
    }

    private static int firstOf(String s, String chars) {
        int best = -1;
        for (char c : chars.toCharArray()) {
            int i = s.indexOf(c);
            if (i >= 0 && (best < 0 || i < best)) {
                best = i;
            }
        }
        return best;
    }
}
