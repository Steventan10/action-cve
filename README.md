![marketing](https://user-images.githubusercontent.com/2741371/146811728-d2d9302b-f7f9-4296-82e3-e9812e562af9.png)

## @kunalnagarco/action-cve

A [GitHub action](https://github.com/features/actions) that sends Dependabot Vulnerability Alerts to multiple sources.

**For more info and getting started, check out the [Wiki](https://github.com/kunalnagarco/action-cve/wiki).**

## Telegram

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

## Attributions

- Bug icon: Made by Freepik from [https://www.flaticon.com/](https://www.flaticon.com/)
