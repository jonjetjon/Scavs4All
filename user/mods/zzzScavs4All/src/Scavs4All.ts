import type { DependencyContainer } from "tsyringe"
import type { ILogger } from "@spt-aki/models/spt/utils/ILogger"
import type { IPostDBLoadMod } from "@spt-aki/models/external/IPostDBLoadMod"
import type { DatabaseServer } from "@spt-aki/servers/DatabaseServer"

class Scavs4All implements IPostDBLoadMod
{
  private container: DependencyContainer
  private config = require("../config/config.json")
  private logger :ILogger
  private loggerBuffer :string[] = []
  private replacePmc = false
  private harderPmc = false;
  private debug = false

  public postDBLoad(container :DependencyContainer):void
  {
    this.container = container
    this.logger = this.container.resolve<ILogger>("WinstonLogger")
    const quests = this.container.resolve<DatabaseServer>("DatabaseServer").getTables().templates.quests

    //go through each option in the config.json and handle known ones
    for (let eachOption in this.config)
    {
      if (this.config[eachOption] != false)
      {
        switch (eachOption)
        {
          case 'debug':
            this.debug = true
            break

          case 'ReplacePMCWithAll':
            this.replacePmc = true
            break
          
          case 'HarderPMCWithAll':
            this.harderPmc = true
            break
        }
      }
    }
    this.changeTargets(quests)
    
  }

  private changeTargets(quests: any):void
  {
    //iterate through every quest in quests.json
    for(let eachQuest in quests)
        {
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
                          if(this.debug == true)
                            {
                              this.logger.info("Found a scav kill quest condition in quest name: " + currentQuest.QuestName + " replacing kill condition with any" )
                            }
                          //if it does replace the condition with any target
                          quests[eachQuest].conditions.AvailableForFinish[eachCondition].counter.conditions[eachSubCondition].target = 'Any';
                        }
                      }
                      //if we have replacepmc turned on we need to replace pmc conditions as well
                      if(this.replacePmc == true)
                        {
                          if(specificCondition.conditionType === 'Kills' && specificCondition.target === 'AnyPmc')
                          {
                            if(this.debug == true)
                              {
                                this.logger.info("Found a pmc kill quest condition in quest name: " + currentQuest.QuestName + " replacing kill condition with any(IF YOU DO NOT WANT THIS DISABLE IT IN CONFIG)" )
                              }
                            quests[eachQuest].conditions.AvailableForFinish[eachCondition].counter.conditions[eachSubCondition].target = 'Any';
                            //check if we have harder pmcwithall turned on, if we do we need to double the amount needed
                            if(this.harderPmc == true)
                            {
                              if(this.debug == true)
                                {
                                  this.logger.info("harder pmc replacement conditions are ON doubling kill count for: " + currentQuest.QuestName + " from " + currentCondition.value + " to " + currentCondition.value * 2)
                                }
                                quests[eachQuest].conditions.AvailableForFinish[eachCondition].value = quests[eachQuest].conditions.AvailableForFinish[eachCondition].value * 2;
                            }
                              
                              
                          }
                        }
                    }
                }
            }
        }
  }
}

module.exports = {mod: new Scavs4All()}