import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(
  new URL("../apps/web/dist/index.html", import.meta.url),
  "utf8",
);

assert.match(html, /src="\/zhengwujianli\/assets\//);
assert.match(html, /href="\/zhengwujianli\/assets\//);
console.log("subpath build asset prefixes verified");
