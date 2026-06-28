export interface OpenurpEntity {
  id: string | number
}

export interface OpenurpNamedEntity extends OpenurpEntity {
  name: string
  code?: string
  shortName?: string
}
