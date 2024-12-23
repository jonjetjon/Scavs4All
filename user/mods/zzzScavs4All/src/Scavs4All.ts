import type { DependencyContainer } from "tsyringe"
import type { ILogger } from "@spt-aki/models/spt/utils/ILogger"
import type { IPostDBLoadMod } from "@spt-aki/models/external/IPostDBLoadMod"
import type { DatabaseServer } from "@spt-aki/servers/DatabaseServer"
import type { LocaleService } from "@spt-aki/services/LocaleService"
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";
import * as fs from "node:fs";
import * as path from "node:path";

class Scavs4All implements IPostDBLoadMod {
  private container: DependencyContainer;

  //config variables
  private static configPath = path.resolve(__dirname, "../config/config.json");
  private static config: Config;
  private replacePmc = false;
  private harderPmc = false;
  private harderPmcMultiplier = 1;
  private debug = false;
  private verboseDebug = false;

  //logger
  private logger: ILogger;
  private loggerBuffer: string[] = [];

  //counter variables
  private numberOfScavQuestsReplaced = 0;
  private numberOfPmcQuestsReplaced = 0;
  private totalNumberOfQuests = 0;
  private totalNumberOfQuestsReplaced = 0;
  private didHarderPmc = false;
  private newValue = 0;

  //databases
  private globalLocales;

  public postDBLoad(container: DependencyContainer): void {
    this.container = container;
    this.logger = this.container.resolve<ILogger>("WinstonLogger");
    const quests = this.container.resolve<DatabaseServer>("DatabaseServer").getTables().templates.quests;
    const questsText = this.container.resolve<LocaleService>("LocaleService").getLocaleDb();
    this.globalLocales = this.container.resolve<DatabaseServer>("DatabaseServer").getTables().locales.global;

    //load in our config file as an instance of Config
    Scavs4All.config = JSON.parse(fs.readFileSync(Scavs4All.configPath, "utf-8"));

    //go through our config and set the associated variables using the config file
    this.replacePmc = Scavs4All.config.ReplacePMCWithAll;
    this.harderPmc = Scavs4All.config.HarderPMCWithAll;
    this.debug = Scavs4All.config.debug;
    this.verboseDebug = Scavs4All.config.verboseDebug;
    this.harderPmcMultiplier = Scavs4All.config.HarderPMCMultiplier;

    //run the main code to replace the quest conditions and text
    this.changeTargets(quests);

    //print out a summary once done
    this.printSummary();
  }

  private printSummary(): void {

    //check if we replaced pmc kill conditions
    this.didHarderPmc = false;
    if (this.replacePmc == true) {
      if (this.harderPmc == true) {
        this.didHarderPmc = true;
      }
    }

    this.logger.log("Scavs4All finished searching quest database!", LogTextColor.GREEN);
    this.logger.info("--------------------------------------------");
    this.logger.log("Found a total of " + this.totalNumberOfQuests + " quests", LogTextColor.GREEN);
    this.logger.log("Replaced a total of " + this.totalNumberOfQuestsReplaced + " quest conditions", LogTextColor.GREEN);
    this.logger.log("Replaced " + this.numberOfScavQuestsReplaced + " scav kill conditions", LogTextColor.GREEN);
    this.logger.log("Replaced " + this.numberOfPmcQuestsReplaced + " PMC kill conditions", LogTextColor.GREEN);
    if (this.didHarderPmc == false) {
      this.logger.log("Did not change number of kills required for PMC kill conditions", LogTextColor.GREEN);
    }
    else {
      this.logger.log("Multiplied number of kills required for PMC kill conditions by " + (this.harderPmcMultiplier * 100) + "%", LogTextColor.RED);
    }
    this.logger.info("--------------------------------------------");
  }

  private changeQuestText(questTextID: any): void {
    //iterate through all the languages
    for (let eachLocale in this.globalLocales) {
      const currentLocale = this.globalLocales[eachLocale];
      //make sure we found something
      if (currentLocale[questTextID] != null) {
        if (this.verboseDebug == true) {
          this.logger.info("Quest text found! Original quest text is: " + currentLocale[questTextID]);
        }
        //append s4a to the end
        currentLocale[questTextID] = currentLocale[questTextID] + " (S4A)";
        if (this.verboseDebug == true) {
          this.logger.info("New quest text is " + currentLocale[questTextID]);
        }
      }
    }
  }

