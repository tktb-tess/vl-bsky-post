import { ok, err, okAsync, errAsync, Result, ResultAsync } from 'neverthrow';
import * as v from '@valibot/valibot';
import { WordWithExamples } from "./zpdic-api.ts";

const http_err_brand = Symbol('http-error');

type HttpError = {
  readonly status: number;
  readonly statusText: string;
  readonly [http_err_brand]: typeof http_err_brand;
};

const HttpError = {
  from: (status: number, statusText: string): HttpError => {
    return {
      status,
      statusText,
    } as HttpError;
  },
};

export { HttpError };

const misc_err_brand = Symbol('misc-error');

type MiscError<T = unknown> = {
  readonly name: string;
  readonly message: string;
  readonly cause?: T;
  readonly [misc_err_brand]: typeof misc_err_brand;
};

const MiscError = {
  from: <T = unknown>(
    name: string,
    message: string,
    cause?: T
  ): MiscError<T> => {
    return {
      name,
      message,
      cause,
    } as MiscError<T>;
  },
};

export { MiscError };

export const safeParseToResult = <
  TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>
>(
  schema: TSchema,
  value: unknown,
  config?: v.Config<v.InferIssue<TSchema>>
): Result<v.InferOutput<TSchema>, v.ValiError<TSchema>> => {
  const result = v.safeParse(schema, value, config);

  if (!result.success) {
    return err(new v.ValiError(result.issues));
  }

  return ok(result.output);
};

export const fetchToResult = (
  url: string | URL,
  init?: RequestInit
): ResultAsync<Response, HttpError> => {
  const respResult = ResultAsync.fromPromise(fetch(url, init), (e) =>
    HttpError.from(500, e instanceof Error ? e.message : `Unidentified error`)
  );

  return respResult.andThen((resp) => {
    if (!resp.ok) {
      return errAsync(HttpError.from(resp.status, resp.statusText));
    }
    return okAsync(resp);
  });
};

export const postDataSchema = v.object({
  entry: v.string(),
  link: v.pipe(v.string(), v.url()),
  formattedStr: v.string(),
})

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
    .replaceAll(/\n{2,}/g, '\n')
    .replace(/\n+$/, '')
    .trim();

  return {
    formattedStr: pre2.length > 500 ? pre2.slice(0, 490) + '……' : pre2,
    link,
    entry,
  };
};
