import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
  repoSummary,
  searchHistory,
  getCommit,
  getDiff,
  getBlame,
  getFileHistory,
  searchSource,
} from '../git/tools';

export const repoSummaryTool = createTool({
  id: 'repo_summary',
  description: 'Retrieves high-level summary of the repository including branch, HEAD SHA, recent commits, and tracked file count.',
  inputSchema: z.object({
    repoPath: z.string().describe('Absolute local repository path'),
  }),
  execute: async ({ repoPath }) => {
    return await repoSummary(repoPath);
  },
});

export const searchHistoryTool = createTool({
  id: 'search_history',
  description: 'Searches Git commit messages for keywords or bug identifiers.',
  inputSchema: z.object({
    repoPath: z.string().describe('Absolute local repository path'),
    query: z.string().describe('Keyword or search string'),
    limit: z.number().int().optional().default(10).describe('Max commits to return (capped at 30)'),
  }),
  execute: async ({ repoPath, query, limit }) => {
    return await searchHistory(repoPath, query, limit);
  },
});

export const getCommitTool = createTool({
  id: 'get_commit',
  description: 'Retrieves metadata, author, date, message body, and changed files for a specific commit SHA.',
  inputSchema: z.object({
    repoPath: z.string().describe('Absolute local repository path'),
    sha: z.string().describe('Commit SHA or revision'),
  }),
  execute: async ({ repoPath, sha }) => {
    return await getCommit(repoPath, sha);
  },
});

export const getDiffTool = createTool({
  id: 'get_diff',
  description: 'Retrieves the bounded patch diff for a commit, optionally filtered to a single relative file path.',
  inputSchema: z.object({
    repoPath: z.string().describe('Absolute local repository path'),
    sha: z.string().describe('Commit SHA'),
    filePath: z.string().optional().describe('Optional repo-relative file path'),
  }),
  execute: async ({ repoPath, sha, filePath }) => {
    return await getDiff(repoPath, sha, filePath);
  },
});

export const getBlameTool = createTool({
  id: 'get_blame',
  description: 'Retrieves git blame lines with author, date, and commit SHA for a file and line range.',
  inputSchema: z.object({
    repoPath: z.string().describe('Absolute local repository path'),
    filePath: z.string().describe('Repo-relative file path'),
    startLine: z.number().int().default(1).describe('Starting line number'),
    endLine: z.number().int().default(50).describe('Ending line number'),
  }),
  execute: async ({ repoPath, filePath, startLine, endLine }) => {
    return await getBlame(repoPath, filePath, startLine, endLine);
  },
});

export const getFileHistoryTool = createTool({
  id: 'get_file_history',
  description: 'Returns list of commits that touched a specific repo-relative file path.',
  inputSchema: z.object({
    repoPath: z.string().describe('Absolute local repository path'),
    filePath: z.string().describe('Repo-relative file path'),
    limit: z.number().int().optional().default(10),
  }),
  execute: async ({ repoPath, filePath, limit }) => {
    return await getFileHistory(repoPath, filePath, limit);
  },
});

export const searchSourceTool = createTool({
  id: 'search_source',
  description: 'Greps tracked repository source code for terms, skipping binary and sensitive files.',
  inputSchema: z.object({
    repoPath: z.string().describe('Absolute local repository path'),
    query: z.string().describe('Search query'),
    glob: z.string().optional().describe('Optional file glob filter'),
  }),
  execute: async ({ repoPath, query, glob }) => {
    return await searchSource(repoPath, query, glob);
  },
});

export const mastraGitTools = {
  repo_summary: repoSummaryTool,
  search_history: searchHistoryTool,
  get_commit: getCommitTool,
  get_diff: getDiffTool,
  get_blame: getBlameTool,
  get_file_history: getFileHistoryTool,
  search_source: searchSourceTool,
};
