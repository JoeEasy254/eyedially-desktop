export const PROJECT_SCHEMA_VERSION = 1

export interface ProjectFile {
  id: string
  name: string
  code: string
  isEntry: boolean
}

export interface DesktopProject {
  schemaVersion: number
  id: string
  name: string
  template: string
  files: ProjectFile[]
  createdAt: string
  updatedAt: string
}

export interface ProjectSummary {
  id: string
  name: string
  template: string
  createdAt: string
  updatedAt: string
  fileCount: number
}

export interface CreateProjectInput {
  name: string
  template: string
  files: ProjectFile[]
}

export type MenuAction =
  | 'new-project'
  | 'open-library'
  | 'save'
  | 'save-as'
  | 'import-project'
  | 'export-project'
  | 'view-split'
  | 'view-editor'
  | 'view-preview'
  | 'toggle-explorer'
  | 'toggle-theme'
  | 'toggle-play'
  | 'restart'
  | 'step'
  | 'cycle-speed'
  | 'search'
  | 'about'
