import { setTimeout } from 'node:timers/promises'

import { Alert, getFullRepositoryNameFromAlert } from '../entities'

const MAX_MESSAGE_LENGTH = 4096

export const sendAlertsToTelegram = async (
  botToken: string,
  chatId: string,
  alerts: Alert[],
): Promise<void> => {
  if (alerts.length === 0) return

  const alertsByRepository = new Map<string, Alert[]>()
  for (const alert of alerts) {
    const repository = getFullRepositoryNameFromAlert(alert)
    const repositoryAlerts = alertsByRepository.get(repository) ?? []
    repositoryAlerts.push(alert)
    alertsByRepository.set(repository, repositoryAlerts)
  }

  const text = [...alertsByRepository.entries()]
    .map(([repository, repositoryAlerts]) => {
      const critical = repositoryAlerts.filter(
        (alert) => alert.advisory?.severity === 'CRITICAL',
      ).length
      const high = repositoryAlerts.filter(
        (alert) => alert.advisory?.severity === 'HIGH',
      ).length

      const moderate = repositoryAlerts.filter(
        (alert) => alert.advisory?.severity === 'MEDIUM',
      ).length
      const low = repositoryAlerts.filter(
        (alert) => alert.advisory?.severity === 'LOW',
      ).length

      return [
        `${repository} | Total vulnerability: ${repositoryAlerts.length}`,
        `Total critical: ${critical} | high: ${high} | moderate: ${moderate} | low: ${low}`,
        ...repositoryAlerts.map((alert) =>
          [
            `Severity: ${alert.advisory?.severity ?? 'Unknown'}`,
            `Package: ${alert.packageName}`,
            `Summary: ${alert.advisory?.summary ?? 'Not available'}`,
          ].join('\n'),
        ),
      ].join('\n\n')
    })
    .join('\n\n')

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
