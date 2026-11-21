import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import worker from '../dist/server/index.js';

const port = Number(process.env.PORT || 8787);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535');
const origin = 'http://127.0.0.1:' + port;

createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, origin);
    if (url.origin !== origin) {
      outgoing.writeHead(400).end();
      return;
    }
    const options = {method: incoming.method, headers: incoming.headers};
    if (incoming.method !== 'GET' && incoming.method !== 'HEAD') {
      options.body = Readable.toWeb(incoming);
      options.duplex = 'half';
    }
    const response = await worker.fetch(new Request(url, options), {MAKE_ENTRY_WEBHOOK: process.env.MAKE_ENTRY_WEBHOOK});
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) await pipeline(Readable.fromWeb(response.body), outgoing);
    else outgoing.end();
  } catch {
    if (!outgoing.headersSent) outgoing.writeHead(500);
    outgoing.end();
  }
}).listen(port, '127.0.0.1', () => console.log('MindReader is available at ' + origin));
