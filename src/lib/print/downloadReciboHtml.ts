/**
 * Genera y descarga el HTML de un recibo a partir del contenido ya
 * renderizado en pantalla (mismo patron que los 5 componentes de recibo
 * originales: leer innerHTML del contenedor e insertarlo en un documento
 * standalone para descargar/imprimir).
 */
export function downloadReciboHtml(params: { contentId: string; filename: string; title: string }): void {
  const { contentId, filename, title } = params;

  const contenidoHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          @media print {
            body { margin: 0; padding: 20px; }
            .no-print { display: none; }
          }
          body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 11px; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; }
          th { background-color: #f0f0f0; font-weight: bold; }
        </style>
      </head>
      <body>
        ${document.getElementById(contentId)?.innerHTML || ""}
      </body>
    </html>
  `;

  const blob = new Blob([contenidoHTML], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
