import {expect,it} from "vitest";
import fs from "node:fs";
import {generateDrizzleJson,generateMigration} from "drizzle-kit/api";
import * as schema from "@/db/schema";
it("0008 snapshot matches schema and only adds generic columns and indexes",async()=>{
 const previous=JSON.parse(fs.readFileSync("drizzle/meta/0007_snapshot.json","utf8"));
 const snapshot=JSON.parse(fs.readFileSync("drizzle/meta/0008_snapshot.json","utf8"));
 expect(snapshot.prevId).toBe(previous.id);
 const current=generateDrizzleJson(schema,snapshot.id);
 expect(await generateMigration(snapshot,current)).toEqual([]);
 const statements=await generateMigration(previous,snapshot);
 expect(statements).toHaveLength(4);
 expect(statements.join("\n")).not.toMatch(/DROP|DELETE|TRUNCATE/i);
 expect(Object.keys(snapshot.tables)).toEqual(Object.keys(previous.tables));
});
