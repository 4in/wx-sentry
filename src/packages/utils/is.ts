/**
 * Checks whether given value's type is one of a few Error or Error-like
 * {@link isError}.
 *
 * @param wat A value to be checked.
 * @returns A boolean representing the result.
 */
export function isError(wat: any): boolean {
  switch (Object.prototype.toString.call(wat)) {
    case '[object Error]':
      return true;
    case '[object Exception]':
      return true;
    default:
      return isInstanceOf(wat, Error);
  }
}

/**
 * Checks whether given value's type is ErrorEvent
 * {@link isErrorEvent}.
 *
 * @param wat A value to be checked.
 * @returns A boolean representing the result.
 */
export function isErrorEvent(wat: any): boolean {
  return Object.prototype.toString.call(wat) === '[object ErrorEvent]';
}

/**
 * Checks whether given value's type is a string
 * {@link isString}.
 *
 * @param wat A value to be checked.
 * @returns A boolean representing the result.
 */
export function isString(wat: any): boolean {
  return Object.prototype.toString.call(wat) === '[object String]';
}

/**
 * Checks whether given value's is a primitive (undefined, null, number, boolean, string)
 * {@link isPrimitive}.
 *
 * @param wat A value to be checked.
 * @returns A boolean representing the result.
 */
export function isPrimitive(wat: any): boolean {
  return wat === null || (typeof wat !== 'object' && typeof wat !== 'function');
}

/**
 * Checks whether given value's type is an object literal
 * {@link isPlainObject}.
 *
 * @param wat A value to be checked.
 * @returns A boolean representing the result.
 */
export function isPlainObject(wat: any): boolean {
  return Object.prototype.toString.call(wat) === '[object Object]';
}

/**
 * Checks whether given value's type is an Event instance
 * {@link isEvent}.
 *
 * @param wat A value to be checked.
 * @returns A boolean representing the result.
 */
export function isEvent(wat: any): boolean {
  return typeof Event !== 'undefined' && isInstanceOf(wat, Event);
}

/**
 * Checks whether given value's type is an regexp
 * {@link isRegExp}.
 *
 * @param wat A value to be checked.
 * @returns A boolean representing the result.
 */
export function isRegExp(wat: any): boolean {
  return Object.prototype.toString.call(wat) === '[object RegExp]';
}

/**
 * Checks whether given value has a then function.
 * @param wat A value to be checked.
 */
export function isThenable(wat: any): boolean {
  return Boolean(wat && wat.then && typeof wat.then === 'function');
}

/**
 * Checks whether given value's type is an instance of provided constructor.
 * {@link isInstanceOf}.
 *
 * @param wat A value to be checked.
 * @param base A constructor to be used in a check.
 * @returns A boolean representing the result.
 */
export function isInstanceOf(wat: any, base: any): boolean {
  try {
    return wat instanceof base;
  } catch (_e) {
    return false;
  }
}
