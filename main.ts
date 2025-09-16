import '@std/dotenv/load';
import { getTotalWords, fetchZpdicWord } from './mod/zpdic-api.ts';

import { createSession, createRecord } from './mod/bluesky-api.ts';
import { ResultAsync } from 'neverthrow';
import {
  MiscError,
  formatWord,
  postDataSchema,
  safeParseToResult,
} from './mod/util.ts';
import * as v from '@valibot/valibot';

const getRandomInt = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min) + min);
};

const password = Deno.env.get('BSKY_PASSWORD');
const zpdicApiKey = Deno.env.get('ZPDIC_API_KEY');
const runtime = Deno.env.get('RUNTIME');

if (!password) {
  const err = MiscError.from('EnvVariableError', `Couldn't get BSKY_PASSWORD`);
  console.error(err);
  Deno.exit(-1);
}

if (!zpdicApiKey) {
  const err = MiscError.from('EnvVariableError', `Couldn't get ZPDIC_API_KEY`);
  console.error(err);
  Deno.exit(-1);
}

if (!runtime) {
  const err = MiscError.from('EnvVariableError', `Couldn't get RUNTIME`);
  console.error(err);
  Deno.exit(-1);
}

if (runtime !== 'local' && runtime !== 'deno-deploy') {
  const err = MiscError.from('EnvVariableError', `RUNTIME is invalid`);
  console.error(err);
  Deno.exit(-1);
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
    throw formatResult.error;
  }

  const formatted = formatResult.value;

  switch (runtime) {
    case 'local': {
      console.log(runtime, `: Successfully fetched. post:\n`, formatted);
      return;
    }
    case 'deno-deploy': {
      const taskf1 = ResultAsync.fromThrowable(
        async () => {
          const kv = await Deno.openKv();
          await kv.set(['post data'], JSON.stringify(formatted));
        },
        (e) => {
          if (e instanceof Error) {
            return MiscError.from(e.name, e.message, e);
          } else {
            return MiscError.from('UnidentifiedError', 'Unidentified error', e);
          }
        }
      );

      const task1 = taskf1().match(
        () => console.log('Post data is successfully stored'),
        (e) => {
          console.error(e);
          Deno.exit(-1);
        }
      );

      const { entry, link, formattedStr } = formatted;

      const task2 = createSession(identifier, password)
        .andThen(({ did, accessJwt }) =>
          createRecord(did, accessJwt, formattedStr, link, entry)
        )
        .match(
          () =>
            console.log(runtime, `: Successfully fetched. post:\n`, formatted),

          (e) => {
            console.error(e);
            Deno.exit(-1);
          }
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

Deno.cron('Post to Bluesky', '0 * * * *', () => main());

export default {
  async fetch() {
    const jsonHeader = {
      'Content-Type': 'application/json; charset=utf-8',
    } as const;

    const htmlHeader = {
      'Content-Type': 'text/html; charset=utf-8',
    } as const;

    const kv = await Deno.openKv();
    const parsed = safeParseToResult(
      v.string(),
      (await kv.get(['post data'])).value
    );

    if (parsed.isErr()) {
      const e = parsed.error;
      console.error(e);
      return new Response(JSON.stringify(e), { headers: jsonHeader });
    }

    const postR = safeParseToResult(postDataSchema, JSON.parse(parsed.value));

    if (postR.isErr()) {
      const e = postR.error;
      console.error(e);
      return new Response(JSON.stringify(e), { headers: jsonHeader });
    }

    const post = postR.value;

    const honbun = post.formattedStr
      .split('\n')
      .map((p) => `<p>${p}</p>`)
      .join('');

    const link = `<p><a href=${post.link}>ZpDIC Online</a></p>`;
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
    const body = `<html><head>${style}<title>Hit vässenzländisķ vord</title></head><body>${honbun}${link}</body></html>`;

    return new Response(body, { headers: htmlHeader });
  },
} satisfies Deno.ServeDefaultExport;
