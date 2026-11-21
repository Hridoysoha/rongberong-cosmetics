// Real-AI shop assistant — Gemini (free tier) via a Netlify Function.
// The API key lives ONLY in the Netlify environment variable GEMINI_API_KEY — never in code.
const MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-4-hydrogen'];

const SYSTEM = [
  'তুমি "রংবেরং ফ্লাওয়ার গিফট এন্ড কসমেটিক্স" নামের একটি দোকানের AI সহায়িকা। দোকানটি সোনাইপুল বাজার, রামগড়, খাগড়াছড়িতে। তুমি কাস্টমারের সাথে বন্ধুসুলভভাবে কথা বলো, প্রশ্নের উত্তর দাও এবং অর্ডার নিতে সাহায্য করো।',
  '',
  'দোকানের তথ্য (শুধু এগুলোই ব্যবহার করবে, নিজে কিছু বানাবে না):',
  '- পণ্য: লিপ বাম ও লিপ অয়েল কালেকশন; ফেস মাস্ক / নেক গেইটার (৫ পিস, UPF 50+ Anti-UV); HERBLEN ত্রিফলা গুঁড়া (১০০ গ্রাম); উকুনের চিরুনি (মেটাল ফাইন-টুথ); লেস-হাতা লেডিস টপস; রুচড টপস কালেকশন (SHEIN/ZARA স্টাইল); ফুলের কানের দুল ও মাথার টিকলি; গোল্ড রিং কালেকশন (২৪টি ডিজাইন); পার্টি পপার ও স্নো স্প্রে; ফয়েল ফ্রিঞ্জ কার্টেইন (১০টি রঙ); ডিজিটাল তসবিহ কাউন্টার ও মিসওয়াক। এছাড়াও দোকানে জুয়েলারি, ব্যাগ/ঘড়ি/সানগ্লাস, গিফট আইটেম, বাচ্চাদের খেলনা ও ফুল পাওয়া যায়।',
  '- দাম: এই দোকান কোনো পণ্যের দাম প্রকাশ করে না। কেউ দাম জানতে চাইলে বলবে: "দাম জানতে আমাদের WhatsApp নম্বরে (01856109210) মেসেজ করুন বা কল করুন।" নিজে কখনো কোনো দাম বানিয়ে বলবে না।',
  '- ডেলিভারি: হোম ডেলিভারি শুধু রামগড়ে।',
  '- পেমেন্ট: ক্যাশ অন ডেলিভারি (পণ্য হাতে পেয়ে টাকা)।',
  '- ঠিকানা: সোনাইপুল বাজার, রামগড়, খাগড়াছড়ি। ফোন/WhatsApp: 01856109210।',
  '',
  'নিয়ম:',
  '1. কাস্টমার বাংলায় লিখলে বাংলায়, ইংরেজিতে লিখলে সহজ ইংরেজিতে উত্তর দাও। উত্তর ছোট রাখো (২–৪ লাইন)।',
  '2. শুধু এই দোকান ও এর পণ্য সম্পর্কে উত্তর দাও। অন্য বিষয়ে জিজ্ঞেস করলে ভদ্রভাবে বলো তুমি শুধু দোকানের বিষয়ে সাহায্য করতে পারো।',
  '3. কেউ অর্ডার করতে চাইলে একে একে জিজ্ঞেস করো: (ক) নাম, (খ) মোবাইল নম্বর, (গ) কোন পণ্য। একবারে একটা প্রশ্ন করো।',
  '4. নাম, সঠিক মোবাইল নম্বর ও পণ্য — তিনটে পেয়ে গেলে অর্ডারের সারসংক্ষেপ দাও, জানাও নিচে WhatsApp বাটন আসবে সেখানে চাপ দিলেই অর্ডার পৌঁছে যাবে এবং আমরা কল করে কনফার্ম করব। আর তোমার উত্তরের একদম শেষে, আলাদা লাইনে, ঠিক এই ফরম্যাটে লিখবে: LEAD_JSON:{"name":"কাস্টমারের নাম","phone":"মোবাইল নম্বর","product":"পণ্যের নাম"}',
  '5. LEAD_JSON লাইনটা শুধু তখনই লিখবে যখন তিনটে তথ্যই হাতে আছে। অন্য সময় কখনো লিখবে না।'
].join('\n');

exports.handler = async function (event) {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  const key = process.env.GEMINI_API_KEY;
  if (!key) return { statusCode: 500, headers, body: JSON.stringify({ reply: 'সার্ভার সেটআপ বাকি আছে (API key পাওয়া যায়নি)।' }) };

  let messages = [];
  try { messages = (JSON.parse(event.body || '{}').messages) || []; } catch (e) { messages = []; }
  messages = messages.slice(-12)
    .filter(function (m) { return m && m.text; })
    .map(function (m) { return { role: m.role === 'model' ? 'model' : 'user', parts: [{ text: String(m.text).slice(0, 1000) }] }; });
  if (!messages.length) return { statusCode: 400, headers, body: JSON.stringify({ reply: 'কিছু লিখুন, আমি উত্তর দিচ্ছি।' }) };

  const payload = {
    system_instruction: { parts: [{ text: SYSTEM }] },
    contents: messages,
    generationConfig: { temperature: 0.6, maxOutputTokens: 512 }
  };

  for (let i = 0; i < MODELS.length; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(function () { ctrl.abort(); }, 9000);
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + MODELS[i] + ':generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });
      const j = await r.json();
      if (!r.ok) { clearTimeout(timer); continue; }
      const parts = ((((j.candidates || [])[0] || {}).content || {}).parts) || [];
      const text = parts.map(function (p) { return p.text || ''; }).join('').trim();
      if (text) { clearTimeout(timer); return { statusCode: 200, headers, body: JSON.stringify({ reply: text }) }; }
      clearTimeout(timer);
    } catch (e) { clearTimeout(timer); /* try next model */ }
  }
  return { statusCode: 200, headers, body: JSON.stringify({ reply: 'দুঃখিত, AI এখন একটু ব্যস্ত আছে। একটু পরে আবার চেষ্টা করুন।' }) };
};
