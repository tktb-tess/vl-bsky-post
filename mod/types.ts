
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
        cause?: unknown;
      };
    };

export type ResultAsync<T> = Promise<Result<T>>;


