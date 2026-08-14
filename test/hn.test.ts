import { describe, expect, it } from "vitest";

import { plainText } from "../src/hn";

describe("plainText", () => {
  it("removes HN comment markup and decodes entities", () => {
    expect(plainText("Useful <i>context</i><p>One &amp; two<br>three")).toBe(
      "Useful context\n\nOne & two\nthree",
    );
  });

  it("handles numeric entities", () => {
    expect(plainText("A &#62; B and &#x3c; C")).toBe("A > B and < C");
  });
});
