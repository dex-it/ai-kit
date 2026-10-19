import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { projectSlug, projectsRoot, subagentsDir, transcriptPath } from '../hooks/paths.ts'

describe('paths', () => {
  it('имя папки проекта - путь с заменой не букв и не цифр', () => {
    assert.equal(projectSlug('/Users/anonymous/Desktop/Work/Marketplace'), '-Users-anonymous-Desktop-Work-Marketplace')
    assert.equal(projectSlug('/a/.cache/b_c'), '-a--cache-b-c')
  })

  it('путь транскрипта и папка субагентов', () => {
    const path = transcriptPath('/h/.claude/', '/p/q', 'id1')

    assert.equal(path, '/h/.claude/projects/-p-q/id1.jsonl')
    assert.equal(subagentsDir(path ?? ''), '/h/.claude/projects/-p-q/id1/subagents')
    assert.equal(projectsRoot('/h/.claude/'), '/h/.claude/projects')
  })

  it('слишком длинный путь не восстанавливается', () => {
    assert.equal(transcriptPath('/h', `/${'a'.repeat(250)}`, 'id'), null)
  })
})