  private changeTargets(quests: any): void {
    if (this.verboseDebug == true) {
      this.logger.info("Iterating through quests");
    }
    else {
      this.logger.info("Scavs4All Searching Quest Database...");
    }
    //iterate through every quest in quests.json
    for (let eachQuest in quests) {
      //add one to our total quest counter
      this.totalNumberOfQuests = this.totalNumberOfQuests + 1;
      const currentQuest = quests[eachQuest]
      //iterate through all the conditions of the current quest
      for (let eachCondition in currentQuest.conditions.AvailableForFinish) {
        const currentCondition = currentQuest.conditions.AvailableForFinish[eachCondition]
        //check if the current condition is a countercreator
        if (currentCondition.conditionType === 'CounterCreator') {
          //if it is a countercreator iterate through the subconditions
          for (let eachSubCondition in currentCondition.counter.conditions) {
            const specificCondition = currentCondition.counter.conditions[eachSubCondition]
            //check if the current subcondition is a kill condition and if it requires scav kills
            if (specificCondition.conditionType === 'Kills' && specificCondition.target === 'Savage') {
              //make sure the quest isn't a quest to kill bosses
              if (specificCondition.savageRole == undefined || specificCondition.savageRole.length == 0) {
                //debug logging
                if (this.debug == true) {
                  this.logger.info("Found a scav kill quest condition in quest name: " + currentQuest.QuestName + " replacing kill condition with any");
                }

                //if it does replace the condition with any target
                quests[eachQuest].conditions.AvailableForFinish[eachCondition].counter.conditions[eachSubCondition].target = 'Any';

                //find the id for changing the task text
                const questTextID = quests[eachQuest].conditions.AvailableForFinish[eachCondition].id;

                //verbose logging
                if (this.verboseDebug == true) {
                  this.logger.info("Quest ID is: " + questTextID);
                }

                //and append (S4A) to the tast text
                this.changeQuestText(questTextID);


                //increment our changed quests counters
                this.totalNumberOfQuestsReplaced = this.totalNumberOfQuestsReplaced + 1;
                this.numberOfScavQuestsReplaced = this.numberOfScavQuestsReplaced + 1;
              }
            }
            //if we have replacepmc turned on we need to replace pmc conditions as well
            if (this.replacePmc == true) {
              //check if the kill condition is a pmc kill condition
              if (specificCondition.conditionType === 'Kills' && specificCondition.target === 'AnyPmc') {
                //debug logging
                if (this.debug == true) {
                  this.logger.info("Found a pmc kill quest condition in quest name: " + currentQuest.QuestName + " replacing kill condition with any(IF YOU DO NOT WANT THIS DISABLE IT IN CONFIG)")
                }

                //replace the kill condition with any
                quests[eachQuest].conditions.AvailableForFinish[eachCondition].counter.conditions[eachSubCondition].target = 'Any';

                //check if we have harder pmcwithall turned on, if we do we need to double the amount needed
                if (this.harderPmc == true) {

                  this.newValue = quests[eachQuest].conditions.AvailableForFinish[eachCondition].value * this.harderPmcMultiplier;

                  //debug logging
                  if (this.debug == true) {

                    this.logger.info("harder pmc replacement conditions are ON and set to " + this.harderPmcMultiplier + ". doubling kill count for: " + currentQuest.QuestName + " from " + currentCondition.value + " to " + Math.round(this.newValue));
                  }

                  quests[eachQuest].conditions.AvailableForFinish[eachCondition].value = Math.round(this.newValue);
                }
                else {
                  if (this.debug == true) {
                    this.logger.info("Harder PMC replacement conditions are OFF, not modifying quest conditions");
                  }
                }

                //find the id for changing the task text
                const questTextID = quests[eachQuest].conditions.AvailableForFinish[eachCondition].id;

                this.changeQuestText(questTextID);

                //increment our changed quests counters
                this.totalNumberOfQuestsReplaced = this.totalNumberOfQuestsReplaced + 1;
                this.numberOfPmcQuestsReplaced = this.numberOfPmcQuestsReplaced + 1;
              }
            }
          }
        }
      }
    }
  }
}

interface Config {
  ReplacePMCWithAll: boolean,
  HarderPMCWithAll: boolean,
  HarderPMCMultiplier: number,
  debug: boolean,
  verboseDebug: boolean,
}

module.exports = { mod: new Scavs4All() }