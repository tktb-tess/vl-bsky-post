import 'jsr:@std/dotenv/load';
import {
  getTotalWords,
  fetchZpdicWord,
  WordWithExamples,
} from './mod/zpdic-api.ts';
import * as v from 'jsr:@valibot/valibot';
import { authentication, createRecord } from './mod/bluesky-api.ts';

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

  const formattedStr = `${entry} ${pronunciation}  ${tag}

${meaning}

${description}

${etymology}`;

  return {
    formattedStr,
    link,
    entry,
  };
};

const main = async () => {
  const identifier = Deno.env.get('BSKY_ID');
  const password = Deno.env.get('BSKY_PASSWORD');
  const zpdicApiKey = Deno.env.get('ZPDIC_API_KEY');
  const dicID = Deno.env.get('ZPDIC_VL_DIC_ID');

  if (!identifier || !password || !zpdicApiKey || !dicID) {
    console.error('cannot get env');
    return;
  }

  const numRes = await getTotalWords(zpdicApiKey, dicID);

  if (!numRes.success) {
    const err = numRes.error;
    if (err instanceof v.ValiError) {
      console.error(err.name, err.issues);
    } else {
      console.error(err.name, err.message, err.cause);
    }

    return;
  }

  const wRes = await fetchZpdicWord(
    zpdicApiKey,
    getRandomInt(0, numRes.data),
    dicID
  );

  if (!wRes.success) {
    const err = wRes.error;

    if (err instanceof v.ValiError) {
      console.error(err.name, err.issues);
    } else {
      console.error(err.name, err.message, err.cause);
    }

    return;
  }
  const word = wRes.data;

  const { formattedStr, link, entry } = formatWord(word);

  console.log(formattedStr);

  const session = await authentication(identifier, password);

  if (!session.success) {
    const { name, message, cause } = session.error;
    console.error(name, message, cause);
    return;
  }

  const { did, accessJwt } = session.data;

  const res = await createRecord(did, accessJwt, formattedStr, link, entry);

  if (!res.success) {
    const { name, message, cause } = res.error;
    console.error(name, message, cause);
    return;
  }

  console.log(`successfully posted.`);

  return;
};

main();
