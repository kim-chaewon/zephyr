import dayjs from "dayjs";
import { DB, DBClass } from "../../..";
import { GameItem } from "../../../../../structures/game/Item";
import { GameProfile } from "../../../../../structures/game/Profile";
import { GameUserCard } from "../../../../../structures/game/UserCard";

export abstract class ACSet extends DBClass {
  public static async logGift(
    giver: GameProfile,
    recipient: GameProfile,
    cards: GameUserCard[],
    guildId: string
  ): Promise<void> {
    const formattedTimestamp = dayjs().format(`YYYY/MM/DD HH:mm:ss`);
    const values = [];

    for (let card of cards) {
      values.push(
        `(${DB.connection.escape(giver.discordId)}, ${DB.connection.escape(
          recipient.discordId
        )}, ${DB.connection.escape(card.id)}, ${DB.connection.escape(
          guildId
        )}, ${DB.connection.escape(formattedTimestamp)})`
      );
    }

    await DB.query(
      `INSERT INTO gift (giver, recipient, card_id, guild_id, gift_time) VALUES ${values.join(
        ", "
      )};`
    );
    return;
  }

  public static async logClaim(
    claimer: GameProfile,
    dropper: GameProfile | undefined,
    card: GameUserCard,
    claimTime: number,
    dropTime: number,
    guildId: string
  ): Promise<void> {
    const formattedClaimTimestamp = dayjs(claimTime).format(
      `YYYY/MM/DD HH:mm:ss`
    );
    const formattedDropTimestamp = dayjs(dropTime).format(
      `YYYY/MM/DD HH:mm:ss`
    );

    if (dropper) {
      await DB.query(
        `INSERT INTO claim (claimer, dropper, card_id, guild_id, claim_time, drop_time) VALUES (?, ?, ?, ?, ?, ?);`,
        [
          claimer.discordId,
          dropper.discordId,
          card.id,
          guildId,
          formattedClaimTimestamp,
          formattedDropTimestamp,
        ]
      );
    } else {
      await DB.query(
        `INSERT INTO claim (claimer, card_id, guild_id, claim_time, drop_time) VALUES (?, ?, ?, ?, ?);`,
        [
          claimer.discordId,
          card.id,
          guildId,
          formattedClaimTimestamp,
          formattedDropTimestamp,
        ]
      );
    }
    return;
  }

  public static async logBitTransaction(
    giver: GameProfile,
    recipient: GameProfile,
    amount: number,
    guildId: string
  ): Promise<void> {
    const formattedTimestamp = dayjs().format(`YYYY/MM/DD HH:mm:ss`);

    await DB.query(
      `INSERT INTO bit_transaction (giver, recipient, amount, guild_id, transaction_time) VALUES (?, ?, ?, ?, ?);`,
      [
        giver.discordId,
        recipient.discordId,
        amount,
        guildId,
        formattedTimestamp,
      ]
    );
    return;
  }

  public static async logItemTransaction(
    giver: GameProfile,
    recipient: GameProfile,
    items: GameItem[],
    guildId: string
  ): Promise<void> {
    const formattedTimestamp = dayjs().format(`YYYY/MM/DD HH:mm:ss`);
    const values = [];

    for (let item of items) {
      values.push(
        `(${DB.connection.escape(giver.discordId)}, ${DB.connection.escape(
          recipient.discordId
        )}, ${DB.connection.escape(item.itemId)}, ${DB.connection.escape(
          guildId
        )}, ${DB.connection.escape(formattedTimestamp)})`
      );
    }

    await DB.query(
      `INSERT INTO item_transaction (giver, recipient, item_id, guild_id, transaction_time) VALUES ${values.join(
        ", "
      )};`
    );
    return;
  }

  public static async logTrade(
    sender: GameProfile,
    receiver: GameProfile,
    senderCard: GameUserCard,
    receiverCard: GameUserCard,
    guildId: string
  ): Promise<void> {
    const formattedTimestamp = dayjs().format(`YYYY/MM/DD HH:mm:ss`);

    await DB.query(
      `INSERT INTO trade (sender, receiver, sender_card_id, receiver_card_id, guild_id, trade_time) VALUES (?, ?, ?, ?, ?, ?);`,
      [
        sender.discordId,
        receiver.discordId,
        senderCard.id,
        receiverCard.id,
        guildId,
        formattedTimestamp,
      ]
    );
    return;
  }
}
