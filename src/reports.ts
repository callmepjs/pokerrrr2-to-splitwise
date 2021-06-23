import { Utils } from "./utils";
import * as _ from 'lodash';
import { config } from "./config";
const fs = require('fs');
const path = require('path');
const converter = require('json-2-csv');
const util = require('util');

const reportFileName = 'summary-report.csv';
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

export class Reports {
    private utils: Utils;
    private reportData:any = [];
    private reportMetrics = ['Profit', 'Hands'];
    private totalReports = 0;
    
    constructor(private args) {
        this.utils = new Utils(this.args);
    }
    
    public getReportData() {
        return this.reportData;
    }

    private async processFile (folder, filename) {
        const ext = path.parse(filename).ext;
        const filepath = path.resolve(folder, filename);

        const fileStats = await stat(filepath);
            const isFile = fileStats.isFile();
            if (isFile) {
                if (ext != '.csv' || filename === reportFileName) {
                    return;
                }
                const results = await this.utils.readFileJSON(folder+filename);
                console.log('Processing file :', filename);
                this.totalReports++;
                await this.addToReport(results);
            }
    
    }
    public async generate(folder: string) {
        const fileNames = await readdir(folder);
        const promises:any = [];
        fileNames.forEach(filename => {
            promises.push(this.processFile(folder, filename));
        });
        await Promise.all(promises);
    }
    
    public async publish (folder) {
        this.sortDataByProfit();
        const opts = { delimiter: { field: ';' }};
        let csv;
        converter.json2csv(this.reportData, (error, result) => {
            csv = result;
            const outputFile = folder + reportFileName;
            fs.writeFile(outputFile, csv, err => {
                if (err) {
                  console.error(err);
                  return;
                }
                console.log('================================================');
                console.log('Files procesed      => ' + this.totalReports);
                console.log('Report published to => ' + outputFile);
                console.log('================================================');
              });
            
              const chartsDir = './charts/lastReport/';
              const chartsOutputFile = chartsDir + 'report.csv'; 
              fs.writeFile(chartsOutputFile, csv, err => {
                if (err) {
                  console.error(err);
                  return;
                }
                console.log('================================================');
                console.log('[Charts] Expense published to => ' + chartsOutputFile);
                console.log('================================================');
              });
        
        }, opts);
    }

    private sortDataByProfit() {
        this.reportData.forEach(entry => {
            entry.Profit = Number(entry.Profit);
        });
        this.reportData = _.orderBy(this.reportData, ['Profit'], ['desc']);
    }
    
    private showPlayerData (player, tag) {
        let playerStr = '    ';
        if(tag) {
            playerStr += `[ ${tag} ] `;
        }
        playerStr += `Player: ${player.ID}, Profit: ${player.Profit}, Hands: ${player.Hands}`;
        console.log(playerStr);
    }
    
    private async addToReport(results) {
        _.forEach(results, expense => {
            let user_exists = false;
            const masterUserId = this.utils.getMasterUserId(expense.ID);
            _.forEach(this.reportData, user => {
                if (user.ID == masterUserId) {
                    // console.log(`Found expense -> Player : ${sw_username} / ${user.ID}, Profit (Old): ${user.Profit}, Profit (New): ${expense.Profit}`);
                    user_exists = true;
                    _.forEach(this.reportMetrics, metric => {
                        user[metric] += expense[metric];
                        // console.log(`Updating metric -> ${metric}. Old: ${old}, Current: ${expense[metric]}, New: ${user[metric]}, Type: ${typeof(user[metric])} / ${typeof(expense[metric])}`);
                    });
                    this.showPlayerData(user, 'UPDATE ' + masterUserId);
                }
            });
            if (!user_exists) {
                expense.ID = masterUserId;
                this.reportData.push(expense);
                this.showPlayerData(expense, 'ADD ' + masterUserId);
            }
        });
    
    }
}
