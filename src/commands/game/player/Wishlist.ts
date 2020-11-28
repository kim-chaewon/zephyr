import { Message, User } from "eris";
import { MessageEmbed } from "../../../structures/client/RichEmbed";
import { BaseCommand } from "../../../structures/command/Command";
import { GameProfile } from "../../../structures/game/Profile";
import * as ZephyrError from "../../../structures/error/ZephyrError";
import { ProfileService } from "../../../lib/database/services/game/ProfileService";

export default class Wishlist extends BaseCommand {
  names = ["wishlist", "wl"];
  description = "Shows your, or someone else's, wishlist.";
  usage = ["$CMD$", "$CMD$ <@user>", "$CMD$ id=<user id>"];
  subcommands = ["add <text>", "delete <entry>", "clear"];
  async exec(msg: Message, profile: GameProfile): Promise<void> {
    const subcommand = this.options[0]?.toLowerCase();
    let target: GameProfile;
    let targetUser: User;
    if (subcommand === "add") {
      const wishlist = await ProfileService.getWishlist(profile);
      if (
        (wishlist.length >= 3 && profile.patron === 0) ||
        (wishlist.length >= 5 && profile.patron === 1) ||
        (wishlist.length >= 7 && profile.patron === 2) ||
        (wishlist.length >= 10 && profile.patron === 3) ||
        (wishlist.length >= 15 && profile.patron === 4)
      ) {
        const prefix = this.zephyr.getPrefix(msg.guildID!);
        throw new ZephyrError.WishlistFullError(profile.patron, prefix);
      }

      const text = this.options.slice(1).join(" ");
      if (text.length > 12) throw new ZephyrError.WishlistEntryTooLongError();

      await ProfileService.addToWishlist(profile, text);
      const embed = new MessageEmbed()
        .setAuthor(
          `Wishlist | ${msg.author.tag}`,
          msg.author.dynamicAvatarURL("png")
        )
        .setDescription(`Added "${text}" to your wishlist.`);
      await msg.channel.createMessage({ embed });
      return;
    } else if (subcommand === "delete") {
      const num = parseInt(this.options[1]);
      if (isNaN(num))
        throw new ZephyrError.InvalidAmountError("wishlist entry");

      const wishlist = await ProfileService.getWishlist(profile);
      if (!wishlist[num - 1])
        throw new ZephyrError.InvalidAmountError("wishlist entry");

      await ProfileService.removeFromWishlist(profile, num);
      const embed = new MessageEmbed()
        .setAuthor(
          `Wishlist | ${msg.author.tag}`,
          msg.author.dynamicAvatarURL("png")
        )
        .setDescription(`Removed "${wishlist[num - 1]}" from your wishlist.`);
      await msg.channel.createMessage({ embed });
      return;
    } else if (subcommand === "clear") {
      const wishlist = await ProfileService.getWishlist(profile);
      if (wishlist.length === 0) throw new ZephyrError.WishlistEmptyError();

      await ProfileService.clearWishlist(profile);
      const embed = new MessageEmbed()
        .setAuthor(
          `Wishlist | ${msg.author.tag}`,
          msg.author.dynamicAvatarURL("png")
        )
        .setDescription(`Cleared your wishlist.`);
      await msg.channel.createMessage({ embed });
      return;
    }
    if (msg.mentions[0]) {
      target = await ProfileService.getProfile(msg.mentions[0].id);
      targetUser = msg.mentions[0];
    } else if (this.options[0]?.toLowerCase().split("=")[0] === "id") {
      const userId = this.options[0]?.toLowerCase().split("=")[1];
      target = await ProfileService.getProfile(userId);
      targetUser = await this.zephyr.fetchUser(userId);
    } else {
      target = profile;
      targetUser = msg.author;
    }

    const wishlist = await ProfileService.getWishlist(target);
    const embed = new MessageEmbed()
      .setAuthor(
        `Wishlist | ${msg.author.tag}`,
        msg.author.dynamicAvatarURL("png")
      )
      .setTitle(`${targetUser.tag}'s Wishlist`)
      .setDescription(
        wishlist.length === 0
          ? `This wishlist is empty!`
          : `${wishlist
              .map((i) => {
                return `**${wishlist.indexOf(i) + 1}** — ${i}`;
              })
              .join("\n")}`
      )
      .setFooter(
        `Use ${this.zephyr.getPrefix(
          msg.guildID
        )}help wishlist for more information!`
      );
    await msg.channel.createMessage({ embed });
    return;
  }
}