export enum LedgerDeviceModelId {
  blue = "blue",
  nanoS = "nanoS",
  nanoSP = "nanoSP",
  nanoX = "nanoX"
}

export enum LedgerState {
  unknown = "unknown",
  loading = "loading",
  error = "error",
  success = "success",
  deviceNotFound = "deviceNotFound"
}

export const enum LEDGER_RETURN_CODE {
  DENIED = 0x6985,
  WRONG_P1P2 = 0x6a86,
  WRONG_APDU_DATA_LENGTH = 0x6a87,
  INS_NOT_SUPPORTED = 0x6d00,
  CLA_NOT_SUPPORTED = 0x6e00,
  BUSY = 0xb000,
  WRONG_RESPONSE_LENGTH = 0xb001,
  BAD_SESSION_ID = 0xb002,
  WRONG_SUBCOMMAND = 0xb003,
  BAD_STATE = 0xb0ff,
  BAD_TOKEN_ID = 0xe001,
  BAD_TOKEN_VALUE = 0xe002,
  BAD_CONTEXT_EXTENSION_SIZE = 0xe003,
  BAD_DATA_INPUT = 0xe004,
  BAD_BOX_ID = 0xe005,
  BAD_TOKEN_INDEX = 0xe006,
  BAD_FRAME_INDEX = 0xe007,
  BAD_INPUT_COUNT = 0xe008,
  BAD_OUTPUT_COUNT = 0xe009,
  TOO_MANY_TOKENS = 0xe00a,
  TOO_MANY_INPUTS = 0xe00b,
  TOO_MANY_DATA_INPUTS = 0xe00c,
  TOO_MANY_INPUT_FRAMES = 0xe00d,
  TOO_MANY_OUTPUTS = 0xe00e,
  HASHER_ERROR = 0xe00f,
  BUFFER_ERROR = 0xe010,
  U64_OVERFLOW = 0xe011,
  BIP32_BAD_PATH = 0xe012,
  INTERNAL_CRYPTO_ERROR = 0xe013,
  NOT_ENOUGH_DATA = 0xe014,
  TOO_MUCH_DATA = 0xe015,
  ADDRESS_GENERATION_FAILED = 0xe016,
  SCHNORR_SIGNING_FAILED = 0xe017,
  BAD_FRAME_SIGNATURE = 0xe018,
  BIP32_FORMATTING_FAILED = 0xe101,
  ADDRESS_FORMATTING_FAILED = 0xe102,
  STACK_OVERFLOW = 0xffff,
  OK = 0x9000
}