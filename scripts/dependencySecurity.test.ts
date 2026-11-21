import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const runNode = promisify(execFile);

interface BraceAst {
  type: string;
  nodes?: Array<BraceAst> | undefined;
}

interface Braces {
  parse(pattern: string): BraceAst;
  compile(input: string | BraceAst): string;
  expand(input: string | BraceAst): Array<string>;
  stringify(input: string | BraceAst): string;
}

// Follow the linter's actual dependency chain, rather than testing an unrelated direct copy.
const require = createRequire(import.meta.url);
const requireStylelint = createRequire(require.resolve("stylelint"));
const requireMicromatch = createRequire(requireStylelint.resolve("micromatch"));
const loadedBraces: unknown = requireMicromatch("braces");
if (
  !loadedBraces ||
  (typeof loadedBraces !== "object" && typeof loadedBraces !== "function") ||
  !("parse" in loadedBraces) ||
  typeof loadedBraces.parse !== "function" ||
  !("compile" in loadedBraces) ||
  typeof loadedBraces.compile !== "function" ||
  !("expand" in loadedBraces) ||
  typeof loadedBraces.expand !== "function" ||
  !("stringify" in loadedBraces) ||
  typeof loadedBraces.stringify !== "function"
) {
  throw new Error("Invalid transitive braces module");
}
const { parse, compile, expand, stringify } = loadedBraces;
const braceAstSchema: z.ZodType<BraceAst> = z.lazy(() =>
  z.looseObject({
    type: z.string(),
    nodes: z.array(braceAstSchema).optional(),
  }),
);
const braces: Braces = {
  parse: (pattern) => braceAstSchema.parse(parse.call(loadedBraces, pattern)),
  compile: (input) => z.string().parse(compile.call(loadedBraces, input)),
  expand: (input) => z.array(z.string()).parse(expand.call(loadedBraces, input)),
  stringify: (input) => z.string().parse(stringify.call(loadedBraces, input)),
};
describe("Drizzle's legacy TypeScript loader", () => {
  it("uses a patched compiler without breaking TypeScript transformation", async () => {
    // A real child avoids the application suite's MSW interception of the compiler's HTTP server.
    const { stdout } = await runNode(
      process.execPath,
      [
        "--input-type=commonjs",
        "--eval",
        String.raw`
const { createRequire } = require('node:module');
const { mkdtemp, writeFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');
const requireRoot = createRequire(process.argv[1]);
const requireKit = createRequire(requireRoot.resolve('drizzle-kit'));
const loader = requireKit.resolve('@esbuild-kit/esm-loader');
const requireLoader = createRequire(loader);
const requireCore = createRequire(requireLoader.resolve('@esbuild-kit/core-utils'));
const esbuild = requireCore('esbuild');
(async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vokhanhbel-loader-security-'));
  let context;
  try {
    await writeFile(join(directory, 'package.json'), '{"type":"module"}');
    await writeFile(join(directory, 'value.ts'), 'export enum Value { Answer = 42 }');
    const entry = join(directory, 'entry.ts');
    await writeFile(entry, "import { Value } from './value.ts'; console.log(Value.Answer);");
    const loaded = execFileSync(process.execPath,
      ['--no-experimental-strip-types', '--loader', loader, entry],
      { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'] });
    context = await esbuild.context({
      absWorkingDir: directory, entryPoints: ['entry.ts'], bundle: true,
      write: false, outfile: 'output.js'
    });
    const { port } = await context.serve({ host: '127.0.0.1', port: 0 });
    const response = await fetch('http://127.0.0.1:' + port + '/output.js', {
      headers: { Origin: 'https://untrusted.invalid' }
    });
    const compiled = await response.text();
    console.log(JSON.stringify({
      loaded: loaded.trim(), status: response.status,
      allowOrigin: response.headers.get('access-control-allow-origin'),
      compiled: compiled.includes('console.log') && compiled.includes('42')
    }));
  } finally {
    await context?.dispose();
    await rm(directory, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
`,
        resolve(process.cwd(), "package.json"),
      ],
      { encoding: "utf8", timeout: 10_000 },
    );

    expect(JSON.parse(stdout)).toEqual({
      loaded: "42",
      status: 200,
      allowOrigin: null,
      compiled: true,
    });
  });
});

describe("CSS glob compatibility", () => {
  it("preserves ordinary nested glob compilation and expansion", () => {
    expect(braces.compile("src/{client,{server,scripts}}/*.ts")).toBe(
      "src/(client|(server|scripts))/*.ts",
    );
    expect(braces.expand("src/{client,server}/file{01..03}.ts")).toEqual([
      "src/client/file01.ts",
      "src/client/file02.ts",
      "src/client/file03.ts",
      "src/server/file01.ts",
      "src/server/file02.ts",
      "src/server/file03.ts",
    ]);
    expect(braces.stringify(braces.parse("src/{client,server}/*.ts"))).toBe(
      "src/{client,server}/*.ts",
    );
  });
});
