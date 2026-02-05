/// <reference types="vite/client" />

// Type declarations for Vite's ?worker imports
declare module '*?worker' {
  const workerConstructor: {
    new (): Worker
  }
  export default workerConstructor
}
