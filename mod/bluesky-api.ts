import { ResultAsync } from 'neverthrow';
import * as v from '@valibot/valibot';
import {
  fetchToResult,
  HttpError,
  MiscError,
  safeParseToResult,
} from './util.ts';

export const sessionSchema = v.object({
  accessJwt: v.string(),
  refreshJwt: v.string(),
  did: v.string(),
  handle: v.string(),
  didDoc: v.optional(v.unknown()),
  email: v.optional(v.pipe(v.string(), v.email())),
  emailConfirmed: v.optional(v.boolean()),
  emailAuthFactor: v.optional(v.boolean()),
  active: v.optional(v.boolean()),
  status: v.optional(
    v.union([
      v.literal('suspended'),
      v.literal('takendown'),
      v.literal('deactivated'),
    ])
  ),
});

export type Session = v.InferOutput<typeof sessionSchema>;

export const createSession = (
  identifier: string,
  password: string
): ResultAsync<Session, MiscError | HttpError | v.ValiError<typeof sessionSchema>> => {
  const url = 'https://bsky.social/xrpc/com.atproto.server.createSession';

  const payload = {
    identifier,
    password,
  };

  const resp = fetchToResult(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return resp.andThen((res) => {
    const json = ResultAsync.fromPromise<unknown, MiscError>(
      res.json(),
      (e) => {
        if (e instanceof Error) {
          return MiscError.from(e.name, e.message, e);
        } else if (e instanceof DOMException) {
          return MiscError.from(e.name, e.message, e);
        } else {
          return MiscError.from('UnidentifiedError', 'Unidentified error', e);
        }
      }
    );

    return json.andThen((j) => safeParseToResult(sessionSchema, j));
  });
};

export const createRecord = (
  did: string,
  accessJwt: string,
  content: string,
  link: string,
  entry: string
): ResultAsync<unknown, HttpError | MiscError> => {
  const url = 'https://bsky.social/xrpc/com.atproto.repo.createRecord';

  const payload = {
    repo: did,
    collection: 'app.bsky.feed.post',
    record: {
      text: content,
      createdAt: new Date().toISOString(),
      embed: {
        $type: 'app.bsky.embed.external',
        external: {
          uri: link,
          title: 'Go to ZpDIC Online',
          description: entry,
        },
      },
    },
  };

  const resp = fetchToResult(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessJwt}`,
    },
    body: JSON.stringify(payload),
  });

  return resp.andThen((res) => {
    const json = ResultAsync.fromPromise<unknown, MiscError>(
      res.json(),
      (e) => {
        if (e instanceof Error) {
          return MiscError.from(e.name, e.message, e);
        } else if (e instanceof DOMException) {
          return MiscError.from(e.name, e.message, e);
        } else {
          return MiscError.from('UnidentifiedError', 'Unidentified error', e);
        }
      }
    );

    return json;
  });
};
