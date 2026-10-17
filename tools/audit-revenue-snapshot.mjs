// In-memory verification only: raw hospital data arrives through stdin and is never saved or logged.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} }; cache.set(file, mod.exports);
  new Function("require", "module", "exports", source)(name => name === "@/lib/ksk/datetime" ? load("../src/lib/ksk/datetime.ts") : require(name), mod, mod.exports);
  return mod.exports;
}
try {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  const domain = load("../src/lib/revenue/domain.ts"); const data = domain.revenueSnapshotSchema.parse(JSON.parse(input.replace(/^\uFEFF/, "")));
  const rows = domain.revenueRows(data); const totals = domain.revenueSummary(rows);
  if (!domain.revenueComplete(data)) throw new Error("Incomplete receipt sources.");
  console.log(JSON.stringify({ verified: true, receipts: rows.length, unresolved: totals.unknown, notes: [...new Set(rows.filter(r => r.amount === null).flatMap(r => r.notes))], kinds: Object.keys(domain.revenueKinds).map(kind => ({ kind, count: rows.filter(r => r.kind === kind).length, unresolved: rows.filter(r => r.kind === kind && r.amount === null).length })) }));
} catch { console.error("Revenue policy audit failed; patient payload withheld."); process.exitCode = 1; }
