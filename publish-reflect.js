const { spawn } = require("child_process");
const fs = require("fs");

const appBaseName = getEnv(process.env.REFLECT_APP_NAME, "REFLECT_APP_NAME");
const refName = getEnv(process.env.HEAD, "HEAD");

const appName = `${appBaseName}-${refName}`
  .toLowerCase()
  .replace(/^[^a-z]/, "")
  .replace(/[^a-z0-9-]/g, "-");

publish();

async function publish() {
  const output = await runCommand("npx", [
    "reflect",
    "publish",
    "--reflect-channel=canary",
    `--app=${appName}`,
    "--auth-key-from-env=REFLECT_AUTH_KEY",
  ]);
  const lines = output.toString().split("\n");
  const success = lines.findIndex((line) =>
    line.includes("🎁 Published successfully to:")
  );
  const url = lines[success + 1];

  fs.writeFileSync("./.env", `NEXT_PUBLIC_REFLECT_SERVER=${url}`);
}

function runCommand(command, args) {
  console.log("running command: " + command + " " + args.join(" "));
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);

    let output = "";
    child.stdout.on("data", (data) => {
      output += data;
      process.stdout.write(data);
    });

    child.stderr.on("data", (data) => {
      process.stderr.write(data);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with exit code ${code}`));
      } else {
        resolve(output);
      }
    });
  });
}

function getEnv(v, name) {
  if (!v) {
    throw new Error("Missing required env var: " + name);
  }
  return v;
}
