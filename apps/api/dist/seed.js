"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Seed script — populates the DB with a test author and sample solutions.
 * Run with: npx ts-node src/seed.ts
 */
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Seeding database...');
    // Test author (User)
    const author = await prisma.user.upsert({
        where: { email: 'test-author@quash.dev' },
        update: {},
        create: {
            id: 'seed-author-001',
            name: 'Test Author',
            email: 'test-author@quash.dev',
            stacksAddress: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE',
        },
    });
    console.log('Author:', author.id);
    // Solution 1 — Alpine/busybox sed incompatibility
    const sol1 = await prisma.solution.upsert({
        where: { id: 'seed-sol-001' },
        update: {},
        create: {
            id: 'seed-sol-001',
            title: 'Use awk instead of sed on Alpine — busybox sed does not support -i.bak',
            authorId: author.id,
            problemSignatures: ['busybox-sed-incompatible', 'sed-i-flag-alpine', 'dev-stdin-unavailable'],
            affectedStacks: ['alpine', 'shell', 'twenty-crm', 'docker'],
            priceUsdc: '0.03',
            successRate: 0.87,
            totalUses: 312,
            structuredFixJson: JSON.stringify({
                explanation: 'Alpine Linux uses busybox, a stripped-down toolkit with a minimal sed implementation. Unlike GNU sed, busybox sed does not support the -i.bak flag for in-place editing or reading from /dev/stdin via pipe. The fix is to replace the sed block with awk, which ships in all Alpine images.',
                steps: [
                    {
                        order: 1,
                        instruction: 'Confirm you are running busybox sed: sed --version — if output contains BusyBox, apply this fix',
                        is_executable: true,
                        command: 'sed --version 2>&1 | head -1',
                    },
                    {
                        order: 2,
                        instruction: 'Replace the entire sed block in inject-runtime-env.sh with the awk alternative below',
                        is_executable: false,
                        command: null,
                    },
                    {
                        order: 3,
                        instruction: 'Run the build to confirm the fix works',
                        is_executable: true,
                        command: 'npm run build',
                    },
                ],
                code_patch: "--- a/scripts/inject-runtime-env.sh\n+++ b/scripts/inject-runtime-env.sh\n-echo \"$CONFIG_BLOCK\" | sed -i.bak '...' build/index.html\n+awk -v block=\"$CONFIG_BLOCK\" '\n+  /<!-- BEGIN: Twenty Config -->/ { found=1; print; print block; next }\n+  /<!-- END: Twenty Config -->/ { found=0; next }\n+  !found { print }\n+' build/index.html > build/index.html.tmp && mv build/index.html.tmp build/index.html",
                verification_command: "grep -q 'REACT_APP_SERVER_BASE_URL' build/index.html && echo OK",
                verification_expected_output: 'OK',
                failure_modes: [
                    'Does not apply on Debian or Ubuntu where GNU sed is installed — the original sed command works fine there',
                    'Does not apply if Twenty version is below v0.20 where inject-runtime-env.sh has a different structure',
                ],
                written_from: 'personal_experience',
                author_confirmed_env: 'node:18-alpine · busybox sh 1.35 · twenty-crm v0.23 · 2025-07-12',
            }),
        },
    });
    console.log('Solution 1:', sol1.id);
    // Solution 2 — Install gnu-sed via apk as alternative fix
    const sol2 = await prisma.solution.upsert({
        where: { id: 'seed-sol-002' },
        update: {},
        create: {
            id: 'seed-sol-002',
            title: 'Install gnu-sed via apk to replace busybox sed on Alpine',
            authorId: author.id,
            problemSignatures: ['busybox-sed-incompatible', 'apk-gnu-sed'],
            affectedStacks: ['alpine', 'shell', 'docker'],
            priceUsdc: '0.03',
            successRate: 0.74,
            totalUses: 89,
            structuredFixJson: JSON.stringify({
                explanation: 'An alternative to rewriting the sed command is to install GNU sed via apk. This is simpler when you cannot modify the script but can modify the Dockerfile.',
                steps: [
                    {
                        order: 1,
                        instruction: 'Add gnu-sed to your Dockerfile before running the build script',
                        is_executable: true,
                        command: 'apk add --no-cache sed',
                    },
                    {
                        order: 2,
                        instruction: 'Verify GNU sed is now active',
                        is_executable: true,
                        command: 'sed --version | head -1',
                    },
                    {
                        order: 3,
                        instruction: 'Run your build to confirm it succeeds',
                        is_executable: true,
                        command: 'npm run build',
                    },
                ],
                code_patch: '--- a/Dockerfile\n+++ b/Dockerfile\n+RUN apk add --no-cache sed',
                verification_command: "sed --version | grep -q 'GNU sed' && echo OK",
                verification_expected_output: 'OK',
                failure_modes: [
                    'Not suitable if you cannot modify the Dockerfile or container image — use the awk solution instead',
                    'Adds ~200KB to image size — prefer awk rewrite for minimal images',
                ],
                written_from: 'oss_contribution',
                author_confirmed_env: 'node:18-alpine · apk 2.14.0 · 2025-08-01',
            }),
        },
    });
    console.log('Solution 2:', sol2.id);
    // Solution 3 — Node module not found (different domain for variety)
    const sol3 = await prisma.solution.upsert({
        where: { id: 'seed-sol-003' },
        update: {},
        create: {
            id: 'seed-sol-003',
            title: 'Fix Cannot find module error after switching to pnpm workspaces',
            authorId: author.id,
            problemSignatures: ['pnpm-workspace-module-not-found', 'phantom-dependency-pnpm'],
            affectedStacks: ['node', 'pnpm', 'monorepo'],
            priceUsdc: '0.03',
            successRate: 0.91,
            totalUses: 156,
            structuredFixJson: JSON.stringify({
                explanation: 'pnpm uses strict dependency isolation — packages cannot access dependencies not declared in their own package.json. If your code imports a package that is only declared in a parent workspace, pnpm will throw "Cannot find module". This is called a phantom dependency.',
                steps: [
                    {
                        order: 1,
                        instruction: 'Identify which package is missing by reading the exact module name from the error',
                        is_executable: false,
                        command: null,
                    },
                    {
                        order: 2,
                        instruction: 'Add the missing package to the dependencies of the package that imports it',
                        is_executable: true,
                        command: 'pnpm add <missing-package> --filter <your-package>',
                    },
                    {
                        order: 3,
                        instruction: 'Verify the install resolves the error',
                        is_executable: true,
                        command: 'pnpm --filter <your-package> build',
                    },
                ],
                code_patch: null,
                verification_command: 'pnpm --filter <your-package> build && echo OK',
                verification_expected_output: 'OK',
                failure_modes: [
                    'Does not apply with npm or yarn workspaces which hoist dependencies by default',
                    'Does not apply if the module is truly not installed anywhere in the workspace',
                ],
                written_from: 'production_incident',
                author_confirmed_env: 'node:20 · pnpm 9.0.0 · 2025-09-15',
            }),
        },
    });
    console.log('Solution 3:', sol3.id);
    console.log('\nSeed complete. Test with:');
    console.log('  GET  http://localhost:4000/health');
    console.log('  GET  http://localhost:4000/solutions/search?q=sed+alpine&stack=alpine,shell');
    console.log('  POST http://localhost:4000/solve   (X-Agent-Id: test-agent@quash.dev)');
    console.log('  POST http://localhost:4000/problems (X-Agent-Id: test-agent@quash.dev)');
    console.log('  POST http://localhost:4000/feedback (X-Agent-Id: test-agent@quash.dev)');
}
main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
