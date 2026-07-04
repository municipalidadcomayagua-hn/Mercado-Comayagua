/**
 * Subida de imágenes a Cloudinary (fotos de locatarios).
 * Usa un upload preset sin firmar para subir desde el navegador sin CORS ni secretos en el cliente.
 * Puerto verbatim de src/services/cloudinaryService.ts original (solo cambia
 * import.meta.env por process.env, equivalente en Next.js).
 */

const CLOUDINARY_DEFAULT_CLOUD_NAME = "djyspu4sf";
const CLOUDINARY_DEFAULT_PRESET = "Locatarios";

function getCloudinaryConfig() {
  const fromEnv = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  const presetFromEnv = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim();
  return {
    cloudName: fromEnv || CLOUDINARY_DEFAULT_CLOUD_NAME,
    uploadPreset: presetFromEnv || CLOUDINARY_DEFAULT_PRESET,
  };
}

const UPLOAD_URL = (cloudName: string) => `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

export function isCloudinaryConfigured(): boolean {
  const { cloudName, uploadPreset } = getCloudinaryConfig();
  return Boolean(cloudName && uploadPreset);
}

/**
 * Sube una foto a Cloudinary y devuelve la URL segura.
 * @param subfolder Opcional: subcarpeta (ej. "permisos" para permiso de operación). Por defecto locatarios/{cobradorId}.
 */
export async function subirFotoCloudinary(
  file: File,
  cobradorId: string,
  identificador: string,
  subfolder?: string
): Promise<string> {
  const { cloudName, uploadPreset } = getCloudinaryConfig();

  if (!cloudName || !uploadPreset) {
    throw new Error(
      "Cloudinary no configurado. Añade NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME y NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET en .env.local y reinicia el servidor."
    );
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  const folder = subfolder ? `locatarios/${cobradorId}/${subfolder}` : `locatarios/${cobradorId}`;
  formData.append("folder", folder);

  const response = await fetch(UPLOAD_URL(cloudName), {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const message = (err as { error?: { message?: string } })?.error?.message || response.statusText;
    throw new Error(message || `Error ${response.status} al subir la imagen`);
  }

  const data = (await response.json()) as { secure_url?: string; url?: string };
  const url = data.secure_url || data.url;
  if (!url) throw new Error("Cloudinary no devolvió la URL de la imagen");
  return url;
}
