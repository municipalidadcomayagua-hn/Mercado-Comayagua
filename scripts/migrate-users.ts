/**
 * Fase 4: migra usuarios de Firebase Auth (+ rol desde Firestore `usuarios`)
 * a Supabase Auth. NO migra datos de negocio (mercados/cobradores/puestos/...)
 * - eso lo hace scripts/migrate-data.ts en la Fase 7, reutilizando el mapa
 * de ids que este script genera.
 *
 * Requiere:
 *   - scripts/firebase-service-account.json: Service Account del proyecto
 *     Firebase "mercado-app-2" (Firebase Console > Configuracion del
 *     proyecto > Cuentas de servicio > Generar nueva clave privada).
 *     Ignorado por git (ver .gitignore).
 *   - .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 *
 * Uso:
 *   npx tsx scripts/migrate-users.ts
 *
 * Salida (scripts/output/, ignorado por git):
 *   - uid-map.json: { firebaseUid: supabaseUuid } para la Fase 7.
 *   - usuarios-migrados.json: lista con contrasenas temporales. Entregala
 *     de forma segura a cada usuario y luego BORRA el archivo.
 *
 * Cada usuario migrado queda con `perfiles.debe_cambiar_password = true`;
 * el sistema lo obliga a definir una contrasena nueva en su primer login
 * (ver src/app/cambiar-password/page.tsx y src/lib/supabase/middleware.ts).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cert, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getAuth as getFirebaseAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.loadEnvFile(path.join(__dirname, "..", ".env.local"));

const SERVICE_ACCOUNT_PATH =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ??
  path.join(__dirname, "firebase-service-account.json");

if (!existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(`No se encontro el service account de Firebase en: ${SERVICE_ACCOUNT_PATH}`);
  console.error(
    "Generalo en Firebase Console > Configuracion del proyecto > Cuentas de servicio > " +
      "Generar nueva clave privada (proyecto mercado-app-2), y guardalo en esa ruta."
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(
  readFileSync(SERVICE_ACCOUNT_PATH, "utf-8")
) as ServiceAccount;
initializeApp({ credential: cert(serviceAccount) });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface UsuarioFirestore {
  email?: string;
  displayName?: string;
  rol?: "administrador" | "ambulante";
  activo?: boolean;
}

function generarPasswordTemporal(): string {
  const aleatorio = Math.random().toString(36).slice(2, 10);
  const numero = Math.floor(Math.random() * 90 + 10);
  return `Cambiar-${aleatorio}!${numero}`;
}

interface RegistroMigrado {
  firebaseUid: string;
  supabaseUuid: string;
  email: string;
  rol: string;
  passwordTemporal: string;
}

async function main() {
  const firebaseAuth = getFirebaseAuth();
  const firestore = getFirestore();

  const usuariosSnapshot = await firestore.collection("usuarios").get();
  const perfilesPorUid = new Map<string, UsuarioFirestore>();
  usuariosSnapshot.forEach((doc) => {
    perfilesPorUid.set(doc.id, doc.data() as UsuarioFirestore);
  });
  console.log(`Encontrados ${perfilesPorUid.size} documento(s) en usuarios/ de Firestore.`);

  const uidMap: Record<string, string> = {};
  const resumen: RegistroMigrado[] = [];
  const omitidos: string[] = [];

  let nextPageToken: string | undefined;
  do {
    const page = await firebaseAuth.listUsers(1000, nextPageToken);

    for (const fbUser of page.users) {
      const email = fbUser.email;
      if (!email) {
        console.warn(`Usuario ${fbUser.uid} sin email, se omite.`);
        omitidos.push(fbUser.uid);
        continue;
      }

      const perfilFirestore = perfilesPorUid.get(fbUser.uid);
      const rol = perfilFirestore?.rol ?? "ambulante";
      const nombre = perfilFirestore?.displayName || fbUser.displayName || email;
      const passwordTemporal = generarPasswordTemporal();

      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: passwordTemporal,
        email_confirm: true,
        user_metadata: { nombre },
      });

      if (error || !data.user) {
        console.error(`Error creando usuario ${email}:`, error?.message);
        omitidos.push(fbUser.uid);
        continue;
      }

      // El trigger handle_new_user ya inserto una fila en perfiles con rol
      // 'ambulante' por defecto (Fase 4); la corregimos con los datos reales
      // de Firestore y marcamos que debe cambiar la contrasena temporal.
      const { error: updateError } = await supabase
        .from("perfiles")
        .update({
          rol,
          nombre,
          activo: perfilFirestore?.activo ?? true,
          debe_cambiar_password: true,
        })
        .eq("id", data.user.id);

      if (updateError) {
        console.error(`Error actualizando perfil de ${email}:`, updateError.message);
      }

      uidMap[fbUser.uid] = data.user.id;
      resumen.push({
        firebaseUid: fbUser.uid,
        supabaseUuid: data.user.id,
        email,
        rol,
        passwordTemporal,
      });

      console.log(`Migrado: ${email} (${fbUser.uid} -> ${data.user.id}), rol=${rol}`);
    }

    nextPageToken = page.pageToken;
  } while (nextPageToken);

  const outDir = path.join(__dirname, "output");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "uid-map.json"), JSON.stringify(uidMap, null, 2));
  writeFileSync(
    path.join(outDir, "usuarios-migrados.json"),
    JSON.stringify(resumen, null, 2)
  );

  console.log(`\n${resumen.length} usuario(s) migrado(s), ${omitidos.length} omitido(s).`);
  console.log("Mapa de ids: scripts/output/uid-map.json (lo usa la Fase 7).");
  console.log(
    "Contrasenas temporales: scripts/output/usuarios-migrados.json - entregalas de forma " +
      "segura a cada usuario y luego BORRA ese archivo."
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
