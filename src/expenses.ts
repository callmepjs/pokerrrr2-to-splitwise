import { config } from './config';
import * as _ from 'lodash';
import { Utils } from './utils';
const Splitwise = require('splitwise');
const converter = require('json-2-csv');
const fs = require('fs');

export class Expenses {
    private splitwise: any = null;
    private splitwise_users: Map<string, string>;
    private utils: Utils;
    public expenseTotal = 0;

    constructor(private args) {
        try {
            this.utils = new Utils(this.args);
            this.splitwise_users = new Map<string, string>();
            if (config.splitwise.key && config.splitwise.secret) {
                this.splitwise = Splitwise({
                    consumerKey: config.splitwise.key,
                    consumerSecret: config.splitwise.secret,
                    //   logger: console.log
                });
            }
            else {
                console.log('INFO : No splitwise configuration found. Skipping.')
            }
        } catch (e) {
            console.log('ERROR : Failed to connect to splitwise')
                ;
        }
    }

    public async fetchMembers(): Promise<Map<string, string>> {
        try {
            if (!this.splitwise || !Number(config.splitwise.group_id)) {
                return this.splitwise_users;
            }

            const group = await this.splitwise.getGroup({ id: config.splitwise.group_id });
            _.forEach(group.members, user => {
                const member_name = user.first_name.split('.')[0].toUpperCase();
                if (member_name) {
                    this.splitwise_users.set(member_name, user.id);
                }
            });
        }
        catch (e) {
            console.log(e);
            console.log('WARN : Failed to connect to splitwise. Please check group_id and splitwise details in config.js');
        }
        // console.log(this.splitwise_users);
        return this.splitwise_users;
    }

    private resetExpenseCost() {
        this.expenseTotal = 0;
    }

    private generateUserExpense(members, expense) {
        let sw_username = expense.ID;
        let sw_user = expense.Player.split(' ')[0].substring(0, 10).toUpperCase();

        let masterUserId1 = this.utils.getMasterUserId(expense.ID);
        masterUserId1 = masterUserId1+ 1;
        const masterUserId = expense.ID;

        if (config.pkr2SwMapping && config.pkr2SwMapping[masterUserId]) {
            sw_username = config.pkr2SwMapping[expense.ID]; // map pkr names to sw names
        }

        if (members.size) {
            sw_user = members.get(sw_username);
        }
        if (sw_user) {
            const name = _.includes(sw_username, '#') ? sw_user : sw_username;

            const user_record: any = {
                user_id: sw_user
            };

            let profit = Number(expense.Profit) * config.pokerrrr.chip_to_dollar_ratio;
            let status = 'owes';
            if (profit >= 0) {
                user_record.paid_share = profit;
                this.expenseTotal += profit;
                status = 'gets';
            }
            else {
                profit = Math.abs(profit);
                user_record.owed_share = Math.abs(profit);
                status = 'owes';
            }
            let debugStr = '[\u2714] ' + name.padEnd(12) + status.padEnd(6) + '$ ' + String(profit).padEnd(8);
            if (expense.Hands) {
                debugStr += '(' + String(expense.Hands).padEnd(5) + 'hands)';
            }
            console.log(debugStr);
            return user_record;
        }
        else {
            console.log(`[\u2716] Missing SW mapping for player ${expense.Player} (${expense.ID})`);
            return null;
        }
    }

    private generateExpenseDescription(name: string) {
        let description = `NLH`;
        const parts = name.split('_'); // typical exported file name is Pokerrr_<gameID>_export.csv
        if (parts.length >= 1) {
            description += ` #${parts[1]}`;
        }
        else {
            description += ` Expense`;
        }
        return description;
    }

