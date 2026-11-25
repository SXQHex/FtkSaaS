import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {X509Certificate,createHash} from 'node:crypto';

const spaOrigin='https://app.fethiyetango.com';
const authOrigin='https://gwyprhenabtpkbojephw.supabase.co';
const legacyOrigins=['https://uye.fethiyetango.com','https://ftksaas-web.vercel.app'];
const sessionPath=/^\/organizasyon\/([a-f0-9-]{36})\/seans\/([a-f0-9-]{36})$/;

async function signIn(page,email,password,label) {
  await page.getByLabel(label,{exact:true}).fill(email);
  await page.getByLabel('Parola',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Giriş yap',exact:true}).click();
}

async function acceptLegacyRoute(page,target,email,password) {
  let loggedIn=false;
  try {
    await page.goto(target.origin+'/login');
    assert.equal(new URL(page.url()).origin,target.origin);
    await signIn(page,email,password,'E-posta adresi');
    await page.getByRole('heading',{name:/Merhaba,/}).waitFor();
    loggedIn=true;
    await page.goto(target.href);
    await page.getByRole('heading',{name:'Seans detayı',exact:true}).waitFor();
    await page.getByText('Güncel seans bilgileri yükleniyor…',{exact:true}).waitFor({state:'hidden'});
    assert.equal(await page.locator('main').getByRole('alert').count(),0);
    await page.getByText('Yoklama',{exact:true}).waitFor();
  } finally {
    if(loggedIn){
      await page.goto(target.origin+'/#settings');
      await page.getByRole('button',{name:'Çıkış yap',exact:true}).click();
      await page.waitForURL('**/login');
    }
  }
}

async function acceptSpaRoute(page,target,email,password,org,session) {
  await page.goto(target.href);
  await page.waitForURL(url=>url.origin===spaOrigin&&url.pathname==='/login'&&
    url.searchParams.get('next')===target.pathname);

  const nativeLogin=page.waitForResponse(response=>{
    const url=new URL(response.url());
    return url.origin===authOrigin&&url.pathname==='/auth/v1/token'&&
      url.searchParams.get('grant_type')==='password'&&response.request().method()==='POST'&&response.ok();
  }).then(async response=>({
    accessToken:(await response.json()).access_token,
    apiKey:await response.request().headerValue('apikey')
  })).catch(()=>undefined);

  function readSessionResponse(response,operation,filter) {
    const request=response.request();
    const url=new URL(request.url());
    if(url.origin!==authOrigin||url.pathname!=='/functions/v1/backend-v1/'+operation||
      request.method()!=='POST'||!response.ok())return false;
    const body=request.postDataJSON();
    return body.org_id===org&&body.session_id===session&&filter(body);
  }

  const projection=page.waitForResponse(response=>
    readSessionResponse(response,'session_get_v1',body=>body.include_center_id===true&&
      !Object.hasOwn(body,'center_id'))
  ).then(response=>response.json()).catch(()=>undefined);
  const reservation=page.waitForResponse(response=>
    readSessionResponse(response,'reservation_list_v1',body=>body.include_self_summary===true)
  ).then(async response=>({
    request:response.request().postDataJSON(),
    result:await response.json()
  })).catch(()=>undefined);
  const workspace=page.waitForResponse(async response=>{
    const url=new URL(response.url());
    if(url.origin!==authOrigin||url.pathname!=='/functions/v1/backend-v1/organizations_list_v1'||
      response.request().method()!=='POST'||!response.ok())return false;
    const result=await response.json();
    return result.ok===true&&result.data.items.some(item=>item.id===org&&item.self_context?.person_id);
  }).then(async response=>(await response.json()).data.items.find(item=>item.id===org).self_context)
    .catch(()=>undefined);

  let submitted=false;
  try {
    await signIn(page,email,password,'E-posta');
    submitted=true;
    const resolved=await projection;
    const center=resolved?.data?.center_id;
    assert(resolved?.ok===true&&resolved.data.id===session&&/^[a-f0-9-]{36}$/.test(center));
    const instructorPath='/instructor/sessions/'+session;
    const memberPath='/member/reservations';
    await page.waitForURL(url=>url.origin===spaOrigin&&url.searchParams.get('org')===org&&
      url.searchParams.get('center')===center&&(url.pathname===instructorPath||
        (url.pathname===memberPath&&url.searchParams.get('session')===session)));
    const self=await workspace;
    const membership=self?.centers.find(item=>item.center_id===center);
    assert(membership,'Live session center membership missing');
    if(new URL(page.url()).pathname===instructorPath){
      assert(resolved.data.assignments.some(({person_id,duty})=>
        person_id===self.person_id&&(duty==='instructor'||duty==='assistant')&&membership[duty]===true));
      await page.getByRole('heading',{name:'Yoklama',exact:true}).waitFor();
    }else{
      const own=await reservation;
      assert(membership.student===true&&own?.request.center_id===center&&own.request.person_id===self.person_id);
      assert(own.result.ok===true&&own.result.data.items.length===1);
      const [row]=own.result.data.items;
      assert(row.person_id===self.person_id&&row.session_id===session&&row.state==='active'&&row.self_summary?.title);
      await page.getByRole('heading',{name:'Rezervasyonlarım',exact:true}).waitFor();
      await page.getByText(row.self_summary.title,{exact:true}).waitFor();
    }
    assert.equal(await page.locator('main').getByRole('alert').count(),0);
  } finally {
    // Keep the credential in memory and close only the session this browser opened.
    const login=await nativeLogin;
    if(submitted||login){
      assert(login?.accessToken&&login.apiKey,'Native browser logout receipt unavailable');
      assert.equal(new URL(page.url()).origin,spaOrigin);
      // Use Chromium so logout follows the same proxy and trust configuration as login.
      const status=await page.evaluate(async ({endpoint,apiKey,accessToken})=>{
        const response=await fetch(endpoint,{
          method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
          headers:{apikey:apiKey,authorization:'Bearer '+accessToken}
        });
        return response.status;
      },{endpoint:authOrigin+'/auth/v1/logout?scope=local',...login});
      assert.equal(status,204);
    }
  }
}

export async function acceptCalendarRoute({url,email,password,executablePath,proxy,proxyCertificate}){
  const target=new URL(url);
  assert([spaOrigin,...legacyOrigins].includes(target.origin)&&!target.username&&!target.password);
  const route=sessionPath.exec(target.pathname);
  assert(route&&!target.search&&!target.hash,'Unexpected calendar session URL');
  const {chromium}=createRequire(import.meta.url)(process.env.FTK_PLAYWRIGHT_MODULE??'playwright');
  const args=['--no-sandbox'];
  if(proxy&&proxyCertificate){
    const certificate=new X509Certificate(readFileSync(proxyCertificate));
    assert(certificate.ca);
    args.push('--ignore-certificate-errors-spki-list='+createHash('sha256')
      .update(certificate.publicKey.export({format:'der',type:'spki'})).digest('base64'));
  }
  const browser=await chromium.launch({
    headless:true,executablePath,...(proxy?{proxy:{server:proxy}}:{}),args
  });
  try{
    const page=await browser.newPage({locale:'tr-TR'});
    page.setDefaultTimeout(30000);
    let uncaught=0;
    page.on('pageerror',()=>uncaught++);
    if(target.origin===spaOrigin)await acceptSpaRoute(page,target,email,password,route[1],route[2]);
    else await acceptLegacyRoute(page,target,email,password);
    assert.equal(uncaught,0);
  }catch{
    throw Error('Hosted calendar route or session cleanup failed');
  }finally{
    await browser.close();
  }
}
