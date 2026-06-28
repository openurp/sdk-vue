import type { Semester } from '../types'

export function formatSemester(semester?: Semester | null) {
  return semester ? `${semester.schoolYear}学年 ${formatSemesterName(semester)}` : ''
}

export function formatSemesterName(semester?: Pick<Semester, 'name'> | null) {
  if (!semester?.name) return ''
  const name = String(semester.name)
  if (/^\d+$/.test(name)) return `第${name}学期`
  if (name.endsWith('学期')) return name
  return `${name}学期`
}

export function formatSemesterRange(semester: Semester) {
  const begin = formatShortDate(semester.beginOn || semester.begin_on)
  const end = formatShortDate(semester.endOn || semester.end_on)
  return begin && end ? `${begin} ~ ${end}` : ''
}

export function resolveCurrentSemester(options: Semester[], today = new Date()) {
  const date = new Date(today)
  date.setHours(0, 0, 0, 0)
  return options.find((semester) => {
    const begin = parseSemesterDate(semester.beginOn || semester.begin_on)
    const end = parseSemesterDate(semester.endOn || semester.end_on, true)
    return begin && end && date >= begin && date <= end
  })
}

export function resolveDefaultSemester(options: Semester[], storedSemesterId?: string | number | null) {
  if (storedSemesterId !== undefined && storedSemesterId !== null && storedSemesterId !== '') {
    const matched = options.find((semester) => String(semester.id) === String(storedSemesterId))
    if (matched) return matched
  }
  return resolveCurrentSemester(options) || resolveNearestSemester(options) || options[0] || null
}

export function resolveNearestSemester(options: Semester[], today = new Date()) {
  const date = new Date(today)
  date.setHours(0, 0, 0, 0)
  const time = date.getTime()

  return options
    .map((semester) => {
      const begin = parseSemesterDate(semester.beginOn || semester.begin_on)
      const end = parseSemesterDate(semester.endOn || semester.end_on, true)
      const distances = [begin, end]
        .filter((value): value is Date => Boolean(value))
        .map((value) => Math.abs(value.getTime() - time))
      return {
        semester,
        distance: distances.length > 0 ? Math.min(...distances) : Number.POSITIVE_INFINITY,
      }
    })
    .sort((a, b) => a.distance - b.distance)[0]?.semester || null
}

export function parseSemesterDate(value: string | undefined, endOfDay = false) {
  if (!value) return null
  const matched = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!matched) return null
  const date = new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]))
  if (Number.isNaN(date.getTime())) return null
  if (endOfDay) date.setHours(23, 59, 59, 999)
  return date
}

function formatShortDate(value: string | undefined) {
  const matched = value?.match(/^\d{4}-(\d{2})-(\d{2})/)
  return matched ? `${matched[1]}-${matched[2]}` : ''
}
