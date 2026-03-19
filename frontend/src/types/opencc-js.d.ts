declare module 'opencc-js' {
  interface ConverterOptions {
    from: string
    to: string
  }
  function Converter(options: ConverterOptions): (text: string) => string
}
