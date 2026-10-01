import { describe, expect, it } from "vitest";
import { isPushEndpoint } from "./push-endpoint";

describe("isPushEndpoint", () => {
  it("accepts the browsers' push services", () => {
    expect(isPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
    expect(isPushEndpoint("https://web.push.apple.com/QAbc")).toBe(true);
    expect(isPushEndpoint("https://wns2-db5p.notify.windows.com/w/?token=abc")).toBe(true);
  });

  it("refuses any other host, a port, http or credentials", () => {
    expect(isPushEndpoint("https://example.com/push")).toBe(false);
    expect(isPushEndpoint("https://10.0.0.1/push")).toBe(false);
    expect(isPushEndpoint("https://fcm.googleapis.com.evil.com/x")).toBe(false);
    expect(isPushEndpoint("https://fcm.googleapis.com:8443/x")).toBe(false);
    expect(isPushEndpoint("http://fcm.googleapis.com/x")).toBe(false);
    expect(isPushEndpoint("https://a@fcm.googleapis.com/x")).toBe(false);
  });
});
