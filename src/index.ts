import { Expenses } from './expenses';
import { Reports } from './reports';
import { Utils } from './utils';
import { config } from './config';
const optimist = require('optimist')
import * as _ from 'lodash';

const prompt = require('prompt');

(async () => {
    prompt.override = optimist.argv;
    prompt.start();
    const args = await prompt.get(config.schema);
    const utils = new Utils(args);

    console.log('Launching with config : ' + JSON.stringify(args));
    switch (args.action.trim()) {
        case 'expense':
            await handleExpense(args, utils);
            break;
        case 'report':
            handleReport(args, utils);
            break;
        default:
            console.log('Unknown option ' + args.action);
            utils.printHelp();
    }
 
})()

async function handleReport(args, utils) {
    utils.showTopBanner();
    const report = new Reports(args);
    await report.generate(args.file);
    await report.publish(args.file); // publish to same directory
}

async function handleExpense(args, utils) {
    utils.showTopBanner();
    try {
    const gameExpenses = new Expenses(args);
    const goldExpenses = new Expenses(args);
    const resultsFile = utils.generateFileNameFromID(args.file);
    const [members, results] = await Promise.all([
        gameExpenses.fetchMembers(),
        utils.readFileJSON(resultsFile)
    ]);
    await Promise.all([
        gameExpenses.createExpense(args.file, members, results, false),
        goldExpenses.createGoldExpense(args.file, args.hostingFees, args.hos, members, results)
    ]);

    utils.showBottomBanner(members, results, gameExpenses.expenseTotal);
    // console.log(results); // for charts.js input
    }
    catch (e) {
        console.log('Failed to process expenses. Error : ' + e);
    };
}



