require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const { Poru } = require("poru");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const nodes = [
  {
    name: "Local",
    host: process.env.LAVALINK_HOST || "127.0.0.1",
    port: Number(process.env.LAVALINK_PORT || 2333),
    password: process.env.LAVALINK_PASSWORD || "youshallnotpass",
    secure: false,
    version: "v4"
  }
];

const poru = new Poru(client, nodes, { library: "discord.js" });

client.once("ready", () => {
  console.log(`🤖 Connecté à Discord en tant que ${client.user.tag}`);
  poru.init(client); // nécessaire avec Poru v4
});

poru.on("nodeConnect", (node) => console.log(`✅ Connecté à ${node.name}`));
poru.on("nodeError", (node, err) => console.error(`❌ Erreur ${node.name}:`, err.message));

client.on("messageCreate", async (msg) => {
  if (msg.author.bot || !msg.content.startsWith("$")) return;

  const args = msg.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === "play") {
    const voice = msg.member?.voice?.channel;
    if (!voice) return msg.reply("Rejoins un salon vocal d’abord.");

    let player = poru.players.get(msg.guild.id);
    if (!player) {
      player = poru.createConnection({
        guildId: msg.guild.id,
        voiceChannel: voice.id,
        textChannel: msg.channel.id
      });
    }

    const query = args.join(" ");
    if (!query) return msg.reply("Donne un lien ou un titre de musique.");

    const resolved = await poru.resolve({ query, source: "ytsearch" });
    if (!resolved.tracks.length) return msg.reply("Aucun résultat trouvé.");

    player.queue.add(resolved.tracks[0]);
    if (!player.isPlaying && !player.isPaused) player.play();

    msg.reply(`🎶 Lecture : **${resolved.tracks[0].info.title}**`);
  }

  if (command === "skip") {
    const player = poru.players.get(msg.guild.id);
    if (!player || !player.isPlaying) return msg.reply("Aucune musique en cours.");
    player.stop();
    msg.reply("⏭️ Morceau passé.");
  }

  if (command === "stop") {
    const player = poru.players.get(msg.guild.id);
    if (!player) return msg.reply("Aucun lecteur actif.");
    player.destroy();
    msg.reply("🛑 Lecture arrêtée.");
  }
});

client.login(process.env.DISCORD_TOKEN);
