import type { ResultAsync } from './types.ts';
import * as v from '@valibot/valibot';

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

export type Session = v.InferInput<typeof sessionSchema>;

export const authentication = async (
  identifier: string,
  password: string
): ResultAsync<Session> => {
  const url = 'https://bsky.social/xrpc/com.atproto.server.createSession';

  const payload = {
    identifier,
    password,
  };

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      throw Error(`failed to fetch: ${resp.status} ${resp.statusText}`);
    }

    const json: Session = v.parse(sessionSchema, await resp.json());

    return {
      success: true,
      data: json,
    };
  } catch (e) {
    if (e instanceof Error) {
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
        },
      };
    }
  }
};

export const createRecord = async (
  identifier: string,
  accessJwt: string,
  content: string
): ResultAsync<null> => {
  const url = 'https://bsky.social/xrpc/com.atproto.repo.createRecord';

  try {
    const payload = {
      repo: identifier,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text: content,
        createdAt: new Date().toISOString(),
      },
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessJwt}`,
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      throw Error(`failed to fetch: ${resp.status} ${resp.statusText}`);
    }

    return {
      success: true,
      data: null,
    };
  } catch (e) {
    if (e instanceof Error) {
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
