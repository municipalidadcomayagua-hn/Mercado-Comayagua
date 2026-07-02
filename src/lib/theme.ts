import { extendTheme, type ThemeConfig } from "@chakra-ui/react";

// Sistema visual del proyecto nuevo. Se mantiene Chakra UI v2 (decisión del
// plan de migración), pero se reemplaza la paleta/tipografía/radios por una
// version mas cuidada; la logica y estructura de cada pantalla se sigue
// portando fielmente del original, solo cambia el estilo.

const config: ThemeConfig = {
  initialColorMode: "light",
  useSystemColorMode: false,
};

export const theme = extendTheme({
  config,
  fonts: {
    heading: "var(--font-inter), system-ui, sans-serif",
    body: "var(--font-inter), system-ui, sans-serif",
  },
  colors: {
    brand: {
      50: "#eff6ff",
      100: "#dbeafe",
      200: "#bfdbfe",
      300: "#93c5fd",
      400: "#60a5fa",
      500: "#3b82f6",
      600: "#2563eb",
      700: "#1d4ed8",
      800: "#1e40af",
      900: "#1e3a8a",
    },
    // Se sobreescribe la escala "blue" de Chakra: la mayoria de las pantallas
    // portadas usan colorScheme="blue" / color="blue.600" directamente, asi
    // que refinar esta escala mejora todo el sistema sin tocar cada pantalla.
    blue: {
      50: "#eff6ff",
      100: "#dbeafe",
      200: "#bfdbfe",
      300: "#93c5fd",
      400: "#60a5fa",
      500: "#3b82f6",
      600: "#2563eb",
      700: "#1d4ed8",
      800: "#1e40af",
      900: "#1e3a8a",
    },
    gray: {
      50: "#f8fafc",
      100: "#f1f5f9",
      200: "#e2e8f0",
      300: "#cbd5e1",
      400: "#94a3b8",
      500: "#64748b",
      600: "#475569",
      700: "#334155",
      800: "#1e293b",
      900: "#0f172a",
    },
  },
  radii: {
    md: "0.5rem",
    lg: "0.75rem",
    xl: "1rem",
    "2xl": "1.25rem",
  },
  shadows: {
    sm: "0 1px 2px 0 rgba(15, 23, 42, 0.05)",
    md: "0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.06)",
    lg: "0 12px 24px -6px rgba(15, 23, 42, 0.1), 0 4px 8px -4px rgba(15, 23, 42, 0.06)",
    xl: "0 20px 40px -8px rgba(15, 23, 42, 0.12)",
  },
  breakpoints: {
    base: "0px",
    sm: "480px",
    md: "768px",
    lg: "992px",
    xl: "1280px",
    "2xl": "1536px",
  },
  styles: {
    global: {
      body: {
        overflowX: "hidden",
        bg: "gray.50",
      },
      "*": {
        WebkitTapHighlightColor: "transparent",
      },
    },
  },
  components: {
    Heading: {
      baseStyle: {
        letterSpacing: "-0.02em",
      },
    },
    Button: {
      baseStyle: {
        fontWeight: "600",
        _active: { transform: "scale(0.98)" },
      },
      sizes: {
        lg: {
          minH: { base: "44px", md: "40px" },
        },
        md: {
          minH: { base: "44px", md: "32px" },
        },
      },
    },
    IconButton: {
      sizes: {
        lg: { minW: "44px", minH: "44px" },
        md: { minW: "44px", minH: "44px" },
      },
    },
    Input: {
      defaultProps: {
        focusBorderColor: "blue.500",
      },
    },
    Select: {
      defaultProps: {
        focusBorderColor: "blue.500",
      },
    },
    Textarea: {
      defaultProps: {
        focusBorderColor: "blue.500",
      },
    },
    Card: {
      baseStyle: {
        container: {
          borderRadius: "xl",
          boxShadow: "md",
        },
      },
    },
  },
});
