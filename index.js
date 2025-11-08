require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const { LavalinkManager } = require("lavalink-client");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

/**
 * lavalink-client v2 (compatible Lavalink v4)
 * Doc: https://github.com/Tomato6966/lavalink-client
 */
const manager = new LavalinkManager({
  nodes: [
    {
      id: "MainNode",
      host: process.env.LAVALINK_HOST || "127.0.0.1",
      port: Number(process.env.LAVALINK_PORT || 2333),
      authorization: process.env.LAVALINK_PASSWORD || "youshallnotpass",
      secure: false
    }
  ],
  /**
   * Envoi des payloads VOICE_STATE/VOICE_SERVER vers le shard.
   * Pour single-process (sans sharding), on forward via le client WebSocket.
   */
  sendToShard: (guildId, payload) => {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    guild.shard.send(payload);
  }
});

// Logs de base
manager.on("nodeConnect", (node) => console.log(`✅ Connecté à Lavalink: ${node.id}`));
manager.on("nodeError", (node, err) => console.error(`❌ Erreur node ${node.id}:`, err?.message || err));
manager.on("trackStart", (player, track) => {
  const channel = client.channels.cache.get(player.textId);
  if (channel) channel.send(`🎶 Lecture: **${track.info.title}**`);
});

client.once("ready", () => {
  console.log(`🤖 Connecté à Discord en tant que ${client.user.tag}`);
  // IMPORTANT: init après que client.user.id soit défini
  manager.init({ id: client.user.id, clientName: client.user.username });
});

// Commandes simples: $play / $skip / $stop
client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.content.startsWith("$")) return;

  const args = message.content.slice(1).trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();

  if (command === "play") {
    const voice = message.member?.voice?.channel;
    if (!voice) return message.reply("❗ Rejoins un salon vocal d’abord.");

    const queryRaw = args.join(" ");
    if (!queryRaw) return message.reply("⚠️ Donne un lien ou un titre.");

    // ytsearch si non-URL
    const query = /^https?:\/\//i.test(queryRaw) ? queryRaw : `ytsearch:${queryRaw}`;

    let player = manager.players.get(message.guild.id);
    if (!player) {
      player = manager.createPlayer({
        guildId: message.guild.id,
        voiceId: voice.id,
        textId: message.channel.id,
        volume: 100
      });
    }

    const res = await player.search(query, { requester: message.author }).catch(() => null);
    if (!res || !res.tracks?.length) return message.reply("❌ Aucun résultat trouvé.");

    // Priorité: track unique si loadType=TRACK/SEARCH
    const track = res.tracks[0];
    player.connect();
    player.queue.add(track);
    if (!player.playing && !player.paused) await player.play();
  }

  if (command === "skip") {
    const player = manager.players.get(message.guild.id);
    if (!player || !player.playing) return message.reply("Aucune lecture en cours.");
    await player.skip();
    message.reply("⏭️ Morceau passé.");
  }

  if (command === "stop") {
    const player = manager.players.get(message.guild.id);
    if (!player) return message.reply("Aucun lecteur actif.");
    player.destroy();
    message.reply("🛑 Lecture arrêtée.");
  }
});

client.login(process.env.DISCORD_TOKEN);
