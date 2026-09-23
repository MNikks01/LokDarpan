/**
 * Import direction, checked rather than described (ADR-059).
 *
 * The architecture's layering was prose: rendering code does not reach the
 * database, sources do not reach the UI, the domain reaches nothing. Nothing
 * stopped an edge in either direction, and an edge nobody notices becomes a
 * dependency everybody relies on.
 *
 * This walks every tracked file's imports with the TypeScript parser — static,
 * dynamic, `export … from` and type-only alike — and follows local imports
 * transitively. A component that reaches `pg` through a helper is caught
 * exactly as one that imports it directly. Adapted from God's Eye View's
 * `check-import-directions.mjs`.
 *
 * Pure: the file list and a reader are passed in, so every rule is tested
 * against in-memory trees that must fail.
 */
import ts from "typescript";

export interface ImportEdge {
  /** The specifier as written. */
  readonly specifier: string;
  /** Names imported, for rules that restrict them. Empty for a namespace or side-effect import. */
  readonly names: readonly string[];
  /** Whether the whole import is `import type`. */
  readonly typeOnly: boolean;
}

export interface Rule {
  readonly id: string;
  readonly description: string;
  /** Files the rule applies to, by path prefix. Tests are never in scope. */
  readonly from: readonly string[];
  /** Specifiers that may not be reached, directly or through local imports. */
  readonly forbid: readonly RegExp[];
  /** For one package, the only value names that may be imported from it. */
  readonly onlyNames?: { readonly specifier: string; readonly allowed: RegExp };
  /**
   * Whether `import type` edges count. A type is erased at build, so it carries
   * no database connection or file read — but it does carry a shape, which is
   * what rule F is about.
   */
  readonly types: boolean;
}

export const RULES: readonly Rule[] = [
  {
    id: "A",
    types: false,
    description:
      "Client code does no financial arithmetic: it may take only format* from @lokdarpan/money",
    from: ["apps/web/src/components/", "apps/web/src/map/"],
    forbid: [],
    onlyNames: { specifier: "@lokdarpan/money", allowed: /^format/ },
  },
  {
    id: "C",
    types: false,
    description:
      "Rendering code never talks to the database, the services or the machine it runs on",
    from: ["apps/web/src/components/", "apps/web/src/map/"],
    forbid: [
      /^pg$/,
      /^@lokdarpan\/database(\/|$)/,
      /(^|\/)services\//,
      /^node:/,
      /^(fs|net|child_process|http|https)$/,
      /server-only/,
    ],
  },
  {
    id: "D",
    types: false,
    description: "Source adapters never depend on the UI",
    from: ["services/ingestion/"],
    forbid: [/^react(-dom)?(\/|$)/, /^next(\/|$)/, /^maplibre-gl$/, /(^|\/)apps\//, /^@\//],
  },
  {
    id: "E",
    types: false,
    description: "Domain and contracts never depend on presentation or I/O",
    from: ["packages/domain/", "packages/contracts/"],
    forbid: [
      /^react(-dom)?(\/|$)/,
      /^next(\/|$)/,
      /^maplibre-gl$/,
      /^pg$/,
      /^@lokdarpan\/database(\/|$)/,
      /^node:fs/,
      /^fs$/,
      /(^|\/)apps\//,
    ],
  },
  {
    id: "F",
    types: true,
    description: "Map and components consume view models, never ingestion types",
    from: ["apps/web/src/components/", "apps/web/src/map/"],
    forbid: [/^@lokdarpan\/ingestion(\/|$)/],
  },
  {
    id: "R",
    types: false,
    description:
      "What is drawn is not what is ranked: label placement reads no analytics, risk or money",
    from: ["apps/web/src/map/labels/"],
    forbid: [/analytics/, /risk/, /finance/, /^@lokdarpan\/money/, /^@lokdarpan\/domain/],
  },
];

const SOURCE = /\.(ts|tsx|mts|cts)$/;
const TEST = /(\.test\.|\/tests?\/|\/fixtures\/|\.d\.ts$)/;

export function importsOf(path: string, text: string): readonly ImportEdge[] {
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, false, scriptKind(path));
  const edges: ImportEdge[] = [];
  const visit = (node: ts.Node): void => {
    const edge = edgeOf(node);
    if (edge !== null) edges.push(edge);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return edges;
}

/** The import a node makes, if it makes one. */
function edgeOf(node: ts.Node): ImportEdge | null {
  if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
    return {
      specifier: node.moduleSpecifier.text,
      names: importedNames(node.importClause),
      typeOnly: isTypeOnlyClause(node.importClause),
    };
  }
  if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined) {
    return ts.isStringLiteral(node.moduleSpecifier)
      ? { specifier: node.moduleSpecifier.text, names: [], typeOnly: node.isTypeOnly }
      : null;
  }
  if (ts.isCallExpression(node) && isImportOrRequire(node.expression)) {
    const [argument] = node.arguments;
    return argument !== undefined && ts.isStringLiteralLike(argument)
      ? { specifier: argument.text, names: [], typeOnly: false }
      : null;
  }
  return null;
}

