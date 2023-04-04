import * as fs from "fs";
import { ConfigGenerator } from "./config-generator";
import { ArgumentDefaultsHelpFormatter, ArgumentParser } from "argparse";
import { Config, configFileName, ConfigRegistryInstance, Logger, RuleRegistryInstance, Suite } from "@boll/core";
import { promisify } from "util";
import { resolve } from "path";
import { Formatter } from "./lib/formatter";
import { DefaultFormatter } from "./lib/default-formatter";
import { VsoFormatter } from "./lib/vso-formatter";
const fileExistsAsync = promisify(fs.exists);

const parser = new ArgumentParser({ description: "@boll/cli" });
parser.addArgument("--azure-devops", { help: "Enable Azure DevOps pipeline output formatter.", action: "storeTrue" });
const subParser = parser.addSubparsers({
  description: "commands",
  dest: "command"
});
const runParser = subParser.addParser("run");
runParser.addArgument("--sortBy", { help: "Sort by rule name or registry name", choices: ["rule", "registry", "none"], defaultValue: "none" });
subParser.addParser("init");

type ParsedCommand = {
  azure_devops: boolean;
  command: "run" | "init";
  sortBy: "rule" | "registry" | "none";
};

export enum Status {
  Ok,
  Error,
  Warn
}

export class Cli {
  constructor(private logger: Logger) {}

  async run(args: string[]): Promise<Status> {
    const parsedCommand: ParsedCommand = parser.parseArgs(args);
    const formatter: Formatter = parsedCommand.azure_devops ? new VsoFormatter() : new DefaultFormatter();
    if (parsedCommand.command === "run") {
      const suite = await this.buildSuite();
      const result = await suite.run(this.logger);
      if(parsedCommand.sortBy === "none") {
      result.errors.forEach(e => {
        this.logger.error(formatter.error(e.formattedMessage));
      });
      result.warnings.forEach(e => {
        this.logger.warn(formatter.warn(e.formattedMessage));
      });
      } else {
        const groupedResult = parsedCommand.sortBy === "rule" ? result.getResultsByRule() : result.getResultsByRegister();
      
        const registeredRules = Object.keys(groupedResult);
        registeredRules.forEach(criteriaEntry => {
          this.logger.log("◀️◀️  " + criteriaEntry + " ▶️▶️\n\n"); 
          groupedResult[criteriaEntry].errors.forEach(e => {
            this.logger.error(formatter.error(e.formattedMessage));
          });
          groupedResult[criteriaEntry].warnings.forEach(e => { 
            this.logger.warn(formatter.warn(e.formattedMessage));
          });
          this.logger.log("\n\n");
        });
      }
      if (result.hasErrors) {
        this.logger.error(formatter.finishWithErrors());
        return Status.Error;
      }
      if (result.hasWarnings) {
        this.logger.warn(formatter.finishWithWarnings());
        return Status.Warn;
      }
      return Status.Ok;
    }
    if (parsedCommand.command === "init") {
      await ConfigGenerator.run();
      return Status.Ok;
    }
    return Status.Error;
  }

  private async buildSuite(): Promise<Suite> {
    const fullConfigPath = resolve(configFileName);
    const exists = await fileExistsAsync(fullConfigPath);
    if (!exists) {
      this.logger.error(`Unable to find ${fullConfigPath}; consider running "init" to create example config.`);
    }
    const config = new Config(ConfigRegistryInstance, RuleRegistryInstance, this.logger);
    config.load(require(fullConfigPath));
    return await config.buildSuite();
  }
}
