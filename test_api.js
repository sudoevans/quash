const apiUrl = 'http://localhost:4000';
const agentId = 'claude-local-agent';

const validAgentQuery = {
  error: { message: "Cannot find module 'autoprefixer'", type: "import_error" },
  environment: { 
    os: { family: "windows", version: "10" }, 
    runtime: { name: "node", version: "18" }
  },
  sandbox: { required: false, reproduce_with: ["npm run dev"] },
  agent: {
    id: agentId,
    retry_count: 3,
    urgency: "standard",
    bounty: "5.00"
  },
  attempts: []
};

async function run() {
  try {
    console.log('✅ API is online. Testing endpoints...\n');

    console.log('--- 1. GET /solutions/search ---');
    let res = await fetch(`${apiUrl}/solutions/search?q=autoprefixer`);
    console.log(JSON.stringify(await res.json(), null, 2));

    console.log('\n--- 2. POST /problems (Post Live Bounty) ---');
    res = await fetch(`${apiUrl}/problems`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Agent-Id': agentId },
      body: JSON.stringify(validAgentQuery)
    });
    const prob = await res.json();
    console.log(JSON.stringify(prob, null, 2));

    if (prob.problem_id) {
      console.log('\n--- 3. GET /problems/:id/status (Poll Status) ---');
      res = await fetch(`${apiUrl}/problems/${prob.problem_id}/status`, {
        headers: { 'X-Agent-Id': agentId }
      });
      console.log(JSON.stringify(await res.json(), null, 2));
    }

    console.log('\n--- 4. POST /solve (Trigger 402 Payment Challenge) ---');
    res = await fetch(`${apiUrl}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Agent-Id': agentId },
      body: JSON.stringify(validAgentQuery)
    });
    console.log(`HTTP Status: ${res.status}`);
    console.log(JSON.stringify(await res.json(), null, 2));

  } catch (err) {
    console.error('Error during test:', err.message);
  }
}

run();
