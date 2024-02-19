import { DependencyContainer, inject, injectable } from "tsyringe";
import { DatabaseServer } from "@spt-aki/servers/DatabaseServer";
import { SaveServer } from "@spt-aki/servers/SaveServer";
import { IPmcData } from "@spt-aki/models/eft/common/IPmcData";
import { IBotType } from "@spt-aki/models/eft/common/tables/IBotType";
import { ConditionCounters, Settings } from "@spt-aki/models/eft/common/tables/IBotBase";
import { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import { RandomUtil } from "@spt-aki/utils/RandomUtil";
import { JsonUtil } from "@spt-aki/utils/JsonUtil";
import { HashUtil } from "@spt-aki/utils/HashUtil";
import { ItemHelper } from "@spt-aki/helpers/ItemHelper";
import { PlayerScavGenerator } from "@spt-aki/generators/PlayerScavGenerator";
import { BotGenerator } from "@spt-aki/generators/BotGenerator";
import { ProfileHelper } from "@spt-aki/helpers/ProfileHelper";
import { BotHelper } from "@spt-aki/helpers/BotHelper";
import { FenceService } from "@spt-aki/services/FenceService";
import { ConfigServer } from "@spt-aki/servers/ConfigServer";
import { BotLootCacheService } from "@spt-aki/services/BotLootCacheService";
import { LocalisationService } from "@spt-aki/services/LocalisationService";
import { BotWeaponGeneratorHelper } from "@spt-aki/helpers/BotWeaponGeneratorHelper";
import { BotGeneratorHelper } from "@spt-aki/helpers/BotGeneratorHelper";
import { MemberCategory } from "@spt-aki/models/enums/MemberCategory";

import pkg from "../package.json";
import modConfig from "../config/config.json";
import { ConfigTypes } from "@spt-aki/models/enums/ConfigTypes";
import { IPlayerScavConfig } from "@spt-aki/models/spt/config/IPlayerScavConfig";

@injectable()
export class PlayerBossScav extends PlayerScavGenerator
{
    protected modName = `${pkg.author}-${pkg.name}`;
    private static container: DependencyContainer;
    declare public playerScavConfig: IPlayerScavConfig;
    constructor(
        @inject("WinstonLogger") protected logger: ILogger,
        @inject("RandomUtil") protected randomUtil: RandomUtil,
        @inject("DatabaseServer") protected databaseServer: DatabaseServer,
        @inject("HashUtil") protected hashUtil: HashUtil,
        @inject("ItemHelper") protected itemHelper: ItemHelper,
        @inject("BotWeaponGeneratorHelper") protected botWeaponGeneratorHelper: BotWeaponGeneratorHelper,
        @inject("BotGeneratorHelper") protected botGeneratorHelper: BotGeneratorHelper,
        @inject("SaveServer") protected saveServer: SaveServer,
        @inject("ProfileHelper") protected profileHelper: ProfileHelper,
        @inject("BotHelper") protected botHelper: BotHelper,
        @inject("JsonUtil") protected jsonUtil: JsonUtil,
        @inject("FenceService") protected fenceService: FenceService,
        @inject("BotLootCacheService") protected botLootCacheService: BotLootCacheService,
        @inject("LocalisationService") protected localisationService: LocalisationService,
        @inject("BotGenerator") protected botGenerator: BotGenerator,
        @inject("ConfigServer") protected configServer: ConfigServer
    )
    {
        super(logger, randomUtil, databaseServer, hashUtil, itemHelper, botWeaponGeneratorHelper, botGeneratorHelper, saveServer, profileHelper, botHelper, jsonUtil, fenceService, botLootCacheService, localisationService, botGenerator, configServer);
    }

    // Loooooooooooooooooooooooooooooooooooooooooooooong scav
    public generatePlayerScav(sessionID: string, container: DependencyContainer): IPmcData
    {
        this.playerScavConfig = this.configServer.getConfig(ConfigTypes.PLAYERSCAV);
        const profile = this.saveServer.getProfile(sessionID);
        const pmcData = this.jsonUtil.clone(profile.characters.pmc);
        if (!pmcData)
        {
            // do not generate the scav profile on the new account
            return;
        }

        PlayerBossScav.container = container;
        const botTable = this.databaseServer.getTables().bots.types;

        // get karma level from profile
        const existingScavData = this.jsonUtil.clone(profile.characters.scav);
        // scav profile can be empty on first profile creation
        const scavKarmaLevel = ((Object.keys(existingScavData).length === 0)) 
            ? 0
            : this.getScavKarmaLevel(pmcData);

        let scavRole: string;
        let roleType: string;
        // Scav karma
        if ( modConfig?.Boss?.RoleList?.length > 0 && this.randomUtil.getInt(0, 99) < modConfig.Boss.BaseChance * ( 1.0 + (scavKarmaLevel * modConfig.Boss.ScavKarmaChanceMultiplierByPercent) ) )
        {
            scavRole = modConfig.Boss.RoleList[this.randomUtil.getInt(0, modConfig.Boss.RoleList.length-1)].toString().toLowerCase();
            roleType = "Boss";
        }
        else if (modConfig?.Raider?.RoleList?.length > 0 && this.randomUtil.getInt(0, 99) < modConfig.Raider.BaseChance * ( 1.0 + (scavKarmaLevel * modConfig.Raider.ScavKarmaChanceMultiplierByPercent) ) )
        {
            scavRole = modConfig?.Raider?.RoleList[this.randomUtil.getInt(0, modConfig.Raider.RoleList.length-1)].toString().toLowerCase();
            roleType = "Raider";
        }
        else
        {
            //scavRole = modConfig.Savage.RoleList[this.randomUtil.getInt(0, modConfig.Savage.RoleList.length-1)].toString().toLowerCase();
            //roleType = "Savage";
            // TODO: rework this a bit, I don't want to play a regular scav :(
            scavRole = modConfig.Boss.RoleList[this.randomUtil.getInt(0, modConfig.Boss.RoleList.length-1)].toString().toLowerCase();
            roleType = "Boss";
        }

        if (scavRole === "gifter" && botTable["gifter"].inventory.Ammo === undefined)
        {
            botTable["gifter"].inventory.Ammo = this.jsonUtil.clone(botTable["assault"].inventory.Ammo);
        }

        // use karma level to get correct karmaSettings
        const playerScavKarmaSettings = this.playerScavConfig.karmaLevel[scavKarmaLevel];
        if (!playerScavKarmaSettings)
        {
            this.logger.error(this.localisationService.getText("scav-missing_karma_settings", scavKarmaLevel));
        }
        else
        {
            playerScavKarmaSettings.botTypeForLoot = scavRole;
        }

        this.logger.debug(`${this.modName}: generated player scav loadout with karma level ${scavKarmaLevel}`)

        // edit baseBotNode values
        const baseBotNode: IBotType = this.constructBotBaseTemplateWithRole(scavRole, roleType);
        this.adjustBotTemplateWithKarmaSpecificSettings(playerScavKarmaSettings, baseBotNode);

        let scavData = this.botGenerator.generatePlayerScav(sessionID, playerScavKarmaSettings.botTypeForLoot.toLowerCase(), "hard", baseBotNode);
        this.botLootCacheService.clearCache();

        // add proper metadata
        scavData.savage = null;
        scavData.aid = pmcData.aid;
        scavData.TradersInfo = this.jsonUtil.clone(pmcData.TradersInfo);
        scavData.Info.Settings = { // added for companion bepinex plugin
            Role: scavRole,
            BotDifficulty: "normal",
            Experience: 999999999,
            StandingForKill: 0,
            AggressorBonus: 0
        };
        scavData.Info.Bans = [];
        scavData.Info.RegistrationDate = pmcData.Info.RegistrationDate;
        scavData.Info.GameVersion = pmcData.Info.GameVersion;
        scavData.Info.MemberCategory = MemberCategory.UNIQUE_ID;
        scavData.Info.lockedMoveCommands = true;
        scavData.RagfairInfo = pmcData.RagfairInfo;
        scavData.UnlockedInfo = pmcData.UnlockedInfo;
        scavData._id = existingScavData._id ?? pmcData.savage;
        scavData.sessionId = existingScavData.sessionId ?? pmcData.sessionId;
        scavData.Skills = this.getScavSkills(existingScavData);
        scavData.Stats = this.getScavStats(existingScavData);
        scavData.Info.Level = this.getScavLevel(existingScavData);
        scavData.Info.Experience = this.getScavExperience(existingScavData);
        scavData.Quests = existingScavData.Quests ?? [];
        scavData.ConditionCounters = (existingScavData.ConditionCounters ?? {}) as ConditionCounters;
        scavData.Notes = existingScavData.Notes ?? { Notes: [] };
        scavData.WishList = existingScavData.WishList ?? [];

        // Secure Container (Pouch)
        if (!modConfig[roleType].Pouch || modConfig[roleType].Pouch.Enabled !== true) 
        {
            scavData = this.profileHelper.removeSecureContainer(scavData);
        }
        else 
        {
            const items = scavData.Inventory.items;
            const tables = this.databaseServer.getTables();
            let scId: string;
            const scavPouch = this.jsonUtil.clone(tables.templates.items["59db794186f77448bc595262"]); // Epsilon container
            scavPouch._id = "ScavPouch";
            scavPouch._props.NotShownInSlot = true;
            scavPouch._props.Grids[0]._props.cellsH = modConfig[roleType].Pouch.ContainerSizeWidth;
            scavPouch._props.Grids[0]._props.cellsV = modConfig[roleType].Pouch.ContainerSizeHeight;
            if (modConfig[roleType].Pouch.ContainerItemFilter === false) 
            {
                if (scavPouch._props.Grids[0]._props.filters.length === 0 || !scavPouch._props.Grids[0]._props.filters[0].Filter) 
                {
                    scavPouch._props.Grids[0]._props.filters = [{Filter: [], ExcludedFilter: []}];
                }
                scavPouch._props.Grids[0]._props.filters[0].Filter = ["54009119af1c881c07000029"]; // Item base
                scavPouch._props.Grids[0]._props.filters[0].ExcludedFilter = [];
            }
            tables.templates.items[scavPouch._id] = scavPouch;
            for (const i in items) 
            {
                if (items[i].slotId === "SecuredContainer") 
                {
                    scId = items[i]._id;
                    items[i]._tpl = scavPouch._id;
                    break;
                }
            }

            if (scId === undefined) 
            {
                scId = this.hashUtil.generate();
                items.push({"_id": scId, "_tpl": scavPouch._id, "parentId": scavData.Inventory.equipment, "slotId": "SecuredContainer"});
            }
            const toRemove = this.itemHelper.findAndReturnChildrenByItems(items, scId);
            let n = items.length;

            while (n-- > 0) 
            {
                if (scId !== items[n]._id && toRemove.includes(items[n]._id)) 
                {
                    items.splice(n, 1);
                }
            }
        }

        // Item Durability
        if (modConfig[roleType].Durability && modConfig[roleType].Durability.Enabled === true) 
        {
            const items = scavData.Inventory.items;
            if (modConfig[roleType].Durability.MinPercent > modConfig[roleType].Durability.MaxPercent) 
            {
                modConfig[roleType].Durability.MinPercent = modConfig[roleType].Durability.MaxPercent;
            }
            for (const i in items) 
            {
                if (!items[i].upd) continue;

                // Change Equipped Weapon Only
                if (items[i].slotId != "FirstPrimaryWeapon" && items[i].slotId != "SecondPrimaryWeapon" && items[i].slotId != "SecondaryWeapon" && items[i].slotId != "Holster" && items[i].slotId != "Scabbard") 
                {
                    if (modConfig[roleType].Durability.ChangeEquippedWeaponOnly === true) 
                    {
                        continue;
                    }
                }
                else 
                {
                    items[i].upd.Repairable.MaxDurability = modConfig[roleType].Durability.MaxPercent;
                }

                if (items[i].upd.Repairable) 
                {
                    const randomPercent = this.randomUtil.getInt(modConfig[roleType].Durability.MinPercent, modConfig[roleType].Durability.MaxPercent);
                    items[i].upd.Repairable.Durability = Math.floor((items[i].upd.Repairable.MaxDurability * randomPercent) / 100);
                }
            }
        }

        // fix low/high values
        if (typeof(modConfig[roleType].Energy) !== "number") 
        {
            this.logger.error(`${this.modName} - Energy for "${roleType}" has bad type of value (${typeof(modConfig[roleType].Energy)}) instead of Number [1 ~ 10000]`);
            modConfig[roleType].Energy = 100;
        }
        else if (modConfig[roleType].Energy > 10000) modConfig[roleType].Energy = 10000;
        else if (modConfig[roleType].Energy < 1) modConfig[roleType].Energy = 1;
        if (typeof(modConfig[roleType].Hydration) !== "number") 
        {
            this.logger.error(`${this.modName} - Hydration for "${roleType}" has bad type of value (${typeof(modConfig[roleType].Hydration)}) instead of Number [1 ~ 10000]`);
            modConfig[roleType].Hydration = 100;
        }
        if (modConfig[roleType].Hydration > 10000) modConfig[roleType].Hydration = 10000;
        else if (modConfig[roleType].Hydration < 1) modConfig[roleType].Hydration = 1;

        // edit enegery/hydration
        scavData.Health.Energy = { "Current": modConfig[roleType].Energy, "Maximum": modConfig[roleType].Energy };
        scavData.Health.Hydration = { "Current": modConfig[roleType].Hydration, "Maximum": modConfig[roleType].Hydration };

        // health scale
        for (const modBodyKey of Object.keys(modConfig[roleType].HealthMultiplier) ) 
        {
            let modBodyValue: number = modConfig[roleType].HealthMultiplier[modBodyKey];

            // skip default values
            if (modBodyValue === 1.0) continue;

            // fix low/high valuesmodBodyValue
            if (modBodyValue < 0.1) modBodyValue = 0.1;
            else if (modBodyValue > 100.0) modBodyValue = 100.0;

            for (const scavBodyKey of Object.keys(scavData.Health.BodyParts) ) 
            {
                if (scavBodyKey === modBodyKey) 
                {
                    scavData.Health.BodyParts[modBodyKey].Health = {
                        "Current": scavData.Health.BodyParts[modBodyKey].Health.Current * modBodyValue,
                        "Maximum": scavData.Health.BodyParts[modBodyKey].Health.Maximum * modBodyValue
                    };
                }
            }
        }

        // edit skills
        if (Object.keys(modConfig[roleType].Skills).length > 0 && Object.keys(scavData.Skills.Common).length > 0) 
        {
            for (const key of Object.keys( modConfig[roleType].Skills) ) 
            {
                let value = modConfig[roleType].Skills.key;

                // fix low/high values
                if (value < 0)
                    value = 0;
                else if (value > 5100)
                    value = 5100;

                let found = false;
                for (const skillIndex of Object.keys(scavData.Skills.Common) ) 
                {
                    if (scavData.Skills.Common[skillIndex].Id.toLowerCase() === key.toLowerCase() ) 
                    {
                        found = true;
                        scavData.Skills.Common[skillIndex].Progress = value;
                        break;
                    }
                }

                if (found === false) 
                {
                    scavData.Skills.Common[Object.keys(scavData.Skills.Common).length] = {"Id": key, "Progress": value, "PointsEarnedDuringSession": 0, "LastAccess": 0};
                }
            }
        }

        // set cooldown timer
        scavData = this.setScavCooldownTimer(scavData, pmcData);

        // add scav to the profile
        this.saveServer.getProfile(sessionID).characters.scav = scavData;
        this.logger.success(`${this.modName}\tNew ${roleType} Scav:\t"${scavRole}"`);

        return scavData;
    }

    public randomRole(blacklist: string[] = [], part: string = "all"): string
    {
        let maxTry = 69;
        const botTable = this.databaseServer.getTables().bots.types;
        const botTypes = Object.keys(this.jsonUtil.clone(botTable)).filter(k => !blacklist.some(b => b.toLowerCase() === k.toLowerCase()));
        if (botTypes.length === 0) return "assault";

        const randomUtil = PlayerBossScav.container.resolve<RandomUtil>("RandomUtil");
        while (--maxTry > 0)
        {
            const randPick = botTypes[randomUtil.getInt(0, botTypes.length-1)].toLowerCase();
            if (!randPick) continue;

            if (part === "all")
            {
                if (!botTable[randPick]?.appearance?.head.length ||
					!botTable[randPick]?.appearance?.body.length ||
					!botTable[randPick]?.appearance?.hands.length ||
					!botTable[randPick]?.appearance?.feet.length ||
					!botTable[randPick]?.appearance?.voice.length
                )
                {
                    continue;
                }

                if (!botTable[randPick]?.firstName.length && !botTable[randPick]?.lastName.length)
                {
                    continue;
                }
            }
            else if (part === "name")
            {
                if (!botTable[randPick]?.firstName.length && !botTable[randPick]?.lastName.length)
                {
                    continue;
                }
            }
            else
            {
                if (!botTable[randPick]?.appearance[part].length)
                {
                    continue;
                }
            }

            return randPick;
        }
        return "assault";
    }

    protected constructBotBaseTemplateWithRole(botTypeForLoot: string = "assault", roleType: string): IBotType
    {
        const baseScavType = botTypeForLoot;
        const assaultBase = this.jsonUtil.clone(this.botHelper.getBotTemplate(baseScavType));
        const appearanceConfig = modConfig[roleType].RandomAppearance || undefined;
        const botTable = this.databaseServer.getTables().bots.types;
        if (appearanceConfig?.Enabled && appearanceConfig?.KeepOriginalParts)
        {
            const allRandom = Boolean(appearanceConfig.RandomizeEveryParts);
            let randomRole = allRandom ? undefined : this.randomRole(appearanceConfig.BlacklistRole, "all");
            for (const [part, value] of Object.entries(appearanceConfig.KeepOriginalParts))
            {
                if (value === true)
                {
                    continue;
                }

                let randomType: IBotType;
                const partLowercase = part.toLowerCase();
                if (typeof(value) === "string")
                {
                    const role = value.toLowerCase();
                    if (botTable[role])
                    {
                        if (partLowercase === "name")
                        {
                            if (botTable[role]?.firstName.length || botTable[role]?.lastName.length)
                            {
                                randomType = this.jsonUtil.clone(this.botHelper.getBotTemplate(role));
                            }
                        }
                        else
                        {
                            if (botTable[role]?.appearance[partLowercase].length)
                            {
                                randomType = this.jsonUtil.clone(this.botHelper.getBotTemplate(role));
                            }
                        }
                    }
                    else
                    {
                        this.logger.error(`${this.modName} - KeepOriginalParts config for "${roleType}" has invalid bot type (${value}) instead of false/true/"botType"`);
                    }
                }

                if (!randomType)
                {
                    if (allRandom)
                    {
                        randomRole = this.randomRole(appearanceConfig.BlacklistRole, partLowercase);
                    }
                    randomType = this.jsonUtil.clone(this.botHelper.getBotTemplate(randomRole));
                }

                this.logger.info(`\t\t\t\t${part}:\t"${randomRole}"`);
                if (partLowercase !== "name")
                {
                    //assaultBase.appearance[partLowercase] = [... randomType.appearance[partLowercase]];
                    assaultBase.appearance[partLowercase] = randomType.appearance[partLowercase];
                }
                else
                {
                    //assaultBase.firstName = [... randomType.firstName];
                    assaultBase.firstName = randomType.firstName;
                    //assaultBase.lastName = [... randomType.lastName];
                    assaultBase.lastName = randomType.lastName;
                }
            }
        }

        // Loot bot is same as base bot, return base with no modification
        if (botTypeForLoot === baseScavType)
        {
            return assaultBase;
        }

        const lootBase = this.jsonUtil.clone(this.botHelper.getBotTemplate(botTypeForLoot));
        assaultBase.inventory = lootBase.inventory;
        assaultBase.chances = lootBase.chances;
        assaultBase.generation = lootBase.generation;

        return assaultBase;
    }
}