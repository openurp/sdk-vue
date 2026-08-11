import { describe, expect, it, vi } from 'vitest'
import {
  fetchStudentSemestersJsonApi,
  getStudentSemestersUrl,
  STUDENT_SEMESTERS_PATH,
} from '../src/api/semester'

describe('student semesters api', () => {
  it('STUDENT_SEMESTERS_PATH 为相对路径', () => {
    expect(STUDENT_SEMESTERS_PATH).toBe('/std/semesters.jsonapi')
  })

  it('composeUrl 拼接 apiBasePath 并追加 student.id', () => {
    const url = getStudentSemestersUrl('stu001', {
      apiBasePath: '/api/edu/learning',
      composeUrl: (path) => `http://api.example.com${path}`,
    })
    expect(url).toBe('http://api.example.com/api/edu/learning/std/semesters.jsonapi?student.id=stu001')
  })

  it('无 composeUrl 时按 apiBaseUrl + apiBasePath 构造', () => {
    const url = getStudentSemestersUrl('stu001', {
      apiBaseUrl: 'http://api.example.com',
      apiBasePath: '/api/edu/learning',
    })
    expect(url).toBe('http://api.example.com/api/edu/learning/std/semesters.jsonapi?student.id=stu001')
  })

  it('fetchStudentSemestersJsonApi 通过 fetcher 请求并解析', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }))
    const result = await fetchStudentSemestersJsonApi('stu001', {
      apiBasePath: '/api/edu/learning',
      composeUrl: (path) => `http://api.example.com${path}`,
      fetcher,
    })
    expect(result).toEqual({ data: [] })
    expect(fetcher).toHaveBeenCalledWith(
      'http://api.example.com/api/edu/learning/std/semesters.jsonapi?student.id=stu001',
      expect.objectContaining({ method: 'GET' }),
    )
  })
})
