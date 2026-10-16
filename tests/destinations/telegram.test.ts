import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Alert } from '../../src/entities'
import { sendAlertsToTelegram } from '../../src/destinations/telegram'

vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn() }))

const alert: Alert = {
  repository: { name: 'repo', owner: 'org' },
  packageName: '<package_name>',
  createdAt: '2026-01-01',
}

describe('sendAlertsToTelegram', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
  })

  afterEach(() => vi.unstubAllGlobals())

  it.each([
    ['', 'ALL'],
    ['critical', 'CRITICAL'],
    [' high, critical ', 'HIGH, CRITICAL'],
  ])(
    'sends a zero-result notification for severity %s',
    async (severity, label) => {
      await sendAlertsToTelegram(
        'test-token',
        '123',
        [],
        severity,
        42,
        'org/repo',
      )
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
        chat_id: '123',
        message_thread_id: 42,
        text:
          '✅ Dependabot Vulnerabilities\n\nProject: org/repo\n\n' +
          `Severity: ${label}\n\nTotal vulnerability: 0\n\n` +
          'No vulnerabilities found matching the configured filters.',
      })
    },
  )

  it('sends plain text with the destination and repository details', async () => {
    await sendAlertsToTelegram('test-token', '-123', [alert])
    const [url, request] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.telegram.org/bottest-token/sendMessage')
    expect(request.method).toBe('POST')
    const body = JSON.parse(request.body)
    expect(body.chat_id).toBe('-123')
    expect(body).not.toHaveProperty('message_thread_id')
    expect(body.text).toBe(
      '🚨Dependabot Vulnerabilities🚨\n\nProject: org/repo\n\nTotal vulnerability: 1\n' +
        'Critical: 0 | High: 0 | Moderate: 0 | Low: 0\n\n' +
        'Severity: Unknown\nPackage: <package_name>\nSummary: Not available',
    )
    expect(body.parse_mode).toBeUndefined()
  })

  it('groups alerts by repository and counts each severity per repository', async () => {
    const withSeverity = (
      severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
    ): Alert => ({
      ...alert,
      advisory: {
        severity,
        summary: 'Example summary',
        cvssScore: 0,
        description: '',
        url: '',
        publishedAt: '',
        updatedAt: '',
      },
    })
    await sendAlertsToTelegram('test-token', '123', [
      withSeverity('CRITICAL'),
      { ...withSeverity('HIGH'), repository: { owner: 'org', name: 'other' } },
      withSeverity('HIGH'),
      withSeverity('LOW'),
      withSeverity('MEDIUM'),
    ])
    const { text } = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(text.match(/org\/repo/g)).toHaveLength(1)
    expect(text.match(/org\/other/g)).toHaveLength(1)
    expect(text).toContain(
      'Project: org/repo\n\nTotal vulnerability: 4\nCritical: 1 | High: 1 | Moderate: 1 | Low: 1',
    )
    expect(text).toContain(
      'Project: org/other\n\nTotal vulnerability: 1\nCritical: 0 | High: 1 | Moderate: 0 | Low: 0',
    )
    expect(text).toContain(
      'Severity: CRITICAL\nPackage: <package_name>\nSummary: Example summary',
    )
  })

  it.each([
    ['high,critical', 'Critical: 0 | High: 0'],
    ['medium', 'Moderate: 0'],
    ['low', 'Low: 0'],
    [' HIGH , critical ', 'Critical: 0 | High: 0'],
  ])(
    'shows only the configured severity counts for %s',
    async (severity, counts) => {
      await sendAlertsToTelegram('test-token', '123', [alert], severity)
      const { text } = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(text).toBe(
        '🚨Dependabot Vulnerabilities🚨\n\nProject: org/repo\n\n' +
          `Total vulnerability: 1\n${counts}\n\n` +
          'Severity: Unknown\nPackage: <package_name>\nSummary: Not available',
      )
    },
  )

  it('splits long Unicode messages without losing text or breaking characters', async () => {
    const packageName = '😀'.repeat(5000)
    await sendAlertsToTelegram('test-token', '123', [{ ...alert, packageName }])
    const texts = fetchMock.mock.calls.map(
      ([, request]) => JSON.parse(request.body).text as string,
    )
    expect(texts.length).toBeGreaterThan(1)
    expect(texts.every((text) => text.length <= 4096)).toBe(true)
    expect(texts.every((text) => !/[\uD800-\uDBFF]$/.test(text))).toBe(true)
    expect(texts.join('')).toContain(packageName)
  })

  it('sends every message chunk to the requested topic', async () => {
    await sendAlertsToTelegram(
      'test-token',
      '-123',
      [{ ...alert, packageName: 'a'.repeat(9000) }],
      '',
      42,
    )
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1)
    for (const [, request] of fetchMock.mock.calls) {
      expect(JSON.parse(request.body)).toMatchObject({
        chat_id: '-123',
        message_thread_id: 42,
      })
    }
  })

  it('reports HTTP failure', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 })
    await expect(
      sendAlertsToTelegram('test-token', '123', [alert]),
    ).rejects.toThrow('HTTP 403')
  })

  it('reports API rejection even with a successful HTTP response', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: false }) })
    await expect(
      sendAlertsToTelegram('test-token', '123', [alert]),
    ).rejects.toThrow('Telegram API rejected')
  })

  it('does not expose the bot token in network errors', async () => {
    fetchMock.mockRejectedValue(
      new Error('https://api.telegram.org/bottest-token/sendMessage'),
    )
    await expect(
      sendAlertsToTelegram('test-token', '123', [alert]),
    ).rejects.toThrow('Telegram request failed or timed out')
  })
})
