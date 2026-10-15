![marketing](https://user-images.githubusercontent.com/2741371/146811728-d2d9302b-f7f9-4296-82e3-e9812e562af9.png)

## @kunalnagarco/action-cve

A [GitHub action](https://github.com/features/actions) that sends Dependabot Vulnerability Alerts to multiple sources.

**For more info and getting started, check out the [Wiki](https://github.com/kunalnagarco/action-cve/wiki).**

## Telegram

Create a bot using [BotFather](https://t.me/BotFather), then save its token as
the GitHub Actions secret `TELEGRAM_BOT_TOKEN`. Save the destination chat ID
as `TELEGRAM_CHAT_ID`. Start a private conversation with the bot first, or add
it to your group/channel with permission to send messages. For a public channel,
you can use its `@channelusername` as the chat ID.

Example workflow for this repository (or a fork containing Telegram support):

```yaml
name: Dependabot Telegram alerts
on:
  workflow_dispatch:
  schedule:
    - cron: '0 1 * * *'
permissions:
  contents: read
jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./
        with:
          token: ${{ secrets.GIT_TOKEN }}
          telegram_bot_token: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          telegram_chat_id: ${{ secrets.TELEGRAM_CHAT_ID }}
          telegram_topic_id: ${{ secrets.TELEGRAM_TOPIC_ID }} # Optional
          severity: high,critical
          count: '20'
```

`GIT_TOKEN` must have access to read Dependabot alerts for the target
repository. To use this action from another repository, replace `uses: ./`
with `uses: YOUR_OWNER/YOUR_ACTION_REPO@YOUR_REF` pointing to a commit containing
this implementation and its rebuilt `dist/` bundle.

For a specific forum topic, set `telegram_topic_id` to its positive numeric
topic ID (Telegram's `message_thread_id`), and keep `telegram_chat_id` set to
the group's chat ID. You can use a secret as above or a literal such as
`telegram_topic_id: '123'`. Omit it or leave it empty for chats without a topic.
Every part of a split message is sent to the same topic.

`telegram_bot_token` and `telegram_chat_id` must be supplied together.
`telegram_topic_id` is optional and requires both. No message is sent when there
are no matching alerts. Messages use plain text and are split to respect the
[Telegram sendMessage limit](https://core.telegram.org/bots/api#sendmessage).
Alerts are grouped by repository, with the repository name shown once above its
vulnerability total and critical/high/moderate/low counts. When `severity` is set,
only the selected severity counts are shown (including zero counts). For example,
`severity: high,critical` shows only Critical and High; `medium` is displayed as
Moderate. Without a severity filter, all four counts are shown. Totals reflect
the alerts included in the message. Each alert lists severity, package, and summary.
Telegram can be enabled alongside the existing destinations.

## Attributions

- Bug icon: Made by Freepik from [https://www.flaticon.com/](https://www.flaticon.com/)
