export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const latestMessage = messages[messages.length - 1]?.content;

    if (!latestMessage || latestMessage.trim().length === 0) {
      return new Response(
        JSON.stringify({
          role: "assistant",
          content: "Please ask me something about ABES Engineering College!",
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const backendResponse = await fetch(
      "http://127.0.0.1:8000/api/chat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: latestMessage,
        }),
      }
    );

    const data = await backendResponse.json();

    if (!backendResponse.ok) {
      return new Response(
        JSON.stringify({
          error: data.detail || data.error || "Backend request failed",
        }),
        {
          status: backendResponse.status,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        role: "assistant",
        content: data.answer,
        sources: data.sources || [],
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Chat API proxy error:", err);

    return new Response(
      JSON.stringify({
        error: "Unable to connect to the ABES FAQ backend.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
