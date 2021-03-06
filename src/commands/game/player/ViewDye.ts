import { Message } from "eris";
import { ProfileService } from "../../../lib/database/services/game/ProfileService";
import { MessageEmbed } from "../../../structures/client/RichEmbed";
import { BaseCommand } from "../../../structures/command/Command";
import { GameProfile } from "../../../structures/game/Profile";
import * as ZephyrError from "../../../structures/error/ZephyrError";
import { rgbToHex } from "../../../lib/ZephyrUtils";
import { createCanvas } from "canvas";

export default class ViewDye extends BaseCommand {
  names = ["viewdye", "vd"];
  description = "Shows you a dye you own.";
  allowDm = true;

  async exec(msg: Message, _profile: GameProfile): Promise<void> {
    if (!this.options[0]) throw new ZephyrError.InvalidDyeIdentifierError();

    const dyeId = this.options[0]?.toLowerCase();
    const dyeTarget = await ProfileService.getDyeByIdentifier(dyeId);

    const dyeOwner = await this.zephyr.fetchUser(dyeTarget.discordId);
    const dyeOwnerProfile = await ProfileService.getProfile(
      dyeOwner?.id || dyeTarget.discordId
    );

    const dyeHex = rgbToHex(dyeTarget.dyeR, dyeTarget.dyeG, dyeTarget.dyeB);

    const canvas = createCanvas(100, 100);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = dyeHex;
    ctx.fillRect(0, 0, 100, 100);

    const buffer = canvas.toBuffer("image/jpeg");
    const buf = Buffer.alloc(buffer.length, buffer, "base64");

    const embed = new MessageEmbed()
      .setAuthor(
        `View Dye | ${msg.author.tag}`,
        msg.author.dynamicAvatarURL("png")
      )
      .setDescription(
        `Viewing dye \`$${dyeTarget.id.toString(36)}\` **${
          dyeTarget.name
        }**...` +
          `\n— Owned by ${
            dyeOwnerProfile.private &&
            dyeOwnerProfile.discordId !== msg.author.id
              ? `*Private User*`
              : dyeOwner
              ? `**${dyeOwner.tag}**`
              : `*Unknown User*`
          }` +
          `\n— Charges: \`${dyeTarget.charges.toLocaleString()}\`` +
          `\n— Hex: **${dyeHex.toUpperCase()}**`
      )
      .setThumbnail(`attachment://dyepreview.png`)
      .setColor(dyeHex);

    await msg.channel.createMessage(
      { embed },
      { file: buf, name: `dyepreview.png` }
    );
  }
}
