import path from "node:path";
import {defineConfig} from "vitest/config";
if(process.env.APPOINTMENT_TEST_DATABASE_URL!=="postgres:///fixture" || !/\/orbita-appointments-fixture-[\w-]+\/socket$/.test(process.env.PGHOST??"")) throw new Error("Disposable scratch-socket fixture database required");
export default defineConfig({
 resolve:{alias:{"@":path.resolve(import.meta.dirname,"src"),"server-only":path.resolve(import.meta.dirname,"tests/server-only-stub.ts")}},
 test:{include:["tests/postgres/appointments.test.ts"],environment:"node",env:{APP_TIMEZONE:"America/Sao_Paulo",DATABASE_URL:process.env.APPOINTMENT_TEST_DATABASE_URL},testTimeout:30000,hookTimeout:30000,maxWorkers:1},
});
