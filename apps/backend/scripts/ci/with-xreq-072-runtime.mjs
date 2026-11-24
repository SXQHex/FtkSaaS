import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { createReadStream, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { join } from 'node:path';

async function sha256(stream) {
  const hash = createHash('sha256');
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}

const [directory, command, ...args] = process.argv.slice(2);
if (!directory || !command || process.platform !== 'linux' || process.arch !== 'x64') {
  throw Error('XREQ-072 requires a Linux x64 package directory and acceptance command');
}

const upstreamVersion = 'v1.77.9';
const tag = `edge-runtime-${upstreamVersion}-r0`;
const archiveName = `${tag}-linux-amd64.tar.zst`;
const manifestName = `${tag}-linux-amd64.manifest.json`;
const archiveDigest = process.env.FTK_EDGE_ARCHIVE_SHA256;
const manifestDigest = process.env.FTK_EDGE_MANIFEST_SHA256;
const elfDigest = process.env.FTK_EDGE_ELF_SHA256;
const payload = new Map();
for (const [name, expected] of [[archiveName, archiveDigest], [manifestName, manifestDigest]]) {
  const bytes = readFileSync(join(directory, name));
  if (createHash('sha256').update(bytes).digest('hex') !== expected) {
    throw Error(`XREQ-072 runtime digest mismatch: ${name}`);
  }
  payload.set(`/${tag}/${name}`, bytes);
}

const elf = spawn('tar', ['--extract', '--zstd', '--to-stdout', '--file', join(directory, archiveName),
  './bin/.edge-runtime-wrapped'], { stdio: ['ignore', 'pipe', 'inherit'] });
const [[elfStatus], packagedDigest] = await Promise.all([once(elf, 'close'), sha256(elf.stdout)]);
if (elfStatus !== 0 || packagedDigest !== elfDigest) {
  throw Error('XREQ-072 runtime ELF digest mismatch');
}

const lockPath = 'supabase/supabase.lock';
const original = readFileSync(lockPath);
const lock = JSON.parse(original);
// Supabase's lock schema requires a real canonical OCI pin, even for native.
// Preserve official v1.77.9-r0 metadata and substitute only this runner's archive.
lock.services.functions.resolved = {
  upstreamVersion,
  upstreamImage: 'supabase/edge-runtime:v1.77.9',
  image: 'ghcr.io/supabase/cli/edge-runtime:v1.77.9-r0@sha256:1d2d920e96fe72bdff308f855a30a60a51baf4d9c3b396c16b36eb193daf6f61',
  revision: 0,
  natives: {
    'darwin-arm64': {
      archive: 'd2d14cadc53254416c1ecc89dd0575efd4733cb72025ff97495d3a87980acf39',
      manifest: '1d4ae4b525a5b6f5729e811664dbfdf60bb9bc453a5e71abf6947253c20563b0',
    },
    'linux-arm64': {
      archive: '5e247316b1965f84d8748de0da92e4c8d2af20d6d5e6dccdf5da35e7e0dfbff4',
      manifest: '8e259a40d00950f311082b89517ebc04323d3c8106432c88f64e59f61c5c860e',
    },
    'linux-amd64': { archive: archiveDigest, manifest: manifestDigest },
  },
};

const server = createServer((request, response) => {
  const path = request.url;
  const bytes = payload.get(path);
  if (request.method !== 'GET') {
    response.writeHead(405).end();
  } else if (bytes) {
    response.writeHead(200, { 'Content-Length': bytes.length }).end(bytes);
  } else if (/^\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(path) && !path.startsWith(`/${tag}/`)) {
    response.writeHead(307, { Location: `https://github.com/supabase/slim-services/releases/download${path}` }).end();
  } else {
    response.writeHead(404).end();
  }
});

try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const releases = `http://127.0.0.1:${server.address().port}`;
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  console.log(`XREQ-072 archive ${archiveDigest}, ELF ${elfDigest}`);
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: { ...process.env, SUPABASE_INTERNAL_SLIM_RELEASES_URL: releases },
  });
  const [status, signal] = await once(child, 'exit');
  if (status !== 0) throw Error(`Clean acceptance failed: ${signal ?? status}`);
  const supabaseState = process.env.SUPABASE_HOME?.trim() || join(homedir(), '.supabase');
  const installed = join(supabaseState, 'cache', 'stack', 'slim-services', 'edge-runtime',
    `${upstreamVersion}-r0`, 'linux-amd64', archiveDigest, 'bin', '.edge-runtime-wrapped');
  if (await sha256(createReadStream(installed)) !== elfDigest) {
    throw Error('Supabase CLI installed an unexpected XREQ-072 ELF');
  }
  console.log(`XREQ-072 verified Supabase CLI installation: ${elfDigest}`);
} finally {
  server.close();
  writeFileSync(lockPath, original);
}
