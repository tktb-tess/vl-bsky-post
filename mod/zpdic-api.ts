import * as v from '@valibot/valibot';
import {
  fetchToResult,
  HttpError,
  MiscError,
  safeParseToResult,
} from './util.ts';
import { err, ok, ResultAsync } from 'neverthrow';

const obj_id_brand = Symbol('object-id');

const objectIdSchema = v.pipe(v.string(), v.brand(obj_id_brand));

const equivalentSchema = v.object({
  titles: v.array(v.string()),
  names: v.array(v.string()),
  nameString: v.string(),
  ignoredPattern: v.string(),
  hidden: v.boolean(),
});

const informationSchema = v.object({
  title: v.string(),
  text: v.string(),
  hidden: v.boolean(),
});

const phraseSchema = v.object({
  titles: v.array(v.string()),
  form: v.string(),
  terms: v.array(v.string()),
  termString: v.string(),
  ignoredPattern: v.string(),
});

const variationSchema = v.object({
  title: v.string(),
  name: v.string(),
  pronunciation: v.string(),
});

const relationSchema = v.object({
  titles: v.array(v.string()),
  number: v.pipe(v.number(), v.integer()),
  name: v.string(),
});

const exampleSchema = v.object({
  id: objectIdSchema,
  number: v.pipe(v.number(), v.integer()),
  sentence: v.string(),
  translation: v.string(),
  supplement: v.string(),
  tags: v.array(v.string()),
  words: v.array(
    v.object({
      number: v.pipe(v.number(), v.integer()),
    })
  ),
  offer: v.nullable(
    v.object({
      catalog: v.string(),
      number: v.pipe(v.number(), v.integer()),
    })
  ),
});

const word_brand = Symbol('ZpDIC-word');

export const wordWithExamplesSchema = v.pipe(
  v.object({
    id: objectIdSchema,
    number: v.pipe(v.number(), v.integer()),
    name: v.string(),
    pronunciation: v.string(),
    equivalents: v.array(equivalentSchema),
    tags: v.array(v.string()),
    informations: v.array(informationSchema),
    phrases: v.array(phraseSchema),
    variations: v.array(variationSchema),
    relations: v.array(relationSchema),
    examples: v.array(exampleSchema),
  }),
  v.brand(word_brand)
);

export type WordWithExamples = v.InferOutput<typeof wordWithExamplesSchema>;

export const zpdicResponseSchema = v.object({
  words: v.array(wordWithExamplesSchema),
  total: v.pipe(v.number(), v.integer()),
});

const zpdicWordResponseSchema = v.object({
  word: wordWithExamplesSchema,
});

export type ZpDICWordResponse = v.InferOutput<typeof zpdicWordResponseSchema>;

export type ZpDICWordsResponse = v.InferOutput<typeof zpdicResponseSchema>;

export const fetchZpdicWords = (
  apiKey: string,
  query: string,
  dicID: string
): ResultAsync<
  ZpDICWordsResponse,
  v.ValiError<typeof zpdicResponseSchema> | HttpError | MiscError
> => {
  const url = `https://zpdic.ziphil.com/api/v0/dictionary/${dicID}/words${query}`;

  const resp = fetchToResult(url, {
    method: 'GET',
    headers: {
      'X-Api-Key': apiKey,
    },
  });

  return resp.andThen((r) => {
    const json = ResultAsync.fromPromise<unknown, MiscError>(r.json(), (e) => {
      if (e instanceof Error) {
        return MiscError.from(e.name, e.message, e);
      } else if (e instanceof DOMException) {
        return MiscError.from(e.name, e.message, e);
      } else {
        return MiscError.from('UnidentifiedError', 'Unidentified error', e);
      }
    });

    return json.andThen((j) => safeParseToResult(zpdicResponseSchema, j));
  });
};

export const getTotalWords = (
  apiKey: string,
  dicID: string
): ResultAsync<
  number,
  v.ValiError<typeof zpdicResponseSchema> | HttpError | MiscError
> => {
  const result = fetchZpdicWords(apiKey, '?text=', dicID);

  return result.map(({ total }) => total);
};

export const fetchZpdicWord = (
  apiKey: string,
  index: number,
  dicID: string
): ResultAsync<
  WordWithExamples,
  v.ValiError<typeof zpdicResponseSchema> | HttpError | MiscError
> => {
  const res = fetchZpdicWords(apiKey, `?text=&skip=${index}&limit=1`, dicID);

  return res.andThen(({ words }) => {
    const word = words.at(0);
    if (!word) return err(MiscError.from('FetchError', 'No Words are found'));
    return ok(word);
  });
};
