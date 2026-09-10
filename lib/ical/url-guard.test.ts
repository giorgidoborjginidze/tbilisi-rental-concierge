import { describe, expect, it } from "vitest";
import { checkFeedUrl, isPrivateIpv4, isPrivateIpv6 } from "./url-guard";

// Production behaviour is the one that matters — that is where the guard
// stands between an operator's text field and the host's own network.
const prod = { allowInsecure: false };

describe("isPrivateIpv4", () => {
  it("catches the cloud metadata address", () => {
    expect(isPrivateIpv4("169.254.169.254")).toBe(true);
  });

  it("catches the RFC 1918 ranges and loopback", () => {
    for (const ip of ["10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "127.0.0.1"]) {
      expect(isPrivateIpv4(ip), ip).toBe(true);
    }
  });

  it("lets public addresses through", () => {
    for (const ip of ["8.8.8.8", "172.32.0.1", "93.184.216.34"]) {
      expect(isPrivateIpv4(ip), ip).toBe(false);
    }
  });
});

describe("isPrivateIpv6", () => {
  it("catches loopback, unique-local and link-local", () => {
    expect(isPrivateIpv6("::1")).toBe(true);
    expect(isPrivateIpv6("[fd00::1]")).toBe(true);
    expect(isPrivateIpv6("fe80::1")).toBe(true);
  });

  it("follows the v4 verdict through a mapped address", () => {
    expect(isPrivateIpv6("::ffff:169.254.169.254")).toBe(true);
    expect(isPrivateIpv6("::ffff:8.8.8.8")).toBe(false);
  });

  it("lets a public v6 address through", () => {
    expect(isPrivateIpv6("2a00:1450:4001:80e::200e")).toBe(false);
  });
});

describe("checkFeedUrl", () => {
  it("accepts a real channel feed", () => {
    const verdict = checkFeedUrl(
      "https://www.airbnb.com/calendar/ical/12345.ics?s=abc",
      prod,
    );
    expect(verdict.ok).toBe(true);
  });

  it("refuses the metadata service", () => {
    const verdict = checkFeedUrl(
      "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
      prod,
    );
    expect(verdict).toMatchObject({ ok: false });
  });

  it("refuses plain http in production and allows it locally", () => {
    expect(checkFeedUrl("http://example.com/f.ics", prod).ok).toBe(false);
    expect(
      checkFeedUrl("http://example.com/f.ics", { allowInsecure: true }).ok,
    ).toBe(true);
  });

  it("refuses non-http schemes outright", () => {
    for (const url of ["file:///etc/passwd", "gopher://x/1", "data:text/calendar,BEGIN"]) {
      expect(checkFeedUrl(url, { allowInsecure: true }).ok, url).toBe(false);
    }
  });

  it("refuses localhost and bare internal names", () => {
    expect(checkFeedUrl("https://localhost/f.ics", prod).ok).toBe(false);
    expect(checkFeedUrl("https://intranet/f.ics", prod).ok).toBe(false);
  });

  it("refuses a private literal even over https", () => {
    expect(checkFeedUrl("https://10.0.0.5/f.ics", prod).ok).toBe(false);
    expect(checkFeedUrl("https://[fd00::1]/f.ics", prod).ok).toBe(false);
  });

  it("refuses credentials embedded in the URL", () => {
    const verdict = checkFeedUrl("https://user:pass@example.com/f.ics", prod);
    expect(verdict).toMatchObject({ ok: false, reason: "credentials in URL" });
  });

  it("refuses anything that is not a URL at all", () => {
    expect(checkFeedUrl("not a url", prod).ok).toBe(false);
    expect(checkFeedUrl("", prod).ok).toBe(false);
  });
});
