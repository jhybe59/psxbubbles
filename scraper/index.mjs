import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createQuoteScraper } from './client.mjs';
import { createQuestDbQuoteSink } from './questdb-sink.mjs';

function diagnostic(event, details = {}) {
  process.stderr.write(`${JSON.stringify({ event, ...details })}\n`);
}

export function main(env = process.env) {
  const sink = env.PSXT_QUESTDB_ENABLED === 'true'
    ? createQuestDbQuoteSink({ env })
    : null;
  const outputPath = env.PSXT_OUTPUT;
  const output = outputPath && outputPath !== '-'
    ? createWriteStream(path.resolve(outputPath), { flags: 'a' })
    : process.stdout;

  if (output !== process.stdout) {
    output.on('error', (error) => {
      diagnostic('output_stream_error', { reason: error.message });
      process.exitCode = 1;
    });
  }

  const scraper = createQuoteScraper({
    ...(env.PSXT_SYMBOLS
      ? { symbols: env.PSXT_SYMBOLS }
      : { symbol: env.PSXT_SYMBOL || 'OGDC' }),
    market: env.PSXT_MARKET || 'REG',
    baseUrl: env.PSXT_BASE_URL || 'https://psxterminal.com',
    writeLine: (line) => output.write(`${line}\n`),
    onQuote: sink?.onQuote
  });

  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    scraper.stop();
    if (output !== process.stdout) output.end();
    await sink?.close();
    diagnostic('stopped');
  };

  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  diagnostic('starting', {
    symbols: env.PSXT_SYMBOLS || env.PSXT_SYMBOL || 'OGDC',
    market: env.PSXT_MARKET || 'REG'
  });
  scraper.start();
  return scraper;
}

const isDirectRun = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isDirectRun) main();
