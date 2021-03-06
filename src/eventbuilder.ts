import { Event, EventHint, Options, Severity } from './packages/types';
import {
  addExceptionMechanism,
  addExceptionTypeValue,
  isError,
  isErrorEvent,
  isEvent,
  isPlainObject,
} from './packages/utils';

import {
  eventFromPlainObject,
  eventFromStacktrace,
  prepareFramesForEvent,
} from './parsers';
import { computeStackTrace } from './tracekit';

/**
 * Builds and Event from a Exception
 * @hidden
 */
export function eventFromException(
  options: Options,
  exception: unknown,
  hint?: EventHint,
): PromiseLike<Event> {
  const syntheticException = (hint && hint.syntheticException) || undefined;
  const event = eventFromUnknownInput(exception, syntheticException, {
    attachStacktrace: options.attachStacktrace,
  });
  addExceptionMechanism(event, {
    handled: true,
    type: 'generic',
  });
  event.level = Severity.Error;
  if (hint && hint.event_id) {
    event.event_id = hint.event_id;
  }
  return Promise.resolve(event);
}

/**
 * Builds and Event from a Message
 * @hidden
 */
export function eventFromMessage(
  options: Options,
  message: string,
  level: Severity = Severity.Info,
  hint?: EventHint,
): PromiseLike<Event> {
  const syntheticException = (hint && hint.syntheticException) || undefined;
  const event = eventFromString(message, syntheticException, {
    attachStacktrace: options.attachStacktrace,
  });
  event.level = level;
  if (hint && hint.event_id) {
    event.event_id = hint.event_id;
  }
  return Promise.resolve(event);
}

/**
 * @hidden
 */
export function eventFromUnknownInput(
  exception: unknown,
  syntheticException?: Error,
  options: {
    rejection?: boolean;
    attachStacktrace?: boolean;
  } = {},
): Event {
  let event: Event;

  if (
    isErrorEvent(exception as ErrorEvent) &&
    (exception as ErrorEvent).error
  ) {
    // If it is an ErrorEvent with `error` property, extract it to get actual Error
    const errorEvent = exception as ErrorEvent;
    exception = errorEvent.error;
    event = eventFromStacktrace(computeStackTrace(exception as Error));
    return event;
  }
  if (isError(exception as Error)) {
    // we have a real Error object, do nothing
    event = eventFromStacktrace(computeStackTrace(exception as Error));
    return event;
  }
  if (isPlainObject(exception) || isEvent(exception)) {
    // If it is plain Object or Event, serialize it manually and extract options
    // This will allow us to group events based on top-level keys
    // which is much better than creating new group when any key/value change
    const objectException = exception as Record<string, unknown>;
    event = eventFromPlainObject(
      objectException,
      syntheticException,
      options.rejection,
    );
    addExceptionMechanism(event, {
      synthetic: true,
    });
    return event;
  }

  // If none of previous checks were valid, then it means that it's not:
  // - an instance of Event
  // - an instance of Error
  // - a valid ErrorEvent (one with an error property)
  // - a plain Object
  //
  // So bail out and capture it as a simple message:
  event = eventFromString(exception as string, syntheticException, options);
  addExceptionTypeValue(event, `${exception}`, undefined);
  addExceptionMechanism(event, {
    synthetic: true,
  });

  return event;
}

/**
 * @hidden
 */
export function eventFromString(
  input: string,
  syntheticException?: Error,
  options: {
    attachStacktrace?: boolean;
  } = {},
): Event {
  const event: Event = {
    message: input,
  };

  if (options.attachStacktrace && syntheticException) {
    const stacktrace = computeStackTrace(syntheticException);
    const frames = prepareFramesForEvent(stacktrace.stack);
    event.stacktrace = {
      frames,
    };
  }

  return event;
}
