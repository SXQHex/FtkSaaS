import {deletePreparedInvoiceObject} from './p07-storage-erasure.mjs';
import {verifyBoundInvoiceArchive} from './organization-retention-archive.mjs';

const stage='select private.organization_invoice_erasure_stage($1,$2,$3,$4) as result';

export async function eraseArchivedPublishedInvoice({
 worker,attestor,request,invoiceId,reader,sourceProjectRef,apiUrl,serviceKey,fetcher
}){
 if(typeof worker?.query!=='function'||typeof attestor?.query!=='function'||worker===attestor||typeof reader?.get!=='function'){
  throw Error('INVOICE_ERASURE_ATTESTOR_REQUIRED');
 }
 const transition=async(client,phase,digest=null)=>(await client.query(stage,[request,invoiceId,phase,digest])).rows[0]?.result;
 const prepared=await transition(worker,'prepare');
 if(['unbound','held','unconfirmed','completed'].includes(prepared?.state))return prepared;
 if(prepared?.state!=='ready')throw Error('INVOICE_ERASURE_PREPARATION_REQUIRED');
 const digest=await verifyBoundInvoiceArchive({reader,prepared,sourceProjectRef,invoiceId});
 const authorization=await transition(attestor,'authorize',digest);
 if(authorization?.state==='held')return authorization;
 if(authorization?.state!=='authorized')throw Error('INVOICE_ERASURE_AUTHORIZATION_REQUIRED');
 await deletePreparedInvoiceObject({apiUrl,serviceKey,prepared,invoiceId,fetcher});
 const proof=await transition(attestor,'confirm',digest);
 if(proof?.state!=='completed'||proof.archive_receipt_sha256!==digest)throw Error('INVOICE_ERASURE_PROOF_REQUIRED');
 return proof;
}
