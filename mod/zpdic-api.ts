import * as v from 'jsr:@valibot/valibot';
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

export const fetchZpdicWords = async (
  apiKey: string,
  query: string
): ResultAsync<ZpDICWordsResponse> => {
  const url = 'https://zpdic.ziphil.com/api/v0/dictionary/633/words';

  try {
    const resp = await fetch(url + query, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
      },
    });

    if (!resp.ok) {
      return {
        success: false,
        error: {
          name: 'FetchError',
          message: `${resp.status} ${resp.statusText}`,
        },
      };
    }

    const parsed = v.parse(zpdicResponseSchema, await resp.json());

    return {
      success: true,
      data: parsed,
    };
  } catch (e) {
    if (e instanceof v.ValiError) {
      const { name, message, issues } = e;

      return {
        success: false,
        error: {
          name,
          message,
          cause: v.flatten(issues),
        },
      };
    } else if (e instanceof Error) {
      const { name, message } = e;

      return {
        success: false,
        error: {
          name,
          message,
        },
      };
    } else {
      return {
        success: false,
        error: {
          name: 'UnidentifiedError',
          cause: e,
        },
      };
    }
  }
};

export const getTotalWords = async (apiKey: string): ResultAsync<number> => {
  const result = await fetchZpdicWords(apiKey, '?text=');
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
  index: number
): ResultAsync<WordWithExamples> => {
  const res = await fetchZpdicWords(apiKey, `?text=&skip=${index}&limit=1`);

  if (!res.success) {
    return res;
  }

  const word = res.data.words.at(0);

  if (!word) {
    return {
      success: false,
      error: {
        name: 'GetNoWord',
      },
    };
  }

  return {
    success: true,
    data: word,
  };
};
