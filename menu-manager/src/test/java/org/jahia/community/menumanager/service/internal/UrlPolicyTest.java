package org.jahia.community.menumanager.service.internal;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class UrlPolicyTest {

    @ParameterizedTest
    @ValueSource(strings = {"https://www.example.com", "http://example.org/a/b?q=1#top", "HTTPS://EXAMPLE.COM",
            "mailto:sales@example.com", "tel:+33123456789", "https://例え.jp/パス"})
    void acceptsTheAllowedSchemes(String url) {
        assertThat(UrlPolicy.check(url)).contains(url.replace("HTTPS://", "https://"));
    }

    @Test
    void writesTheSchemeInLowerCaseAsTheContentTypeExpects() {
        assertThat(UrlPolicy.check("HTTPS://Example.COM/Path")).contains("https://Example.COM/Path");
        assertThat(UrlPolicy.check("MailTo:Sales@Example.com")).contains("mailto:Sales@Example.com");
    }

    @Test
    void stripsTabsAndLineBreaksBeforeChecking() {
        assertThat(UrlPolicy.check(" https://exa\tmple.com/\npath ")).contains("https://example.com/path");
        assertThat(UrlPolicy.check("java\tscript:alert(1)")).isEmpty();
        assertThat(UrlPolicy.check("jav\r\nascript:alert(1)")).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<b>x</b>", "vbscript:x",
            "//evil.example", "/\\evil.example", "\\/evil.example", "https:///path", "https://evil.example\\@good.example",
            "https://a.example/x y", "mailto:", "tel:", "ftp://files.example", "/relative/path", "https://a.example/\u0000"})
    void refusesEverythingElse(String url) {
        assertThat(UrlPolicy.check(url)).isEmpty();
    }

    @Test
    void refusesEmptyAndTooLong() {
        assertThat(UrlPolicy.check(null)).isEmpty();
        assertThat(UrlPolicy.check("   ")).isEmpty();
        assertThat(UrlPolicy.check("https://a.example/" + "x".repeat(UrlPolicy.MAX_LENGTH))).isEmpty();
    }
}
