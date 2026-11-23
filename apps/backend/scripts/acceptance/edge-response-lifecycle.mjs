import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

const [path, digest, libraryPath] = process.argv.slice(2);
assert(path && /^[a-f0-9]{64}$/.test(digest ?? ''),
  'Usage: node edge-response-lifecycle.mjs <runtime ELF> <sha256> [library path]');
const binary = resolve(path);
const hash = createHash('sha256');
for await (const chunk of createReadStream(binary)) hash.update(chunk);
assert.equal(hash.digest('hex'), digest, 'Runtime ELF SHA-256 mismatch');

test('native oneshot completes the outer response and retires the worker', { timeout: 90000 }, async (t) => {
  const fixture = await mkdtemp(join(tmpdir(), 'ftk-edge-lifecycle-'));
  const main = join(fixture, 'main');
  const user = join(fixture, 'user');
  const events = join(fixture, 'events');
  await Promise.all([main, user, events].map((directory) => mkdir(directory)));

  await writeFile(join(main, 'index.js'), `
    Deno.serve(async (request) => {
      const route = new URL(request.url).pathname;
      if (route === '/health') return new Response('ready');
      const worker = await EdgeRuntime.userWorkers.create({
        servicePath: ${JSON.stringify(user)},
        forceCreate: false,
        noModuleCache: false,
        noNpm: true,
        envVars: [],
        memoryLimitMb: 256,
        cpuTimeSoftLimitMs: 1000,
        cpuTimeHardLimitMs: 2000,
        workerTimeoutMs: route === '/wall' ? 600 : 400000,
      });
      const response = await worker.fetch(request);
      if (!['/json', '/empty', '/buffered-stream'].includes(route)) return response;
      const bytes = await response.arrayBuffer();
      // Exercise the gap between consuming the inner body and returning the outer response.
      await new Promise((resolve) => setTimeout(resolve, 50));
      return new Response(response.status === 204 ? null : bytes, {
        status: response.status,
        headers: response.headers,
      });
    });`);
  await writeFile(join(user, 'index.js'), `
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const encoder = new TextEncoder();
    Deno.serve(async (request) => {
      const route = new URL(request.url).pathname;
      console.log('ftk-fixture-start ' + route);
      switch (route) {
        case '/json': return Response.json({ body: await request.text() });
        case '/empty': return new Response(null, { status: 204 });
        case '/buffered-stream':
        case '/direct-stream':
        case '/cancel-stream':
          let timer;
          return new Response(new ReadableStream({
            start(stream) {
              stream.enqueue(encoder.encode('first'));
              timer = setTimeout(() => {
                stream.enqueue(encoder.encode('second'));
                stream.close();
              }, route === '/cancel-stream' ? 30000 : 20);
            },
            cancel() { clearTimeout(timer); },
          }));
        case '/cancel-pending':
        case '/wall':
          await wait(30000);
          return new Response('too late');
        case '/cpu': {
          for (let index = 0; index < 150; index++) {
            const deadline = performance.now() + 25;
            while (performance.now() < deadline) Math.sqrt(deadline);
            await wait(1);
          }
          return new Response('CPU limit missed');
        }
        case '/memory': {
          const retained = [];
          for (let index = 0; index < 64; index++) {
            retained.push(new Uint8Array(8 * 1024 * 1024).fill(1));
            await wait(5);
          }
          return new Response(String(retained.length));
        }
        default: return new Response('unknown route', { status: 404 });
      }
    });`);
  await writeFile(join(events, 'index.js'), `
    for await (const event of new EventManager()) {
      if (event?.event_type === 'Shutdown' || event?.event_type === 'Log') {
        console.log('FTK_RUNTIME_EVENT ' + JSON.stringify(event));
      }
    }`);

  const socket = createServer();
  await new Promise((accept, reject) => {
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', accept);
  });
  const { port } = socket.address();
  await new Promise((accept, reject) => socket.close((error) => error ? reject(error) : accept()));
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(binary, ['start', '--ip', '127.0.0.1', '--port', String(port),
    '--policy', 'oneshot', '--main-service', main, '--event-worker', events,
    '--graceful-exit-timeout', '1', '--event-worker-exit-timeout', '1'], {
    cwd: fixture,
    env: { PATH: process.env.PATH, DENO_DIR: join(fixture, 'deno'),
      ...(libraryPath ? { LD_LIBRARY_PATH: resolve(libraryPath) } : {}) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const log = [];
  const shutdowns = [];
  const starts = [];
  const stopped = new AbortController();
  function observe(line) {
    log.push(line);
    if (log.length > 40) log.shift();
    const marker = 'FTK_RUNTIME_EVENT ';
    const index = line.indexOf(marker);
    if (index === -1) return;
    const { event_type: type, event } = JSON.parse(line.slice(index + marker.length));
    if (type === 'Shutdown') shutdowns.push(event.reason);
    if (type === 'Log' && event.msg.startsWith('ftk-fixture-start '))
      starts.push(event.msg.trim());
  }
  for (const stream of [child.stdout, child.stderr])
    createInterface({ input: stream }).on('line', observe);
  const exit = new Promise((accept) => {
    child.once('error', (error) => {
      log.push(error.message);
      accept();
    });
    child.once('close', accept);
  }).finally(() => stopped.abort());
  t.after(async () => {
    child.kill('SIGTERM');
    try {
      await delay(4000, undefined, { signal: stopped.signal });
      child.kill('SIGKILL');
    } catch (error) {
      if (error.name !== 'AbortError') throw error;
    }
    await exit;
    await rm(fixture, { recursive: true, force: true });
  });

  async function waitFor(check, description, timeout = 5000) {
    const deadline = performance.now() + timeout;
    while (performance.now() < deadline && !stopped.signal.aborted) {
      if (await check()) return;
      await delay(15);
    }
    assert.fail(`${description}\n${log.join('\n')}`);
  }
  const request = (route, { signal, ...options } = {}) =>
    fetch(base + route, { ...options, signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(10000)])
      : AbortSignal.timeout(10000) });
  await waitFor(async () => {
    try {
      return await (await request('/health', { signal: AbortSignal.timeout(500) })).text() === 'ready';
    } catch (error) {
      if (!(error instanceof TypeError) && error.name !== 'TimeoutError') throw error;
      return false;
    }
  }, 'Native runtime failed to start');

  async function retires(reason, exercise) {
    const previous = shutdowns.length;
    await exercise();
    await waitFor(() => shutdowns.length > previous, `Expected worker shutdown: ${reason}`);
    assert.deepEqual(shutdowns.slice(previous), [reason]);
  }

  for (const [route, status, body] of [
    ['/json', 200, '{"body":"sentinel"}'],
    ['/empty', 204, ''],
    ['/buffered-stream', 200, 'firstsecond'],
    ['/direct-stream', 200, 'firstsecond'],
  ]) {
    await t.test(route, () => retires('EarlyDrop', async () => {
      const response = await request(route, route === '/json'
        ? { method: 'POST', body: 'sentinel' } : {});
      const received = await response.text();
      assert.equal(response.status, status, `Expected success for ${route}; received ${received}`);
      assert.equal(received, body);
    }));
  }

  await t.test('client aborts before response headers', () => retires('EarlyDrop', async () => {
    const abort = new AbortController();
    const pending = assert.rejects(request('/cancel-pending', { signal: abort.signal }),
      { name: 'AbortError' });
    await Promise.all([
      pending,
      waitFor(() => starts.includes('ftk-fixture-start /cancel-pending'),
        'User worker did not begin the request').finally(() => abort.abort()),
    ]);
  }));

  await t.test('client aborts after the stream begins', () => retires('EarlyDrop', async () => {
    const abort = new AbortController();
    try {
      const response = await request('/cancel-stream', { signal: abort.signal });
      assert.equal(response.status, 200);
      const reader = response.body.getReader();
      assert.equal(new TextDecoder().decode((await reader.read()).value), 'first');
      abort.abort();
      await assert.rejects(reader.read(), { name: 'AbortError' });
    } finally {
      abort.abort();
    }
  }));

  for (const [route, reason] of [['/wall', 'WallClockTime'], ['/cpu', 'CPUTime'], ['/memory', 'Memory']]) {
    await t.test(`${reason} still fails`, () => retires(reason, async () => {
      const response = await request(route);
      await response.text();
      // The JS handler and outer transport can observe termination in either order.
      assert([500, 503].includes(response.status), `Unexpected limit response: ${response.status}`);
    }));
  }

  await t.test('repeated requests retire one worker per response within the host limit', async () => {
    const previous = shutdowns.length;
    for (let batch = 0; batch < 25; batch++) {
      await Promise.all(Array.from({ length: 2 }, async () => {
        const response = await request('/json', { method: 'POST', body: 'sentinel' });
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { body: 'sentinel' });
      }));
    }
    await waitFor(() => shutdowns.length >= previous + 50, 'Workers did not retire');
    assert.deepEqual(shutdowns.slice(previous), Array(50).fill('EarlyDrop'));
    const memory = await readFile(`/proc/${child.pid}/status`, 'utf8');
    const peak = Number(/^VmHWM:\s+(\d+) kB/m.exec(memory)?.[1]);
    assert(Number.isSafeInteger(peak) && peak > 0 && peak < 3 * 1024 * 1024,
      `Native Edge peak RSS exceeded the host limit: ${peak} KiB`);
    t.diagnostic(`Runtime SHA-256 ${digest}; peak RSS ${peak} KiB`);
  });
});
