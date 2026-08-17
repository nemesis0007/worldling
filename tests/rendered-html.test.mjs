import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Worldling experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /Worldling/);
  assert.match(html, /The world is/);
  assert.match(html, /Demo brain/);
  assert.match(html, /Bengaluru/);
  assert.match(html, /Phrases/);
  assert.match(html, /MISSION/);
  assert.match(html, /Choose a district/);
  assert.match(html, /YOUR NEXT ERRAND/);
  assert.doesNotMatch(html, /A living language game|Interactive spinning globe/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});
