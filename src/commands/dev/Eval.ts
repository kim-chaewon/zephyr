import { Message } from "eris";
import { BaseCommand } from "../../structures/command/Command";
import { GameProfile } from "../../structures/game/Profile";
import { inspect } from "util";
import { MessageEmbed } from "../../structures/client/RichEmbed";

export default class DevEval extends BaseCommand {
  names = ["eval"];
  description = `Evaluates a script.` + `Be careful with this!`;
  developerOnly = true;

  private clean(text: any): string {
    if (typeof text === "string")
      return text
        .replace(/`/g, "`" + String.fromCharCode(8203))
        .replace(/@/g, "@" + String.fromCharCode(8203));
    return text;
  }
  async exec(msg: Message, _profile: GameProfile): Promise<void> {
    try {
      const code = this.options.join(" ");
      let evaled = await eval(code);

      if (typeof evaled !== "string") {
        evaled = inspect(evaled);
      }

      const embed = new MessageEmbed()
        .setAuthor(
          `Eval | ${msg.author.tag}`,
          msg.author.dynamicAvatarURL("png")
        )
        .setDescription(
          `Evaluation complete — ${Date.now() - msg.createdAt}ms` +
            `\n\`\`\`xl` +
            `\n${this.clean(evaled)
              .slice(0, 1000)
              .replace(this.zephyr.token!, `BOT_TOKEN`)}` +
            `\n\`\`\``
        );
      await msg.channel.createMessage({ embed });
    } catch (e) {
      const embed = new MessageEmbed()
        .setAuthor(
          `Eval | ${msg.author.tag}`,
          msg.author.dynamicAvatarURL("png")
        )
        .setDescription(
          `Error — ${Date.now() - msg.createdAt}ms` +
            `\n\`\`\`xl` +
            `\n${this.clean(e)}` +
            `\n\`\`\``
        );
      await msg.channel.createMessage({ embed });
    }
    return;
  }
}
