"use client";

import { useRef } from "react";
import { Box, Button, HStack, IconButton, Image, Menu, MenuButton, MenuItem, MenuList, SimpleGrid, Text, VStack, useToast } from "@chakra-ui/react";
import { Camera, ChevronDown, ImagePlus, X } from "lucide-react";
import { subirFotoCloudinary } from "@/lib/cloudinary/cloudinaryService";

const COMPRESION_DIMENSION_MAX = 1600;
const COMPRESION_CALIDAD = 0.82;
const COMPRESION_UMBRAL_BYTES = 700 * 1024; // no vale la pena comprimir fotos que ya son livianas

/**
 * Redimensiona/recomprime una foto a JPEG antes de subirla. Las fotos que
 * salen directo de la camara de un celular pueden pesar 8-20MB (varios
 * miles de pixeles de lado); cargar eso en memoria para el FormData del
 * upload es una causa tipica de que el navegador se quede sin memoria y el
 * sistema operativo mate la pestaña/app a medio subir, sobre todo en
 * celulares de gama baja. Si algo falla (formato no soportado, etc.) se
 * sube el archivo original tal cual - nunca se bloquea la subida por esto.
 */
function comprimirImagen(file: File, maxDim = COMPRESION_DIMENSION_MAX, calidad = COMPRESION_CALIDAD): Promise<File> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/") || file.type === "image/gif" || file.size <= COMPRESION_UMBRAL_BYTES) {
      resolve(file);
      return;
    }
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);
    const terminar = (resultado: File) => {
      URL.revokeObjectURL(objectUrl);
      resolve(resultado);
    };
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width <= maxDim && height <= maxDim) {
          terminar(file);
          return;
        }
        const escala = maxDim / Math.max(width, height);
        width = Math.round(width * escala);
        height = Math.round(height * escala);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          terminar(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              terminar(file);
              return;
            }
            const nombre = file.name.replace(/\.\w+$/, "") + ".jpg";
            terminar(new File([blob], nombre, { type: "image/jpeg" }));
          },
          "image/jpeg",
          calidad
        );
      } catch {
        terminar(file);
      }
    };
    img.onerror = () => terminar(file);
    img.src = objectUrl;
  });
}

/**
 * Widget de subida de fotos (camara o galeria) con preview y opcion de
 * quitar. Consolida los 4 bloques casi identicos del CobroAmbulante.tsx
 * original (foto de documento, permiso de operacion, contrato de
 * arrendamiento, tarjeta de cobro anual) en un solo componente
 * parametrizado - mismo comportamiento, sin repetir el markup 4 veces.
 */
export function FotosUploader({
  urls,
  onAdd,
  onRemove,
  multiple,
  uploading,
  setUploading,
  mercadoId,
  identificador,
  subfolder,
  buttonLabel,
  colorScheme = "blue",
  descripcion,
  thumbSize = "80px",
}: {
  urls: string[];
  onAdd: (urls: string[]) => void;
  onRemove: (index: number) => void;
  multiple: boolean;
  uploading: boolean;
  setUploading: (v: boolean) => void;
  /** Carpeta de Cloudinary: el locatario es compartido por el mercado, no por un cobrador individual. */
  mercadoId?: string;
  identificador: string;
  subfolder?: string;
  buttonLabel: string;
  colorScheme?: string;
  descripcion?: string;
  thumbSize?: string;
}) {
  const toast = useToast();
  const galeriaRef = useRef<HTMLInputElement>(null);
  const camaraRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: File[]) => {
    if (!files.length || !mercadoId) return;
    setUploading(true);
    // Se sube y se agrega una por una (no se espera a que terminen todas)
    // para que una foto que ya se subio con exito quede guardada en el
    // borrador aunque otra falle despues o la app se interrumpa a medio
    // subir el lote - antes se perdia todo el lote si una fallaba.
    let subidas = 0;
    let fallidas = 0;
    let ultimoError: string | undefined;
    try {
      for (const file of files) {
        try {
          const comprimida = await comprimirImagen(file);
          const url = await subirFotoCloudinary(comprimida, mercadoId, identificador.trim().slice(0, 30) || "locatario", subfolder);
          onAdd([url]);
          subidas++;
        } catch (err) {
          fallidas++;
          ultimoError = err instanceof Error ? err.message : undefined;
        }
      }
      if (subidas > 0) {
        toast({ title: `${subidas} foto(s) subida(s)`, status: "success", isClosable: true });
      }
      if (fallidas > 0) {
        toast({
          title: fallidas === 1 ? "1 foto no se pudo subir" : `${fallidas} fotos no se pudieron subir`,
          description: ultimoError || "Intente de nuevo, puede ser un problema de conexión.",
          status: "error",
          duration: 6000,
          isClosable: true,
        });
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <VStack align="stretch" spacing={2}>
      {descripcion && (
        <Text fontSize="sm" color="gray.600">
          {descripcion}
        </Text>
      )}
      <HStack spacing={2} flexWrap="wrap">
        <input
          ref={galeriaRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          hidden
          onChange={(e) => {
            const f = e.target.files ? Array.from(e.target.files) : [];
            if (f.length) handleFiles(f);
            e.target.value = "";
          }}
        />
        <input
          ref={camaraRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFiles([f]);
            e.target.value = "";
          }}
        />
        <Menu>
          <MenuButton as={Button} size="sm" colorScheme={colorScheme} rightIcon={<ChevronDown size={14} />} leftIcon={<Camera size={16} />} isLoading={uploading} loadingText="Subiendo…">
            {buttonLabel}
          </MenuButton>
          <MenuList>
            <MenuItem icon={<Camera size={16} />} onClick={() => camaraRef.current?.click()}>
              Tomar foto
            </MenuItem>
            <MenuItem icon={<ImagePlus size={16} />} onClick={() => galeriaRef.current?.click()}>
              Subir de galería
            </MenuItem>
          </MenuList>
        </Menu>
        {!multiple && urls[0] && (
          <IconButton aria-label="Quitar foto" icon={<X size={16} />} size="sm" colorScheme="red" variant="ghost" onClick={() => onRemove(0)} />
        )}
      </HStack>
      {urls.length > 0 && (
        <Box>
          <SimpleGrid columns={{ base: 2, sm: 3, md: 4 }} spacing={2}>
            {urls.map((url, idx) => (
              <Box key={url} pos="relative" borderWidth="1px" borderRadius="md" overflow="hidden" bg="white">
                <Image src={url} alt={`Foto ${idx + 1}`} w="100%" maxH={thumbSize} objectFit="cover" />
                {multiple && (
                  <IconButton aria-label="Quitar foto" icon={<X size={14} />} size="xs" colorScheme="red" pos="absolute" top={1} right={1} onClick={() => onRemove(idx)} />
                )}
              </Box>
            ))}
          </SimpleGrid>
        </Box>
      )}
    </VStack>
  );
}
