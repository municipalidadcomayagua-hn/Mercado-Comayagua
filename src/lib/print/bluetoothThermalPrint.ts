/**
 * Impresión por Bluetooth a impresora térmica (ESC/POS).
 * Usa Web Bluetooth API.
 * - Android: Chrome (HTTPS). Funciona bien en la mayoría de dispositivos.
 * - iOS: Safari NO soporta Web Bluetooth; en iPhone/iPad se usa window.print() (AirPrint o PDF).
 * Para impresoras que usan BLE con servicio Serial (ej. 0xFFE0 / 0xFFE1).
 *
 * Portado del servicio original (misma lógica). Web Bluetooth no tiene tipos
 * oficiales en lib.dom.d.ts; se declaran aquí los tipos minimos del
 * subconjunto de la API que se usa, en vez de `any`.
 */

interface BluetoothCharacteristicProperties {
  write?: boolean;
  writeWithoutResponse?: boolean;
}

interface BluetoothRemoteGATTCharacteristic {
  properties: BluetoothCharacteristicProperties;
  writeValue(data: BufferSource): Promise<void>;
  writeValueWithoutResponse(data: BufferSource): Promise<void>;
}

interface BluetoothRemoteGATTService {
  getCharacteristic(uuid: string): Promise<BluetoothRemoteGATTCharacteristic>;
  getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;
}

interface BluetoothRemoteGATTServer {
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<BluetoothRemoteGATTService>;
  getPrimaryServices(): Promise<BluetoothRemoteGATTService[]>;
}

interface BluetoothDevice {
  gatt?: BluetoothRemoteGATTServer;
}

interface Bluetooth {
  requestDevice(options: { acceptAllDevices?: boolean; optionalServices?: string[] }): Promise<BluetoothDevice>;
}

declare global {
  interface Navigator {
    bluetooth?: Bluetooth;
  }
}

const ESC = 0x1b;
const GS = 0x1d;

// ESC @ - Inicializar impresora
const CMD_INIT = new Uint8Array([ESC, 0x40]);
// ESC a 0 - Alinear izquierda
const CMD_ALIGN_LEFT = new Uint8Array([ESC, 0x61, 0]);
// GS ! n - Tamaño: 0=normal
const CMD_SIZE_NORMAL = new Uint8Array([GS, 0x21, 0]);
// GS V 0 - Corte parcial del papel
const CMD_CUT = new Uint8Array([GS, 0x56, 0]);

// UUIDs habituales en impresoras térmicas BLE (Serial / SPP over BLE)
const SERVICE_UUIDS = [
  "0000ffe0-0000-1000-8000-00805f9b34fb", // HM-10, muchos clones
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // SPP BLE
  "0000ae00-0000-1000-8000-00805f9b34fb",
];
const CHAR_UUIDS = [
  "0000ffe1-0000-1000-8000-00805f9b34fb",
  "0000ff02-0000-1000-8000-00805f9b34fb",
  "49535343-8841-43f4-a8d3-ecbdfe7195b",
];

function buildEscPosFromLines(lines: string[]): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [CMD_INIT, CMD_ALIGN_LEFT, CMD_SIZE_NORMAL];

  for (const line of lines) {
    const normalized = line.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const bytes = encoder.encode(normalized + "\n");
    chunks.push(bytes);
  }

  chunks.push(CMD_CUT);

  const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
  const out = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/** Detecta si el dispositivo es iOS (iPhone, iPad, iPod). */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Detecta si el dispositivo es Android. */
export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

/**
 * Imprime usando una app "bridge" instalada en el dispositivo (RawBT en Android, BluePrint en iOS).
 */
export function printViaBridgeApp(lines: string[]) {
  const fullText = lines.join("\n") + "\n\n\n";

  if (isAndroid()) {
    // RawBT en Android soporta rawbt:base64,[data]
    const b64 = btoa(unescape(encodeURIComponent(fullText)));
    window.location.href = `rawbt:base64,${b64}`;
  } else if (isIOS()) {
    // BluePrint en iOS soporta blueprint://?text=[text]
    const encoded = encodeURIComponent(fullText);
    window.location.href = `blueprint://?text=${encoded}`;
  } else {
    alert("Función disponible solo en dispositivos móviles.");
  }
}

/** Fallback: Enviar texto de recibo por email */
export function printViaEmail(lines: string[], subject: string = "Recibo de Pago") {
  const body = lines.join("\n");
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Indica si estamos en contexto seguro (HTTPS o localhost).
 * Web Bluetooth requiere contexto seguro.
 */
export function isSecureContext(): boolean {
  if (typeof window === "undefined") return false;
  return window.isSecureContext === true;
}

/**
 * Indica si Web Bluetooth está disponible (HTTPS o localhost).
 * En iOS Safari no existe navigator.bluetooth; en Android Chrome sí (con HTTPS).
 */
export function isBluetoothPrintSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  if (!isSecureContext()) return false;
  return Boolean(navigator.bluetooth);
}

/**
 * Mensaje orientado al usuario cuando Bluetooth no está disponible (p. ej. iOS).
 */
export function getBluetoothUnsupportedMessage(): string {
  if (isIOS()) {
    return 'En iPhone o iPad la impresión por Bluetooth no está disponible desde el navegador. Use el botón "Imprimir" y luego "Compartir" o "Imprimir" del navegador (AirPrint o guardar como PDF).';
  }
  if (isAndroid()) {
    if (!isSecureContext()) {
      return "Abra la app desde HTTPS (no HTTP) para usar impresión Bluetooth.";
    }
    return "Use Chrome y abra la app desde HTTPS. Active Bluetooth y Ubicación en ajustes.";
  }
  return "Bluetooth no disponible en este navegador. En celular use Chrome en Android.";
}

