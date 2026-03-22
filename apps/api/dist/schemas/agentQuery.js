"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentQuerySchema = exports.OutcomeEnum = exports.UrgencyEnum = exports.ErrorTypeEnum = void 0;
const zod_1 = require("zod");
exports.ErrorTypeEnum = zod_1.z.enum([
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
exports.UrgencyEnum = zod_1.z.enum(['critical', 'urgent', 'standard', 'deep']);
exports.OutcomeEnum = zod_1.z.enum(['resolved', 'partial', 'not_applicable', 'failed']);
exports.AgentQuerySchema = zod_1.z.object({
    schema_version: zod_1.z.string().default('1.0'),
    error: zod_1.z.object({
        message: zod_1.z.string(),
        type: exports.ErrorTypeEnum,
        exit_code: zod_1.z.number().int().nullable().optional(),
        stderr: zod_1.z.string().optional().default(''),
        stdout: zod_1.z.string().optional().default(''),
        signal: zod_1.z.string().nullable().optional(),
    }),
    environment: zod_1.z.object({
        os: zod_1.z.object({
            family: zod_1.z.enum(['linux', 'darwin', 'windows']),
            distro: zod_1.z.string().optional(),
            version: zod_1.z.string().optional(),
            arch: zod_1.z.enum(['amd64', 'arm64', 'arm']).optional(),
            libc: zod_1.z.enum(['musl', 'glibc']).nullable().optional(),
        }),
        runtime: zod_1.z.object({ name: zod_1.z.string(), version: zod_1.z.string() }).optional(),
        shell: zod_1.z.object({ name: zod_1.z.string(), variant: zod_1.z.string().optional(), version: zod_1.z.string().optional() }).optional(),
        container: zod_1.z.object({ image: zod_1.z.string(), runtime: zod_1.z.string() }).optional(),
        ci: zod_1.z.object({ provider: zod_1.z.string(), runner: zod_1.z.string() }).optional(),
        tool_versions: zod_1.z.record(zod_1.z.string()).optional(),
    }).optional(),
    source: zod_1.z.object({
        repo: zod_1.z.string().optional(),
        file: zod_1.z.string().optional(),
        line: zod_1.z.number().int().nullable().optional(),
        command: zod_1.z.string().optional(),
        triggered_by: zod_1.z.string().optional(),
    }).optional(),
    stack: zod_1.z.object({
        domains: zod_1.z.array(zod_1.z.string()).optional(),
        languages: zod_1.z.array(zod_1.z.string()).optional(),
        frameworks: zod_1.z.array(zod_1.z.string()).optional(),
        package_manager: zod_1.z.enum(['npm', 'pip', 'cargo', 'go', 'composer', 'gem']).nullable().optional(),
    }).optional(),
    attempts: zod_1.z.array(zod_1.z.object({
        fix: zod_1.z.string(),
        result: zod_1.z.enum(['failed', 'partial']),
        new_error: zod_1.z.string().optional(),
    })).optional(),
    sandbox: zod_1.z.object({
        required: zod_1.z.boolean(),
        reproduce_with: zod_1.z.array(zod_1.z.string()).optional(),
        expected_error_output: zod_1.z.string().optional(),
    }).optional(),
    agent: zod_1.z.object({
        id: zod_1.z.string(),
        retry_count: zod_1.z.number().int().optional(),
        urgency: exports.UrgencyEnum.optional().default('standard'),
        bounty: zod_1.z.string().nullable().optional(),
    }),
});
