export const enum ExternalRequest {
  Test = "ext:test",
  Connect = "ext:connect"
}

export const enum InternalRequest {
  Test = "int:test",
  Connect = "int:connect",
  SignTx = "int:sign-tx",
  Auth = "int:auth"
}

export const enum InternalResponse {
  Connected = "int:connected",
  Disconnected = "int:disconnected",
  Signed = "int:signed",
  Denied = "int:denied"
}

export const enum InternalEvent {
  Loaded = "int:loaded",
  Disconnected = "int:disconnected"
}

export type InternalMessageData<T = unknown> = {
  payload: {
    origin: string;
    requestId?: number;
  };
} & T;
