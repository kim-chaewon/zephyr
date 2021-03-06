import { createCanvas, loadImage, Image } from "canvas";
import { GameBaseCard, GameFrame } from "../../../../structures/game/BaseCard";
import { GameProfile } from "../../../../structures/game/Profile";
import { GameUserCard } from "../../../../structures/game/UserCard";
import { Filter } from "../../sql/Filters";
import { CardGet, WearSpread } from "../../sql/game/card/CardGet";
import fs from "fs/promises";
import { CardSet } from "../../sql/game/card/CardSet";
import { Zephyr } from "../../../../structures/client/Zephyr";
import * as ZephyrError from "../../../../structures/error/ZephyrError";
import { GameTag } from "../../../../structures/game/Tag";
import gm from "gm";
import { GameDye } from "../../../../structures/game/Dye";
import { rgbToCmy } from "../../../ZephyrUtils";
import { ProfileService } from "./ProfileService";

export abstract class CardService {
  // Used for card image generation
  private static toBufferPromise(state: gm.State): Promise<Buffer> {
    return new Promise((resolve) => {
      try {
        state.toBuffer((err, buf) => {
          if (err) throw err;
          resolve(buf);
        });
      } catch (err) {
        throw err;
      }
    });
  }

  public static async getAllCards(): Promise<GameBaseCard[]> {
    return await CardGet.getAllCards();
  }

  public static async getCardById(id: number): Promise<GameBaseCard> {
    return await CardGet.getCardById(id);
  }

  /*
      UserCards
  */
  public static async createNewUserCard(
    card: GameBaseCard,
    profile: GameProfile,
    zephyr: Zephyr,
    price: number = 0,
    claimTime: number,
    dropper: GameProfile | null,
    frame: number = 1,
    fightCount: number
  ): Promise<GameUserCard> {
    const newCard = await CardSet.createNewUserCard(
      card,
      profile,
      zephyr,
      price,
      claimTime,
      dropper,
      fightCount,
      frame
    );
    await ProfileService.setLastCard(profile, newCard);
    return newCard;
  }

  public static async getUserCardById(id: number): Promise<GameUserCard> {
    return await CardGet.getUserCardById(id);
  }

  public static async getUserCardByIdentifier(
    identifier: string
  ): Promise<GameUserCard> {
    const id = parseInt(identifier, 36);
    if (isNaN(id)) throw new ZephyrError.InvalidCardReferenceError();
    return await this.getUserCardById(id);
  }

  public static async getUserInventory(
    profile: GameProfile,
    tags: GameTag[],
    options: Filter
  ): Promise<GameUserCard[]> {
    return await CardGet.getUserInventory(profile, options, tags);
  }

  public static async getUserInventorySize(
    profile: GameProfile,
    tags: GameTag[],
    options: Filter
  ): Promise<number> {
    return await CardGet.getUserInventorySize(profile, options, tags);
  }

  public static async generateCardImage(
    card: GameUserCard,
    zephyr: Zephyr
  ): Promise<Buffer> {
    // Need information off the base card to do anything.
    const baseCard = zephyr.getCard(card.baseCardId);

    // Create the card canvas
    const canvas = createCanvas(350, 500);
    const ctx = canvas.getContext("2d");

    // Load the base card image (the subject of the card)
    let img = await loadImage(baseCard.image);

    // Load the card's frame, default if the id column is null
    let frame: Image;
    if (!card.frameId || !card.frameUrl) {
      frame = await loadImage(`./src/assets/frames/default/frame-default.png`);
    } else frame = await loadImage(card.frameUrl);

    // Draw the base image, then the frame on top of that
    ctx.drawImage(img, 0, 0, 350, 500);
    ctx.drawImage(frame, 0, 0, 350, 500);

    // Handle dye mask (this was so annoying to set up I hate Windows)
    if (card.dyeMaskUrl) {
      // Default to the classic "Undyed Mask Gray" if the card is undyed.
      let [r, g, b] = [card.dyeR || 185, card.dyeG || 185, card.dyeB || 185];
      const { c, m, y } = rgbToCmy(r, g, b);

      // We need to convert the GM State to a buffer, so that
      // canvas knows what to do with it.
      const dyeBuffer = await this.toBufferPromise(
        gm(card.dyeMaskUrl).colorize(c, m, y)
      );

      // Load the buffer and draw the dye mask on top of the frame.
      const dyeImage = await loadImage(dyeBuffer);
      ctx.drawImage(dyeImage, 0, 0, 350, 500);
    }

    // Draw the group icon
    const overlay = await loadImage(
      `./src/assets/groups/${
        baseCard.group?.toLowerCase().replace("*", "") || "nogroup"
      }.png`
    );
    ctx.drawImage(overlay, 0, 0, 350, 500);

    // Draw the serial number
    ctx.font = "20px AlteHaasGroteskBold";
    ctx.fillText(`#${card.serialNumber}`, 50, 421);

    // Draw the name of the subject
    ctx.font = "30px AlteHaasGroteskBold";
    ctx.fillText(`${baseCard.name}`, 50, 445);

    // Send it off!
    const buf = canvas.toBuffer("image/png");
    return Buffer.alloc(buf.length, buf, "base64");
  }

