import { randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  PROJECT_SCHEMA_VERSION,
  type CreateProjectInput,
  type DesktopProject,
  type ProjectFile,
  type ProjectSummary,
} from '@shared/types'

const MAX_FILE_BYTES = 2 * 1024 * 1024
const MAX_PROJECT_BYTES = 12 * 1024 * 1024
const MAX_FILES = 60
const ID_RE = /^[A-Za-z0-9-]{8,64}$/
const FILE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]*\.js$/

function nowIso(): string {
  return new Date().toISOString()
}

function assertObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  return value as Record<string, unknown>
}

function normalizeName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Project name is required.')
  const name = value.trim().replace(/\s+/g, ' ')
  if (!name) throw new Error('Project name is required.')
  if (name.length > 120) throw new Error('Project name must be 120 characters or fewer.')
  return name
}

function normalizeTemplate(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return 'blank'
  return value.trim().slice(0, 80)
}

function normalizeFile(raw: unknown, index: number, seenIds: Set<string>, seenNames: Set<string>): ProjectFile {
  const file = assertObject(raw, `File ${index + 1}`)
  if (typeof file.name !== 'string') throw new Error(`File ${index + 1} is missing a name.`)
  const name = file.name.trim()
  if (!FILE_NAME_RE.test(name)) {
    throw new Error(`Invalid file name "${name}". Use letters, numbers, dots, dashes, or underscores, ending in .js.`)
  }
  if (seenNames.has(name)) throw new Error(`Duplicate file name "${name}".`)
  seenNames.add(name)

  if (typeof file.code !== 'string') throw new Error(`File "${name}" is missing code.`)
  if (Buffer.byteLength(file.code, 'utf8') > MAX_FILE_BYTES) {
    throw new Error(`File "${name}" is too large (limit ${MAX_FILE_BYTES / 1024 / 1024} MB).`)
  }

  let id = typeof file.id === 'string' && file.id.trim() ? file.id.trim() : `file-${index + 1}`
  if (!ID_RE.test(id) && !/^file-\d+$/.test(id)) {
    id = `file-${index + 1}`
  }
  while (seenIds.has(id)) id = `file-${index + 1}-${seenIds.size + 1}`
  seenIds.add(id)

  return { id, name, code: file.code, isEntry: file.isEntry === true }
}

export function normalizeProject(raw: unknown, overrides?: { id?: string; createdAt?: string }): DesktopProject {
  const input = assertObject(raw, 'Project')
  const filesRaw = input.files
  if (!Array.isArray(filesRaw) || filesRaw.length === 0) {
    throw new Error('A project needs at least one file.')
  }
  if (filesRaw.length > MAX_FILES) throw new Error(`A project can have at most ${MAX_FILES} files.`)

  const seenIds = new Set<string>()
  const seenNames = new Set<string>()
  const files = filesRaw.map((file, index) => normalizeFile(file, index, seenIds, seenNames))

  const entryCount = files.filter((file) => file.isEntry).length
  if (entryCount === 0) files[0].isEntry = true
  if (entryCount > 1) {
    let kept = false
    for (const file of files) {
      if (file.isEntry) {
        if (kept) file.isEntry = false
        kept = true
      }
    }
  }

  const totalBytes = files.reduce((sum, file) => sum + Buffer.byteLength(file.code, 'utf8'), 0)
  if (totalBytes > MAX_PROJECT_BYTES) {
    throw new Error(`Project is too large (limit ${MAX_PROJECT_BYTES / 1024 / 1024} MB).`)
  }

  const id = overrides?.id ?? (typeof input.id === 'string' && ID_RE.test(input.id) ? input.id : randomUUID())
  if (!ID_RE.test(id)) throw new Error('Invalid project id.')

  const createdAt =
    overrides?.createdAt ??
    (typeof input.createdAt === 'string' && !Number.isNaN(Date.parse(input.createdAt)) ? input.createdAt : nowIso())

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id,
    name: normalizeName(input.name),
    template: normalizeTemplate(input.template),
    files,
    createdAt,
    updatedAt: nowIso(),
  }
}

