import { Message, PartialEmoji } from "eris";
import { BaseCommand } from "../../../structures/command/Command";
import { GameProfile } from "../../../structures/game/Profile";
import * as ZephyrError from "../../../structures/error/ZephyrError";
import { CardService } from "../../../lib/database/services/game/CardService";
import { MessageEmbed } from "../../../structures/client/RichEmbed";
import { Chance } from "chance";
import { ProfileService } from "../../../lib/database/services/game/ProfileService";
import { ReactionCollector } from "eris-collector";
import { GameUserCard } from "../../../structures/game/UserCard";
import { Dust } from "../../../structures/game/Dust";

export default class UpgradeCard extends BaseCommand {
  names = ["upgrade", "u"];
  description = "Use dust to have a chance to increase your card's condition.";
  usage = ["$CMD$ <card>"];

  async exec(msg: Message, profile: GameProfile): Promise<void> {
    const reference = this.options[0];
    let card: GameUserCard;
    if (!reference) {
      const lastCard = await CardService.getLastCard(msg.author.id);
      card = lastCard;
    } else {
      const getCard = await CardService.getUserCardByIdentifier(reference);
      card = getCard;
    }

    if (card.wear === 5) throw new ZephyrError.CardBestConditionError(card);

    const dustTier = (card.wear + 1) as Dust;
    const dustCost = [30, 25, 20, 15, 10][card.wear];
    const successChance = 100 - (30 + card.wear * 10);
    const bitCost = [150, 250, 400, 750, 1200][card.wear];

    const dustBalance = [
      profile.dustPoor,
      profile.dustAverage,
      profile.dustGood,
      profile.dustGreat,
      profile.dustMint,
    ][card.wear];
    if (dustCost > dustBalance)
      throw new ZephyrError.NotEnoughDustError(dustBalance, dustCost, dustTier);
    if (bitCost > profile.bits)
      throw new ZephyrError.NotEnoughBitsError(profile.bits, bitCost);

    const tags = await ProfileService.getTags(profile);
    const embed = new MessageEmbed()
      .setAuthor(
        `Upgrade | ${msg.author.tag}`,
        msg.author.dynamicAvatarURL("png")
      )
      .setDescription(
        `Are you sure you want to upgrade this card?` +
          `\n${CardService.getCardDescriptions([card], this.zephyr, tags)}` +
          `\n\nThis will cost...` +
          `\n— **${dustCost.toLocaleString()}x** Card Dust \`${"★"
            .repeat(dustTier)
            .padEnd(5, "☆")}\`` +
          `\n— **${
            this.zephyr.config.discord.emoji.bits
          } ${bitCost.toLocaleString()}**`
      )
      .setFooter(`🎲 Chance of success: ${successChance}%`);
    const confirmation = await msg.channel.createMessage({ embed });
    await confirmation.addReaction(
      `check:${this.zephyr.config.discord.emojiId.check}`
    );

    const filter = (_m: Message, emoji: PartialEmoji, userId: string) =>
      userId === msg.author.id &&
      emoji.id === this.zephyr.config.discord.emojiId.check;
    const collector = new ReactionCollector(this.zephyr, confirmation, filter, {
      time: 15000,
      max: 1,
    });

    collector.on("collect", async () => {
      // We need to check that this user is still the owner, or they can do some nasty stuff
      const refetchCard = await CardService.getUserCardById(card.id);
      if (refetchCard.discordId !== msg.author.id)
        throw new ZephyrError.NotOwnerOfCardError(refetchCard);

      await ProfileService.removeDustFromProfile(dustTier, dustCost, profile);
      await ProfileService.removeBitsFromProfile(profile, bitCost);

      const chance = new Chance();
      const success = chance.bool({ likelihood: successChance });

      if (success) {
        await CardService.increaseCardWear(card);
        await confirmation.edit({
          embed: embed.setFooter(`🎉 The upgrade succeeded!`),
        });
      } else {
        await confirmation.edit({
          embed: embed.setFooter(`😕 The upgrade failed.`),
        });
      }
      return;
    });
    collector.on("end", async (_collected: unknown, reason: string) => {
      if (reason === "time") {
        await confirmation.edit({
          embed: embed.setFooter(`🕒 This upgrade has expired.`),
        });
      }
      try {
        await confirmation.removeReactions();
      } catch {}
    });
  }
}