import { captureException, withScope } from './packages/core';
import {
  Event as SentryEvent,
  Mechanism,
  Scope,
  WrappedFunction,
} from './packages/types';
import { addExceptionMechanism, addExceptionTypeValue } from './packages/utils';

let ignoreOnError: number = 0;

/**
 * @hidden
 */
export function shouldIgnoreOnError(): boolean {
  return ignoreOnError > 0;
}

/**
 * @hidden
 */
export function ignoreNextOnError(): void {
  // onerror should trigger before setTimeout
  ignoreOnError += 1;
  setTimeout(() => {
    ignoreOnError -= 1;
  });
}

/**
 * Instruments the given function and sends an event to Sentry every time the
 * function throws an exception.
 *
 * @param fn A function to wrap.
 * @param options
 * @returns The wrapped function.
 * @hidden
 */
export function wrap(
  fn: WrappedFunction,
  options: {
    mechanism?: Mechanism;
  } = {},
): any {
  if (typeof fn !== 'function') {
    return fn;
  }

  try {
    // We don't wanna wrap it twice
    if (fn.__sentry__) {
      return fn;
    }

    // If this has already been wrapped in the past, return that wrapped function
    if (fn.__sentry_wrapped__) {
      return fn.__sentry_wrapped__;
    }
  } catch (e) {
    // Just accessing custom props in some Selenium environments
    // can cause a "Permission denied" exception (see raven-js#495).
    // Bail on wrapping and return the function as-is (defers to window.onerror).
    return fn;
  }

  const sentryWrapped: WrappedFunction = function (this: any): void {
    const args = Array.prototype.slice.call(arguments);

    try {
      const wrappedArguments = args.map((arg: any) => wrap(arg, options));

      // Attempt to invoke user-land function
      // NOTE: If you are a Sentry user, and you are seeing this stack frame, it
      //       means the sentry.javascript SDK caught an error invoking your application code. This
      //       is expected behavior and NOT indicative of a bug with sentry.javascript.
      return fn.apply(this, wrappedArguments);
    } catch (ex) {
      ignoreNextOnError();

      withScope((scope: Scope) => {
        scope.addEventProcessor((event: SentryEvent) => {
          const processedEvent = { ...event };

          if (options.mechanism) {
            addExceptionTypeValue(processedEvent, undefined, undefined);
            addExceptionMechanism(processedEvent, options.mechanism);
          }

          processedEvent.extra = {
            ...processedEvent.extra,
            arguments: args,
          };

          return processedEvent;
        });

        captureException(ex);
      });

      // 如果此处再将ex throw出去，会导致wx.onError再次上报同样的异常
      // throw ex;
    }
  };

  // Accessing some objects may throw
  // ref: https://github.com/getsentry/sentry-javascript/issues/1168
  try {
    for (const property in fn) {
      if (Object.prototype.hasOwnProperty.call(fn, property)) {
        sentryWrapped[property] = fn[property];
      }
    }
  } catch (_oO) {}

  fn.prototype ||= {};
  sentryWrapped.prototype = fn.prototype;

  Object.defineProperty(fn, '__sentry_wrapped__', {
    enumerable: false,
    value: sentryWrapped,
  });

  // Signal that this function has been wrapped/filled already
  // for both debugging and to prevent it to being wrapped/filled twice
  Object.defineProperties(sentryWrapped, {
    __sentry__: {
      enumerable: false,
      value: true,
    },
    __sentry_original__: {
      enumerable: false,
      value: fn,
    },
  });

  // Restore original function name (not all browsers allow that)
  try {
    const descriptor = Object.getOwnPropertyDescriptor(
      sentryWrapped,
      'name',
    ) as PropertyDescriptor;
    if (descriptor.configurable) {
      Object.defineProperty(sentryWrapped, 'name', {
        get(): string {
          return fn.name;
        },
      });
    }
  } catch (_oO) {}

  return sentryWrapped;
}
