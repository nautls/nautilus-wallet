export const enum ExternalRequest {
  Connect = "ext:connect"
}

export const enum InternalRequest {
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

export type InternalMessagePayload = {
  origin: string;
  favicon?: string;
  requestId?: number;
};

export type InternalMessageData<T = unknown> = {
  payload: InternalMessagePayload;
} & T;
