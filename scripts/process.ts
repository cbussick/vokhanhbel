import { spawn } from "node:child_process";

export async function run(command: string, arguments_: string[], environment = process.env) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, arguments_, { env: environment, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} failed (${signal ?? String(code)})`));
    });
  });
}

export async function capture(command: string, arguments_: string[], environment = process.env) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, arguments_, {
      env: environment,
      stdio: ["ignore", "pipe", "inherit"],
    });
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      output += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve(output);
      else reject(new Error(`${command} failed (${signal ?? String(code)})`));
    });
  });
}
