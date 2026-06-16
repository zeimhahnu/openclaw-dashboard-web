import { NextRequest, NextResponse } from "next/server"

const AGENT_HANDLES: Record<string, string> = {
  "lil-claw": "@ZeimClaw_bot",
  "goop":     "@ProfessorGoop_bot",
  "mason":    "@MasonLLM_bot",
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { agentId, message } = body as { agentId?: string; message?: string }

  const handle = agentId ? AGENT_HANDLES[agentId] : null
  if (!handle) {
    return NextResponse.json({ error: "unknown agent" }, { status: 400 })
  }

  const token  = process.env.TELEGRAM_BOT_TOKEN
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
