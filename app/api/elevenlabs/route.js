export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const VOICE_ID = "h72wUmGHLwM6m7tyUsEX";

export async function POST(request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return Response.json({ error: 'API 키 없음' }, { status: 500 });

  try {
    const { text } = await request.json();
    if (!text) return Response.json({ error: '텍스트 없음' }, { status: 400 });

    const { ElevenLabsClient } = await import('@elevenlabs/elevenlabs-js');
    const client = new ElevenLabsClient({ apiKey });

    const audioStream = await client.textToSpeech.convert(VOICE_ID, {
      text,
      modelId: 'eleven_multilingual_v2',
      voiceSettings: {
        stability: 0.85,
        similarityBoost: 0.95,
        style: 0.05,
        useSpeakerBoost: false,
      },
    });

    const chunks = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': 'attachment; filename="narration.mp3"',
      },
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
