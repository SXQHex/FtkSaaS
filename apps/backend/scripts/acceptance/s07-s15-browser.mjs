import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {readFileSync} from 'node:fs';
import {X509Certificate,createHash} from 'node:crypto';

// Deliberately opt-in. Uses a separately installed Playwright and a dedicated
// browser; neither the user's Chrome profile nor its extension is involved.
export async function acceptBrowser({email,password,org,session,executablePath,proxy,proxyCertificate}){
 assert(email&&password,'Authorized test credentials required');
 assert(org&&session,'Existing authorized session identifiers required');
 const {chromium}=createRequire(import.meta.url)(process.env.FTK_PLAYWRIGHT_MODULE??'playwright');
 const args=['--no-sandbox'];
 if(proxy&&proxyCertificate){
  const certificate=new X509Certificate(readFileSync(proxyCertificate));assert(certificate.ca,'Expected proxy CA');
  const fingerprint=createHash('sha256').update(certificate.publicKey.export({format:'der',type:'spki'})).digest('base64');
  args.push('--ignore-certificate-errors-spki-list='+fingerprint);
 }
 let phase='browser launch',browser,page;const checks=[];let uncaught=0;
 try{
  browser=await chromium.launch({headless:true,executablePath,...(proxy?{proxy:{server:proxy}}:{}),args});
  page=await browser.newPage();page.setDefaultTimeout(30000);
  page.on('pageerror',()=>{uncaught++;});
  const origin='https://ftksaas-web.vercel.app';
  phase='native login';
  await page.goto(origin+'/login');
  await page.getByLabel('E-posta adresi').fill(email);
  await page.getByLabel('Parola',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Giriş yap',exact:true}).click();
  await page.getByRole('heading',{name:/Merhaba,/}).waitFor();checks.push('native password login');
  phase='account read';await page.goto(origin+'/account');
  await page.getByRole('heading',{name:'İletişim ve parola',exact:true}).waitFor();
  await page.getByRole('heading',{name:'Aktif oturumlar',exact:true}).waitFor();checks.push('real account and native sessions rendered');
  phase='same password rejection';await page.getByText('Parolayı değiştir',{exact:true}).click();
  await page.getByLabel('Mevcut parola',{exact:true}).fill(password);
  await page.getByLabel('Yeni parola',{exact:true}).fill(password);
  await page.getByLabel('Yeni parolayı tekrar yaz',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Parolayı kaydet',exact:true}).click();
  await page.getByText('Yeni parola mevcut paroladan farklı olmalı.',{exact:true}).waitFor();
  checks.push('native same-password rejection shown');
  phase='session route';await page.goto(origin+'/organizasyon/'+org+'/seans/'+session);
  await page.getByRole('heading',{name:'Seans detayı',exact:true}).waitFor();
  await page.getByText('Güncel seans bilgileri yükleniyor…',{exact:true}).waitFor({state:'hidden'});
  assert.equal(await page.locator('main').getByRole('alert').count(),0);
  await page.getByText('Yoklama',{exact:true}).waitFor();checks.push('authorized real session route loaded');
  phase='unknown invitation';await page.goto(origin+'/invite');
  await page.getByLabel('Davet kodu',{exact:true}).fill('0'.repeat(64));
  await page.getByRole('button',{name:'Daveti kabul et',exact:true}).click();
  await page.locator('main').getByRole('alert').getByText('Davet bu hesap için kullanılamıyor; süresi dolmuş, iptal edilmiş veya başka hesaba ait olabilir.',{exact:true}).waitFor();
  checks.push('unknown invitation rejected');
  assert.equal(uncaught,0);checks.push('no uncaught browser exceptions');
  phase='sign out';await page.goto(origin+'/#settings');
  await page.getByRole('button',{name:'Çıkış yap',exact:true}).click();
  await page.waitForURL('**/login');checks.push('native sign out');
  return {status:'passed',scope:'routes and same-password rejection',checks};
 }catch{
  throw Error('Hosted browser acceptance failed at '+phase+'; no credentials or page contents recorded');
 }finally{
  // No storageState, screenshots, traces, video, page text or provider payloads.
  if(browser)await browser.close();
 }
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 try{console.log(JSON.stringify(await acceptBrowser({email:process.env.FTK_ACCEPTANCE_EMAIL,password:process.env.FTK_ACCEPTANCE_PASSWORD,org:process.env.FTK_ACCEPTANCE_ORG,session:process.env.FTK_ACCEPTANCE_SESSION,executablePath:process.env.FTK_PLAYWRIGHT_CHROMIUM,proxy:process.env.HTTPS_PROXY,proxyCertificate:process.env.CODEX_PROXY_CERT})));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
