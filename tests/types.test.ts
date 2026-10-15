import type {ProductScope} from '../packages/contracts/src/generated.js';
const valid:ProductScope={scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['event']};
// @ts-expect-error organization scope must not carry a center selector
const invalid:ProductScope={scope_kind:'organization_all',center_id:'019fffff-ffff-7fff-8fff-ffffffffffff',discipline_id:null,usage_targets:['lesson']};
void valid;void invalid;
