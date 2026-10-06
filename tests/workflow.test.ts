import assert from 'node:assert/strict';
import {test} from 'node:test';
import {TestWorkflowEnvironment} from '@temporalio/testing';
import {Worker} from '@temporalio/worker';
import type {State,Result} from '../src/types';

test('salon reservations, declines, deadlines, late replies and cancellation',async()=>{
 const env=await TestWorkflowEnvironment.createTimeSkipping();
 try {
 const worker=await Worker.create({connection:env.nativeConnection,taskQueue:'salon-test',workflowsPath:require.resolve('../src/workflows')});
 await worker.runUntil(async()=>{
 const now=await env.currentTimeMs();
 const clients=['First','Second','Third'].map((name,i)=>({id:name,name,service:'Haircut',joined:i,from:now-3600000,to:now+86400000}));
 const h=await env.client.workflow.start('salonWorkflow',{workflowId:'test-salon',taskQueue:'salon-test',args:[clients]});
 const command=(c:any)=>h.executeUpdate<Result, [any]>('command',{args:[c]});
 const state=()=>h.query<State>('state');
 const opening=(id:string,stylist='Lena',offset=7200000)=>({kind:'create',opening:{id,service:'Haircut',stylist,start:now+offset,duration:60,responseMs:15000}});
 assert.equal((await command(opening('one'))).ok,true);
 assert.equal((await command(opening('overlap'))).ok,false);
 assert.equal((await command(opening('two','Carla'))).ok,true);
 let s=await state();
 assert.equal(s.openings.find(o=>o.id==='one')!.offers[0].clientId,'First');
 assert.equal(s.openings.find(o=>o.id==='two')!.offers[0].clientId,'Second');
 await command({kind:'respond',offerId:'one-1',accept:false});
 s=await state();assert.equal(s.openings.find(o=>o.id==='one')!.offers[1].clientId,'Third');
 assert.equal((await command({kind:'respond',offerId:'one-2',accept:true})).ok,true);
 assert.equal((await command({kind:'respond',offerId:'one-2',accept:true})).ok,false);
 assert.equal((await command({kind:'unavailable',openingId:'one'})).ok,false);
 s=await state();assert.equal(s.clients.find(c=>c.id==='Third')!.fulfilled,true);assert.equal(s.clients[0].fulfilled,undefined);
 await env.sleep(16000);
 s=await state();assert.equal(s.openings.find(o=>o.id==='two')!.offers[0].status,'expired');
 assert.equal((await command({kind:'respond',offerId:'two-1',accept:true})).ok,false);
 await command({kind:'unavailable',openingId:'two'});
 assert.equal((await command({kind:'respond',offerId:'two-2',accept:true})).ok,false);
 await command(opening('late','Lena',600000));s=await state();assert.equal(s.openings.find(o=>o.id==='late')!.status,'unfilled');
 await h.terminate();
 });
 }finally{await env.teardown();}
});
