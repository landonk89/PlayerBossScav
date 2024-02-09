"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var PlayerBossScav_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerBossScav = void 0;
const tsyringe_1 = require("tsyringe");
const DatabaseServer_1 = require("@spt-aki/servers/DatabaseServer");
const SaveServer_1 = require("@spt-aki/servers/SaveServer");
const RandomUtil_1 = require("@spt-aki/utils/RandomUtil");
const JsonUtil_1 = require("@spt-aki/utils/JsonUtil");
const HashUtil_1 = require("@spt-aki/utils/HashUtil");
const ItemHelper_1 = require("@spt-aki/helpers/ItemHelper");
const PlayerScavGenerator_1 = require("@spt-aki/generators/PlayerScavGenerator");
const BotGenerator_1 = require("@spt-aki/generators/BotGenerator");
const ProfileHelper_1 = require("@spt-aki/helpers/ProfileHelper");
const BotHelper_1 = require("@spt-aki/helpers/BotHelper");
const FenceService_1 = require("@spt-aki/services/FenceService");
const ConfigServer_1 = require("@spt-aki/servers/ConfigServer");
const BotLootCacheService_1 = require("@spt-aki/services/BotLootCacheService");
const LocalisationService_1 = require("@spt-aki/services/LocalisationService");
const BotWeaponGeneratorHelper_1 = require("@spt-aki/helpers/BotWeaponGeneratorHelper");
const BotGeneratorHelper_1 = require("@spt-aki/helpers/BotGeneratorHelper");
const MemberCategory_1 = require("@spt-aki/models/enums/MemberCategory");
const package_json_1 = __importDefault(require("../package.json"));
const config_json_1 = __importDefault(require("../config/config.json"));
let PlayerBossScav = class PlayerBossScav extends PlayerScavGenerator_1.PlayerScavGenerator {
    static { PlayerBossScav_1 = this; }
    logger;
    randomUtil;
    databaseServer;
    hashUtil;
    itemHelper;
    botWeaponGeneratorHelper;
    botGeneratorHelper;
    saveServer;
    profileHelper;
    botHelper;
    jsonUtil;
    fenceService;
    botLootCacheService;
    localisationService;
    botGenerator;
    configServer;
    modName = `${package_json_1.default.author}-${package_json_1.default.name}`;
    static container;
    constructor(logger, randomUtil, databaseServer, hashUtil, itemHelper, botWeaponGeneratorHelper, botGeneratorHelper, saveServer, profileHelper, botHelper, jsonUtil, fenceService, botLootCacheService, localisationService, botGenerator, configServer) {
        super(logger, randomUtil, databaseServer, hashUtil, itemHelper, botWeaponGeneratorHelper, botGeneratorHelper, saveServer, profileHelper, botHelper, jsonUtil, fenceService, botLootCacheService, localisationService, botGenerator, configServer);
        this.logger = logger;
        this.randomUtil = randomUtil;
        this.databaseServer = databaseServer;
        this.hashUtil = hashUtil;
        this.itemHelper = itemHelper;
        this.botWeaponGeneratorHelper = botWeaponGeneratorHelper;
        this.botGeneratorHelper = botGeneratorHelper;
        this.saveServer = saveServer;
        this.profileHelper = profileHelper;
        this.botHelper = botHelper;
        this.jsonUtil = jsonUtil;
        this.fenceService = fenceService;
        this.botLootCacheService = botLootCacheService;
        this.localisationService = localisationService;
        this.botGenerator = botGenerator;
        this.configServer = configServer;
    }
    // Loooooooooooooooooooooooooooooooooooooooooooooong scav v3.8.0
    generatePlayerScav(sessionID, container) {
        this.logger.error("this happened!");
        const profile = this.saveServer.getProfile(sessionID);
        const pmcData = this.jsonUtil.clone(profile.characters.pmc);
        if (!pmcData) {
            // do not generate the scave profile on the new account
            return;
        }
        PlayerBossScav_1.container = container;
        const randomUtil = container.resolve("RandomUtil");
        const hashUtil = container.resolve("HashUtil");
        const itemHelper = container.resolve("ItemHelper");
        const botTable = this.databaseServer.getTables().bots.types;
        // get karma level from profile
        const existingScavData = this.jsonUtil.clone(profile.characters.scav);
        // scav profile can be empty on first profile creation
        const scavKarmaLevel = ((Object.keys(existingScavData).length === 0))
            ? 0
            : this.getScavKarmaLevel(pmcData);
        let scavRole;
        let roleType;
        // Scav karma
        if (config_json_1.default?.Boss?.RoleList?.length > 0 && randomUtil.getInt(0, 99) < config_json_1.default.Boss.BaseChance * (1.0 + (scavKarmaLevel * config_json_1.default.Boss.ScavKarmaChanceMultiplierByPercent))) {
            scavRole = config_json_1.default.Boss.RoleList[randomUtil.getInt(0, config_json_1.default.Boss.RoleList.length - 1)].toString().toLowerCase();
            roleType = "Boss";
        }
        else if (config_json_1.default?.Raider?.RoleList?.length > 0 && randomUtil.getInt(0, 99) < config_json_1.default.Raider.BaseChance * (1.0 + (scavKarmaLevel * config_json_1.default.Raider.ScavKarmaChanceMultiplierByPercent))) {
            scavRole = config_json_1.default?.Raider?.RoleList[randomUtil.getInt(0, config_json_1.default.Raider.RoleList.length - 1)].toString().toLowerCase();
            roleType = "Raider";
        }
        else {
            scavRole = config_json_1.default.Savage.RoleList[randomUtil.getInt(0, config_json_1.default.Savage.RoleList.length - 1)].toString().toLowerCase();
            roleType = "Savage";
        }
        if (scavRole === "gifter" && botTable["gifter"].inventory.Ammo === undefined) {
            botTable["gifter"].inventory.Ammo = this.jsonUtil.clone(botTable["assault"].inventory.Ammo);
        }
        // use karma level to get correct karmaSettings
        const playerScavKarmaSettings = this.playerScavConfig.karmaLevel[scavKarmaLevel];
        if (!playerScavKarmaSettings) {
            this.logger.error(this.localisationService.getText("scav-missing_karma_settings", scavKarmaLevel));
        }
        else {
            playerScavKarmaSettings.botTypeForLoot = scavRole;
        }
        this.logger.debug(`generated player scav loadout with karma level ${scavKarmaLevel}`);
        // edit baseBotNode values
        const baseBotNode = this.constructBotBaseTemplateWithRole(scavRole, roleType);
        this.adjustBotTemplateWithKarmaSpecificSettings(playerScavKarmaSettings, baseBotNode);
        let scavData = this.botGenerator.generatePlayerScav(sessionID, playerScavKarmaSettings.botTypeForLoot.toLowerCase(), "hard", baseBotNode);
        this.botLootCacheService.clearCache();
        // add proper metadata
        scavData.savage = null;
        scavData.aid = pmcData.aid;
        scavData.Info.Settings = {};
        scavData.TradersInfo = this.jsonUtil.clone(pmcData.TradersInfo);
        scavData.Info.Settings = {};
        scavData.Info.Bans = [];
        scavData.Info.RegistrationDate = pmcData.Info.RegistrationDate;
        scavData.Info.GameVersion = pmcData.Info.GameVersion;
        scavData.Info.MemberCategory = MemberCategory_1.MemberCategory.UNIQUE_ID;
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
        scavData.ConditionCounters = (existingScavData.ConditionCounters ?? {});
        scavData.Notes = existingScavData.Notes ?? { Notes: [] };
        scavData.WishList = existingScavData.WishList ?? [];
        // Secure Container (Pouch)
        if (!config_json_1.default[roleType].Pouch || config_json_1.default[roleType].Pouch.Enabled !== true) {
            scavData = this.profileHelper.removeSecureContainer(scavData);
        }
        else {
            const items = scavData.Inventory.items;
            const tables = this.databaseServer.getTables();
            let scId;
            const scavPouch = this.jsonUtil.clone(tables.templates.items["59db794186f77448bc595262"]); // Epsilon container
            scavPouch._id = "ScavPouch";
            scavPouch._props.NotShownInSlot = true;
            scavPouch._props.Grids[0]._props.cellsH = config_json_1.default[roleType].Pouch.ContainerSizeWidth;
            scavPouch._props.Grids[0]._props.cellsV = config_json_1.default[roleType].Pouch.ContainerSizeHeight;
            if (config_json_1.default[roleType].Pouch.ContainerItemFilter === false) {
                if (scavPouch._props.Grids[0]._props.filters.length === 0 || !scavPouch._props.Grids[0]._props.filters[0].Filter) {
                    scavPouch._props.Grids[0]._props.filters = [{ Filter: [], ExcludedFilter: [] }];
                }
                scavPouch._props.Grids[0]._props.filters[0].Filter = ["54009119af1c881c07000029"]; // Item base
                scavPouch._props.Grids[0]._props.filters[0].ExcludedFilter = [];
            }
            tables.templates.items[scavPouch._id] = scavPouch;
            for (const i in items) {
                if (items[i].slotId === "SecuredContainer") {
                    scId = items[i]._id;
                    items[i]._tpl = scavPouch._id;
                    break;
                }
            }
            if (scId === undefined) {
                scId = hashUtil.generate();
                items.push({ "_id": scId, "_tpl": scavPouch._id, "parentId": scavData.Inventory.equipment, "slotId": "SecuredContainer" });
            }
            const toRemove = itemHelper.findAndReturnChildrenByItems(items, scId);
            let n = items.length;
            while (n-- > 0) {
                if (scId !== items[n]._id && toRemove.includes(items[n]._id)) {
                    items.splice(n, 1);
                }
            }
        }
        // Item Durability
        if (config_json_1.default[roleType].Durability && config_json_1.default[roleType].Durability.Enabled === true) {
            const items = scavData.Inventory.items;
            if (config_json_1.default[roleType].Durability.MinPercent > config_json_1.default[roleType].Durability.MaxPercent) {
                config_json_1.default[roleType].Durability.MinPercent = config_json_1.default[roleType].Durability.MaxPercent;
            }
            for (const i in items) {
                if (!items[i].upd)
                    continue;
                // Change Equipped Weapon Only
                if (items[i].slotId != "FirstPrimaryWeapon" && items[i].slotId != "SecondPrimaryWeapon" && items[i].slotId != "SecondaryWeapon" && items[i].slotId != "Holster" && items[i].slotId != "Scabbard") {
                    if (config_json_1.default[roleType].Durability.ChangeEquippedWeaponOnly === true) {
                        continue;
                    }
                }
                else {
                    items[i].upd.Repairable.MaxDurability = config_json_1.default[roleType].Durability.MaxPercent;
                }
                if (items[i].upd.Repairable) {
                    const randomPercent = randomUtil.getInt(config_json_1.default[roleType].Durability.MinPercent, config_json_1.default[roleType].Durability.MaxPercent);
                    items[i].upd.Repairable.Durability = Math.floor((items[i].upd.Repairable.MaxDurability * randomPercent) / 100);
                }
            }
        }
        // fix low/high values
        if (typeof (config_json_1.default[roleType].Energy) !== "number") {
            this.logger.error(`${this.modName} - Energy for "${roleType}" has bad type of value (${typeof (config_json_1.default[roleType].Energy)}) instead of Number [1 ~ 10000]`);
            config_json_1.default[roleType].Energy = 100;
        }
        else if (config_json_1.default[roleType].Energy > 10000)
            config_json_1.default[roleType].Energy = 10000;
        else if (config_json_1.default[roleType].Energy < 1)
            config_json_1.default[roleType].Energy = 1;
        if (typeof (config_json_1.default[roleType].Hydration) !== "number") {
            this.logger.error(`${this.modName} - Hydration for "${roleType}" has bad type of value (${typeof (config_json_1.default[roleType].Hydration)}) instead of Number [1 ~ 10000]`);
            config_json_1.default[roleType].Hydration = 100;
        }
        if (config_json_1.default[roleType].Hydration > 10000)
            config_json_1.default[roleType].Hydration = 10000;
        else if (config_json_1.default[roleType].Hydration < 1)
            config_json_1.default[roleType].Hydration = 1;
        // edit enegery/hydration
        scavData.Health.Energy = { "Current": config_json_1.default[roleType].Energy, "Maximum": config_json_1.default[roleType].Energy };
        scavData.Health.Hydration = { "Current": config_json_1.default[roleType].Hydration, "Maximum": config_json_1.default[roleType].Hydration };
        // health scale
        for (const modBodyKey of Object.keys(config_json_1.default[roleType].HealthMultiplier)) {
            let modBodyValue = config_json_1.default[roleType].HealthMultiplier[modBodyKey];
            // skip default values
            if (modBodyValue === 1.0)
                continue;
            // fix low/high valuesmodBodyValue
            if (modBodyValue < 0.1)
                modBodyValue = 0.1;
            else if (modBodyValue > 100.0)
                modBodyValue = 100.0;
            for (const scavBodyKey of Object.keys(scavData.Health.BodyParts)) {
                if (scavBodyKey === modBodyKey) {
                    scavData.Health.BodyParts[modBodyKey].Health = {
                        "Current": scavData.Health.BodyParts[modBodyKey].Health.Current * modBodyValue,
                        "Maximum": scavData.Health.BodyParts[modBodyKey].Health.Maximum * modBodyValue
                    };
                }
            }
        }
        // edit skills
        if (Object.keys(config_json_1.default[roleType].Skills).length > 0 && Object.keys(scavData.Skills.Common).length > 0) {
            for (const key of Object.keys(config_json_1.default[roleType].Skills)) {
                let value = config_json_1.default[roleType].Skills.key;
                // fix low/high values
                if (value < 0)
                    value = 0;
                else if (value > 5100)
                    value = 5100;
                let found = false;
                for (const skillIndex of Object.keys(scavData.Skills.Common)) {
                    if (scavData.Skills.Common[skillIndex].Id.toLowerCase() === key.toLowerCase()) {
                        found = true;
                        scavData.Skills.Common[skillIndex].Progress = value;
                        break;
                    }
                }
                if (found === false) {
                    scavData.Skills.Common[Object.keys(scavData.Skills.Common).length] = { "Id": key, "Progress": value, "PointsEarnedDuringSession": 0, "LastAccess": 0 };
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
    randomRole(blacklist = [], part = "all") {
        let maxTry = 69;
        const botTable = this.databaseServer.getTables().bots.types;
        const botTypes = Object.keys(this.jsonUtil.clone(botTable)).filter(k => !blacklist.some(b => b.toLowerCase() === k.toLowerCase()));
        if (botTypes.length === 0)
            return "assault";
        const randomUtil = PlayerBossScav_1.container.resolve("RandomUtil");
        while (--maxTry > 0) {
            const randPick = botTypes[randomUtil.getInt(0, botTypes.length - 1)].toLowerCase();
            if (!randPick)
                continue;
            if (part === "all") {
                if (!botTable[randPick]?.appearance?.head.length ||
                    !botTable[randPick]?.appearance?.body.length ||
                    !botTable[randPick]?.appearance?.hands.length ||
                    !botTable[randPick]?.appearance?.feet.length ||
                    !botTable[randPick]?.appearance?.voice.length) {
                    continue;
                }
                if (!botTable[randPick]?.firstName.length && !botTable[randPick]?.lastName.length) {
                    continue;
                }
            }
            else if (part === "name") {
                if (!botTable[randPick]?.firstName.length && !botTable[randPick]?.lastName.length) {
                    continue;
                }
            }
            else {
                if (!botTable[randPick]?.appearance[part].length) {
                    continue;
                }
            }
            return randPick;
        }
        return "assault";
    }
    constructBotBaseTemplateWithRole(botTypeForLoot = "assault", roleType) {
        const baseScavType = botTypeForLoot;
        const assaultBase = this.jsonUtil.clone(this.botHelper.getBotTemplate(baseScavType));
        const appearanceConfig = config_json_1.default[roleType].RandomAppearance || undefined;
        const botTable = this.databaseServer.getTables().bots.types;
        if (appearanceConfig?.Enabled && appearanceConfig?.KeepOriginalParts) {
            const allRandom = Boolean(appearanceConfig.RandomizeEveryParts);
            let randomRole = allRandom ? undefined : this.randomRole(appearanceConfig.BlacklistRole, "all");
            for (const [part, value] of Object.entries(appearanceConfig.KeepOriginalParts)) {
                if (value === true) {
                    continue;
                }
                let randomType;
                const partLowercase = part.toLowerCase();
                if (typeof (value) === "string") {
                    const role = value.toLowerCase();
                    if (botTable[role]) {
                        if (partLowercase === "name") {
                            if (botTable[role]?.firstName.length || botTable[role]?.lastName.length) {
                                randomType = this.jsonUtil.clone(this.botHelper.getBotTemplate(role));
                            }
                        }
                        else {
                            if (botTable[role]?.appearance[partLowercase].length) {
                                randomType = this.jsonUtil.clone(this.botHelper.getBotTemplate(role));
                            }
                        }
                    }
                    else {
                        this.logger.error(`${this.modName} - KeepOriginalParts config for "${roleType}" has invalid bot type (${value}) instead of false/true/"botType"`);
                    }
                }
                if (!randomType) {
                    if (allRandom) {
                        randomRole = this.randomRole(appearanceConfig.BlacklistRole, partLowercase);
                    }
                    randomType = this.jsonUtil.clone(this.botHelper.getBotTemplate(randomRole));
                }
                this.logger.info(`\t\t\t\t${part}:\t"${randomRole}"`);
                if (partLowercase !== "name") {
                    assaultBase.appearance[partLowercase] = [...randomType.appearance[partLowercase]];
                }
                else {
                    assaultBase.firstName = [...randomType.firstName];
                    assaultBase.lastName = [...randomType.lastName];
                }
            }
        }
        // Loot bot is same as base bot, return base with no modification
        if (botTypeForLoot === baseScavType) {
            return assaultBase;
        }
        const lootBase = this.jsonUtil.clone(this.botHelper.getBotTemplate(botTypeForLoot));
        assaultBase.inventory = lootBase.inventory;
        assaultBase.chances = lootBase.chances;
        assaultBase.generation = lootBase.generation;
        return assaultBase;
    }
};
exports.PlayerBossScav = PlayerBossScav;
exports.PlayerBossScav = PlayerBossScav = PlayerBossScav_1 = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)("WinstonLogger")),
    __param(1, (0, tsyringe_1.inject)("RandomUtil")),
    __param(2, (0, tsyringe_1.inject)("DatabaseServer")),
    __param(3, (0, tsyringe_1.inject)("HashUtil")),
    __param(4, (0, tsyringe_1.inject)("ItemHelper")),
    __param(5, (0, tsyringe_1.inject)("BotWeaponGeneratorHelper")),
    __param(6, (0, tsyringe_1.inject)("BotGeneratorHelper")),
    __param(7, (0, tsyringe_1.inject)("SaveServer")),
    __param(8, (0, tsyringe_1.inject)("ProfileHelper")),
    __param(9, (0, tsyringe_1.inject)("BotHelper")),
    __param(10, (0, tsyringe_1.inject)("JsonUtil")),
    __param(11, (0, tsyringe_1.inject)("FenceService")),
    __param(12, (0, tsyringe_1.inject)("BotLootCacheService")),
    __param(13, (0, tsyringe_1.inject)("LocalisationService")),
    __param(14, (0, tsyringe_1.inject)("BotGenerator")),
    __param(15, (0, tsyringe_1.inject)("ConfigServer")),
    __metadata("design:paramtypes", [Object, RandomUtil_1.RandomUtil,
        DatabaseServer_1.DatabaseServer,
        HashUtil_1.HashUtil,
        ItemHelper_1.ItemHelper,
        BotWeaponGeneratorHelper_1.BotWeaponGeneratorHelper,
        BotGeneratorHelper_1.BotGeneratorHelper,
        SaveServer_1.SaveServer,
        ProfileHelper_1.ProfileHelper,
        BotHelper_1.BotHelper,
        JsonUtil_1.JsonUtil,
        FenceService_1.FenceService,
        BotLootCacheService_1.BotLootCacheService,
        LocalisationService_1.LocalisationService,
        BotGenerator_1.BotGenerator,
        ConfigServer_1.ConfigServer])
], PlayerBossScav);
