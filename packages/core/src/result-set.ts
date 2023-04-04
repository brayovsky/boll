import { BollFile } from "./boll-file";
import { BollLineNumber } from "./boll-line-number";
import { InstantiatedRule } from "./rule-set";
import { ResultStatus } from "./types";

export interface Result {
  formattedMessage: string;
  status: ResultStatus;
}

export interface RuleResult extends Result{
  registryName: string;
  ruleName: string;
}

export class Success implements Result {
  constructor(public ruleName: string) {}

  get status(): ResultStatus {
    return ResultStatus.success;
  }

  get formattedMessage(): string {
    return `[${this.ruleName}] Succeeded`;
  }
}

export class Failure implements Result {
  constructor(public ruleName: string, public filename: BollFile, public line: BollLineNumber, public text: string) {}

  get status(): ResultStatus {
    return ResultStatus.failure;
  }

  get formattedMessage(): string {
    return `[${this.ruleName}] ${this.filename}:${this.line} ${this.text}`;
  }
}

export class ResultSet {
  errors: RuleResult[] = [];
  warnings: RuleResult[] = [];
  

  get hasErrors(): boolean {
    return this.errors.length > 0;
  }

  get hasWarnings(): boolean {
    return this.warnings.length > 0;
  }

  getResultsByRegister(): { [registerName: string]: { errors: RuleResult[]; warnings: RuleResult[] } } {
    const resultsByRegister: any = {};
    return this.groupResults(resultsByRegister, 'registryName');
  }

  getResultsByRule(): { [ruleName: string]: { errors: RuleResult[]; warnings: RuleResult[] } } {
    const resultsByRule: any = {};
    return this.groupResults(resultsByRule, 'ruleName');
  }

  private groupResults(groupedResult: {[key: string]: {errors: RuleResult[]; warnings: RuleResult[]}}, getBy: keyof RuleResult) {
    this.errors.forEach(result => {
    if(!groupedResult[result[getBy]]) {
      groupedResult[result[getBy]] = {
        errors: [],
        warnings: []
      };
    }
    groupedResult[result[getBy]].errors.push(result);
  });

  this.warnings.forEach(result => {
    if(!groupedResult[result[getBy]]) {
      groupedResult[result[getBy]] = {
        errors: [],
        warnings: []
      };
    }
    groupedResult[result[getBy]].warnings.push(result);
  });
  return groupedResult;
}

  addErrors(results: Result[], rule: InstantiatedRule) {
    results.forEach((result) => {
      (<RuleResult>result).registryName = rule.registryName;
      (<RuleResult>result).ruleName = rule.name;

      if (result.status === ResultStatus.failure) {
        this.errors.push(<RuleResult>result);
      }
    });
  }

  addWarnings(results: Result[], rule: InstantiatedRule) {
    results.forEach(result => {
      (<RuleResult>result).registryName = rule.registryName;
      (<RuleResult>result).ruleName = rule.name;

      if (result.status === ResultStatus.failure) {
        this.warnings.push(<RuleResult>result);
      }
    });
  }
}
