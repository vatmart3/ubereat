// Génère lib/data/demo-assets.ts (photos du seed en base64) à partir de supabase/seed-assets.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = "supabase/seed-assets";
const files = readdirSync(dir).filter((f) => /\.(jpg|png)$/.test(f)).sort();
let out = "// Fichier généré par scripts/embed-demo-assets.mjs — ne pas modifier.\n";
out += "/* eslint-disable */\nexport const DEMO_ASSETS: Record<string, string> = {\n";
for (const f of files) out += `  ${JSON.stringify(f.replace(/\.(jpg|png)$/, ""))}: ${JSON.stringify(readFileSync(join(dir, f)).toString("base64"))},\n`;
out += "};\n";
writeFileSync("lib/data/demo-assets.ts", out);
console.log(`${files.length} fichiers, ${(out.length / 1024).toFixed(0)} Ko`);
