import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

interface BraceAst {
  type: string;
  nodes?: BraceAst[];
}

interface Braces {
  parse(pattern: string): BraceAst;
  compile(input: string | BraceAst): string;
  expand(input: string | BraceAst): string[];
  stringify(input: string | BraceAst): string;
}

// Follow the linter's actual dependency chain, rather than testing an unrelated direct copy.
const require = createRequire(import.meta.url);
const requireStylelint = createRequire(require.resolve("stylelint"));
const requireMicromatch = createRequire(requireStylelint.resolve("micromatch"));
const braces = requireMicromatch("braces") as Braces;
const depthError = expect.objectContaining({
  name: "SyntaxError",
  message: "Input nesting depth exceeds max depth (100)",
});

function deeplyNestedAst(): BraceAst {
  let ast = braces.parse("value");
  for (let depth = 0; depth < 4_000; depth += 1) {
    ast = { type: "root", nodes: [ast] };
  }

  return ast;
}

describe("CSS glob dependency security", () => {
  it.each(["parse", "compile", "expand", "stringify"] as const)(
    "%s rejects deep patterns before exhausting the call stack",
    (method) => {
      // Below the original 10,000-character limit: length validation alone cannot stop this input.
      const pattern = "{".repeat(4_000) + "a,b" + "}".repeat(4_000);
      expect(() => braces[method](pattern)).toThrow(depthError);
    },
  );

  it.each(["compile", "expand", "stringify"] as const)(
    "%s also guards externally constructed ASTs",
    (method) => {
      const ast = deeplyNestedAst();
      expect(() => braces[method](ast)).toThrow(depthError);
    },
  );

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