  public static async generateCardCollage(
    cards: GameUserCard[],
    zephyr: Zephyr
  ): Promise<Buffer> {
    // Create the collage canvas
    const canvas = createCanvas(cards.length * 350, 500);
    const ctx = canvas.getContext("2d");

    // Draw the background - this will be a jpeg, so we need a
    // Discord-colored background to look transparent.
    // Sorry lightmode users!
    ctx.beginPath();
    ctx.rect(0, 0, cards.length * 350, 500);
    ctx.fillStyle = "#36393E";
    ctx.fill();

    // Generate each card image and draw it on the collage
    ctx.font = "14px AlteHaasGroteskBold";
    for (let [i, card] of cards.entries()) {
      const cardBuffer = await this.generateCardImage(card, zephyr);
      const img = await loadImage(cardBuffer);
      ctx.drawImage(img, i * 350, 0, 350, 500);
    }

    // Send it off!
    const buf = canvas.toBuffer("image/jpeg");
    return Buffer.alloc(buf.length, buf, "base64");
  }

  public static async generateAlbum(
    cards: GameUserCard[],
    background: string,
    zephyr: Zephyr
  ): Promise<Buffer> {
    /* WIP */
    const canvas = createCanvas(1400, 1000);
    const ctx = canvas.getContext("2d");

    const image = await loadImage(background);
    ctx.drawImage(image, 0, 0, 1400, 1000);

    const top = cards.slice(0, 4);
    const bottom = cards.slice(4, 8);

    for (let t of top) {
      const buffer = await this.generateCardImage(t, zephyr);
      const image = await loadImage(buffer);
      ctx.drawImage(image, 25 + top.indexOf(t) * 350, 50, 300, 400);
    }
    for (let b of bottom) {
      const buffer = await this.generateCardImage(b, zephyr);
      const image = await loadImage(buffer);
      ctx.drawImage(image, 25 + bottom.indexOf(b) * 350, 550, 300, 400);
    }

    const buf = canvas.toBuffer("image/jpeg");
    return Buffer.alloc(buf.length, buf, "base64");
  }

  public static async changeCardFrame(
    card: GameUserCard,
    frameId: number,
    zephyr: Zephyr
  ): Promise<Buffer> {
    const newCard = await CardSet.setCardFrame(card, frameId);
    return await this.updateCardCache(newCard, zephyr);
  }

  public static async getRandomFrame(
    includeUnshoppable: boolean = false
  ): Promise<GameFrame> {
    return await CardGet.getRandomFrame(includeUnshoppable);
  }

  public static async getFrameById(id: number): Promise<GameFrame> {
    return await CardGet.getFrameById(id);
  }

  public static async transferCardsToUser(
    cards: GameUserCard[],
    profile: GameProfile
  ): Promise<void> {
    await CardSet.transferCardsToUser(cards, profile.discordId);
    await ProfileService.setLastCard(profile, cards[cards.length - 1]);
    return;
  }

