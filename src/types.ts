export type RedirectResponse =
  | {
      url?: string | undefined
      statusCode?: number | undefined
    }
  | undefined

export type TrimedNode = {
  groupId: string
  id: string
  label: any
}

export type TrimedEdge = {
  source: string
  target: string
  label: string
}
