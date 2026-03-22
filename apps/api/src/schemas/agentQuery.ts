import { z } from 'zod';

export const ErrorTypeEnum = z.enum([
  'process_exit',
  'runtime_panic',
  'import_error',
  'compilation_error',
  'database_error',
  'network_timeout',
  'assertion_error',
  'permission_error',
  'environment_error',
  'memory_error',
]);

export const UrgencyEnum = z.enum(['critical', 'urgent', 'standard', 'deep']);
export const OutcomeEnum = z.enum(['resolved', 'partial', 'not_applicable', 'failed']);

export const AgentQuerySchema = z.object({
  schema_version: z.string().default('1.0'),
  error: z.object({
    message: z.string(),
    type: ErrorTypeEnum,
    exit_code: z.number().int().nullable().optional(),
    stderr: z.string().optional().default(''),
    stdout: z.string().optional().default(''),
    signal: z.string().nullable().optional(),
  }),
  environment: z.object({
    os: z.object({
      family: z.enum(['linux', 'darwin', 'windows']),
      distro: z.string().optional(),
      version: z.string().optional(),
      arch: z.enum(['amd64', 'arm64', 'arm']).optional(),
      libc: z.enum(['musl', 'glibc']).nullable().optional(),
    }),
    runtime: z.object({ name: z.string(), version: z.string() }).optional(),
    shell: z.object({ name: z.string(), variant: z.string().optional(), version: z.string().optional() }).optional(),
    container: z.object({ image: z.string(), runtime: z.string() }).optional(),
    ci: z.object({ provider: z.string(), runner: z.string() }).optional(),
    tool_versions: z.record(z.string()).optional(),
  }).optional(),
  source: z.object({
    repo: z.string().optional(),
    file: z.string().optional(),
    line: z.number().int().nullable().optional(),
    command: z.string().optional(),
    triggered_by: z.string().optional(),
  }).optional(),
  stack: z.object({
    domains: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
    frameworks: z.array(z.string()).optional(),
    package_manager: z.enum(['npm', 'pip', 'cargo', 'go', 'composer', 'gem']).nullable().optional(),
  }).optional(),
  attempts: z.array(z.object({
    fix: z.string(),
    result: z.string().optional(),
    new_error: z.string().optional(),
  })).optional(),
  sandbox: z.object({
    required: z.boolean().optional(),
    reproduce_with: z.union([z.array(z.string()), z.string()]).optional(),
    expected_error_output: z.string().optional(),
  }).optional(),
  agent: z.object({
    id: z.string(),
    retry_count: z.number().int().optional(),
    urgency: UrgencyEnum.optional().default('standard'),
    bounty: z.string().nullable().optional(),
  }),
});

export type AgentQuery = z.infer<typeof AgentQuerySchema>;
