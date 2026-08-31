/**
 * The regulatory verdict must be structurally unreachable by any model.
 *
 * README and JUDGE.md both claim the engine decides and the model only explains.
 * Until this file existed that claim was true by habit and nothing enforced it:
 * a future edit adding `fetch` or a watsonx import under `engine/` would have
 * passed lint, typecheck and every existing test. This guard turns the claim
 * into a failing build.
 *
 * It walks the real TypeScript AST rather than grepping, because a regex counts
 * a matching string inside a comment or a string literal and an AST does not.
 *
 * Borrowed from a rival (batch 11, Fabrivium), which ships an import-graph test
 * asserting its deterministic core cannot transitively reach its LLM layer. The
 * idea is theirs. Converting an architectural promise into a red build rather
 * than a diagram is the part worth stealing.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ENGINE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Every production .ts file under engine/, excluding test directories. */
function productionSources(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      productionSources(full, found);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      found.push(full);
    }
  }
  return found;
}

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.ES2022,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );
}

/** Module specifiers from static imports, `export ... from`, and dynamic import(). */
function moduleSpecifiers(sf: ts.SourceFile): string[] {
  const out: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      out.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      out.push((node.arguments[0] as ts.StringLiteral).text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** Identifiers and property accesses that would reach the network or the environment. */
const FORBIDDEN_CALLS = new Set(['fetch', 'require', 'XMLHttpRequest', 'WebSocket']);

function forbiddenReferences(sf: ts.SourceFile): string[] {
  const hits: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && FORBIDDEN_CALLS.has(node.text)) {
      // Only flag it in a value position, not as a property name or a type.
      const parent = node.parent;
      const isPropertyName =
        parent && ts.isPropertyAccessExpression(parent) && parent.name === node;
      if (!isPropertyName) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        hits.push(`${node.text} at line ${line + 1}`);
      }
    }
    // process.env, in any shape
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'process' &&
      node.name.text === 'env'
    ) {
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      hits.push(`process.env at line ${line + 1}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

describe('engine isolation, the property the whole product rests on', () => {
  const files = productionSources(ENGINE_DIR);

  it('finds engine sources to check, so this suite can never pass vacuously', () => {
    // A guard that walks an empty set is a green check that proves nothing.
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  it('has ZERO non-relative imports anywhere under engine/', () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const spec of moduleSpecifiers(parse(file))) {
        if (!spec.startsWith('.')) {
          offenders.push(`${relative(ENGINE_DIR, file)} imports "${spec}"`);
        }
      }
    }
    // Not "no LLM SDK": no external package at all. A model cannot be reached
    // from code that imports nothing, which is a stronger and cheaper property
    // to hold than an allowlist of banned vendors.
    expect(offenders).toEqual([]);
  });

  it('never calls fetch, require, XMLHttpRequest, WebSocket, or reads process.env', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const sf = parse(file);
      for (const hit of forbiddenReferences(sf)) {
        offenders.push(`${relative(ENGINE_DIR, file)}: ${hit}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
