declare module 'opencc-js' {
  interface ConverterOptions {
    from: 'cn' | 'tw' | 'hk' | 'jp';
    to: 'cn' | 'tw' | 'hk' | 'jp';
  }
  export function Converter(options: ConverterOptions): (text: string) => string;
}
