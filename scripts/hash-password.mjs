#!/usr/bin/env node
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { createInterface } from "node:readline";

const ITERATIONS = 100_000;

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const stdin = process.stdin;
    const mute = () => {
      const raw = stdin.isRaw;
      if (stdin.isTTY) stdin.setRawMode(true);
      let value = "";
      const onData = (char) => {
        const s = char.toString("utf8");
        if (s === "\n" || s === "\r" || s === "\u0004") {
          stdin.removeListener("data", onData);
          if (stdin.isTTY) stdin.setRawMode(!!raw);
          rl.close();
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (s === "\u0003") process.exit(1);
        if (s === "\u007f") {
          value = value.slice(0, -1);
          return;
        }
        value += s;
      };
      process.stdout.write(question);
      stdin.on("data", onData);
    };
    if (!stdin.isTTY) {
      let data = "";
      stdin.setEncoding("utf8");
      stdin.on("data", (chunk) => {
        data += chunk;
      });
      stdin.on("end", () => resolve(String(data).replace(/\r?\n$/, "")));
      return;
    }
    mute();
  });
}

const password = (await promptHidden("Password: ")).trim();
if (!password) {
  console.error("Empty password");
  process.exit(1);
}
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");
process.stdout.write(
  `pbkdf2$sha256$${ITERATIONS}$${salt.toString("hex")}$${hash.toString("hex")}\n`
);