function isImportOrRequire(expression: ts.Expression): boolean {
  return (
    expression.kind === ts.SyntaxKind.ImportKeyword ||
    (ts.isIdentifier(expression) && expression.text === "require")
  );
}

function isTypeOnlyClause(clause: ts.ImportClause | undefined): boolean {
  return clause?.phaseModifier === ts.SyntaxKind.TypeKeyword;
}

function scriptKind(path: string): ts.ScriptKind {
  return path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

/** Value names only: a type carries no arithmetic. */
function importedNames(clause: ts.ImportClause | undefined): readonly string[] {
  if (clause === undefined || isTypeOnlyClause(clause)) return [];
  const names: string[] = [];
  if (clause.name !== undefined) names.push("default");
  const bindings = clause.namedBindings;
  if (bindings !== undefined && ts.isNamedImports(bindings)) {
    for (const element of bindings.elements) {
      if (!element.isTypeOnly) names.push((element.propertyName ?? element.name).text);
    }
  } else if (bindings !== undefined) {
    names.push("*");
  }
  return names;
}

/**
 * Where a local specifier points, among the tracked files. `@/` is apps/web's
 * alias for its `src/`. Anything else — a package, a builtin — is not local and
 * is judged by its specifier.
 */
export function resolveLocal(
  from: string,
  specifier: string,
  files: ReadonlySet<string>,
): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = `apps/web/src/${specifier.slice(2)}`;
  else if (specifier.startsWith(".")) base = normalise(`${dirname(from)}/${specifier}`);
  else return null;
  const candidates = [
    base,
    ...[".ts", ".tsx"].map((ext) => `${base}${ext}`),
    ...["/index.ts", "/index.tsx"].map((index) => `${base}${index}`),
    base.replace(/\.js$/, ".ts"),
  ];
  return candidates.find((candidate) => files.has(candidate)) ?? null;
}

function dirname(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "" : path.slice(0, slash);
}

function normalise(path: string): string {
  const out: string[] = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

export interface Violation {
  readonly rule: string;
  readonly file: string;
  readonly specifier: string;
  /** The chain of local files from `file` to the one that imports `specifier`. */
  readonly via: readonly string[];
  readonly reason: string;
}

export function check(
  paths: readonly string[],
  read: (path: string) => string,
  rules: readonly Rule[] = RULES,
): readonly Violation[] {
  const files = new Set(paths.filter((p) => SOURCE.test(p)));
  const edges = new Map<string, readonly ImportEdge[]>();
  const edgesOf = (path: string): readonly ImportEdge[] => {
    let found = edges.get(path);
    if (found === undefined) {
      found = importsOf(path, read(path));
      edges.set(path, found);
    }
    return found;
  };

  const violations: Violation[] = [];
  for (const rule of rules) {
    for (const file of files) {
      if (TEST.test(file) || !rule.from.some((prefix) => file.startsWith(prefix))) continue;
      violations.push(...checkFile(rule, file, files, edgesOf));
    }
  }
  return violations;
}

function checkFile(
  rule: Rule,
  start: string,
  files: ReadonlySet<string>,
  edgesOf: (path: string) => readonly ImportEdge[],
): Violation[] {
  const found: Violation[] = [];
  const seen = new Set<string>([start]);
  const queue: { file: string; via: readonly string[] }[] = [{ file: start, via: [] }];
  while (queue.length > 0) {
    const next = queue.shift();
    if (next === undefined) break;
    for (const edge of edgesOf(next.file)) {
      if (edge.typeOnly && !rule.types) continue;
      const reason = judge(rule, edge, next.via.length === 0);
      if (reason !== null) {
        found.push({
          rule: rule.id,
          file: start,
          specifier: edge.specifier,
          via: next.via,
          reason,
        });
      }
      const local = resolveLocal(next.file, edge.specifier, files);
      if (local !== null && !seen.has(local)) {
        seen.add(local);
        queue.push({ file: local, via: [...next.via, local] });
      }
    }
  }
  return found;
}

/** Why an edge breaks the rule, or null. Name restrictions apply to the file's own imports only. */
function judge(rule: Rule, edge: ImportEdge, direct: boolean): string | null {
  if (rule.forbid.some((pattern) => pattern.test(edge.specifier))) {
    return `imports ${edge.specifier}`;
  }
  const only = rule.onlyNames;
  if (direct && edge.specifier === only?.specifier && !edge.typeOnly) {
    const bad = edge.names.filter((name) => !only.allowed.test(name));
    if (bad.length > 0) return `takes ${bad.join(", ")} from ${edge.specifier}`;
  }
  return null;
}
