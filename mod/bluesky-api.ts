import * as v from '@valibot/valibot';
import { fetchResult, safeParseResult, toJsonResult } from './util.ts';

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
    ]),
  ),
});

export type Session = v.InferOutput<typeof sessionSchema>;

export const createSession = (identifier: string, password: string) => {
  const endpoint = 'https://bsky.social/xrpc/com.atproto.server.createSession';

  const payload = {
    identifier,
    password,
  };

  return fetchResult(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
    .andThen(toJsonResult)
    .andThen((j) => safeParseResult(sessionSchema, j));
};

export const createRecord = (
  did: string,
  accessJwt: string,
  content: string,
  link: string,
  entry: string,
) => {
  const endpoint = 'https://bsky.social/xrpc/com.atproto.repo.createRecord';

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

  return fetchResult(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessJwt}`,
    },
    body: JSON.stringify(payload),
  }).andThen(toJsonResult);
};
