require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const { Manager } = require("erela.js");


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const prefix = process.env.BOT_PREFIX || "$";

client.manager = new Manager({
  plugins: [],
  nodes: [
    {
      host: process.env.LAVALINK_HOST,
      port: Number(process.env.LAVALINK_PORT),
      password: process.env.LAVALINK_PASSWORD,
      secure: false
    }
  ],
  send: (id, payload) => {
    const guild = client.guilds.cache.get(id);
    if (guild) guild.shard.send(payload);
  }
});

client.once("ready", () => {
  console.log(`Bot connecté en tant que ${client.user.tag}`);
  client.manager.init(client.user.id);
});

client.on("raw", (d) => client.manager.updateVoiceState(d));

client.on("messageCreate", async (message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === "play") {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.reply("Rejoins un salon vocal.");

    const search = args.join(" ");
    if (!search) return message.reply("Indique le nom ou l’URL d’une musique.");

    let player = client.manager.players.get(message.guild.id);
    if (!player) {
      player = client.manager.create({
        guild: message.guild.id,
        voiceChannel: voiceChannel.id,
        textChannel: message.channel.id
      });
      player.connect();
    }

    const res = await client.manager.search(search, message.author);
    if (res.loadType === "NO_MATCHES") return message.reply("Aucune musique trouvée.");
    if (res.loadType === "PLAYLIST_LOADED") {
      for (const track of res.tracks) player.queue.add(track);
      message.reply(`✅ Playlist ajoutée : ${res.playlist.name}`);
    } else {
      const track = res.tracks[0];
      player.queue.add(track);
      message.reply(`🎵 Ajouté : **${track.title}**`);
    }

    if (!player.playing && !player.paused && !player.queue.size) player.play();
  }

  if (command === "skip") {
    const player = client.manager.players.get(message.guild.id);
    if (!player) return message.reply("Aucune musique en cours.");
    player.stop();
    message.reply("⏭️ Musique suivante.");
  }

  if (command === "stop") {
    const player = client.manager.players.get(message.guild.id);
    if (!player) return message.reply("Aucune musique en cours.");
    player.destroy();
    message.reply("🛑 Lecture arrêtée.");
  }
});

client.login(process.env.DISCORD_TOKEN);
