"use client";

import type { ComponentType } from "react";
import {
  Avatar,
  Badge,
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerOverlay,
  Flex,
  HStack,
  IconButton,
  Image,
  Text,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { useRouter, usePathname } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";

const SIDEBAR_WIDTH = 264;

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
//
// Rediseño (no es un cambio de logica): se agrega una barra superior fija
// con el titulo de la seccion activa y el usuario/rol, reemplazando el
// boton de menu flotante que se superponia al contenido en movil. El
// sidebar gana un indicador de item activo mas marcado.

function Sidebar({ items, onClose }: { items: NavItem[]; onClose?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <VStack align="stretch" spacing={1} py={4}>
      {items.map((item) => {
        const isActive = pathname === item.path;
        const Icon = item.icon;
        return (
          <HStack
            key={item.path}
            as="button"
            onClick={() => {
              router.push(item.path);
              onClose?.();
            }}
            spacing={0}
            mx={3}
            borderRadius="xl"
            overflow="hidden"
            bg={isActive ? `${item.accent}.50` : "transparent"}
            transition="background-color 0.15s ease"
            _hover={{ bg: isActive ? `${item.accent}.100` : "gray.50" }}
          >
            <Box
              w="4px"
              alignSelf="stretch"
              bg={isActive ? `${item.accent}.500` : "transparent"}
              transition="background-color 0.15s ease"
            />
            <HStack
              flex={1}
              spacing={3}
              px={4}
              py={3}
              color={isActive ? `${item.accent}.700` : "gray.600"}
              fontWeight={isActive ? "600" : "500"}
            >
              <Icon size={20} strokeWidth={1.8} />
              <Text fontSize="sm" noOfLines={1} textAlign="left">
                {item.label}
              </Text>
            </HStack>
          </HStack>
        );
      })}
    </VStack>
  );
}

function BrandBlock({ subtitle, size = "md" }: { subtitle: string; size?: "md" | "sm" }) {
  return (
    <HStack spacing={3} align="center">
      <Image src="/ESCUDOMPAL.bmp" alt="Logo Mercado" boxSize={size === "md" ? "40px" : "36px"} objectFit="contain" borderRadius="full" bg="white" />
      <Box>
        <Text fontSize={size === "md" ? "lg" : "md"} fontWeight="700" color="blue.600" lineHeight="1.2">
          Sistema de Tarjeta de Cobros
        </Text>
        <Text fontSize="xs" color="gray.500">
          {subtitle}
        </Text>
      </Box>
    </HStack>
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
  const { user, isAdmin, logout, mercadoNombre } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const activeItem = navItems.find((item) => item.path === pathname);
  const accent = activeItem?.accent ?? "blue";
  const ActiveIcon = activeItem?.icon;

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
            <BrandBlock subtitle={subtitle} />
          </Box>
          <Box flex={1} overflowY="auto">
            <Sidebar items={navItems} />
          </Box>
          <Box p={4} borderTopWidth="1px" borderColor="gray.100">
            <HStack spacing={3} mb={3} px={2}>
              <Avatar size="sm" name={user?.nombre || user?.email || "?"} bg="blue.500" color="white" />
              <Box minW={0} flex={1}>
                <Text fontSize="sm" fontWeight="600" color="gray.800" noOfLines={1}>
                  {user?.nombre || user?.email}
                </Text>
                <Text fontSize="xs" color="gray.500" noOfLines={1}>
                  {isAdmin ? "Administrador" : "Cobrador"}
                </Text>
              </Box>
            </HStack>
            <Button w="full" variant="ghost" leftIcon={<LogOut size={18} />} colorScheme="red" justifyContent="flex-start" size="md" borderRadius="xl" onClick={handleLogout}>
              Cerrar sesión
            </Button>
          </Box>
        </VStack>
      </Box>

      {/* Mobile drawer */}
      <Drawer isOpen={isOpen} onClose={onClose} placement="left" size="xs">
        <DrawerOverlay />
        <DrawerContent maxW={{ base: "82%", sm: `${SIDEBAR_WIDTH}px` }} bg="white">
          <DrawerCloseButton />
          <DrawerBody pt={8} px={0}>
            <Box px={4} pb={4} borderBottomWidth="1px" borderColor="gray.100">
              <BrandBlock subtitle={subtitle} size="sm" />
              {mostrarMercado &&
                (mercadoNombre ? (
                  <Text fontSize="sm" fontWeight="600" color="teal.600" mt={3} noOfLines={2}>
                    Mercado asignado: {mercadoNombre}
                  </Text>
                ) : (
                  <Text fontSize="xs" color="orange.600" mt={3} fontStyle="italic">
                    Sin mercado asignado
                  </Text>
                ))}
            </Box>
            <Sidebar items={navItems} onClose={onClose} />
            <Box p={4} mt={4} borderTopWidth="1px" borderColor="gray.100">
              <HStack spacing={3} mb={3} px={2}>
                <Avatar size="sm" name={user?.nombre || user?.email || "?"} bg="blue.500" color="white" />
                <Box minW={0} flex={1}>
                  <Text fontSize="sm" fontWeight="600" color="gray.800" noOfLines={1}>
                    {user?.nombre || user?.email}
                  </Text>
                  <Text fontSize="xs" color="gray.500" noOfLines={1}>
                    {isAdmin ? "Administrador" : "Cobrador"}
                  </Text>
                </Box>
              </HStack>
              <Button w="full" variant="ghost" leftIcon={<LogOut size={18} />} colorScheme="red" justifyContent="flex-start" onClick={handleLogout}>
                Cerrar sesión
              </Button>
            </Box>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* Columna principal: barra superior + contenido */}
      <Box flex={1} ml={{ base: 0, lg: `${SIDEBAR_WIDTH}px` }} minH="100vh" w="100%" maxW="100%" overflowX="hidden">
        <Flex
          as="header"
          align="center"
          justify="space-between"
          gap={3}
          bg="white"
          borderBottomWidth="1px"
          borderColor="gray.100"
          px={{ base: 3, sm: 4, lg: 8 }}
          py={{ base: 3, md: 4 }}
          position="sticky"
          top={0}
          zIndex={5}
          boxShadow="0 1px 3px rgba(0,0,0,0.04)"
        >
          <HStack spacing={3} minW={0} flex={1}>
            <IconButton
              aria-label="Menú"
              icon={<Menu size={20} />}
              onClick={onOpen}
              display={{ base: "inline-flex", lg: "none" }}
              variant="ghost"
              borderRadius="lg"
              flexShrink={0}
            />
            {ActiveIcon && (
              <Box p={2} borderRadius="lg" bg={`${accent}.50`} color={`${accent}.600`} flexShrink={0} display={{ base: "none", sm: "flex" }}>
                <ActiveIcon size={20} strokeWidth={1.8} />
              </Box>
            )}
            <Box minW={0}>
              <Text fontSize={{ base: "sm", md: "lg" }} fontWeight="700" color="gray.800" noOfLines={1}>
                {activeItem?.label ?? subtitle}
              </Text>
              {mostrarMercado && mercadoNombre && (
                <Badge colorScheme="teal" fontSize="0.65rem" display={{ base: "none", sm: "inline-block" }}>
                  {mercadoNombre}
                </Badge>
              )}
            </Box>
          </HStack>

          <HStack spacing={3} flexShrink={0}>
            <Box textAlign="right" display={{ base: "none", md: "block" }}>
              <Text fontSize="sm" fontWeight="600" color="gray.700" noOfLines={1}>
                {user?.nombre || user?.email}
              </Text>
              <Text fontSize="xs" color="gray.500">
                {isAdmin ? "Administrador" : "Cobrador"}
              </Text>
            </Box>
            <Avatar size="sm" name={user?.nombre || user?.email || "?"} bg="blue.500" color="white" display={{ base: "none", sm: "flex" }} />
            <IconButton
              aria-label="Cerrar sesión"
              icon={<LogOut size={18} />}
              onClick={handleLogout}
              variant="ghost"
              colorScheme="red"
              borderRadius="lg"
              display={{ base: "inline-flex", lg: "none" }}
            />
          </HStack>
        </Flex>

        <Box px={{ base: 3, sm: 4, md: 6, lg: 8 }} py={{ base: 5, md: 8 }}>
          <Box maxW="7xl" mx="auto" w="full">
            {children}
          </Box>
        </Box>
      </Box>
    </Flex>
  );
}
