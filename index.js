if (req.method === 'POST' && req.url === '/github-webhook') {
  let body = '';

  req.on('data', chunk => {
    body += chunk;
  });

  req.on('end', async () => {
    try {
      if (!body || body.trim() === '') {
        res.writeHead(204, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'empty-body' }));
        return;
      }

      let data;

      try {
        data = JSON.parse(body);
      } catch (parseError) {
        throw new Error(`Invalid JSON payload: ${parseError.message}`);
      }

      const isGitHubWebhook =
        data &&
        typeof data === 'object' &&
        Array.isArray(data.commits) &&
        data.repository &&
        typeof data.repository === 'object';

      if (!isGitHubWebhook) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ignored', reason: 'not-github-payload' }));
        return;
      }

      const repoName = data.repository.name;
      const commits = data.commits;
      const changelogText = commits
        .map(c => `+ ${c.message}`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY || '#2b2d31')
        .setImage('https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExbzJudGQ0bWtubTFsOG5mMWk5ZXdydXhwMjJnejZxOHVjeWtrdGlrYiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/O7BtZQ0ceoVz4pDdC7/giphy.gif')
        .addFields(
          { name: '🟢 Announcement Bot', value: `**Version:**\n\`${repoName}\``, inline: false },
          { name: 'Changelog:', value: `\`\`\`diff\n${changelogText}\n\`\`\``, inline: false },
          { name: 'Released:', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        );

      for (const [guildId, config] of Object.entries(serverConfigs)) {
        if (!config.devLogChannelId) continue;

        try {
          const guild =
            client.guilds.cache.get(guildId) ||
            await client.guilds.fetch(guildId).catch(() => null);

          if (!guild) continue;

          const channel = await guild.channels.fetch(config.devLogChannelId).catch(() => null);

          if (channel && channel.isTextBased()) {
            await channel.send({ content: '<@&1560731553766707241>', embeds: [embed] });
          }
        } catch (err) {
          debugError('Error sending github log', err);
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'success' }));
    } catch (err) {
      debugError('Webhook parse error', err);

      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'bad-request',
        message: 'Webhook payload was invalid or unsupported'
      }));
    }
  });
} else {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running!\n');
}
