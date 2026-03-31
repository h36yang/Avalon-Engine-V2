const apiKey = process.argv[2] || process.env.NVIDIA_API_KEY;
if (!apiKey) { console.error('Usage: node test-nvidia.mjs <api-key>'); process.exit(1); }

const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
  body: JSON.stringify({
    model: 'meta/llama-3.3-70b-instruct',
    messages: [{ role: 'user', content: 'Say hi in one word.' }],
    max_tokens: 10,
  }),
});
const data = await res.json();
if (!res.ok) { console.error('❌ Error:', JSON.stringify(data, null, 2)); process.exit(1); }
console.log('✅ Success:', data.choices[0].message.content);
