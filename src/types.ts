/**
 * WebCodecs type definitions for Node.js
 */

// Buffer types
export type BufferSource = ArrayBuffer | ArrayBufferView;

// Polyfill DOMRectReadOnly for Node.js
export class DOMRectReadOnly {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;

  constructor(x: number = 0, y: number = 0, width: number = 0, height: number = 0) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.top = y;
    this.right = x + width;
    this.bottom = y + height;
    this.left = x;
  }

  toJSON(): { x: number; y: number; width: number; height: number } {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }
}

// Polyfill DOMException for Node.js if not available
export class WebCodecsDOMException extends Error {
  readonly name: string;
  readonly code: number;

  static readonly INDEX_SIZE_ERR = 1;
  static readonly DOMSTRING_SIZE_ERR = 2;
  static readonly HIERARCHY_REQUEST_ERR = 3;
  static readonly WRONG_DOCUMENT_ERR = 4;
  static readonly INVALID_CHARACTER_ERR = 5;
  static readonly NO_DATA_ALLOWED_ERR = 6;
  static readonly NO_MODIFICATION_ALLOWED_ERR = 7;
  static readonly NOT_FOUND_ERR = 8;
  static readonly NOT_SUPPORTED_ERR = 9;
  static readonly INUSE_ATTRIBUTE_ERR = 10;
  static readonly INVALID_STATE_ERR = 11;
  static readonly SYNTAX_ERR = 12;
  static readonly INVALID_MODIFICATION_ERR = 13;
  static readonly NAMESPACE_ERR = 14;
  static readonly INVALID_ACCESS_ERR = 15;
  static readonly VALIDATION_ERR = 16;
  static readonly TYPE_MISMATCH_ERR = 17;
  static readonly SECURITY_ERR = 18;
  static readonly NETWORK_ERR = 19;
  static readonly ABORT_ERR = 20;
  static readonly URL_MISMATCH_ERR = 21;
  static readonly QUOTA_EXCEEDED_ERR = 22;
  static readonly TIMEOUT_ERR = 23;
  static readonly INVALID_NODE_TYPE_ERR = 24;
  static readonly DATA_CLONE_ERR = 25;

  private static readonly ERROR_CODES: Record<string, number> = {
    IndexSizeError: 1,
    HierarchyRequestError: 3,
    WrongDocumentError: 4,
    InvalidCharacterError: 5,
    NoModificationAllowedError: 7,
    NotFoundError: 8,
    NotSupportedError: 9,
    InUseAttributeError: 10,
    InvalidStateError: 11,
    SyntaxError: 12,
    InvalidModificationError: 13,
    NamespaceError: 14,
    InvalidAccessError: 15,
    TypeMismatchError: 17,
    SecurityError: 18,
    NetworkError: 19,
    AbortError: 20,
    URLMismatchError: 21,
    QuotaExceededError: 22,
    TimeoutError: 23,
    InvalidNodeTypeError: 24,
    DataCloneError: 25,
    EncodingError: 0,
    NotReadableError: 0,
    UnknownError: 0,
    ConstraintError: 0,
    DataError: 0,
    TransactionInactiveError: 0,
    ReadOnlyError: 0,
    VersionError: 0,
    OperationError: 0,
  };

  constructor(message?: string, name?: string) {
    super(message);
    this.name = name ?? 'Error';
    this.code = WebCodecsDOMException.ERROR_CODES[this.name] ?? 0;
    Object.setPrototypeOf(this, WebCodecsDOMException.prototype);
  }
}

// Use native DOMException if available, otherwise use our polyfill
// We use a custom type to avoid conflicts with the global DOMException
export type WebCodecsError = WebCodecsDOMException;

export function createDOMException(message?: string, name?: string): WebCodecsError {
  return new WebCodecsDOMException(message, name);
}

// Export the class directly for instanceof checks
export { WebCodecsDOMException as DOMException };

// Codec state type
export type CodecState = 'unconfigured' | 'configured' | 'closed';
