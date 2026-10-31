import {expect,it} from "vitest";
import fs from "node:fs";
import {generateDrizzleJson,generateMigration} from "drizzle-kit/api";
import * as schema from "@/db/schema";
const read=(n:string)=>JSON.parse(fs.readFileSync(`drizzle/meta/${n}_snapshot.json`,"utf8"));
it("0008 snapshot only adds generic columns and indexes",async()=>{
 const previous=read("0007"),snapshot=read("0008");
 expect(snapshot.prevId).toBe(previous.id);
 const statements=await generateMigration(previous,snapshot);
 expect(statements).toHaveLength(4);
 expect(statements.join("\n")).not.toMatch(/DROP|DELETE|TRUNCATE/i);
 expect(Object.keys(snapshot.tables)).toEqual(Object.keys(previous.tables));
});
it("0009 snapshot matches schema and only creates social_posts",async()=>{
 const previous=read("0008"),snapshot=read("0009");
 expect(snapshot.prevId).toBe(previous.id);
 expect(await generateMigration(snapshot,generateDrizzleJson(schema,snapshot.id))).toEqual([]);
 const statements=await generateMigration(previous,snapshot);
 expect(statements.join("\n")).not.toMatch(/DROP|DELETE|TRUNCATE|ALTER/i);
 expect(Object.keys(snapshot.tables).filter(t=>!(t in previous.tables))).toEqual(["public.social_posts"]);
});
