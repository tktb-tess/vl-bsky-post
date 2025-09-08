import * as v from 'jsr:@valibot/valibot';

export type Result<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: {
        name: string;
        message?: string;
      };
    };

export type ResultAsync<T> = Promise<Result<T>>;

export const sessionSchema = v.object({
  accessJwt: v.string(),
  refreshJwt: v.string(),
});

export type Session = v.InferInput<typeof sessionSchema>;
