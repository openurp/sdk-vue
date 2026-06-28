import type { OpenurpNamedEntity } from './entity'

export interface CodeItem extends OpenurpNamedEntity {
  enName?: string
  enabled?: boolean
  remark?: string
}
