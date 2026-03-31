import { err, errAsync, ok, okAsync, ResultAsync } from 'neverthrow';
import * as v from '@valibot/valibot';
import { WordWithExamples } from './zpdic-api.ts';
import { NamedError } from './err.ts';

export const createErrHandler = <T extends string>(errName: T, fallback: string) => {
  return (e: unknown) => {
    const msg = e instanceof Error ? e.message : fallback;
    return new NamedError(errName, msg, { cause: e });
  };
};

export const fetchResult = (url: string | URL, init?: RequestInit) => {
  const respResult = ResultAsync.fromPromise(
    fetch(url, init),
    createErrHandler('HttpError', 'Failed to fetch'),
  );

  return respResult.andThen((resp) => {
    if (!resp.ok) {
      return errAsync(
        new NamedError('HttpError', `${resp.status} ${resp.statusText}`),
      );
    }
    return okAsync(resp);
  });
};

export const toJsonResult = (res: Response) =>
  ResultAsync.fromPromise<unknown, NamedError<'JsonConvertError'>>(
    res.json(),
    createErrHandler('JsonConvertError', 'Failed to convert into JSON'),
  );

type BaseSchema = v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>;

export const safeParseResult = <TSchema extends BaseSchema>(
  schema: TSchema,
  value: unknown,
  config?: v.Config<v.InferIssue<TSchema>>,
) => {
  const result = v.safeParse(schema, value, config);

  return result.success
    ? ok(result.output)
    : err(new v.ValiError(result.issues));
};

export const postDataSchema = v.object({
  entry: v.string(),
  link: v.pipe(v.string(), v.url()),
  formattedStr: v.string(),
});

export type PostData = v.InferOutput<typeof postDataSchema>;

export const formatWord = (word: WordWithExamples): PostData => {
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
          ', ',
        )}`,
    )
    .join('\n');

  const description = (() => {
    const _desc = word.informations.find(({ title }) => title === '説明');
    if (!_desc || !_desc.text) return '';
    const str = `〜${_desc.title}〜
${_desc.text.replace(/[_\\]/g, '').replace(/([^\\])\*/g, '$1')}`;
    return str;
  })();

  const etymology = (() => {
    const _ety = word.informations.find(({ title }) => title === '語源');
    if (!_ety || !_ety.text) return '';
    const str = `〜${_ety.title}〜
${_ety.text.replace(/[_\\]/g, '').replace(/([^\\])\*/g, '$1')}`;
    return str;
  })();

  const tag = `${word.tags.map((t) => `[${t}]`).join(' ')}`;

  const link = `https://zpdic.ziphil.com/dictionary/633?kind=exact&number=${word.number}`;

  const pre = `${entry} ${pronunciation}  ${tag}
${meaning}
${description}
${etymology}`;

  const pre2 = pre
    .replaceAll(/\n{2,}/g, '\n')
    .replace(/\n+$/, '')
    .trim();

  return {
    formattedStr: pre2.length > 500 ? pre2.slice(0, 490) + '……' : pre2,
    link,
    entry,
  };
};

export const getRandomInt = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min) + min);
};