/**
 * Detecta si el usuario está en un dispositivo móvil (celular/tablet).
 * En escritorio se usa impresión normal (window.print); en móvil, Bluetooth.
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  const hasMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(ua);
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const isNarrow = typeof window !== "undefined" && window.innerWidth < 768;
  return hasMobileUA || (hasTouch && isNarrow);
}

/**
 * True si conviene usar impresión por Bluetooth (móvil y soporte disponible).
 * En computadora devuelve false para usar window.print().
 */
export function shouldUseBluetoothPrint(): boolean {
  return isMobileDevice() && isBluetoothPrintSupported();
}

function esEscribible(p: BluetoothCharacteristicProperties | undefined): boolean {
  return Boolean(p?.writeWithoutResponse || p?.write);
}

/**
 * Busca una característica escribible en el servidor GATT (servicios conocidos o todos).
 */
async function findWritableCharacteristic(
  server: BluetoothRemoteGATTServer
): Promise<BluetoothRemoteGATTCharacteristic | null> {
  // 1) Probar servicios/characteristics conocidos de impresoras térmicas BLE
  for (const sid of SERVICE_UUIDS) {
    try {
      const service = await server.getPrimaryService(sid);
      if (!service) continue;
      for (const cid of CHAR_UUIDS) {
        try {
          const c = await service.getCharacteristic(cid);
          if (esEscribible(c.properties)) return c;
        } catch {
          continue;
        }
      }
      const chars = await service.getCharacteristics();
      for (const c of chars) {
        if (esEscribible(c.properties)) return c;
      }
    } catch {
      continue;
    }
  }

  // 2) Fallback: listar todos los servicios primarios (Chrome Android)
  try {
    const services = await server.getPrimaryServices();
    for (const service of services) {
      const chars = await service.getCharacteristics();
      for (const c of chars) {
        if (esEscribible(c.properties)) return c;
      }
    }
  } catch {
    // getPrimaryServices() sin argumentos puede no estar soportado en todos los navegadores
  }

  return null;
}

/**
 * Envía las líneas del recibo a una impresora térmica por Bluetooth.
 * Abre el selector de dispositivos del sistema; el usuario debe elegir la impresora.
 */
export async function printReceiptToBluetooth(lines: string[]): Promise<void> {
  if (!isBluetoothPrintSupported()) {
    throw new Error(getBluetoothUnsupportedMessage());
  }

  let device: BluetoothDevice;
  try {
    device = await navigator.bluetooth!.requestDevice({
      acceptAllDevices: true,
      optionalServices: [...SERVICE_UUIDS, ...CHAR_UUIDS, "battery_service"],
    });
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string };
    const name = err?.name || "";
    const msg = String(err?.message || "");
    if (name === "NotFoundError" || msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("user cancelled")) {
      throw new Error("Cancelado: no se seleccionó ninguna impresora. Vuelva a tocar Imprimir y elija su impresora.");
    }
    if (name === "SecurityError" || msg.includes("requestDevice") || msg.includes("not allowed")) {
      throw new Error(
        "Para usar impresión Bluetooth en el celular:\n• Use Chrome en Android.\n• Abra la app desde HTTPS (no HTTP).\n• Active Bluetooth y Ubicación en ajustes del dispositivo."
      );
    }
    throw e;
  }

  if (!device?.gatt) {
    throw new Error("No se pudo acceder al dispositivo. Asegúrese de que la impresora esté encendida y en modo emparejable.");
  }

  let server: BluetoothRemoteGATTServer;
  try {
    server = await device.gatt.connect();
  } catch {
    throw new Error("No se pudo conectar a la impresora. Acérquela, enciéndala y vuelva a intentar.");
  }

  if (!server) throw new Error("No se pudo conectar al dispositivo.");

  const characteristic = await findWritableCharacteristic(server);
  if (!characteristic) {
    server.disconnect();
    throw new Error("Esta impresora no expone un canal de impresión compatible. Pruebe otra impresora o use la app nativa del fabricante.");
  }

  const data = buildEscPosFromLines(lines);
  // En celulares, usar chunks pequeños (MTU BLE suele ser 20–64) para mayor compatibilidad
  const chunkSize = 64;
  const useWriteWithoutResponse = characteristic.properties?.writeWithoutResponse ?? false;

  try {
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      if (useWriteWithoutResponse) {
        await characteristic.writeValueWithoutResponse(chunk);
      } else {
        await characteristic.writeValue(chunk);
      }
    }
  } finally {
    try {
      server.disconnect();
    } catch {
      /* ignorar */
    }
  }
}

/** Ancho típico en caracteres para papel 58mm */
const RECEIPT_WIDTH = 32;

function center(text: string): string {
  const t = text.trim();
  if (t.length >= RECEIPT_WIDTH) return t.slice(0, RECEIPT_WIDTH);
  const pad = Math.floor((RECEIPT_WIDTH - t.length) / 2);
  return " ".repeat(pad) + t;
}

function left(text: string, max = RECEIPT_WIDTH): string {
  const t = text.replace(/\n/g, " ").trim();
  return t.length > max ? t.slice(0, max) : t;
}

/** Líneas listas para imprimir en térmica (formato 58mm) */
export function buildReceiptLines(
  fn: (helpers: { center: (s: string) => string; left: (s: string, max?: number) => string }) => string[]
): string[] {
  return fn({ center, left });
}
