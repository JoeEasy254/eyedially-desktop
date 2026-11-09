import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ProjectStore, normalizeProject } from '../src/main/projects'
import type { DesktopProject, ProjectFile } from '../src/shared/types'

let root: string
let store: ProjectStore

function mainFile(code = 'return {}\n'): ProjectFile {
  return { id: 'file-1', name: 'main.js', code, isEntry: true }
}

async function createProject(name = 'Physics Sketch'): Promise<DesktopProject> {
  return store.create({ name, template: 'blank', files: [mainFile()] })
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'angaza-projects-'))
  store = new ProjectStore(root)
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('normalizeProject', () => {
  it('requires at least one file and assigns an entry file', () => {
    const project = normalizeProject({
      name: 'No Entry',
      files: [{ id: 'file-1', name: 'main.js', code: 'return {}' }],
    })

    expect(project.files[0].isEntry).toBe(true)
    expect(project.schemaVersion).toBe(1)
  })

  it('rejects invalid and duplicate file names', () => {
    expect(() =>
      normalizeProject({
        name: 'Bad',
        files: [{ id: 'file-1', name: '../escape.js', code: '' }],
      })
    ).toThrow(/Invalid file name/)

    expect(() =>
      normalizeProject({
        name: 'Bad',
        files: [
          { id: 'file-1', name: 'a.js', code: '' },
          { id: 'file-2', name: 'a.js', code: '' },
        ],
      })
    ).toThrow(/Duplicate file name/)
  })

  it('rejects empty names and oversized projects', () => {
    expect(() => normalizeProject({ name: '   ', files: [mainFile()] })).toThrow(/name is required/i)
    expect(() =>
      normalizeProject({
        name: 'Too Big',
        files: [{ id: 'file-1', name: 'main.js', code: 'x'.repeat(2 * 1024 * 1024 + 1) }],
      })
    ).toThrow(/too large/)
  })
})

describe('ProjectStore', () => {
  it('creates, lists, loads, and saves projects', async () => {
    const created = await createProject()
    expect(created.id).toMatch(/^[A-Za-z0-9-]{8,64}$/)

    const list = await store.list()
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Physics Sketch')
    expect(list[0].fileCount).toBe(1)

    const loaded = await store.load(created.id)
    expect(loaded.files[0].code).toBe('return {}\n')

    const summary = await store.save({
      ...loaded,
      name: 'Updated Sketch',
      files: [{ ...loaded.files[0], code: 'return { particles: [] }\n' }],
    })
    expect(summary.name).toBe('Updated Sketch')

    const updated = await store.load(created.id)
    expect(updated.files[0].code).toContain('particles')
  })

  it('renames and duplicates projects', async () => {
    const created = await createProject('Original')
    const renamed = await store.rename(created.id, 'Renamed')
    expect(renamed.name).toBe('Renamed')

    const copy = await store.duplicate(created.id)
    expect(copy.id).not.toBe(created.id)
    expect(copy.name).toBe('Renamed copy')
    expect((await store.list()).map((project) => project.name).sort()).toEqual([
      'Renamed',
      'Renamed copy',
    ])
  })

  it('deletes projects without touching the library root', async () => {
    const created = await createProject()
    await store.delete(created.id)

    expect(await store.list()).toEqual([])
    await expect(store.load(created.id)).rejects.toThrow()
  })

  it('exports and reimports projects with a fresh id', async () => {
    const created = await createProject('Exported')
    const exportPath = join(root, 'exported.angaza.json')
    await store.exportTo(exportPath, created)

    const raw = JSON.parse(await readFile(exportPath, 'utf8'))
    expect(raw.name).toBe('Exported')

    const imported = await store.importFile(exportPath)
    expect(imported.id).not.toBe(created.id)
    expect(imported.name).toBe('Exported')
    expect(await store.list()).toHaveLength(2)
  })

  it('refuses to load corrupt or invalid ids', async () => {
    const created = await createProject()
    const projectPath = join(root, created.id, 'project.json')
    await writeFile(projectPath, '{not json', 'utf8')

    await expect(store.load(created.id)).rejects.toThrow()
    await expect(store.load('../etc')).rejects.toThrow(/Invalid project id/)
  })
})
