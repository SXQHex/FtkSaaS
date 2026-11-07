import {calendarProxy} from '../../../transports/calendar-gateway.mjs';
// Calendar clients send a bearer URL, not a Supabase session JWT. Only this
// transport is anonymous. backend-v1 keeps gateway JWT verification enabled.
Deno.serve(async (request:Request)=>{
 try{
  const path=new URL(request.url).pathname;
  const pathPrefix=path.startsWith('/functions/v1/')?'/functions/v1/personal-calendar':'/personal-calendar';
  return await calendarProxy({supabaseUrl:Deno.env.get('SUPABASE_URL'),anonKey:Deno.env.get('SUPABASE_ANON_KEY'),pathPrefix})(request);
 }catch{return new Response(null,{status:503,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});}
});
