export type Client = { id: string; name: string; service: string; stylist?: string; joined: number; from: number; to: number; fulfilled?: boolean };
export type Offer = { id: string; clientId: string; clientName: string; expires: number; status: 'active'|'accepted'|'declined'|'expired'|'cancelled' };
export type Opening = { id: string; service: string; stylist: string; start: number; duration: number; responseMs: number; status: 'waiting'|'confirmed'|'unfilled'|'unavailable'|'stopped'; reason: string; offers: Offer[]; remaining: string[]; history: { at: number; message: string }[] };
export type State = { clients: Client[]; openings: Opening[] };
export type Command = { kind: 'create'; opening: Pick<Opening,'id'|'service'|'stylist'|'start'|'duration'|'responseMs'> } | {kind:'respond'; offerId:string; accept:boolean} | {kind:'cancel'|'unavailable'; openingId:string};
export type Result = {ok:boolean; message:string};
