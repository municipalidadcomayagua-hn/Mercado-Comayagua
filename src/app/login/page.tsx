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
  Image,
} from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";

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
      minH={{ base: "100dvh", md: "100vh" }}
      bg="gray.50"
      display="flex"
      alignItems="center"
      justifyContent="center"
      px={{ base: 3, sm: 4, md: 6 }}
      py={{ base: 6, sm: 8, md: 12 }}
      pb="max(1.5rem, env(safe-area-inset-bottom))"
    >
      <Container
        maxW="md"
        w="100%"
        px={{ base: 4, sm: 6, md: 8 }}
        py={{ base: 4, md: 12 }}
        centerContent
      >
        <VStack spacing={8} w="full" maxW="400px">
          <Box
            textAlign="center"
            py={{ base: 2, md: 4 }}
            borderBottom="2px solid"
            borderColor="blue.500"
            w="full"
            mb={2}
          >
            <Image
              src="/ESCUDOMPAL.bmp"
              alt="Logo institucional"
              boxSize={{ base: "64px", md: "80px" }}
              objectFit="contain"
              mx="auto"
              mb={3}
              borderRadius="full"
              bg="white"
              boxShadow="md"
              p={1}
            />
            <Heading
              size={{ base: "lg", md: "xl", lg: "2xl" }}
              color="blue.600"
              mb={2}
              fontWeight="bold"
            >
              Municipalidad de Comayagua
            </Heading>
            <Text fontSize={{ base: "sm", md: "md", lg: "lg" }} color="gray.700" mb={3}>
              Mercado Municipal San Antonio
            </Text>
            <Heading
              size={{ base: "md", md: "lg", lg: "xl" }}
              color="blue.800"
              fontWeight="bold"
              fontFamily="serif"
            >
              Tarjeta de Cobro
            </Heading>
          </Box>

          <Box w="full" p={{ base: 6, md: 8 }} borderWidth={1} borderRadius="lg" boxShadow="lg" bg="white">
            <form onSubmit={handleSubmit}>
              <VStack spacing={6}>
                {error && (
                  <Alert status="error" borderRadius="md" fontSize={{ base: "sm", md: "md" }}>
                    <AlertIcon />
                    {error}
                  </Alert>
                )}

                <FormControl isRequired>
                  <FormLabel fontSize={{ base: "sm", md: "md" }}>Correo</FormLabel>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ejemplo@mercado.com"
                    size={{ base: "md", md: "lg" }}
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontSize={{ base: "sm", md: "md" }}>Contraseña</FormLabel>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ingrese su contraseña"
                    size={{ base: "md", md: "lg" }}
                  />
                </FormControl>

                <Button
                  type="submit"
                  colorScheme="blue"
                  size={{ base: "md", md: "lg" }}
                  w="full"
                  h={{ base: "44px", md: "50px" }}
                  isLoading={loading}
                  loadingText="Iniciando..."
                >
                  Iniciar Sesión
                </Button>
              </VStack>
            </form>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}
