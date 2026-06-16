import { NextRequest, NextResponse } from "next/server"

const AGENT_HANDLES: Record<string, string> = {
  "lil-claw": "@ZeimClaw_bot",
  "goop":     "@ProfessorGoop_bot",
  "mason":    "@MasonLLM_bot",
}

// Use VPS-resident bots as senders so pings work even when Alex's laptop is off.
// Pinging LC → Goop sends (avoids self-ping from LC's own token).
// Pinging Goop or Mason → LC sends (always-on VPS).
function pickSenderToken(agentId: string): string | undefined {
  if (agentId === "lil-claw") return process.env.TELEGRAM_BOT_TOKEN_GOOP
  return process.env.TELEGRAM_BOT_TOKEN_LC
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { agentId, message } = body as { agentId?: string; message?: string }

  const handle = agentId ? AGENT_HANDLES[agentId] : null
  if (!handle) {
    return NextResponse.json({ error: "unknown agent" }, { status: 400 })
  }

  const token  = pickSenderToken(agentId!)
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) {
    return NextResponse.json({ error: "telegram not configured" }, { status: 503 })
  }

  const text = message?.trim()
    ? `[Dashboard] ${handle} ${message.trim()}`
    : `[Dashboard] ${handle} quick status check — what's in your current chore queue, and is anything blocked or worth flagging?`

  const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ chat_id: chatId, text }),
  })

  const tgData = await tgRes.json()
  if (!tgData.ok) {
    return NextResponse.json({ error: tgData.description ?? "telegram error" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, message_id: tgData.result?.message_id })
}
