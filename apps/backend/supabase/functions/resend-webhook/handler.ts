import {emailEvents} from '../backend-v1/email-events.ts';

// This dedicated entry authenticates the provider signature before any RPC.
// Keep backend-v1's platform JWT gate; only this function has verify_jwt=false.
export default {
 fetch:(req:Request)=>emailEvents(req,name=>Deno.env.get(name)),
};
