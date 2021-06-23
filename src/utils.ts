import { config } from './config';
import * as _ from 'lodash';
const csvToJson = require('convert-csv-to-json');
const fs = require('fs');

export class Utils {

    public logger;

    constructor (private args) {}
    
    public async readFileJSON(filename: string) {
        let results_json = await csvToJson.formatValueByType().getJsonFromCsv(filename);
        // console.log(results_json);
        return results_json;
    }

    public generateFileNameFromID(id: string) {
        if (!id) {
            throw new Error('Missing game ID ');
        }
        let filename = `../data/Pokerrrr_${id}_export.csv`;
        try {
            if (fs.existsSync(filename)) {
            }
            else {
                // console.log(`Could not locate file ${filename}. Trying ${id} instead ...`);
                filename = id;
            }
        } catch (err) {
            console.log('Could not locate file ' + filename);
            filename = id; // use exact filename
        }
        return filename;
    }

    public getMasterUserId (id) {
        let masterId = id;
        if (config.pkr2SwMapping) {
            const swUsername = config.pkr2SwMapping[id];
            _.forEach(config.pkr2SwMapping, (value, key) => {
                if (value === swUsername) {
                    // console.log(`User ${swUsername} : Old ID : ${id}, New ID : ${key}`);
                    masterId = key;
                };
            })
        }
        return masterId;
    }

    public printHelp() {
        console.log('=================================================');
        console.log('Usage: node . [expense|report] <game_id> <gold_cost> <create_splitwise>');
        console.log('where:');
        console.log('  game_id   : poker game id');
        console.log('  gold_cost : creates a gold entry against winner');
        console.log('  create_splitwise : create entry in splitwise. Default: false');
        console.log('=================================================');
    }

    public showTopBanner() {
        console.log('-----------------------------------------------');
        console.log(' Report for Game ID ' + this.args.file);
        console.log('-----------------------------------------------');
    }

    public showBottomBanner = function (members, results, totalCost) {
        const startTime = new Date(results[0].DateStarted);
        const stopTime = new Date(results[0].DateEnded);
        const timeSpent = Number(stopTime) - Number(startTime);
        const duration = (timeSpent / (1000 * 3600)).toFixed(2);
        console.log('================================================');
        console.log(' Duration: ' + duration + ' hrs'.padEnd(7) + 'Players : ' + Object.keys(results).length + '/' + Object.keys(members).length);
        console.log(' Cost    : $' + String(totalCost).padEnd(8) + '  Fees    : $' + this.args.hostingFees);
        console.log('================================================');
        const createSplitwise = Number(this.args.createSplitwise);
        if (!createSplitwise) {
            console.log('NOTE : This was a dry run. Set createSplitwise to 1 to create expense');
        }
    }
}
