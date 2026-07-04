"use client";

import { useRef } from "react";
import { Box, Button, HStack, IconButton, Image, Menu, MenuButton, MenuItem, MenuList, SimpleGrid, Text, VStack, useToast } from "@chakra-ui/react";
import { Camera, ChevronDown, ImagePlus, X } from "lucide-react";
import { subirFotoCloudinary } from "@/lib/cloudinary/cloudinaryService";

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
  cobradorId,
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
  cobradorId?: string;
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
    if (!files.length || !cobradorId) return;
    setUploading(true);
    try {
      const nuevas: string[] = [];
      for (const file of files) {
        const url = await subirFotoCloudinary(file, cobradorId, identificador.trim().slice(0, 30) || "locatario", subfolder);
        nuevas.push(url);
      }
      onAdd(nuevas);
      toast({ title: `${nuevas.length} foto(s) subida(s)`, status: "success", isClosable: true });
    } catch (err) {
      toast({ title: "Error al subir", description: err instanceof Error ? err.message : undefined, status: "error", isClosable: true });
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
