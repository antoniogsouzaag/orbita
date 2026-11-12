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
 const statements=await generateMigration(previous,snapshot);
 expect(statements.join("\n")).not.toMatch(/DROP|DELETE|TRUNCATE|ALTER/i);
 expect(Object.keys(snapshot.tables).filter(t=>!(t in previous.tables))).toEqual(["public.social_posts"]);
});
it("0010 snapshot matches schema and only creates social_media",async()=>{
 const previous=read("0009"),snapshot=read("0010");
 expect(snapshot.prevId).toBe(previous.id);
 const statements=await generateMigration(previous,snapshot);
 expect(statements.join(" ")).not.toMatch(/DROP |TRUNCATE|DELETE FROM/i);
 expect(statements.filter(s=>/ALTER TABLE/i.test(s)).every(s=>/"social_media" ADD CONSTRAINT/.test(s))).toBe(true);
 expect(Object.keys(snapshot.tables).filter(t=>!(t in previous.tables))).toEqual(["public.social_media"]);
});
it("0011 snapshot only relaxes/extends social_media",async()=>{
 const previous=read("0010"),snapshot=read("0011");
 expect(snapshot.prevId).toBe(previous.id);
 const statements=await generateMigration(previous,snapshot);
 expect(statements.join(" ")).not.toMatch(/DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM/i);
 expect(statements.every(s=>/"social_media"/.test(s))).toBe(true);
});
it("0012 only adds appointment tables",async()=>{
 const previous=read("0011"),snapshot=read("0012");
 expect(snapshot.prevId).toBe(previous.id);
 for(const table of Object.keys(previous.tables)) expect(snapshot.tables[table]).toEqual(previous.tables[table]);
 expect(Object.keys(snapshot.tables).filter(t=>!(t in previous.tables)).sort()).toEqual(["public.appointment_history","public.appointment_requests","public.appointments","public.calendar_write_lock"]);
 const statements=await generateMigration(previous,snapshot);
 expect(statements).toHaveLength(8);
 expect(statements.join(" ")).not.toMatch(/DROP|TRUNCATE|DELETE FROM/i);
 expect(statements.filter(s=>/ALTER TABLE/i.test(s)).every(s=>/"appointment(?:s|_history)" ADD CONSTRAINT/.test(s))).toBe(true);
});
it("0013 matches the entire schema and only adds a durable operational receipt",async()=>{
 const previous=read("0012"),snapshot=read("0013");
 expect(snapshot.prevId).toBe(previous.id);
 expect(await generateMigration(snapshot,generateDrizzleJson(schema,snapshot.id))).toEqual([]);
 const statements=await generateMigration(previous,snapshot);
 expect(statements).toHaveLength(2);
 expect(statements.join(" ")).not.toMatch(/DROP|TRUNCATE|DELETE FROM/i);
 expect(statements.every(s=>/ops_events/.test(s))).toBe(true);
 expect(statements.join(" ")).toContain('ADD COLUMN "receipt_key"');
 expect(statements.join(" ")).toContain('CREATE UNIQUE INDEX "ops_events_receipt_key_idx"');
});
