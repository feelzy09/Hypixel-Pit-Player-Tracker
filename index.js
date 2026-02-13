const DISCORD_TOKEN = "YourDiscordToken";
const CLIENT_ID = "YourclientId";
const GUILD_ID = "YourGuildId";
const HYPIXEL_API_KEY = "YourHypixelApi";

const PLAYERS = [
  "PlayerName",
  "PlayerName",
"PlayerName"
];

// ==================== IMPORTS ====================
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");
const fetch = require("node-fetch");

// ==================== CLIENT ====================
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ==================== SLASH COMMAND ====================
const commands = [
  new SlashCommandBuilder()
    .setName("checkpit")
    .setDescription("Check if tracked players are playing The Pit")
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log("Registering slash commands...");
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("Slash commands registered.");
  } catch (err) {
    console.error("Failed to register commands:", err);
  }
})();

// ==================== UUID CACHE ====================
const uuidCache = new Map();

async function getUUID(username) {
  if (uuidCache.has(username)) return uuidCache.get(username);

  try {
    const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
    if (!res.ok) return null;
    const data = await res.json();
    uuidCache.set(username, data.id);
    return data.id;
  } catch (err) {
    console.error("UUID fetch error:", err);
    return null;
  }
}

// ==================== CHECK HYPIXEL STATUS ====================
async function getHypixelStatus(uuid) {
  try {
    const res = await fetch(`https://api.hypixel.net/status?key=${HYPIXEL_API_KEY}&uuid=${uuid}`);
    const data = await res.json();
    
    // Debug log
    // console.log("Hypixel API:", data);

    if (!data.session || !data.session.online) {
      return { status: "offline", lastLogout: data.session?.lastLogout || null };
    }

    if (data.session.gameType === "PIT") {
      return { status: "pit" };
    }

    return { status: "online", game: data.session.gameType || "Unknown" };

  } catch (err) {
    console.error("Hypixel API error:", err);
    return { status: "offline" };
  }
}

// ==================== INTERACTION HANDLER ====================
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "checkpit") return;

  await interaction.deferReply();

  const results = await Promise.all(
    PLAYERS.map(async player => {
      const uuid = await getUUID(player);
      if (!uuid) return { player, status: "offline" };

      const hypixelStatus = await getHypixelStatus(uuid);
      return { player, ...hypixelStatus };
    })
  );

  const pit = results.filter(r => r.status === "pit").map(r => r.player);
  const online = results
    .filter(r => r.status === "online")
    .map(r => `${r.player} (${r.game})`);
  const offline = results
    .filter(r => r.status === "offline")
    .map(r => r.player);

  let message =
    "**🟣 The Pit**\n" +
    (pit.length ? pit.join(", ") : "None") +
    "\n\n**🟡 Online (Not Pit)**\n" +
    (online.length ? online.join(", ") : "None") +
    "\n\n**🔴 Offline**\n" +
    (offline.length ? offline.join(", ") : "None");

  await interaction.editReply(message);
});

// ==================== LOGIN ====================
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(DISCORD_TOKEN);