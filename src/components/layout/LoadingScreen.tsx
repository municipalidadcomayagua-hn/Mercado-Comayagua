import { Box, Center, Spinner, Text, VStack } from "@chakra-ui/react";

export function LoadingScreen({ label = "Cargando…" }: { label?: string }) {
  return (
    <Center minH="100vh" bg="gray.50">
      <VStack spacing={4}>
        <Box position="relative">
          <Spinner
            thickness="3px"
            speed="0.6s"
            emptyColor="gray.200"
            color="blue.500"
            size="xl"
          />
        </Box>
        <Text color="gray.500" fontSize="sm" fontWeight="500">
          {label}
        </Text>
      </VStack>
    </Center>
  );
}
