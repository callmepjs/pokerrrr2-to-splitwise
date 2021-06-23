export const config = {
    splitwise : {
      key: undefined,     // replace with splitwise key
      secret: undefined,  // replace with splitwise secrets
      group_id : '123456',
    },
    pokerrrr : {
      chip_to_dollar_ratio : 1
    },
    schema : {
        properties: {
          action: {
            pattern: /^(report|expense)$/,
            description: '[expense | report]',
            message: 'valid values : expense, report',
            required: true
          },
          file: {
            description: '[file | folder]',
            required: true
          },
          hostingFees : {
              description: '[hosting fees ($)]',
              type: 'number',
              required: false
          },
          host : {
            description: '[host]',
            type: 'string',
            required: false
        },
          createSplitwise: {
              description: '[create splitwise ?]',
              pattern: /^(1|0)$/,
              message: 'enter 1 to update splitwise, 0 for a dry run',
              required: false
          }
        }
      },
 
      pkr2SwMapping : {
          // "#D6LSA" : "SPLITWISE_FIRST_NAME",
      },
}
