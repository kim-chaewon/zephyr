import { ProfileService } from "../../lib/database/services/game/ProfileService";

export interface Profile {
  discord_id: string;
  private: boolean;
  blurb: string;
  bits: number;
  bits_bank: number;
  daily_last: string;
  daily_streak: number;
  drop_next: string;
  drop_reminder: boolean;
  drop_reminded: boolean;
  claim_next: string;
  claim_reminder: boolean;
  claim_reminded: boolean;
  dust_1: number;
  dust_2: number;
  dust_3: number;
  dust_4: number;
  dust_5: number;
  premium_currency: number;
  patron: number;
}
export class GameProfile {
  discordId: string;
  private: boolean;
  blurb: string;
  bits: number;
  bitsBank: number;
  dailyLast: string;
  dailyStreak: number;
  dropNext: string;
  dropReminder: boolean;
  dropReminded: boolean;
  claimNext: string;
  claimReminder: boolean;
  claimReminded: boolean;
  dustPoor: number;
  dustAverage: number;
  dustGood: number;
  dustGreat: number;
  dustMint: number;
  premiumCurrency: number;
  patron: number;
  constructor(data: Profile) {
    this.discordId = data.discord_id;
    this.private = data.private;
    this.blurb = data.blurb;
    this.bits = data.bits;
    this.bitsBank = data.bits_bank;
    this.dailyLast = data.daily_last;
    this.dailyStreak = data.daily_streak;
    this.patron = data.patron;
    this.dropNext = data.drop_next;
    this.claimNext = data.claim_next;
    this.dustPoor = data.dust_1;
    this.dustAverage = data.dust_2;
    this.dustGood = data.dust_3;
    this.dustGreat = data.dust_4;
    this.dustMint = data.dust_5;
    this.premiumCurrency = data.premium_currency;

    this.dropReminder = data.drop_reminder;
    this.dropReminded = data.drop_reminded;
    this.claimReminder = data.claim_reminder;
    this.claimReminded = data.claim_reminded;
  }

  public async fetch(): Promise<GameProfile> {
    return await ProfileService.getProfile(this.discordId, false);
  }
}
