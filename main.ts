import 'jsr:@std/dotenv/load';
import * as v from 'jsr:@valibot/valibot';
import { type ResultAsync, type Session, sessionSchema } from './mod/types.ts';

const authentication = async (
  root: string,
  identifier: string,
  password: string
): ResultAsync<Session> => {
  const url = new URL('/xrpc/com.atproto.server.createSession', root).href;

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
      console.error(e);
      return {
        success: false,
        error: {
          name: 'UnidentifiedError',
        },
      };
    }
  }
};

const main = async () => {
  const identifier = Deno.env.get('BSKY_ID');
  const password = Deno.env.get('BSKY_PASSWORD');
  const domain = 'https://bsky.social';

  if (!identifier || !password) {
    console.error('cannot get env');
    return;
  }

  const res = await authentication(domain, identifier, password);

  if (res.success) {
    console.log(res.data);
  } else {
    console.error(res.error);
  }
};

if (import.meta.main) {
  main();
}
