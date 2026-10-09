import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";

const port = 31687;
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["server/index.mjs"], {
  env: { ...process.env, PORT: String(port) },
  stdio: "inherit",
});

try {
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      const health = await fetch(base + "/healthz");
      assert.equal(health.status, 200);
      assert.deepEqual(await health.json(), { status: "ok" });
      ready = true;
      break;
    } catch {
      await wait(250);
    }
  }
  assert.equal(ready, true, "Node server did not start");

  const homepage = await fetch(base + "/");
  assert.equal(homepage.status, 200);
  assert.match(homepage.headers.get("content-type") ?? "", /text\/html/);

  const unauthorized = await fetch(base + "/api/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Test episode" }),
  });
  assert.equal(unauthorized.status, 401);

  const unknown = await fetch(base + "/api/unknown");
  assert.equal(unknown.status, 404);

  const youtube = await fetch(base + "/api/youtube", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "invalid" }),
  });
  assert.equal(youtube.status, 400);
  console.log("PodMark deployment smoke tests passed.");
} finally {
  server.kill("SIGTERM");
}