    private addUserExpense(expenseRequest, userExpense) {
        if (!userExpense) {
            throw new Error('Cannot generate expense report - missing user expense. Exiting.');
        }

        let entry = _.find(expenseRequest.users, { user_id: userExpense.user_id });
        if (entry) {
            ['paid_share', 'owed_share'].forEach(share => {
                if (!userExpense[share]) {
                    return;
                }
                if (!entry[share]) {
                    entry[share] = userExpense[share]
                }
                else {
                    entry[share] += userExpense[share];
                }
            });
        }
        else {
            expenseRequest.users.push(userExpense);
        }
    }

    public createExpense(name, members, rawResults, isGoldExpense) {
        this.resetExpenseCost();
        const results = this.consolidateResults(rawResults);
        const expense_request: any = {
            group_id: config.splitwise.group_id,
            description: this.generateExpenseDescription(name),
            details: "Auto-generated",
            currency_code: "USD",
            category_id: 19,
            users: []
        };

        if (isGoldExpense) {
            expense_request.description += ' Fees';
        }

        _.forEach(results, r => {
            const user_expense = this.generateUserExpense(members, r);
            this.addUserExpense(expense_request, user_expense);
        })

        expense_request['cost'] = this.expenseTotal;
        // console.log(expense_request);

        const createSplitwise = Number(this.args.createSplitwise);
        if (createSplitwise) {
            console.log('Creating expense now.');
            console.log(expense_request);
            this.splitwise.createExpense(expense_request).then(result => {
                console.log(`[Success] Expense ${result.id} created in Splitwise. Total Cost : ${expense_request.cost}`)
            }).catch(
                console.error
            )
        }
    }

    public createGoldExpense(name, cost, paidBy, members, results) {
        this.resetExpenseCost();
        if (!cost) {
            console.log('No gold expenses indicated. Skipping.')
            return;
        }

        const host = members.get(paidBy.trim().split(' ')[0].toUpperCase());
        if (!host) {
            throw new Error('Could not find user that paid for gold -> ' + paidBy);
        }

        const gold_expenses: any = [];
        const owes = _.cloneDeep(results[0]); // winner owes gold
        owes.Profit = -Math.abs(cost) * 4;    // convert to coins
        owes.Hands = 0;
        gold_expenses.push(owes);

        _.map(results, r => {
            if (config.pkr2SwMapping[r.ID] === paidBy.trim().toUpperCase()) {
                const gets = _.cloneDeep(r);
                gets.user_id = host;
                gets.Profit = cost * 4; // convert to coins
                gets.Hands = 0;
                gold_expenses.push(gets);
            }
        })

        console.log(' ---------- Fees ------------')
        // console.log(gold_expenses);
        this.createExpense(name, members, gold_expenses, true);
    }

    public publishResultsForCharts(rawResults) {
        const chartsDir = './charts/lastReport/';
        const opts = { delimiter: { field: ';' } };
        let csv;
        const results = this.consolidateResults(rawResults);
        converter.json2csv(results, (error, result) => {
            csv = result;
            // console.log(csv);
            const outputFile = chartsDir + 'report.csv';
            fs.writeFile(outputFile, csv, err => {
                if (err) {
                    console.error(err);
                    return;
                }
                console.log('================================================');
                console.log('[Charts] Expense published to => ' + outputFile);
                console.log('================================================');
            })
        }, opts);
    }

    private consolidateResults(rawResults) {
        const deleteIds: any = [];
        let results = _.cloneDeep(rawResults);
        results.forEach(entry => {
            entry.Profit = Number(entry.Profit);
            const masterUserId = this.utils.getMasterUserId(entry.ID);
            let masterRecord = _.find(results, { ID: masterUserId });
            if (entry.ID != masterUserId && masterRecord) {
                ['Hands', 'Profit'].forEach(prop => {
                    masterRecord[prop] += entry[prop];
                });
                deleteIds.push(entry.ID); 
            }
        });
        results = _.filter(results, function(o) { return !deleteIds.includes(o.ID) })       
        results = _.orderBy(results, ['Profit'], ['desc']);
        return results;
    }
}
