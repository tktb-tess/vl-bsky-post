interface NamedError<TName extends string> {
  readonly message: string;
  readonly cause?: unknown;
  readonly stack?: string;
}

class NamedError<TName extends string> extends Error {
  constructor(
    public readonly errName: TName,
    message: string,
    options: ErrorOptions
  ) {
    super(message, options);
  }

  toJSON() {
    const { errName, message, stack } = this;

    const getCause = () => {
      const cause = this.cause;

      if (cause == null) {
        return;
      } else if (
        typeof cause === 'number' ||
        typeof cause === 'string' ||
        typeof cause === 'boolean'
      ) {
        return cause;
      } else if (typeof cause === 'bigint') {
        return cause.toString();
      } else if (cause instanceof Map) {
        return [...cause.entries()];
      } else if (cause instanceof Set) {
        return [...cause.values()];
      } else if (cause instanceof Error) {
        const { name, message, stack, cause: _c } = cause;
        return {
          name,
          message,
          stack,
          cause: _c,
        };
      } else if (typeof cause === 'object') {
        return cause;
      } else return;
    };

    return {
      name: errName,
      message,
      stack,
      cause: getCause(),
    };
  }
}

export { NamedError };
