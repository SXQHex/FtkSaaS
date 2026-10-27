import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
test('ST-03 image envelope accepts PNG/JPEG/WebP and rejects active, corrupt, mismatched or oversized bytes',async()=>{
 const {build}=await import('esbuild'),built=await build({entryPoints:['supabase/functions/backend-v1/settings-image.ts'],bundle:true,platform:'browser',format:'esm',write:false});
 const {verifySettingsImage}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
 const fixtures=JSON.parse(fs.readFileSync('tests/fixtures/settings-images.json'));
 const image=(bytes,mime)=>({mime,data_base64:bytes.toString('base64'),checksum:createHash('sha256').update(bytes).digest('hex')});
 for(const [format,data] of Object.entries(fixtures)){
  const bytes=Buffer.from(data,'base64'),value=image(bytes,'image/'+format),result=await verifySettingsImage(value);
  assert.equal(result.image_verified,true);assert.equal(result.image_bytes,bytes.length);assert.equal(result.image_checksum,value.checksum);assert.equal(result.image_mime,value.mime);
  await assert.rejects(verifySettingsImage({...value,checksum:'0'.repeat(64)}),/VALIDATION_FAILED/);
  await assert.rejects(verifySettingsImage({...value,mime:'image/gif'}),/VALIDATION_FAILED/);
  await assert.rejects(verifySettingsImage({...value,data_base64:value.data_base64+'\n'}),/VALIDATION_FAILED/);
  await assert.rejects(verifySettingsImage(image(bytes.subarray(0,12),value.mime)),/VALIDATION_FAILED/);
 }
 for(const bytes of [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),Buffer.from('<html>image</html>'),Buffer.from('GIF89a')])await assert.rejects(verifySettingsImage(image(bytes,'image/png')),/VALIDATION_FAILED/);
 await assert.rejects(verifySettingsImage({mime:'image/png',data_base64:'A'.repeat(1398108),checksum:'0'.repeat(64)}),/VALIDATION_FAILED/);
 const png=Buffer.from(fixtures.png,'base64');png.writeUInt32BE(0,16);await assert.rejects(verifySettingsImage(image(png,'image/png')),/VALIDATION_FAILED/);
 const webp=Buffer.from(fixtures.webp,'base64');webp.writeUInt32LE(0xffffffff,16);await assert.rejects(verifySettingsImage(image(webp,'image/webp')),/VALIDATION_FAILED/);
});
