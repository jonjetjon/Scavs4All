import type { DependencyContainer } from "tsyringe"
import type { ILogger } from "@spt-aki/models/spt/utils/ILogger"
import type { IPostDBLoadMod } from "@spt-aki/models/external/IPostDBLoadMod"
import type { DatabaseServer } from "@spt-aki/servers/DatabaseServer"
import type {LocaleService} from "@spt-aki/services/LocaleService"
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";

class Scavs4All implements IPostDBLoadMod
{
  private container: DependencyContainer;
  private config = require("../config/config.json");
  private logger :ILogger;
  private loggerBuffer :string[] = [];
  private replacePmc = false;
  private harderPmc = false;
  private debug = false;
  private verboseDebug = false;
  private numberOfScavQuestsReplaced = 0;
  private numberOfPmcQuestsReplaced = 0;
  private totalNumberOfQuests = 0;
  private totalNumberOfQuestsReplaced =0;
  public postDBLoad(container :DependencyContainer):void
  {
    this.container = container;
    this.logger = this.container.resolve<ILogger>("WinstonLogger");
    const quests = this.container.resolve<DatabaseServer>("DatabaseServer").getTables().templates.quests;
    const questsText = this.container.resolve<LocaleService>("LocaleService").getLocaleDb();
    //go through each option in the config.json and handle known ones
    for (let eachOption in this.config)
    {
      if (this.config[eachOption] != false)
      {
        switch (eachOption)
        {
          case 'debug':
          this.debug = true;
          break;

          case 'ReplacePMCWithAll':
          this.replacePmc = true;
          break;
          
          case 'HarderPMCWithAll':
          this.harderPmc = true;
          break;
          
          case 'verboseDebug':
          this.verboseDebug = true;
          break;
        }
      }
    }
    this.changeTargets(quests, questsText);
    this.logger.log("Scavs4All finished searching quest database!", LogTextColor.GREEN);
    this.logger.info("--------------------------------------------");
    this.logger.log("Found a total of " + this.totalNumberOfQuests + " quests", LogTextColor.GREEN);
    this.logger.log("Replaced a total of " + this.totalNumberOfQuestsReplaced + " quest conditions", LogTextColor.GREEN);
    this.logger.log("Replaced " + this.numberOfScavQuestsReplaced + " scav kill conditions", LogTextColor.GREEN);
    this.logger.log("Replaced " + this.numberOfPmcQuestsReplaced + " PMC kill conditions", LogTextColor.GREEN);
    this.logger.info("--------------------------------------------");
  }

  private changeTargets(quests: any, questsText: any):void
  {
    if(this.verboseDebug == true)
    {
      this.logger.info("Iterating through quests");
    }
    else{
      this.logger.info("Scavs4All Searching Quest Database...");
    }
    //iterate through every quest in quests.json
    for(let eachQuest in quests)
        {
            //add one to our total quest counter
            this.totalNumberOfQuests = this.totalNumberOfQuests + 1;
            const currentQuest = quests[eachQuest]
            //iterate through all the conditions of the current quest
            for(let eachCondition in currentQuest.conditions.AvailableForFinish)
            {
                const currentCondition = currentQuest.conditions.AvailableForFinish[eachCondition]
                //check if the current condition is a countercreator
                if(currentCondition.conditionType === 'CounterCreator')
                {
                    //if it is a countercreator iterate through the subconditions
                    for(let eachSubCondition in currentCondition.counter.conditions )
                    {
                      const specificCondition = currentCondition.counter.conditions[eachSubCondition]
                      //check if the current subcondition is a kill condition and if it requires scav kills
                      if (specificCondition.conditionType === 'Kills' && specificCondition.target === 'Savage')
                      {  
                        //make sure the quest isn't a quest to kill bosses
                        if(specificCondition.savageRole == undefined || specificCondition.savageRole.length == 0)
                        {
                          //debug logging
                          if(this.debug == true)
                          {
                            this.logger.info("Found a scav kill quest condition in quest name: " + currentQuest.QuestName + " replacing kill condition with any" );
                          }

                          //if it does replace the condition with any target
                          quests[eachQuest].conditions.AvailableForFinish[eachCondition].counter.conditions[eachSubCondition].target = 'Any';
                          
                          //find the id for changing the task text
                          const questTextID = quests[eachQuest].conditions.AvailableForFinish[eachCondition].id;
                          
                          //verbose logging
                          if(this.verboseDebug == true)
                          {
                            this.logger.info("Quest ID is: " + questTextID);
                          }

                          //and append (S4A) to the tast text
                          if(questsText[questTextID] != null)
                          {
                            if(this.verboseDebug == true)
                            {
                              this.logger.info("Quest text found! Original quest text is: " + questsText[questTextID]);
                            }
                            questsText[questTextID] = questsText[questTextID] + " (S4A)";
                            if(this.verboseDebug == true)
                            {
                              this.logger.info("New quest text is" + questsText[questTextID]);
                            }
                          }

                          //increment our changed quests counters
                          this.totalNumberOfQuestsReplaced = this.totalNumberOfQuestsReplaced + 1;
                          this.numberOfScavQuestsReplaced = this.numberOfScavQuestsReplaced + 1;
                        }
                      }
                      //if we have replacepmc turned on we need to replace pmc conditions as well
                      if(this.replacePmc == true)
                        {
                          //check if the kill condition is a pmc kill condition
                          if(specificCondition.conditionType === 'Kills' && specificCondition.target === 'AnyPmc')
                          {
                            //debug logging
                            if(this.debug == true)
                              {
                                this.logger.info("Found a pmc kill quest condition in quest name: " + currentQuest.QuestName + " replacing kill condition with any(IF YOU DO NOT WANT THIS DISABLE IT IN CONFIG)" )
                              }

                            //replace the kill condition with any
                            quests[eachQuest].conditions.AvailableForFinish[eachCondition].counter.conditions[eachSubCondition].target = 'Any';

                            //check if we have harder pmcwithall turned on, if we do we need to double the amount needed
                            if(this.harderPmc == true)
                            {
                              //debug logging
                              if(this.debug == true)
                                {
                                  this.logger.info("harder pmc replacement conditions are ON doubling kill count for: " + currentQuest.QuestName + " from " + currentCondition.value + " to " + currentCondition.value * 2);
                                }
                                quests[eachQuest].conditions.AvailableForFinish[eachCondition].value = quests[eachQuest].conditions.AvailableForFinish[eachCondition].value * 2;
                            }

                            //find the id for changing the task text
                            const questTextID = quests[eachQuest].conditions.AvailableForFinish[eachCondition].id;

                            //and append (S4A) to the tast text
                            if(questsText[questTextID] != null)
                            {
                              questsText[questTextID] = questsText[questTextID] + " (S4A)";
                            }

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

module.exports = {mod: new Scavs4All()}