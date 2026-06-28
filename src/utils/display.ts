import type { OpenurpNamedEntity } from '../types'

export function displayName(entity?: Pick<OpenurpNamedEntity, 'name' | 'shortName'> | null) {
  return entity?.shortName || entity?.name || ''
}