function toSummary(project: DesktopProject): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    template: project.template,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    fileCount: project.files.length,
  }
}

export class ProjectStore {
  private readonly root: string

  constructor(root: string) {
    this.root = root
  }

  getRoot(): string {
    return this.root
  }

  private projectDir(id: string): string {
    if (!ID_RE.test(id)) throw new Error('Invalid project id.')
    return join(this.root, id)
  }

  private projectPath(id: string): string {
    return join(this.projectDir(id), 'project.json')
  }

  private async readProjectFile(id: string): Promise<DesktopProject> {
    const file = this.projectPath(id)
    const info = await stat(file)
    if (info.size > MAX_PROJECT_BYTES + 1024 * 1024) throw new Error('Project file is too large.')
    const raw = JSON.parse(await readFile(file, 'utf8'))
    return normalizeProject(raw, { id })
  }

  private async writeProject(project: DesktopProject): Promise<void> {
    const dir = this.projectDir(project.id)
    await mkdir(dir, { recursive: true })
    const file = this.projectPath(project.id)
    const tmp = `${file}.${process.pid}.tmp`
    await writeFile(tmp, JSON.stringify(project, null, 2), 'utf8')
    await rename(tmp, file)
  }

  async list(): Promise<ProjectSummary[]> {
    let entries: string[] = []
    try {
      entries = (await readdir(this.root, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory() && ID_RE.test(entry.name))
        .map((entry) => entry.name)
    } catch {
      return []
    }

    const projects: ProjectSummary[] = []
    for (const id of entries) {
      try {
        projects.push(toSummary(await this.readProjectFile(id)))
      } catch {
        // Skip unreadable or corrupt projects instead of breaking the library.
      }
    }
    return projects.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  }

  async load(id: string): Promise<DesktopProject> {
    return this.readProjectFile(id)
  }

  async create(input: CreateProjectInput): Promise<DesktopProject> {
    const project = normalizeProject({
      schemaVersion: PROJECT_SCHEMA_VERSION,
      id: randomUUID(),
      name: input.name,
      template: input.template,
      files: input.files,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })
    await this.writeProject(project)
    return project
  }

  async save(raw: unknown): Promise<ProjectSummary> {
    const input = assertObject(raw, 'Project')
    const id = typeof input.id === 'string' ? input.id : ''
    let createdAt: string | undefined
    try {
      createdAt = (await this.readProjectFile(id)).createdAt
    } catch {
      createdAt = undefined
    }
    const project = normalizeProject(input, { id, createdAt })
    await this.writeProject(project)
    return toSummary(project)
  }

  async delete(id: string): Promise<void> {
    await rm(this.projectDir(id), { recursive: true, force: true })
  }

  async rename(id: string, name: string): Promise<ProjectSummary> {
    const project = await this.readProjectFile(id)
    project.name = normalizeName(name)
    project.updatedAt = nowIso()
    await this.writeProject(project)
    return toSummary(project)
  }

  async duplicate(id: string): Promise<DesktopProject> {
    const source = await this.readProjectFile(id)
    const project = normalizeProject(
      {
        ...source,
        name: `${source.name} copy`,
      },
      { id: randomUUID() }
    )
    project.createdAt = nowIso()
    await this.writeProject(project)
    return project
  }

  async importFile(filePath: string): Promise<DesktopProject> {
    const info = await stat(filePath)
    if (info.size > MAX_PROJECT_BYTES + 1024 * 1024) throw new Error('Project file is too large.')
    const raw = JSON.parse(await readFile(filePath, 'utf8'))
    const project = normalizeProject(raw, { id: randomUUID() })
    project.createdAt = nowIso()
    await this.writeProject(project)
    return project
  }

  async exportTo(filePath: string, raw: unknown): Promise<void> {
    const input = assertObject(raw, 'Project')
    const project = normalizeProject(input, {
      id: typeof input.id === 'string' && ID_RE.test(input.id) ? input.id : randomUUID(),
    })
    await writeFile(filePath, JSON.stringify(project, null, 2), 'utf8')
  }
}
