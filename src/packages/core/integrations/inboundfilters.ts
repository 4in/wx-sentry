import { addGlobalEventProcessor, getCurrentHub } from '../../hub';
import { Event, Integration } from '../../types';
import { getEventDescription, isMatchingPattern, logger } from '../../utils';

// "Script error." is hard coded into browsers for errors that it can't read.
// this is the result of a script being pulled in from an external domain and CORS.
const DEFAULT_IGNORE_ERRORS = [
  /^Script error\.?$/,
  /^Javascript error: Script error\.? on line 0$/,
];

/** JSDoc */
interface InboundFiltersOptions {
  allowUrls: Array<string | RegExp>;
  denyUrls: Array<string | RegExp>;
  ignoreErrors: Array<string | RegExp>;
  ignoreInternal: boolean;
}

/** Inbound filters configurable by the user */
export class InboundFilters implements Integration {
  /**
   * @inheritDoc
   */
  public static id: string = 'InboundFilters';

  /**
   * @inheritDoc
   */
  public name: string = InboundFilters.id;

  public constructor(
    private readonly _options: Partial<InboundFiltersOptions> = {},
  ) {}

  /**
   * @inheritDoc
   */
  public setupOnce(): void {
    addGlobalEventProcessor((event: Event) => {
      const hub = getCurrentHub();
      if (!hub) {
        return event;
      }
      const self = hub.getIntegration(InboundFilters);
      if (self) {
        const client = hub.getClient();
        const clientOptions = client ? client.getOptions() : {};
        const options = self._mergeOptions(clientOptions);
        if (self._shouldDropEvent(event, options)) {
          return null;
        }
      }
      return event;
    });
  }

  /** JSDoc */
  private _shouldDropEvent(
    event: Event,
    options: Partial<InboundFiltersOptions>,
  ): boolean {
    if (InboundFilters._isSentryError(event, options)) {
      if (__LOG__) {
        logger.warn(
          `Event dropped due to being internal Sentry Error.\nEvent: ${getEventDescription(
            event,
          )}`,
        );
      }
      return true;
    }
    if (this._isIgnoredError(event, options)) {
      if (__LOG__) {
        logger.warn(
          `Event dropped due to being matched by \`ignoreErrors\` option.\nEvent: ${getEventDescription(
            event,
          )}`,
        );
      }
      return true;
    }
    if (this._isDeniedUrl(event, options)) {
      if (__LOG__) {
        logger.warn(
          `Event dropped due to being matched by \`denyUrls\` option.\nEvent: ${getEventDescription(
            event,
          )}.\nUrl: ${InboundFilters._getEventFilterUrl(event)}`,
        );
      }
      return true;
    }
    if (!this._isAllowedUrl(event, options)) {
      if (__LOG__) {
        logger.warn(
          `Event dropped due to not being matched by \`allowUrls\` option.\nEvent: ${getEventDescription(
            event,
          )}.\nUrl: ${InboundFilters._getEventFilterUrl(event)}`,
        );
      }
      return true;
    }
    return false;
  }

  /** JSDoc */
  private static _isSentryError(
    event: Event,
    options: Partial<InboundFiltersOptions>,
  ): boolean {
    if (!options.ignoreInternal) {
      return false;
    }

    try {
      return (event!.exception!.values![0]!.type === 'SentryError');
    } catch (_oO) {
      return false;
    }
  }

  /** JSDoc */
  private _isIgnoredError(
    event: Event,
    options: Partial<InboundFiltersOptions>,
  ): boolean {
    if (!options.ignoreErrors || !options.ignoreErrors.length) {
      return false;
    }

    return InboundFilters._getPossibleEventMessages(event).some((message) =>
      (options.ignoreErrors as Array<RegExp | string>).some((pattern) =>
        isMatchingPattern(message, pattern),
      ),
    );
  }

  /** JSDoc */
  private _isDeniedUrl(
    event: Event,
    options: Partial<InboundFiltersOptions>,
  ): boolean {
    // TODO: Use Glob instead?
    if (!options.denyUrls || !options.denyUrls.length) {
      return false;
    }
    const url = InboundFilters._getEventFilterUrl(event);
    return !url
      ? false
      : options.denyUrls.some((pattern) => isMatchingPattern(url, pattern));
  }

  /** JSDoc */
  private _isAllowedUrl(
    event: Event,
    options: Partial<InboundFiltersOptions>,
  ): boolean {
    // TODO: Use Glob instead?
    if (!options.allowUrls || !options.allowUrls.length) {
      return true;
    }
    const url = InboundFilters._getEventFilterUrl(event);
    return !url
      ? true
      : options.allowUrls.some((pattern) => isMatchingPattern(url, pattern));
  }

  /** JSDoc */
  private _mergeOptions(
    clientOptions: Partial<InboundFiltersOptions> = {},
  ): Partial<InboundFiltersOptions> {
    return {
      allowUrls: [
        ...(this._options.allowUrls || []),
        ...(clientOptions.allowUrls || []),
      ],
      denyUrls: [
        ...(this._options.denyUrls || []),
        ...(clientOptions.denyUrls || []),
      ],
      ignoreErrors: [
        ...(this._options.ignoreErrors || []),
        ...(clientOptions.ignoreErrors || []),
        ...DEFAULT_IGNORE_ERRORS,
      ],
      ignoreInternal:
        typeof this._options.ignoreInternal !== 'undefined'
          ? this._options.ignoreInternal
          : true,
    };
  }

  /** JSDoc */
  private static _getPossibleEventMessages(event: Event): string[] {
    if (event.message) {
      return [event.message];
    }
    if (event.exception) {
      try {
        const { type = '', value = '' } =
          (event.exception.values && event.exception.values[0]) || {};
        return [`${value}`, `${type}: ${value}`];
      } catch (oO) {
        if (__LOG__) {
          logger.error(
            `Cannot extract message for event ${getEventDescription(event)}`,
          );
        }
        return [];
      }
    }
    return [];
  }

  /** JSDoc */
  private static _getEventFilterUrl(event: Event): string | null {
    try {
      if (event.stacktrace) {
        const frames = event.stacktrace.frames;
        return (frames && frames[frames.length - 1].filename) || null;
      }
      if (event.exception) {
        const frames =
          event.exception.values &&
          event.exception.values[0].stacktrace &&
          event.exception.values[0].stacktrace.frames;
        return (frames && frames[frames.length - 1].filename) || null;
      }
      return null;
    } catch (oO) {
      if (__LOG__) {
        logger.error(
          `Cannot extract url for event ${getEventDescription(event)}`,
        );
      }
      return null;
    }
  }
}
