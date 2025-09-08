import * as v from '@valibot/valibot';
import { ResultAsync } from './types.ts';

const __brand_object_id = Symbol('object-id');

const objectIdSchema = v.pipe(v.string(), v.brand(__brand_object_id));

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

const __word_brand = Symbol('ZpDIC-word');

export const wordSchema = v.pipe(
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
  v.brand(__word_brand)
);

export type WordWithExamples = v.InferOutput<typeof wordSchema>;

const zpdicResponseSchema = v.object({
  words: v.array(wordSchema),
  total: v.pipe(v.number(), v.integer()),
});

const zpdicWordResponseSchema = v.object({
  word: wordSchema,
});

export type ZpDICWordResponse = v.InferOutput<typeof zpdicWordResponseSchema>;

export type ZpDICWordsResponse = v.InferOutput<typeof zpdicResponseSchema>;

type VError = Error | v.ValiError<typeof zpdicResponseSchema>

export const fetchZpdicWords = async (
  apiKey: string,
  query: string,
  dicID: string
): ResultAsync<ZpDICWordsResponse, VError> => {
  const url = `https://zpdic.ziphil.com/api/v0/dictionary/${dicID}/words`;

  try {
    const resp = await fetch(url + query, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
      },
    });

    if (!resp.ok) {
      throw Error(`failed to fetch: ${resp.status} ${resp.statusText}`);
    }

    const result = v.safeParse(zpdicResponseSchema, await resp.json());

    if (!result.success) {
      
      return {
        success: false,
        error: new v.ValiError(result.issues),
      }
    }

    return {
      success: true,
      data: result.output,
    };
  } catch (e) {
    if (e instanceof Error) {
      return {
        success: false,
        error: e,
      };
    } else {
      return {
        success: false,
        error: Error('unidentified error', { cause: e }),
      };
    }
  }
};

export const getTotalWords = async (
  apiKey: string,
  dicID: string
): ResultAsync<number, VError> => {
  const result = await fetchZpdicWords(apiKey, '?text=', dicID);
  if (!result.success) {
    return result;
  }

  return {
    success: true,
    data: result.data.total,
  };
};

export const fetchZpdicWord = async (
  apiKey: string,
  index: number,
  dicID: string
): ResultAsync<WordWithExamples, VError> => {
  const res = await fetchZpdicWords(
    apiKey,
    `?text=&skip=${index}&limit=1`,
    dicID
  );

  if (!res.success) {
    return res;
  }

  const word = res.data.words.at(0);

  if (!word) {
    return {
      success: false,
      error: Error('WordNotFound'),
    };
  }

  return {
    success: true,
    data: word,
  };
};
