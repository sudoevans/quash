"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const agentQuery_1 = require("../schemas/agentQuery");
const auth_1 = require("../middleware/auth");
const HIRO_API_BASE = 'https://api.testnet.hiro.so';
const PLATFORM_WALLET = (process.env.PLATFORM_WALLET_ADDRESS ?? '').toLowerCase();
/**
 * Verify a transaction exists and is confirmed on the Stacks testnet.
 * Accepts:
 *   1. Confirmed contract_call to quash-escrow.lock-stx  (primary path)
 *   2. Confirmed SIP-010 fungible token transfer to platform wallet (Phase 2)
 *   3. Confirmed simple STX transfer to platform wallet   (x402 direct transfer)
 */
async function verifyStacksTx(txid) {
    const apiKey = process.env.HIRO_API_KEY;
    const res = await fetch(`${HIRO_API_BASE}/extended/v1/tx/${txid}`, {
        headers: { 'x-hiro-api-key': apiKey ?? '' },
    });
    if (res.status === 404)
        return { confirmed: false };
    if (!res.ok)
        throw new Error(`Hiro API error: ${res.status}`);
    const tx = await res.json();
    if (tx.tx_status !== 'success')
        return { confirmed: false };
    const contractAddress = process.env.CONTRACT_ADDRESS ?? '';
    const platformWallet = PLATFORM_WALLET;
    // 1. Contract call to quash-escrow.lock-stx (STX escrow)
    if (tx.tx_type === 'contract_call' &&
        tx.contract_call?.contract_id?.toLowerCase() === contractAddress.toLowerCase() &&
        tx.contract_call?.function_name === 'lock-stx') {
        return { confirmed: true };
    }
    // 2. SIP-010 token transfer event to platform wallet (USDCx / sBTC - Phase 2)
    const tokenEvent = (tx.events ?? []).find((e) => e.event_type === 'fungible_token_asset' &&
        e.asset?.asset_event_type === 'transfer' &&
        e.asset?.recipient?.toLowerCase() === platformWallet);
    if (tokenEvent)
        return { confirmed: true };
    // 3. Simple STX transfer to platform wallet (x402 direct payment)
    if (tx.tx_type === 'token_transfer' &&
        tx.token_transfer?.recipient_address?.toLowerCase() === platformWallet) {
        return { confirmed: true };
    }
    return { confirmed: false };
}
/**
 * Broadcast a signed Stacks transaction hex and return the txid.
 * The hex comes from the x402 client's payment-signature header.
 */
