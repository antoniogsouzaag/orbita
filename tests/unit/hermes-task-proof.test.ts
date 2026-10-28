import {expect,it} from "vitest";
import {taskProof} from "@/lib/hermes-task-proof";
import {verifiedTask} from "@/lib/director-requests";
it("exact completion proof requires bounded session and meaningful evidence in UI too",()=>{
 const proof={task_execution:true,verified:true,task_id:"12345678-1234-4234-8234-123456789abc",response_text:"Done",session_id:"session-123",evidence:["Native receipt"]};
 expect(taskProof.safeParse(proof).success).toBe(true);
 for(const invalid of [{...proof,session_id:undefined},{...proof,session_id:" "},{...proof,session_id:"x".repeat(201)},{...proof,evidence:[]},{...proof,evidence:[" "]},{...proof,unknown:true}]) expect(taskProof.safeParse(invalid).success).toBe(false);
 const row={id:proof.task_id,action:"task.dispatch" as const,status:"completed" as const,createdAt:"",checkedAt:"",detail:"",taskExecution:true as const,verified:true as const,taskId:proof.task_id,responseText:"Done"};
 expect(verifiedTask(row)).toBe(false);expect(verifiedTask({...row,sessionId:proof.session_id,evidence:proof.evidence})).toBe(true);
});
