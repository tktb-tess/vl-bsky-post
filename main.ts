import '@std/dotenv/load';
import {
  getTotalWords,
  fetchZpdicWord,
  WordWithExamples,
  zpdicResponseSchema,
} from './mod/zpdic-api.ts';

import { createSession, createRecord } from './mod/bluesky-api.ts';
import { err, errAsync, ResultAsync } from 'neverthrow';
import { HttpError, MiscError } from './mod/util.ts';
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

const main = () => {
  const identifier = 'vaessenzlaendiskj.bsky.social';
  const password = Deno.env.get('BSKY_PASSWORD');
  const zpdicApiKey = Deno.env.get('ZPDIC_API_KEY');
  const dicID = '633';

  type KeyAndTotal = {
    zpdicApiKey: string;
    total: number;
  };

  const checkEnv = (): ResultAsync<
    KeyAndTotal,
    HttpError | v.ValiError<typeof zpdicResponseSchema> | MiscError
  > => {
    if (!zpdicApiKey) {
      return errAsync(MiscError('EnvVarError', 'cannot get ZPDIC_API_KEY'));
    }
    return getTotalWords(zpdicApiKey, dicID).map((total) => ({
      zpdicApiKey,
      total,
    }));
  };

  checkEnv()
    .andThen(({ total, zpdicApiKey }) => {
      const random = getRandomInt(0, total);
      return fetchZpdicWord(zpdicApiKey, random, dicID);
    })
    .map((word) => {
      const formatted = formatWord(word);
      return formatted;
    })
    .andThen(({ entry, link, formattedStr }) => {
      if (!password) {
        return err(MiscError('EnvVarError', 'cannot get BSKY_PASSWORD'));
      }
      return createSession(identifier, password)
        .andThen(({ did, accessJwt }) => {
          return createRecord(did, accessJwt, formattedStr, link, entry);
        })
        .map((response) => ({ entry, link, formattedStr, response }));
    })
    .match(
      (post) =>
        console.log(`Successfully posted. post:`, post.formattedStr),
      (err) => {
        console.error('An error was occured', err);
        throw err;
      }
    );
};

main();
