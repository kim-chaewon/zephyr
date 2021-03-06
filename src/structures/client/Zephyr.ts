import chalk from "chalk";
import stripAnsi from "strip-ansi";
import { Client, TextChannel, User } from "eris";
import config from "../../../config.json";
import { CommandLib } from "../../lib/command/CommandLib";
import { GuildService } from "../../lib/database/services/guild/GuildService";
import { GameBaseCard } from "../game/BaseCard";
import { CardService } from "../../lib/database/services/game/CardService";
import { FontLoader } from "../../lib/FontLoader";
import { checkPermission } from "../../lib/ZephyrUtils";
import { MessageEmbed } from "./RichEmbed";
import { Chance } from "chance";
import { CardSpawner } from "../../lib/CardSpawner";
import { GameWishlist } from "../game/Wishlist";
import { DMHandler } from "../../lib/DMHandler";
import { WebhookListener } from "../../webhook";

export class Zephyr extends Client {
  version: string = "Peony";
  commandLib = new CommandLib();
  dmHandler = new DMHandler();
  config: typeof config;
  chance = new Chance();
  remindersEnabled = true;
  dropsEnabled = true;
  private prefixes: { [guildId: string]: string } = {};
  private cards: { [cardId: number]: GameBaseCard } = {};

  webhookListener = new WebhookListener();

  private generalChannelNames = [
    "welcome",
    "general",
    "lounge",
    "chat",
    "talk",
    "main",
  ];

  constructor() {
    super(config.discord.token, { restMode: true });
    this.config = config;
    this.users.limit = 500;
    this.setMaxListeners(250);
  }

