"use client";

import { Menu, MenuButton, MenuList, MenuItem, HStack, Button, useToast } from "@chakra-ui/react";
import { Printer, Download, ChevronDown, Smartphone, Bluetooth, FileText } from "lucide-react";
import {
  shouldUseBluetoothPrint,
  printReceiptToBluetooth,
  isMobileDevice,
  isIOS,
  printViaBridgeApp,
} from "@/lib/print/bluetoothThermalPrint";

interface BotonesImpresionReciboProps {
  getReceiptLinesForBluetooth: () => string[];
  onDescargar?: () => void;
  onClose?: () => void;
}

/**
 * Botones de impresión para recibos.
 * En móvil: "Térmica Bluetooth", "App de impresión" y "Imprimir / PDF" para
 * máxima compatibilidad. En escritorio: un solo botón "Imprimir".
 */
export default function BotonesImpresionRecibo({
  getReceiptLinesForBluetooth,
  onDescargar,
  onClose,
}: BotonesImpresionReciboProps) {
  const toast = useToast();

  const handleImprimirBluetooth = async () => {
    try {
      await printReceiptToBluetooth(getReceiptLinesForBluetooth());
      toast({
        title: "Enviado a impresora",
        description: "El recibo se envió por Bluetooth.",
        status: "success",
        isClosable: true,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al imprimir";
      if (msg.includes("cancel") || msg.includes("Cancelado") || msg.includes("User cancelled")) {
        toast({
          title: "Impresión cancelada",
          description: 'Seleccione la impresora Bluetooth o use "Imprimir / PDF".',
          status: "info",
          isClosable: true,
        });
      } else {
        toast({ title: "Error Bluetooth", description: msg, status: "error", isClosable: true, duration: 5000 });
      }
    }
  };

  const handleImprimirPdf = () => {
    if (typeof window.print === "function") {
      window.print();
      if (isMobileDevice() && isIOS()) {
        toast({
          title: "Impresión en iPhone/iPad",
          description: 'Use "Compartir" o "Imprimir" del diálogo para AirPrint o guardar como PDF.',
          status: "info",
          isClosable: true,
          duration: 6000,
        });
      }
    }
  };

  const handleImprimirDirecto = () => {
    printViaBridgeApp(getReceiptLinesForBluetooth());
    toast({
      title: "Abriendo App de impresión",
      description: isIOS() ? 'Se requiere la app "BluePrint" instalada.' : 'Se requiere la app "RawBT" instalada.',
      status: "info",
      duration: 5000,
    });
  };

  const bluetoothDisponible = shouldUseBluetoothPrint();
  const esMovil = isMobileDevice();

  return (
    <HStack spacing={{ base: 2, md: 4 }} justify="center" mt={6} flexWrap="wrap" gap={2} className="no-print">
      {esMovil ? (
        <Menu>
          <MenuButton
            as={Button}
            leftIcon={<Printer size={18} />}
            rightIcon={<ChevronDown size={14} />}
            colorScheme="blue"
            size={{ base: "sm", md: "md" }}
          >
            Imprimir
          </MenuButton>
          <MenuList>
            {bluetoothDisponible && (
              <MenuItem icon={<Bluetooth size={16} />} onClick={handleImprimirBluetooth}>
                Térmica Bluetooth
              </MenuItem>
            )}
            <MenuItem icon={<Smartphone size={16} />} onClick={handleImprimirDirecto}>
              App de Impresión ({isIOS() ? "BluePrint" : "RawBT"})
            </MenuItem>
            <MenuItem icon={<FileText size={16} />} onClick={handleImprimirPdf}>
              Imprimir / PDF
            </MenuItem>
          </MenuList>
        </Menu>
      ) : (
        <Button leftIcon={<Printer size={18} />} colorScheme="blue" onClick={handleImprimirPdf} size="md">
          Imprimir
        </Button>
      )}
      {onDescargar && (
        <Button leftIcon={<Download size={18} />} colorScheme="green" onClick={onDescargar} size={{ base: "sm", md: "md" }}>
          Descargar
        </Button>
      )}
      {onClose && (
        <Button colorScheme="gray" onClick={onClose} size={{ base: "sm", md: "md" }}>
          Cerrar
        </Button>
      )}
    </HStack>
  );
}
