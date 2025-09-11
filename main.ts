import '@std/dotenv/load';
import {
  getTotalWords,
  fetchZpdicWord,
  WordWithExamples,
} from './mod/zpdic-api.ts';

import { createSession, createRecord } from './mod/bluesky-api.ts';
import { ResultAsync } from 'neverthrow';
import { MiscError } from './mod/util.ts';
import * as v from '@valibot/valibot';

const getRandomInt = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min) + min);
};

const formatWord = (word: WordWithExamples) => {
  const entry = word.name;

  const pronunciation = (() => {
    if (word.pronunciation.includes('/')) {
      return word.pronunciation;
    } else {
      return `/${word.pronunciation}/`;
    }
  })();

  const meaning = word.equivalents
    .map(
      ({ titles, names }, i) =>
        `${i + 1}. ${titles.map((t) => `【${t}】`).join('')} ${names.join(
          ', '
        )}`
    )
    .join('\n');

  const description = (() => {
    const _desc = word.informations.find(({ title }) => title === '説明');
    if (!_desc || !_desc.text) return '';
    const str = `〜${_desc.title}〜
${_desc.text.replaceAll(/[_\\]/g, '')}`;
    return str;
  })();

  const etymology = (() => {
    const _ety = word.informations.find(({ title }) => title === '語源');
    if (!_ety || !_ety.text) return '';
    const str = `〜${_ety.title}〜
${_ety.text.replaceAll(/[_\\]/g, '')}`;
    return str;
  })();

  const tag = `${word.tags.map((t) => `[${t}]`).join(' ')}`;

  const link = `https://zpdic.ziphil.com/dictionary/633?kind=exact&number=${word.number}`;

  const pre = `${entry} ${pronunciation}  ${tag}

${meaning}

${description}

${etymology}`;

  const pre2 = pre
    .replaceAll(/\n{3,}/g, '\n\n')
    .replace(/\n+$/, '')
    .trim();

  return {
    formattedStr: pre2.length > 500 ? pre2.slice(0, 490) + '……' : pre2,
    link,
    entry,
  };
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

// await main();

Deno.cron('Post to Bluesky', '0 * * * *', () => main());

Deno.serve(async () => {
  const headers = {
    'Content-Type': 'application/json',
  } as const;

  const kv = await Deno.openKv();
  const parsed = v.safeParse(v.string(), (await kv.get(['post data'])).value);

  if (!parsed.success) {
    const e = new v.ValiError(parsed.issues);
    console.error(e);
    return new Response(JSON.stringify(parsed.issues), { headers });
  }

  return new Response(parsed.output, { headers });
});
