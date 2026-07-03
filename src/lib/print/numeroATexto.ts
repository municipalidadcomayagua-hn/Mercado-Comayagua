// Convierte numeros a texto en espanol (Honduras). Portado verbatim.
export const numeroATexto = (numero: number): string => {
  const unidades = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
  const decenas = ["", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
  const especiales = [
    "DIEZ",
    "ONCE",
    "DOCE",
    "TRECE",
    "CATORCE",
    "QUINCE",
    "DIECISÉIS",
    "DIECISIETE",
    "DIECIOCHO",
    "DIECINUEVE",
  ];
  const centenas = [
    "",
    "CIEN",
    "DOSCIENTOS",
    "TRESCIENTOS",
    "CUATROCIENTOS",
    "QUINIENTOS",
    "SEISCIENTOS",
    "SETECIENTOS",
    "OCHOCIENTOS",
    "NOVECIENTOS",
  ];

  if (numero === 0) return "CERO";

  const partes = numero.toFixed(2).split(".");
  const parteEntera = parseInt(partes[0]);
  const parteDecimal = parseInt(partes[1]);

  let texto = "";

  if (parteEntera >= 1000) {
    const miles = Math.floor(parteEntera / 1000);
    if (miles === 1) {
      texto += "MIL ";
    } else {
      texto += convertirCentenas(miles, unidades, decenas, especiales, centenas) + " MIL ";
    }
  }

  const resto = parteEntera % 1000;
  texto += convertirCentenas(resto, unidades, decenas, especiales, centenas);

  if (parteDecimal > 0) {
    texto += ` CON ${parteDecimal.toString().padStart(2, "0")}/100`;
  } else {
    texto += " CON 00/100";
  }

  return texto.trim();
};

const convertirCentenas = (
  numero: number,
  unidades: string[],
  decenas: string[],
  especiales: string[],
  centenas: string[]
): string => {
  if (numero === 0) return "";

  let texto = "";

  const c = Math.floor(numero / 100);
  if (c > 0) {
    if (c === 1 && numero % 100 === 0) {
      texto += "CIEN ";
    } else if (c === 1) {
      texto += "CIENTO ";
    } else {
      texto += centenas[c] + " ";
    }
  }

  const resto = numero % 100;
  if (resto >= 10 && resto < 20) {
    texto += especiales[resto - 10] + " ";
  } else {
    const d = Math.floor(resto / 10);
    const u = resto % 10;

    if (d > 0) {
      if (d === 2 && u > 0) {
        texto += "VEINTI" + unidades[u].toLowerCase() + " ";
      } else {
        texto += decenas[d];
        if (u > 0) {
          texto += " Y ";
        } else {
          texto += " ";
        }
      }
    }

    if (u > 0) {
      texto += unidades[u] + " ";
    }
  }

  return texto;
};