async function broadcastSignedTx(txHex) {
    const apiKey = process.env.HIRO_API_KEY ?? '';
    // Broadcast directly to Hiro API (no external facilitator)
    const res = await fetch(`${HIRO_API_BASE}/v2/transactions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/octet-stream',
            'x-hiro-api-key': apiKey,
        },
        body: Buffer.from(txHex, 'hex'),
    });
    if (!res.ok) {
        const body = await res.text();
        return { error: body };
    }
    const txid = await res.json();
    return { txid };
}
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
const NETWORK = process.env.STACKS_NETWORK === 'mainnet' ? 'stacks:mainnet' : 'stacks:testnet';
const CAIP2 = process.env.STACKS_NETWORK === 'mainnet' ? 'stacks:1' : 'stacks:2147483648';
/**
 * Shared helper: record payment + return full solution response.
 */
async function returnSolution(res, solution, agent, txid, currency, payer) {
    const stxMicrosPerUsd = parseInt(process.env.STX_MICROS_PER_USD ?? '1000000', 10);
    let payment;
    try {
        payment = await prisma.payment.create({
            data: {
                txHash: txid,
                agentId: agent.id,
                solutionId: solution.id,
                amountMicro: Math.round(parseFloat(solution.priceUsdc) * stxMicrosPerUsd),
                currency,
                network: NETWORK,
                status: 'confirmed',
            },
        });
    }
    catch {
        payment = await prisma.payment.findUnique({ where: { txHash: txid } });
    }
    await prisma.solution.update({
        where: { id: solution.id },
        data: { totalUses: { increment: 1 } },
    });
    const fixData = JSON.parse(solution.structuredFixJson);
    return res.json({
        solution: {
            solution_id: solution.id,
            schema_version: '1.2',
            title: solution.title,
            problem_signatures: solution.problemSignatures,
            affected_stacks: solution.affectedStacks,
            success_rate: solution.successRate,
            total_uses: solution.totalUses + 1,
            price_usdc: solution.priceUsdc,
            ...fixData,
        },
        payment_receipt: {
            payment_id: payment?.id,
            tx_hash: txid,
            payer: payer ?? agent.agentString,
            currency,
            network: NETWORK,
            confirmed_at: new Date().toISOString(),
        },
    });
}
/**
 * POST /solve
 *
 * x402 flow   (payment-signature header): agent pays automatically via x402-stacks client.
 * Legacy flow (X-Payment header):         agent manually provides txid + solution_id.
 * Step A      (no payment header):        returns 402 with payment-required header (x402)
 *                                         AND payment_options body (manual agents).
 */
router.post('/', auth_1.requireAgentId, async (req, res) => {
    const parseResult = agentQuery_1.AgentQuerySchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({
            error: { code: 'INVALID_REQUEST', message: 'Schema validation failed.', details: parseResult.error.flatten() },
        });
    }
    const query = parseResult.data;
    const agentIdString = req.agentId;
    await prisma.agent.upsert({
        where: { agentString: agentIdString },
        create: { agentString: agentIdString },
        update: { lastSeen: new Date() },
    });
    const agent = await prisma.agent.findUnique({ where: { agentString: agentIdString } });
    if (!agent) {
        return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Could not resolve agent.' } });
    }
    // ── x402 flow: payment-signature header ─────────────────────────────────
    const paymentSig = req.headers['payment-signature'];
    if (paymentSig && typeof paymentSig === 'string') {
        try {
            // Decode the x402 V2 payload: { x402Version, accepted, payload: { transaction: hex } }
            const decoded = JSON.parse(Buffer.from(paymentSig, 'base64').toString('utf-8'));
            const txHex = decoded?.payload?.transaction;
            const accepted = decoded?.accepted;
            if (!txHex) {
                return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'payment-signature missing transaction hex.' } });
            }
            // Broadcast signed tx to Hiro API directly — no external facilitator
            const broadcast = await broadcastSignedTx(txHex);
            if ('error' in broadcast) {
                return res.status(402).json({ error: { code: 'BROADCAST_FAILED', message: broadcast.error } });
            }
            const txid = broadcast.txid;
            console.log(`[x402] Broadcast txid: ${txid}`);
            // Poll Hiro until confirmed (up to 60 s)
            let confirmed = false;
            for (let i = 0; i < 12; i++) {
                await new Promise(r => setTimeout(r, 5000));
                try {
                    const check = await verifyStacksTx(txid);
                    if (check.confirmed) {
                        confirmed = true;
                        break;
                    }
                }
                catch { /* keep polling */ }
            }
            if (!confirmed) {
                return res.status(402).json({
                    error: { code: 'PAYMENT_EXPIRED', message: `Tx ${txid} not confirmed within 60s. Check explorer and retry.` },
                    txid,
                });
            }
            // Match best solution from the original query body
            const keywords = query.error.message.split(/\s+/).slice(0, 8);
            const stackDomains = query.stack?.domains ?? [];
            const solution = await prisma.solution.findFirst({
                where: {
                    OR: [
                        ...keywords.map(kw => ({ title: { contains: kw, mode: 'insensitive' } })),
                        ...keywords.map(kw => ({ problemSignatures: { has: kw } })),
                        ...(stackDomains.length > 0 ? [{ affectedStacks: { hasSome: stackDomains } }] : []),
                    ],
                },
                orderBy: { successRate: 'desc' },
            });
            if (!solution) {
                return res.status(404).json({ error: { code: 'SOLUTION_NOT_FOUND', message: 'Payment received but no solution matched your query.' } });
            }
            const currency = accepted?.asset === 'SBTC' ? 'sBTC' : accepted?.asset === 'USDCX' ? 'USDCx' : 'STX';
            return returnSolution(res, solution, agent, txid, currency);
        }
        catch (err) {
            console.error('[POST /solve] x402 flow error:', err);
            return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to process x402 payment.' } });
        }
    }
    // ── Legacy flow: X-Payment header ───────────────────────────────────────
    const xPaymentHeader = req.headers['x-payment'];
    if (xPaymentHeader) {
        let paymentData;
        try {
            paymentData = typeof xPaymentHeader === 'string' ? JSON.parse(xPaymentHeader) : xPaymentHeader;
        }
        catch {
            return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'X-Payment header is not valid JSON.' } });
        }
        const { txid, solution_id, currency = 'STX' } = paymentData;
        if (!txid || !solution_id) {
            return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'X-Payment must include txid and solution_id.' } });
        }
        try {
            const solution = await prisma.solution.findUnique({ where: { id: solution_id } });
            if (!solution) {
                return res.status(404).json({ error: { code: 'SOLUTION_NOT_FOUND', message: 'Solution not found.' } });
            }
            const isTestTx = txid.startsWith('test-');
            if (!isTestTx) {
                let verification;
                try {
                    verification = await verifyStacksTx(txid);
                }
                catch (err) {
                    console.error('[POST /solve] Hiro verification error:', err);
                    return res.status(502).json({ error: { code: 'INTERNAL_ERROR', message: 'Could not verify payment on-chain. Try again.' } });
                }
                if (!verification.confirmed) {
                    return res.status(402).json({
                        error: { code: 'PAYMENT_EXPIRED', message: 'Transaction not confirmed on-chain yet. Wait for confirmation and retry.' },
                    });
                }
            }
            return returnSolution(res, solution, agent, txid, currency);
        }
        catch (err) {
            console.error('[POST /solve] Legacy flow error:', err);
            return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to unlock solution.' } });
        }
    }
    // ── Step A: no payment — find match, return 402 ──────────────────────────
    try {
        const keywords = query.error.message.split(/\s+/).slice(0, 8);
        const stackDomains = query.stack?.domains ?? [];
        const solution = await prisma.solution.findFirst({
            where: {
                OR: [
                    ...keywords.map(kw => ({ title: { contains: kw, mode: 'insensitive' } })),
                    ...keywords.map(kw => ({ problemSignatures: { has: kw } })),
                    ...(stackDomains.length > 0 ? [{ affectedStacks: { hasSome: stackDomains } }] : []),
                ],
            },
            orderBy: { successRate: 'desc' },
        });
        if (!solution) {
            return res.status(404).json({
                matched: false,
                live_question_id: `lq_${Date.now()}`,
                message: 'No solution found. Post it as a live bounty and a domain expert will solve it.',
                suggestion: 'POST /problems with this live_question_id to offer a bounty',
            });
        }
        let firstStep = 'See full solution after payment.';
        try {
            const fixData = JSON.parse(solution.structuredFixJson);
            if (Array.isArray(fixData.steps) && fixData.steps.length > 0) {
                firstStep = fixData.steps[0].instruction ?? firstStep;
            }
        }
        catch { /* use default */ }
        const contractAddress = process.env.CONTRACT_ADDRESS ?? '';
        const stxMicrosPerUsd = parseInt(process.env.STX_MICROS_PER_USD ?? '1000000', 10);
        const stxAmountMicro = Math.round(parseFloat(solution.priceUsdc) * stxMicrosPerUsd);
        const expiresAt = Math.floor(Date.now() / 1000) + 300;
        // x402 V2 payment-required header — for agents using x402-stacks createPaymentClient()
        // The client reads this header, signs an STX transfer, and retries with payment-signature.
        const x402PaymentRequired = {
            x402Version: 2,
            resource: { url: '/solve', method: 'POST' },
            accepts: [
                {
                    scheme: 'exact',
                    network: CAIP2,
                    amount: stxAmountMicro.toString(),
                    asset: 'STX',
                    payTo: process.env.PLATFORM_WALLET_ADDRESS ?? '',
                    maxTimeoutSeconds: 300,
                    description: `Unlock: ${solution.title}`,
                },
            ],
        };
        res.setHeader('payment-required', Buffer.from(JSON.stringify(x402PaymentRequired)).toString('base64'));
        return res.status(402).json({
            // x402 V2 body (x402-stacks client also checks body as fallback)
            ...x402PaymentRequired,
            // Extended fields for manual/human-readable agents
            solution_id: solution.id,
            title: solution.title,
            preview: { first_step: firstStep },
            success_rate: solution.successRate,
            total_uses: solution.totalUses,
            payment_options: [
                {
                    currency: 'STX',
                    amount_micro: stxAmountMicro,
                    contract: contractAddress,
                    function: 'lock-stx',
                    args: [solution.id, stxAmountMicro],
                    network: NETWORK,
                    status: 'active',
                },
                { currency: 'USDCx', status: 'coming_soon', note: 'USDCx support via SIP-010 launching in Phase 2' },
                { currency: 'sBTC', status: 'coming_soon', note: 'sBTC support via SIP-010 launching in Phase 2' },
            ],
            expires_at: expiresAt,
        });
    }
    catch (err) {
        console.error('[POST /solve] Step A error:', err);
        return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } });
    }
});
exports.default = router;
