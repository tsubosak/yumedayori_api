export type RedirectResponse =
  | {
      url?: string | undefined
      statusCode?: number | undefined
    }
  | undefined
