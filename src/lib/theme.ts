import { extendTheme } from "@chakra-ui/react";

// Portado verbatim desde src/App.tsx del proyecto Vite original (no se cambia
// ningun valor). Ver MIGRATION_NOTES.md seccion "Fase 2".
export const theme = extendTheme({
  colors: {
    brand: {
      50: "#f0f9ff",
      500: "#3b82f6",
      600: "#2563eb",
    },
  },
  config: {
    initialColorMode: "light",
    useSystemColorMode: false,
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
      },
      "*": {
        WebkitTapHighlightColor: "transparent",
      },
    },
  },
  components: {
    Button: {
      baseStyle: {
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
  },
});
