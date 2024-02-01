const { spawn } = require("child_process");

deployReflect();

async function deployReflect() {
  if (process.env.VERCEL_ENV === "development") {
    return;
  }

  const previewName =
    process.env.VERCEL_ENV == "preview"
      ? process.env.VERCEL_GIT_COMMIT_REF
      : "";

  const appName = getAppName(previewName);
  const result = await runCommandAsync("npx", [
    "reflect",
    "publish",
    `--app=${appName}`,
    "--reflect-channel=canary",
    "--auth-key-from-env=REFLECT_API_KEY",
  ]);

  const lines = result.split("\n");
  const success = lines.findIndex((line) =>
    line.includes("Published successfully")
  );
  if (success === -1) {
    process.stderr.write("Failed to deploy to Reflect\n");
    return;
  }

  const url = lines[success + 1].trim();

  if (previewName !== "") {
    const existing = await runCommandAsync("vercel", [
      "env",
      "ls",
      "preview",
      previewName,
    ]);
    if (
      existing
        .split("\n")
        .some((line) => line.includes("NEXT_PUBLIC_REFLECT_SERVER"))
    ) {
      await runCommandAsync(
        "vercel",
        [
          "env",
          "rm",
          "-y",
          "NEXT_PUBLIC_REFLECT_SERVER",
          "preview",
          previewName,
        ],
        url
      );
    }
    await runCommandAsync(
      "vercel",
      ["env", "add", "NEXT_PUBLIC_REFLECT_SERVER", "preview", previewName],
      url
    );
  }
}

function getAppName(previewName) {
  const baseAppName = process.env.REFLECT_APP_NAME;

  if (previewName === "") {
    return baseAppName;
  }

  return `${baseAppName}-${previewName.replace(/\//g, "-")}`;
}

function runCommandAsync(command, args, stdin) {
  return new Promise((resolve, reject) => {
    process.stdout.write(`Running command: ${command} ${args.join(" ")}\n`);

    const child = spawn(command, args);
    let output = "";

    if (stdin !== undefined) {
      child.stdin.write(stdin);
      child.stdin.end();
    }

    child.stdout.on("data", (data) => {
      process.stdout.write(data.toString());
      output += data.toString();
    });

    child.stderr.on("data", (data) => {
      process.stderr.write(data.toString());
      output += data.toString();
    });

    child.on("error", (error) => {
      reject(error);
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
