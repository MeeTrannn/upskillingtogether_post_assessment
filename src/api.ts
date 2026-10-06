import {randomUUID} from 'node:crypto';
import path from 'node:path';
import express, { type Request, type Response, type NextFunction } from 'express';
import {Client,Connection,WorkflowExecutionAlreadyStartedError} from '@temporalio/client';
import type {Client as WaitClient, State, Result} from './types';
const app=express();app.use(express.json());app.use(express.static(path.join(process.cwd(),'public')));
let ready:Promise<any>|undefined;
function handle() {return ready ??= (async()=>{
 const client=new Client({connection:await Connection.connect({address:process.env.TEMPORAL_ADDRESS??'localhost:7233'})});
 const from=new Date();from.setHours(0,0,0,0);const to=new Date(from);to.setDate(to.getDate()+1);
 const names=['Maya Chen','Alex Rivera','Sam Patel','Jordan Lee','Riley Brooks','Taylor Kim'];
 const clients:WaitClient[]=names.map((name,i)=>({id:'client-'+i,name,service:i===4?'Color':i===5?'Blowout':'Haircut',stylist:i===1?'Carla':undefined,joined:Date.now()-(6-i)*3600000,from:from.getTime(),to:to.getTime()}));
 try {await client.workflow.start('salonWorkflow',{workflowId:'juniper-salon-v1',taskQueue:'assessment-starter',args:[clients]});}catch(e){if(!(e instanceof WorkflowExecutionAlreadyStartedError))throw e;}
 return client.workflow.getHandle('juniper-salon-v1');
 })().catch(e=>{ready=undefined;throw e;});}
app.get('/api/state',async(_q,r)=>r.json(await (await handle()).query('state')));
app.post('/api/openings',async(q,r)=>{
 const start=Number(q.body.start), duration=Number(q.body.duration);const date=new Date(start), today=new Date();
 if(!Number.isFinite(start)||date.toDateString()!==today.toDateString()) {r.status(400).json({ok:false,message:'Choose an opening today.'});return;}
 const result=await (await handle()).executeUpdate('command',{args:[{kind:'create',opening:{id:randomUUID(),service:q.body.service,stylist:q.body.stylist,start,duration,responseMs:q.body.fast===true?15000:900000}}]});r.json(result);
});
app.post('/api/openings/:id/:action',async(q,r)=>{
 if(!['cancel','unavailable'].includes(q.params.action)){r.sendStatus(404);return;}
 r.json(await (await handle()).executeUpdate('command',{args:[{kind:q.params.action,openingId:q.params.id}]}));
});
// The random offer URL is a capability for this local simulation, not production authentication.
app.get('/api/offers/:id',async(q,r)=>{
 const state=await (await handle()).query('state') as State;
 const o=state.openings.find(o=>o.offers.some(f=>f.id===q.params.id));const f=o?.offers.find(f=>f.id===q.params.id);
 if(!o||!f){r.status(404).json({message:'Offer not found.'});return;}
 r.json({offer:f,opening:{service:o.service,stylist:o.stylist,start:o.start,duration:o.duration}});
});
app.post('/api/offers/:id/respond',async(q,r)=>{
 if(typeof q.body.accept!=='boolean'){r.sendStatus(400);return;}
 r.json(await (await handle()).executeUpdate('command',{args:[{kind:'respond',offerId:q.params.id,accept:q.body.accept}]}));
});
app.use((e:unknown,_q:Request,r:Response,_n:NextFunction)=>{console.error(e);r.status(503).json({message:'Cannot reach the booking service. Check that Temporal and the Worker are running.'});});
app.listen(3000,()=>console.log('Juniper Salon: http://localhost:3000'));
