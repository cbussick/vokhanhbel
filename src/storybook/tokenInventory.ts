import stylesheet from "../styles/global.css?raw";

/** The shipped CSS is the source of truth, not a second token object. */
export const tokens = [...stylesheet.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => ({
  name: match[1]!,
  value: match[2]!.trim(),
}));
export function tokensWith(prefix: string) {
  return tokens.filter((token) => token.name.startsWith(prefix));
}

const sources = import.meta.glob<string>(
  ["../components/**/*.css", "../components/**/*.tsx", "../routes/**/*.css"],
  {
    query: "?raw",
    import: "default",
    eager: true,
  },
);
function colorMixes(source: string): string[] {
  const values: string[] = [];
  for (const match of source.matchAll(/color-mix\(/g)) {
    let depth = 1;
    let end = match.index + match[0].length;
    while (end < source.length && depth > 0) {
      if (source[end] === "(") depth += 1;
      if (source[end] === ")") depth -= 1;
      end += 1;
    }
    if (depth === 0) values.push(source.slice(match.index, end));
  }

  return values;
}

/** Include literal artwork colours and component-local mixes without promoting them to tokens. */
export const localColors = (() => {
  const usages = new Map<string, Set<string>>();
  for (const [path, source] of Object.entries(sources)) {
    if (/\.(stories|test)\./.test(path)) continue;
    const uncommented = source.replace(/\/\*[\s\S]*?\*\//g, "");
    const colors = [
      ...(uncommented.match(/#[\da-f]{3,8}\b|\brgba?\([^)]*\)|\b(?:white|black)\b/gim) ?? []),
      ...colorMixes(uncommented),
    ];
    for (const color of colors) {
      const files = usages.get(color) ?? new Set<string>();
      files.add(path.replace("../", "src/"));
      usages.set(color, files);
    }
  }

  return [...usages]
    .map(([value, paths]) => ({
      value,
      paths: [...paths].sort(),
      contextual:
        /currentcolor/i.test(value) ||
        [...value.matchAll(/var\((--[\w-]+)/g)].some(
          (match) => !tokens.some((token) => token.name === match[1]),
        ),
    }))
    .sort((a, b) => a.value.localeCompare(b.value));
})();