  public async start() {
    await this.cachePrefixes();
    await this.cacheCards();
    const fonts = await FontLoader.init();

    await this.webhookListener.init();

    const startTime = Date.now();
    this.once("ready", async () => {
      await this.commandLib.setup(this);

      const header = `===== ${chalk.hex(
        `#1fb7cf`
      )`PROJECT: ZEPHYR`} (${chalk.hex(`#1fb7cf`)`${this.version}`}) =====`;
      console.log(
        header +
          `\n\n- Took ${chalk.hex("1794E6")`${
            Date.now() - startTime
          }`}ms to start.` +
          `\n- Cached ${chalk.hex(
            "1794E6"
          )`${this.guilds.size.toLocaleString()}`} guild(s) / ${chalk.hex(
            "1794E6"
          )`${this.users.size.toLocaleString()}`} user(s)` +
          `\n- ${chalk.hex(
            `1794E6`
          )`${this.commandLib.commands.length}`} commands registered` +
          `\n- ${chalk.hex(`1794E6`)`${
            Object.keys(this.cards).length
          }`} cards registered` +
          `\n- ${chalk.hex(`1794E6`)`${fonts}`} fonts registered` +
          `\n\n${`=`.repeat(stripAnsi(header).length)}`
      );

      setInterval(() => {
        if (this.remindersEnabled) this.dmHandler.handle(this);
      }, 30000);
      setInterval(() => {
        this.editStatus(`online`, {
          name: `with cards | ${this.guilds.size} servers`,
          type: 0,
        });
      }, 300000);
    });

    this.on("messageCreate", async (message) => {
      await this.fetchUser(message.author.id);

      if (message.channel.type === 1) {
        await this.commandLib.process(message, this);
        return;
      }

      // Prefix resetter
      if (message.mentions[0]?.id === this.user.id) {
        const subcommand = message.content.split(" ")[1]?.toLowerCase();

        if (subcommand === "reset") {
          if (
            !(<TextChannel>message.channel).permissionsOf(message.author.id)
              .json["manageChannels"]
          )
            return;

          this.setPrefix(message.guildID!, this.config.discord.defaultPrefix);
          await GuildService.setPrefix(
            message.guildID!,
            this.config.discord.defaultPrefix
          );

          await message.channel.createMessage(
            `Reset your prefix to \`${this.config.discord.defaultPrefix}\``
          );
          return;
        }

        await message.channel.createMessage(
          `My prefix here is \`${this.getPrefix(message.guildID!)}\`!`
        );
        return;
      }

      // check if we're allowed to send messages to this channel
      if (
        !(<TextChannel>message.channel).permissionsOf(this.user.id).json[
          "sendMessages"
        ]
      )
        return;

      // go ahead if we're allowed to speak
      await this.commandLib.process(message, this);

      // message counter
      await CardSpawner.processMessage(
        this.guilds.find((g) => g.id === message.guildID!)!,
        message.author,
        this
      );
    });

    // Introduction when it joins a new guild
    this.on("guildCreate", async (guild) => {
      // Get ONLY TextChannels in the guild (type === 0)
      const channels = guild.channels.filter(
        (c) => c.type === 0
      ) as TextChannel[];

      // The channel we're eventually going to send the message to
      let welcomeChannel;

      // Find any channels with names including anything from this.generalChannelNames
      for (let channel of channels) {
        for (let generalName of this.generalChannelNames) {
          if (channel.name.toLowerCase().includes(generalName))
            welcomeChannel = channel;
        }
      }

      // If we couldn't find a channel, defer to the highest hoisted channel we can send messages to
      if (!welcomeChannel) {
        const channels = Array.from(guild.channels.values()).filter(
          (c) => c.type === 0
        ) as TextChannel[];
        // Sorts the channels in order of "increasing" position (lower position value = higher on the guild list)
        const top = channels.sort((a, b) => {
          return a.position > b.position ? 1 : -1;
        });

        // Check if we can send messages...
        for (let channel of top) {
          if (checkPermission("sendMessages", <TextChannel>channel, this)) {
            welcomeChannel = channel as TextChannel;
            break;
          }
        }
      }

      // Didn't find anything? Oh well...
      if (!welcomeChannel) return;

      // Get the prefix just in case it's already different (bot previously in guild)
      const prefix = this.getPrefix(guild.id);
      const embed = new MessageEmbed()
        .setAuthor(`Welcome | ${guild.name}`)
        .setDescription(
          `**Thanks for inviting Zephyr!**` +
            `\nUse \`${prefix}setchannel\` in any channel to set that channel as the Zephyr channel.` +
            `\n\n**Common configuration**` +
            `\n— \`${prefix}prefix <prefix>\` - changes the bot's prefix`
        );
      await welcomeChannel.createMessage({ embed });
      return;
    });

    this.on("error", (error) => {
      console.log(error.message);
    });

    this.connect();
  }

  /*
      Prefix Caching
  */
  public async cachePrefixes(): Promise<void> {
    const prefixes = await GuildService.getPrefixes();
    this.prefixes = prefixes;
    return;
  }
  public getPrefix(guildId?: string): string {
    if (!guildId) return config.discord.defaultPrefix;
    return this.prefixes[guildId] ?? config.discord.defaultPrefix;
  }
  public setPrefix(guildId: string, prefix: string): void {
    this.prefixes[guildId] = prefix;
    return;
  }

  /*
      Card Caching
  */
  public async cacheCards(): Promise<void> {
    const cards = await CardService.getAllCards();
    for (let card of cards) {
      this.cards[card.id] = card;
    }
    return;
  }

  public getCard(id: number): GameBaseCard {
    return this.cards[id];
  }

  public async refreshCard(id: number): Promise<GameBaseCard> {
    const recached = await CardService.getCardById(id);
    this.cards[id] = recached;
    return recached;
  }

  public getRandomCards(
    amount: number,
    wishlist: GameWishlist[] = []
  ): GameBaseCard[] {
    const cards: GameBaseCard[] = [];
    const eligibleCards = Object.values(this.cards).filter((c) => c.rarity > 0);
    if (wishlist.length > 0) {
      const bonus = this.chance.bool({ likelihood: 1.25 });
      if (bonus) {
        const random = this.chance.pickone(wishlist);
        const potential = eligibleCards.filter(
          (c) => c.name === random.name && c.group === random.groupName
        );
        if (potential[0]) cards.push(potential[0]);
      }
    }

    const weightings = eligibleCards.map((c) => c.rarity);

    while (cards.length < amount) {
      const randomCard = this.chance.weighted(eligibleCards, weightings);
      if (cards.includes(randomCard)) continue;
      cards.push(randomCard);
    }

    return cards.slice(0, amount);
  }
  public getCards(): GameBaseCard[] {
    return Object.values(this.cards);
  }

  /*
      Functions-That-Probably-Should-Be-In-Eris-Anyway-But-Whatever
  */
  public async fetchUser(
    userId: string,
    ignoreCache: boolean = false
  ): Promise<User | undefined> {
    if (ignoreCache) {
      try {
        const user = await this.getRESTUser(userId);
        this.users.add(user);
        return user;
      } catch (e) {
        return;
      }
    }
    // check if user is already in cache
    const findUser = this.users.get(userId);
    if (!findUser) {
      try {
        const user = await this.getRESTUser(userId);
        this.users.add(user);
        return user;
      } catch (e) {
        return;
      }
    } else {
      this.users.update(findUser);
      return findUser;
    }
  }
}
