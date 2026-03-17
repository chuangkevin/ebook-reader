declare module 'pdf-parse' {
  interface PdfData {
    numpages: number;
    numrender: number;
    info: {
      Title?: string;
      Author?: string;
      Creator?: string;
      Producer?: string;
      [key: string]: unknown;
    };
    metadata: unknown;
    text: string;
    version: string;
  }

  interface PdfOptions {
    max?: number;
    pagerender?: (pageData: unknown) => string;
  }

  function pdfParse(dataBuffer: Buffer, options?: PdfOptions): Promise<PdfData>;
  export = pdfParse;
}
