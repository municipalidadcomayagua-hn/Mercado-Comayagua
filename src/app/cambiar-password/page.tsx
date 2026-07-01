"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  Heading,
  Input,
  VStack,
  Text,
  useToast,
  Alert,
  AlertIcon,
} from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";

// Pantalla nueva (no existia en el original): cierra el flujo de
// contrasena temporal para usuarios migrados desde Firebase (Fase 4,
// ver scripts/migrate-users.ts y MIGRATION_NOTES.md).
export default function CambiarPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { supabaseUser } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (!supabaseUser) {
      setError("Sesión no encontrada. Vuelve a iniciar sesión.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      const { error: perfilError } = await supabase
        .from("perfiles")
        .update({ debe_cambiar_password: false })
        .eq("id", supabaseUser.id);
      if (perfilError) throw perfilError;

      toast({
        title: "Contraseña actualizada",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la contraseña");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box minH="100vh" bg="gray.50" display="flex" alignItems="center" justifyContent="center" px={4} py={8}>
      <Container maxW="md" w="100%" centerContent>
        <VStack spacing={6} w="full" maxW="400px">
          <Box textAlign="center">
            <Heading size="lg" color="blue.600">
              Establecer nueva contraseña
            </Heading>
            <Text mt={2} color="gray.600" fontSize="sm">
              Tu cuenta fue migrada con una contraseña temporal. Elegí una nueva
              contraseña para continuar.
            </Text>
          </Box>

          <Box w="full" p={6} borderWidth={1} borderRadius="lg" boxShadow="lg" bg="white">
            <form onSubmit={handleSubmit}>
              <VStack spacing={4}>
                {error && (
                  <Alert status="error" borderRadius="md" fontSize="sm">
                    <AlertIcon />
                    {error}
                  </Alert>
                )}

                <FormControl isRequired>
                  <FormLabel>Nueva contraseña</FormLabel>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Confirmar contraseña</FormLabel>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite la contraseña"
                  />
                </FormControl>

                <Button
                  type="submit"
                  colorScheme="blue"
                  w="full"
                  isLoading={loading}
                  loadingText="Guardando..."
                >
                  Guardar y continuar
                </Button>
              </VStack>
            </form>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}
