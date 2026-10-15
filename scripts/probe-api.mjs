import {authUser,call} from '../tests/api-client.mjs';
const user=await authUser('probe');
const r=await call(user,'account_get_v1');
console.log(JSON.stringify({status:r.status,result:r.result}));
