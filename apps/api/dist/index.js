"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const solutions_1 = __importDefault(require("./routes/solutions"));
const solve_1 = __importDefault(require("./routes/solve"));
const problems_1 = __importDefault(require("./routes/problems"));
const feedback_1 = __importDefault(require("./routes/feedback"));
const webhooks_1 = __importDefault(require("./routes/webhooks"));
const auth_1 = __importDefault(require("./routes/auth"));
const agents_1 = __importDefault(require("./routes/agents"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
// ---- Middleware ----
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// ---- Routes ----
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', api: 'QuashAPI v1.0', ts: new Date().toISOString() });
});
app.use('/auth', auth_1.default);
app.use('/agents', agents_1.default);
app.use('/solutions', solutions_1.default);
app.use('/solve', solve_1.default);
app.use('/problems', problems_1.default);
app.use('/feedback', feedback_1.default);
app.use('/webhooks', webhooks_1.default);
// ---- 404 Fallthrough ----
app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
});
app.listen(PORT, () => {
    console.log(`\n🔧 QuashAPI v1.0 running on http://localhost:${PORT}`);
    console.log(`   Network: ${process.env.STACKS_NETWORK ?? 'testnet'}`);
});
