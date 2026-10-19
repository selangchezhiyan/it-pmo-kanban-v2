#!/usr/bin/env node
// PostToolUse hook: keeps the CSP script-src hash in index.html in sync with
// the inline <script>. Any script edit invalidates the old hash and silently
// disables the app, so this recomputes it (over LF line endings, as served)
// and rewrites only the meta tag when it has drifted.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

let raw = "";
process.stdin.on("data", (d) => (raw += d));
process.stdin.on("end", () => {
  let input = {};
  try { input = JSON.parse(raw || "{}"); } catch { /* run the check anyway */ }

  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const file = path.join(root, "index.html");

  // Edit/Write name the file; skip edits to anything else. Bash has no
  // file_path (it may have used sed), so it always gets checked.
  const target = input.tool_input && input.tool_input.file_path;
  if (target && path.resolve(root, target) !== path.resolve(file)) return;
  if (!fs.existsSync(file)) return;

  const html = fs.readFileSync(file, "utf8");
  const script = html.replace(/\r\n/g, "\n").match(/<script>([\s\S]*?)<\/script>/);
  const current = html.match(/script-src '(sha256-[^']+)'/);
  if (!script || !current) return;

  const hash = "sha256-" + crypto.createHash("sha256").update(script[1]).digest("base64");
  if (hash === current[1]) return;

  fs.writeFileSync(file, html.replace(current[0], `script-src '${hash}'`));
  process.stdout.write(JSON.stringify({
    systemMessage: `index.html CSP hash updated: ${current[1]} -> ${hash}`,
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: `The inline script changed, so the CSP script-src hash in index.html was rewritten to ${hash}. Re-read index.html before editing its <head>.`,
    },
  }));
});
