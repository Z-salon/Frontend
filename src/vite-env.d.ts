/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEV_BUSINESS_ID?: string
  readonly VITE_DEV_BUSINESS_SLUG?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}