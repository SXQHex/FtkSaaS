import nodemailer from 'nodemailer';import {createHash,createDecipheriv} from 'node:crypto';import {connect,stackStatus} from './db.mjs';import {fileURLToPath} from 'node:url';
export async function deliverDevInvitation(jobId){
 const s=stackStatus(),db=await connect();try{
  const row=(await db.query("select d.*,i.org_id,i.state,i.expires_at,i.inviter_account_id,i.center_id,i.person_id from private.invitation_deliveries d join core.invitations i on i.id=d.invitation_id join core.outbox_jobs j on j.id=d.job_id where d.job_id=$1 and j.state in ('pending','retry_wait')",[jobId])).rows[0];
  if(!row)throw new Error('INVITATION_JOB_NOT_PENDING');
  if(!row.recipient.endsWith('@ftksaas.invalid'))throw new Error('SYNTHETIC_RECIPIENT_REQUIRED');
  const live=(await db.query("select private.can_invite($1,private.person_for($1,$2),$3,$4) allowed,private.access_mode($1) mode",[row.org_id,row.inviter_account_id,row.center_id,row.person_id])).rows[0];
  if(row.state!=='pending'||new Date(row.expires_at)<=new Date()||!live.allowed||live.mode!=='normal'){await db.query("update core.outbox_jobs set state='cancelled' where id=$1",[jobId]);throw new Error('INVITATION_UNAVAILABLE');}
  const sealed=JSON.parse(row.sealed_token),all=Buffer.from(sealed.cipher,'base64'),key=createHash('sha256').update(s.env.SERVICE_ROLE_KEY).digest();
  const cipher=createDecipheriv('aes-256-gcm',key,Buffer.from(sealed.iv,'base64'));cipher.setAuthTag(all.subarray(-16));const token=Buffer.concat([cipher.update(all.subarray(0,-16)),cipher.final()]).toString();
  const endpoint=s.endpoints?.['mail.smtp'];if(!endpoint||endpoint.address!=='127.0.0.1')throw new Error('LOCAL_SMTP_REQUIRED');
  await db.query("update core.outbox_jobs set state='running',attempts=attempts+1,lease_until=now()+interval '2 minutes' where id=$1",[jobId]);
  const transporter=nodemailer.createTransport({host:'127.0.0.1',port:endpoint.port,secure:false,ignoreTLS:true});
  await transporter.sendMail({from:'FtkSaaS development <no-reply@ftksaas.invalid>',to:row.recipient,subject:'FtkSaaS account access',text:'Synthetic local development invitation.\nToken: '+token+'\nOrganization: '+row.org_id});
  await db.query("update core.outbox_jobs set state='succeeded',lease_until=null,provider_reference='local-mailpit' where id=$1",[jobId]);return {job_id:jobId,state:'succeeded'};
 }finally{await db.end();}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){console.log(JSON.stringify(await deliverDevInvitation(process.argv[2])));}