  public static async burnCards(
    cards: GameUserCard[],
    zephyr: Zephyr
  ): Promise<void> {
    return await CardSet.burnCards(cards, zephyr.user.id);
  }

  /*
      Caching
  */
  public static async updateCardCache(
    card: GameUserCard,
    zephyr: Zephyr
  ): Promise<Buffer> {
    const image = await this.generateCardImage(card, zephyr);

    // fs will throw an error if the directory already exists.
    // TODO - Change this do detect directory, removing need for error handling.
    try {
      await fs.mkdir(`./cache/cards/${card.baseCardId}`);
    } catch (e) {}

    // Overwrite the cached card image.
    // The card image file stays in the temp folder while it's building.
    // Once it's finished, it's moved to the cache folder to avoid
    // showing users incomplete card images.
    await fs.writeFile(`./cache/cards/temp/${card.id}`, image);
    await fs.rename(
      `./cache/cards/temp/${card.id}`,
      `./cache/cards/${card.baseCardId}/${card.id}`
    );

    return await fs.readFile(`./cache/cards/${card.baseCardId}/${card.id}`);
  }

  public static async checkCacheForCard(
    card: GameUserCard,
    zephyr: Zephyr
  ): Promise<Buffer> {
    try {
      return await fs.readFile(`./cache/cards/${card.baseCardId}/${card.id}`);
    } catch (e) {
      return await this.updateCardCache(card, zephyr);
    }
  }

  public static async setCardsTag(
    cards: GameUserCard[],
    tagId: number
  ): Promise<void> {
    return await CardSet.setCardsTag(cards, tagId);
  }

  public static async unsetCardsTag(cards: GameUserCard[]): Promise<void> {
    return await CardSet.unsetCardsTag(cards);
  }

  public static async getNumberOfTopCollectors(
    ids: number[],
    zephyr: Zephyr
  ): Promise<number> {
    return await CardGet.getNumberOfTopCollectors(ids, zephyr.user.id);
  }

  public static async getTopCollectorsByBaseIds(
    ids: number[],
    zephyr: Zephyr,
    page: number = 1
  ): Promise<{ discordId: string; amount: number }[]> {
    return await CardGet.getTopCollectorsByBaseIds(ids, zephyr.user.id, page);
  }

  public static async getNumberOfTopWishlisted(): Promise<number> {
    return await CardGet.getNumberOfTopWishlisted();
  }

  public static async getTopWishlisted(
    page: number = 1
  ): Promise<{ group: string; name: string; count: number }[]> {
    return await CardGet.getTopWishlisted(page);
  }

  public static async increaseCardWear(card: GameUserCard): Promise<void> {
    return await CardSet.increaseCardWear(card);
  }

  public static async getCardsByTag(tag: GameTag): Promise<GameUserCard[]> {
    return await CardGet.getCardsByTagId(tag.id);
  }

  public static async getUntaggedCards(
    profile: GameProfile
  ): Promise<GameUserCard[]> {
    return await CardGet.getUntaggedCards(profile.discordId);
  }

  public static async incrementGenerated(cards: GameBaseCard[]): Promise<void> {
    return await CardSet.incrementGenerated(cards);
  }

  public static async getTimesCardDestroyed(
    card: GameBaseCard,
    zephyr: Zephyr
  ): Promise<number> {
    return await CardGet.getTimesCardDestroyed(card.id, zephyr.user.id);
  }
  public static async getTimesCardWishlisted(
    card: GameBaseCard
  ): Promise<number> {
    return await CardGet.getTimesCardWishlisted(card);
  }

  public static async getAverageClaimTime(card: GameBaseCard): Promise<number> {
    return await CardGet.getAverageClaimTime(card.id);
  }

  public static async getCardWearSpread(
    card: GameBaseCard,
    zephyr: Zephyr
  ): Promise<WearSpread> {
    return await CardGet.getCardWearSpread(card.id, zephyr.user.id);
  }

  public static async setCardDye(
    card: GameUserCard,
    dye: GameDye
  ): Promise<GameUserCard> {
    await CardSet.setCardDye(card, dye);
    return await card.fetch();
  }
}
