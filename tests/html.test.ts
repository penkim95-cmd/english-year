import { describe, expect, it } from "vitest";
import { escapeHtml, html, raw } from "../src/ui/html";

describe("html", () => {
  it("escapes interpolated values, including attribute quotes", () => {
    const evil = `"><img src=x onerror=alert(1)>'`;
    expect(html`<b title="${evil}">${evil}</b>`.value).toBe(
      `<b title="${escapeHtml(evil)}">&quot;&gt;&lt;img src=x onerror=alert(1)&gt;&#39;</b>`,
    );
  });

  it("nests safe fragments and arrays without double escaping", () => {
    const items = ["a&b", "<c>"].map((x) => html`<li>${x}</li>`);
    const list = html`<ul>
      ${items}
    </ul>`.value;
    expect(list.replace(/\s+/g, "")).toBe("<ul><li>a&amp;b</li><li>&lt;c&gt;</li></ul>");
  });

  it("drops null, undefined and false but keeps 0", () => {
    expect(html`${null}${undefined}${false}${0}`.value).toBe("0");
  });

  it("passes raw markup through unchanged", () => {
    expect(html`<p>${raw("<br />")}</p>`.value).toBe("<p><br /></p>");
  });
});
