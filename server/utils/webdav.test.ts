import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  davRelPath,
  hrefFor,
  parseBasicAuth,
  propfindXml,
  sha256Hex,
  timingSafeEqual,
  xmlEscape,
} from "../utils/webdav";

describe("webdav protocol helpers", () => {
  it("maps /dav paths", () => {
    assert.equal(davRelPath("/dav"), "");
    assert.equal(davRelPath("/dav/"), "");
    assert.equal(davRelPath("/dav/Projects/a.txt"), "Projects/a.txt");
    assert.equal(hrefFor(""), "/dav/");
    assert.equal(hrefFor("Projects/a.txt"), "/dav/Projects/a.txt");
  });

  it("parses basic auth", () => {
    const header = "Basic " + Buffer.from("ada@example.com:secret").toString("base64");
    const creds = parseBasicAuth(header);
    assert.equal(creds?.user, "ada@example.com");
    assert.equal(creds?.pass, "secret");
    assert.equal(parseBasicAuth(null), null);
  });

  it("hashes dav passwords with sha256", async () => {
    const a = await sha256Hex("password12");
    const b = await sha256Hex("password12");
    assert.equal(a.length, 64);
    assert.equal(a, b);
    assert.equal(timingSafeEqual(a, b), true);
    assert.equal(timingSafeEqual(a, await sha256Hex("other")), false);
  });

  it("emits RFC4918 multistatus xml", () => {
    const xml = propfindXml([
      {
        href: "/dav/",
        isCollection: true,
        displayName: "drive-1",
        createdAt: 0,
        updatedAt: 0,
      },
      {
        href: "/dav/readme.txt",
        isCollection: false,
        displayName: "readme.txt",
        contentType: "text/plain",
        size: 4,
        createdAt: 0,
        updatedAt: 0,
        etag: '"abc"',
      },
    ]);
    assert.match(xml, /<D:multistatus/);
    assert.match(xml, /<D:collection\/>/);
    assert.match(xml, /<D:getcontentlength>4<\/D:getcontentlength>/);
    assert.match(xml, /<D:displayname>readme.txt<\/D:displayname>/);
    assert.equal(xmlEscape("<a&b>"), "&lt;a&amp;b&gt;");
  });
});
