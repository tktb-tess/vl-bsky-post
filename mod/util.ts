import { ok, err, okAsync, errAsync, Result, ResultAsync } from 'neverthrow';
import * as v from '@valibot/valibot';

const __brand_http_err = Symbol('http-error');

type HttpError = {
  status: number;
  statusText: string;
  [__brand_http_err]: typeof __brand_http_err;
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

const __brand_misc_error = Symbol('misc-error');

type MiscError<T = unknown> = {
  name: string;
  message: string;
  cause?: T;
  [__brand_misc_error]: typeof __brand_misc_error;
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
