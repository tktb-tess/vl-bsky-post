import '@std/dotenv/load';
import { getTotalWords, fetchZpdicWord } from './mod/zpdic-api.ts';

import { createSession, createRecord } from './mod/bluesky-api.ts';
import { ResultAsync } from 'neverthrow';
import { MiscError, formatWord, postDataSchema } from './mod/util.ts';
import * as v from '@valibot/valibot';

const getRandomInt = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min) + min);
};

const main = async () => {
  const identifier = 'vaessenzlaendiskj.bsky.social';
  const password = Deno.env.get('BSKY_PASSWORD');
  const zpdicApiKey = Deno.env.get('ZPDIC_API_KEY');
  const runtime = Deno.env.get('RUNTIME');
  const dicID = '633';

  if (!password) {
    const err = MiscError.from(
      'EnvVariableError',
      `Couldn't get BSKY_PASSWORD`
    );
    console.error(err);
    throw err;
  }

  if (!zpdicApiKey) {
    const err = MiscError.from(
      'EnvVariableError',
      `Couldn't get ZPDIC_API_KEY`
    );
    console.error(err);
    throw err;
  }

  if (!runtime) {
    const err = MiscError.from('EnvVariableError', `Couldn't get RUNTIME`);
    console.error(err);
    throw err;
  }

  if (runtime !== 'local' && runtime !== 'deno-deploy') {
    const err = MiscError.from('EnvVariableError', `RUNTIME is invalid`);
    console.error(err);
    throw err;
  }

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
        (e) => console.error(e)
      );

      const { entry, link, formattedStr } = formatted;

      const task2 = createSession(identifier, password)
        .andThen(({ did, accessJwt }) =>
          createRecord(did, accessJwt, formattedStr, link, entry)
        )
        .match(
          () =>
            console.log(runtime, `: Successfully fetched. post:\n`, formatted),

          (e) => console.error(e)
        );

      const results = await Promise.allSettled([task1, task2]);

      console.log(...results.map(({ status }, i) => `task${i}: ${status}`));

      return;
    }
  }
};

if (Deno.env.get('RUNTIME') === 'local') {
  await main();
}

Deno.cron('Post to Bluesky', '0 * * * *', () => main());

Deno.serve(async () => {
  const headers1 = {
    'Content-Type': 'application/json',
  } as const;

  const headers2 = {
    'Content-Type': 'text/html; charset=utf-8',
  } as const;

  const kv = await Deno.openKv();
  const parsed = v.safeParse(v.string(), (await kv.get(['post data'])).value);

  if (!parsed.success) {
    const e = new v.ValiError(parsed.issues);
    console.error(e);
    return new Response(JSON.stringify(parsed.issues), { headers: headers1 });
  }

  const postR = v.safeParse(postDataSchema, JSON.parse(parsed.output));

  if (!postR.success) {
    const e = new v.ValiError(postR.issues);
    console.error(e);
    return new Response(JSON.stringify(postR.issues), { headers: headers1 });
  }

  const post = postR.output;

  const body = `<p>${post.formattedStr}</p>
<p><a href=${post.link}>${post.link}</a></p>`;

  return new Response(body, { headers: headers2 });
});
