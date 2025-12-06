import { err, errAsync, ok, okAsync, ResultAsync } from 'neverthrow';
import * as v from '@valibot/valibot';
import { WordWithExamples } from './zpdic-api.ts';
import { NamedError } from './err.ts';

export const fetchResult = (url: string | URL, init?: RequestInit) => {
  const respResult = ResultAsync.fromPromise(fetch(url, init), (e) => {
    const message = `500 ${
      e instanceof Error ? e.message : 'Unidentified Error'
    }`;
    return new NamedError('HttpError', message);
  });

  return respResult.andThen((resp) => {
    if (!resp.ok) {
      return errAsync(
        new NamedError('HttpError', `${resp.status} ${resp.statusText}`)
      );
    }
    return okAsync(resp);
  });
};

export const toJsonResult = (res: Response) =>
  ResultAsync.fromPromise<unknown, NamedError<'JsonConvertError'>>(
    res.json(),
    (e) => {
      if (e instanceof Error) {
        return new NamedError('JsonConvertError', e.message, {
          cause: e.cause,
        });
      } else {
        return new NamedError('JsonConvertError', 'unidentified error', {
          cause: e,
        });
      }
    }
  );

type BaseSchema = v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>;

export const safeParseResult = <TSchema extends BaseSchema>(
  schema: TSchema,
  value: unknown,
  config?: v.Config<v.InferIssue<TSchema>>
) => {
  const result = v.safeParse(schema, value, config);

  if (!result.success) {
    return err(new v.ValiError(result.issues));
  }

  return ok(result.output);
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
          ', '
        )}`
    )
    .join('\n');

  const description = (() => {
    const _desc = word.informations.find(({ title }) => title === '説明');
    if (!_desc || !_desc.text) return '';
    const str = `〜${_desc.title}〜
${_desc.text.replace(/_|\\|([^\\])\*/g, '$1')}`;
    return str;
  })();

  const etymology = (() => {
    const _ety = word.informations.find(({ title }) => title === '語源');
    if (!_ety || !_ety.text) return '';
    const str = `〜${_ety.title}〜
${_ety.text.replace(/_|\\|([^\\])\*/g, '$1')}`;
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
