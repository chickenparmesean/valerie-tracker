'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import EmptyState from '@/components/ui/EmptyState';

interface Task {
  id: string;
  title: string;
  status: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  requireTask: boolean;
  color?: string;
  tasks: Task[];
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [newTaskName, setNewTaskName] = useState<Record<string, string>>({});

  const handleCreateProject = async () => {
    if (!name.trim()) return;
    // In production: POST to /api/projects
    const newProject: Project = {
      id: `temp-${Date.now()}`,
      name,
      description,
      status: 'ACTIVE',
      requireTask: false,
      tasks: [],
    };
    setProjects([newProject, ...projects]);
    setName('');
    setDescription('');
    setShowForm(false);
  };

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="Manage projects and tasks"
        action={
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'New Project'}
          </Button>
        }
      />

      {showForm && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input
              label="Project Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Email Management"
            />
            <Input
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={handleCreateProject}>Create Project</Button>
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {projects.length === 0 ? (
        <Card>
          <EmptyState
            title="No projects yet"
            description="Create your first project to start organizing work and tracking time."
            action={
              <Button onClick={() => setShowForm(true)}>Create First Project</Button>
            }
          />
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {projects.map((project) => (
            <Card key={project.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => setExpanded((prev) => ({ ...prev, [project.id]: !prev[project.id] }))}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 12,
                      color: '#8E8E9A',
                    }}
                  >
                    {expanded[project.id] ? '\u25BC' : '\u25B6'}
                  </button>
                  {project.color && (
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        background: project.color,
                      }}
                    />
                  )}
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{project.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Badge status={project.status}>{project.status}</Badge>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#8E8E9A' }}>
                    {project.tasks.length} tasks
                  </span>
                </div>
              </div>

              {expanded[project.id] && (
                <div style={{ marginTop: 12, paddingLeft: 30 }}>
                  {project.tasks.map((task) => (
                    <div
                      key={task.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 0',
                        borderBottom: '1px solid #EDECE8',
                      }}
                    >
                      <span style={{ fontSize: 13 }}>{task.title}</span>
                      <Badge status={task.status}>{task.status}</Badge>
                    </div>
                  ))}

                  {/* Add task inline */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <input
                      type="text"
                      placeholder="Add a task..."
                      value={newTaskName[project.id] ?? ''}
                      onChange={(e) =>
                        setNewTaskName((prev) => ({ ...prev, [project.id]: e.target.value }))
                      }
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        fontSize: 13,
                        border: '1px solid #E2E1DC',
                        borderRadius: 4,
                        outline: 'none',
                      }}
                    />
                    <Button size="sm">Add</Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
