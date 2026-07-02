"use client";

import type { ComponentType } from "react";
import {
  Box,
  Flex,
  VStack,
  Text,
  Button,
  useDisclosure,
  IconButton,
  Drawer,
  DrawerBody,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  Image,
  HStack,
} from "@chakra-ui/react";
import { useRouter, usePathname } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";

const SIDEBAR_WIDTH = 260;

export interface NavItem {
  path: string;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  accent: string;
}

// Puerto compartido de AdminLayout.tsx / AmbulanteLayout.tsx originales
// (eran casi identicos salvo NAV_ITEMS, subtitulo, y si se muestra el
// mercado asignado). Header.tsx original no se porta: era un componente de
// catalogo de productos ("MercadoApp", buscador, carrito) sin relacion con
// el sistema de cobros - no se usaba desde AdminLayout/AmbulanteLayout.

function Sidebar({ items, onClose }: { items: NavItem[]; onClose?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <VStack align="stretch" spacing={1} py={4}>
      {items.map((item) => {
        const isActive = pathname === item.path;
        const Icon = item.icon;
        return (
          <Button
            key={item.path}
            variant="ghost"
            justifyContent="flex-start"
            leftIcon={<Icon size={20} strokeWidth={1.8} />}
            size="lg"
            h="48px"
            px={4}
            borderRadius="xl"
            mx={3}
            color={isActive ? `${item.accent}.600` : "gray.600"}
            bg={isActive ? `${item.accent}.50` : "transparent"}
            _hover={{
              bg: isActive ? `${item.accent}.100` : "gray.50",
              color: isActive ? `${item.accent}.700` : "gray.800",
            }}
            _active={{ bg: isActive ? `${item.accent}.100` : "gray.100" }}
            onClick={() => {
              router.push(item.path);
              onClose?.();
            }}
          >
            {item.label}
          </Button>
        );
      })}
    </VStack>
  );
}

export interface DashboardShellProps {
  navItems: NavItem[];
  subtitle: string;
  /** Muestra el mercado asignado en el drawer movil (solo AmbulanteLayout lo hacia). */
  mostrarMercado?: boolean;
  children: React.ReactNode;
}

export function DashboardShell({ navItems, subtitle, mostrarMercado, children }: DashboardShellProps) {
  const { logout, mercadoNombre } = useAuth();
  const router = useRouter();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Flex minH="100vh" bg="gray.50">
      {/* Sidebar - desktop */}
      <Box
        display={{ base: "none", lg: "block" }}
        w={`${SIDEBAR_WIDTH}px`}
        flexShrink={0}
        bg="white"
        borderRightWidth="1px"
        borderColor="gray.100"
        boxShadow="0 4px 24px -4px rgba(0,0,0,0.06)"
        position="fixed"
        left={0}
        top={0}
        bottom={0}
        zIndex={10}
      >
        <VStack align="stretch" h="full" spacing={0}>
          <Box px={6} py={6} borderBottomWidth="1px" borderColor="gray.100">
            <HStack spacing={3} align="center">
              <Image
                src="/ESCUDOMPAL.bmp"
                alt="Logo Mercado"
                boxSize="40px"
                objectFit="contain"
                borderRadius="full"
                bg="white"
              />
              <Box>
                <Text fontSize="lg" fontWeight="700" color="blue.600">
                  Mercado Municipal
                </Text>
                <Text fontSize="xs" color="gray.500">
                  {subtitle}
                </Text>
              </Box>
            </HStack>
          </Box>
          <Box flex={1} overflowY="auto">
            <Sidebar items={navItems} />
          </Box>
          <Box p={4} borderTopWidth="1px" borderColor="gray.100">
            <Button
              w="full"
              variant="ghost"
              leftIcon={<LogOut size={18} />}
              colorScheme="red"
              justifyContent="flex-start"
              size="md"
              borderRadius="xl"
              onClick={handleLogout}
            >
              Cerrar sesión
            </Button>
          </Box>
        </VStack>
      </Box>

      {/* Mobile menu button */}
      <Box display={{ base: "block", lg: "none" }} position="fixed" top={4} left={4} zIndex={20}>
        <IconButton
          aria-label="Menú"
          icon={<Menu size={22} />}
          onClick={onOpen}
          size="lg"
          borderRadius="xl"
          bg="white"
          boxShadow="md"
        />
      </Box>

      {/* Mobile drawer */}
      <Drawer isOpen={isOpen} onClose={onClose} placement="left" size="xs">
        <DrawerOverlay />
        <DrawerContent maxW={{ base: "100%", sm: `${SIDEBAR_WIDTH}px` }} bg="white">
          <DrawerCloseButton />
          <DrawerBody pt={12} px={0}>
            <Box px={4} pb={4} borderBottomWidth="1px" borderColor="gray.100">
              <HStack spacing={3} align={mostrarMercado ? "flex-start" : "center"}>
                <Image
                  src="/ESCUDOMPAL.bmp"
                  alt="Logo Mercado"
                  boxSize="36px"
                  objectFit="contain"
                  borderRadius="full"
                  bg="white"
                />
                <Box flex={mostrarMercado ? "1" : undefined}>
                  <Text fontSize="lg" fontWeight="700" color="blue.600">
                    Mercado Municipal
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    {subtitle}
                  </Text>
                  {mostrarMercado &&
                    (mercadoNombre ? (
                      <Text fontSize="sm" fontWeight="600" color="teal.600" mt={2} noOfLines={2}>
                        Mercado asignado: {mercadoNombre}
                      </Text>
                    ) : (
                      <Text fontSize="xs" color="orange.600" mt={2} fontStyle="italic">
                        Sin mercado asignado
                      </Text>
                    ))}
                </Box>
              </HStack>
            </Box>
            <Sidebar items={navItems} onClose={onClose} />
            <Box p={4} mt={4} borderTopWidth="1px" borderColor="gray.100">
              <Button
                w="full"
                variant="ghost"
                leftIcon={<LogOut size={18} />}
                colorScheme="red"
                justifyContent="flex-start"
                onClick={handleLogout}
              >
                Cerrar sesión
              </Button>
            </Box>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* Contenido principal */}
      <Box
        flex={1}
        ml={{ base: 0, lg: `${SIDEBAR_WIDTH}px` }}
        minH="100vh"
        pt={{ base: "4.5rem", sm: 16, lg: 8 }}
        pb={{ base: 8, sm: 8 }}
        px={{ base: 3, sm: 4, md: 6, lg: 8 }}
        w="100%"
        maxW="100%"
        overflowX="hidden"
      >
        <Box maxW="7xl" mx="auto" w="full">
          {children}
        </Box>
      </Box>
    </Flex>
  );
}
