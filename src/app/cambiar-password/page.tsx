"use client";

import { useState } from "react";
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  Icon,
  Input,
  VStack,
  Text,
  useToast,
  Alert,
  AlertIcon,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";

const MotionBox = motion(Box);

// Pantalla nueva (no existia en el original): cierra el flujo de
// contrasena temporal cuando un administrador crea una cuenta nueva
// (ver MIGRATION_NOTES.md, Fase 4).
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
    <Box
      minH="100dvh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      px={4}
      py={8}
      bgGradient="linear(to-br, blue.50, gray.50 45%, blue.50)"
    >
      <MotionBox
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        w="full"
        maxW="400px"
      >
        <VStack spacing={6} w="full">
          <VStack spacing={3} textAlign="center">
            <Box
              boxSize="64px"
              borderRadius="full"
              bg="blue.50"
              border="4px solid"
              borderColor="blue.100"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Icon as={KeyRound} boxSize={6} color="blue.600" />
            </Box>
            <Heading size="lg" color="gray.800" fontWeight="800">
              Nueva contraseña
            </Heading>
            <Text color="gray.500" fontSize="sm" maxW="320px">
              Tu cuenta fue creada con una contraseña temporal. Elegí una nueva
              para continuar.
            </Text>
          </VStack>

          <Box
            w="full"
            p={{ base: 6, md: 8 }}
            borderRadius="2xl"
            boxShadow="xl"
            bg="white"
            border="1px solid"
            borderColor="gray.100"
          >
            <form onSubmit={handleSubmit}>
              <VStack spacing={5}>
                {error && (
                  <Alert status="error" borderRadius="lg" fontSize="sm">
                    <AlertIcon />
                    {error}
                  </Alert>
                )}

                <FormControl isRequired>
                  <FormLabel fontSize="sm" fontWeight="600" color="gray.700">
                    Nueva contraseña
                  </FormLabel>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    size="lg"
                    bg="gray.50"
                    borderColor="gray.200"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontSize="sm" fontWeight="600" color="gray.700">
                    Confirmar contraseña
                  </FormLabel>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite la contraseña"
                    size="lg"
                    bg="gray.50"
                    borderColor="gray.200"
                  />
                </FormControl>

                <Button
                  type="submit"
                  colorScheme="blue"
                  size="lg"
                  w="full"
                  h="52px"
                  borderRadius="xl"
                  boxShadow="md"
                  isLoading={loading}
                  loadingText="Guardando..."
                >
                  Guardar y continuar
                </Button>
              </VStack>
            </form>
          </Box>
        </VStack>
      </MotionBox>
    </Box>
  );
}
