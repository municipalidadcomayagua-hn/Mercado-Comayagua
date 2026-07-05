"use client";

import { useState } from "react";
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  Input,
  VStack,
  Text,
  useToast,
  Alert,
  AlertIcon,
  Image,
  Divider,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";

const MotionBox = motion(Box);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { login } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await login(email, password);
      toast({
        title: "Inicio de sesión exitoso",
        description: "Bienvenido al sistema de cobros",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
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
      px={{ base: 4, md: 6 }}
      py={{ base: 8, md: 12 }}
      bgGradient="linear(to-br, blue.50, gray.50 45%, blue.50)"
    >
      <MotionBox
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        w="full"
        maxW="420px"
      >
        <VStack spacing={7} w="full">
          <VStack spacing={3} textAlign="center">
            <Box
              boxSize="76px"
              borderRadius="full"
              bg="white"
              boxShadow="lg"
              display="flex"
              alignItems="center"
              justifyContent="center"
              border="4px solid"
              borderColor="blue.100"
              p={1.5}
            >
              <Image
                src="/ESCUDOMPAL.bmp"
                alt="Logo institucional"
                boxSize="100%"
                objectFit="contain"
                borderRadius="full"
              />
            </Box>
            <VStack spacing={0.5}>
              <Text fontSize="xs" fontWeight="700" color="blue.600" letterSpacing="0.08em" textTransform="uppercase">
                Municipalidad de Comayagua
              </Text>
              <Heading
                size={{ base: "lg", sm: "xl" }}
                fontWeight="800"
                bgGradient="linear(to-r, blue.600, teal.500)"
                bgClip="text"
                letterSpacing="-0.02em"
                py={1}
              >
                Sistema de Tarjeta de Cobros
              </Heading>
            </VStack>
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
                    Correo
                  </FormLabel>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ejemplo@mercado.com"
                    size="lg"
                    bg="gray.50"
                    borderColor="gray.200"
                    _hover={{ borderColor: "gray.300" }}
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontSize="sm" fontWeight="600" color="gray.700">
                    Contraseña
                  </FormLabel>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ingrese su contraseña"
                    size="lg"
                    bg="gray.50"
                    borderColor="gray.200"
                    _hover={{ borderColor: "gray.300" }}
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
                  loadingText="Iniciando..."
                >
                  Iniciar Sesión
                </Button>
              </VStack>
            </form>
          </Box>

          <Divider />
          <Text fontSize="xs" color="gray.400" textAlign="center">
            Acceso restringido al personal autorizado de la Municipalidad de Comayagua.
          </Text>
        </VStack>
      </MotionBox>
    </Box>
  );
}
