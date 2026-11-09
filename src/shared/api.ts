import type {
  CreateProjectInput,
  DesktopProject,
  MenuAction,
  ProjectSummary,
} from './types'

export interface AngazaApi {
  platform: string
  getVersion: () => Promise<string>
  projects: {
    list: () => Promise<ProjectSummary[]>
    load: (id: string) => Promise<DesktopProject>
    create: (input: CreateProjectInput) => Promise<DesktopProject>
    save: (project: DesktopProject) => Promise<ProjectSummary>
    remove: (id: string) => Promise<void>
    duplicate: (id: string) => Promise<DesktopProject>
    rename: (id: string, name: string) => Promise<ProjectSummary>
    importProject: () => Promise<DesktopProject | null>
    exportProject: (project: DesktopProject) => Promise<boolean>
  }
  screenshots: {
    save: (dataUrl: string, suggestedName: string) => Promise<boolean>
  }
  openProjectsFolder: () => Promise<void>
  setTitle: (title: string) => void
  onMenuAction: (callback: (action: MenuAction) => void) => () => void
  onRequestClose: (callback: () => void) => () => void
  confirmClose: () => void
}
