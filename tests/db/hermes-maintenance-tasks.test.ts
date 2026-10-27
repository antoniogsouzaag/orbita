import { expect, it } from "vitest";
import { getDb } from "@/db";
import { tasks } from "@/db/schema";
import { validateMaintenanceTask } from "@/server/hermes-maintenance-tasks";
it("só permite tarefa empresa aberta livre ou atribuída ao Hermes Oracle",async()=>{
 const db=await getDb();
 for(const [scope,status,assignee,allowed] of [["empresa","todo",null,true],["empresa","doing","Hermes Oracle",true],["pessoal","todo",null,false],["empresa","done",null,false],["empresa","todo","Tom",false]] as const){
 const id=crypto.randomUUID();await db.insert(tasks).values({id,title:"Manutenção",scope,status,assignee});
 if(allowed)await expect(validateMaintenanceTask(id)).resolves.toBeUndefined();else await expect(validateMaintenanceTask(id)).rejects.toThrow();
 }
 await expect(validateMaintenanceTask(crypto.randomUUID())).rejects.toThrow();
});
