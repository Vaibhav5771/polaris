"use client"

import Image from "next/image"
import { Pencil, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type { EditorProject } from "@/lib/project-types"

interface ProjectSidebarProps {
  activeProjectId?: string
  isOpen: boolean
  onClose: () => void
  onCreateProject: () => void
  onDeleteProject: (project: EditorProject) => void
  onOpenProject: (projectId: string) => void
  onRenameProject: (project: EditorProject) => void
  ownedProjects: EditorProject[]
  sharedProjects: EditorProject[]
}

function ProjectList({
  activeProjectId,
  emptyLabel,
  onDeleteProject,
  onOpenProject,
  onRenameProject,
  projects,
}: {
  activeProjectId?: string
  emptyLabel: string
  onDeleteProject: (project: EditorProject) => void
  onOpenProject: (projectId: string) => void
  onRenameProject: (project: EditorProject) => void
  projects: EditorProject[]
}) {
  if (projects.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  }

  return (
    <div className="w-full space-y-1">
      {projects.map((project) => (
        <div
          key={project.id}
          className={cn(
            "group flex min-h-11 items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent",
            activeProjectId === project.id && "bg-accent"
          )}
        >
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => onOpenProject(project.id)}
            aria-current={activeProjectId === project.id ? "page" : undefined}
          >
            <span className="block truncate text-sm font-medium text-foreground">
              {project.name}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {project.roomId}
            </span>
          </button>
          {project.owned ? (
            <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onRenameProject(project)}
                aria-label={`Rename ${project.name}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => onDeleteProject(project)}
                aria-label={`Delete ${project.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export function ProjectSidebar({
  activeProjectId,
  isOpen,
  onClose,
  onCreateProject,
  onDeleteProject,
  onOpenProject,
  onRenameProject,
  ownedProjects,
  sharedProjects,
}: ProjectSidebarProps) {
  return (
    <>
      {isOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[45] bg-black/60 md:hidden"
          onClick={onClose}
          aria-label="Close sidebar"
        />
      ) : null}

      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-72 z-50 flex flex-col bg-card border-r border-border transition-transform duration-200",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Polaris logo"
              width={28}
              height={28}
              className="h-7 w-7 shrink-0 rounded-lg"
            />
            <span className="font-brand text-base font-semibold tracking-tight text-foreground">
              Polaris
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close sidebar">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-col flex-1 overflow-hidden px-2 pt-2">
          <Tabs defaultValue="my-projects" className="flex flex-col flex-1">
            <TabsList className="w-full">
              <TabsTrigger value="my-projects" className="flex-1">My Projects</TabsTrigger>
              <TabsTrigger value="shared" className="flex-1">Shared</TabsTrigger>
            </TabsList>
            <TabsContent value="my-projects" className="flex-1 flex items-start justify-center mt-0 py-3">
              <ProjectList
                activeProjectId={activeProjectId}
                emptyLabel="No projects yet"
                onDeleteProject={onDeleteProject}
                onOpenProject={onOpenProject}
                onRenameProject={onRenameProject}
                projects={ownedProjects}
              />
            </TabsContent>
            <TabsContent value="shared" className="flex-1 flex items-start justify-center mt-0 py-3">
              <ProjectList
                activeProjectId={activeProjectId}
                emptyLabel="No shared projects"
                onDeleteProject={onDeleteProject}
                onOpenProject={onOpenProject}
                onRenameProject={onRenameProject}
                projects={sharedProjects}
              />
            </TabsContent>
          </Tabs>
        </div>

        <div className="p-3 border-t border-border shrink-0">
          <Button variant="secondary" className="w-full" onClick={onCreateProject}>
            <Plus className="h-4 w-4" />
            New project
          </Button>
        </div>
      </aside>
    </>
  )
}
