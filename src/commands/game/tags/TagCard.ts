import { Message } from "eris";
import { ProfileService } from "../../../lib/database/services/game/ProfileService";
import { BaseCommand } from "../../../structures/command/Command";
import { GameProfile } from "../../../structures/game/Profile";
import * as ZephyrError from "../../../structures/error/ZephyrError";
import { CardService } from "../../../lib/database/services/game/CardService";
import { MessageEmbed } from "../../../structures/client/RichEmbed";

export default class ResetFrame extends BaseCommand {
  names = ["tag", "tc"];
  description = "Sets the tag of a card.";
  usage = ["$CMD$ <tag> [cards]"];
  allowDm = true;

  async exec(msg: Message, profile: GameProfile): Promise<void> {
    if (!this.options[0]) throw new ZephyrError.UnspecifiedTagError();

    const tags = await ProfileService.getTags(profile);
    if (tags.length === 0) throw new ZephyrError.NoTagsError();

    const query = this.options[0]?.toLowerCase();
    if (!query) throw new ZephyrError.UnspecifiedTagError();

    const queryIsTag = tags.map((t) => t.name).includes(query);
    let tag;
    let cards = [];
    if (queryIsTag && !this.options[1]) {
      tag = tags.filter((t) => t.name === query)[0];
      const card = await ProfileService.getLastCard(profile);
      cards.push(card);
    } else {
      const trueQuery = this.options[0]?.toLowerCase();

      const findTag = tags.filter(
        (t) =>
          t.name.toLowerCase() === trueQuery ||
          t.emoji.toLowerCase() === trueQuery
      )[0];
      if (!findTag) throw new ZephyrError.InvalidTagError(trueQuery);

      tag = findTag;

      const identifiers = this.options.slice(1);
      for (let i of identifiers) {
        const card = await CardService.getUserCardByIdentifier(i);
        if (card.discordId !== msg.author.id)
          throw new ZephyrError.NotOwnerOfCardError(card);
        cards.push(card);
      }
    }

    if (cards.length === 0) throw new ZephyrError.InvalidCardReferenceError();

    await CardService.setCardsTag(cards, tag.id);
    const embed = new MessageEmbed()
      .setAuthor(
        `Tagging | ${msg.author.tag}`,
        msg.author.dynamicAvatarURL("png")
      )
      .setDescription(
        `Tagged ${
          cards.length === 1
            ? `\`${cards[0].id.toString(36)}\``
            : `**${cards.length}** card${cards.length > 1 ? `s` : ``}`
        } as ${tag.emoji} **${tag.name}**.`
      );
    await msg.channel.createMessage({ embed });
  }
}
