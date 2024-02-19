import { DependencyContainer } from "tsyringe";
import { IPreAkiLoadMod } from "@spt-aki/models/external/IPreAkiLoadMod";
import { DatabaseServer } from "@spt-aki/servers/DatabaseServer";
import { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import { StaticRouterModService } from "@spt-aki/services/mod/staticRouter/StaticRouterModService";
//import { DynamicRouterModService } from "@spt-aki/services/mod/dynamicRouter/DynamicRouterModService";
import { PlayerScavGenerator } from "@spt-aki/generators/PlayerScavGenerator";
import { SaveServer } from "@spt-aki/servers/SaveServer";
import { ProfileHelper } from "@spt-aki/helpers/ProfileHelper";
import { BotHelper } from "@spt-aki/helpers/BotHelper";
import { JsonUtil } from "@spt-aki/utils/JsonUtil";
import { FenceService } from "@spt-aki/services/FenceService";
import { BotLootCacheService } from "@spt-aki/services/BotLootCacheService";
import { BotGenerator } from "@spt-aki/generators/BotGenerator";
import { ConfigServer } from "@spt-aki/servers/ConfigServer";
import { IPmcData } from "@spt-aki/models/eft/common/IPmcData";
import { RandomUtil } from "@spt-aki/utils/RandomUtil";
import { LocalisationService } from "@spt-aki/services/LocalisationService";
import { BotGeneratorHelper } from "@spt-aki/helpers/BotGeneratorHelper";
import { BotWeaponGeneratorHelper } from "@spt-aki/helpers/BotWeaponGeneratorHelper";
import { ItemHelper } from "@spt-aki/helpers/ItemHelper";
import { HashUtil } from "@spt-aki/utils/HashUtil";
import { PlayerBossScav } from "./PlayerBossScav";
import pkg from "../package.json";
import modConfig from "../config/config.json";

class Mod implements IPreAkiLoadMod//IPostDBLoadMod
{
    protected modName = `${pkg.author}-${pkg.name}`;
    private static container: DependencyContainer;

    //public postDBLoad(container: DependencyContainer): void
    public preAkiLoad(container: DependencyContainer): void {
        Mod.container = container;

        const logger: ILogger = container.resolve<ILogger>("WinstonLogger");
        const staticRouterModService = container.resolve<StaticRouterModService>("StaticRouterModService");
        //const dynamicRouterModService = container.resolve<DynamicRouterModService>("DynamicRouterModService");
        //const profileHelper = container.resolve<ProfileHelper>("ProfileHelper")
        logger.info(`Loading: ${this.modName} ${pkg.version}${modConfig.Enabled === true ? "" : " [Disabled]"}`);

        if (!modConfig?.Enabled) {
            return;
        }

        // Replace scav generation method
        Mod.container.afterResolution("PlayerScavGenerator", (_t, result: PlayerScavGenerator) => {
            result.generate = (sessionID: string): IPmcData => {
                return this.generate(sessionID);
            }
        }, { frequency: "Always" });

        //just doing some learning here, don't mind me
        /*
        dynamicRouterModService.registerDynamicRouter(
            "CustomRouter",
            [
                {
                    url: "/playerscav/role",
                    action: (url, info, sessionId, output) => 
                    {
                        const currentScav = profileHelper.getScavProfile(sessionId);
                        const currentRole = currentScav.Info.Settings.Role;
                        logger.info(`${this.modName}: current playerscav role ${currentRole}`);
                        return JSON.stringify({role: `${currentRole}`});
                    }
                }
            ],
            "pbs"
        );
        */

        // Hook game start router
        if (modConfig.GenerateScavProfileOnStartup === true) {
            logger.info(`${this.modName} - Generate scav profile on game startup enabled.`);
            staticRouterModService.registerStaticRouter(
                "StartHook",
                [
                    {
                        url: "/client/game/start",
                        action: (url: string, info: any, sessionID: string, output: string): any => {
                            logger.debug("StartHook - Generating Scav Profile...");
                            this.generate(sessionID);
                            return output;
                        }
                    }
                ],
                "aki"
            );
        }
    }

    public loadAfterDbInit() {
        // Database Server Tables
        const logger: ILogger = Mod.container.resolve<ILogger>("WinstonLogger");
        const databaseServer = Mod.container.resolve<DatabaseServer>("DatabaseServer");
        const tables = databaseServer.getTables();

        // Scav Role List Check
        for (const [key, value] of Object.entries(modConfig)) {
            if (typeof (value) !== "object" || modConfig[key].RoleList === undefined) continue;
            for (const roleKey of modConfig[key].RoleList) {
                const roleName: string = typeof (roleKey) === "string" ? roleKey.toLowerCase() : roleKey.toString();
                if (tables.bots.types[roleName] === undefined || tables.bots.types[roleName].health.BodyParts[0].Head.min === 0) {
                    const i = modConfig[key].RoleList.indexOf(roleKey);
                    if (i > -1) {
                        modConfig[key].RoleList.splice(i, 1);
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
        tables.globals.config.SavagePlayCooldown = modConfig.ScavPlayCooldown < 0 ? 0 : modConfig.ScavPlayCooldown;
        logger.info(`${this.modName} - Scav Cooldown: ` + tables.globals.config.SavagePlayCooldown);
    }

    public generate(sessionID: string): IPmcData {
        return new PlayerBossScav(
            Mod.container.resolve<ILogger>("WinstonLogger"),
            Mod.container.resolve<RandomUtil>("RandomUtil"),
            Mod.container.resolve<DatabaseServer>("DatabaseServer"),
            Mod.container.resolve<HashUtil>("HashUtil"),
            Mod.container.resolve<ItemHelper>("ItemHelper"),
            Mod.container.resolve<BotWeaponGeneratorHelper>("BotWeaponGeneratorHelper"),
            Mod.container.resolve<BotGeneratorHelper>("BotGeneratorHelper"),
            Mod.container.resolve<SaveServer>("SaveServer"),
            Mod.container.resolve<ProfileHelper>("ProfileHelper"),
            Mod.container.resolve<BotHelper>("BotHelper"),
            Mod.container.resolve<JsonUtil>("JsonUtil"),
            Mod.container.resolve<FenceService>("FenceService"),
            Mod.container.resolve<BotLootCacheService>("BotLootCacheService"),
            Mod.container.resolve<LocalisationService>("LocalisationService"),
            Mod.container.resolve<BotGenerator>("BotGenerator"),
            Mod.container.resolve<ConfigServer>("ConfigServer")
        ).generatePlayerScav(sessionID, Mod.container);
    }
}

module.exports = { mod: new Mod() }