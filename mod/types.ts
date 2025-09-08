
export type Result<T, E extends Error> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: E;
    };

export type ResultAsync<T, E extends Error> = Promise<Result<T, E>>;


