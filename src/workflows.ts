import { condition, defineQuery, defineUpdate, setHandler } from '@temporalio/workflow';
import type { State, Client, Opening, Command, Result } from './types';
export const stateQuery = defineQuery<State>('state');
export const commandUpdate = defineUpdate<Result, [Command]>('command');
// One coordinator serializes changes across openings, including client reservations.
export async function salonWorkflow(clients: Client[]): Promise<void> {
 const state: State = {clients, openings:[]};
 let revision = 0;
 const log = (o:Opening,message:string) => o.history.push({at:Date.now(),message});
 const eligible = (o:Opening,c:Client) => !c.fulfilled && c.service === o.service && (!c.stylist || c.stylist === o.stylist) && c.from <= o.start && c.to >= o.start + o.duration*60000;
 function advance(o:Opening) {
  if(o.status !== 'waiting' || o.offers.some(x=>x.status==='active')) return;
  const tried = new Set(o.offers.map(x=>x.clientId));
  const candidates = state.clients.filter(c=>eligible(o,c)&&!tried.has(c.id)).sort((a,b)=>a.joined-b.joined);
  o.remaining = candidates.map(c=>c.name);
  if(o.start-Date.now()<15*60000) {o.status='unfilled';o.reason='Less than 15 minutes remain before the appointment.';log(o,o.reason);return;}
  const busy = new Set(state.openings.flatMap(x=>x.offers.filter(f=>f.status==='active').map(f=>f.clientId)));
  const next = candidates.find(c=>!busy.has(c.id));
  if(!next) {o.status='unfilled';o.reason=!state.clients.some(c=>!c.fulfilled)?'The waitlist is empty.':candidates.length?'Matching clients are considering other offers. Staff can create a new opening to retry.':'No eligible client accepted.';log(o,o.reason);return;}
  const offer = {id:o.id+'-'+(o.offers.length+1),clientId:next.id,clientName:next.name,expires:Date.now()+o.responseMs,status:'active' as const};
  o.offers.push(offer);o.remaining=candidates.filter(c=>c.id!==next.id&&!busy.has(c.id)).map(c=>c.name);o.reason='Waiting for '+next.name;log(o,'Simulated message sent to '+next.name+'. Opening held exclusively.');
 }
 function expire() {
  for(const o of state.openings) for(const f of o.offers) if(f.status==='active'&&f.expires<=Date.now()) {f.status='expired';log(o,f.clientName+' did not respond before the deadline.');advance(o);}
 }
 setHandler(stateQuery,()=>state);
 setHandler(commandUpdate,(cmd):Result=>{
  expire();
  revision++;
  if(cmd.kind==='create') {
   const v=cmd.opening;
   if(state.openings.some(o=>o.id===v.id)) return {ok:false,message:'Opening already exists.'};
   if(!['Haircut','Color','Blowout'].includes(v.service)||!['Lena','Carla'].includes(v.stylist)||!Number.isFinite(v.start)||!Number.isFinite(v.duration)||v.duration<=0||v.duration>480||![15000,900000].includes(v.responseMs)) return {ok:false,message:'Invalid opening details.'};
   if(state.openings.some(o=>!['unavailable','unfilled','stopped'].includes(o.status)&&o.stylist===v.stylist&&v.start<o.start+o.duration*60000&&v.start+v.duration*60000>o.start)) return {ok:false,message:'This stylist already has an overlapping active or confirmed opening.'};
   const o:Opening={...v,status:'waiting',reason:'',offers:[],remaining:[],history:[]};state.openings.unshift(o);log(o,'Opening created by staff.');advance(o);return {ok:true,message:'Opening added.'};
  }
  if(cmd.kind==='respond') {
   const o=state.openings.find(o=>o.offers.some(f=>f.id===cmd.offerId));const f=o?.offers.find(f=>f.id===cmd.offerId);
   if(!o||!f) return {ok:false,message:'Offer not found.'};
   if(f.status!=='active'||o.status!=='waiting') {log(o,'Late or duplicate response from '+f.clientName+' rejected.');return {ok:false,message:'This offer is no longer available. No appointment was created.'};}
   if(cmd.accept) {f.status='accepted';o.status='confirmed';o.reason='Confirmed for '+f.clientName;state.clients.find(c=>c.id===f.clientId)!.fulfilled=true;o.remaining=[];log(o,f.clientName+' accepted. Staff must record the booking in Square.');}
   else {f.status='declined';log(o,f.clientName+' declined. Their waitlist position is retained.');advance(o);}
   return {ok:true,message:cmd.accept?'Your appointment is confirmed.':'Offer declined. You remain on the waitlist.'};
  }
  const o=state.openings.find(o=>o.id===cmd.openingId);
  if(!o) return {ok:false,message:'Opening not found.'};
  if(o.status==='confirmed') return {ok:false,message:'Handle changes to accepted bookings in Square.'};
  for(const f of o.offers) if(f.status==='active') f.status='cancelled';
  o.status=cmd.kind==='unavailable'?'unavailable':'stopped';o.reason=cmd.kind==='unavailable'?'Staff marked this opening unavailable.':'Staff stopped outreach.';o.remaining=[];log(o,o.reason);return {ok:true,message:o.reason};
 });
 while(true) {
  expire();
  const deadlines=state.openings.flatMap(o=>o.offers.filter(f=>f.status==='active').map(f=>f.expires));
  const seen=revision;
  if(deadlines.length) await condition(()=>revision!==seen,Math.max(1,Math.min(...deadlines)-Date.now()));
  else await condition(()=>revision!==seen);
 }
}
