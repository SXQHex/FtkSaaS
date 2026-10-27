import type {ProductScope} from '@ftksaas/api-contracts';
const valid:ProductScope={scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['event']};
// @ts-expect-error organization scope must not carry a center selector
const invalid:ProductScope={scope_kind:'organization_all',center_id:'019fffff-ffff-7fff-8fff-ffffffffffff',discipline_id:null,usage_targets:['lesson']};
void valid;void invalid;

import {createBackendClient} from '@ftksaas/api-contracts/client';
const client=createBackendClient({functionsUrl:'http://127.0.0.1:54321/functions/v1/backend-v1',publishableKey:'synthetic',getAccessToken:async()=>null});
// @ts-expect-error unknown operation must not become callable through the shared package
void client.call('invented_operation_v1',{});
void client;
