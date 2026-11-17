import fs from "node:fs";
import ts from "typescript";

// Artefato de publicação para o Code node; sem credenciais ou dados de clientes.
const source = fs.readFileSync(new URL("../../src/lib/reminder-outcome.ts", import.meta.url), "utf8").replace("export function", "function");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText;
const jsCode = compiled + '\nreturn $input.all().map((item, index) => ({json: classifyReminderOutcome(item.json), pairedItem: {item: index}}));\n';
process.stdout.write(jsCode);
