import '@std/dotenv/load';
import { fetchZpdicWord, getTotalWords } from './mod/zpdic-api.ts';
import { createRecord, createSession } from './mod/bluesky-api.ts';
import { ResultAsync } from 'neverthrow';
import {
  formatWord,
  getRandomInt,
  postDataSchema,
  safeParseResult,
  createErrHandler,
} from './mod/util.ts';
import { NamedError } from './mod/err.ts';
import * as v from '@valibot/valibot';

const password = Deno.env.get('BSKY_PASSWORD');
const zpdicApiKey = Deno.env.get('ZPDIC_API_KEY');
const runtime = Deno.env.get('RUNTIME');

if (!password) {
  const err = new NamedError(
    'EnvVariableError',
    `Couldn't get env 'BSKY_PASSWORD'`,
  );
  console.error(err);
  Deno.exit(1);
}

if (!zpdicApiKey) {
  const err = new NamedError(
    'EnvVariableError',
    `Couldn't get env 'ZPDIC_API_KEY'`,
  );
  console.error(err);
  Deno.exit(1);
}

if (!runtime) {
  const err = new NamedError('EnvVariableError', `Couldn't get env 'RUNTIME'`);
  console.error(err);
  Deno.exit(1);
}

if (runtime !== 'local' && runtime !== 'deno-deploy') {
  const err = new NamedError('EnvVariableError', `env 'RUNTIME' is invalid`);
  console.error(err);
  Deno.exit(1);
}

const main = async () => {
  const identifier = 'vaessenzlaendiskj.bsky.social';
  const dicID = '633';

  const formatResult = await getTotalWords(zpdicApiKey, dicID)
    .andThen((total) => {
      const random = getRandomInt(0, total);

      return fetchZpdicWord(zpdicApiKey, random, dicID);
    })
    .map((word) => formatWord(word));

  if (formatResult.isErr()) {
    console.error(formatResult.error);
    Deno.exit(1);
  }

  const formatted = formatResult.value;

  switch (runtime) {
    case 'local': {
      console.log(runtime, `: Successfully fetched.\npost:`, formatted);
      return;
    }
    case 'deno-deploy': {
      const taskf1 = ResultAsync.fromThrowable(
        async () => {
          const kv = await Deno.openKv();
          await kv.set(['post data'], JSON.stringify(formatted));
        },
        createErrHandler('KVError', 'Failed to store data'),
      );

      const task1 = taskf1().match(
        () => console.log('Post data is successfully stored'),
        (e) => {
          console.error(e);
          Deno.exit(1);
        },
      );

      const { entry, link, formattedStr } = formatted;

      const task2 = createSession(identifier, password)
        .andThen(({ did, accessJwt }) =>
          createRecord(did, accessJwt, formattedStr, link, entry),
        )
        .match(
          () =>
            console.log(runtime, `: Successfully fetched.\npost:`, formatted),
          (e) => {
            console.error(e);
            return;
          },
        );

      const results = await Promise.allSettled([task1, task2]);

      console.log(...results.map(({ status }, i) => `task${i + 1}: ${status}`));

      return;
    }
  }
};

if (runtime === 'local') {
  await main();
}

if (runtime === 'deno-deploy') {
  Deno.cron('Post to Bluesky', '0 * * * *', () => main());
}

export default {
  async fetch() {
    const jsonHeader = {
      'Content-Type': 'application/json; charset=utf-8',
    } as const;

    const htmlHeader = {
      'Content-Type': 'text/html; charset=utf-8',
    } as const;

    const formatHTMLBody = (doc: string) => {
      const style = `<style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Inter', 'Arial', 'Helvetica Neue', 'Noto Sans JP', sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100vh;
      gap: .5rem;
    } 
    </style>`;

      return `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          ${style}
          <title>Hit vässenzländisķ vord</title>
        </head>
        <body>
          ${doc}
        </body>
      </html>`;
    };

    const kv = await Deno.openKv();
    const value = (await kv.get(['post data'])).value;

    if (value == null) {
      const body = formatHTMLBody('Empty');
      return new Response(body, { headers: htmlHeader });
    }

    const parsed = safeParseResult(v.string(), value);

    if (parsed.isErr()) {
      const e = parsed.error;
      console.error(e);
      const body = JSON.stringify({
        message: 'Failed to get valid data from KV',
      });
      return new Response(body, { headers: jsonHeader });
    }

    const postR = safeParseResult(postDataSchema, JSON.parse(parsed.value));

    if (postR.isErr()) {
      const e = postR.error;
      console.error(e);
      const body = JSON.stringify({ message: 'Failed to parse post data' });
      return new Response(body, { headers: jsonHeader });
    }

    const post = postR.value;

    const honbun = post.formattedStr
      .split('\n')
      .map((p) => `<p>${p}</p>`)
      .join('');

    const link = `<p><a href=${post.link}>ZpDIC Online</a></p>`;

    const body = formatHTMLBody(`${honbun}${link}`);

    return new Response(body, { headers: htmlHeader });
  },
} satisfies Deno.ServeDefaultExport;
