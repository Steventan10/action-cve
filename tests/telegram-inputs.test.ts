import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  inputs: {} as Record<string, string>,
  setFailed: vi.fn(),
  fetchRepositoryAlerts: vi.fn(),
  sendAlertsToTelegram: vi.fn(),
}))

vi.mock('@actions/core', () => ({
  getInput: (name: string) => mocks.inputs[name] ?? '',
  setSecret: vi.fn(),
  setFailed: mocks.setFailed,
}))
vi.mock('@actions/github', () => ({
  context: { repo: { owner: 'org', repo: 'repo' } },
}))
vi.mock('../src/fetch-alerts', () => ({
  fetchRepositoryAlerts: mocks.fetchRepositoryAlerts,
  filterIgnoredAlerts: (alerts: unknown[]) => alerts,
}))
vi.mock('../src/destinations', () => ({
  sendAlertsToTelegram: mocks.sendAlertsToTelegram,
}))

describe('Telegram action inputs', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.inputs = {
      telegram_bot_token: 'test-token',
      telegram_chat_id: '-123',
    }
    mocks.fetchRepositoryAlerts.mockResolvedValue([{ packageName: 'example' }])
  })

  it.each(['42', ''])(
    'passes optional topic ID %s to Telegram',
    async (topicId) => {
      mocks.inputs.telegram_topic_id = topicId
      await import('../src/main')
      await vi.waitFor(() =>
        expect(mocks.sendAlertsToTelegram).toHaveBeenCalledWith(
          'test-token',
          '-123',
          [{ packageName: 'example' }],
          '',
          topicId ? 42 : undefined,
        ),
      )
      expect(mocks.setFailed).not.toHaveBeenCalled()
    },
  )

  it('sends to Telegram when no alerts match the selected severity', async () => {
    mocks.inputs.severity = 'critical'
    mocks.inputs.telegram_topic_id = '42'
    mocks.fetchRepositoryAlerts.mockResolvedValue([])
    await import('../src/main')
    await vi.waitFor(() =>
      expect(mocks.sendAlertsToTelegram).toHaveBeenCalledWith(
        'test-token',
        '-123',
        [],
        'critical',
        42,
      ),
    )
    expect(mocks.setFailed).not.toHaveBeenCalled()
  })

  it.each(['0', '-1', '1.5', 'abc', '42abc', '1e2', '9007199254740992'])(
    'rejects invalid topic ID %s before fetching alerts',
    async (topicId) => {
      mocks.inputs.telegram_topic_id = topicId
      await import('../src/main')
      expect(mocks.setFailed).toHaveBeenCalledWith(
        new Error('telegram_topic_id must be a positive integer'),
      )
      expect(mocks.fetchRepositoryAlerts).not.toHaveBeenCalled()
      expect(mocks.sendAlertsToTelegram).not.toHaveBeenCalled()
    },
  )

  it('rejects a topic without Telegram credentials', async () => {
    mocks.inputs = { telegram_topic_id: '42' }
    await import('../src/main')
    expect(mocks.setFailed).toHaveBeenCalledWith(
      new Error(
        'telegram_topic_id requires telegram_bot_token and telegram_chat_id',
      ),
    )
    expect(mocks.fetchRepositoryAlerts).not.toHaveBeenCalled()
  })
})
