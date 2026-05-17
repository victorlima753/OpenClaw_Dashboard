export type GatewayMessage = {
  type: string;
  id?: string;
  method?: string;
  event?: string;
  ok?: boolean;
  payload?: unknown;
  error?: unknown;
  timestamp?: string;
};

type ConnectChallenge = {
  nonce?: string;
  ts?: number;
};

const DEFAULT_SCOPES = ["operator.read", "operator.write", "operator.admin", "operator.approvals"];

function cleanEnv(value: string | undefined, fallback = "") {
  const trimmed = (value ?? "").trim();
  const first = trimmed.at(0);
  const last = trimmed.at(-1);
  if ((first === `"` || first === "'" || first === "`") && first === last) return trimmed.slice(1, -1).trim();
  return trimmed || fallback;
}

export function parseGatewayMessage(data: unknown): GatewayMessage {
  if (typeof data === "string") return JSON.parse(data) as GatewayMessage;
  if (data instanceof ArrayBuffer) return JSON.parse(new TextDecoder().decode(data)) as GatewayMessage;
  if (ArrayBuffer.isView(data)) return JSON.parse(new TextDecoder().decode(data)) as GatewayMessage;
  return JSON.parse(String(data)) as GatewayMessage;
}

export function isConnectChallenge(message: GatewayMessage) {
  return message.type === "event" && message.event === "connect.challenge";
}

export function isGatewayResponse(message: GatewayMessage, id: string) {
  return message.type === "res" && message.id === id;
}

function protocolVersionRange() {
  const configured = cleanEnv(process.env.OPENCLAW_PROTOCOL_VERSION);
  if (configured) {
    const protocol = Number(configured);
    const minProtocol = Number(cleanEnv(process.env.OPENCLAW_MIN_PROTOCOL_VERSION, "3"));
    return { minProtocol: Math.min(minProtocol, protocol), maxProtocol: protocol };
  }
  return { minProtocol: 3, maxProtocol: 4 };
}

function scopes() {
  return (process.env.OPENCLAW_OPERATOR_SCOPES ?? DEFAULT_SCOPES.join(","))
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function connectAuth() {
  const token = cleanEnv(process.env.OPENCLAW_GATEWAY_TOKEN);
  const password = cleanEnv(process.env.OPENCLAW_GATEWAY_PASSWORD);
  return {
    ...(token ? { token } : {}),
    ...(password ? { password } : {})
  };
}

function optionalDevice(challenge: ConnectChallenge) {
  const id = cleanEnv(process.env.OPENCLAW_DEVICE_ID);
  const publicKey = cleanEnv(process.env.OPENCLAW_DEVICE_PUBLIC_KEY);
  const signature = cleanEnv(process.env.OPENCLAW_DEVICE_SIGNATURE);
  if (!id || !publicKey || !signature) return undefined;

  return {
    id,
    publicKey,
    signature,
    signedAt: Date.now(),
    nonce: challenge.nonce
  };
}

export function buildConnectRequest(id: string, challenge: ConnectChallenge) {
  const device = optionalDevice(challenge);
  const configuredMode = cleanEnv(process.env.OPENCLAW_CLIENT_MODE, "backend");
  const clientMode = ["backend", "operator", "node", "probe", "test", "cli"].includes(configuredMode)
    ? configuredMode
    : "backend";

  return {
    type: "req",
    id,
    method: "connect",
    params: {
      ...protocolVersionRange(),
      client: {
        id: cleanEnv(process.env.OPENCLAW_CLIENT_ID, "gateway-client"),
        version: cleanEnv(process.env.NEXT_PUBLIC_APP_VERSION, "0.1.0"),
        platform: cleanEnv(process.env.OPENCLAW_CLIENT_PLATFORM, "docker"),
        mode: clientMode
      },
      role: "operator",
      scopes: scopes(),
      caps: [],
      commands: [],
      permissions: {},
      auth: connectAuth(),
      locale: "pt-BR",
      userAgent: "techsouls-command-center/0.1.0",
      ...(device ? { device } : {})
    }
  };
}

export function buildRpcRequest(method: string, id: string, params: Record<string, unknown>) {
  return {
    type: "req",
    id,
    method,
    params
  };
}

export function gatewayErrorMessage(error: unknown) {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) return String((error as { message?: unknown }).message);
  return JSON.stringify(error);
}
