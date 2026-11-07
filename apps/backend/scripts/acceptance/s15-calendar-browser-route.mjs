import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {X509Certificate,createHash} from 'node:crypto';

export async function acceptCalendarRoute({url,email,password,executablePath,proxy,proxyCertificate}){
 const target=new URL(url);assert.equal(target.protocol,'https:');assert(['uye.fethiyetango.com','ftksaas-web.vercel.app'].includes(target.hostname));
 assert.match(target.pathname,/^\/organizasyon\/[a-f0-9-]{36}\/seans\/[a-f0-9-]{36}$/);assert.equal(target.search,'');assert.equal(target.hash,'');
 const {chromium}=createRequire(import.meta.url)(process.env.FTK_PLAYWRIGHT_MODULE??'playwright');
 const args=['--no-sandbox'];if(proxy&&proxyCertificate){const certificate=new X509Certificate(readFileSync(proxyCertificate));assert(certificate.ca);args.push('--ignore-certificate-errors-spki-list='+createHash('sha256').update(certificate.publicKey.export({format:'der',type:'spki'})).digest('base64'));}
 const browser=await chromium.launch({headless:true,executablePath,...(proxy?{proxy:{server:proxy}}:{}),args});let page,loggedIn=false;let cleanupFailed=false;
 try{
  page=await browser.newPage();page.setDefaultTimeout(30000);let uncaught=0;page.on('pageerror',()=>uncaught++);
  await page.goto(target.origin+'/login');await page.getByLabel('E-posta adresi').fill(email);await page.getByLabel('Parola',{exact:true}).fill(password);await page.getByRole('button',{name:'Giriş yap',exact:true}).click();await page.getByRole('heading',{name:/Merhaba,/}).waitFor();loggedIn=true;
  await page.goto(url);await page.getByRole('heading',{name:'Seans detayı',exact:true}).waitFor();await page.getByText('Güncel seans bilgileri yükleniyor…',{exact:true}).waitFor({state:'hidden'});assert.equal(await page.locator('main').getByRole('alert').count(),0);await page.getByText('Yoklama',{exact:true}).waitFor();assert.equal(uncaught,0);
 }finally{
  if(loggedIn)try{await page.goto(target.origin+'/#settings');await page.getByRole('button',{name:'Çıkış yap',exact:true}).click();await page.waitForURL('**/login');}catch{cleanupFailed=true;}
  await browser.close();if(cleanupFailed)throw Error('Calendar route browser logout requires inspection');
 }
}
