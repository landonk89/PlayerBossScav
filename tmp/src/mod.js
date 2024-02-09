"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const PlayerBossScav_1 = require("./PlayerBossScav");
const package_json_1 = __importDefault(require("../package.json"));
const config_json_1 = __importDefault(require("../config/config.json"));
class Mod {
    modName = `${package_json_1.default.author}-${package_json_1.default.name}`;
    static container;
    postDBLoad(container) {
        // SPT 3.0.0
        Mod.container = container;
        const logger = container.resolve("WinstonLogger");
        logger.info(`Loading: ${this.modName} ${package_json_1.default.version}${config_json_1.default.Enabled === true ? "" : " [Disabled]"}`);
        if (!config_json_1.default?.Enabled) {
            return;
        }
        // Database Server Tables
        const databaseServer = container.resolve("DatabaseServer");
        const tables = databaseServer.getTables();
        // Scav Role List Check
        for (const [key, value] of Object.entries(config_json_1.default)) {
            if (typeof (value) !== "object" || config_json_1.default[key].RoleList === undefined)
                continue;
            for (const roleKey of config_json_1.default[key].RoleList) {
                const roleName = typeof (roleKey) === "string" ? roleKey.toLowerCase() : roleKey.toString();
                if (tables.bots.types[roleName] === undefined || tables.bots.types[roleName].health.BodyParts[0].Head.min === 0) {
                    const i = config_json_1.default[key].RoleList.indexOf(roleKey);
                    if (i > -1) {
                        config_json_1.default[key].RoleList.splice(i, 1);
                        logger.error(`${this.modName} - Bad "${key}" Role Type: "${roleName}", Removed...`);
                    }
                    else {
                        logger.error(`${this.modName} - Bad "${key}" Role Type: "${roleName}" and couldn't delete from the list - Mod disabled...`);
                        return;
                    }
                }
            }
        }
        // Scav Cooldown
        tables.globals.config.SavagePlayCooldown = config_json_1.default.ScavPlayCooldown < 0 ? 0 : config_json_1.default.ScavPlayCooldown;
        // Replace scav generation method
        container.afterResolution("PlayerScavGenerator", (_t, playerScavGenerator) => {
            playerScavGenerator.generate = this.generate;
        }, { frequency: "Always" });
        // Hook game start router
        if (config_json_1.default.GenerateScavProfileOnStartup === true) {
            container.resolve("StaticRouterModService").registerStaticRouter(`${this.modName}-/client/game/start`, [
                {
                    url: "/client/game/start",
                    action: (url, info, sessionID, output) => {
                        this.generate(sessionID);
                        return output;
                    }
                }
            ], "aki");
        }
    }
    generate(sessionID) {
        return new PlayerBossScav_1.PlayerBossScav(Mod.container.resolve("WinstonLogger"), Mod.container.resolve("RandomUtil"), Mod.container.resolve("DatabaseServer"), Mod.container.resolve("HashUtil"), Mod.container.resolve("ItemHelper"), Mod.container.resolve("BotWeaponGeneratorHelper"), Mod.container.resolve("BotGeneratorHelper"), Mod.container.resolve("SaveServer"), Mod.container.resolve("ProfileHelper"), Mod.container.resolve("BotHelper"), Mod.container.resolve("JsonUtil"), Mod.container.resolve("FenceService"), Mod.container.resolve("BotLootCacheService"), Mod.container.resolve("LocalisationService"), Mod.container.resolve("BotGenerator"), Mod.container.resolve("ConfigServer")).generatePlayerScav(sessionID, Mod.container);
    }
}
module.exports = { mod: new Mod() };
