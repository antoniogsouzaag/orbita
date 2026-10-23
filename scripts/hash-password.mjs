// Gera ORBITA_PASSWORD_HASH sem deixar a senha em texto puro no ambiente.
// Uso: node scripts/hash-password.mjs   (a senha é pedida no terminal)
import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline";

const rl = createInterface({ input: process.stdin, output: process.stdout });
rl.question("Senha da Órbita: ", (pw) => {
  rl.close();
  if (pw.length < 10) {
    console.error("Use pelo menos 10 caracteres.");
    process.exit(1);
  }
  const N = 16384;
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 32, { N, r: 8, p: 1 });
  console.log(`\nORBITA_PASSWORD_HASH=scrypt$${N}$${salt.toString("base64")}$${hash.toString("base64")}`);
});
