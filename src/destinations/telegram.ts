import { setTimeout } from 'node:timers/promises'

import { Alert, getFullRepositoryNameFromAlert } from '../entities'

const MAX_MESSAGE_LENGTH = 4096

export const sendAlertsToTelegram = async (
  botToken: string,
  chatId: string,
  alerts: Alert[],
): Promise<void> => {
  if (alerts.length === 0) return

  const text = [
    `Dependabot: ${alerts.length} vulnerability alerts`,
    ...alerts.map((alert) =>
      [
        `Repository: ${getFullRepositoryNameFromAlert(alert)}`,
        `Package: ${alert.packageName}`,
        `Severity: ${alert.advisory?.severity ?? 'Unknown'}`,
        `Vulnerable versions: ${alert.vulnerability?.vulnerableVersionRange ?? 'Unknown'}`,
        `Patched version: ${alert.vulnerability?.firstPatchedVersion ?? 'Not available'}`,
        `Summary: ${alert.advisory?.summary ?? 'Not available'}`,
        `Advisory: ${alert.advisory?.url ?? 'Not available'}`,
      ].join('\n'),
    ),
  ].join('\n\n')

  let remaining = text
  let firstMessage = true
  while (remaining.length > 0) {
    // Stay within Telegram's limit without splitting a UTF-16 surrogate pair.
    let end = Math.min(MAX_MESSAGE_LENGTH, remaining.length)
    if (end < remaining.length) {
      const last = remaining.charCodeAt(end - 1)
      if (last >= 0xd800 && last <= 0xdbff) end--
    }
    const message = remaining.slice(0, end)
    remaining = remaining.slice(end)
    // Space requests to the same chat, including group chats.
    if (!firstMessage) await setTimeout(3100)
    firstMessage = false

    let response: Response
    try {
      response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            link_preview_options: { is_disabled: true },
          }),
          signal: AbortSignal.timeout(30000),
        },
      )
    } catch {
      // Network errors may contain the request URL, which includes the token.
      throw new Error('Telegram request failed or timed out')
    }
    if (!response.ok) {
      throw new Error(`Telegram request failed (HTTP ${response.status})`)
    }
    const result = (await response.json()) as { ok?: boolean }
    if (result.ok !== true) {
      throw new Error('Telegram API rejected the message')
    }
  }
}
